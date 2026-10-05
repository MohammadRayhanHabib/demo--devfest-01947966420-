import { BaseEdge, EdgeLabelRenderer, Position, getSmoothStepPath, type Edge, type EdgeProps } from "@xyflow/react";
import { memo } from "react";
import { cx } from "../lib/cx";
import type { BuildingEdge } from "../lib/types";

export type CorridorData = {
    edge: BuildingEdge;
    blocked: boolean;
    /** Unusable because an end node is blocked / a closed exit. */
    dead: boolean;
    onRoute: boolean;
    /** Position of this corridor along the route (for the staggered draw). */
    routeIndex: number;
    /** True when the route walks this corridor from `to` to `from`. */
    reversed: boolean;
    routeKey: string;
    costText: string;
    ariaLabel: string;
    onToggle: (id: string) => void;
};

export type CorridorFlowEdge = Edge<CorridorData, "corridor">;

/** Leave/enter through the sides facing each other, so lines run orthogonally. */
function sides(dx: number, dy: number): [Position, Position] {
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? [Position.Right, Position.Left] : [Position.Left, Position.Right];
    return dy >= 0 ? [Position.Bottom, Position.Top] : [Position.Top, Position.Bottom];
}

export const CorridorEdge = memo(function CorridorEdge(props: EdgeProps<CorridorFlowEdge>) {
    const { id, sourceX, sourceY, targetX, targetY } = props;
    const data = props.data!;
    const [from, to] = sides(targetX - sourceX, targetY - sourceY);
    const [path, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition: from,
        targetX,
        targetY,
        targetPosition: to,
        borderRadius: 16,
    });
    const drawPath = data.reversed
        ? getSmoothStepPath({ sourceX: targetX, sourceY: targetY, sourcePosition: to, targetX: sourceX, targetY: sourceY, targetPosition: from, borderRadius: 16 })[0]
        : path;

    return (
        <>
            <BaseEdge
                id={id}
                path={path}
                interactionWidth={24}
                style={{
                    stroke: data.blocked ? "#f43f5e" : data.onRoute ? "#c7d2fe" : "#94a3b8",
                    strokeWidth: data.onRoute ? 6 : 2.5,
                    strokeDasharray: data.blocked ? "6 5" : undefined,
                    opacity: data.dead ? 0.35 : 1,
                    transition: "stroke 0.25s, stroke-width 0.25s, opacity 0.25s",
                }}
            />
            {data.onRoute && (
                <path key={data.routeKey} d={drawPath} pathLength={1} className="route-draw" style={{ animationDelay: `${data.routeIndex * 140}ms` }} />
            )}
            <EdgeLabelRenderer>
                <button
                    type="button"
                    onClick={(e) => {
                        // The label is portalled but React still bubbles the click to the edge,
                        // whose own click handler would toggle the corridor a second time.
                        e.stopPropagation();
                        data.onToggle(data.edge.id);
                    }}
                    aria-label={data.ariaLabel}
                    title={data.ariaLabel}
                    style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "all" }}
                    className={cx(
                        "nodrag nopan absolute flex h-6 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-md border px-1.5",
                        "font-mono text-xs font-semibold tabular-nums shadow-sm outline-none transition-colors duration-200",
                        "focus-visible:ring-4 focus-visible:ring-indigo-300",
                        data.blocked
                            ? "border-rose-300 bg-rose-50 text-rose-700"
                            : data.onRoute
                              ? "border-indigo-600 bg-indigo-600 text-white"
                              : "border-slate-300 bg-white text-slate-700 hover:border-slate-500",
                        data.dead && "opacity-40",
                    )}
                >
                    {data.blocked && <span aria-hidden="true">✕</span>}
                    {data.costText}
                </button>
            </EdgeLabelRenderer>
        </>
    );
});
