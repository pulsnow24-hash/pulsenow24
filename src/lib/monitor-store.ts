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
