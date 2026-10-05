export type NodeType = "room" | "junction" | "exit";

export interface BuildingNode {
    id: string;
    label: string;
    type: NodeType;
    x: number;
    y: number;
}

export interface BuildingEdge {
    id: string;
    from: string;
    to: string;
    cost: number;
}

export interface InitialState {
    blocked_nodes: string[];
    blocked_edges: string[];
    closed_exits: string[];
}

export interface Building {
    building: string;
    nodes: BuildingNode[];
    edges: BuildingEdge[];
    initial_state: InitialState;
}

export interface Hazards {
    blockedNodes: ReadonlySet<string>;
    blockedEdges: ReadonlySet<string>;
    closedExits: ReadonlySet<string>;
}

export type RouteResult =
    | { status: "idle" }
    | { status: "start-blocked" }
    | { status: "no-route" }
    | {
          status: "ok";
          exit: string;
          cost: number;
          path: string[];
          edges: string[];
          legs: number[];
      };

export interface ValidationError {
    code: string;
    params?: Record<string, string | number>;
}

export interface Graph {
    nodeById: Map<string, BuildingNode>;
    edgeById: Map<string, BuildingEdge>;
    adjacency: Map<string, { to: string; edge: BuildingEdge }[]>;
}

export type Mode = "start" | "hazard";

export interface LoadedBuilding {
    data: Building;
    graph: Graph;
    source: string;
    /** Increments on every successful import, used to reset the map view. */
    loadId: number;
}
