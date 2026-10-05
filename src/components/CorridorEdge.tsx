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
    /** Position of this corridor along the route (for the staggered flow-in). */
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

/** Dashed connector with a round cost badge in the middle (Mind Palace canvas pattern). */
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
        borderRadius: 18,
    });
    const flowPath = data.reversed
        ? getSmoothStepPath({ sourceX: targetX, sourceY: targetY, sourcePosition: to, targetX: sourceX, targetY: sourceY, targetPosition: from, borderRadius: 18 })[0]
        : path;

    return (
        <>
            <BaseEdge
                id={id}
                path={path}
                interactionWidth={24}
                style={{
                    stroke: data.onRoute ? "transparent" : data.blocked ? "#ef4444" : "#cbd5e1",
                    strokeWidth: data.blocked ? 2 : 1.75,
                    strokeDasharray: data.blocked ? "6 5" : "3 5",
                    strokeLinecap: "round",
                    opacity: data.dead ? 0.35 : 1,
                    transition: "stroke 0.25s, opacity 0.25s",
                }}
            />
            {data.onRoute && (
                <path key={data.routeKey} d={flowPath} className="route-flow" style={{ animationDelay: `${data.routeIndex * 120}ms` }} />
            )}
            <EdgeLabelRenderer>
                <button
                    type="button"
                    onClick={() => data.onToggle(data.edge.id)}
                    aria-label={data.ariaLabel}
                    title={data.ariaLabel}
                    style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "all" }}
                    className={cx(
                        "nodrag nopan absolute grid h-6 min-w-6 cursor-pointer place-items-center rounded-full border-[1.5px] px-1",
                        "font-mono text-[11px] font-bold tabular-nums outline-none transition-colors duration-200",
                        "focus-visible:ring-4 focus-visible:ring-indigo-300",
                        data.blocked
                            ? "border-red-400 bg-red-50 text-red-600 line-through"
                            : data.onRoute
                              ? "border-gray-900 bg-gray-900 text-white"
                              : "border-gray-300 bg-white text-gray-600 hover:border-gray-500",
                        data.dead && "opacity-40",
                    )}
                >
                    {data.costText}
                </button>
            </EdgeLabelRenderer>
        </>
    );
});
