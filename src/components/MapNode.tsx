import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Ban, DoorClosed, DoorOpen, LogOut, MapPin, Split, type LucideIcon } from "lucide-react";
import { memo } from "react";
import { cx } from "../lib/cx";
import type { BuildingNode } from "../lib/types";

export type Side = "top" | "right" | "bottom" | "left";

export type MapNodeData = {
    node: BuildingNode;
    isStart: boolean;
    isBlocked: boolean;
    onRoute: boolean;
    isTarget: boolean;
    /** A route is on screen, so cards off the route recede. */
    routeActive: boolean;
    ariaLabel: string;
    /** Text for the pill above the card ("Room", "Start", "Blocked"...). */
    pillText: string;
    /** Status word in the inset well ("Open", "On route", "Blocked"...). */
    statusText: string;
    /** Right side of the well: "Step 2/5" on the route, otherwise "3 corridors". */
    metaText: string;
    /** Secondary line in the well, e.g. "+3 from C1". */
    detailText: string;
    costLabel: string;
    /** Cumulative route cost at this node (localized) or null. */
    routeCost: string | null;
    /** Sides that carry a corridor; only those show a port dot. */
    ports: Side[];
    routePorts: Side[];
    onActivate: (id: string) => void;
};

export type MapFlowNode = Node<MapNodeData, "building">;

const SIDES: { side: Side; position: Position }[] = [
    { side: "top", position: Position.Top },
    { side: "right", position: Position.Right },
    { side: "bottom", position: Position.Bottom },
    { side: "left", position: Position.Left },
];

const TYPE_LOOK: Record<BuildingNode["type"], { icon: LucideIcon; dot: string }> = {
    room: { icon: DoorOpen, dot: "bg-sky-500" },
    junction: { icon: Split, dot: "bg-amber-500" },
    exit: { icon: LogOut, dot: "bg-emerald-500" },
};

/** Workflow-canvas node: type pill, black icon tile + title, inset status well, footer metric, port dots. */
export const MapNode = memo(function MapNode({ data }: NodeProps<MapFlowNode>) {
    const { node, isStart, isBlocked, onRoute, isTarget, routeActive } = data;
    const isExit = node.type === "exit";
    const look = TYPE_LOOK[node.type];
    const recede = routeActive && !onRoute && !isStart && !isBlocked;

    const pill = isBlocked
        ? isExit
            ? { cls: "bg-neutral-100 text-neutral-600 ring-neutral-200", dot: "bg-neutral-400" }
            : { cls: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" }
        : isStart
          ? { cls: "bg-neutral-950 text-white ring-neutral-950", dot: "bg-white" }
          : { cls: "bg-white text-neutral-800 ring-neutral-200", dot: look.dot };

    const Icon = isBlocked ? (isExit ? DoorClosed : Ban) : isStart ? MapPin : look.icon;
    const tile = isBlocked ? (isExit ? "bg-neutral-400 text-white" : "bg-rose-600 text-white") : "bg-neutral-950 text-white";
    const well = isBlocked ? "bg-rose-50 text-rose-700" : onRoute || isStart ? "bg-neutral-100 text-neutral-900" : "bg-neutral-50 text-neutral-500";

    return (
        <div className={cx("relative w-[268px] transition-[opacity,filter] duration-300", recede && "opacity-60 saturate-50")}>
            {SIDES.map(({ side, position }) => (
                <span key={side}>
                    <Handle id={`${side}-t`} type="target" position={position} isConnectable={false} className="port port-hidden" />
                    <Handle
                        id={`${side}-s`}
                        type="source"
                        position={position}
                        isConnectable={false}
                        className={cx("port", !data.ports.includes(side) && "port-hidden", data.routePorts.includes(side) && "port-route")}
                    />
                </span>
            ))}

            <span
                className={cx(
                    "pointer-events-none absolute bottom-full left-1 mb-1.5 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12.5px] font-semibold ring-1 whitespace-nowrap",
                    "transition-colors duration-300",
                    pill.cls,
                )}
            >
                <span aria-hidden="true" className={cx("size-1.5 rounded-full", pill.dot)} />
                {data.pillText}
            </span>

            <button
                type="button"
                onClick={() => data.onActivate(node.id)}
                aria-label={data.ariaLabel}
                title={`${node.label} (${node.id})`}
                className={cx(
                    "pointer-events-auto block w-full cursor-pointer rounded-xl border bg-white p-3 text-left outline-none",
                    "shadow-[0_1px_2px_rgba(10,10,10,0.06)] transition-[border-color,translate] duration-300 ease-out",
                    "hover:-translate-y-px focus-visible:ring-4 focus-visible:ring-brand-200",
                    isBlocked
                        ? isExit
                            ? "border-dashed border-neutral-300"
                            : "border-rose-300 hover:border-rose-400"
                        : isStart
                          ? "border-2 border-neutral-950"
                          : isTarget
                            ? "border-2 border-emerald-500"
                            : onRoute
                              ? "border-neutral-400 hover:border-neutral-500"
                              : "border-neutral-200 hover:border-neutral-300",
                    isStart && "animate-pop",
                )}
            >
                <span className="flex items-center gap-3">
                    <span aria-hidden="true" className={cx("grid size-9 shrink-0 place-items-center rounded-lg transition-colors duration-300", tile)}>
                        <Icon className="size-[18px]" strokeWidth={2.25} />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 block text-[15px] leading-tight font-semibold break-words text-neutral-950">{node.label}</span>
                        <span className="mt-0.5 block font-mono text-[12.5px] text-neutral-500">{node.id}</span>
                    </span>
                </span>

                <span className={cx("mt-3 block rounded-lg px-3 py-2 transition-colors duration-300", well)}>
                    <span className="flex items-center justify-between gap-2 text-[12px] font-semibold">
                        <span className="tracking-wide uppercase">{data.statusText}</span>
                        <span className="font-medium">{data.metaText}</span>
                    </span>
                    {data.detailText && <span className="mt-1 block text-[13px] text-neutral-600">{data.detailText}</span>}
                </span>

                <span className="mt-2.5 flex items-center justify-between px-1 text-[12px] text-neutral-500">
                    <span>{data.costLabel}</span>
                    {data.routeCost !== null ? (
                        <span className="font-mono text-[13px] font-semibold text-neutral-950">{data.routeCost}</span>
                    ) : (
                        <span className="font-mono text-neutral-300">—</span>
                    )}
                </span>
            </button>
        </div>
    );
});
