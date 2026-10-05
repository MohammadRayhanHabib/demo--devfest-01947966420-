import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
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
    onActivate: (id: string) => void;
};

export type MapFlowNode = Node<MapNodeData, "building">;

const SHAPE = {
    room: "size-14 rounded-full",
    junction: "size-12 rotate-45 rounded-xl",
    exit: "h-12 w-16 rounded-xl",
};

function palette({ node, isBlocked, onRoute, isTarget }: MapNodeData) {
    if (node.type === "exit") {
        if (isBlocked) return "border-dashed border-slate-400 bg-slate-200 text-slate-500";
        return cx("bg-emerald-600 text-white", isTarget ? "border-orange-500" : "border-emerald-700");
    }
    if (isBlocked) return "border-red-600 bg-red-50 text-red-700";
    const border = onRoute ? "border-orange-500" : node.type === "room" ? "border-blue-600" : "border-slate-500";
    return cx(border, node.type === "room" ? "bg-blue-50 text-blue-900" : "bg-white text-slate-800");
}

export const MapNode = memo(function MapNode({ data }: NodeProps<MapFlowNode>) {
    const { node, isStart, isBlocked, onRoute, isTarget } = data;

    return (
        <div className="relative">
            <Handle type="target" position={Position.Top} className="center-handle" isConnectable={false} />
            <Handle type="source" position={Position.Top} className="center-handle" isConnectable={false} />

            <button
                type="button"
                onClick={() => data.onActivate(node.id)}
                aria-label={data.ariaLabel}
                title={`${node.label} (${node.id})`}
                className={cx(
                    "pointer-events-auto grid cursor-pointer place-items-center border-[2.5px] text-[15px] font-bold shadow-sm outline-none",
                    "transition-[background-color,border-color,color,box-shadow,scale] duration-200 hover:scale-110",
                    "focus-visible:ring-4 focus-visible:ring-indigo-400",
                    SHAPE[node.type],
                    palette(data),
                    (onRoute || isTarget) && !isBlocked && "shadow-[0_0_0_5px_rgba(249,115,22,0.2)]",
                    isStart && "animate-pop ring-4 ring-orange-400 ring-offset-2",
                )}
            >
                <span className={cx(node.type === "junction" && "-rotate-45")}>{node.id}</span>
            </button>

            {isBlocked && (
                <span
                    aria-hidden="true"
                    className={cx(
                        "animate-pop absolute -top-2 -right-2 grid size-6 place-items-center rounded-full border-2 border-white text-xs font-bold text-white",
                        node.type === "exit" ? "bg-slate-500" : "bg-red-600",
                    )}
                >
                    ✕
                </span>
            )}

            <span className="pointer-events-none absolute top-full left-1/2 mt-2 max-w-48 -translate-x-1/2 truncate rounded bg-white/90 px-1.5 text-[13px] leading-5 font-medium whitespace-nowrap text-slate-600">
                {node.label}
            </span>
        </div>
    );
});
