import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { BuildingMap, type MapHandle } from "./components/BuildingMap";
import { Ban, Building2, CircleCheck, Download, FileJson, GitBranch, MapPin, RotateCcw, Sigma, TriangleAlert, Upload } from "lucide-react";
import { Sidebar } from "./components/Panels";
import { cx } from "./lib/cx";
import { localizeDigits, translate, type Lang, type Translate } from "./lib/i18n";
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
    // Keep node cards clear of the chip row (top) and the tool palette (bottom).
    const fitPadding = isWide ? ({ top: "110px", right: "60px", bottom: "150px", left: "60px" } as const) : 0.12;
    const openFilePicker = () => fileInputRef.current?.click();

    const button =
        "inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium transition outline-none active:translate-y-px focus-visible:ring-4 focus-visible:ring-indigo-200";
    const tool =
        "flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium whitespace-nowrap transition outline-none focus-visible:ring-4 focus-visible:ring-indigo-200";
    const crumbIcon = "grid size-7 shrink-0 place-items-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-600";
    const chip = "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-sm";

    return (
        <div className="min-h-dvh bg-zinc-100 text-zinc-900 sm:p-3 lg:h-dvh lg:p-4">
            <div className="flex min-h-dvh flex-col overflow-hidden bg-white sm:min-h-[calc(100dvh-1.5rem)] sm:rounded-[26px] sm:border sm:border-zinc-200 sm:shadow-sm lg:h-full lg:min-h-0 lg:flex-row">
                <Sidebar
                    building={building}
                    route={route}
                    start={start}
                    hazards={hazards}
                    errors={errors}
                    lang={lang}
                    t={t}
                    onImport={openFilePicker}
                    onDismissErrors={() => setErrors([])}
                    onStartChange={handleStartChange}
                    onRemoveHazard={removeHazard}
                />

                <section className="order-first flex min-h-0 flex-1 flex-col lg:order-none">
                    {/* Breadcrumb header (Projects / dashboard / Network pattern). */}
                    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4">
                        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2.5 text-[15px]">
                            <span aria-hidden="true" className={crumbIcon}>
                                <Building2 className="size-4" />
                            </span>
                            <span className="hidden text-zinc-500 sm:inline">{t("breadcrumbRoot")}</span>
                            {building && (
                                <>
                                    <span aria-hidden="true" className="hidden text-zinc-300 sm:inline">
                                        /
                                    </span>
                                    <span aria-hidden="true" className={cx(crumbIcon, "hidden md:grid")}>
                                        <FileJson className="size-4" />
                                    </span>
                                    <span className="hidden truncate text-zinc-500 md:inline">{building.data.building}</span>
                                </>
                            )}
                            <span aria-hidden="true" className="text-zinc-300">
                                /
                            </span>
                            <h1 className="truncate font-medium text-zinc-900">{t("breadcrumbPage")}</h1>
                        </nav>

                        <div className="flex shrink-0 items-center gap-2">
                            <button type="button" className={cx(button, "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700")} onClick={openFilePicker}>
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
                            <button type="button" className={cx(button, "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50")} onClick={() => void loadSample()}>
                                <FileJson aria-hidden="true" className="size-4" />
                                <span className="hidden sm:inline">{t("sampleBtn")}</span>
                            </button>
                            <div role="group" aria-label="Language / ভাষা" className="flex rounded-xl border border-zinc-200 bg-zinc-50 p-0.5">
                                {(["en", "bn"] as const).map((l) => (
                                    <button
                                        key={l}
                                        type="button"
                                        lang={l}
                                        aria-pressed={lang === l}
                                        onClick={() => setLang(l)}
                                        className={cx(
                                            "cursor-pointer rounded-lg px-2.5 py-1 text-sm font-medium transition outline-none focus-visible:ring-4 focus-visible:ring-indigo-200",
                                            lang === l ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800",
                                        )}
                                    >
                                        {l === "en" ? "EN" : "বাংলা"}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </header>

                    <div
                        className="relative h-[62vh] min-h-[440px] bg-[#fafafa] lg:h-auto lg:min-h-0 lg:flex-1"
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={onDrop}
                    >
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

                                {/* Context chips (source · route · cost), like "v_alpha001 · main · e5f6a7b". */}
                                <div className="absolute top-4 left-4 z-10 flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1 shadow-sm">
                                    <span className={cx(chip, "text-zinc-900")}>
                                        <span className="relative">
                                            <FileJson aria-hidden="true" className="size-4 text-zinc-600" />
                                            <span aria-hidden="true" className="absolute -top-0.5 -left-0.5 size-1.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                                        </span>
                                        {building.source}
                                    </span>
                                    {route.status === "ok" && (
                                        <>
                                            <span key={route.path.join(">")} className={cx(chip, "animate-fade-up bg-zinc-50 text-zinc-500")}>
                                                <GitBranch aria-hidden="true" className="size-4" />
                                                {route.path[0]} → {route.exit}
                                            </span>
                                            <span className={cx(chip, "bg-zinc-50 text-zinc-500")}>
                                                <Sigma aria-hidden="true" className="size-4" />
                                                {localizeDigits(route.cost, lang)}
                                            </span>
                                        </>
                                    )}
                                    {(route.status === "no-route" || route.status === "start-blocked") && (
                                        <span className={cx(chip, "animate-fade-up bg-rose-50 font-sans text-rose-700")}>
                                            <TriangleAlert aria-hidden="true" className="size-4" />
                                            {t(route.status === "no-route" ? "noRoute" : "startBlocked")}
                                        </span>
                                    )}
                                </div>

                                {/* Floating tool palette. */}
                                <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex flex-col items-center gap-2 px-4">
                                    <p key={mode} className="animate-fade-up max-w-xl rounded-full bg-zinc-900/85 px-3.5 py-1.5 text-center text-xs font-medium text-white shadow backdrop-blur">
                                        {t(mode === "start" ? "hintStart" : "hintHazard")}
                                    </p>
                                    <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1 rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-lg shadow-zinc-900/5">
                                        <div role="group" aria-label={`${t("modeStart")} / ${t("modeHazard")}`} className="flex gap-1">
                                            <button
                                                type="button"
                                                aria-pressed={mode === "start"}
                                                onClick={() => setMode("start")}
                                                className={cx(tool, mode === "start" ? "bg-zinc-900 text-white shadow" : "text-zinc-600 hover:bg-zinc-100")}
                                            >
                                                <MapPin aria-hidden="true" className="size-4" /> {t("modeStart")}
                                            </button>
                                            <button
                                                type="button"
                                                aria-pressed={mode === "hazard"}
                                                onClick={() => setMode("hazard")}
                                                className={cx(tool, mode === "hazard" ? "bg-rose-600 text-white shadow" : "text-zinc-600 hover:bg-zinc-100")}
                                            >
                                                <Ban aria-hidden="true" className="size-4" /> {t("modeHazard")}
                                            </button>
                                        </div>
                                        <span aria-hidden="true" className="mx-1 h-6 w-px bg-zinc-200" />
                                        <button type="button" onClick={reset} className={cx(tool, "text-zinc-600 hover:bg-zinc-100")}>
                                            <RotateCcw aria-hidden="true" className="size-4" /> {t("resetBtn")}
                                        </button>
                                        <button type="button" onClick={() => void exportPng()} className={cx(tool, "text-zinc-600 hover:bg-zinc-100")}>
                                            <Download aria-hidden="true" className="size-4" /> {t("exportBtn")}
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 grid place-items-center p-6">
                                <div className="max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
                                    <span className="mx-auto grid size-11 place-items-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-600">
                                        <FileJson aria-hidden="true" className="size-5" />
                                    </span>
                                    <p className="mt-3 font-semibold">{t("emptyTitle")}</p>
                                    <p className="mt-1 text-sm text-zinc-500">{t("emptyBody")}</p>
                                    <div className="mt-4 flex justify-center gap-2">
                                        <button type="button" className={cx(button, "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700")} onClick={openFilePicker}>
                                            <Upload aria-hidden="true" className="size-4" /> {t("importBtn")}
                                        </button>
                                        <button type="button" className={cx(button, "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50")} onClick={() => void loadSample()}>
                                            {t("sampleBtn")}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {dragging && (
                            <div className="pointer-events-none absolute inset-3 z-30 grid place-items-center rounded-2xl border-2 border-dashed border-zinc-400 bg-white/70">
                                <p className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 font-medium text-zinc-800 shadow-sm">
                                    <Upload aria-hidden="true" className="size-4" /> {t("importBtn")}
                                </p>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-6 z-40 flex justify-center px-4">
                {toast && (
                    <p key={toast.id} className="animate-fade-up flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
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
