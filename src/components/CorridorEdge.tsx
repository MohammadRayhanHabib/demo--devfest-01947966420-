import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type Edge, type EdgeProps } from "@xyflow/react";
import { X } from "lucide-react";
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
    /** True when a route exists, so every other corridor recedes. */
    routeActive: boolean;
    routeKey: string;
    costText: string;
    ariaLabel: string;
    onToggle: (id: string) => void;
};

export type CorridorFlowEdge = Edge<CorridorData, "corridor">;

/**
 * Hairline connector between card ports, with a small cost badge in the middle.
 * The chosen route burns brightest; with a route on screen every other corridor recedes.
 */
export const CorridorEdge = memo(function CorridorEdge(props: EdgeProps<CorridorFlowEdge>) {
    const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props;
    const data = props.data!;
    const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 14 });
    const drawPath = data.reversed
        ? getSmoothStepPath({
              sourceX: targetX,
              sourceY: targetY,
              sourcePosition: targetPosition,
              targetX: sourceX,
              targetY: sourceY,
              targetPosition: sourcePosition,
              borderRadius: 14,
          })[0]
        : path;

    const receded = data.routeActive && !data.onRoute && !data.blocked;

    return (
        <>
            <BaseEdge
                id={id}
                path={path}
                interactionWidth={22}
                style={{
                    stroke: data.blocked ? "#f43f5e" : data.onRoute ? "#dbe8fe" : "#94a3b8",
                    strokeWidth: data.onRoute ? 7 : 1.5,
                    strokeDasharray: data.blocked ? "5 5" : undefined,
                    opacity: data.dead ? 0.3 : receded ? 0.55 : 1,
                    transition: "stroke 0.3s, stroke-width 0.3s, opacity 0.3s",
                }}
            />
            {data.onRoute && (
                <path key={data.routeKey} d={drawPath} pathLength={1} className="route-draw" style={{ animationDelay: `${data.routeIndex * 120}ms` }} />
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
                        "nodrag nopan absolute flex h-5 min-w-6 cursor-pointer items-center justify-center gap-0.5 rounded-md px-1.5",
                        "font-mono text-[11px] font-semibold outline-none transition-[background-color,color,opacity] duration-300",
                        "focus-visible:ring-4 focus-visible:ring-brand-200",
                        data.blocked
                            ? "bg-rose-50 text-rose-700 ring-1 ring-rose-300"
                            : data.onRoute
                              ? "bg-brand-600 text-white shadow-[0_2px_6px_-2px_rgba(37,99,235,0.6)]"
                              : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-400",
                        data.dead && "opacity-40",
                        receded && "opacity-70",
                    )}
                >
                    {data.blocked && <X aria-hidden="true" className="size-3" strokeWidth={2.75} />}
                    {data.costText}
                </button>
            </EdgeLabelRenderer>
        </>
    );
});
