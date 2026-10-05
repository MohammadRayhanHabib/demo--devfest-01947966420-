/**
 * Outliner sidebar (pattern from the Mind Palace app): start picker, filter
 * chips, hint line, and ROUTE / HAZARDS / PLACES sections as tree lists.
 */
import { ChevronRight, ChevronsUpDown, FileUp, MousePointer2, TriangleAlert, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cx } from "../lib/cx";
import { localizeDigits, type Lang, type StringKey, type Translate } from "../lib/i18n";
import { compareIds } from "../lib/router";
import type { Hazards, LoadedBuilding, Mode, NodeType, RouteResult, ValidationError } from "../lib/types";
import { NODE_EMOJI } from "./MapNode";

const MAX_ERRORS = 8;

type HazardKind = "node" | "edge" | "exit";
type PlaceFilter = "all" | NodeType;

function SectionLabel({ children, tone = "gray", aside }: { children: ReactNode; tone?: "gray" | "red"; aside?: ReactNode }) {
    return (
        <div className="mt-6 mb-2 flex items-center justify-between gap-2 first:mt-0">
            <h2 className={cx("text-[11px] font-semibold tracking-wider uppercase", tone === "red" ? "text-rose-500" : "text-gray-400")}>{children}</h2>
            {aside}
        </div>
    );
}

function ErrorCard({ errors, t, onDismiss }: { errors: ValidationError[]; t: Translate; onDismiss: () => void }) {
    if (errors.length === 0) return null;
    return (
        <section role="alert" className="animate-fade-up mb-4 rounded-xl border border-red-200 bg-red-50 p-3">
            <div className="flex items-start gap-2.5">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-red-600" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-red-800">{t("errTitle")}</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[13px] text-red-900">
                        {errors.slice(0, MAX_ERRORS).map((error, i) => (
                            <li key={i}>{t(error.code as StringKey, error.params)}</li>
                        ))}
                    </ul>
                    {errors.length > MAX_ERRORS && <p className="mt-1 text-[13px] text-red-800">{t("moreErrors", { n: errors.length - MAX_ERRORS })}</p>}
                </div>
                <button type="button" onClick={onDismiss} aria-label={t("dismiss")} className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-md text-red-700 hover:bg-red-100">
                    <X className="size-4" />
                </button>
            </div>
        </section>
    );
}

function RouteSection({ building, route, lang, t }: { building: LoadedBuilding; route: RouteResult; lang: Lang; t: Translate }) {
    const num = (v: number) => localizeDigits(v, lang);

    if (route.status === "idle") return <p className="px-1 text-[13px] text-gray-400">{t("noStart")}</p>;
    if (route.status !== "ok") {
        const blocked = route.status === "start-blocked";
        return (
            <div key={route.status} className="animate-fade-up rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-red-600">
                    <TriangleAlert aria-hidden="true" className="size-4" />
                    {t(blocked ? "startBlocked" : "noRoute")}
                </p>
                <p className="mt-0.5 text-[13px] text-red-900/75">{t(blocked ? "startBlockedHint" : "noRouteHint")}</p>
            </div>
        );
    }

    const { nodeById } = building.graph;
    const [first, ...rest] = route.path;
    return (
        <div key={route.path.join(">")} className="animate-fade-up">
            <div className="mb-2 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                <span className="text-[13px] text-gray-500">
                    {t("exitLabel")} <strong className="font-mono text-gray-900">{route.exit}</strong> · {nodeById.get(route.exit)!.label}
                </span>
                <span className="rounded-md bg-indigo-500 px-2 py-0.5 font-mono text-sm font-bold text-white">Σ {num(route.cost)}</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm">
                <ChevronRight aria-hidden="true" className="size-3.5 rotate-90 text-gray-400" />
                <span aria-hidden="true">{NODE_EMOJI[nodeById.get(first)!.type]}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{nodeById.get(first)!.label}</span>
                <span className="font-mono text-[11px] font-semibold text-blue-600">{t("startTag")}</span>
            </div>
            <ul className="ml-[11px] border-l border-gray-200 pl-3">
                {rest.map((id, i) => {
                    const node = nodeById.get(id)!;
                    return (
                        <li key={id} className="animate-fade-up flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm" style={{ animationDelay: `${i * 50}ms` }}>
                            <span aria-hidden="true">{NODE_EMOJI[node.type]}</span>
                            <span className="min-w-0 flex-1 truncate text-gray-700">
                                {node.label} <span className="font-mono text-[11px] text-gray-400">{id}</span>
                            </span>
                            <span className="font-mono text-xs font-semibold text-gray-500 tabular-nums">+{num(route.legs[i])}</span>
                        </li>
                    );
                })}
            </ul>
            <p className="mt-2 px-1 font-mono text-[11px] break-words text-gray-400">{route.path.join(" → ")}</p>
        </div>
    );
}

function HazardSection({ building, hazards, t, onRemove }: { building: LoadedBuilding; hazards: Hazards; t: Translate; onRemove: (kind: HazardKind, id: string) => void }) {
    const { nodeById, edgeById } = building.graph;
    const sorted = (set: ReadonlySet<string>) => [...set].sort(compareIds);
    const items = [
        ...sorted(hazards.blockedNodes).map((id) => ({ kind: "node" as const, id, emoji: "⛔", text: nodeById.get(id)!.label, code: id, tag: t("blockedNode") })),
        ...sorted(hazards.blockedEdges).map((id) => {
            const edge = edgeById.get(id)!;
            return { kind: "edge" as const, id, emoji: "🚧", text: `${edge.from} – ${edge.to}`, code: id, tag: t("blockedEdge") };
        }),
        ...sorted(hazards.closedExits).map((id) => ({ kind: "exit" as const, id, emoji: "🔒", text: nodeById.get(id)!.label, code: id, tag: t("closedExit") })),
    ];

    if (items.length === 0) {
        return (
            <p className="flex items-center gap-2 px-1 py-1.5 text-sm text-gray-500">
                <span aria-hidden="true">✅</span>
                {t("allClearTitle")} — {t("allClearBody")}
            </p>
        );
    }
    return (
        <ul className="space-y-0.5">
            {items.map((item) => (
                <li key={`${item.kind}:${item.id}`} className="animate-fade-up group flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm hover:bg-gray-50">
                    <span aria-hidden="true">{item.emoji}</span>
                    <span className="min-w-0 flex-1 truncate text-gray-800">
                        {item.text} <span className="text-[12px] text-gray-400">· {item.tag}</span>
                    </span>
                    <button
                        type="button"
                        onClick={() => onRemove(item.kind, item.id)}
                        aria-label={`${t("reopen")}: ${item.text}`}
                        title={t("reopen")}
                        className="cursor-pointer rounded-md px-2 py-0.5 text-[12px] font-semibold text-gray-500 outline-none hover:bg-gray-200 hover:text-gray-900 focus-visible:ring-4 focus-visible:ring-indigo-200"
                    >
                        {t("reopen")}
                    </button>
                </li>
            ))}
        </ul>
    );
}

type PlacesProps = {
    building: LoadedBuilding;
    hazards: Hazards;
    route: RouteResult;
    start: string | null;
    filter: PlaceFilter;
    t: Translate;
    onActivate: (id: string) => void;
};

function PlacesSection({ building, hazards, route, start, filter, t, onActivate }: PlacesProps) {
    const onRoute = new Set(route.status === "ok" ? route.path : []);
    const places = building.data.nodes.filter((n) => filter === "all" || n.type === filter).sort((a, b) => compareIds(a.id, b.id));

    return (
        <ul className="space-y-0.5">
            {places.map((node) => {
                const blocked = hazards.blockedNodes.has(node.id) || hazards.closedExits.has(node.id);
                const dot = blocked
                    ? node.type === "exit"
                        ? "bg-gray-400"
                        : "bg-red-500"
                    : node.id === start
                      ? "bg-blue-500"
                      : onRoute.has(node.id)
                        ? "bg-indigo-500"
                        : "bg-gray-200";
                return (
                    <li key={node.id}>
                        <button
                            type="button"
                            onClick={() => onActivate(node.id)}
                            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-1 py-1.5 text-left text-sm outline-none hover:bg-gray-50 focus-visible:ring-4 focus-visible:ring-indigo-200"
                        >
                            <ChevronRight aria-hidden="true" className="size-3.5 text-gray-400" />
                            <span aria-hidden="true">{NODE_EMOJI[node.type]}</span>
                            <span className={cx("min-w-0 flex-1 truncate", blocked ? "text-gray-400 line-through" : "text-gray-800")}>{node.label}</span>
                            <span className="font-mono text-[11px] text-gray-400">{node.id}</span>
                            <span aria-hidden="true" className={cx("size-2 rounded-full", dot)} />
                            <span className="sr-only">{blocked ? t("stateBlocked") : t("stateOpen")}</span>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}

type SidebarProps = {
    building: LoadedBuilding | null;
    route: RouteResult;
    start: string | null;
    hazards: Hazards;
    errors: ValidationError[];
    mode: Mode;
    lang: Lang;
    t: Translate;
    onImport: () => void;
    onDismissErrors: () => void;
    onStartChange: (id: string | null) => void;
    onPlaceActivate: (id: string) => void;
    onRemoveHazard: (kind: HazardKind, id: string) => void;
};

export function Sidebar(props: SidebarProps) {
    const { building, route, start, hazards, errors, mode, lang, t } = props;
    const [filter, setFilter] = useState<PlaceFilter>("all");
    const count = (type: NodeType) => building?.data.nodes.filter((n) => n.type === type).length ?? 0;
    const hazardCount = hazards.blockedNodes.size + hazards.blockedEdges.size + hazards.closedExits.size;
    const startOptions = building?.data.nodes.filter((n) => n.type !== "exit").sort((a, b) => compareIds(a.id, b.id)) ?? [];

    const chips: { key: PlaceFilter; label: StringKey; emoji?: string }[] = [
        { key: "all", label: "filterAll" },
        { key: "room", label: "filterRooms", emoji: NODE_EMOJI.room },
        { key: "junction", label: "filterJunctions", emoji: NODE_EMOJI.junction },
        { key: "exit", label: "filterExits", emoji: NODE_EMOJI.exit },
    ];

    return (
        <aside className="flex min-h-0 flex-col border-gray-100 bg-white lg:w-[330px] lg:shrink-0 lg:border-r">
            <div className="space-y-3 p-4 pb-2">
                <div className="flex items-center gap-2">
                    <div className="relative min-w-0 flex-1">
                        <label htmlFor="start-select" className="sr-only">
                            {t("startLabel")}
                        </label>
                        <select
                            id="start-select"
                            value={start ?? ""}
                            disabled={!building}
                            onChange={(e) => props.onStartChange(e.target.value || null)}
                            className="h-9 w-full cursor-pointer appearance-none rounded-lg border border-gray-200 bg-white pr-8 pl-3 text-sm font-medium text-gray-800 outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 disabled:opacity-50"
                        >
                            <option value="">{t("startPlaceholder")}</option>
                            {startOptions.map((n) => {
                                const blocked = hazards.blockedNodes.has(n.id);
                                return (
                                    <option key={n.id} value={n.id} disabled={blocked && n.id !== start}>
                                        {n.id} — {n.label}
                                        {blocked ? ` (${t("stateBlocked")})` : ""}
                                    </option>
                                );
                            })}
                        </select>
                        <ChevronsUpDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-gray-400" />
                    </div>
                    <button
                        type="button"
                        onClick={props.onImport}
                        aria-label={t("importBtn")}
                        title={t("importBtn")}
                        className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-gray-200 text-gray-600 outline-none hover:bg-gray-50 focus-visible:ring-4 focus-visible:ring-indigo-200"
                    >
                        <FileUp className="size-4" />
                    </button>
                </div>

                <div role="group" aria-label={t("placesTitle")} className="flex flex-wrap gap-1.5">
                    {chips.map(({ key, label, emoji }) => (
                        <button
                            key={key}
                            type="button"
                            aria-pressed={filter === key}
                            onClick={() => setFilter(key)}
                            className={cx(
                                "cursor-pointer rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition outline-none focus-visible:ring-4 focus-visible:ring-indigo-200",
                                filter === key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                            )}
                        >
                            {emoji && <span aria-hidden="true">{emoji} </span>}
                            {t(label)}
                            {key !== "all" && <span className="ml-1 font-mono text-[11px] opacity-60">{localizeDigits(count(key), lang)}</span>}
                        </button>
                    ))}
                </div>

                <p className="flex items-start gap-1.5 text-xs text-gray-400">
                    <MousePointer2 aria-hidden="true" className="mt-px size-3.5 shrink-0 text-indigo-500" />
                    {t(mode === "start" ? "hintStart" : "hintHazard")}
                </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-6">
                <ErrorCard errors={errors} t={t} onDismiss={props.onDismissErrors} />

                {building ? (
                    <>
                        <SectionLabel>{t("routeTitle")}</SectionLabel>
                        <RouteSection building={building} route={route} lang={lang} t={t} />

                        <SectionLabel
                            tone="red"
                            aside={hazardCount > 0 && <span className="font-mono text-[11px] font-semibold text-rose-500">{localizeDigits(hazardCount, lang)}</span>}
                        >
                            {t("hazardsTitle")}
                        </SectionLabel>
                        <HazardSection building={building} hazards={hazards} t={t} onRemove={props.onRemoveHazard} />

                        <SectionLabel>{t("placesTitle")}</SectionLabel>
                        <PlacesSection building={building} hazards={hazards} route={route} start={start} filter={filter} t={t} onActivate={props.onPlaceActivate} />

                        <SectionLabel>{t("legendTitle")}</SectionLabel>
                        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-1 text-xs text-gray-500">
                            <li>{NODE_EMOJI.room} {t("legendRoom")}</li>
                            <li>{NODE_EMOJI.junction} {t("legendJunction")}</li>
                            <li>{NODE_EMOJI.exit} {t("legendExit")}</li>
                            <li className="flex items-center gap-1.5">
                                <span aria-hidden="true" className="w-5 border-t-2 border-dashed border-gray-900" /> {t("legendRoute")}
                            </li>
                            <li className="flex items-center gap-1.5">
                                <span aria-hidden="true" className="size-3 rounded border-[1.5px] border-dashed border-gray-900" /> {t("legendStart")}
                            </li>
                            <li className="flex items-center gap-1.5">
                                <span aria-hidden="true" className="size-3 rounded border-[1.5px] border-red-400" /> {t("legendBlocked")}
                            </li>
                            <li className="flex items-center gap-1.5">
                                <span aria-hidden="true" className="w-5 border-t-2 border-dashed border-red-400" /> {t("legendBlockedEdge")}
                            </li>
                            <li>🔒 {t("legendClosed")}</li>
                        </ul>

                        <p className="mt-6 px-1 text-[11px] leading-relaxed text-gray-400">
                            {building.data.building} · {t("disclaimer")}
                        </p>
                    </>
                ) : (
                    <p className="text-sm text-gray-500">{t("emptyBody")}</p>
                )}
            </div>
        </aside>
    );
}
