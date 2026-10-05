/**
 * Right-hand inspector (Sensa "Node Configuration / Layers" pattern):
 * tabbed panel, bold section titles, label-left / value-right rows.
 */
import { Ban, ChevronDown, CircleCheck, Construction, DoorClosed, DoorOpen, LogOut, MapPin, Split, TriangleAlert, X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "../lib/cx";
import { localizeDigits, type Lang, type StringKey, type Translate } from "../lib/i18n";
import { compareIds } from "../lib/router";
import type { BuildingNode, Hazards, LoadedBuilding, RouteResult, ValidationError } from "../lib/types";

const MAX_ERRORS = 8;

type HazardKind = "node" | "edge" | "exit";
type Tab = "route" | "layers";

const TYPE_ICON: Record<BuildingNode["type"], { icon: LucideIcon; tone: string }> = {
    room: { icon: DoorOpen, tone: "bg-neutral-950 text-white" },
    junction: { icon: Split, tone: "bg-neutral-950 text-white" },
    exit: { icon: LogOut, tone: "bg-neutral-950 text-white" },
};

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
    return (
        <section className="border-b border-neutral-100 px-5 py-5 last:border-b-0">
            <div className="mb-3.5 flex items-center justify-between gap-2">
                <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">{title}</h3>
                {aside}
            </div>
            {children}
        </section>
    );
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
    return (
        <div className="flex min-h-10 items-center justify-between gap-3 text-[14px]">
            <span className="text-neutral-500">{label}</span>
            <div className="flex min-w-0 items-center justify-end">{children}</div>
        </div>
    );
}

function Chip({ children, tone = "plain", mono }: { children: ReactNode; tone?: "plain" | "brand" | "good" | "bad"; mono?: boolean }) {
    const tones = {
        plain: "bg-white text-neutral-800 ring-neutral-200",
        brand: "bg-neutral-950 text-white ring-neutral-950",
        good: "bg-emerald-50 text-emerald-700 ring-emerald-200",
        bad: "bg-rose-50 text-rose-700 ring-rose-200",
    };
    return (
        <span className={cx("inline-flex max-w-full items-center gap-1.5 truncate rounded-md px-2.5 py-1 text-[13px] font-semibold ring-1", tones[tone], mono && "font-mono")}>
            {children}
        </span>
    );
}

function ErrorCard({ errors, t, onDismiss }: { errors: ValidationError[]; t: Translate; onDismiss: () => void }) {
    if (errors.length === 0) return null;
    return (
        <section role="alert" className="animate-fade-up mx-4 mt-4 rounded-xl bg-rose-50 p-3.5 ring-1 ring-rose-200">
            <div className="flex items-start gap-2.5">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-rose-600" />
                <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-rose-800">{t("errTitle")}</p>
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[12px] text-rose-900">
                        {errors.slice(0, MAX_ERRORS).map((error, i) => (
                            <li key={i}>{t(error.code as StringKey, error.params)}</li>
                        ))}
                    </ul>
                    {errors.length > MAX_ERRORS && <p className="mt-1.5 text-[12px] text-rose-800">{t("moreErrors", { n: errors.length - MAX_ERRORS })}</p>}
                </div>
                <button type="button" onClick={onDismiss} aria-label={t("dismiss")} className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-md text-rose-700 hover:bg-rose-100">
                    <X aria-hidden="true" className="size-3.5" />
                </button>
            </div>
        </section>
    );
}

type InspectorProps = {
    building: LoadedBuilding | null;
    route: RouteResult;
    start: string | null;
    hazards: Hazards;
    errors: ValidationError[];
    lang: Lang;
    t: Translate;
    tab: Tab;
    onTabChange: (tab: Tab) => void;
    onDismissErrors: () => void;
    onStartChange: (id: string | null) => void;
    onPlaceActivate: (id: string) => void;
    onCorridorActivate: (id: string) => void;
    onRemoveHazard: (kind: HazardKind, id: string) => void;
};

function RouteTab(props: InspectorProps & { building: LoadedBuilding }) {
    const { building, route, start, hazards, lang, t } = props;
    const num = (v: number) => localizeDigits(v, lang);
    const { nodeById, edgeById } = building.graph;
    const options = building.data.nodes.filter((n) => n.type !== "exit").sort((a, b) => compareIds(a.id, b.id));
    const exit = route.status === "ok" ? nodeById.get(route.exit)! : null;
    const failed = route.status === "no-route" || route.status === "start-blocked";

    const sorted = (set: ReadonlySet<string>) => [...set].sort(compareIds);
    const hazardRows: { kind: HazardKind; id: string; icon: LucideIcon; tone: string; code: string; name: string; tag: string }[] = [
        ...sorted(hazards.blockedNodes).map((id) => ({ kind: "node" as const, id, icon: Ban, tone: "bg-rose-600 text-white", code: id, name: nodeById.get(id)!.label, tag: t("blockedNode") })),
        ...sorted(hazards.blockedEdges).map((id) => {
            const edge = edgeById.get(id)!;
            return { kind: "edge" as const, id, icon: Construction, tone: "bg-rose-500 text-white", code: `${edge.from}–${edge.to}`, name: t("filterCorridors"), tag: t("blockedEdge") };
        }),
        ...sorted(hazards.closedExits).map((id) => ({ kind: "exit" as const, id, icon: DoorClosed, tone: "bg-neutral-500 text-white", code: id, name: nodeById.get(id)!.label, tag: t("closedExit") })),
    ];

    return (
        <>
            {route.status === "ok" && exit && (
                <div className="px-5 pt-5">
                    <div key={route.path.join(">")} className="animate-fade-up rounded-2xl bg-neutral-950 p-4 text-white shadow-[0_12px_32px_-14px_rgba(10,10,10,0.55)]">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[13px] text-neutral-400">{t("exitLabel")}</p>
                                <p className="mt-1 flex min-w-0 items-center gap-2 text-[17px] font-semibold">
                                    <LogOut aria-hidden="true" className="size-5 shrink-0 text-emerald-400" />
                                    <span className="font-mono">{exit.id}</span>
                                    <span className="truncate font-normal text-neutral-300">{exit.label}</span>
                                </p>
                            </div>
                            <div className="shrink-0 text-right">
                                <p className="text-[13px] text-neutral-400">{t("costLabel")}</p>
                                <p className="mt-1 font-mono text-[34px] leading-none font-semibold tracking-[-0.02em]">{num(route.cost)}</p>
                            </div>
                        </div>
                        <p className="mt-4 border-t border-white/10 pt-3 font-mono text-[15px] leading-relaxed break-words text-neutral-100">
                            {route.path.join(" → ")}
                        </p>
                    </div>
                </div>
            )}
            {failed && (
                <div className="px-5 pt-5">
                    <div key={route.status} role="status" className="animate-fade-up flex gap-3 rounded-2xl bg-rose-600 p-4 text-white shadow-[0_12px_32px_-14px_rgba(225,29,72,0.6)]">
                        <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                        <div>
                            <p className="text-[17px] font-semibold">{t(route.status === "no-route" ? "noRoute" : "startBlocked")}</p>
                            <p className="mt-1 text-[14px] leading-relaxed text-rose-50">{t(route.status === "no-route" ? "noRouteHint" : "startBlockedHint")}</p>
                        </div>
                    </div>
                </div>
            )}
            <Section title={t("sectionTrip")}>
                <Row label={<label htmlFor="start-select">{t("startLabel")}</label>}>
                    <div className="relative">
                        <select
                            id="start-select"
                            value={start ?? ""}
                            onChange={(e) => props.onStartChange(e.target.value || null)}
                            className="h-9 max-w-[200px] cursor-pointer appearance-none truncate rounded-lg bg-white pr-8 pl-3 text-[14px] font-semibold text-neutral-950 ring-1 ring-neutral-300 outline-none hover:ring-neutral-400 focus-visible:ring-2 focus-visible:ring-neutral-950"
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
                        <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-neutral-400" />
                    </div>
                </Row>
                {route.status === "idle" && (
                <Row label={t("exitLabel")}>
                    {exit ? (
                        <Chip tone="good">
                            <LogOut aria-hidden="true" className="size-3.5 shrink-0" />
                            <span className="font-mono">{exit.id}</span>
                            <span className="truncate font-normal">{exit.label}</span>
                        </Chip>
                    ) : failed ? (
                        <Chip tone="bad">{t("unreachable")}</Chip>
                    ) : (
                        <span className="text-[13px] text-neutral-400">{t("exitPlaceholder")}</span>
                    )}
                </Row>
                )}
                <Row label={t("statusLabel")}>
                    <div aria-live="polite">
                        <Chip key={route.status} tone={route.status === "ok" ? "brand" : failed ? "bad" : "plain"}>
                            <span
                                aria-hidden="true"
                                className={cx("size-1.5 rounded-full", route.status === "ok" ? "bg-brand-600" : failed ? "bg-rose-500" : "bg-neutral-400")}
                            />
                            {route.status === "ok"
                                ? t("routeFound")
                                : route.status === "idle"
                                  ? t("waitingStart")
                                  : t(route.status === "no-route" ? "noRoute" : "startBlocked")}
                        </Chip>
                    </div>
                </Row>
                {route.status === "ok" && (
                    <>
                        <Row label={t("statStops")}>
                            <Chip mono>{num(route.path.length)}</Chip>
                        </Row>
                        <Row label={t("statCorridors")}>
                            <Chip mono>{num(route.edges.length)}</Chip>
                        </Row>
                    </>
                )}
                {route.status === "idle" && <p className="mt-2 text-[14px] leading-relaxed text-neutral-500">{t("noStart")}</p>}
            </Section>

            {route.status === "ok" && (
                <Section title={t("routeSteps")}>
                    <div key={route.path.join(">")} className="flex h-7 gap-0.5 overflow-hidden rounded-md" role="img" aria-label={t("legsTitle")}>
                        {route.edges.map((edgeId, i) => (
                            <div
                                key={edgeId}
                                title={`${route.path[i]} → ${route.path[i + 1]} · ${route.legs[i]}`}
                                style={{ flexGrow: route.legs[i], flexBasis: 0, animationDelay: `${i * 80}ms` }}
                                className={cx(
                                    "animate-grow-x flex min-w-0 origin-left items-center justify-end px-2 font-mono text-[12px] font-semibold text-white",
                                    i % 2 ? "bg-brand-500" : "bg-brand-700",
                                )}
                            >
                                {num(route.legs[i])}
                            </div>
                        ))}
                    </div>
                    <ol className="mt-4">
                        {route.path.map((id, i) => {
                            const node = nodeById.get(id)!;
                            const first = i === 0;
                            const last = i === route.path.length - 1;
                            return (
                                <li key={id} className="animate-fade-up relative flex items-center gap-3 pb-3 last:pb-0" style={{ animationDelay: `${i * 50}ms` }}>
                                    {!last && <span aria-hidden="true" className="absolute top-8 bottom-0 left-[13px] w-0.5 bg-neutral-200" />}
                                    <span
                                        aria-hidden="true"
                                        className={cx(
                                            "relative grid size-7 shrink-0 place-items-center rounded-full font-mono text-[11px] font-semibold",
                                            "bg-neutral-950 text-white",
                                            last && "ring-4 ring-emerald-100",
                                        )}
                                    >
                                        {first ? <MapPin className="size-3.5" strokeWidth={2.5} /> : last ? <LogOut className="size-3.5" strokeWidth={2.5} /> : num(i)}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-[14px] text-neutral-500">
                                        <span className="font-mono font-semibold text-neutral-950">{id}</span> · {node.label}
                                    </span>
                                    <span className="font-mono text-[13px] font-semibold text-neutral-700">{first ? "" : `+${num(route.legs[i - 1])}`}</span>
                                </li>
                            );
                        })}
                    </ol>
                    <p className="mt-3 font-mono text-[11px] break-words text-neutral-500">{route.path.join(" → ")}</p>
                </Section>
            )}

            <Section
                title={t("hazardsTitle")}
                aside={hazardRows.length > 0 && <Chip tone="bad">{t("hazardsCount", { n: hazardRows.length })}</Chip>}
            >
                {hazardRows.length === 0 ? (
                    <p className="flex items-center gap-2 text-[13px] text-neutral-500">
                        <CircleCheck aria-hidden="true" className="size-4 text-emerald-600" />
                        {t("allClearTitle")} · {t("allClearBody")}
                    </p>
                ) : (
                    <ul className="space-y-1">
                        {hazardRows.map((row) => (
                            <li key={`${row.kind}:${row.id}`} className="animate-fade-up flex items-center gap-2.5 py-1">
                                <span aria-hidden="true" className={cx("grid size-7 shrink-0 place-items-center rounded-md", row.tone)}>
                                    <row.icon className="size-3.5" />
                                </span>
                                <span className="min-w-0 flex-1 text-[13px]">
                                    <span className="block truncate text-neutral-700">
                                        <span className="font-mono font-semibold text-neutral-900">{row.code}</span> · {row.name}
                                    </span>
                                    <span className="block text-[11px] text-neutral-500">{row.tag}</span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => props.onRemoveHazard(row.kind, row.id)}
                                    aria-label={`${t("reopen")}: ${row.code}`}
                                    className="h-7 cursor-pointer rounded-md bg-white px-2.5 text-[12px] font-medium text-neutral-700 ring-1 ring-neutral-200 outline-none hover:ring-neutral-300 focus-visible:ring-2 focus-visible:ring-brand-500"
                                >
                                    {t("reopen")}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            <Section title={t("buildingLabel")}>
                <Row label={t("fileLabel")}>
                    <Chip mono>{building.source}</Chip>
                </Row>
                {(["room", "junction", "exit"] as const).map((type) => (
                    <Row key={type} label={t(type === "room" ? "filterRooms" : type === "junction" ? "filterJunctions" : "filterExits")}>
                        <Chip mono>{num(building.data.nodes.filter((n) => n.type === type).length)}</Chip>
                    </Row>
                ))}
                <Row label={t("filterCorridors")}>
                    <Chip mono>{num(building.data.edges.length)}</Chip>
                </Row>
                <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">{t("disclaimer")}</p>
            </Section>
        </>
    );
}

function LayersTab(props: InspectorProps & { building: LoadedBuilding }) {
    const { building, route, start, hazards, lang, t } = props;
    const onRoute = new Set(route.status === "ok" ? route.path : []);
    const routeEdges = new Set(route.status === "ok" ? route.edges : []);
    const groups = (["room", "junction", "exit"] as const).map((type) => ({
        type,
        title: t(type === "room" ? "filterRooms" : type === "junction" ? "filterJunctions" : "filterExits"),
        nodes: building.data.nodes.filter((n) => n.type === type).sort((a, b) => compareIds(a.id, b.id)),
    }));
    const rowClass =
        "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-brand-500";

    return (
        <>
            {groups.map((group) => (
                <Section key={group.type} title={group.title} aside={<span className="font-mono text-[11px] text-neutral-400">{localizeDigits(group.nodes.length, lang)}</span>}>
                    <ul className="-mx-2 space-y-0.5">
                        {group.nodes.map((node) => {
                            const blocked = hazards.blockedNodes.has(node.id) || hazards.closedExits.has(node.id);
                            const { icon: Icon, tone } = TYPE_ICON[node.type];
                            const dot = blocked ? (node.type === "exit" ? "bg-neutral-400" : "bg-rose-500") : node.id === start ? "bg-brand-600" : onRoute.has(node.id) ? "bg-brand-400" : "bg-neutral-200";
                            return (
                                <li key={node.id}>
                                    <button type="button" onClick={() => props.onPlaceActivate(node.id)} className={rowClass}>
                                        <span aria-hidden="true" className={cx("grid size-7 shrink-0 place-items-center rounded-md", blocked ? "bg-neutral-300 text-white" : tone)}>
                                            <Icon className="size-3.5" />
                                        </span>
                                        <span className={cx("min-w-0 flex-1 truncate", blocked ? "text-neutral-400 line-through" : "text-neutral-800")}>{node.label}</span>
                                        <span className="font-mono text-[11px] text-neutral-400">{node.id}</span>
                                        <span aria-hidden="true" className={cx("size-2 rounded-full", dot)} />
                                        <span className="sr-only">{blocked ? t("stateBlocked") : t("stateOpen")}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </Section>
            ))}

            <Section title={t("filterCorridors")} aside={<span className="font-mono text-[11px] text-neutral-400">{localizeDigits(building.data.edges.length, lang)}</span>}>
                <ul className="-mx-2 space-y-0.5">
                    {[...building.data.edges]
                        .sort((a, b) => compareIds(a.id, b.id))
                        .map((edge) => {
                            const blocked = hazards.blockedEdges.has(edge.id);
                            return (
                                <li key={edge.id}>
                                    <button type="button" onClick={() => props.onCorridorActivate(edge.id)} className={rowClass} aria-label={t("edgeAria", { from: edge.from, to: edge.to, cost: edge.cost, state: t(blocked ? "stateBlocked" : "stateOpen") })}>
                                        <span aria-hidden="true" className={cx("h-0.5 w-6 shrink-0 rounded-full", blocked ? "bg-rose-400" : routeEdges.has(edge.id) ? "bg-brand-600" : "bg-neutral-300")} />
                                        <span className={cx("min-w-0 flex-1 truncate font-mono", blocked ? "text-neutral-400 line-through" : "text-neutral-800")}>
                                            {edge.from} – {edge.to}
                                        </span>
                                        <span className="font-mono text-[11px] text-neutral-500">{localizeDigits(edge.cost, lang)}</span>
                                    </button>
                                </li>
                            );
                        })}
                </ul>
            </Section>

            <Section title={t("legendTitle")}>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12px] text-neutral-600">
                    {(
                        [
                            ["legendRoom", <span className="size-2.5 rounded-full bg-sky-500" />],
                            ["legendJunction", <span className="size-2.5 rounded-full bg-amber-500" />],
                            ["legendExit", <span className="size-2.5 rounded-full bg-emerald-500" />],
                            ["legendStart", <span className="size-3.5 rounded bg-brand-600" />],
                            ["legendRoute", <span className="h-0.5 w-6 rounded-full bg-brand-600" />],
                            ["legendBlocked", <span className="size-3.5 rounded bg-rose-100 ring-1 ring-rose-300" />],
                            ["legendBlockedEdge", <span className="w-6 border-t-2 border-dashed border-rose-400" />],
                            ["legendClosed", <span className="size-3.5 rounded border border-dashed border-neutral-400" />],
                        ] as [StringKey, ReactNode][]
                    ).map(([key, swatch]) => (
                        <li key={key} className="flex items-center gap-2">
                            <span aria-hidden="true" className="grid w-6 shrink-0 place-items-center">
                                {swatch}
                            </span>
                            {t(key)}
                        </li>
                    ))}
                </ul>
            </Section>
        </>
    );
}

export function Inspector(props: InspectorProps) {
    const { building, errors, t, tab } = props;
    const tabs: { key: Tab; label: StringKey }[] = [
        { key: "route", label: "tabRoute" },
        { key: "layers", label: "tabLayers" },
    ];

    return (
        <aside className="flex min-h-0 flex-col border-t border-neutral-200 bg-white lg:w-[360px] lg:shrink-0 lg:border-t-0 lg:border-l">
            <div className="flex h-14 shrink-0 items-center border-b border-neutral-100 px-4">
                <div role="tablist" aria-label={t("tabRoute") + " / " + t("tabLayers")} className="flex rounded-lg bg-neutral-100 p-1">
                    {tabs.map(({ key, label }) => (
                        <button
                            key={key}
                            type="button"
                            role="tab"
                            id={`tab-${key}`}
                            aria-selected={tab === key}
                            aria-controls={`panel-${key}`}
                            onClick={() => props.onTabChange(key)}
                            className={cx(
                                "cursor-pointer rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                                tab === key ? "bg-white text-neutral-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "text-neutral-500 hover:text-neutral-800",
                            )}
                        >
                            {t(label)}
                        </button>
                    ))}
                </div>
            </div>

            <ErrorCard errors={errors} t={t} onDismiss={props.onDismissErrors} />

            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto">
                {building ? (
                    tab === "route" ? (
                        <RouteTab {...props} building={building} />
                    ) : (
                        <LayersTab {...props} building={building} />
                    )
                ) : (
                    <p className="px-5 py-5 text-[13px] text-neutral-500">{t("emptyBody")}</p>
                )}
            </div>
        </aside>
    );
}
