/**
 * Operațiile Firestore ale Monitorului local: configurația workspace-ului
 * (cuvinte-cheie + instituții) și alertele. Motoarele (Story, Entity, Inbox,
 * Sources) NU se duplică — monitorul doar le citește prin lentila workspace.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore/lite";
import {
  DEFAULT_VALCEA_CONFIG,
  type MonitorAlert,
  type MonitoredInstitution,
  type StoryCoverageDoc,
  type Workspace,
  type WorkspaceConfig,
} from "@/lib/engine/workspace";
import type { DailyBrief, WorkflowItem } from "@/lib/engine/workflow";

const CONFIG_DOC = "monitor-valcea";
const ALERTS = "alerts";

/** Configurația workspace-ului Vâlcea; lista implicită dacă nu e salvată. */
export async function loadWorkspaceConfig(db: Firestore): Promise<WorkspaceConfig> {
  try {
    const snap = await getDoc(doc(db, "config", CONFIG_DOC));
    if (!snap.exists()) return DEFAULT_VALCEA_CONFIG;
    const d = snap.data() as Partial<WorkspaceConfig>;
    return {
      keywords:
        Array.isArray(d.keywords) && d.keywords.length > 0
          ? d.keywords.filter((k): k is string => typeof k === "string" && !!k.trim())
          : DEFAULT_VALCEA_CONFIG.keywords,
      institutions:
        Array.isArray(d.institutions) && d.institutions.length > 0
          ? (d.institutions as MonitoredInstitution[])
          : DEFAULT_VALCEA_CONFIG.institutions,
    };
  } catch {
    return DEFAULT_VALCEA_CONFIG;
  }
}

export async function saveWorkspaceConfig(
  db: Firestore,
  config: WorkspaceConfig
): Promise<void> {
  await setDoc(doc(db, "config", CONFIG_DOC), config);
}

/** Alertele unui workspace, cele mai noi primele. */
export async function loadAlerts(
  db: Firestore,
  workspace: Workspace,
  opts?: { includeDismissed?: boolean }
): Promise<MonitorAlert[]> {
  const snap = await getDocs(collection(db, ALERTS));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as MonitorAlert)
    .filter(
      (a) =>
        a.workspace === workspace &&
        (opts?.includeDismissed || a.status !== "dismissed")
    )
    .sort((a, b) => b.at.localeCompare(a.at));
}

export async function saveAlert(db: Firestore, alert: MonitorAlert): Promise<void> {
  const { id, ...data } = alert;
  await setDoc(doc(db, ALERTS, id), data);
}

export async function setAlertStatus(
  db: Firestore,
  id: string,
  status: MonitorAlert["status"]
): Promise<void> {
  await updateDoc(doc(db, ALERTS, id), { status });
}

export async function deleteAlert(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, ALERTS, id));
}

/* ── Acoperirea story-urilor (source-neutrality) ───────────── */

const STORY_COVERAGE = "story_coverage";

/** Acoperirea salvată a story-urilor unui workspace, indexată după storyId. */
export async function loadStoryCoverage(
  db: Firestore,
  workspace: Workspace
): Promise<Map<string, StoryCoverageDoc>> {
  const snap = await getDocs(collection(db, STORY_COVERAGE));
  const map = new Map<string, StoryCoverageDoc>();
  for (const d of snap.docs) {
    const doc = { storyId: d.id, ...d.data() } as StoryCoverageDoc;
    if (doc.workspace === workspace) map.set(d.id, doc);
  }
  return map;
}

export async function saveStoryCoverage(
  db: Firestore,
  coverage: StoryCoverageDoc
): Promise<void> {
  const { storyId, ...data } = coverage;
  await setDoc(doc(db, STORY_COVERAGE, storyId), data);
}

/* ── Starea editorială (workflow) — SEPARATĂ de dovezi ─────── */

const WORKFLOW = "workflow";
const BRIEFS = "briefs";

/** Toate stările de workflow ale unui workspace, indexate după storyId. */
export async function loadWorkflow(
  db: Firestore,
  workspace: Workspace
): Promise<Map<string, WorkflowItem>> {
  const snap = await getDocs(collection(db, WORKFLOW));
  const map = new Map<string, WorkflowItem>();
  for (const d of snap.docs) {
    const w = { storyId: d.id, ...d.data() } as WorkflowItem;
    if (w.workspace === workspace) map.set(d.id, w);
  }
  return map;
}

export async function saveWorkflow(
  db: Firestore,
  item: WorkflowItem
): Promise<void> {
  const { storyId, ...data } = item;
  await setDoc(doc(db, WORKFLOW, storyId), {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function loadWorkflowItem(
  db: Firestore,
  storyId: string
): Promise<WorkflowItem | null> {
  const snap = await getDoc(doc(db, WORKFLOW, storyId));
  if (!snap.exists()) return null;
  return { storyId, ...snap.data() } as WorkflowItem;
}

/* ── Istoricul brief-urilor zilnice ────────────────────────── */

export async function saveBrief(db: Firestore, brief: DailyBrief): Promise<void> {
  await setDoc(doc(db, BRIEFS, `${brief.workspace}-${brief.date}`), brief);
}

export async function loadBrief(
  db: Firestore,
  workspace: Workspace,
  date: string
): Promise<DailyBrief | null> {
  const snap = await getDoc(doc(db, BRIEFS, `${workspace}-${date}`));
  if (!snap.exists()) return null;
  return snap.data() as DailyBrief;
}

/** Ultimele brief-uri ale unui workspace, cel mai recent primul. */
export async function loadBriefHistory(
  db: Firestore,
  workspace: Workspace,
  limit = 14
): Promise<DailyBrief[]> {
  const snap = await getDocs(collection(db, BRIEFS));
  return snap.docs
    .map((d) => d.data() as DailyBrief)
    .filter((b) => b.workspace === workspace)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}
