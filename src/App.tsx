import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { BuildingMap, type MapHandle } from "./components/BuildingMap";
import { BuildingCard, ErrorCard, HazardsCard, LegendCard, RouteCard, RouteChip, StartCard } from "./components/Panels";
import { cx } from "./lib/cx";
import { translate, type Lang, type Translate } from "./lib/i18n";
import { buildGraph, findRoute } from "./lib/router";
import type { Building, Hazards, LoadedBuilding, Mode, RouteResult, ValidationError } from "./lib/types";
import { validateBuilding } from "./lib/validate";

const LANG_KEY = "smart-escape:lang";

function readInitialLang(): Lang {
    const fromUrl = new URLSearchParams(window.location.search).get("lang");
    if (fromUrl === "bn" || fromUrl === "en") return fromUrl;
    try {
        return localStorage.getItem(LANG_KEY) === "bn" ? "bn" : "en";
    } catch {
        return "en";
    }
}

const hazardsFrom = (data: Building): Hazards => ({
    blockedNodes: new Set(data.initial_state.blocked_nodes),
    blockedEdges: new Set(data.initial_state.blocked_edges),
    closedExits: new Set(data.initial_state.closed_exits),
});

function toggled(set: ReadonlySet<string>, id: string) {
    const next = new Set(set);
    if (!next.delete(id)) next.add(id);
    return next;
}

/** ?start=R1&block=C2,e3&close=E1&mode=hazard — handy for demos and screenshots. */
function urlOverrides(data: Building, hazards: Hazards) {
    const params = new URLSearchParams(window.location.search);
    const list = (key: string) =>
        (params.get(key) ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    const typeOf = new Map(data.nodes.map((n) => [n.id, n.type]));
    const edgeIds = new Set(data.edges.map((e) => e.id));

    const blockedNodes = new Set(hazards.blockedNodes);
    const blockedEdges = new Set(hazards.blockedEdges);
    const closedExits = new Set(hazards.closedExits);
    for (const id of list("block")) {
        const type = typeOf.get(id);
        if (type && type !== "exit") blockedNodes.add(id);
        else if (edgeIds.has(id)) blockedEdges.add(id);
    }
    for (const id of list("close")) if (typeOf.get(id) === "exit") closedExits.add(id);

    const start = params.get("start");
    return {
        hazards: { blockedNodes, blockedEdges, closedExits },
        start: start && typeOf.has(start) && typeOf.get(start) !== "exit" ? start : null,
        mode: (params.get("mode") === "hazard" ? "hazard" : "start") as Mode,
    };
}

export default function App() {
    const [lang, setLang] = useState<Lang>(readInitialLang);
    const [building, setBuilding] = useState<LoadedBuilding | null>(null);
    const [hazards, setHazards] = useState<Hazards>({ blockedNodes: new Set(), blockedEdges: new Set(), closedExits: new Set() });
    const [start, setStart] = useState<string | null>(null);
    const [mode, setMode] = useState<Mode>("start");
    const [errors, setErrors] = useState<ValidationError[]>([]);
    const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
    const [dragging, setDragging] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const mapRef = useRef<MapHandle>(null);

    const t: Translate = useCallback((key, params) => translate(lang, key, params), [lang]);

    const route: RouteResult = useMemo(
        () => (building ? findRoute(building.graph, hazards, start) : { status: "idle" }),
        [building, hazards, start],
    );

    // ---------- toast ----------
    const showToast = useCallback((text: string) => setToast({ id: Date.now(), text }), []);
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 2600);
        return () => clearTimeout(timer);
    }, [toast]);

    // ---------- language ----------
    useEffect(() => {
        document.documentElement.lang = lang;
        document.title = `${translate(lang, "title")} — ${translate(lang, "subtitle")}`;
        try {
            localStorage.setItem(LANG_KEY, lang);
        } catch {
            /* storage unavailable (private mode) — language just won't persist */
        }
    }, [lang]);

    // ---------- loading ----------
    const loadFromText = useCallback(
        (text: string, source: string, { silent = false } = {}): Building | null => {
            let raw: unknown;
            try {
                raw = JSON.parse(text);
            } catch {
                setErrors([{ code: "notJson" }]);
                return null;
            }
            const result = validateBuilding(raw);
            if (!result.ok) {
                setErrors(result.errors);
                return null;
            }
            setBuilding((prev) => ({
                data: result.data,
                graph: buildGraph(result.data),
                source,
                loadId: (prev?.loadId ?? 0) + 1,
            }));
            setHazards(hazardsFrom(result.data));
            setStart(null);
            setMode("start");
            setErrors([]);
            if (!silent) showToast(translate(lang, "toastLoaded", { name: source }));
            return result.data;
        },
        [lang, showToast],
    );

    const fetchSample = useCallback(async () => {
        const res = await fetch(`${import.meta.env.BASE_URL}building.json`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
    }, []);

    const loadSample = useCallback(async () => {
        try {
            loadFromText(await fetchSample(), "building.json");
        } catch {
            setErrors([{ code: "sampleMissing" }]);
        }
    }, [fetchSample, loadFromText]);

    // Load the sample on first visit so the app is usable immediately.
    useEffect(() => {
        let cancelled = false;
        fetchSample()
            .then((text) => {
                if (cancelled) return;
                const data = loadFromText(text, "building.json", { silent: true });
                if (!data) return;
                const overrides = urlOverrides(data, hazardsFrom(data));
                setHazards(overrides.hazards);
                setStart(overrides.start);
                setMode(overrides.mode);
            })
            .catch(() => !cancelled && setErrors([{ code: "sampleMissing" }]));
        return () => {
            cancelled = true;
        };
        // Runs once on mount; later loads go through the buttons.
    }, []);

    const handleFile = useCallback(
        async (file: File | undefined) => {
            if (!file) return;
            try {
                loadFromText(await file.text(), file.name);
            } catch {
                setErrors([{ code: "fileRead" }]);
            }
        },
        [loadFromText],
    );

    // ---------- interactions ----------
    const handleStartChange = useCallback(
        (id: string | null) => {
            if (!building || id === null) return setStart(null);
            const node = building.graph.nodeById.get(id);
            if (!node) return;
            if (node.type === "exit") return showToast(t("cantStartExit"));
            if (hazards.blockedNodes.has(id)) return showToast(t("cantStartBlocked"));
            setStart(id);
        },
        [building, hazards, showToast, t],
    );

    const handleNodeActivate = useCallback(
        (id: string) => {
            if (!building) return;
            if (mode === "start") return handleStartChange(id);
            const node = building.graph.nodeById.get(id)!;
            setHazards((h) =>
                node.type === "exit"
                    ? { ...h, closedExits: toggled(h.closedExits, id) }
                    : { ...h, blockedNodes: toggled(h.blockedNodes, id) },
            );
        },
        [building, mode, handleStartChange],
    );

    const handleEdgeToggle = useCallback(
        (id: string) => {
            if (mode !== "hazard") return showToast(t("switchToHazard"));
            setHazards((h) => ({ ...h, blockedEdges: toggled(h.blockedEdges, id) }));
        },
        [mode, showToast, t],
    );

    const removeHazard = useCallback((kind: "node" | "edge" | "exit", id: string) => {
        setHazards((h) => {
            const key = kind === "node" ? "blockedNodes" : kind === "edge" ? "blockedEdges" : "closedExits";
            const next = new Set(h[key]);
            next.delete(id);
            return { ...h, [key]: next };
        });
    }, []);

    const reset = () => {
        if (!building) return;
        setHazards(hazardsFrom(building.data));
        showToast(t("toastReset"));
    };

    const exportPng = async () => {
        await mapRef.current?.exportPng();
        showToast(t("toastExported"));
    };

    const onDrop = (e: DragEvent) => {
        e.preventDefault();
        setDragging(false);
        void handleFile(e.dataTransfer.files[0]);
    };

    const buttonBase =
        "inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold shadow-sm transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 outline-none focus-visible:ring-4 focus-visible:ring-indigo-300";
    const buttonClass = cx(buttonBase, "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50");
    const primaryButtonClass = cx(buttonBase, "border-slate-900 bg-slate-900 text-white hover:bg-slate-700");
    const toolClass =
        "flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition outline-none focus-visible:ring-4 focus-visible:ring-indigo-300";

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900">
            <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
                <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
                    <div className="flex items-center gap-3">
                        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-10" />
                        <div>
                            <h1 className="text-lg leading-tight font-bold">{t("title")}</h1>
                            <p className="text-sm text-slate-500">{t("subtitle")}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" className={primaryButtonClass} onClick={() => fileInputRef.current?.click()}>
                            <span aria-hidden="true">⬆</span> {t("importBtn")}
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json,application/json"
                            className="hidden"
                            onChange={(e) => {
                                void handleFile(e.target.files?.[0]);
                                e.target.value = "";
                            }}
                        />
                        <button type="button" className={buttonClass} onClick={() => void loadSample()}>
                            {t("sampleBtn")}
                        </button>
                        <button
                            type="button"
                            className={cx(buttonClass, "min-w-24 justify-center")}
                            onClick={() => setLang((l) => (l === "en" ? "bn" : "en"))}
                            aria-label={t("langAria")}
                            lang={lang === "en" ? "bn" : "en"}
                        >
                            🌐 {t("langSwitch")}
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto grid max-w-[1500px] gap-5 p-4 sm:p-6 lg:grid-cols-[380px_minmax(0,1fr)]">
                <aside className="order-2 flex flex-col gap-4 lg:order-1">
                    <ErrorCard errors={errors} t={t} onDismiss={() => setErrors([])} />
                    {building && <BuildingCard building={building} t={t} />}
                    {building && <StartCard building={building} hazards={hazards} start={start} t={t} onChange={handleStartChange} />}
                    <RouteCard building={building} route={route} lang={lang} t={t} />
                    {building && <HazardsCard building={building} hazards={hazards} t={t} onRemove={removeHazard} />}
                    <LegendCard t={t} />
                    <p className="px-1 text-xs text-slate-500">{t("disclaimer")}</p>
                </aside>

                <section
                    className={cx(
                        "order-1 flex flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-24 lg:order-2 lg:h-[calc(100vh-7.5rem)]",
                        dragging && "ring-4 ring-orange-300",
                    )}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                >
                    <p className="flex items-start gap-2 px-1 pb-3 text-sm text-slate-500">
                        <span
                            aria-hidden="true"
                            className={cx(
                                "mt-px grid size-5 shrink-0 place-items-center rounded-full text-[11px]",
                                mode === "start" ? "bg-orange-100" : "bg-red-100",
                            )}
                        >
                            {mode === "start" ? "📍" : "⛔"}
                        </span>
                        {t(mode === "start" ? "hintStart" : "hintHazard")}
                    </p>

                    <div className="relative min-h-[460px] flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                        {building ? (
                            <>
                                <BuildingMap
                                    ref={mapRef}
                                    building={building}
                                    hazards={hazards}
                                    start={start}
                                    route={route}
                                    mode={mode}
                                    lang={lang}
                                    t={t}
                                    onNodeActivate={handleNodeActivate}
                                    onEdgeToggle={handleEdgeToggle}
                                />
                                <RouteChip route={route} start={start} lang={lang} t={t} />

                                {/* Floating tool palette (pattern from Higgsfield / Tana canvases on Mobbin). */}
                                <div className="absolute inset-x-0 bottom-4 z-10 mx-auto flex w-fit max-w-[calc(100%-6rem)] flex-wrap justify-center whitespace-nowrap items-center gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-lg backdrop-blur">
                                    <div role="group" aria-label={`${t("modeStart")} / ${t("modeHazard")}`} className="flex gap-1">
                                        {(["start", "hazard"] as const).map((m) => (
                                            <button
                                                key={m}
                                                type="button"
                                                aria-pressed={mode === m}
                                                onClick={() => setMode(m)}
                                                className={cx(
                                                    toolClass,
                                                    mode === m
                                                        ? m === "start"
                                                            ? "bg-orange-500 text-white shadow"
                                                            : "bg-red-600 text-white shadow"
                                                        : "text-slate-600 hover:bg-slate-100",
                                                )}
                                            >
                                                <span aria-hidden="true">{m === "start" ? "📍" : "⛔"}</span>
                                                {t(m === "start" ? "modeStart" : "modeHazard")}
                                            </button>
                                        ))}
                                    </div>
                                    <span aria-hidden="true" className="mx-1 h-6 w-px bg-slate-200" />
                                    <button type="button" onClick={reset} className={cx(toolClass, "text-slate-600 hover:bg-slate-100")}>
                                        <span aria-hidden="true">↺</span> {t("resetBtn")}
                                    </button>
                                    <button type="button" onClick={() => void exportPng()} className={cx(toolClass, "text-slate-600 hover:bg-slate-100")}>
                                        <span aria-hidden="true">⤓</span> {t("exportBtn")}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 grid place-items-center p-6 text-center">
                                <div className="max-w-sm">
                                    <p className="text-lg font-bold">{t("emptyTitle")}</p>
                                    <p className="mt-1 text-sm text-slate-500">{t("emptyBody")}</p>
                                    <div className="mt-4 flex justify-center gap-2">
                                        <button type="button" className={buttonClass} onClick={() => fileInputRef.current?.click()}>
                                            {t("importBtn")}
                                        </button>
                                        <button type="button" className={buttonClass} onClick={() => void loadSample()}>
                                            {t("sampleBtn")}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </main>

            <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
                {toast && (
                    <p key={toast.id} className="animate-fade-up rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
                        {toast.text}
                    </p>
                )}
            </div>
        </div>
    );
}
