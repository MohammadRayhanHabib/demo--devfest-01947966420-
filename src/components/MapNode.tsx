import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { EllipsisVertical } from "lucide-react";
import { memo, type ReactNode } from "react";
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
    /** "R1 · 3 corridors" (localized). */
    descText: string;
    /** Number of corridors touching this node (localized). */
    degree: string;
    /** Cumulative route cost at this node, when it is on the route (localized). */
    routeCost: string | null;
    onActivate: (id: string) => void;
};

export type MapFlowNode = Node<MapNodeData, "building">;

export const NODE_EMOJI = { room: "🚪", junction: "🔀", exit: "🏃" } as const;

const TAG_TONE = {
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-sky-50 text-sky-700",
    indigo: "bg-indigo-50 text-indigo-700",
    red: "bg-red-50 text-red-600",
    gray: "bg-gray-100 text-gray-500",
};

function Tag({ tone, children }: { tone: keyof typeof TAG_TONE; children: ReactNode }) {
    return <span className={cx("rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold", TAG_TONE[tone])}>{children}</span>;
}

function frame({ node, isStart, isBlocked, onRoute, isTarget }: MapNodeData) {
    if (isBlocked) return node.type === "exit" ? "border-dashed border-gray-300 opacity-70" : "border-red-400";
    if (isStart) return "border-dashed border-gray-900 border-[1.5px]";
    if (isTarget) return "border-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.14)]";
    if (onRoute) return "border-gray-800";
    return "border-gray-200";
}

/** Note-card node (pattern from the Mind Palace canvas: emoji + title, description, #tags). */
export const MapNode = memo(function MapNode({ data }: NodeProps<MapFlowNode>) {
    const { node, isStart, isBlocked } = data;

    return (
        <div className="relative w-[212px]">
            <Handle type="target" position={Position.Top} className="center-handle" isConnectable={false} />
            <Handle type="source" position={Position.Top} className="center-handle" isConnectable={false} />

            {isStart && !isBlocked && (
                <span className="animate-fade-up pointer-events-none absolute bottom-full left-1/2 mb-2.5 -translate-x-1/2 rounded-md bg-gray-900 px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-white shadow-md">
                    {data.startText}
                    <span aria-hidden="true" className="absolute top-full left-1/2 -translate-x-1/2 border-x-[5px] border-t-[5px] border-x-transparent border-t-gray-900" />
                </span>
            )}

            <button
                type="button"
                onClick={() => data.onActivate(node.id)}
                aria-label={data.ariaLabel}
                title={`${node.label} (${node.id})`}
                className={cx(
                    "pointer-events-auto block w-full cursor-pointer rounded-xl border bg-white p-3 text-left shadow-sm outline-none",
                    "transition-[border-color,box-shadow,translate,opacity] duration-200 hover:-translate-y-0.5 hover:shadow-md",
                    "focus-visible:ring-4 focus-visible:ring-indigo-300",
                    frame(data),
                    isStart && "animate-pop",
                )}
            >
                <span className="flex items-center gap-2">
                    <span aria-hidden="true" className="text-base leading-none">
                        {NODE_EMOJI[node.type]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-gray-900">{node.label}</span>
                    <EllipsisVertical aria-hidden="true" className="size-4 shrink-0 text-gray-400" />
                </span>
                <span className="mt-1.5 block text-xs leading-snug text-gray-500">{data.descText}</span>
                <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <Tag tone="green">#{node.id}</Tag>
                    <Tag tone={node.type === "exit" ? "green" : "blue"}>#{data.typeText}</Tag>
                    {isBlocked && <Tag tone={node.type === "exit" ? "gray" : "red"}>#{data.bannerText}</Tag>}
                    {data.routeCost !== null && <Tag tone="indigo">Σ {data.routeCost}</Tag>}
                </span>
            </button>
        </div>
    );
});
