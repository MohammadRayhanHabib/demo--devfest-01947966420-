/**
 * Sidebar: building selector, route details, hazards and legend.
 * Neutral dashboard style (zinc surfaces, mono IDs, small colored status dots),
 * with patterns from Mobbin: komoot (A/B waypoints), GetYourGuide (itinerary),
 * Browserbase (cost bar), Nextdoor (hazard cards + filter chips).
 */
import {
    Ban,
    ChevronsUpDown,
    CircleCheck,
    Construction,
    DoorClosed,
    Layers,
    LogOut,
    MapPin,
    Route as RouteIcon,
    ShieldAlert,
    TriangleAlert,
    X,
    type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cx } from "../lib/cx";
import { localizeDigits, type Lang, type StringKey, type Translate } from "../lib/i18n";
import { compareIds } from "../lib/router";
import type { Hazards, LoadedBuilding, RouteResult, ValidationError } from "../lib/types";

const MAX_ERRORS = 8;

type OkRoute = Extract<RouteResult, { status: "ok" }>;
type HazardKind = "node" | "edge" | "exit";

function NavHeading({ icon: Icon, children, aside }: { icon: LucideIcon; children: ReactNode; aside?: ReactNode }) {
    return (
        <div className="mb-3 flex items-center gap-2.5">
            <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-600 shadow-sm">
                <Icon className="size-4" />
            </span>
            <h2 className="flex-1 text-[15px] font-semibold text-zinc-900">{children}</h2>
            {aside}
        </div>
    );
}

function SubTitle({ children }: { children: ReactNode }) {
    return <h3 className="card-title mb-2">{children}</h3>;
}

function ErrorCard({ errors, t, onDismiss }: { errors: ValidationError[]; t: Translate; onDismiss: () => void }) {
    if (errors.length === 0) return null;
    return (
        <section role="alert" className="animate-fade-up mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3.5">
            <div className="flex items-start gap-3">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-rose-600" />
                <div className="min-w-0 flex-1">
                    <p className="font-semibold text-rose-800">{t("errTitle")}</p>
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm text-rose-900">
                        {errors.slice(0, MAX_ERRORS).map((error, i) => (
                            <li key={i}>{t(error.code as StringKey, error.params)}</li>
                        ))}
                    </ul>
                    {errors.length > MAX_ERRORS && <p className="mt-1.5 text-sm text-rose-800">{t("moreErrors", { n: errors.length - MAX_ERRORS })}</p>}
                </div>
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label={t("dismiss")}
                    className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-rose-700 hover:bg-rose-100"
                >
                    <X className="size-4" />
                </button>
            </div>
        </section>
    );
}

function StatusPill({ route, t }: { route: RouteResult; t: Translate }) {
    const [dot, text, tone] =
        route.status === "ok"
            ? ["bg-emerald-500", t("routeFound"), "text-emerald-700 bg-emerald-50 border-emerald-200"]
            : route.status === "idle"
              ? ["bg-zinc-400", t("waitingStart"), "text-zinc-600 bg-white border-zinc-200"]
              : ["bg-rose-500", t(route.status === "no-route" ? "noRoute" : "startBlocked"), "text-rose-700 bg-rose-50 border-rose-200"];
    return (
        <span key={route.status} className={cx("animate-fade-up inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold", tone)}>
            <span aria-hidden="true" className={cx("size-1.5 rounded-full", dot)} />
            {text}
        </span>
    );
}

type WaypointProps = {
    building: LoadedBuilding;
    hazards: Hazards;
    start: string | null;
    route: RouteResult;
    t: Translate;
    onStartChange: (id: string | null) => void;
};

function Waypoints({ building, hazards, start, route, t, onStartChange }: WaypointProps) {
    const options = building.data.nodes.filter((n) => n.type !== "exit").sort((a, b) => compareIds(a.id, b.id));
    const exit = route.status === "ok" ? building.graph.nodeById.get(route.exit)! : null;

    return (
        <div className="relative space-y-2 rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-sm">
            <span aria-hidden="true" className="absolute top-8 bottom-8 left-[23px] border-l-2 border-dotted border-zinc-300" />
            <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className="relative grid size-7 shrink-0 place-items-center rounded-full bg-blue-600 font-mono text-xs font-bold text-white">
                    A
                </span>
                <label htmlFor="start-select" className="sr-only">
                    {t("startLabel")}
                </label>
                <select
                    id="start-select"
                    value={start ?? ""}
                    onChange={(e) => onStartChange(e.target.value || null)}
                    className="h-10 min-w-0 flex-1 cursor-pointer rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-medium text-zinc-900 outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
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
            </div>
            <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className="relative grid size-7 shrink-0 place-items-center rounded-lg bg-emerald-600 font-mono text-xs font-bold text-white">
                    B
                </span>
                <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm">
                    {exit ? (
                        <>
                            <LogOut aria-hidden="true" className="size-4 shrink-0 text-emerald-600" />
                            <strong className="font-mono text-zinc-900">{exit.id}</strong>
                            <span className="truncate text-zinc-500">{exit.label}</span>
                        </>
                    ) : route.status === "idle" ? (
                        <span className="text-zinc-400">{t("exitPlaceholder")}</span>
                    ) : (
                        <span className="font-medium text-rose-600">{t("unreachable")}</span>
                    )}
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value, dark }: { label: string; value: string; dark?: boolean }) {
    return (
        <div className={cx("rounded-xl border px-3 py-2.5", dark ? "border-indigo-600 bg-indigo-600" : "border-zinc-200 bg-white")}>
            <p className={cx("text-xs font-medium", dark ? "text-indigo-200" : "text-zinc-500")}>{label}</p>
            <p className={cx("mt-0.5 font-mono text-2xl leading-tight font-semibold tabular-nums", dark ? "text-white" : "text-zinc-900")}>{value}</p>
        </div>
    );
}

function RouteDetails({ route, building, lang, t }: { route: OkRoute; building: LoadedBuilding; lang: Lang; t: Translate }) {
    const num = (v: number) => localizeDigits(v, lang);
    const nodeById = building.graph.nodeById;

    return (
        <div key={route.path.join(">")} className="mt-4 space-y-5">
            <div className="animate-fade-up grid grid-cols-3 gap-2">
                <Stat label={t("costLabel")} value={num(route.cost)} dark />
                <Stat label={t("statStops")} value={num(route.path.length)} />
                <Stat label={t("statCorridors")} value={num(route.edges.length)} />
            </div>

            <section>
                <SubTitle>{t("legsTitle")}</SubTitle>
                <div className="flex h-7 gap-1" role="img" aria-label={t("legsTitle")}>
                    {route.edges.map((edgeId, i) => (
                        <div
                            key={edgeId}
                            title={`${route.path[i]} → ${route.path[i + 1]} · ${route.legs[i]}`}
                            style={{ flexGrow: route.legs[i], flexBasis: 0, animationDelay: `${i * 90}ms` }}
                            className={cx(
                                "animate-grow-x flex min-w-0 origin-left items-center justify-between gap-1 overflow-hidden rounded-md px-2 font-mono text-[11px] font-semibold text-white",
                                i % 2 ? "bg-indigo-400" : "bg-indigo-600",
                            )}
                        >
                            <span className="truncate">
                                {route.path[i]}→{route.path[i + 1]}
                            </span>
                            <span className="tabular-nums">{num(route.legs[i])}</span>
                        </div>
                    ))}
                </div>
            </section>

            <section>
                <SubTitle>{t("routeSteps")}</SubTitle>
                <ol className="rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-sm">
                    {route.path.map((id, i) => {
                        const node = nodeById.get(id)!;
                        const isFirst = i === 0;
                        const isLast = i === route.path.length - 1;
                        return (
                            <li key={id} className="animate-fade-up relative flex gap-3 pb-3.5 last:pb-0" style={{ animationDelay: `${i * 60}ms` }}>
                                {!isLast && <span aria-hidden="true" className="absolute top-7 bottom-0 left-[13px] w-0.5 bg-indigo-200" />}
                                <span
                                    aria-hidden="true"
                                    className={cx(
                                        "relative z-10 grid size-7 shrink-0 place-items-center rounded-full font-mono text-[11px] font-bold",
                                        isFirst && "bg-blue-600 text-white ring-4 ring-blue-50",
                                        isLast && "bg-emerald-600 text-white ring-4 ring-emerald-50",
                                        !isFirst && !isLast && "border border-indigo-300 bg-white text-indigo-700",
                                    )}
                                >
                                    {isFirst ? <MapPin className="size-3.5" strokeWidth={2.5} /> : isLast ? <LogOut className="size-3.5" strokeWidth={2.5} /> : num(i)}
                                </span>
                                <div className="min-w-0 flex-1">
                                    {(isFirst || isLast) && (
                                        <p className={cx("text-[11px] font-semibold", isFirst ? "text-blue-700" : "text-emerald-700")}>
                                            {t(isFirst ? "startingAt" : "arriveAt")}
                                        </p>
                                    )}
                                    <p className="truncate text-sm text-zinc-500">
                                        <span className="font-mono font-semibold text-zinc-900">{id}</span> · {node.label}
                                    </p>
                                </div>
                                {!isFirst && <span className="font-mono text-xs font-semibold text-zinc-500 tabular-nums">+{num(route.legs[i - 1])}</span>}
                            </li>
                        );
                    })}
                </ol>
                <p className="mt-2 font-mono text-xs break-words text-zinc-500">{route.path.join(" → ")}</p>
            </section>
        </div>
    );
}

function FailureCallout({ route, t }: { route: RouteResult; t: Translate }) {
    const blocked = route.status === "start-blocked";
    return (
        <div key={route.status} className="animate-fade-up mt-4 flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-600">
                <TriangleAlert aria-hidden="true" className="size-5" />
            </span>
            <div>
                <p className="font-semibold text-rose-700">{t(blocked ? "startBlocked" : "noRoute")}</p>
                <p className="mt-0.5 text-sm text-rose-900/80">{t(blocked ? "startBlockedHint" : "noRouteHint")}</p>
            </div>
        </div>
    );
}

const HAZARD_LOOK: Record<HazardKind, { icon: LucideIcon; tone: string }> = {
    node: { icon: Ban, tone: "border-rose-200 bg-rose-50 text-rose-600" },
    edge: { icon: Construction, tone: "border-amber-200 bg-amber-50 text-amber-700" },
    exit: { icon: DoorClosed, tone: "border-zinc-200 bg-zinc-100 text-zinc-600" },
};

function hazardItems(building: LoadedBuilding, hazards: Hazards, t: Translate) {
    const { nodeById, edgeById } = building.graph;
    const sorted = (set: ReadonlySet<string>) => [...set].sort(compareIds);
    return [
        ...sorted(hazards.blockedNodes).map((id) => ({ kind: "node" as const, id, code: id, name: nodeById.get(id)!.label, tag: t("blockedNode") })),
        ...sorted(hazards.blockedEdges).map((id) => {
            const edge = edgeById.get(id)!;
            return { kind: "edge" as const, id, code: `${edge.from}–${edge.to}`, name: t("filterCorridors"), tag: t("blockedEdge") };
        }),
        ...sorted(hazards.closedExits).map((id) => ({ kind: "exit" as const, id, code: id, name: nodeById.get(id)!.label, tag: t("closedExit") })),
    ];
}

type HazardListProps = {
    items: ReturnType<typeof hazardItems>;
    lang: Lang;
    t: Translate;
    onRemove: (kind: HazardKind, id: string) => void;
};

function HazardList({ items, lang, t, onRemove }: HazardListProps) {
    const [filter, setFilter] = useState<"all" | HazardKind>("all");
    const visible = filter === "all" ? items : items.filter((item) => item.kind === filter);
    const filters: { key: "all" | HazardKind; label: StringKey }[] = [
        { key: "all", label: "filterAll" },
        { key: "node", label: "filterPlaces" },
        { key: "edge", label: "filterCorridors" },
        { key: "exit", label: "filterExits" },
    ];

    if (items.length === 0) {
        return (
            <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
                <span className="relative grid size-9 shrink-0 place-items-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-600">
                    <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                    <CircleCheck aria-hidden="true" className="size-[18px]" />
                </span>
                <div>
                    <p className="text-sm font-semibold text-zinc-900">{t("allClearTitle")}</p>
                    <p className="text-sm text-zinc-500">{t("allClearBody")}</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div role="group" aria-label={t("hazardsTitle")} className="mb-3 flex flex-wrap gap-1.5">
                {filters.map(({ key, label }) => {
                    const count = key === "all" ? items.length : items.filter((i) => i.kind === key).length;
                    return (
                        <button
                            key={key}
                            type="button"
                            aria-pressed={filter === key}
                            onClick={() => setFilter(key)}
                            className={cx(
                                "cursor-pointer rounded-lg border px-2.5 py-1 text-sm font-medium transition outline-none focus-visible:ring-4 focus-visible:ring-indigo-200",
                                filter === key ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300",
                            )}
                        >
                            {t(label)} <span className="font-mono text-xs tabular-nums opacity-70">{localizeDigits(count, lang)}</span>
                        </button>
                    );
                })}
            </div>
            <ul className="space-y-2">
                {visible.map((item) => {
                    const { icon: Icon, tone } = HAZARD_LOOK[item.kind];
                    return (
                        <li key={`${item.kind}:${item.id}`} className="animate-fade-up flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
                            <span className={cx("grid size-9 shrink-0 place-items-center rounded-lg border", tone)}>
                                <Icon aria-hidden="true" className="size-[18px]" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm text-zinc-500">
                                    <span className="font-mono font-semibold text-zinc-900">{item.code}</span> · {item.name}
                                </p>
                                <p className="text-xs font-medium text-zinc-500">{item.tag}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => onRemove(item.kind, item.id)}
                                aria-label={`${t("reopen")}: ${item.code}`}
                                className="cursor-pointer rounded-lg border border-zinc-200 px-2.5 py-1 text-sm font-medium text-zinc-700 transition outline-none hover:bg-zinc-50 focus-visible:ring-4 focus-visible:ring-indigo-200"
                            >
                                {t("reopen")}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </>
    );
}

function Legend({ t }: { t: Translate }) {
    const items: { key: StringKey; swatch: ReactNode }[] = [
        { key: "legendRoom", swatch: <span className="size-4 rounded-md border border-zinc-300 bg-white" /> },
        { key: "legendJunction", swatch: <span className="size-3.5 rounded-full border border-zinc-300 bg-zinc-100" /> },
        { key: "legendExit", swatch: <span className="h-3.5 w-5 rounded border border-emerald-300 bg-emerald-50" /> },
        { key: "legendStart", swatch: <span className="size-4 rounded-md border-2 border-blue-400 bg-white" /> },
        { key: "legendRoute", swatch: <span className="h-1 w-6 rounded-full bg-indigo-600" /> },
        { key: "legendBlocked", swatch: <span className="size-4 rounded-md border border-rose-300 bg-rose-50" /> },
        { key: "legendBlockedEdge", swatch: <span className="w-6 border-t-2 border-dashed border-rose-500" /> },
        { key: "legendClosed", swatch: <span className="h-3.5 w-5 rounded border border-dashed border-zinc-400 bg-zinc-50" /> },
    ];
    return (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-zinc-200 bg-white p-3 text-[13px] text-zinc-600 shadow-sm">
            {items.map(({ key, swatch }) => (
                <li key={key} className="flex items-center gap-2 whitespace-nowrap">
                    <span aria-hidden="true" className="grid w-6 shrink-0 place-items-center">
                        {swatch}
                    </span>
                    {t(key)}
                </li>
            ))}
        </ul>
    );
}

type SidebarProps = {
    building: LoadedBuilding | null;
    route: RouteResult;
    start: string | null;
    hazards: Hazards;
    errors: ValidationError[];
    lang: Lang;
    t: Translate;
    onImport: () => void;
    onDismissErrors: () => void;
    onStartChange: (id: string | null) => void;
    onRemoveHazard: (kind: HazardKind, id: string) => void;
};

export function Sidebar(props: SidebarProps) {
    const { building, route, start, hazards, errors, lang, t } = props;
    const count = (type: string) => building?.data.nodes.filter((n) => n.type === type).length ?? 0;
    const items = building ? hazardItems(building, hazards, t) : [];
    const isSample = building?.source === "building.json";

    return (
        <aside className="flex min-h-0 flex-col border-t border-zinc-200 bg-zinc-50/80 lg:w-[400px] lg:shrink-0 lg:border-t-0 lg:border-r">
            {/* Building selector (pattern from the "acme PRD" workspace switcher). */}
            <div className="p-4 pb-2">
                <button
                    type="button"
                    onClick={props.onImport}
                    title={t("switchBuilding")}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-2.5 pr-3 text-left shadow-sm transition outline-none hover:border-zinc-300 focus-visible:ring-4 focus-visible:ring-indigo-200"
                >
                    <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-8 rounded-lg" />
                    <span className="min-w-0 flex-1 truncate font-semibold text-zinc-900">{building?.data.building ?? t("emptyTitle")}</span>
                    {building && (
                        <span className="rounded-md bg-violet-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-violet-600">
                            {t(isSample ? "badgeSample" : "badgeFile")}
                        </span>
                    )}
                    <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-zinc-400" />
                </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-6">
                <ErrorCard errors={errors} t={t} onDismiss={props.onDismissErrors} />

                {building ? (
                    <div className="space-y-7">
                        <section>
                            <NavHeading icon={RouteIcon} aside={<StatusPill route={route} t={t} />}>
                                {t("routeTitle")}
                            </NavHeading>
                            <Waypoints building={building} hazards={hazards} start={start} route={route} t={t} onStartChange={props.onStartChange} />
                            {route.status === "ok" && <RouteDetails route={route} building={building} lang={lang} t={t} />}
                            {(route.status === "no-route" || route.status === "start-blocked") && <FailureCallout route={route} t={t} />}
                            {route.status === "idle" && <p className="mt-3 text-sm text-zinc-500">{t("noStart")}</p>}
                        </section>

                        <section>
                            <NavHeading
                                icon={ShieldAlert}
                                aside={
                                    items.length > 0 && (
                                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                                            {t("hazardsCount", { n: items.length })}
                                        </span>
                                    )
                                }
                            >
                                {t("hazardsTitle")}
                            </NavHeading>
                            <HazardList items={items} lang={lang} t={t} onRemove={props.onRemoveHazard} />
                        </section>

                        <section>
                            <NavHeading icon={Layers}>{t("legendTitle")}</NavHeading>
                            <Legend t={t} />
                        </section>

                        <div className="text-xs leading-relaxed text-zinc-500">
                            <p className="font-mono">
                                {t("counts", { rooms: count("room"), junctions: count("junction"), exits: count("exit"), edges: building.data.edges.length })}
                            </p>
                            <p className="mt-1">{t("disclaimer")}</p>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-zinc-500">{t("emptyBody")}</p>
                )}
            </div>
        </aside>
    );
}
