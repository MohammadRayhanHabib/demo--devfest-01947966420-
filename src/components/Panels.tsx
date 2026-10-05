import type { ReactNode } from "react";
import { compareIds } from "../lib/router";
import { cx } from "../lib/cx";
import { localizeDigits, type Lang, type StringKey, type Translate } from "../lib/i18n";
import type { Hazards, LoadedBuilding, RouteResult, ValidationError } from "../lib/types";

const MAX_ERRORS = 8;

function Card({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
    return (
        <section className={cx("rounded-2xl border border-slate-200 bg-white p-4 shadow-sm", className)}>
            {title && <h2 className="card-title">{title}</h2>}
            {children}
        </section>
    );
}

export function ErrorCard({ errors, t, onDismiss }: { errors: ValidationError[]; t: Translate; onDismiss: () => void }) {
    if (errors.length === 0) return null;
    return (
        <section role="alert" className="animate-fade-up rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold text-red-800">{t("errTitle")}</h2>
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label={t("dismiss")}
                    className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-lg text-red-700 hover:bg-red-100"
                >
                    ×
                </button>
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-900">
                {errors.slice(0, MAX_ERRORS).map((error, i) => (
                    <li key={i}>{t(error.code as StringKey, error.params)}</li>
                ))}
            </ul>
            {errors.length > MAX_ERRORS && (
                <p className="mt-2 text-sm text-red-800">{t("moreErrors", { n: errors.length - MAX_ERRORS })}</p>
            )}
        </section>
    );
}

export function BuildingCard({ building, t }: { building: LoadedBuilding; t: Translate }) {
    const count = (type: string) => building.data.nodes.filter((n) => n.type === type).length;
    return (
        <Card title={t("buildingLabel")}>
            <p className="text-lg leading-snug font-bold text-slate-900">{building.data.building}</p>
            <p className="mt-1 text-sm text-slate-500">
                {t("counts", {
                    rooms: count("room"),
                    junctions: count("junction"),
                    exits: count("exit"),
                    edges: building.data.edges.length,
                })}
            </p>
            <p className="mt-1 text-xs text-slate-400">{t("sourceLabel", { name: building.source })}</p>
        </Card>
    );
}

type StartProps = {
    building: LoadedBuilding;
    hazards: Hazards;
    start: string | null;
    t: Translate;
    onChange: (id: string | null) => void;
};

export function StartCard({ building, hazards, start, t, onChange }: StartProps) {
    const options = building.data.nodes.filter((n) => n.type !== "exit").sort((a, b) => compareIds(a.id, b.id));
    return (
        <Card>
            <label htmlFor="start-select" className="card-title block">
                {t("startLabel")}
            </label>
            <select
                id="start-select"
                value={start ?? ""}
                onChange={(e) => onChange(e.target.value || null)}
                className="w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium outline-none focus-visible:ring-4 focus-visible:ring-indigo-300"
            >
                <option value="">{t("startPlaceholder")}</option>
                {options.map((n) => {
                    const blocked = hazards.blockedNodes.has(n.id);
                    return (
                        <option key={n.id} value={n.id} disabled={blocked && n.id !== start}>
                            {n.id} — {n.label}
                            {blocked ? ` (${t("stateBlocked")})` : ""}
                        </option>
                    );
                })}
            </select>
        </Card>
    );
}

function StatusBox({ title, hint }: { title: string; hint: string }) {
    return (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="flex items-center gap-2 text-base font-bold text-red-700">
                <span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-red-600 text-xs text-white">
                    !
                </span>
                {title}
            </p>
            <p className="mt-1 text-sm text-red-900/80">{hint}</p>
        </div>
    );
}

type RouteProps = { building: LoadedBuilding | null; route: RouteResult; lang: Lang; t: Translate };

export function RouteCard({ building, route, lang, t }: RouteProps) {
    const num = (v: number) => localizeDigits(v, lang);
    const key = route.status === "ok" ? route.path.join(">") : route.status;

    let content: ReactNode;
    if (!building) {
        content = <p className="text-sm text-slate-500">{t("emptyBody")}</p>;
    } else if (route.status === "idle") {
        content = <p className="text-sm text-slate-500">{t("noStart")}</p>;
    } else if (route.status === "start-blocked") {
        content = <StatusBox title={t("startBlocked")} hint={t("startBlockedHint")} />;
    } else if (route.status === "no-route") {
        content = <StatusBox title={t("noRoute")} hint={t("noRouteHint")} />;
    } else {
        const nodeById = building.graph.nodeById;
        const exit = nodeById.get(route.exit)!;
        content = (
            <>
                <div className="flex items-end justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-orange-800">{t("exitLabel")}</p>
                        <p className="truncate text-lg font-bold text-slate-900">
                            {exit.id} <span className="text-sm font-normal text-slate-600">{exit.label}</span>
                        </p>
                    </div>
                    <div className="shrink-0 text-right">
                        <p className="text-xs font-semibold text-orange-800">{t("costLabel")}</p>
                        <p className="text-3xl leading-none font-extrabold text-orange-600 tabular-nums">{num(route.cost)}</p>
                    </div>
                </div>

                <p className="mt-3 font-mono text-sm break-words text-slate-700">{route.path.join(" → ")}</p>

                <ol className="mt-2">
                    {route.path.map((id, i) => {
                        const node = nodeById.get(id)!;
                        const isFirst = i === 0;
                        const isLast = i === route.path.length - 1;
                        return (
                            <li
                                key={id}
                                className="animate-fade-up relative flex items-center gap-3 py-1.5"
                                style={{ animationDelay: `${i * 60}ms` }}
                            >
                                {!isLast && <span aria-hidden="true" className="absolute top-9 -bottom-1.5 left-3.5 w-0.5 bg-orange-200" />}
                                <span
                                    aria-hidden="true"
                                    className={cx(
                                        "relative grid size-7 shrink-0 place-items-center border-2 text-xs font-bold",
                                        isFirst && "rounded-full border-orange-500 bg-orange-500 text-white",
                                        isLast && "rounded-lg border-emerald-600 bg-emerald-600 text-white",
                                        !isFirst && !isLast && "rounded-full border-orange-300 bg-white text-orange-700",
                                    )}
                                >
                                    {num(i + 1)}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-slate-900">{id}</p>
                                    <p className="truncate text-xs text-slate-500">{node.label}</p>
                                </div>
                                <span className="text-sm font-semibold text-slate-500 tabular-nums">
                                    {isFirst ? t("startTag") : `+${num(route.legs[i - 1])}`}
                                </span>
                            </li>
                        );
                    })}
                </ol>
            </>
        );
    }

    return (
        <Card title={t("routeTitle")}>
            <div aria-live="polite">
                <div key={key} className="animate-fade-up">
                    {content}
                </div>
            </div>
        </Card>
    );
}

/** Run-style route header (pattern from the Browserbase run view on Mobbin): status, meta chips, cost bar. */
export function RouteOverview({ route, start, lang, t }: { route: RouteResult; start: string | null; lang: Lang; t: Translate }) {
    const num = (v: number) => localizeDigits(v, lang);
    const status =
        route.status === "ok"
            ? { text: t("routeFound"), tone: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" }
            : route.status === "idle"
              ? { text: t("waitingStart"), tone: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" }
              : {
                    text: t(route.status === "no-route" ? "noRoute" : "startBlocked"),
                    tone: "bg-red-50 text-red-700 ring-red-200",
                    dot: "bg-red-500",
                };
    const chip = "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-600";

    return (
        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
                <h2 className="mr-1 text-base font-bold text-slate-900">{t("routeTitle")}</h2>
                <span
                    key={route.status}
                    className={cx("animate-fade-up inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold ring-1", status.tone)}
                >
                    <span aria-hidden="true" className={cx("size-2 rounded-full", status.dot)} />
                    {status.text}
                </span>
                {start && (
                    <span className={chip}>
                        <span aria-hidden="true">📍</span>
                        {t("startTag")} <strong className="text-slate-900">{start}</strong>
                    </span>
                )}
                {route.status === "ok" && (
                    <>
                        <span className={chip}>
                            <span aria-hidden="true">🚪</span>
                            {t("exitLabel")} <strong className="text-slate-900">{route.exit}</strong>
                        </span>
                        <span className={chip}>{t("routeMeta", { stops: route.path.length, corridors: route.edges.length })}</span>
                        <span className={cx(chip, "ml-auto border-orange-200 bg-orange-50 text-orange-800")}>
                            {t("costLabel")}
                            <strong className="text-lg leading-none text-orange-600 tabular-nums">{num(route.cost)}</strong>
                        </span>
                    </>
                )}
            </div>

            {route.status === "ok" && (
                <div key={route.path.join(">")} className="mt-3 flex h-9 gap-1" role="img" aria-label={t("legsTitle")}>
                    {route.edges.map((edgeId, i) => (
                        <div
                            key={edgeId}
                            title={`${route.path[i]} → ${route.path[i + 1]} · ${route.legs[i]}`}
                            style={{ flexGrow: route.legs[i], flexBasis: 0, animationDelay: `${i * 90}ms` }}
                            className={cx(
                                "animate-grow-x flex min-w-0 origin-left items-center justify-between gap-1 overflow-hidden rounded-md px-2 text-xs font-semibold text-white",
                                i % 2 ? "bg-orange-400" : "bg-orange-500",
                            )}
                        >
                            <span className="truncate">
                                {route.path[i]} → {route.path[i + 1]}
                            </span>
                            <span className="tabular-nums">{num(route.legs[i])}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

type HazardKind = "node" | "edge" | "exit";

type HazardsProps = {
    building: LoadedBuilding;
    hazards: Hazards;
    t: Translate;
    onRemove: (kind: HazardKind, id: string) => void;
};

export function HazardsCard({ building, hazards, t, onRemove }: HazardsProps) {
    const sorted = (set: ReadonlySet<string>) => [...set].sort(compareIds);
    const items = [
        ...sorted(hazards.blockedNodes).map((id) => ({ kind: "node" as const, id, text: id, tag: t("blockedNode") })),
        ...sorted(hazards.blockedEdges).map((id) => {
            const edge = building.graph.edgeById.get(id)!;
            return { kind: "edge" as const, id, text: `${edge.from}–${edge.to}`, tag: t("blockedEdge") };
        }),
        ...sorted(hazards.closedExits).map((id) => ({ kind: "exit" as const, id, text: id, tag: t("closedExit") })),
    ];

    return (
        <Card title={t("hazardsTitle")}>
            {items.length === 0 ? (
                <p className="text-sm text-slate-500">{t("noHazards")}</p>
            ) : (
                <ul className="flex flex-wrap gap-2">
                    {items.map((item) => (
                        <li
                            key={`${item.kind}:${item.id}`}
                            className={cx(
                                "animate-fade-up inline-flex items-center gap-1 rounded-full border py-1 pr-1 pl-3 text-sm",
                                item.kind === "exit"
                                    ? "border-slate-300 bg-slate-100 text-slate-700"
                                    : "border-red-200 bg-red-50 text-red-800",
                            )}
                        >
                            <span>
                                <strong>{item.text}</strong> · {item.tag}
                            </span>
                            <button
                                type="button"
                                onClick={() => onRemove(item.kind, item.id)}
                                aria-label={`${t("removeHazard")}: ${item.text}`}
                                className="grid size-6 cursor-pointer place-items-center rounded-full text-base leading-none hover:bg-black/10"
                            >
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}

export function LegendCard({ t }: { t: Translate }) {
    const items: { key: StringKey; swatch: ReactNode }[] = [
        { key: "legendRoom", swatch: <span className="size-4 rounded-full border-2 border-blue-600 bg-blue-50" /> },
        { key: "legendJunction", swatch: <span className="size-3.5 rotate-45 rounded-sm border-2 border-slate-500 bg-white" /> },
        { key: "legendExit", swatch: <span className="h-3.5 w-5 rounded border-2 border-emerald-700 bg-emerald-600" /> },
        { key: "legendStart", swatch: <span className="size-4 rounded-full bg-white ring-3 ring-orange-400" /> },
        { key: "legendRoute", swatch: <span className="h-1.5 w-6 rounded-full bg-orange-500" /> },
        { key: "legendBlocked", swatch: <span className="size-4 rounded-full border-2 border-red-600 bg-red-50" /> },
        { key: "legendBlockedEdge", swatch: <span className="w-6 border-t-[3px] border-dashed border-red-600" /> },
        { key: "legendClosed", swatch: <span className="h-3.5 w-5 rounded border-2 border-dashed border-slate-400 bg-slate-200" /> },
    ];
    return (
        <Card title={t("legendTitle")}>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm text-slate-700">
                {items.map(({ key, swatch }) => (
                    <li key={key} className="flex items-center gap-2">
                        <span aria-hidden="true" className="grid w-6 shrink-0 place-items-center">
                            {swatch}
                        </span>
                        {t(key)}
                    </li>
                ))}
            </ul>
        </Card>
    );
}
