"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  limit as fbLimit,
  setDoc,
  updateDoc,
} from "firebase/firestore/lite";
import { toast } from "sonner";
import {
  RefreshCw,
  Plus,
  Search,
  Rss,
  Radio,
} from "lucide-react";
import { useNewsroom } from "@/components/admin/newsroom-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import AiProgress from "@/app/admin/AiProgress";
import {
  DEFAULT_AUTOMATION,
  trustScore,
  type AutomationConfig,
  type ImportLog,
  type RssSource,
} from "@/lib/engine/sources";
import {
  loadSources,
  loadAutomationConfig,
  runImport,
} from "./import-runner";
import { BarChart, Donut } from "./charts";
import SourcesTable from "./sources-table";
import SourceDialog from "./source-dialog";
import RulesPanel from "./rules-panel";
import HistoryPanel from "./history-panel";

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1 font-mono text-xl font-medium tabular-nums", accent)}>
        {value}
      </p>
    </div>
  );
}

export default function AutomationView() {
  const { db, auth } = useNewsroom();

  const [sources, setSources] = useState<RssSource[] | null>(null);
  const [config, setConfig] = useState<AutomationConfig>(DEFAULT_AUTOMATION);
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("priority");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RssSource | null>(null);

  const configLoaded = useRef(false);

  const reload = useCallback(async () => {
    const [s, c, logSnap] = await Promise.all([
      loadSources(db),
      loadAutomationConfig(db),
      getDocs(query(collection(db, "import_logs"), orderBy("at", "desc"), fbLimit(20))).catch(
        () => null
      ),
    ]);
    setSources(s);
    setConfig(c);
    configLoaded.current = true;
    if (logSnap) {
      setLogs(logSnap.docs.map((d) => ({ ...(d.data() as Omit<ImportLog, "id">), id: d.id })));
    }
  }, [db]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload().catch(() => setSources([]));
  }, [reload]);

  /* Persistă config (debounced) când se modifică regulile */
  const configSnapshot = JSON.stringify(config);
  useEffect(() => {
    if (!configLoaded.current) return;
    const t = setTimeout(() => {
      setDoc(doc(db, "config", "automation"), config).catch(() =>
        toast.error("Nu am putut salva regulile.")
      );
    }, 800);
    return () => clearTimeout(t);
  }, [configSnapshot, db, config]);

  const doImport = useCallback(
    async (trigger: "manual" | "auto") => {
      if (refreshing) return;
      setRefreshing(true);
      try {
        const summary = await runImport({ db, auth, trigger, onlyDue: trigger === "auto" });
        await reload();
        if (trigger === "manual" || summary.added > 0) {
          toast.success(
            `${summary.added} știri noi din ${summary.sourcesChecked} surse` +
              (summary.autoApproved ? ` · ${summary.autoApproved} aprobate` : "") +
              (summary.errors.length ? ` · ${summary.errors.length} erori` : "")
          );
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        setRefreshing(false);
      }
    },
    [db, auth, reload, refreshing]
  );

  /* Auto-import cât timp panoul e deschis */
  useEffect(() => {
    if (!config.autoRefresh) return;
    const ms = Math.max(5, config.intervalMinutes) * 60000;
    const timer = setInterval(() => doImport("auto"), ms);
    return () => clearInterval(timer);
  }, [config.autoRefresh, config.intervalMinutes, doImport]);

  /* CRUD surse */
  const saveSource = useCallback(
    async (id: string, data: Omit<RssSource, "id">) => {
      await setDoc(doc(db, "sources", id), data);
      await reload();
    },
    [db, reload]
  );

  const patchSource = useCallback(
    async (id: string, patch: Partial<RssSource>) => {
      setSources((prev) =>
        (prev ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s))
      );
      try {
        await updateDoc(doc(db, "sources", id), patch);
      } catch {
        toast.error("Nu am putut actualiza sursa.");
        reload();
      }
    },
    [db, reload]
  );

  const deleteSource = useCallback(
    async (s: RssSource) => {
      if (!confirm(`Ștergi sursa „${s.name}"?`)) return;
      await deleteDoc(doc(db, "sources", s.id));
      await reload();
      toast.success("Sursă ștearsă.");
    },
    [db, reload]
  );

  /* Statistici derivate */
  const stats = useMemo(() => {
    const src = sources ?? [];
    const by = (st: string) => src.filter((s) => s.status === st).length;
    const withRt = src.filter((s) => s.responseTime);
    return {
      total: src.length,
      healthy: by("healthy"),
      degraded: by("degraded"),
      down: by("down"),
      unknown: by("unknown"),
      blocked: src.filter((s) => s.blocked).length,
      articlesToday: src.reduce((n, s) => n + (s.articlesToday ?? 0), 0),
      avgResponse: withRt.length
        ? Math.round(withRt.reduce((n, s) => n + (s.responseTime ?? 0), 0) / withRt.length)
        : 0,
      avgHealth: src.length
        ? Math.round(src.reduce((n, s) => n + (s.healthScore ?? 0), 0) / src.length)
        : 0,
    };
  }, [sources]);

  const chartData = useMemo(
    () =>
      [...logs]
        .reverse()
        .slice(-14)
        .map((l) => ({
          label: new Date(l.at).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }),
          value: l.itemsAdded,
        })),
    [logs]
  );

  const donutSegments = [
    { value: stats.healthy, color: "#10b981", label: "Active" },
    { value: stats.degraded, color: "#f59e0b", label: "Lente" },
    { value: stats.down, color: "#ef4444", label: "Picate" },
    { value: stats.unknown, color: "#52525b", label: "Nesincronizate" },
  ];

  const filtered = useMemo(() => {
    let list = [...(sources ?? [])];
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((s) => s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q));
    if (statusFilter === "blocked") list = list.filter((s) => s.blocked);
    else if (statusFilter !== "all") list = list.filter((s) => s.status === statusFilter);
    list.sort((a, b) => {
      if (sortBy === "priority") return b.priority - a.priority;
      if (sortBy === "health") return (b.healthScore ?? 0) - (a.healthScore ?? 0);
      if (sortBy === "articles") return (b.articlesToday ?? 0) - (a.articlesToday ?? 0);
      if (sortBy === "trust") return trustScore(b) - trustScore(a);
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [sources, search, statusFilter, sortBy]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-medium tracking-tight">
            <Radio className="size-5 text-primary" />
            Automatizare & RSS
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Centrul de comandă al fluxului redacției — surse, sănătate, reguli.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {config.autoRefresh && (
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-400">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              AUTO {config.intervalMinutes}m
            </span>
          )}
          <Button onClick={() => doImport("manual")} disabled={refreshing}>
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            Rulează import
          </Button>
        </div>
      </div>

      {refreshing && (
        <div className="mb-4">
          <AiProgress
            durata={35}
            etape={[
              "Descarc fluxurile RSS active…",
              "Măsor sănătatea și timpii de răspuns…",
              "AI-ul scorează și categorizează știrile…",
              "Aplic regulile și salvez importul…",
            ]}
          />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Surse" value={stats.total} />
        <Metric label="Active" value={stats.healthy} accent="text-emerald-400" />
        <Metric label="Lente" value={stats.degraded} accent="text-amber-400" />
        <Metric label="Picate" value={stats.down} accent="text-red-500" />
        <Metric label="Articole azi" value={stats.articlesToday} />
        <Metric label="Sănătate medie" value={`${stats.avgHealth}`} />
      </div>

      {/* Charts */}
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            Articole importate / rulare
          </p>
          <BarChart data={chartData} />
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            Starea surselor
          </p>
          <Donut
            segments={donutSegments}
            centerLabel={`${stats.total}`}
            centerSub="surse"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="sources" className="mt-6">
        <TabsList>
          <TabsTrigger value="sources" className="gap-1.5">
            <Rss className="size-3.5" />
            Surse
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5">
            Reguli
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            Istoric import
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Caută sursă…"
                className="h-9 pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger size="sm" className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate stările</SelectItem>
                <SelectItem value="healthy">Active</SelectItem>
                <SelectItem value="degraded">Lente</SelectItem>
                <SelectItem value="down">Picate</SelectItem>
                <SelectItem value="blocked">Blocate</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger size="sm" className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">Sortare: prioritate</SelectItem>
                <SelectItem value="health">Sortare: sănătate</SelectItem>
                <SelectItem value="articles">Sortare: articole azi</SelectItem>
                <SelectItem value="trust">Sortare: trust</SelectItem>
                <SelectItem value="name">Sortare: nume</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              Adaugă sursă
            </Button>
          </div>

          {sources === null ? (
            <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              {(sources?.length ?? 0) === 0
                ? "Nicio sursă. Adaugă prima sursă RSS."
                : "Nicio sursă pentru filtrul curent."}
            </div>
          ) : (
            <>
              <SourcesTable
                sources={filtered}
                onEdit={(s) => {
                  setEditing(s);
                  setDialogOpen(true);
                }}
                onDelete={deleteSource}
                onPatch={patchSource}
              />
              <p className="px-1 font-mono text-[11px] text-muted-foreground">
                {filtered.length} din {sources.length} surse · arhitectură pregătită
                pentru 500+ feed-uri
              </p>
            </>
          )}
        </TabsContent>

        <TabsContent value="rules" className="mt-4">
          <RulesPanel
            config={config}
            onChange={(patch) => setConfig((c) => ({ ...c, ...patch }))}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <HistoryPanel logs={logs} />
        </TabsContent>
      </Tabs>

      <SourceDialog
        auth={auth}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSave={saveSource}
      />
    </div>
  );
}
