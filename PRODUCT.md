# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

AI DevFest Vibe Coding contest judges (mock test "Smart Escape"). They open the public HTTPS link on their own device in the latest Chrome, without signing in, import unseen `building.json` files with the same schema, and check routing, hazards, failure states and the Bangla/English modes against the problem statement within a short evaluation window.

## Product Purpose

Smart Escape is a browser-based, interactive evacuation route simulator. It displays a building map (rooms, junctions, exits, weighted corridors) and finds the lowest-cost route from a chosen starting location to an open exit. When a user blocks rooms/junctions or corridors, or closes exits, it immediately shows the new route or clearly reports that none exists. Success means every requirement in `Smart_Escape_Problem_Statement.pdf` is visibly and correctly met, including unseen graphs, equal-cost ties, disconnected areas and invalid input.

## Positioning

A judge should be able to verify each rule at a glance: the exact route, its node sequence, exit and total cost are always visible, and every hazard state is distinct on the map.

## Operating Context

- Contest: solo, 90 minutes, frontend only; repository `devfest-<registration-number>` with frequent commits that include the AI prompt; public HTTPS deployment (Vercel/Netlify/GitHub Pages/Cloudflare Pages) by T+90.
- Judges evaluate the final eligible commit and its matching deployment.
- Deliverables: README (identity, live link, run instructions, implemented/bonus features, known issues, AI tools, most useful prompt), MIT LICENSE, `screenshots/` with the baseline route and the reroute after C2 is blocked.

## Capabilities and Constraints

Must keep (from the problem statement):

- Import `building.json` locally in the browser; validate it (2–60 nodes, 1–150 undirected edges, unique case-sensitive IDs, non-empty labels, node type room | junction | exit, numeric x/y, positive integer costs, no self-loops, no repeated node pairs, initial-state IDs exist and match their category, at least one room/junction and one exit). Disconnected graphs are valid. Reject malformed or inconsistent files clearly.
- Display all nodes and edges at the supplied coordinates with readable labels, distinct node types and visible corridor costs.
- Select an unblocked room or junction as the start; highlight the lowest-cost route to an accessible exit and show its node sequence, exit and total cost.
- Block/unblock rooms, junctions and corridors; close/reopen exits; distinguish these states visually.
- Recalculate immediately after every start or hazard change, without reimporting; Reset restores the file's original `initial_state`.
- Show exactly "No route available" and "Starting location blocked" (and Bangla equivalents).
- Bangla and English modes for all principal labels, buttons, statuses, errors and instructions; dataset labels stay unchanged.
- Routing: cost = sum of edge costs only; exclude blocked nodes and their edges, blocked edges and closed exits (also as intermediate nodes); cheapest reachable open exit wins; ties → lexicographically smallest exit ID, then smallest node-ID sequence. No hard-coded routes.
- Subtle animations for selecting locations, toggling hazards and updating routes; brief, readable, no flashing or delayed controls.
- Optional extensions already present: PNG export, accessible controls. Not present: alternative routes, saving progress, route walkthroughs.
- Technical: frontend only (Vite + React + TypeScript + Tailwind CSS 4 + React Flow); no backend, serverless functions, remote storage or secrets; routing works without external APIs.

## Brand Commitments

- Name: Smart Escape.
- Must carry the note: educational simulation, not a certified evacuation planning tool.

## Evidence on Hand

- `public/building.json` — sample building modelled on the problem statement diagram (exact costs come from the official file at T+0).
- `public/samples/` — tie-break, disconnected and invalid test files.
- `src/lib/router.test.ts` — 13 automated checks covering the five sample checks, tie rules, disconnected graphs and invalid input.
- No user testimonials, metrics or third-party claims exist; none may be invented.

## Product Principles

1. Correctness is visible: the route, its cost and every hazard state can be verified from the screen alone.
2. Nothing is hard-coded: any valid file behaves the same way; any invalid file is rejected with specific reasons.
3. Every control is reachable and bilingual: map clicks, lists and keyboard all reach the same actions, in Bangla and English.
4. Calm under change: hazards update the route instantly with brief, readable motion.

## Accessibility & Inclusion

Keyboard-reachable controls with visible focus, screen-reader labels for map elements, live announcement of route changes, and respect for `prefers-reduced-motion`.
