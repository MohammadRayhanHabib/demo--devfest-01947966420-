import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { BuildingMap, type MapHandle } from "./components/BuildingMap";
import { Ban, Building2, ChevronDown, CircleCheck, Download, MapPin, Plus, RotateCcw, Upload, Zap } from "lucide-react";
import { Sidebar } from "./components/Panels";
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

    const isWide = useMediaQuery("(min-width: 1024px)");
    // Keep note cards clear of the top bar, zoom column and corner buttons.
    const fitPadding = isWide ? ({ top: "100px", right: "100px", bottom: "100px", left: "80px" } as const) : 0.12;
    const openFilePicker = () => fileInputRef.current?.click();

    const iconButton =
        "grid size-9 cursor-pointer place-items-center rounded-lg text-gray-600 transition outline-none hover:bg-gray-100 focus-visible:ring-4 focus-visible:ring-indigo-200";
    const modeButton =
        "flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold whitespace-nowrap transition outline-none focus-visible:ring-4 focus-visible:ring-indigo-200";

    return (
        <div className="min-h-dvh bg-[#eef0f3] text-gray-900 sm:p-4 lg:h-dvh lg:p-6">
            <div className="mx-auto flex min-h-dvh max-w-[1840px] flex-col overflow-hidden bg-white sm:min-h-[calc(100dvh-2rem)] sm:rounded-[28px] sm:shadow-[0_10px_40px_rgba(15,23,42,0.08)] lg:h-full lg:min-h-0 lg:flex-row">
                <Sidebar
                    building={building}
                    route={route}
                    start={start}
                    hazards={hazards}
                    errors={errors}
                    mode={mode}
                    lang={lang}
                    t={t}
                    onImport={openFilePicker}
                    onDismissErrors={() => setErrors([])}
                    onStartChange={handleStartChange}
                    onPlaceActivate={handleNodeActivate}
                    onRemoveHazard={removeHazard}
                />

                <section
                    className="relative order-first h-[70vh] min-h-[480px] flex-1 lg:order-none lg:h-auto lg:min-h-0"
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                >
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
                            onNodeActivate={handleNodeActivate}
                            onEdgeToggle={handleEdgeToggle}
                        />
                    ) : (
                        <div className="absolute inset-0 grid place-items-center p-6">
                            <div className="max-w-sm rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
                                <p className="text-3xl" aria-hidden="true">
                                    🏢
                                </p>
                                <p className="mt-2 font-semibold">{t("emptyTitle")}</p>
                                <p className="mt-1 text-sm text-gray-500">{t("emptyBody")}</p>
                            </div>
                        </div>
                    )}

                    {/* Top bar over the canvas. */}
                    <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex flex-wrap items-start justify-between gap-2">
                        <div className="pointer-events-auto flex min-w-0 items-center gap-2">
                            <button
                                type="button"
                                onClick={openFilePicker}
                                aria-label={t("importBtn")}
                                title={t("importBtn")}
                                className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl bg-gray-900 text-white shadow-sm outline-none hover:bg-gray-700 focus-visible:ring-4 focus-visible:ring-indigo-200"
                            >
                                <Building2 className="size-[18px]" />
                            </button>
                            <button
                                type="button"
                                onClick={openFilePicker}
                                title={t("switchBuilding")}
                                className="flex h-10 min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold shadow-sm outline-none hover:bg-gray-50 focus-visible:ring-4 focus-visible:ring-indigo-200"
                            >
                                <span aria-hidden="true">🏢</span>
                                <span className="truncate">{building?.data.building ?? t("emptyTitle")}</span>
                                <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-gray-400" />
                            </button>
                        </div>

                        <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-0.5 shadow-sm">
                            <div role="group" aria-label={`${t("modeStart")} / ${t("modeHazard")}`} className="flex gap-0.5">
                                <button
                                    type="button"
                                    aria-pressed={mode === "start"}
                                    onClick={() => setMode("start")}
                                    className={cx(modeButton, mode === "start" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100")}
                                >
                                    <MapPin aria-hidden="true" className="size-4" />
                                    <span className="hidden md:inline">{t("modeStart")}</span>
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={mode === "hazard"}
                                    onClick={() => setMode("hazard")}
                                    className={cx(modeButton, mode === "hazard" ? "bg-rose-600 text-white" : "text-gray-600 hover:bg-gray-100")}
                                >
                                    <Ban aria-hidden="true" className="size-4" />
                                    <span className="hidden md:inline">{t("modeHazard")}</span>
                                </button>
                            </div>
                            <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-gray-200" />
                            <div role="group" aria-label="Language / ভাষা" className="flex gap-0.5">
                                {(["en", "bn"] as const).map((l) => (
                                    <button
                                        key={l}
                                        type="button"
                                        lang={l}
                                        aria-pressed={lang === l}
                                        onClick={() => setLang(l)}
                                        className={cx(modeButton, lang === l ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:bg-gray-50")}
                                    >
                                        {l === "en" ? "EN" : "বাংলা"}
                                    </button>
                                ))}
                            </div>
                            <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-gray-200" />
                            <button type="button" onClick={reset} disabled={!building} aria-label={t("resetBtn")} title={t("resetBtn")} className={iconButton}>
                                <RotateCcw className="size-4" />
                            </button>
                            <button type="button" onClick={() => void exportPng()} disabled={!building} aria-label={t("exportBtn")} title={t("exportBtn")} className={iconButton}>
                                <Download className="size-4" />
                            </button>
                        </div>
                    </div>

                    {/* Corner actions: ⚡ load sample (bottom-left), + import (bottom-right). */}
                    <button
                        type="button"
                        onClick={() => void loadSample()}
                        aria-label={t("sampleBtn")}
                        title={t("sampleBtn")}
                        className="absolute bottom-4 left-4 z-10 grid size-10 cursor-pointer place-items-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm outline-none hover:bg-gray-50 focus-visible:ring-4 focus-visible:ring-indigo-200"
                    >
                        <Zap className="size-[18px]" />
                    </button>
                    <button
                        type="button"
                        onClick={openFilePicker}
                        aria-label={t("importBtn")}
                        title={t("importBtn")}
                        className="absolute right-4 bottom-4 z-10 grid size-11 cursor-pointer place-items-center rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 outline-none hover:bg-indigo-600 focus-visible:ring-4 focus-visible:ring-indigo-200"
                    >
                        <Plus className="size-5" />
                    </button>

                    {dragging && (
                        <div className="pointer-events-none absolute inset-3 z-30 grid place-items-center rounded-2xl border-2 border-dashed border-indigo-400 bg-indigo-50/60">
                            <p className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 font-semibold text-indigo-700 shadow-sm">
                                <Upload aria-hidden="true" className="size-4" /> {t("importBtn")}
                            </p>
                        </div>
                    )}
                </section>
            </div>

            <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-8 z-40 flex justify-center px-4">
                {toast && (
                    <p key={toast.id} className="animate-fade-up flex items-center gap-2 rounded-lg bg-gray-900 px-3.5 py-2 text-sm font-medium text-white shadow-lg">
                        <CircleCheck aria-hidden="true" className="size-4 text-emerald-400" />
                        {toast.text}
                    </p>
                )}
            </div>
        </div>
    );
}

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
