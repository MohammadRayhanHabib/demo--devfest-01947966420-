import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Ban, DoorClosed, LogOut } from "lucide-react";
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
    onActivate: (id: string) => void;
};

export type MapFlowNode = Node<MapNodeData, "building">;

/** Visual state of a node; one palette per state so classes never conflict. */
function look({ node, isStart, isBlocked, onRoute, isTarget }: MapNodeData) {
    if (node.type === "exit") {
        const exitBase = "flex h-12 items-center gap-1.5 rounded-xl border-2 px-3 text-[15px]";
        if (isBlocked) return cx(exitBase, "border-dashed border-slate-400 bg-slate-100 text-slate-400");
        return cx(
            exitBase,
            "bg-emerald-600 text-white",
            isTarget ? "border-emerald-300 shadow-[0_0_0_6px_rgba(16,185,129,0.28)]" : "border-emerald-700",
        );
    }
    const shape = node.type === "room" ? "size-14 rounded-2xl text-[15px]" : "size-11 rounded-full text-[13px]";
    const base = cx("grid place-items-center border-2", shape);
    if (isBlocked) return cx(base, "border-rose-500 bg-rose-50 text-rose-700");
    if (isStart) return cx(base, "border-blue-600 bg-blue-600 text-white shadow-[0_0_0_6px_rgba(37,99,235,0.22)]");
    if (onRoute) return cx(base, "border-emerald-500 bg-white text-slate-900 shadow-[0_0_0_5px_rgba(16,185,129,0.18)]");
    return cx(base, node.type === "room" ? "border-slate-300 bg-white text-slate-900" : "border-slate-300 bg-slate-100 text-slate-700");
}

export const MapNode = memo(function MapNode({ data }: NodeProps<MapFlowNode>) {
    const { node, isStart, isBlocked } = data;

    return (
        <div className="relative">
            <Handle type="target" position={Position.Top} className="center-handle" isConnectable={false} />
            <Handle type="source" position={Position.Top} className="center-handle" isConnectable={false} />

            {isStart && !isBlocked && (
                <span className="animate-fade-up pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold tracking-wide whitespace-nowrap text-white uppercase shadow">
                    {data.startText}
                </span>
            )}

            <button
                type="button"
                onClick={() => data.onActivate(node.id)}
                aria-label={data.ariaLabel}
                title={`${node.label} (${node.id})`}
                className={cx(
                    "pointer-events-auto cursor-pointer font-bold shadow-sm outline-none",
                    "transition-[background-color,border-color,color,box-shadow,scale] duration-200 hover:scale-110",
                    "focus-visible:ring-4 focus-visible:ring-indigo-400",
                    look(data),
                    isStart && "animate-pop",
                )}
            >
                {node.type === "exit" && <LogOut aria-hidden="true" className="size-4" strokeWidth={2.75} />}
                {node.id}
            </button>

            {isBlocked && (
                <span
                    aria-hidden="true"
                    className={cx(
                        "animate-pop absolute -top-2 -right-2 grid size-6 place-items-center rounded-full border-2 border-white text-white shadow",
                        node.type === "exit" ? "bg-slate-500" : "bg-rose-600",
                    )}
                >
                    {node.type === "exit" ? <DoorClosed className="size-3.5" strokeWidth={2.5} /> : <Ban className="size-3.5" strokeWidth={2.75} />}
                </span>
            )}

            <span className="pointer-events-none absolute top-full left-1/2 mt-2 max-w-48 -translate-x-1/2 truncate rounded-md bg-white/90 px-1.5 text-[13px] leading-5 font-medium whitespace-nowrap text-slate-600">
                {node.label}
            </span>
        </div>
    );
});
