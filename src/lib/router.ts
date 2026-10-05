/**
 * Routing engine — pure functions, no React.
 *
 * Rules (problem statement §3.3):
 *  - route cost = sum of edge costs (coordinates are never used)
 *  - blocked nodes (and their corridors), blocked corridors and closed exits are excluded
 *  - choose the reachable open exit with minimum cost; ties → smallest exit ID,
 *    then the lexicographically smallest node-ID sequence
 */
import type { Building, BuildingEdge, Graph, Hazards, RouteResult } from "./types";

/** Plain code-unit comparison: IDs are case-sensitive ("C10" < "C2"). */
export const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Element-by-element comparison of two node-ID sequences. */
export function comparePaths(a: readonly string[], b: readonly string[]) {
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        const c = compareIds(a[i], b[i]);
        if (c !== 0) return c;
    }
    return a.length - b.length;
}

function isBetter(costA: number, pathA: string[], costB: number, pathB: string[]) {
    if (costA !== costB) return costA < costB;
    return comparePaths(pathA, pathB) < 0;
}

export function buildGraph(data: Building): Graph {
    const nodeById = new Map(data.nodes.map((n) => [n.id, n]));
    const edgeById = new Map(data.edges.map((e) => [e.id, e]));
    const adjacency = new Map(data.nodes.map((n) => [n.id, [] as { to: string; edge: BuildingEdge }[]]));
    for (const edge of data.edges) {
        adjacency.get(edge.from)!.push({ to: edge.to, edge });
        adjacency.get(edge.to)!.push({ to: edge.from, edge });
    }
    return { nodeById, edgeById, adjacency };
}

export function findRoute(graph: Graph, hazards: Hazards, startId: string | null): RouteResult {
    if (!startId || !graph.nodeById.has(startId)) return { status: "idle" };

    const { blockedNodes, blockedEdges, closedExits } = hazards;
    if (blockedNodes.has(startId)) return { status: "start-blocked" };

    const unusable = (id: string) => blockedNodes.has(id) || closedExits.has(id);
    const dist = new Map<string, number>([[startId, 0]]);
    const path = new Map<string, string[]>([[startId, [startId]]]);
    const via = new Map<string, BuildingEdge[]>([[startId, []]]);
    const settled = new Set<string>();

    // Dijkstra ordered by (cost, path). Graphs are tiny (≤ 60 nodes), so a
    // linear scan for the next node keeps the tie-break logic easy to verify.
    for (;;) {
        let current: string | null = null;
        for (const [id, d] of dist) {
            if (settled.has(id)) continue;
            if (current === null || isBetter(d, path.get(id)!, dist.get(current)!, path.get(current)!)) {
                current = id;
            }
        }
        if (current === null) break;
        settled.add(current);

        // Reaching an exit ends the route; never walk through one.
        if (graph.nodeById.get(current)!.type === "exit") continue;

        for (const { to, edge } of graph.adjacency.get(current)!) {
            if (settled.has(to) || blockedEdges.has(edge.id) || unusable(to)) continue;
            const nextCost = dist.get(current)! + edge.cost;
            const nextPath = [...path.get(current)!, to];
            if (!dist.has(to) || isBetter(nextCost, nextPath, dist.get(to)!, path.get(to)!)) {
                dist.set(to, nextCost);
                path.set(to, nextPath);
                via.set(to, [...via.get(current)!, edge]);
            }
        }
    }

    const exits = [...dist.keys()]
        .filter((id) => graph.nodeById.get(id)!.type === "exit")
        .sort((a, b) => dist.get(a)! - dist.get(b)! || compareIds(a, b));

    if (exits.length === 0) return { status: "no-route" };

    const exit = exits[0];
    const edges = via.get(exit)!;
    return {
        status: "ok",
        exit,
        cost: dist.get(exit)!,
        path: path.get(exit)!,
        edges: edges.map((e) => e.id),
        legs: edges.map((e) => e.cost),
    };
}
