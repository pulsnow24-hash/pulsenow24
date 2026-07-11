"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore/lite";
import { toast } from "sonner";
import { Inbox as InboxIcon, Sparkles } from "lucide-react";
import type { FactCheckResult, GeneratedArticle } from "@/lib/ai-types";
import { useNewsroom } from "@/components/admin/newsroom-provider";
import { callApi } from "@/app/admin/api";
import { runImport } from "@/components/admin/automation/import-runner";
import { generatedToForm } from "@/app/admin/formState";
import AiProgress from "@/app/admin/AiProgress";
import { Button } from "@/components/ui/button";
import { normalizeInboxDoc, type InboxDoc, type InboxStatus } from "./helpers";
import InboxStats from "./inbox-stats";
import InboxToolbar, {
  DEFAULT_FILTERS,
  type InboxFilters,
} from "./inbox-toolbar";
import InboxCard, { type InboxActions } from "./inbox-card";
import InboxTable from "./inbox-table";
import InboxDetail from "./inbox-detail";

function strip(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const PRIORITY_RANK: Record<string, number> = {
  breaking: 3,
  high: 2,
  normal: 1,
  low: 0,
};

export default function InboxView() {
  const { db, auth, requestEdit } = useNewsroom();

  const [items, setItems] = useState<InboxDoc[] | null>(null);
  const [filters, setFilters] = useState<InboxFilters>(DEFAULT_FILTERS);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshDone, setRefreshDone] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [nowTs] = useState(() => Date.now());

  const [detailItem, setDetailItem] = useState<InboxDoc | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [autoFactCheck, setAutoFactCheck] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const snap = await getDocs(collection(db, "inbox"));
    const list = snap.docs.map((d) => normalizeInboxDoc(d.id, d.data()));
    list.sort(
      (a, b) =>
        PRIORITY_RANK[b.priority] * 1000 +
        b.importanceScore -
        (PRIORITY_RANK[a.priority] * 1000 + a.importanceScore)
    );
    setItems(list);
  }, [db]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch(() => setItems([]));
  }, [load]);

  const patchFilters = (patch: Partial<InboxFilters>) =>
    setFilters((f) => ({ ...f, ...patch }));

  const options = useMemo(() => {
    const src = items ?? [];
    const uniq = (arr: string[]) => [...new Set(arr)].filter(Boolean).sort();
    return {
      categories: uniq(src.map((i) => i.categorie)),
      countries: uniq(src.map((i) => i.countryCode)),
      sources: uniq(src.map((i) => i.sursa)),
    };
  }, [items]);

  const filtered = useMemo(() => {
    const src = items ?? [];
    const needle = strip(filters.search.trim());
    return src.filter((i) => {
      if (filters.category && i.categorie !== filters.category) return false;
      if (filters.country && i.countryCode !== filters.country) return false;
      if (filters.source && i.sursa !== filters.source) return false;
      if (i.importanceScore < filters.minImportance) return false;
      if (filters.breakingOnly && i.priority !== "breaking") return false;
      if (filters.verifiedOnly && i.trustScore < 70) return false;
      if (filters.date !== "all") {
        const age = nowTs - new Date(i.addedAt).getTime();
        const limit = filters.date === "today" ? 86400000 : 7 * 86400000;
        if (isNaN(age) || age > limit) return false;
      }
      if (needle) {
        const hay = strip(i.titlu + " " + i.descriere + " " + i.sursa);
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [items, filters, nowTs]);

  useEffect(() => {
    // Menține selecția în interval când lista filtrată se schimbă
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selected >= filtered.length) setSelected(Math.max(0, filtered.length - 1));
  }, [filtered.length, selected]);

  const focusedId = filtered[selected]?.id ?? null;

  useEffect(() => {
    if (!focusedId) return;
    document
      .querySelector(`[data-inbox-id="${focusedId}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [focusedId]);

  // ── Mutations ──────────────────────────────────────────────
  const setStatus = useCallback(
    async (item: InboxDoc, status: InboxStatus) => {
      setItems((prev) =>
        (prev ?? []).map((i) => (i.id === item.id ? { ...i, status } : i))
      );
      try {
        await updateDoc(doc(db, "inbox", item.id), { status });
      } catch {
        toast.error("Nu am putut salva starea.");
        load();
      }
    },
    [db, load]
  );

  const generate = useCallback(
    async (item: InboxDoc) => {
      setBusyId(item.id);
      const t = toast.loading(`AI scrie articolul: „${item.titlu.slice(0, 40)}…"`);
      try {
        const g = await callApi<GeneratedArticle>(auth, "/api/ai/generate", {
          url: item.link,
        }, 320_000);
        const form = generatedToForm(g, item.link);
        if (!form.sursaNume) form.sursaNume = item.sursa;
        // Articolul moștenește story-ul semnalului din care e generat
        if (item.storyId) form.storyId = item.storyId;
        await updateDoc(doc(db, "inbox", item.id), { status: "drafted" });
        toast.dismiss(t);
        requestEdit({ form, editId: null, social: null });
      } catch (e) {
        toast.dismiss(t);
        toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyId(null);
      }
    },
    [auth, db, requestEdit]
  );

  const runFactCheck = useCallback(
    (item: InboxDoc): Promise<FactCheckResult> =>
      callApi<FactCheckResult>(auth, "/api/ai/factcheck", {
        url: item.link,
        title: item.titlu,
        description: item.descriere,
      }, 160_000),
    [auth]
  );

  const openDetail = (item: InboxDoc, withFactCheck = false) => {
    setDetailItem(item);
    setAutoFactCheck(withFactCheck);
    setDetailOpen(true);
  };

  const actions: InboxActions = useMemo(
    () => ({
      onApprove: (item) =>
        setStatus(item, item.status === "approved" ? "new" : "approved"),
      onReject: (item) =>
        setStatus(item, item.status === "rejected" ? "new" : "rejected"),
      onGenerate: generate,
      onPreview: (item) => openDetail(item),
      onOpen: (item) => {
        if (item.link) window.open(item.link, "_blank", "noopener");
      },
      onFactCheck: (item) => openDetail(item, true),
      onSecondary: (item, kind) => {
        if (kind === "sources") return openDetail(item);
        if (kind === "tiktok") {
          toast("Caruselul TikTok vine într-o fază viitoare.");
          return;
        }
        toast.info(
          kind === "seo"
            ? "SEO se generează automat odată cu articolul."
            : "Social se creează în editor, după articol."
        );
        generate(item);
      },
    }),
    [setStatus, generate]
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const summary = await runImport({ db, auth, trigger: "manual" });
      await load();
      toast.success(
        `${summary.added} știri noi în inbox` +
          (summary.autoApproved ? ` · ${summary.autoApproved} aprobate automat` : "") +
          (summary.errors.length ? ` · ${summary.errors.length} feed-uri cu probleme` : "")
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      // Bara ajunge la 100% și abia apoi dispare — indiferent de rezultat.
      setRefreshDone(true);
      setTimeout(() => {
        setRefreshDone(false);
        setRefreshing(false);
      }, 700);
    }
  }, [auth, db, load]);

  // ── Keyboard shortcuts ─────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      const typing =
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (detailOpen) return;
      const current = filtered[selected];
      switch (e.key) {
        case "j":
          e.preventDefault();
          setSelected((s) => Math.min(filtered.length - 1, s + 1));
          break;
        case "k":
          e.preventDefault();
          setSelected((s) => Math.max(0, s - 1));
          break;
        case "v":
          setView((v) => (v === "cards" ? "table" : "cards"));
          break;
        case "a":
          if (current) actions.onApprove(current);
          break;
        case "r":
          if (current) actions.onReject(current);
          break;
        case "g":
          if (current) actions.onGenerate(current);
          break;
        case "f":
          if (current) actions.onFactCheck(current);
          break;
        case "o":
          if (current) actions.onOpen(current);
          break;
        case "Enter":
          if (current) actions.onPreview(current);
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, selected, detailOpen, actions]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium tracking-tight">AI Inbox</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Fluxul redacției — știri scanate și scorate de AI în timp real.
          </p>
        </div>
        <p className="hidden font-mono text-[11px] text-muted-foreground lg:block">
          <kbd className="rounded border border-border bg-secondary px-1">j</kbd>{" "}
          <kbd className="rounded border border-border bg-secondary px-1">k</kbd>{" "}
          navighează ·{" "}
          <kbd className="rounded border border-border bg-secondary px-1">a</kbd>{" "}
          aprobă ·{" "}
          <kbd className="rounded border border-border bg-secondary px-1">g</kbd>{" "}
          generează ·{" "}
          <kbd className="rounded border border-border bg-secondary px-1">f</kbd>{" "}
          verifică
        </p>
      </div>

      <div className="mb-4">
        <InboxStats items={items ?? []} />
      </div>

      <div className="mb-4">
        <InboxToolbar
          filters={filters}
          onChange={patchFilters}
          categories={options.categories}
          countries={options.countries}
          sources={options.sources}
          view={view}
          onViewChange={setView}
          onRefresh={refresh}
          refreshing={refreshing}
          searchRef={searchRef}
        />
      </div>

      {refreshing && (
        <div className="mb-4">
          <AiProgress
            durata={100}
            complete={refreshDone}
            etape={[
              "Citesc fluxurile RSS (Digi24, HotNews, G4Media, Biziday)…",
              "AI-ul evaluează importanța, trust-ul și riscul fiecărei știri…",
              "Grupez semnalele în story-uri…",
              "Extrag entitățile și actualizez inboxul…",
            ]}
          />
        </div>
      )}

      {/* States */}
      {items === null ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-card">
            <InboxIcon className="size-5 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {items.length === 0
              ? "Inboxul e gol. Scanează fluxurile ca să aduci știri."
              : "Niciun rezultat pentru filtrele curente."}
          </p>
          {items.length === 0 && (
            <Button className="mt-4" onClick={refresh} disabled={refreshing}>
              <Sparkles className="size-4" />
              Caută știri
            </Button>
          )}
        </div>
      ) : view === "cards" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((item) => (
            <InboxCard
              key={item.id}
              item={item}
              actions={actions}
              busy={busyId === item.id}
              focused={focusedId === item.id}
            />
          ))}
        </div>
      ) : (
        <InboxTable
          items={filtered}
          actions={actions}
          busyId={busyId}
          focusedId={focusedId}
        />
      )}

      <InboxDetail
        item={detailItem}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onGenerate={generate}
        runFactCheck={runFactCheck}
        autoFactCheck={autoFactCheck}
      />
    </div>
  );
}
