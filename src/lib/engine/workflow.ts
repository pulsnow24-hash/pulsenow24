/**
 * News Platform Engine — Operational Workflow.
 *
 * Transformă inteligența existentă (Story, Alert, Coverage, Confidence,
 * Context, Entity) într-un instrument de lucru zilnic. NU introduce un
 * motor de analiză nou: prioritatea e un RANKING determinist care combină
 * scoruri deja calculate de celelalte motoare; brief-ul e o ASAMBLARE
 * deterministă, fiecare punct legat de Story-ul/semnalul sursă.
 *
 * Starea editorială (workflow) e ținută SEPARAT de dovezile factuale —
 * acțiunile editorului nu modifică niciodată sursele.
 */
import type { Story } from "./story";
import type {
  AlertType,
  LocalAnalysis,
  LocalUrgency,
  MonitorAlert,
  StoryCoverageDoc,
  Workspace,
} from "./workspace";

/* ── Starea editorială (persistată în colecția `workflow`) ──── */

export type WorkflowStatus =
  | "new"
  | "reviewed"
  | "in-progress"
  | "waiting"
  | "done"
  | "dismissed";

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  new: "Nou",
  reviewed: "Verificat",
  "in-progress": "În lucru",
  waiting: "Așteaptă răspuns",
  done: "Închis",
  dismissed: "Respins",
};

/** Instantaneu al stării factuale la ultima verificare — pentru diff. */
export interface WorkflowSnapshot {
  confidence: number;
  signalCount: number;
  sourceCount: number;
  officialCount: number;
  conflict: string;
}

export interface WorkflowNote {
  text: string;
  at: string;
  author: string;
}

/** Schița de comunicare (generată de AI, niciodată publicată automat). */
export interface CommDraft {
  factualSummary: string;
  confirmedFacts: string[];
  unconfirmedClaims: string[];
  tone: string;
  suggestedMessage: string;
  openQuestions: string[];
  createdAt: string;
}

/** Documentul de stare editorială (colecția `workflow`, id = storyId). */
export interface WorkflowItem {
  storyId: string;
  workspace: Workspace;
  status: WorkflowStatus;
  followed: boolean;
  reviewedAt?: string;
  snapshot?: WorkflowSnapshot;
  notes: WorkflowNote[];
  draft?: CommDraft;
  updatedAt: string;
}

export function emptyWorkflow(storyId: string): WorkflowItem {
  return {
    storyId,
    workspace: "valcea",
    status: "new",
    followed: false,
    notes: [],
    updatedAt: new Date().toISOString(),
  };
}

/* ── Coada de prioritate (RANKING, nu un motor nou) ─────────── */

export type PriorityTier = "critical" | "high" | "monitor" | "informational";

export const PRIORITY_TIER_LABELS: Record<PriorityTier, string> = {
  critical: "Critic",
  high: "Ridicat",
  monitor: "De monitorizat",
  informational: "Informativ",
};

const URGENCY_VALUE: Record<LocalUrgency, number> = {
  low: 20,
  medium: 50,
  high: 80,
  critical: 100,
};

/**
 * Semnalele agregate ale unui Story, extrase din motoarele existente.
 * Nimic nou nu se calculează aici — doar se citește ce există deja.
 */
export interface PriorityInput {
  story: Story;
  coverage?: StoryCoverageDoc;
  /** Analizele locale ale semnalelor story-ului (din inbox items) */
  locals: LocalAnalysis[];
  /** Alertele active ale story-ului */
  alerts: MonitorAlert[];
}

export interface PriorityResult {
  score: number;
  tier: PriorityTier;
  /** Contribuția fiecărui semnal — pentru explicabilitate */
  parts: {
    urgency: number;
    relevance: number;
    publicInterest: number;
    confidence: number;
    trend: number;
    coverage: number;
    commOpportunity: number;
    alertBoost: number;
  };
  /** De ce e în această treaptă — text scurt, evidence-linked */
  reasons: string[];
}

const maxOf = (xs: number[]) => (xs.length ? Math.max(...xs) : 0);

/**
 * Prioritatea unui Story: combinație ponderată, deterministă, a scorurilor
 * DEJA calculate de celelalte motoare. Fiecare parte e expusă, iar treapta
 * e justificată prin motive legate de dovezi.
 */
export function computePriority(input: PriorityInput): PriorityResult {
  const { story, coverage, locals, alerts } = input;

  const urgencyRaw = maxOf(locals.map((l) => URGENCY_VALUE[l.urgency] ?? 0));
  const relevanceRaw = maxOf(locals.map((l) => l.relevance));
  const publicRaw = maxOf(locals.map((l) => l.publicInterest));
  const commRaw = maxOf(locals.map((l) => l.commScore));
  const confidenceRaw = coverage?.confidence ?? 0;
  const trendRaw = story.breakingScore;
  const coverageRaw = Math.min(100, (coverage?.independentSources ?? story.sources.length) * 25);

  // Ponderi documentate (însumează 1.0 pe componentele de bază)
  const parts = {
    urgency: Math.round(urgencyRaw * 0.28),
    relevance: Math.round(relevanceRaw * 0.22),
    publicInterest: Math.round(publicRaw * 0.15),
    confidence: Math.round(confidenceRaw * 0.1),
    trend: Math.round(trendRaw * 0.1),
    coverage: Math.round(coverageRaw * 0.08),
    commOpportunity: Math.round(commRaw * 0.07),
    // Booster din tipul/severitatea alertelor (nu un scor nou — refolosește alertele)
    alertBoost: alerts.some((a) => a.severity === "urgent")
      ? 15
      : alerts.some((a) => a.severity === "attention")
        ? 8
        : 0,
  };

  const score = Math.max(
    0,
    Math.min(
      100,
      parts.urgency +
        parts.relevance +
        parts.publicInterest +
        parts.confidence +
        parts.trend +
        parts.coverage +
        parts.commOpportunity +
        parts.alertBoost
    )
  );

  const hasCritical =
    locals.some((l) => l.urgency === "critical") ||
    alerts.some((a) => a.severity === "urgent");

  const tier: PriorityTier = hasCritical
    ? "critical"
    : score >= 60
      ? "high"
      : score >= 35
        ? "monitor"
        : "informational";

  // Motive (evidence-linked, explicabile)
  const reasons: string[] = [];
  if (hasCritical) reasons.push("urgență critică / alertă urgentă");
  if (relevanceRaw >= 80) reasons.push(`relevanță locală ${relevanceRaw}`);
  if (coverage?.singleSource) reasons.push("sursă unică — necesită verificare");
  if (coverage?.conflict === "conflicting") reasons.push("surse în contradicție");
  if (commRaw >= 60) reasons.push("oportunitate de comunicare");
  const alertKinds = [...new Set(alerts.map((a) => a.type))];
  if (alertKinds.length) reasons.push(`alerte: ${alertKinds.join(", ")}`);
  if (publicRaw >= 80) reasons.push(`interes public ${publicRaw}`);

  return { score, tier, parts, reasons };
}

/* ── Urmărirea evoluției (diff față de ultima verificare) ───── */

export interface FollowUpDiff {
  hasChanges: boolean;
  newSignals: number;
  confidenceChange: number;
  newContradiction: boolean;
  newOfficialSources: number;
  resolved: boolean;
  /** Descrieri scurte ale schimbărilor, pentru afișare */
  summary: string[];
}

/**
 * Ce s-a schimbat de la ultima verificare a editorului (pur, determinist).
 * Compară starea curentă cu instantaneul salvat în workflow.
 */
export function followUpDiff(
  story: Story,
  coverage: StoryCoverageDoc | undefined,
  workflow: WorkflowItem | undefined
): FollowUpDiff {
  const snap = workflow?.snapshot;
  const reviewedAt = workflow?.reviewedAt;
  const curConfidence = coverage?.confidence ?? 0;
  const curOfficial = coverage?.officialCount ?? 0;

  // Semnale noi de la ultima verificare
  const newSignals = reviewedAt
    ? story.timeline.filter(
        (e) => e.type === "signal" && e.at > reviewedAt
      ).length
    : 0;

  if (!snap) {
    return {
      hasChanges: false,
      newSignals,
      confidenceChange: 0,
      newContradiction: false,
      newOfficialSources: 0,
      resolved: false,
      summary: reviewedAt ? [] : ["Niciodată verificat — nicio bază de comparație."],
    };
  }

  const confidenceChange = curConfidence - snap.confidence;
  const newContradiction =
    coverage?.conflict === "conflicting" && snap.conflict !== "conflicting";
  const newOfficialSources = Math.max(0, curOfficial - snap.officialCount);
  const resolved =
    story.status === "confirmed" ||
    (snap.conflict === "conflicting" && coverage?.conflict !== "conflicting");

  const summary: string[] = [];
  if (newSignals > 0) summary.push(`${newSignals} semnale noi`);
  if (confidenceChange !== 0)
    summary.push(
      `încredere ${confidenceChange > 0 ? "+" : ""}${confidenceChange}`
    );
  if (newContradiction) summary.push("contradicție nouă între surse");
  if (newOfficialSources > 0)
    summary.push(`${newOfficialSources} surse oficiale noi`);
  if (resolved) summary.push("chestiune rezolvată / confirmată");

  return {
    hasChanges: summary.length > 0,
    newSignals,
    confidenceChange,
    newContradiction,
    newOfficialSources,
    resolved,
    summary,
  };
}

export function snapshotOf(
  story: Story,
  coverage: StoryCoverageDoc | undefined
): WorkflowSnapshot {
  return {
    confidence: coverage?.confidence ?? 0,
    signalCount: story.signalCount,
    sourceCount: coverage?.independentSources ?? story.sources.length,
    officialCount: coverage?.officialCount ?? 0,
    conflict: coverage?.conflict ?? "unchecked",
  };
}

/* ── Brief-ul zilnic (ASAMBLARE deterministă, evidence-linked) ── */

export type BriefSectionKey =
  | "urgent"
  | "announcements"
  | "infrastructure"
  | "investments"
  | "gaining"
  | "unresolved"
  | "changes"
  | "needVerification"
  | "commOpportunities";

export const BRIEF_SECTION_LABELS: Record<BriefSectionKey, string> = {
  urgent: "Dezvoltări urgente",
  announcements: "Anunțuri instituționale noi",
  infrastructure: "Infrastructură și urgențe",
  investments: "Investiții și finanțări",
  gaining: "Subiecte care câștigă atenție",
  unresolved: "Story-uri nerezolvate",
  changes: "Schimbări față de brief-ul anterior",
  needVerification: "Necesită verificare",
  commOpportunities: "Oportunități de comunicare",
};

/** Un punct din brief — mereu legat de Story-ul/semnalul sursă. */
export interface BriefItem {
  storyId: string;
  title: string;
  /** Dovada/justificarea — de ce e în această secțiune */
  evidence: string;
  tier?: PriorityTier;
}

export interface DailyBrief {
  date: string;
  workspace: Workspace;
  generatedAt: string;
  counts: Record<BriefSectionKey, number>;
  sections: Record<BriefSectionKey, BriefItem[]>;
}

const ALERT_SECTION: Partial<Record<AlertType, BriefSectionKey>> = {
  "institution-announcement": "announcements",
  emergency: "infrastructure",
  infrastructure: "infrastructure",
  funding: "investments",
  investment: "investments",
};

export interface BriefInput {
  stories: Story[];
  coverageById: Map<string, StoryCoverageDoc>;
  /** Analizele locale pe story (agregate din inbox items) */
  localsByStory: Map<string, LocalAnalysis[]>;
  alerts: MonitorAlert[];
  workflowById: Map<string, WorkflowItem>;
  previousBrief?: DailyBrief;
  now?: number;
}

/**
 * Construiește brief-ul zilnic din datele existente. Determinist și complet
 * explicabil: fiecare punct poartă storyId + o dovadă. Fără AI, fără invenții.
 */
export function buildBrief(input: BriefInput): DailyBrief {
  const { stories, coverageById, localsByStory, alerts, workflowById } = input;
  const now = input.now ?? Date.now();
  const nowIso = new Date(now).toISOString();
  const active = stories.filter((s) => s.status !== "archived");

  const sections: Record<BriefSectionKey, BriefItem[]> = {
    urgent: [],
    announcements: [],
    infrastructure: [],
    investments: [],
    gaining: [],
    unresolved: [],
    changes: [],
    needVerification: [],
    commOpportunities: [],
  };
  const pushed: Record<BriefSectionKey, Set<string>> = Object.fromEntries(
    (Object.keys(sections) as BriefSectionKey[]).map((k) => [k, new Set()])
  ) as Record<BriefSectionKey, Set<string>>;

  const add = (key: BriefSectionKey, item: BriefItem) => {
    if (pushed[key].has(item.storyId)) return;
    pushed[key].add(item.storyId);
    sections[key].push(item);
  };

  const alertsByStory = new Map<string, MonitorAlert[]>();
  for (const a of alerts) {
    if (a.status === "dismissed" || !a.storyId) continue;
    const arr = alertsByStory.get(a.storyId) ?? [];
    arr.push(a);
    alertsByStory.set(a.storyId, arr);
  }

  for (const s of active) {
    const cov = coverageById.get(s.id);
    const locals = localsByStory.get(s.id) ?? [];
    const storyAlerts = alertsByStory.get(s.id) ?? [];
    const prio = computePriority({ story: s, coverage: cov, locals, alerts: storyAlerts });

    // Urgent
    if (prio.tier === "critical") {
      add("urgent", {
        storyId: s.id,
        title: s.title,
        evidence: prio.reasons.join("; ") || "prioritate critică",
        tier: prio.tier,
      });
    }

    // Secțiuni din tipurile de alertă
    for (const a of storyAlerts) {
      const key = ALERT_SECTION[a.type];
      if (key)
        add(key, {
          storyId: s.id,
          title: s.title,
          evidence: `alertă: ${a.type} (${a.severity}) · ${a.sourceName}`,
        });
    }

    // Subiecte care câștigă atenție: velocitate (breakingScore) sau multe semnale recente
    if (s.breakingScore >= 60 || s.signalCount >= 3) {
      add("gaining", {
        storyId: s.id,
        title: s.title,
        evidence: `breakingScore ${s.breakingScore}, ${s.signalCount} semnale`,
      });
    }

    // Nerezolvate: developing/breaking fără update de >7 zile
    const ageDays = (now - new Date(s.lastUpdated).getTime()) / 86400_000;
    if (["developing", "breaking"].includes(s.status) && ageDays > 7) {
      add("unresolved", {
        storyId: s.id,
        title: s.title,
        evidence: `fără update de ${Math.round(ageDays)} zile, status ${s.status}`,
      });
    }

    // Necesită verificare: sursă unică sau contradicție
    if (cov?.singleSource) {
      add("needVerification", {
        storyId: s.id,
        title: s.title,
        evidence: "sursă unică — necesită coroborare",
      });
    } else if (cov?.conflict === "conflicting") {
      add("needVerification", {
        storyId: s.id,
        title: s.title,
        evidence: `surse în contradicție${cov.conflictNote ? `: ${cov.conflictNote}` : ""}`,
      });
    }

    // Oportunități de comunicare: commScore ridicat + sugestie
    const bestComm = locals
      .filter((l) => l.commScore >= 60 && l.suggestion)
      .sort((a, b) => b.commScore - a.commScore)[0];
    if (bestComm) {
      add("commOpportunities", {
        storyId: s.id,
        title: s.title,
        evidence: `scor comunicare ${bestComm.commScore}: ${bestComm.suggestion}`,
      });
    }

    // Schimbări față de ultima verificare a editorului
    const wf = workflowById.get(s.id);
    const diff = followUpDiff(s, cov, wf);
    if (wf?.followed && diff.hasChanges) {
      add("changes", {
        storyId: s.id,
        title: s.title,
        evidence: diff.summary.join("; "),
      });
    }
  }

  // Diff față de brief-ul precedent: subiecte care persistă fără răspuns oficial
  if (input.previousBrief) {
    const prevUnresolved = new Set(
      input.previousBrief.sections.unresolved.map((i) => i.storyId)
    );
    for (const item of sections.unresolved) {
      if (prevUnresolved.has(item.storyId)) {
        add("changes", {
          storyId: item.storyId,
          title: item.title,
          evidence: "persistă nerezolvat față de brief-ul anterior",
        });
      }
    }
  }

  const counts = Object.fromEntries(
    (Object.keys(sections) as BriefSectionKey[]).map((k) => [k, sections[k].length])
  ) as Record<BriefSectionKey, number>;

  return {
    date: nowIso.slice(0, 10),
    workspace: "valcea",
    generatedAt: nowIso,
    counts,
    sections,
  };
}
