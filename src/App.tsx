import { Ban, CircleCheck, Crosshair, Download, FileJson, Layers, MousePointer2, Redo2, RotateCcw, Undo2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { BuildingMap, type MapHandle } from "./components/BuildingMap";
import { Inspector } from "./components/Panels";
import { cx } from "./lib/cx";
import { localizeDigits, translate, type Lang, type Translate } from "./lib/i18n";
import { buildGraph, findRoute } from "./lib/router";
import type { Building, Hazards, LoadedBuilding, Mode, RouteResult, ValidationError } from "./lib/types";
import { validateBuilding } from "./lib/validate";

const LANG_KEY = "smart-escape:lang";
const HISTORY_LIMIT = 100;

function readInitialLang(): Lang {
    const fromUrl = new URLSearchParams(window.location.search).get("lang");
    if (fromUrl === "bn" || fromUrl === "en") return fromUrl;
    try {
        return localStorage.getItem(LANG_KEY) === "bn" ? "bn" : "en";
    } catch {
        return "en";
    }
}

const emptyHazards = (): Hazards => ({ blockedNodes: new Set(), blockedEdges: new Set(), closedExits: new Set() });

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
        tab: (params.get("tab") === "layers" ? "layers" : "route") as "route" | "layers",
    };
}

type History = { past: Hazards[]; present: Hazards; future: Hazards[] };

function useMediaQuery(query: string) {
    const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
    useEffect(() => {
        const media = window.matchMedia(query);
        const update = () => setMatches(media.matches);
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, [query]);
    return matches;
}

export default function App() {
    const [lang, setLang] = useState<Lang>(readInitialLang);
    const [building, setBuilding] = useState<LoadedBuilding | null>(null);
    const [history, setHistory] = useState<History>({ past: [], present: emptyHazards(), future: [] });
    const [start, setStart] = useState<string | null>(null);
    const [mode, setMode] = useState<Mode>("start");
    const [tab, setTab] = useState<"route" | "layers">("route");
    const [errors, setErrors] = useState<ValidationError[]>([]);
    const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
    const [dragging, setDragging] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const mapRef = useRef<MapHandle>(null);
    const hazards = history.present;

    const t: Translate = useCallback((key, params) => translate(lang, key, params), [lang]);

    const route: RouteResult = useMemo(
        () => (building ? findRoute(building.graph, hazards, start) : { status: "idle" }),
        [building, hazards, start],
    );

    // ---------- hazard history (undo / redo) ----------
    const commitHazards = useCallback((update: (h: Hazards) => Hazards) => {
        setHistory((h) => {
            const next = update(h.present);
            if (next === h.present) return h;
            return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: next, future: [] };
        });
    }, []);
    const replaceHazards = useCallback((present: Hazards) => setHistory({ past: [], present, future: [] }), []);
    const undo = useCallback(() => {
        setHistory((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h));
    }, []);
    const redo = useCallback(() => {
        setHistory((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h));
    }, []);

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
            setBuilding((prev) => ({ data: result.data, graph: buildGraph(result.data), source, loadId: (prev?.loadId ?? 0) + 1 }));
            replaceHazards(hazardsFrom(result.data));
            setStart(null);
            setMode("start");
            setErrors([]);
            if (!silent) showToast(translate(lang, "toastLoaded", { name: source }));
            return result.data;
        },
        [lang, replaceHazards, showToast],
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
                replaceHazards(overrides.hazards);
                setStart(overrides.start);
                setMode(overrides.mode);
                setTab(overrides.tab);
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
            const node = building.graph.nodeById.get(id)!;
            // Exits can never be a start, so they close/reopen in either mode.
            if (node.type === "exit") return commitHazards((h) => ({ ...h, closedExits: toggled(h.closedExits, id) }));
            if (mode === "start") return handleStartChange(id);
            commitHazards((h) => ({ ...h, blockedNodes: toggled(h.blockedNodes, id) }));
        },
        [building, mode, handleStartChange, commitHazards],
    );

    const handleEdgeToggle = useCallback(
        (id: string) => {
            // Corridors can never be a start, so they block/unblock in either mode.
            commitHazards((h) => ({ ...h, blockedEdges: toggled(h.blockedEdges, id) }));
        },
        [commitHazards],
    );

    const removeHazard = useCallback(
        (kind: "node" | "edge" | "exit", id: string) => {
            const key = kind === "node" ? "blockedNodes" : kind === "edge" ? "blockedEdges" : "closedExits";
            commitHazards((h) => {
                const next = new Set(h[key]);
                next.delete(id);
                return { ...h, [key]: next };
            });
        },
        [commitHazards],
    );

    const reset = () => {
        if (!building) return;
        commitHazards(() => hazardsFrom(building.data));
        showToast(t("toastReset"));
    };

    const exportPng = async () => {
        await mapRef.current?.exportPng();
        showToast(t("toastExported"));
    };

    // Ctrl/⌘+Z undo, Ctrl/⌘+Shift+Z or Ctrl+Y redo (ignored while typing in a field).
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            const target = e.target as HTMLElement | null;
            if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
            const key = e.key.toLowerCase();
            if (key === "z" && !e.shiftKey) {
                e.preventDefault();
                undo();
            } else if ((key === "z" && e.shiftKey) || key === "y") {
                e.preventDefault();
                redo();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [undo, redo]);

    const onDrop = (e: DragEvent) => {
        e.preventDefault();
        setDragging(false);
        void handleFile(e.dataTransfer.files[0]);
    };

    const isWide = useMediaQuery("(min-width: 1024px)");
    // Keep cards clear of the tool rail (left), pill (bottom) and corner controls.
    const fitPadding = isWide
        ? ({ top: "70px", right: "70px", bottom: "120px", left: "110px" } as const)
        : ({ top: "76px", right: "16px", bottom: "120px", left: "16px" } as const);
    const openFilePicker = () => fileInputRef.current?.click();
    const failed = route.status === "no-route" || route.status === "start-blocked";

    const railButton = (active: boolean) =>
        cx(
            "relative grid size-10 cursor-pointer place-items-center rounded-xl transition-colors outline-none focus-visible:ring-4 focus-visible:ring-brand-200",
            active ? "bg-brand-50 text-brand-700" : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900",
        );
    const pillButton =
        "grid size-10 cursor-pointer place-items-center rounded-xl text-neutral-600 transition-colors outline-none hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent focus-visible:ring-4 focus-visible:ring-brand-200";
    const floating = "border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(10,10,10,0.06)]";

    return (
        <div className="flex min-h-dvh flex-col bg-white text-neutral-900 lg:h-dvh lg:overflow-hidden">
            {/* Top bar */}
            <header className="relative z-30 flex h-14 min-w-0 shrink-0 items-center justify-between gap-2 border-b border-neutral-200 bg-white px-3 sm:gap-3 sm:px-4">
                <div className="flex min-w-0 items-center gap-3">
                    <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-8 shrink-0" />
                    <span className="text-[15px] font-semibold tracking-[-0.01em] whitespace-nowrap">{t("title")}</span>
                    {building && (
                        <>
                            <span aria-hidden="true" className="hidden h-5 w-px bg-neutral-200 sm:block" />
                            <button
                                type="button"
                                onClick={openFilePicker}
                                title={t("switchBuilding")}
                                className="hidden min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-[13px] text-neutral-600 transition-colors outline-none hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-brand-500 sm:flex"
                            >
                                <FileJson aria-hidden="true" className="size-4 shrink-0 text-neutral-400" />
                                <span className="truncate font-medium text-neutral-800">{building.data.building}</span>
                                <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] text-neutral-500">{building.source}</span>
                            </button>
                        </>
                    )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    {building && (
                        <span
                            key={route.status + (route.status === "ok" ? route.cost : "")}
                            className={cx(
                                "animate-fade-up hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium md:inline-flex",
                                route.status === "ok" ? "bg-brand-50 text-brand-700" : failed ? "bg-rose-50 text-rose-700" : "bg-neutral-100 text-neutral-600",
                            )}
                        >
                            <span aria-hidden="true" className={cx("size-1.5 rounded-full", route.status === "ok" ? "bg-brand-600" : failed ? "bg-rose-500" : "bg-neutral-400")} />
                            {route.status === "ok" ? (
                                <>
                                    <span className="font-mono">
                                        {route.path[0]} → {route.exit}
                                    </span>
                                    <span className="font-mono font-semibold">Σ {localizeDigits(route.cost, lang)}</span>
                                </>
                            ) : route.status === "idle" ? (
                                t("waitingStart")
                            ) : (
                                t(route.status === "no-route" ? "noRoute" : "startBlocked")
                            )}
                        </span>
                    )}
                    <div role="group" aria-label="Language / ভাষা" className="flex rounded-lg bg-neutral-100 p-0.5">
                        {(["en", "bn"] as const).map((l) => (
                            <button
                                key={l}
                                type="button"
                                lang={l}
                                aria-pressed={lang === l}
                                onClick={() => setLang(l)}
                                className={cx(
                                    "cursor-pointer rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                                    lang === l ? "bg-white text-neutral-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "text-neutral-500 hover:text-neutral-800",
                                )}
                            >
                                {l === "en" ? "EN" : "বাংলা"}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => void loadSample()}
                        className="hidden h-8 cursor-pointer items-center rounded-lg px-3 text-[13px] font-medium text-neutral-600 transition-colors outline-none hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-brand-500 sm:inline-flex"
                    >
                        {t("sampleBtn")}
                    </button>
                    <button
                        type="button"
                        onClick={openFilePicker}
                        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(10,10,10,0.3)] transition-colors outline-none hover:bg-brand-700 focus-visible:ring-4 focus-visible:ring-brand-200"
                    >
                        <Upload aria-hidden="true" className="size-3.5" />
                        <span className="sr-only sm:not-sr-only">{t("importBtn")}</span>
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
                </div>
            </header>

            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                {/* Canvas */}
                <main
                    className="relative h-[68vh] min-h-[460px] bg-canvas lg:h-auto lg:min-h-0 lg:flex-1"
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                >
                    {building ? (
                        <BuildingMap
                            ref={mapRef}
                            building={building}
                            hazards={hazards}
                            start={start}
                            route={route}
                            mode={mode}
                            lang={lang}
                            t={t}
                            fitPadding={fitPadding}
                            compact={!isWide}
                            onNodeActivate={handleNodeActivate}
                            onEdgeToggle={handleEdgeToggle}
                        />
                    ) : (
                        <div className="absolute inset-0 grid place-items-center p-6">
                            <div className={cx("max-w-sm rounded-2xl p-6 text-center", floating)}>
                                <span className="mx-auto grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                                    <FileJson aria-hidden="true" className="size-5" />
                                </span>
                                <p className="mt-3 font-semibold">{t("emptyTitle")}</p>
                                <p className="mt-1 text-[13px] text-neutral-500">{t("emptyBody")}</p>
                            </div>
                        </div>
                    )}

                    {/* Tool rail */}
                    <nav aria-label={t("toolsLabel")} className={cx("absolute top-3 left-3 z-10 flex gap-1 rounded-2xl p-1.5 lg:top-1/2 lg:left-4 lg:-translate-y-1/2 lg:flex-col", floating)}>
                        <button type="button" aria-pressed={mode === "start"} aria-label={t("modeStart")} title={t("modeStart")} onClick={() => setMode("start")} className={railButton(mode === "start")}>
                            <MousePointer2 aria-hidden="true" className="size-[18px]" />
                        </button>
                        <button
                            type="button"
                            aria-pressed={mode === "hazard"}
                            aria-label={t("modeHazard")}
                            title={t("modeHazard")}
                            onClick={() => setMode("hazard")}
                            className={cx(railButton(mode === "hazard"), mode === "hazard" && "bg-rose-50 text-rose-600")}
                        >
                            <Ban aria-hidden="true" className="size-[18px]" />
                        </button>
                        <span aria-hidden="true" className="my-2 w-px bg-neutral-100 lg:mx-2 lg:my-1 lg:h-px lg:w-auto" />
                        <button type="button" aria-pressed={tab === "layers"} aria-label={t("tabLayers")} title={t("tabLayers")} onClick={() => setTab((v) => (v === "layers" ? "route" : "layers"))} className={railButton(tab === "layers")}>
                            <Layers aria-hidden="true" className="size-[18px]" />
                        </button>
                    </nav>

                    {/* Mode banner: always says which mode is on; hazard mode also frames the canvas in rose. */}
                    {building && mode === "hazard" && (
                        <div aria-hidden="true" className="animate-fade-up pointer-events-none absolute inset-0 z-[5] border-2 border-rose-400" />
                    )}
                    {building && (
                        <div className="pointer-events-none absolute inset-x-0 bottom-[84px] z-10 flex justify-center px-4 lg:top-4 lg:bottom-auto">
                            <div
                                key={mode}
                                role="status"
                                className={cx(
                                    "animate-fade-up pointer-events-auto flex max-w-full items-center gap-2.5 rounded-xl py-1.5 pr-1.5 pl-3 text-[13px] ring-1",
                                    mode === "hazard"
                                        ? "bg-rose-600 text-white ring-rose-600 shadow-[0_6px_16px_-8px_rgba(225,29,72,0.7)]"
                                        : "bg-white text-neutral-700 ring-neutral-200 shadow-[0_1px_2px_rgba(10,10,10,0.06)]",
                                )}
                            >
                                {mode === "hazard" ? (
                                    <Ban aria-hidden="true" className="size-4 shrink-0" />
                                ) : (
                                    <MousePointer2 aria-hidden="true" className="size-4 shrink-0" />
                                )}
                                <span className="min-w-0 leading-snug">
                                    <strong className="font-semibold">{t(mode === "start" ? "modeStart" : "modeHazard")}</strong>
                                    <span className={cx(mode === "hazard" ? "text-rose-50" : "text-neutral-500")}>
                                        {" · "}
                                        {t(mode === "start" ? "hintStart" : "hintHazard")}
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setMode(mode === "hazard" ? "start" : "hazard")}
                                    className={cx(
                                        "shrink-0 cursor-pointer rounded-lg px-2.5 py-1 text-[13px] font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white",
                                        mode === "hazard" ? "bg-white text-rose-700 hover:bg-rose-50" : "bg-neutral-950 text-white hover:bg-neutral-800",
                                    )}
                                >
                                    {mode === "hazard" ? t("doneBtn") : t("modeHazard")}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Control pill */}
                    {building && (
                        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex flex-col items-center gap-2 px-4">
                            <div className={cx("pointer-events-auto flex items-center gap-1 rounded-2xl p-1.5", floating)}>
                                <button
                                    type="button"
                                    onClick={() => mapRef.current?.focusRoute()}
                                    disabled={route.status !== "ok"}
                                    aria-label={t("focusRoute")}
                                    title={t("focusRoute")}
                                    className="grid size-10 cursor-pointer place-items-center rounded-xl bg-brand-600 text-white shadow-[0_2px_8px_-2px_rgba(10,10,10,0.5)] transition-colors outline-none hover:bg-brand-700 focus-visible:ring-4 focus-visible:ring-brand-200 disabled:cursor-not-allowed disabled:bg-brand-200 disabled:shadow-none"
                                >
                                    <Crosshair aria-hidden="true" className="size-[18px]" />
                                </button>
                                <button type="button" onClick={reset} aria-label={t("resetBtn")} title={t("resetBtn")} className={pillButton}>
                                    <RotateCcw aria-hidden="true" className="size-[18px]" />
                                </button>
                                <span aria-hidden="true" className="mx-1 h-6 w-px bg-neutral-200" />
                                <button type="button" onClick={undo} disabled={history.past.length === 0} aria-label={t("undo")} title={`${t("undo")} (Ctrl+Z)`} className={pillButton}>
                                    <Undo2 aria-hidden="true" className="size-[18px]" />
                                </button>
                                <button type="button" onClick={redo} disabled={history.future.length === 0} aria-label={t("redo")} title={`${t("redo")} (Ctrl+Shift+Z)`} className={pillButton}>
                                    <Redo2 aria-hidden="true" className="size-[18px]" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Export */}
                    {building && (
                        <button
                            type="button"
                            onClick={() => void exportPng()}
                            aria-label={t("exportBtn")}
                            title={t("exportBtn")}
                            className={cx(
                                "absolute right-4 bottom-4 z-10 grid size-10 cursor-pointer place-items-center rounded-xl text-neutral-600 transition-colors outline-none hover:text-neutral-900 focus-visible:ring-4 focus-visible:ring-brand-200",
                                floating,
                            )}
                        >
                            <Download aria-hidden="true" className="size-[18px]" />
                        </button>
                    )}

                    {dragging && (
                        <div className="pointer-events-none absolute inset-3 z-30 grid place-items-center rounded-2xl border-2 border-dashed border-brand-500 bg-brand-50/70">
                            <p className={cx("flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium text-brand-700", floating)}>
                                <Upload aria-hidden="true" className="size-4" /> {t("importBtn")}
                            </p>
                        </div>
                    )}
                </main>

                <Inspector
                    building={building}
                    route={route}
                    start={start}
                    hazards={hazards}
                    errors={errors}
                    lang={lang}
                    t={t}
                    tab={tab}
                    onTabChange={setTab}
                    onDismissErrors={() => setErrors([])}
                    onStartChange={handleStartChange}
                    onPlaceActivate={handleNodeActivate}
                    onCorridorActivate={handleEdgeToggle}
                    onRemoveHazard={removeHazard}
                />
            </div>

            <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center px-4">
                {toast && (
                    <p key={toast.id} className="animate-fade-up flex items-center gap-2 rounded-xl bg-neutral-900 px-3.5 py-2 text-[13px] font-medium text-white shadow-[0_8px_24px_-8px_rgba(15,23,42,0.45)]">
                        <CircleCheck aria-hidden="true" className="size-4 text-emerald-400" />
                        {toast.text}
                    </p>
                )}
            </div>
        </div>
    );
}
