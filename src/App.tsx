import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { BuildingMap, type MapHandle } from "./components/BuildingMap";
import { Ban, CircleCheck, Download, FileJson, MapPin, RotateCcw, Upload } from "lucide-react";
import { ControlPanel, MapLegend } from "./components/Panels";
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
    // Keep nodes clear of the floating panel (left), legend (top) and toolbar (bottom).
    const fitPadding = isWide ? ({ top: "120px", right: "70px", bottom: "150px", left: "490px" } as const) : 0.15;

    const button =
        "inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition outline-none active:translate-y-px focus-visible:ring-4 focus-visible:ring-indigo-200";
    const tool =
        "flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition outline-none focus-visible:ring-4 focus-visible:ring-indigo-200";

    return (
        <div className="flex min-h-dvh flex-col bg-slate-100 text-slate-900 lg:h-dvh lg:overflow-hidden">
            {/* Top bar: brand + breadcrumb (pattern from OpenAI Platform on Mobbin). */}
            <header className="relative z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                    <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-9 shrink-0" />
                    <div className="min-w-0 leading-tight">
                        <h1 className="flex min-w-0 items-center gap-2 text-[15px] font-bold text-slate-900">
                            {t("title")}
                            {building && (
                                <>
                                    <span aria-hidden="true" className="hidden text-slate-300 sm:inline">
                                        /
                                    </span>
                                    <span className="hidden truncate font-medium text-slate-600 sm:inline">{building.data.building}</span>
                                </>
                            )}
                        </h1>
                        <p className="truncate text-xs text-slate-500">{t("subtitle")}</p>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <button
                        type="button"
                        className={cx(button, "border-slate-900 bg-slate-900 text-white hover:bg-slate-700")}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload aria-hidden="true" className="size-4" />
                        <span className="hidden sm:inline">{t("importBtn")}</span>
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
                    <button type="button" className={cx(button, "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")} onClick={() => void loadSample()}>
                        <FileJson aria-hidden="true" className="size-4" />
                        <span className="hidden sm:inline">{t("sampleBtn")}</span>
                    </button>
                    <div role="group" aria-label="Language / ভাষা" className="flex rounded-xl bg-slate-100 p-1">
                        {(["en", "bn"] as const).map((l) => (
                            <button
                                key={l}
                                type="button"
                                lang={l}
                                aria-pressed={lang === l}
                                onClick={() => setLang(l)}
                                className={cx(
                                    "cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold transition outline-none focus-visible:ring-4 focus-visible:ring-indigo-200",
                                    lang === l ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
                                )}
                            >
                                {l === "en" ? "EN" : "বাংলা"}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {/* Full-bleed map with floating panels (pattern from komoot / Felt on Mobbin). */}
            <main
                className="relative flex flex-1 flex-col lg:block lg:min-h-0"
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
            >
                <div className="relative h-[64vh] min-h-[440px] bg-slate-50 lg:absolute lg:inset-0 lg:h-auto">
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
                                fitPadding={fitPadding}
                                onNodeActivate={handleNodeActivate}
                                onEdgeToggle={handleEdgeToggle}
                            />

                            <div className="absolute top-4 right-4 z-10 hidden md:block">
                                <MapLegend t={t} />
                            </div>

                            {/* Floating tool palette (pattern from Higgsfield / Tana on Mobbin). */}
                            <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex flex-col items-center gap-2 px-4 lg:left-[456px] xl:left-[476px]">
                                <p
                                    key={mode}
                                    className="animate-fade-up max-w-xl rounded-full bg-slate-900/85 px-3.5 py-1.5 text-center text-xs font-medium text-white shadow backdrop-blur"
                                >
                                    {t(mode === "start" ? "hintStart" : "hintHazard")}
                                </p>
                                <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur">
                                    <div role="group" aria-label={`${t("modeStart")} / ${t("modeHazard")}`} className="flex gap-1">
                                        <button
                                            type="button"
                                            aria-pressed={mode === "start"}
                                            onClick={() => setMode("start")}
                                            className={cx(tool, mode === "start" ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:bg-slate-100")}
                                        >
                                            <MapPin aria-hidden="true" className="size-4" /> {t("modeStart")}
                                        </button>
                                        <button
                                            type="button"
                                            aria-pressed={mode === "hazard"}
                                            onClick={() => setMode("hazard")}
                                            className={cx(tool, mode === "hazard" ? "bg-rose-600 text-white shadow" : "text-slate-600 hover:bg-slate-100")}
                                        >
                                            <Ban aria-hidden="true" className="size-4" /> {t("modeHazard")}
                                        </button>
                                    </div>
                                    <span aria-hidden="true" className="mx-1 h-6 w-px bg-slate-200" />
                                    <button type="button" onClick={reset} className={cx(tool, "text-slate-600 hover:bg-slate-100")}>
                                        <RotateCcw aria-hidden="true" className="size-4" /> {t("resetBtn")}
                                    </button>
                                    <button type="button" onClick={() => void exportPng()} className={cx(tool, "text-slate-600 hover:bg-slate-100")}>
                                        <Download aria-hidden="true" className="size-4" /> {t("exportBtn")}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="absolute inset-0 grid place-items-center p-6 lg:pl-[476px]">
                            <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg">
                                <span className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                                    <FileJson aria-hidden="true" className="size-6" />
                                </span>
                                <p className="mt-3 text-lg font-bold">{t("emptyTitle")}</p>
                                <p className="mt-1 text-sm text-slate-500">{t("emptyBody")}</p>
                                <div className="mt-4 flex justify-center gap-2">
                                    <button
                                        type="button"
                                        className={cx(button, "border-slate-900 bg-slate-900 text-white hover:bg-slate-700")}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Upload aria-hidden="true" className="size-4" /> {t("importBtn")}
                                    </button>
                                    <button type="button" className={cx(button, "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")} onClick={() => void loadSample()}>
                                        {t("sampleBtn")}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {dragging && (
                        <div className="pointer-events-none absolute inset-3 z-30 grid place-items-center rounded-2xl border-4 border-dashed border-emerald-400 bg-emerald-50/70">
                            <p className="flex items-center gap-2 rounded-full bg-white px-4 py-2 font-semibold text-emerald-700 shadow">
                                <Upload aria-hidden="true" className="size-4" /> {t("importBtn")}
                            </p>
                        </div>
                    )}
                </div>

                <div className="relative z-20 p-4 lg:absolute lg:inset-y-4 lg:left-4 lg:flex lg:w-[420px] lg:p-0 xl:w-[440px]">
                    <ControlPanel
                        building={building}
                        route={route}
                        start={start}
                        hazards={hazards}
                        errors={errors}
                        lang={lang}
                        t={t}
                        onDismissErrors={() => setErrors([])}
                        onStartChange={handleStartChange}
                        onRemoveHazard={removeHazard}
                    />
                </div>
            </main>

            <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center px-4">
                {toast && (
                    <p key={toast.id} className="animate-fade-up flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
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
