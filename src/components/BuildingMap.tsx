import {
    Background,
    BackgroundVariant,
    ReactFlow,
    getViewportForBounds,
    useReactFlow,
    type EdgeTypes,
    type FitViewOptions,
    type NodeTypes,
    type ReactFlowInstance,
} from "@xyflow/react";
import { toPng } from "html-to-image";
import { Maximize, Minus, Plus } from "lucide-react";
import { useImperativeHandle, useMemo, useRef, type Ref } from "react";
import { cx } from "../lib/cx";
import { localizeDigits, type Lang, type Translate } from "../lib/i18n";
import { layoutPositions } from "../lib/layout";
import type { Hazards, LoadedBuilding, Mode, RouteResult } from "../lib/types";
import { CorridorEdge, type CorridorFlowEdge } from "./CorridorEdge";
import { MapNode, type MapFlowNode, type Side } from "./MapNode";

const nodeTypes: NodeTypes = { building: MapNode };
const edgeTypes: EdgeTypes = { corridor: CorridorEdge };
const OPPOSITE: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };

export type MapHandle = { exportPng: () => Promise<void>; focusRoute: () => void };

type Props = {
    building: LoadedBuilding;
    hazards: Hazards;
    start: string | null;
    route: RouteResult;
    mode: Mode;
    lang: Lang;
    t: Translate;
    onNodeActivate: (id: string) => void;
    onEdgeToggle: (id: string) => void;
    /** Keeps nodes clear of the floating rail, pill and inspector when fitting the view. */
    fitPadding?: FitViewOptions["padding"];
    ref?: Ref<MapHandle>;
};

/** Bottom-left zoom stack: fit on its own, then + / − joined (Sensa canvas controls). */
function ZoomStack({ t, padding }: { t: Translate; padding: FitViewOptions["padding"] }) {
    const { zoomIn, zoomOut, fitView } = useReactFlow();
    const button =
        "grid size-9 cursor-pointer place-items-center text-slate-600 transition-colors outline-none hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-4 focus-visible:ring-brand-200";
    const surface = "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]";
    return (
        <div className="absolute bottom-4 left-4 z-10 hidden flex-col gap-2 sm:flex">
            <div className={surface}>
                <button type="button" aria-label={t("fitView")} title={t("fitView")} onClick={() => void fitView({ padding, maxZoom: 1, duration: 350 })} className={button}>
                    <Maximize aria-hidden="true" className="size-4" />
                </button>
            </div>
            <div className={cx(surface, "flex flex-col divide-y divide-slate-100")}>
                <button type="button" aria-label={t("zoomIn")} title={t("zoomIn")} onClick={() => void zoomIn({ duration: 200 })} className={button}>
                    <Plus aria-hidden="true" className="size-4" />
                </button>
                <button type="button" aria-label={t("zoomOut")} title={t("zoomOut")} onClick={() => void zoomOut({ duration: 200 })} className={button}>
                    <Minus aria-hidden="true" className="size-4" />
                </button>
            </div>
        </div>
    );
}

export function BuildingMap({ building, hazards, start, route, mode, lang, t, onNodeActivate, onEdgeToggle, fitPadding, ref }: Props) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const flowRef = useRef<ReactFlowInstance<MapFlowNode, CorridorFlowEdge> | null>(null);
    const positions = useMemo(() => layoutPositions(building.data.nodes), [building]);
    const num = (v: number) => localizeDigits(v, lang);

    const routeInfo = useMemo(() => {
        if (route.status !== "ok") return { key: "", nodes: new Map<string, number>(), edges: new Map<string, number>(), path: [] as string[] };
        return {
            key: route.path.join(">"),
            nodes: new Map(route.path.map((id, i) => [id, i])),
            edges: new Map(route.edges.map((id, i) => [id, i])),
            path: route.path,
        };
    }, [route]);

    // Each corridor leaves through the card side facing its neighbour, so connectors meet visible ports.
    const sides = useMemo(() => {
        const map = new Map<string, [Side, Side]>();
        for (const edge of building.data.edges) {
            const a = positions.get(edge.from)!;
            const b = positions.get(edge.to)!;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const from: Side = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "right" : "left") : dy >= 0 ? "bottom" : "top";
            map.set(edge.id, [from, OPPOSITE[from]]);
        }
        return map;
    }, [building, positions]);

    const ports = new Map<string, Set<Side>>();
    const routePorts = new Map<string, Set<Side>>();
    const addPort = (target: Map<string, Set<Side>>, id: string, side: Side) => {
        if (!target.has(id)) target.set(id, new Set());
        target.get(id)!.add(side);
    };
    for (const edge of building.data.edges) {
        const [from, to] = sides.get(edge.id)!;
        addPort(ports, edge.from, from);
        addPort(ports, edge.to, to);
        if (routeInfo.edges.has(edge.id)) {
            addPort(routePorts, edge.from, from);
            addPort(routePorts, edge.to, to);
        }
    }

    const costAt = new Map<string, number>();
    if (route.status === "ok") {
        let sum = 0;
        route.path.forEach((id, i) => {
            if (i > 0) sum += route.legs[i - 1];
            costAt.set(id, sum);
        });
    }

    const unavailable = (id: string) => hazards.blockedNodes.has(id) || hazards.closedExits.has(id);
    const degreeText = (n: number) => (n === 1 ? t("corridorsOne") : t("corridorsN", { n }));

    const nodes: MapFlowNode[] = building.data.nodes.map((node) => {
        const isBlocked = unavailable(node.id);
        const isStart = node.id === start;
        const step = routeInfo.nodes.get(node.id);
        const onRoute = step !== undefined;
        const isTarget = route.status === "ok" && route.exit === node.id;
        const typeName = t(node.type === "room" ? "typeRoom" : node.type === "junction" ? "typeJunction" : "typeExit");
        const typeTitle = t(node.type === "room" ? "legendRoom" : node.type === "junction" ? "legendJunction" : "legendExit");
        const blockedText = t(node.type === "exit" ? "closedExit" : "blockedNode");

        const parts = [`${node.label} (${node.id})`, typeName];
        if (isBlocked) parts.push(t(node.type === "exit" ? "stateClosed" : "stateBlocked"));
        if (isStart) parts.push(t("stateStart"));

        let detailText = "";
        if (!isBlocked && route.status === "ok" && onRoute) {
            if (step === 0) detailText = t("startingAt");
            else if (isTarget) detailText = t("routeTotal", { cost: route.cost });
            else detailText = t("legFrom", { cost: route.legs[step! - 1], from: route.path[step! - 1] });
        }

        return {
            id: node.id,
            type: "building",
            position: positions.get(node.id)!,
            draggable: false,
            selectable: false,
            data: {
                node,
                isStart,
                isBlocked,
                onRoute,
                isTarget,
                ariaLabel: parts.join(", "),
                pillText: isBlocked ? blockedText : isStart ? t("legendStart") : typeTitle,
                typeText: typeName,
                statusText: isBlocked ? blockedText : onRoute ? t("statusOnRoute") : t("stateOpen"),
                detailText,
                routeCost: costAt.has(node.id) ? num(costAt.get(node.id)!) : null,
                degreeText: degreeText(building.graph.adjacency.get(node.id)!.length),
                ports: [...(ports.get(node.id) ?? [])],
                routePorts: [...(routePorts.get(node.id) ?? [])],
                onActivate: onNodeActivate,
            },
        };
    });

    const edges: CorridorFlowEdge[] = building.data.edges.map((edge) => {
        const blocked = hazards.blockedEdges.has(edge.id);
        const routeIndex = routeInfo.edges.get(edge.id) ?? -1;
        const [from, to] = sides.get(edge.id)!;
        return {
            id: edge.id,
            type: "corridor",
            source: edge.from,
            target: edge.to,
            sourceHandle: `${from}-s`,
            targetHandle: `${to}-t`,
            selectable: false,
            data: {
                edge,
                blocked,
                dead: !blocked && (unavailable(edge.from) || unavailable(edge.to)),
                onRoute: routeIndex >= 0,
                routeIndex: Math.max(routeIndex, 0),
                reversed: routeIndex >= 0 && routeInfo.path[routeIndex] !== edge.from,
                routeActive: route.status === "ok",
                routeKey: routeInfo.key,
                costText: num(edge.cost),
                ariaLabel: t("edgeAria", { from: edge.from, to: edge.to, cost: edge.cost, state: t(blocked ? "stateBlocked" : "stateOpen") }),
                onToggle: onEdgeToggle,
            },
        };
    });

    useImperativeHandle(ref, () => ({
        focusRoute() {
            const flow = flowRef.current;
            if (!flow) return;
            const ids = route.status === "ok" ? route.path : [];
            void flow.fitView({ nodes: ids.map((id) => ({ id })), padding: fitPadding, maxZoom: 1.1, duration: 500 });
        },
        async exportPng() {
            const flow = flowRef.current;
            const viewportEl = wrapperRef.current?.querySelector<HTMLElement>(".react-flow__viewport");
            if (!flow || !viewportEl) return;

            const bounds = flow.getNodesBounds(flow.getNodes());
            const width = Math.round(Math.max(900, bounds.width + 240));
            const height = Math.round(Math.max(560, bounds.height + 240));
            const viewport = getViewportForBounds(bounds, width, height, 0.5, 2, 0.12);

            wrapperRef.current!.classList.add("exporting");
            try {
                const dataUrl = await toPng(viewportEl, {
                    backgroundColor: "#f3f4f6",
                    width,
                    height,
                    pixelRatio: 2,
                    skipFonts: true,
                    style: {
                        width: `${width}px`,
                        height: `${height}px`,
                        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                    },
                });
                const link = document.createElement("a");
                link.download = `smart-escape-${building.data.building.replace(/[^\w-]+/g, "-").toLowerCase()}.png`;
                link.href = dataUrl;
                link.click();
            } finally {
                wrapperRef.current?.classList.remove("exporting");
            }
        },
    }));

    return (
        <div ref={wrapperRef} className={cx("h-full w-full", mode === "hazard" ? "mode-hazard" : "mode-start")}>
            <ReactFlow<MapFlowNode, CorridorFlowEdge>
                key={`${building.loadId}:${JSON.stringify(fitPadding)}`}
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                nodeOrigin={[0.5, 0.5]}
                fitView
                fitViewOptions={{ padding: fitPadding, maxZoom: 1 }}
                minZoom={0.2}
                maxZoom={2.5}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                nodesFocusable={false}
                edgesFocusable={false}
                onEdgeClick={(_, edge) => onEdgeToggle(edge.id)}
                onInit={(instance) => {
                    flowRef.current = instance;
                }}
                proOptions={{ hideAttribution: false }}
            >
                <Background variant={BackgroundVariant.Dots} gap={16} size={1.2} color="#cfd4dc" bgColor="#f3f4f6" />
                <ZoomStack t={t} padding={fitPadding} />
            </ReactFlow>
        </div>
    );
}
