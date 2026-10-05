/**
 * building.json validation (problem statement §3.1).
 * Returns error codes + params so the UI can show them in Bangla or English.
 */
import type { Building, ValidationError } from "./types";

const NODE_TYPES = new Set(["room", "junction", "exit"]);
const STATE_KEYS = ["blocked_nodes", "blocked_edges", "closed_exits"] as const;

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => v !== null && typeof v === "object" && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export type ValidationResult = { ok: true; data: Building } | { ok: false; errors: ValidationError[] };

export function validateBuilding(raw: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const fail = (code: string, params?: ValidationError["params"]) => {
        errors.push({ code, params });
    };

    if (!isObject(raw)) return { ok: false, errors: [{ code: "notObject" }] };

    if (!isNonEmptyString(raw.building)) fail("building");

    // ---------- nodes ----------
    const nodeTypeById = new Map<string, unknown>();
    if (!Array.isArray(raw.nodes)) {
        fail("nodesArray");
    } else {
        if (raw.nodes.length < 2 || raw.nodes.length > 60) fail("nodesCount", { n: raw.nodes.length });
        raw.nodes.forEach((node: unknown, i) => {
            if (!isObject(node)) return fail("nodeShape", { i: i + 1 });
            if (!isNonEmptyString(node.id)) return fail("nodeId", { i: i + 1 });
            if (nodeTypeById.has(node.id)) return fail("nodeDup", { id: node.id });
            nodeTypeById.set(node.id, node.type);
            if (!isNonEmptyString(node.label)) fail("nodeLabel", { id: node.id });
            if (!NODE_TYPES.has(node.type as string)) fail("nodeType", { id: node.id, type: String(node.type) });
            if (!isNumber(node.x) || !isNumber(node.y)) fail("nodeXY", { id: node.id });
        });
        const types = [...nodeTypeById.values()];
        if (!types.some((t) => t === "room" || t === "junction")) fail("needRoom");
        if (!types.includes("exit")) fail("needExit");
    }

    // ---------- edges ----------
    const edgeIds = new Set<string>();
    const pairs = new Set<string>();
    if (!Array.isArray(raw.edges)) {
        fail("edgesArray");
    } else {
        if (raw.edges.length < 1 || raw.edges.length > 150) fail("edgesCount", { n: raw.edges.length });
        raw.edges.forEach((edge: unknown, i) => {
            if (!isObject(edge)) return fail("edgeShape", { i: i + 1 });
            if (!isNonEmptyString(edge.id)) return fail("edgeId", { i: i + 1 });
            if (edgeIds.has(edge.id)) return fail("edgeDup", { id: edge.id });
            edgeIds.add(edge.id);

            if (!Number.isSafeInteger(edge.cost) || (edge.cost as number) <= 0) fail("edgeCost", { id: edge.id });

            let endsValid = true;
            for (const end of [edge.from, edge.to]) {
                if (typeof end !== "string" || !nodeTypeById.has(end)) {
                    fail("edgeEnds", { id: edge.id, node: String(end) });
                    endsValid = false;
                }
            }
            if (!endsValid) return;
            const from = edge.from as string;
            const to = edge.to as string;
            if (from === to) return fail("edgeSelf", { id: edge.id });

            const key = from < to ? `${from}\u0000${to}` : `${to}\u0000${from}`;
            if (pairs.has(key)) return fail("edgePair", { id: edge.id, a: from, b: to });
            pairs.add(key);
        });
    }

    // ---------- initial_state ----------
    const state = raw.initial_state;
    if (!isObject(state)) {
        fail("stateObj");
    } else {
        for (const key of STATE_KEYS) {
            const ids = state[key];
            if (!Array.isArray(ids)) {
                fail("stateArray", { key });
                continue;
            }
            for (const id of ids as unknown[]) {
                if (key === "blocked_edges") {
                    if (typeof id !== "string" || !edgeIds.has(id)) fail("stateUnknown", { key, id: String(id) });
                    continue;
                }
                const type = typeof id === "string" ? nodeTypeById.get(id) : undefined;
                if (type === undefined) {
                    fail("stateUnknown", { key, id: String(id) });
                } else if (key === "blocked_nodes" && type === "exit") {
                    fail("stateBlockedNode", { id: id as string });
                } else if (key === "closed_exits" && type !== "exit") {
                    fail("stateClosedExit", { id: id as string });
                }
            }
        }
    }

    return errors.length ? { ok: false, errors } : { ok: true, data: raw as unknown as Building };
}
