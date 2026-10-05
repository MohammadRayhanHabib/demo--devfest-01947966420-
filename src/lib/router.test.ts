import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildGraph, findRoute } from "./router";
import type { Building, Hazards } from "./types";
import { validateBuilding } from "./validate";

const load = (file: string) =>
    JSON.parse(readFileSync(new URL(`../../public/${file}`, import.meta.url), "utf8")) as Building;

const hazards = (h: Partial<Record<keyof Hazards, string[]>> = {}): Hazards => ({
    blockedNodes: new Set(h.blockedNodes),
    blockedEdges: new Set(h.blockedEdges),
    closedExits: new Set(h.closedExits),
});

describe("problem statement sample checks", () => {
    const graph = buildGraph(load("building.json"));

    it("baseline: R1 → C1 → C2 → E1, cost 7", () => {
        expect(findRoute(graph, hazards(), "R1")).toMatchObject({ status: "ok", path: ["R1", "C1", "C2", "E1"], exit: "E1", cost: 7 });
    });

    it("blocked junction C2: R1 → C1 → C3 → C4 → E2, cost 11", () => {
        expect(findRoute(graph, hazards({ blockedNodes: ["C2"] }), "R1")).toMatchObject({
            status: "ok",
            path: ["R1", "C1", "C3", "C4", "E2"],
            exit: "E2",
            cost: 11,
        });
    });

    it("all exits closed: no route", () => {
        expect(findRoute(graph, hazards({ closedExits: ["E1", "E2"] }), "R1")).toEqual({ status: "no-route" });
    });

    it("different start R2: R2 → C3 → C4 → E2, cost 7", () => {
        expect(findRoute(graph, hazards(), "R2")).toMatchObject({ path: ["R2", "C3", "C4", "E2"], cost: 7 });
    });

    it("blocked start", () => {
        expect(findRoute(graph, hazards({ blockedNodes: ["R1"] }), "R1")).toEqual({ status: "start-blocked" });
    });
});

describe("routing rules", () => {
    it("equal cost: smallest exit ID, then smallest node sequence", () => {
        const graph = buildGraph(load("samples/tie-break.json"));
        expect(findRoute(graph, hazards(), "R1")).toMatchObject({ path: ["R1", "C1", "E1"], exit: "E1", cost: 4 });
    });

    it("blocked corridor only removes that connection", () => {
        const graph = buildGraph(load("building.json"));
        // Blocking C2–E1 forces R1 to E2 (C1–C3–C4: 2+4+2+3 = 11 beats C2–C4: 2+3+5+3 = 13).
        expect(findRoute(graph, hazards({ blockedEdges: ["e3"] }), "R1")).toMatchObject({ path: ["R1", "C1", "C3", "C4", "E2"], cost: 11 });
    });

    it("never routes through a closed exit", () => {
        const data: Building = {
            building: "pass-through",
            nodes: [
                { id: "R1", label: "R", type: "room", x: 0, y: 0 },
                { id: "E1", label: "E", type: "exit", x: 1, y: 0 },
                { id: "C1", label: "C", type: "junction", x: 2, y: 0 },
                { id: "E2", label: "E", type: "exit", x: 3, y: 0 },
            ],
            edges: [
                { id: "a", from: "R1", to: "E1", cost: 1 },
                { id: "b", from: "E1", to: "C1", cost: 1 },
                { id: "c", from: "C1", to: "E2", cost: 1 },
            ],
            initial_state: { blocked_nodes: [], blocked_edges: [], closed_exits: [] },
        };
        expect(findRoute(buildGraph(data), hazards({ closedExits: ["E1"] }), "R1")).toEqual({ status: "no-route" });
    });

    it("uses edge cost, not number of corridors", () => {
        const data: Building = {
            building: "cost-vs-hops",
            nodes: [
                { id: "R1", label: "R", type: "room", x: 0, y: 0 },
                { id: "C1", label: "C", type: "junction", x: 1, y: 0 },
                { id: "C2", label: "C", type: "junction", x: 2, y: 0 },
                { id: "E1", label: "E", type: "exit", x: 3, y: 0 },
            ],
            edges: [
                { id: "direct", from: "R1", to: "E1", cost: 10 },
                { id: "a", from: "R1", to: "C1", cost: 1 },
                { id: "b", from: "C1", to: "C2", cost: 1 },
                { id: "c", from: "C2", to: "E1", cost: 1 },
            ],
            initial_state: { blocked_nodes: [], blocked_edges: [], closed_exits: [] },
        };
        expect(findRoute(buildGraph(data), hazards(), "R1")).toMatchObject({ path: ["R1", "C1", "C2", "E1"], cost: 3 });
    });

    it("disconnected area has no route", () => {
        const graph = buildGraph(load("samples/disconnected.json"));
        expect(findRoute(graph, hazards(), "R2")).toEqual({ status: "no-route" });
        expect(findRoute(graph, hazards(), "R1")).toMatchObject({ cost: 7 });
    });
});

describe("validation", () => {
    it("accepts the provided samples", () => {
        for (const file of ["building.json", "samples/tie-break.json", "samples/disconnected.json"]) {
            expect(validateBuilding(load(file)).ok, file).toBe(true);
        }
    });

    it("rejects malformed files with specific errors", () => {
        const result = validateBuilding(load("samples/invalid.json"));
        expect(result.ok).toBe(false);
        const codes = result.ok ? [] : result.errors.map((e) => e.code);
        expect(codes).toEqual(
            expect.arrayContaining(["nodeDup", "edgeCost", "edgePair", "edgeSelf", "edgeEnds", "stateBlockedNode", "stateUnknown", "stateClosedExit"]),
        );
    });

    it("rejects non-objects and missing sections", () => {
        expect(validateBuilding([]).ok).toBe(false);
        expect(validateBuilding({ building: "x" }).ok).toBe(false);
    });
});
