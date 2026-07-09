/**
 * Pipeline-ul de import — sursă unică de adevăr pentru aducerea știrilor.
 * Folosit de AI Inbox (refresh manual) și de Automation Center (manual/auto).
 *
 * Pași: încarcă sursele → cheamă /api/inbox/refresh → salvează itemele noi
 * (aplicând regulile) → actualizează sănătatea surselor → scrie log de import.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore/lite";
import type { Firestore } from "firebase/firestore/lite";
import type { Auth } from "firebase/auth";
import { callApi, hashLink } from "@/app/admin/api";
import type { InboxScoredItem } from "@/lib/ai-types";
import {
  DEFAULT_AUTOMATION,
  DEFAULT_SOURCES,
  applyHealth,
  isDue,
  newSource,
  type AutomationConfig,
  type ImportLog,
  type RssSource,
  type SourceSyncResult,
} from "@/lib/engine/sources";

export async function loadSources(db: Firestore): Promise<RssSource[]> {
  const snap = await getDocs(collection(db, "sources"));
  if (snap.empty) {
    // Prima rulare: inserăm sursele implicite
    const batch = writeBatch(db);
    for (const s of DEFAULT_SOURCES) {
      const { id, ...rest } = s;
      batch.set(doc(db, "sources", id), newSource({ ...rest, trusted: true }));
    }
    await batch.commit();
    return DEFAULT_SOURCES.map((s) => {
      const { id, ...rest } = s;
      return { id, ...newSource({ ...rest, trusted: true }) };
    });
  }
  return snap.docs.map((d) => ({ ...(d.data() as Omit<RssSource, "id">), id: d.id }));
}

export async function loadAutomationConfig(
  db: Firestore
): Promise<AutomationConfig> {
  const snap = await getDoc(doc(db, "config", "automation"));
  if (!snap.exists()) return DEFAULT_AUTOMATION;
  const data = snap.data() as Partial<AutomationConfig>;
  return {
    ...DEFAULT_AUTOMATION,
    ...data,
    rules: { ...DEFAULT_AUTOMATION.rules, ...(data.rules ?? {}) },
  };
}

export interface ImportSummary {
  added: number;
  autoApproved: number;
  itemsFound: number;
  sourcesChecked: number;
  errors: { source: string; message: string }[];
}

export async function runImport(opts: {
  db: Firestore;
  auth: Auth;
  trigger: "manual" | "auto";
  /** Doar sursele „due" (pentru rulările automate) */
  onlyDue?: boolean;
}): Promise<ImportSummary> {
  const { db, auth, trigger } = opts;
  const start = Date.now();
  const [allSources, config] = await Promise.all([
    loadSources(db),
    loadAutomationConfig(db),
  ]);

  let active = allSources.filter((s) => s.enabled && !s.blocked);
  if (opts.onlyDue) active = active.filter((s) => isDue(s, config.intervalMinutes));
  if (active.length === 0) {
    return { added: 0, autoApproved: 0, itemsFound: 0, sourcesChecked: 0, errors: [] };
  }

  const byName = new Map(active.map((s) => [s.name, s]));

  const { items, perSource, feedErrors } = await callApi<{
    items: InboxScoredItem[];
    perSource: SourceSyncResult[];
    feedErrors: string[];
  }>(auth, "/api/inbox/refresh", {
    sources: active.map((s) => ({ id: s.id, name: s.name, url: s.url })),
  });

  // Itemele existente în inbox — pentru dedup
  const existingSnap = await getDocs(collection(db, "inbox"));
  const existing = new Set(existingSnap.docs.map((d) => d.id));

  const rule = config.rules.autoApprove;
  let added = 0;
  let autoApproved = 0;

  for (const item of items) {
    if (!item.keep) continue;
    if (added >= config.maxPerRun) break; // rate limiting
    const id = hashLink(item.link);
    if (existing.has(id)) continue;

    const source = byName.get(item.sursa);
    const approve =
      rule.enabled &&
      item.importanceScore >= rule.minImportance &&
      item.trustScore >= rule.minTrust &&
      (!rule.trustedOnly || !!source?.trusted);

    await setDoc(doc(db, "inbox", id), {
      ...item,
      status: approve ? "approved" : "new",
      addedAt: new Date().toISOString(),
      autoImported: trigger === "auto",
    });
    added++;
    if (approve) autoApproved++;
  }

  // Actualizăm sănătatea fiecărei surse sincronizate
  const resultById = new Map(perSource.map((r) => [r.id, r]));
  await Promise.all(
    active.map(async (source) => {
      const result = resultById.get(source.id);
      if (!result) return;
      const patch = applyHealth(source, result);
      try {
        await updateDoc(doc(db, "sources", source.id), patch);
      } catch {
        /* sursă ștearsă între timp — ignorăm */
      }
    })
  );

  // Log de import
  const errors = feedErrors.map((e) => {
    const [source, ...rest] = e.split(":");
    return { source: source.trim(), message: rest.join(":").trim() };
  });
  const logId = `${Date.now()}`;
  const log: Omit<ImportLog, "id"> = {
    at: new Date().toISOString(),
    durationMs: Date.now() - start,
    sourcesChecked: active.length,
    itemsFound: items.length,
    itemsAdded: added,
    autoApproved,
    errors,
    trigger,
  };
  await setDoc(doc(db, "import_logs", logId), log);

  return {
    added,
    autoApproved,
    itemsFound: items.length,
    sourcesChecked: active.length,
    errors,
  };
}
