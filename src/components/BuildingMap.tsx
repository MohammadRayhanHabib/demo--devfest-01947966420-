import {
    Background,
    BackgroundVariant,
    Controls,
    ReactFlow,
    getViewportForBounds,
    type EdgeTypes,
    type NodeTypes,
    type ReactFlowInstance,
} from "@xyflow/react";
import { toPng } from "html-to-image";
import { useImperativeHandle, useMemo, useRef, type Ref } from "react";
import { cx } from "../lib/cx";
import { localizeDigits, type Lang, type Translate } from "../lib/i18n";
import { layoutPositions } from "../lib/layout";
import type { Hazards, LoadedBuilding, Mode, RouteResult } from "../lib/types";
import { CorridorEdge, type CorridorFlowEdge } from "./CorridorEdge";
import { MapNode, type MapFlowNode } from "./MapNode";

const nodeTypes: NodeTypes = { building: MapNode };
const edgeTypes: EdgeTypes = { corridor: CorridorEdge };

export type MapHandle = { exportPng: () => Promise<void> };

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
    ref?: Ref<MapHandle>;
};

export function BuildingMap({ building, hazards, start, route, mode, lang, t, onNodeActivate, onEdgeToggle, ref }: Props) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const flowRef = useRef<ReactFlowInstance<MapFlowNode, CorridorFlowEdge> | null>(null);
    const positions = useMemo(() => layoutPositions(building.data.nodes), [building]);

    const routeInfo = useMemo(() => {
        if (route.status !== "ok") return { key: "", nodes: new Set<string>(), edges: new Map<string, number>(), path: [] as string[] };
        return {
            key: route.path.join(">"),
            nodes: new Set(route.path),
            edges: new Map(route.edges.map((id, i) => [id, i])),
            path: route.path,
        };
    }, [route]);

    const unavailable = (id: string) => hazards.blockedNodes.has(id) || hazards.closedExits.has(id);

    const nodes: MapFlowNode[] = building.data.nodes.map((node) => {
        const isBlocked = unavailable(node.id);
        const isStart = node.id === start;
        const typeName = t(node.type === "room" ? "typeRoom" : node.type === "junction" ? "typeJunction" : "typeExit");
        const parts = [`${node.label} (${node.id})`, typeName];
        if (isBlocked) parts.push(t(node.type === "exit" ? "stateClosed" : "stateBlocked"));
        if (isStart) parts.push(t("stateStart"));
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
                onRoute: routeInfo.nodes.has(node.id),
                isTarget: route.status === "ok" && route.exit === node.id,
                ariaLabel: parts.join(", "),
                onActivate: onNodeActivate,
            },
        };
    });

    const edges: CorridorFlowEdge[] = building.data.edges.map((edge) => {
        const blocked = hazards.blockedEdges.has(edge.id);
        const routeIndex = routeInfo.edges.get(edge.id) ?? -1;
        return {
            id: edge.id,
            type: "corridor",
            source: edge.from,
            target: edge.to,
            selectable: false,
            data: {
                edge,
                blocked,
                dead: !blocked && (unavailable(edge.from) || unavailable(edge.to)),
                onRoute: routeIndex >= 0,
                routeIndex: Math.max(routeIndex, 0),
                reversed: routeIndex >= 0 && routeInfo.path[routeIndex] !== edge.from,
                routeKey: routeInfo.key,
                costText: localizeDigits(edge.cost, lang),
                ariaLabel: t("edgeAria", {
                    from: edge.from,
                    to: edge.to,
                    cost: edge.cost,
                    state: t(blocked ? "stateBlocked" : "stateOpen"),
                }),
                onToggle: onEdgeToggle,
            },
        };
    });

    useImperativeHandle(ref, () => ({
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
                    backgroundColor: "#f8fafc",
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
                key={building.loadId}
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                nodeOrigin={[0.5, 0.5]}
                fitView
                fitViewOptions={{ padding: 0.18 }}
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
            >
                <Background variant={BackgroundVariant.Dots} gap={22} size={1.6} color="#cbd5e1" />
                <Controls showInteractive={false} position="bottom-right" />
            </ReactFlow>
        </div>
    );
}
