import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { ArrowUpDown, Ban, CircleCheck, DoorClosed, DoorOpen, LogOut, Split, TriangleAlert } from "lucide-react";
import { memo } from "react";
import { cx } from "../lib/cx";
import type { BuildingNode } from "../lib/types";

export type MapNodeData = {
    node: BuildingNode;
    isStart: boolean;
    isBlocked: boolean;
    onRoute: boolean;
    isTarget: boolean;
    ariaLabel: string;
    startText: string;
    typeText: string;
    bannerText: string;
    /** Number of corridors touching this node (localized). */
    degree: string;
    /** Cumulative route cost at this node, when it is on the route (localized). */
    routeCost: string | null;
    onActivate: (id: string) => void;
};

export type MapFlowNode = Node<MapNodeData, "building">;

const ICONS = { room: DoorOpen, junction: Split, exit: LogOut };

function frame({ node, isStart, isBlocked, onRoute, isTarget }: MapNodeData) {
    if (isBlocked) return node.type === "exit" ? "border-dashed border-zinc-300" : "border-rose-200";
    if (isStart) return "border-blue-400 shadow-[0_0_0_4px_rgba(59,130,246,0.15)]";
    if (isTarget) return "border-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.16)]";
    if (onRoute) return "border-indigo-400 shadow-[0_0_0_4px_rgba(99,102,241,0.14)]";
    return "border-zinc-200";
}

function statusDot({ node, isStart, isBlocked, onRoute }: MapNodeData) {
    if (isBlocked) return node.type === "exit" ? "bg-zinc-400" : "bg-rose-500";
    if (isStart) return "bg-blue-500";
    if (onRoute && node.type !== "exit") return "bg-indigo-500";
    return "bg-emerald-500";
}

/** Node card (pattern from infra/network dashboards: icon box, mono ID, status tile, metric footer). */
export const MapNode = memo(function MapNode({ data }: NodeProps<MapFlowNode>) {
    const { node, isStart, isBlocked } = data;
    const Icon = ICONS[node.type];
    const isExit = node.type === "exit";

    return (
        <div className="relative w-[224px]">
            <Handle type="target" position={Position.Top} className="center-handle" isConnectable={false} />
            <Handle type="source" position={Position.Top} className="center-handle" isConnectable={false} />

            {isStart && !isBlocked && (
                <span className="animate-fade-up pointer-events-none absolute bottom-full left-1/2 mb-3 -translate-x-1/2 rounded-full bg-zinc-600 px-3 py-1 font-mono text-[11px] font-semibold tracking-widest whitespace-nowrap text-white uppercase ring-4 ring-zinc-200">
                    {data.startText}
                </span>
            )}

            <button
                type="button"
                onClick={() => data.onActivate(node.id)}
                aria-label={data.ariaLabel}
                title={`${node.label} (${node.id})`}
                className={cx(
                    "pointer-events-auto block w-full cursor-pointer overflow-hidden rounded-2xl border bg-white text-left shadow-sm outline-none",
                    "transition-[border-color,box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:shadow-md",
                    "focus-visible:ring-4 focus-visible:ring-indigo-300",
                    frame(data),
                    isStart && "animate-pop",
                )}
            >
                {isBlocked && (
                    <span
                        className={cx(
                            "flex items-center gap-1.5 border-b px-3 py-1.5 text-[13px] font-semibold",
                            isExit ? "border-zinc-200 bg-zinc-50 text-zinc-500" : "border-rose-100 bg-rose-50 text-rose-700",
                        )}
                    >
                        {isExit ? <DoorClosed aria-hidden="true" className="size-3.5" /> : <TriangleAlert aria-hidden="true" className="size-3.5" />}
                        {data.bannerText}
                    </span>
                )}

                <span className="flex items-center gap-3 p-3">
                    <span
                        aria-hidden="true"
                        className={cx(
                            "grid size-10 shrink-0 place-items-center rounded-xl border",
                            isExit && !isBlocked
                                ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                                : isBlocked && !isExit
                                  ? "border-rose-200 bg-rose-50 text-rose-600"
                                  : "border-zinc-200 bg-zinc-50 text-zinc-600",
                        )}
                    >
                        <Icon className="size-5" strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block font-mono text-[15px] font-semibold text-zinc-900">{node.id}</span>
                        <span className="block truncate text-[13px] text-zinc-500">{node.label}</span>
                    </span>
                    <span aria-hidden="true" className="relative grid size-8 shrink-0 place-items-center rounded-lg border border-zinc-200 bg-white">
                        <span className={cx("absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2 ring-white", statusDot(data))} />
                        {isBlocked ? <Ban className="size-4 text-zinc-400" /> : <CircleCheck className="size-4 text-zinc-400" />}
                    </span>
                </span>

                <span className="flex items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50/70 px-3 py-2 font-mono text-xs text-zinc-600">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-1.5 py-0.5">
                        <ArrowUpDown aria-hidden="true" className="size-3.5" />
                        {data.degree}
                    </span>
                    {data.routeCost !== null ? (
                        <span className="rounded-md bg-indigo-600 px-1.5 py-0.5 text-white">Σ {data.routeCost}</span>
                    ) : (
                        <span className="rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 text-zinc-500">{data.typeText}</span>
                    )}
                </span>
            </button>
        </div>
    );
});
