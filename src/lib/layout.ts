import type { BuildingNode } from "./types";

/**
 * Scale the file's display coordinates uniformly into a comfortable canvas so
 * datasets using tiny (0–10) or huge (0–5000) ranges look the same. Aspect
 * ratio is preserved; these positions are for display only, never for cost.
 */
export function layoutPositions(nodes: BuildingNode[], width = 760, height = 480) {
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const spanX = Math.max(...xs) - minX;
    const spanY = Math.max(...ys) - minY;
    const scale = Math.min(width / (spanX || 1), height / (spanY || 1));
    return new Map(nodes.map((n) => [n.id, { x: (n.x - minX) * scale, y: (n.y - minY) * scale }]));
}
