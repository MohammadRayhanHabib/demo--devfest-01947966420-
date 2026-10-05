import { BaseEdge, EdgeLabelRenderer, getStraightPath, type Edge, type EdgeProps } from "@xyflow/react";
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

export const CorridorEdge = memo(function CorridorEdge(props: EdgeProps<CorridorFlowEdge>) {
    const { id, sourceX, sourceY, targetX, targetY } = props;
    const data = props.data!;
    const [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });

    const stroke = data.blocked ? "#dc2626" : data.onRoute ? "#fed7aa" : "#94a3b8";
    const drawPath = data.reversed
        ? `M${targetX},${targetY} L${sourceX},${sourceY}`
        : `M${sourceX},${sourceY} L${targetX},${targetY}`;

    return (
        <>
            <BaseEdge
                id={id}
                path={path}
                interactionWidth={24}
                style={{
                    stroke,
                    strokeWidth: data.onRoute ? 9 : 4,
                    strokeDasharray: data.blocked ? "8 6" : undefined,
                    opacity: data.dead ? 0.3 : 1,
                    transition: "stroke 0.25s, stroke-width 0.25s, opacity 0.25s",
                }}
            />
            {data.onRoute && (
                <path
                    key={data.routeKey}
                    d={drawPath}
                    pathLength={1}
                    className="route-draw"
                    style={{ animationDelay: `${data.routeIndex * 140}ms` }}
                />
            )}
            <EdgeLabelRenderer>
                <button
                    type="button"
                    onClick={() => data.onToggle(data.edge.id)}
                    aria-label={data.ariaLabel}
                    title={data.ariaLabel}
                    style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "all" }}
                    className={cx(
                        "nodrag nopan absolute flex h-7 min-w-8 cursor-pointer items-center justify-center gap-0.5 rounded-full border-2 px-2.5",
                        "text-sm font-bold tabular-nums shadow-sm outline-none transition-colors duration-200",
                        "focus-visible:ring-4 focus-visible:ring-indigo-400",
                        data.blocked
                            ? "border-red-500 bg-red-50 text-red-700"
                            : data.onRoute
                              ? "border-orange-500 bg-orange-500 text-white"
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
