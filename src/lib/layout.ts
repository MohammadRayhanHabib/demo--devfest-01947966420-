import type { BuildingNode } from "./types";

/** Footprint of a node card on the map (plus breathing room). */
const CARD_W = 250;
const CARD_H = 150;

/**
 * Scale the file's display coordinates uniformly into a comfortable canvas so
 * datasets using tiny (0–10) or huge (0–5000) ranges look the same, then grow
 * the scale until no two node cards overlap. Aspect ratio is preserved; these
 * positions are for display only, never for cost.
 */
export function layoutPositions(nodes: BuildingNode[], width = 1100, height = 700) {
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const spanX = Math.max(...xs) - minX;
    const spanY = Math.max(...ys) - minY;
    const base = Math.min(width / (spanX || 1), height / (spanY || 1));

    let scale = base;
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const dx = Math.abs(nodes[i].x - nodes[j].x);
            const dy = Math.abs(nodes[i].y - nodes[j].y);
            if (dx === 0 && dy === 0) continue;
            // Separating the pair along either axis is enough.
            const needed = Math.min(dx ? CARD_W / dx : Infinity, dy ? CARD_H / dy : Infinity);
            scale = Math.max(scale, needed);
        }
    }
    scale = Math.min(scale, base * 8);

    return new Map(nodes.map((n) => [n.id, { x: (n.x - minX) * scale, y: (n.y - minY) * scale }]));
}
