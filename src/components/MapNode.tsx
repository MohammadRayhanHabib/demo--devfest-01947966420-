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
    ariaLabel: string;
    /** Text for the colored pill above the card ("Room", "Start", "Blocked"...). */
    pillText: string;
    typeText: string;
    /** Status word in the inset well ("Open", "On route", "Blocked"...). */
    statusText: string;
    /** Secondary line in the well, e.g. "+3 from C1" or "3 corridors". */
    detailText: string;
    /** Cumulative route cost at this node (localized) or null. */
    routeCost: string | null;
    degreeText: string;
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

const TYPE_LOOK: Record<BuildingNode["type"], { icon: LucideIcon; tile: string; pill: string; dot: string }> = {
    room: { icon: DoorOpen, tile: "bg-sky-100 text-sky-700", pill: "bg-sky-50 text-sky-800 ring-sky-200", dot: "bg-sky-500" },
    junction: { icon: Split, tile: "bg-amber-100 text-amber-700", pill: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500" },
    exit: { icon: LogOut, tile: "bg-emerald-100 text-emerald-700", pill: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500" },
};

/** Workflow-canvas node: type pill, icon tile + title, inset status well, footer metric, port dots. */
export const MapNode = memo(function MapNode({ data }: NodeProps<MapFlowNode>) {
    const { node, isStart, isBlocked, onRoute, isTarget } = data;
    const isExit = node.type === "exit";
    const look = TYPE_LOOK[node.type];

    const pill = isBlocked
        ? isExit
            ? { cls: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" }
            : { cls: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" }
        : isStart
          ? { cls: "bg-brand-50 text-brand-700 ring-brand-200", dot: "bg-brand-600" }
          : { cls: look.pill, dot: look.dot };

    const Icon = isBlocked ? (isExit ? DoorClosed : Ban) : isStart ? MapPin : look.icon;
    const tile = isBlocked ? (isExit ? "bg-slate-100 text-slate-500" : "bg-rose-100 text-rose-600") : isStart ? "bg-brand-600 text-white" : look.tile;
    const well = isBlocked
        ? "bg-rose-50/60 text-rose-700"
        : onRoute || isStart
          ? "bg-brand-50 text-brand-700"
          : "bg-slate-50 text-slate-500";

    return (
        <div className="relative w-[248px]">
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
                    "pointer-events-none absolute bottom-full left-1 mb-1.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 whitespace-nowrap",
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
                    "pointer-events-auto block w-full cursor-pointer rounded-xl border bg-white p-2.5 text-left outline-none",
                    "shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-[border-color,box-shadow,translate] duration-300 ease-out",
                    "hover:-translate-y-px hover:shadow-[0_6px_16px_-6px_rgba(15,23,42,0.18)] focus-visible:ring-4 focus-visible:ring-brand-200",
                    isBlocked
                        ? isExit
                            ? "border-dashed border-slate-300"
                            : "border-rose-300"
                        : isStart
                          ? "border-brand-500 shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                          : isTarget
                            ? "border-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]"
                            : onRoute
                              ? "border-brand-200"
                              : "border-slate-200",
                    isStart && "animate-pop",
                )}
            >
                <span className="flex items-center gap-2.5 px-0.5">
                    <span aria-hidden="true" className={cx("grid size-8 shrink-0 place-items-center rounded-lg transition-colors duration-300", tile)}>
                        <Icon className="size-4" strokeWidth={2.25} />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 block text-[13px] leading-tight font-semibold break-words text-slate-900">{node.label}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">
                            <span className="font-mono">{node.id}</span> · {data.typeText}
                        </span>
                    </span>
                </span>

                <span className={cx("mt-2.5 block rounded-lg px-2.5 py-2 transition-colors duration-300", well)}>
                    <span className="flex items-center justify-between gap-2 text-[10px] font-semibold tracking-wider uppercase">
                        <span>{data.statusText}</span>
                        <span className="font-mono tracking-normal normal-case">{data.degreeText}</span>
                    </span>
                    {data.detailText && <span className="mt-1 block text-xs text-slate-600">{data.detailText}</span>}
                </span>

                <span className="mt-2 flex items-center justify-between px-1 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                    <span>{data.typeText}</span>
                    {data.routeCost !== null ? (
                        <span className="font-mono text-[11px] tracking-normal text-brand-700">Σ {data.routeCost}</span>
                    ) : (
                        <span className="font-mono tracking-normal text-slate-300">—</span>
                    )}
                </span>
            </button>
        </div>
    );
});
