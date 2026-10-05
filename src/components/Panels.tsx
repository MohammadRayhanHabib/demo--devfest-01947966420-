/**
 * Floating control panel + map legend.
 * UI patterns from Mobbin: komoot (floating route panel, A/B waypoints),
 * OpenAI Platform (status line), GetYourGuide (itinerary), Browserbase
 * (cost bar), Nextdoor (alert cards with filter chips), Felt (map legend).
 */
import { Ban, CircleCheck, Construction, DoorClosed, LogOut, MapPin, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cx } from "../lib/cx";
import { localizeDigits, type Lang, type StringKey, type Translate } from "../lib/i18n";
import { compareIds } from "../lib/router";
import type { Hazards, LoadedBuilding, RouteResult, ValidationError } from "../lib/types";

const MAX_ERRORS = 8;

type OkRoute = Extract<RouteResult, { status: "ok" }>;
type HazardKind = "node" | "edge" | "exit";

function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
    return (
        <div className="mb-2.5 flex items-center justify-between gap-2">
            <h3 className="card-title">{children}</h3>
            {aside}
        </div>
    );
}

export function ErrorCard({ errors, t, onDismiss }: { errors: ValidationError[]; t: Translate; onDismiss: () => void }) {
    if (errors.length === 0) return null;
    return (
        <section role="alert" className="animate-fade-up rounded-xl border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-start gap-3">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-rose-600" />
                <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-rose-800">{t("errTitle")}</h2>
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm text-rose-900">
                        {errors.slice(0, MAX_ERRORS).map((error, i) => (
                            <li key={i}>{t(error.code as StringKey, error.params)}</li>
                        ))}
                    </ul>
                    {errors.length > MAX_ERRORS && (
                        <p className="mt-1.5 text-sm text-rose-800">{t("moreErrors", { n: errors.length - MAX_ERRORS })}</p>
                    )}
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

function StatusLine({ route, t }: { route: RouteResult; t: Translate }) {
    const [Icon, text, tone]: [LucideIcon, string, string] =
        route.status === "ok"
            ? [CircleCheck, t("routeFound"), "text-emerald-700"]
            : route.status === "idle"
              ? [MapPin, t("waitingStart"), "text-slate-500"]
              : [TriangleAlert, t(route.status === "no-route" ? "noRoute" : "startBlocked"), "text-rose-700"];
    return (
        <p key={route.status} className={cx("animate-fade-up mt-1 flex items-center gap-1.5 text-sm font-semibold", tone)}>
            <Icon aria-hidden="true" className="size-4" strokeWidth={2.5} />
            {text}
        </p>
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
        <div className="relative space-y-2 rounded-2xl bg-slate-50 p-2.5 ring-1 ring-slate-200">
            <span aria-hidden="true" className="absolute top-8 bottom-8 left-[23px] border-l-2 border-dotted border-slate-300" />
            <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className="relative grid size-7 shrink-0 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    A
                </span>
                <label htmlFor="start-select" className="sr-only">
                    {t("startLabel")}
                </label>
                <select
                    id="start-select"
                    value={start ?? ""}
                    onChange={(e) => onStartChange(e.target.value || null)}
                    className="h-11 min-w-0 flex-1 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-[15px] font-medium text-slate-900 outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
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
                <span aria-hidden="true" className="relative grid size-7 shrink-0 place-items-center rounded-lg bg-emerald-600 text-xs font-bold text-white">
                    B
                </span>
                <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[15px]">
                    {exit ? (
                        <>
                            <LogOut aria-hidden="true" className="size-4 shrink-0 text-emerald-600" strokeWidth={2.5} />
                            <strong className="text-slate-900">{exit.id}</strong>
                            <span className="truncate text-slate-500">{exit.label}</span>
                        </>
                    ) : route.status === "idle" ? (
                        <span className="text-slate-400">{t("exitPlaceholder")}</span>
                    ) : (
                        <span className="font-medium text-rose-600">{t("unreachable")}</span>
                    )}
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
    return (
        <div className={cx("rounded-xl border px-3 py-2.5", accent ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white")}>
            <p className={cx("text-xs font-medium", accent ? "text-emerald-800" : "text-slate-500")}>{label}</p>
            <p className={cx("mt-0.5 text-2xl leading-tight font-extrabold tabular-nums", accent ? "text-emerald-600" : "text-slate-900")}>{value}</p>
        </div>
    );
}

const PinIcon = () => <MapPin className="size-4" strokeWidth={2.5} />;
const ExitIcon = () => <LogOut className="size-4" strokeWidth={2.5} />;

function RouteDetails({ route, building, lang, t }: { route: OkRoute; building: LoadedBuilding; lang: Lang; t: Translate }) {
    const num = (v: number) => localizeDigits(v, lang);
    const nodeById = building.graph.nodeById;
    const key = route.path.join(">");

    return (
        <div key={key} className="space-y-6">
            <div className="animate-fade-up grid grid-cols-3 gap-2">
                <Stat label={t("costLabel")} value={num(route.cost)} accent />
                <Stat label={t("statStops")} value={num(route.path.length)} />
                <Stat label={t("statCorridors")} value={num(route.edges.length)} />
            </div>

            <section>
                <SectionTitle>{t("legsTitle")}</SectionTitle>
                <div className="flex h-8 gap-1" role="img" aria-label={t("legsTitle")}>
                    {route.edges.map((edgeId, i) => (
                        <div
                            key={edgeId}
                            title={`${route.path[i]} → ${route.path[i + 1]} · ${route.legs[i]}`}
                            style={{ flexGrow: route.legs[i], flexBasis: 0, animationDelay: `${i * 90}ms` }}
                            className={cx(
                                "animate-grow-x flex min-w-0 origin-left items-center justify-between gap-1 overflow-hidden rounded-md px-2 text-xs font-semibold text-white",
                                i % 2 ? "bg-emerald-400" : "bg-emerald-600",
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
                <SectionTitle>{t("routeSteps")}</SectionTitle>
                <p className="mb-3 font-mono text-sm break-words text-slate-600">{route.path.join(" → ")}</p>
                <ol>
                    {route.path.map((id, i) => {
                        const node = nodeById.get(id)!;
                        const isFirst = i === 0;
                        const isLast = i === route.path.length - 1;
                        return (
                            <li key={id} className="animate-fade-up relative flex gap-3 pb-4 last:pb-0" style={{ animationDelay: `${i * 60}ms` }}>
                                {!isLast && <span aria-hidden="true" className="absolute top-8 bottom-0 left-[14.5px] w-[3px] rounded-full bg-emerald-500" />}
                                <span
                                    aria-hidden="true"
                                    className={cx(
                                        "relative z-10 grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold",
                                        isFirst && "bg-blue-600 text-white ring-4 ring-blue-100",
                                        isLast && "bg-emerald-600 text-white ring-4 ring-emerald-100",
                                        !isFirst && !isLast && "border-2 border-emerald-500 bg-white text-slate-900",
                                    )}
                                >
                                    {isFirst ? <PinIcon /> : isLast ? <ExitIcon /> : num(i)}
                                </span>
                                <div className="min-w-0 flex-1 pt-0.5">
                                    {(isFirst || isLast) && (
                                        <p className={cx("text-xs font-semibold", isFirst ? "text-blue-700" : "text-emerald-700")}>
                                            {t(isFirst ? "startingAt" : "arriveAt")}
                                        </p>
                                    )}
                                    <p className="truncate text-[15px] font-semibold text-slate-900">
                                        {id} <span className="font-normal text-slate-500">· {node.label}</span>
                                    </p>
                                </div>
                                {!isFirst && <span className="pt-0.5 text-sm font-semibold text-slate-500 tabular-nums">+{num(route.legs[i - 1])}</span>}
                            </li>
                        );
                    })}
                </ol>
            </section>
        </div>
    );
}

function FailureCallout({ route, t }: { route: RouteResult; t: Translate }) {
    const blocked = route.status === "start-blocked";
    return (
        <div key={route.status} className="animate-fade-up flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-600">
                <TriangleAlert aria-hidden="true" className="size-5" />
            </span>
            <div>
                <p className="font-bold text-rose-700">{t(blocked ? "startBlocked" : "noRoute")}</p>
                <p className="mt-0.5 text-sm text-rose-900/80">{t(blocked ? "startBlockedHint" : "noRouteHint")}</p>
            </div>
        </div>
    );
}

type HazardListProps = {
    building: LoadedBuilding;
    hazards: Hazards;
    lang: Lang;
    t: Translate;
    onRemove: (kind: HazardKind, id: string) => void;
};

const HAZARD_LOOK: Record<HazardKind, { icon: LucideIcon; tone: string }> = {
    node: { icon: Ban, tone: "bg-rose-100 text-rose-600" },
    edge: { icon: Construction, tone: "bg-amber-100 text-amber-700" },
    exit: { icon: DoorClosed, tone: "bg-slate-200 text-slate-600" },
};

function HazardList({ building, hazards, lang, t, onRemove }: HazardListProps) {
    const [filter, setFilter] = useState<"all" | HazardKind>("all");
    const { nodeById, edgeById } = building.graph;
    const sorted = (set: ReadonlySet<string>) => [...set].sort(compareIds);

    const items = [
        ...sorted(hazards.blockedNodes).map((id) => ({
            kind: "node" as const,
            id,
            title: `${id} · ${nodeById.get(id)!.label}`,
            tag: t("blockedNode"),
        })),
        ...sorted(hazards.blockedEdges).map((id) => {
            const edge = edgeById.get(id)!;
            return { kind: "edge" as const, id, title: `${edge.from} – ${edge.to}`, tag: t("blockedEdge") };
        }),
        ...sorted(hazards.closedExits).map((id) => ({
            kind: "exit" as const,
            id,
            title: `${id} · ${nodeById.get(id)!.label}`,
            tag: t("closedExit"),
        })),
    ];
    const visible = filter === "all" ? items : items.filter((item) => item.kind === filter);
    const filters: { key: "all" | HazardKind; label: StringKey }[] = [
        { key: "all", label: "filterAll" },
        { key: "node", label: "filterPlaces" },
        { key: "edge", label: "filterCorridors" },
        { key: "exit", label: "filterExits" },
    ];

    return (
        <section>
            <SectionTitle
                aside={
                    items.length > 0 && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                            {t("hazardsCount", { n: items.length })}
                        </span>
                    )
                }
            >
                {t("hazardsTitle")}
            </SectionTitle>

            {items.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                        <CircleCheck aria-hidden="true" className="size-5" />
                    </span>
                    <div>
                        <p className="font-semibold text-emerald-800">{t("allClearTitle")}</p>
                        <p className="text-sm text-emerald-800/75">{t("allClearBody")}</p>
                    </div>
                </div>
            ) : (
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
                                        "cursor-pointer rounded-full border px-3 py-1 text-sm font-medium transition outline-none focus-visible:ring-4 focus-visible:ring-indigo-200",
                                        filter === key
                                            ? "border-slate-900 bg-slate-900 text-white"
                                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                                    )}
                                >
                                    {t(label)} <span className="tabular-nums opacity-70">{localizeDigits(count, lang)}</span>
                                </button>
                            );
                        })}
                    </div>
                    <ul className="space-y-2">
                        {visible.map((item) => {
                            const { icon: Icon, tone } = HAZARD_LOOK[item.kind];
                            return (
                                <li
                                    key={`${item.kind}:${item.id}`}
                                    className="animate-fade-up flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                                >
                                    <span className={cx("grid size-9 shrink-0 place-items-center rounded-full", tone)}>
                                        <Icon aria-hidden="true" className="size-[18px]" strokeWidth={2.25} />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-[15px] font-semibold text-slate-900">{item.title}</p>
                                        <p className="text-sm text-slate-500">{item.tag}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => onRemove(item.kind, item.id)}
                                        aria-label={`${t("reopen")}: ${item.title}`}
                                        className="cursor-pointer rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-700 transition outline-none hover:bg-slate-50 focus-visible:ring-4 focus-visible:ring-indigo-200"
                                    >
                                        {t("reopen")}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </section>
    );
}

type PanelProps = {
    building: LoadedBuilding | null;
    route: RouteResult;
    start: string | null;
    hazards: Hazards;
    errors: ValidationError[];
    lang: Lang;
    t: Translate;
    onDismissErrors: () => void;
    onStartChange: (id: string | null) => void;
    onRemoveHazard: (kind: HazardKind, id: string) => void;
};

export function ControlPanel(props: PanelProps) {
    const { building, route, start, hazards, errors, lang, t } = props;
    const count = (type: string) => building?.data.nodes.filter((n) => n.type === type).length ?? 0;

    return (
        <aside className="flex w-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 lg:h-full">
            <div className="border-b border-slate-100 px-5 pt-5 pb-4">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">{t("routeTitle")}</h2>
                <StatusLine route={route} t={t} />
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
                <ErrorCard errors={errors} t={t} onDismiss={props.onDismissErrors} />

                {building ? (
                    <>
                        <Waypoints building={building} hazards={hazards} start={start} route={route} t={t} onStartChange={props.onStartChange} />
                        {route.status === "ok" && <RouteDetails route={route} building={building} lang={lang} t={t} />}
                        {(route.status === "no-route" || route.status === "start-blocked") && <FailureCallout route={route} t={t} />}
                        {route.status === "idle" && <p className="text-sm text-slate-500">{t("noStart")}</p>}
                        <HazardList building={building} hazards={hazards} lang={lang} t={t} onRemove={props.onRemoveHazard} />
                        <div className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
                            <p className="font-semibold text-slate-700">{building.data.building}</p>
                            <p>
                                {t("counts", {
                                    rooms: count("room"),
                                    junctions: count("junction"),
                                    exits: count("exit"),
                                    edges: building.data.edges.length,
                                })}
                            </p>
                            <p>{t("sourceLabel", { name: building.source })}</p>
                            <p className="mt-1.5">{t("disclaimer")}</p>
                        </div>
                    </>
                ) : (
                    <p className="text-sm text-slate-500">{t("emptyBody")}</p>
                )}
            </div>
        </aside>
    );
}

export function MapLegend({ t }: { t: Translate }) {
    const items: { key: StringKey; swatch: ReactNode }[] = [
        { key: "legendRoom", swatch: <span className="size-4 rounded-md border-2 border-slate-300 bg-white" /> },
        { key: "legendJunction", swatch: <span className="size-3.5 rounded-full border-2 border-slate-300 bg-slate-100" /> },
        { key: "legendExit", swatch: <span className="h-3.5 w-5 rounded border-2 border-emerald-700 bg-emerald-600" /> },
        { key: "legendStart", swatch: <span className="size-4 rounded-md bg-blue-600" /> },
        { key: "legendRoute", swatch: <span className="h-1.5 w-6 rounded-full bg-emerald-500" /> },
        { key: "legendBlocked", swatch: <span className="size-4 rounded-md border-2 border-rose-500 bg-rose-50" /> },
        { key: "legendBlockedEdge", swatch: <span className="w-6 border-t-[3px] border-dashed border-rose-500" /> },
        { key: "legendClosed", swatch: <span className="h-3.5 w-5 rounded border-2 border-dashed border-slate-400 bg-slate-100" /> },
    ];
    return (
        <div className="rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-lg shadow-slate-900/5 backdrop-blur">
            <p className="card-title mb-2.5">{t("legendTitle")}</p>
            <ul className="grid grid-cols-2 gap-x-5 gap-y-2 text-[13px] text-slate-700">
                {items.map(({ key, swatch }) => (
                    <li key={key} className="flex items-center gap-2 whitespace-nowrap">
                        <span aria-hidden="true" className="grid w-6 shrink-0 place-items-center">
                            {swatch}
                        </span>
                        {t(key)}
                    </li>
                ))}
            </ul>
        </div>
    );
}
