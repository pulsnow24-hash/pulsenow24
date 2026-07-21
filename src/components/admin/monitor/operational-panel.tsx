"use client";

/**
 * 📍 Monitor Vâlcea — panoul operațional.
 *
 * Transformă inteligența existentă într-un instrument de lucru zilnic:
 * Brief-ul zilnic (asamblare deterministă, evidence-linked) + Coada de
 * prioritate (ranking din scoruri existente) + acțiuni editoriale.
 *
 * Starea editorială se scrie în colecția `workflow`, SEPARAT de dovezi —
 * acțiunile editorului nu ating niciodată story-urile, coverage-ul sau
 * alertele. Nimic nu se publică automat.
 */
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  ClipboardList,
  Eye,
  FileText,
  Flag,
  ListChecks,
  Loader2,
  MessageSquarePlus,
  NotebookPen,
  RefreshCw,
  Star,
  X,
} from "lucide-react";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore/lite";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { callApi } from "@/app/admin/api";
import type { Story } from "@/lib/engine/story";
import type { InboxDoc } from "@/components/admin/inbox/helpers";
import type { CommDraftResult } from "@/lib/ai-types";
import {
  type LocalAnalysis,
  type MonitorAlert,
  type StoryCoverageDoc,
} from "@/lib/engine/workspace";
import {
  BRIEF_SECTION_LABELS,
  PRIORITY_TIER_LABELS,
  WORKFLOW_STATUS_LABELS,
  buildBrief,
  computePriority,
  emptyWorkflow,
  followUpDiff,
  snapshotOf,
  type BriefSectionKey,
  type CommDraft,
  type DailyBrief,
  type PriorityTier,
  type WorkflowItem,
  type WorkflowStatus,
} from "@/lib/engine/workflow";
import { saveBrief, saveWorkflow } from "@/lib/monitor-store";

const TIER_STYLE: Record<PriorityTier, string> = {
  critical: "border-red-500/40 bg-red-500/5 text-red-400",
  high: "border-amber-500/40 bg-amber-500/5 text-amber-500",
  monitor: "border-sky-500/30 bg-sky-500/5 text-sky-400",
  informational: "border-border bg-secondary/40 text-muted-foreground",
};

const STATUS_ORDER: WorkflowStatus[] = [
  "new",
  "reviewed",
  "in-progress",
  "waiting",
  "done",
  "dismissed",
];

interface QueueRow {
  story: Story;
  coverage?: StoryCoverageDoc;
  locals: LocalAnalysis[];
  alerts: MonitorAlert[];
  score: number;
  tier: PriorityTier;
  reasons: string[];
  wf?: WorkflowItem;
}

export default function OperationalPanel({
  db,
  auth,
  stories,
  coverage,
  items,
  alerts,
  workflow,
  briefHistory,
  onReload,
  onOpenStory,
}: {
  db: Firestore;
  auth: Auth;
  stories: Story[];
  coverage: Map<string, StoryCoverageDoc> | null;
  items: InboxDoc[];
  alerts: MonitorAlert[];
  workflow: Map<string, WorkflowItem> | null;
  briefHistory: DailyBrief[];
  onReload: () => void;
  onOpenStory: (s: Story) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState<QueueRow | null>(null);
  const [noteRow, setNoteRow] = useState<QueueRow | null>(null);
  const [noteText, setNoteText] = useState("");
  const [draftRow, setDraftRow] = useState<QueueRow | null>(null);
  const [draft, setDraft] = useState<CommDraft | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [brief, setBrief] = useState<DailyBrief | null>(briefHistory[0] ?? null);
  const [briefBusy, setBriefBusy] = useState(false);

  // Analizele locale grupate pe story (din inbox items) — date existente
  const localsByStory = useMemo(() => {
    const m = new Map<string, LocalAnalysis[]>();
    for (const it of items) {
      if (!it.storyId || !it.local) continue;
      const arr = m.get(it.storyId) ?? [];
      arr.push(it.local);
      m.set(it.storyId, arr);
    }
    return m;
  }, [items]);

  const alertsByStory = useMemo(() => {
    const m = new Map<string, MonitorAlert[]>();
    for (const a of alerts) {
      if (a.status === "dismissed" || !a.storyId) continue;
      const arr = m.get(a.storyId) ?? [];
      arr.push(a);
      m.set(a.storyId, arr);
    }
    return m;
  }, [alerts]);

  // Coada de prioritate: ranking determinist din scorurile existente
  const queue = useMemo<QueueRow[]>(() => {
    const rows = stories
      .filter((s) => s.status !== "archived")
      .map((s) => {
        const cov = coverage?.get(s.id);
        const locals = localsByStory.get(s.id) ?? [];
        const storyAlerts = alertsByStory.get(s.id) ?? [];
        const p = computePriority({ story: s, coverage: cov, locals, alerts: storyAlerts });
        return {
          story: s,
          coverage: cov,
          locals,
          alerts: storyAlerts,
          score: p.score,
          tier: p.tier,
          reasons: p.reasons,
          wf: workflow?.get(s.id),
        };
      })
      // ascunde cele respinse din coada activă
      .filter((r) => r.wf?.status !== "dismissed")
      .sort((a, b) => b.score - a.score);
    return rows;
  }, [stories, coverage, localsByStory, alertsByStory, workflow]);

  const tiers: PriorityTier[] = ["critical", "high", "monitor", "informational"];
  const byTier = useMemo(() => {
    const m = new Map<PriorityTier, QueueRow[]>();
    for (const t of tiers) m.set(t, []);
    for (const r of queue) m.get(r.tier)!.push(r);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  /* ── Acțiuni editoriale (scriu DOAR în workflow) ── */
  const patchWorkflow = useCallback(
    async (row: QueueRow, patch: Partial<WorkflowItem>) => {
      setBusyId(row.story.id);
      try {
        const base = row.wf ?? emptyWorkflow(row.story.id);
        await saveWorkflow(db, { ...base, ...patch });
        onReload();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyId(null);
      }
    },
    [db, onReload]
  );

  const markReviewed = (row: QueueRow) =>
    patchWorkflow(row, {
      status: row.wf?.status === "new" || !row.wf ? "reviewed" : row.wf.status,
      reviewedAt: new Date().toISOString(),
      snapshot: snapshotOf(row.story, row.coverage),
    }).then(() => toast.success("Marcat ca verificat."));

  const toggleFollow = (row: QueueRow) =>
    patchWorkflow(row, { followed: !row.wf?.followed }).then(() =>
      toast.success(row.wf?.followed ? "Nu mai urmărești." : "Urmărești story-ul.")
    );

  const setStatus = (row: QueueRow, status: WorkflowStatus) =>
    patchWorkflow(row, { status }).then(() =>
      toast.success(`Status: ${WORKFLOW_STATUS_LABELS[status]}`)
    );

  const addNote = async () => {
    if (!noteRow || !noteText.trim()) return;
    const base = noteRow.wf ?? emptyWorkflow(noteRow.story.id);
    await patchWorkflow(noteRow, {
      notes: [
        ...base.notes,
        {
          text: noteText.trim(),
          at: new Date().toISOString(),
          author: auth.currentUser?.email ?? "editor",
        },
      ],
    });
    toast.success("Notă adăugată.");
    setNoteText("");
    setNoteRow(null);
  };

  const generateDraft = async (row: QueueRow) => {
    setDraftRow(row);
    setDraft(row.wf?.draft ?? null);
    if (row.wf?.draft) return; // avem deja o schiță
    setDraftBusy(true);
    try {
      const cov = row.coverage ?? {
        independentSources: row.story.sources.length,
        officialCount: 0,
        confidence: 0,
        singleSource: row.story.sources.length <= 1,
        conflict: "unchecked",
      };
      const res = await callApi<CommDraftResult>(
        auth,
        "/api/monitor/draft",
        {
          title: row.story.title,
          summary: row.story.summary,
          signals: row.story.timeline
            .filter((e) => e.type === "signal")
            .slice(-8)
            .map((e) => ({ sursa: e.source ?? "Sursă", titlu: e.title })),
          sourceCount: cov.independentSources,
          officialCount: cov.officialCount,
          confidence: (cov as StoryCoverageDoc).confidence ?? 0,
          singleSource: cov.singleSource,
          conflict: cov.conflict,
        },
        130_000
      );
      const newDraft: CommDraft = { ...res, createdAt: new Date().toISOString() };
      setDraft(newDraft);
      await patchWorkflow(row, { draft: newDraft });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      setDraftRow(null);
    } finally {
      setDraftBusy(false);
    }
  };

  /* ── Brief zilnic ── */
  const generateBrief = async () => {
    setBriefBusy(true);
    try {
      const covById = coverage ?? new Map<string, StoryCoverageDoc>();
      const b = buildBrief({
        stories,
        coverageById: covById,
        localsByStory,
        alerts,
        workflowById: workflow ?? new Map(),
        previousBrief: briefHistory.find((x) => x.date < new Date().toISOString().slice(0, 10)),
      });
      setBrief(b);
      await saveBrief(db, b);
      toast.success("Brief generat și salvat.");
      onReload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBriefBusy(false);
    }
  };

  const prevBrief = briefHistory.find(
    (b) => brief && b.date < brief.date
  );

  const briefSections = Object.keys(BRIEF_SECTION_LABELS) as BriefSectionKey[];
  const storyById = useMemo(() => new Map(stories.map((s) => [s.id, s])), [stories]);

  return (
    <div className="space-y-4">
      {/* ── Brief zilnic ── */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            <ClipboardList className="size-3" />
            Brief zilnic de inteligență
            {brief && (
              <span className="ml-1 normal-case text-foreground">· {brief.date}</span>
            )}
          </p>
          <Button size="sm" variant="outline" onClick={generateBrief} disabled={briefBusy}>
            {briefBusy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            {brief ? "Regenerează" : "Generează brief"}
          </Button>
        </div>
        {!brief ? (
          <p className="text-[11.5px] text-muted-foreground/60">
            Niciun brief încă. Se asamblează determinist din story-uri, alerte,
            coverage și analizele locale — fiecare punct legat de sursa lui.
          </p>
        ) : (
          <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {briefSections.map((key) => {
              const itemsIn = brief.sections[key] ?? [];
              const prevCount = prevBrief?.counts[key] ?? null;
              const delta =
                prevCount === null ? null : itemsIn.length - prevCount;
              return (
                <div key={key}>
                  <p className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    {BRIEF_SECTION_LABELS[key]}
                    <span className="text-foreground">{itemsIn.length}</span>
                    {delta !== null && delta !== 0 && (
                      <span className={cn("text-[9px]", delta > 0 ? "text-amber-500" : "text-emerald-500")}>
                        {delta > 0 ? `+${delta}` : delta} vs ieri
                      </span>
                    )}
                  </p>
                  {itemsIn.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground/50">—</p>
                  ) : (
                    <ul className="space-y-1">
                      {itemsIn.slice(0, 5).map((it) => {
                        const s = storyById.get(it.storyId);
                        return (
                          <li key={it.storyId} className="text-[12px]">
                            <button
                              onClick={() => s && onOpenStory(s)}
                              className="text-left transition-colors hover:text-primary"
                              disabled={!s}
                            >
                              <span className="line-clamp-1">{it.title}</span>
                            </button>
                            <span className="line-clamp-1 font-mono text-[9.5px] text-muted-foreground/70">
                              {it.evidence}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Coada de prioritate ── */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            <ListChecks className="size-3" />
            Coadă de prioritate
          </p>
          <span className="font-mono text-[10px] text-muted-foreground">
            {queue.length} story-uri active · ranking din scoruri existente
          </span>
        </div>
        {workflow === null && (
          <p className="mb-2 rounded border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-500">
            Starea editorială nu poate fi citită încă — regulile Firestore
            pentru colecția „workflow” așteaptă instalarea. Rankingul funcționează;
            acțiunile se vor persista după deploy.
          </p>
        )}
        <div className="space-y-3">
          {tiers.map((tier) => {
            const rows = byTier.get(tier) ?? [];
            if (rows.length === 0) return null;
            return (
              <div key={tier}>
                <p className="mb-1 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                  {PRIORITY_TIER_LABELS[tier]} ({rows.length})
                </p>
                <div className="space-y-1">
                  {rows.slice(0, tier === "informational" ? 4 : 12).map((row) => (
                    <QueueRowView
                      key={row.story.id}
                      row={row}
                      tierStyle={TIER_STYLE[tier]}
                      busy={busyId === row.story.id}
                      onOpen={() => onOpenStory(row.story)}
                      onReviewed={() => markReviewed(row)}
                      onFollow={() => toggleFollow(row)}
                      onDismiss={() => setStatus(row, "dismissed")}
                      onStatus={(s) => setStatus(row, s)}
                      onDraft={() => generateDraft(row)}
                      onNote={() => {
                        setNoteRow(row);
                        setNoteText("");
                      }}
                      onFollowUp={() => setFollowUp(row)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          {queue.length === 0 && (
            <p className="text-[11.5px] text-muted-foreground/60">
              Niciun story local activ în coadă.
            </p>
          )}
        </div>
      </div>

      {/* ── Sheet: urmărire evoluție ── */}
      <Sheet open={!!followUp} onOpenChange={(o) => !o && setFollowUp(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {followUp && (
            <FollowUpView row={followUp} />
          )}
        </SheetContent>
      </Sheet>

      {/* ── Sheet: notă internă ── */}
      <Sheet open={!!noteRow} onOpenChange={(o) => !o && setNoteRow(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {noteRow && (
            <>
              <SheetHeader>
                <SheetTitle className="text-base">Notă internă</SheetTitle>
                <p className="line-clamp-2 text-[12px] text-muted-foreground">
                  {noteRow.story.title}
                </p>
              </SheetHeader>
              <div className="space-y-3 px-4 pb-8">
                {(noteRow.wf?.notes ?? []).length > 0 && (
                  <div className="space-y-1.5">
                    {noteRow.wf!.notes.map((n, i) => (
                      <div key={i} className="rounded border border-border bg-secondary/40 p-2 text-[12px]">
                        <p>{n.text}</p>
                        <p className="mt-0.5 font-mono text-[9.5px] text-muted-foreground">
                          {n.author} · {new Date(n.at).toLocaleString("ro-RO")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Scrie o notă internă…"
                  rows={3}
                  className="text-[13px]"
                />
                <Button size="sm" onClick={addNote} disabled={!noteText.trim() || busyId === noteRow.story.id}>
                  <NotebookPen className="size-3.5" />
                  Adaugă nota
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Sheet: schiță de comunicare ── */}
      <Sheet open={!!draftRow} onOpenChange={(o) => !o && setDraftRow(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {draftRow && (
            <CommDraftView row={draftRow} draft={draft} busy={draftBusy} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ── Un rând din coadă ─────────────────────────────────────── */

function QueueRowView({
  row,
  tierStyle,
  busy,
  onOpen,
  onReviewed,
  onFollow,
  onDismiss,
  onStatus,
  onDraft,
  onNote,
  onFollowUp,
}: {
  row: QueueRow;
  tierStyle: string;
  busy: boolean;
  onOpen: () => void;
  onReviewed: () => void;
  onFollow: () => void;
  onDismiss: () => void;
  onStatus: (s: WorkflowStatus) => void;
  onDraft: () => void;
  onNote: () => void;
  onFollowUp: () => void;
}) {
  const diff = followUpDiff(row.story, row.coverage, row.wf);
  const noteCount = row.wf?.notes.length ?? 0;
  return (
    <div className={cn("flex items-center gap-2 rounded-lg border p-2", tierStyle)}>
      <span className="shrink-0 font-mono text-[11px] tabular-nums" title={row.reasons.join("; ")}>
        {row.score}
      </span>
      <div className="min-w-0 flex-1">
        <button onClick={onOpen} className="block w-full text-left">
          <span className="line-clamp-1 text-[12.5px] text-foreground">{row.story.title}</span>
        </button>
        <span className="line-clamp-1 font-mono text-[9.5px] text-muted-foreground/80">
          {row.reasons.slice(0, 3).join(" · ") || `${row.story.signalCount} semnale`}
          {row.wf?.status && row.wf.status !== "new" ? ` · ${WORKFLOW_STATUS_LABELS[row.wf.status]}` : ""}
        </span>
      </div>

      {row.wf?.followed && diff.hasChanges && (
        <button
          onClick={onFollowUp}
          className="shrink-0 rounded border border-sky-500/40 px-1 font-mono text-[9px] uppercase text-sky-400"
          title={diff.summary.join("; ")}
        >
          {diff.summary.length} noutăți
        </button>
      )}

      <div className="flex shrink-0 items-center gap-0.5">
        <IconBtn title="Deschide context" onClick={onOpen}><Eye className="size-3.5" /></IconBtn>
        <IconBtn title="Marchează verificat" onClick={onReviewed} disabled={busy}><Check className="size-3.5" /></IconBtn>
        <IconBtn title={row.wf?.followed ? "Nu mai urmări" : "Urmărește"} onClick={onFollow} active={row.wf?.followed}>
          <Star className={cn("size-3.5", row.wf?.followed && "fill-current")} />
        </IconBtn>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Mai multe acțiuni">
              <ClipboardList className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={onDraft}>
              <MessageSquarePlus className="size-3.5" /> Creează schiță de comunicare
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onNote}>
              <NotebookPen className="size-3.5" /> Notă internă{noteCount ? ` (${noteCount})` : ""}
            </DropdownMenuItem>
            {row.wf?.followed && (
              <DropdownMenuItem onClick={onFollowUp}>
                <Flag className="size-3.5" /> Ce s-a schimbat
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <p className="px-2 py-1 font-mono text-[9px] uppercase text-muted-foreground">Atribuie status</p>
            {STATUS_ORDER.map((s) => (
              <DropdownMenuItem key={s} onClick={() => onStatus(s)}>
                {WORKFLOW_STATUS_LABELS[s]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDismiss} className="text-red-400">
              <X className="size-3.5" /> Respinge din coadă
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40",
        active && "text-amber-500"
      )}
    >
      {children}
    </button>
  );
}

/* ── Vederea de urmărire (diff) ────────────────────────────── */

function FollowUpView({ row }: { row: QueueRow }) {
  const diff = followUpDiff(row.story, row.coverage, row.wf);
  const reviewedAt = row.wf?.reviewedAt;
  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2 text-base">
          <Flag className="size-4" /> Ce s-a schimbat
        </SheetTitle>
        <p className="line-clamp-2 text-[12px] text-muted-foreground">{row.story.title}</p>
      </SheetHeader>
      <div className="space-y-4 px-4 pb-8">
        <p className="font-mono text-[11px] text-muted-foreground">
          Ultima verificare:{" "}
          {reviewedAt ? new Date(reviewedAt).toLocaleString("ro-RO") : "niciodată"}
        </p>
        {!diff.hasChanges ? (
          <p className="text-[12.5px] text-muted-foreground/70">
            {reviewedAt
              ? "Nicio schimbare de la ultima verificare."
              : "Marchează story-ul „verificat” ca să urmărești schimbările ulterioare."}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {diff.summary.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-[12.5px]">
                <span className="size-1.5 shrink-0 rounded-full bg-sky-400" />
                {s}
              </li>
            ))}
          </ul>
        )}
        <div className="rounded border border-border bg-secondary/40 p-2.5 text-[11.5px] text-muted-foreground">
          <p>Semnale noi: {diff.newSignals}</p>
          <p>Schimbare încredere: {diff.confidenceChange > 0 ? "+" : ""}{diff.confidenceChange}</p>
          <p>Surse oficiale noi: {diff.newOfficialSources}</p>
          <p>Contradicție nouă: {diff.newContradiction ? "da" : "nu"}</p>
          <p>Rezolvat/confirmat: {diff.resolved ? "da" : "nu"}</p>
        </div>
      </div>
    </>
  );
}

/* ── Vederea schiței de comunicare ─────────────────────────── */

function CommDraftView({
  row,
  draft,
  busy,
}: {
  row: QueueRow;
  draft: CommDraft | null;
  busy: boolean;
}) {
  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2 text-base">
          <FileText className="size-4" /> Schiță de comunicare (internă)
        </SheetTitle>
        <p className="line-clamp-2 text-[12px] text-muted-foreground">{row.story.title}</p>
      </SheetHeader>
      <div className="space-y-4 px-4 pb-8">
        <p className="rounded border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-500">
          Document intern de lucru. NU se publică automat. Faptele sunt separate
          de recomandări.
        </p>
        {busy || !draft ? (
          <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Generez schița…
          </p>
        ) : (
          <>
            <DraftBlock title="Rezumat factual" tone="fact">
              <p className="text-[12.5px]">{draft.factualSummary}</p>
            </DraftBlock>
            <DraftBlock title="Fapte confirmate" tone="fact">
              <DraftList items={draft.confirmedFacts} />
            </DraftBlock>
            <DraftBlock title="Afirmații neconfirmate" tone="warn">
              <DraftList items={draft.unconfirmedClaims} empty="Niciuna semnalată." />
            </DraftBlock>
            <DraftBlock title="Ton recomandat" tone="rec">
              <p className="text-[12.5px]">{draft.tone}</p>
            </DraftBlock>
            <DraftBlock title="Mesaj public sugerat (propunere)" tone="rec">
              <p className="whitespace-pre-wrap text-[12.5px]">{draft.suggestedMessage}</p>
            </DraftBlock>
            <DraftBlock title="Întrebări încă fără răspuns" tone="warn">
              <DraftList items={draft.openQuestions} empty="Niciuna." />
            </DraftBlock>
            <p className="font-mono text-[10px] text-muted-foreground">
              Generat: {new Date(draft.createdAt).toLocaleString("ro-RO")}
            </p>
          </>
        )}
      </div>
    </>
  );
}

function DraftBlock({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "fact" | "warn" | "rec";
  children: React.ReactNode;
}) {
  return (
    <div>
      <p
        className={cn(
          "mb-1 font-mono text-[10px] uppercase tracking-wide",
          tone === "warn"
            ? "text-amber-500"
            : tone === "rec"
              ? "text-sky-400"
              : "text-muted-foreground"
        )}
      >
        {title}
        {tone === "rec" && <span className="ml-1 normal-case opacity-70">· recomandare</span>}
      </p>
      {children}
    </div>
  );
}

function DraftList({ items, empty }: { items: string[]; empty?: string }) {
  if (items.length === 0)
    return <p className="text-[11.5px] text-muted-foreground/60">{empty ?? "—"}</p>;
  return (
    <ul className="space-y-1">
      {items.map((x, i) => (
        <li key={i} className="flex gap-1.5 text-[12.5px]">
          <span className="text-muted-foreground">·</span>
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );
}
