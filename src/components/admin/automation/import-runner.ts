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
import type {
  EntityExtractionResult,
  InboxScoredItem,
  StoryAssignmentResult,
} from "@/lib/ai-types";
import type { Story } from "@/lib/engine/story";
import {
  applySignalInMemory,
  createAndSaveStory,
  getActiveStories,
  saveStory,
} from "@/lib/story-store";
import {
  loadEntities,
  resolveMentions,
  saveEntity,
  type SignalEntities,
} from "@/lib/entity-store";
import {
  DEFAULT_AUTOMATION,
  DEFAULT_SOURCES,
  applyHealth,
  isDue,
  newSource,
  trustScore,
  type AutomationConfig,
  type ImportLog,
  type RssSource,
  type SourceSyncResult,
} from "@/lib/engine/sources";
import {
  ALERT_TYPES,
  computeStoryCoverage,
  deriveAlerts,
  verdictToConflict,
  itemWorkspaces,
  matchKeywords,
  sourceSyncMode,
  type AlertType,
  type LocalAnalysis,
  type MonitorAlert,
  type Workspace,
} from "@/lib/engine/workspace";
import {
  loadWorkspaceConfig,
  saveAlert,
  saveStoryCoverage,
} from "@/lib/monitor-store";
import type {
  ConsistencyRaw,
  ConsistencyResult,
  LocalAnalysisResult,
} from "@/lib/ai-types";
import { computeConfidence } from "@/lib/engine/confidence";

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

/** Promisiune cu limită de timp: importul nu are voie să rămână blocat. */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  step: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            `Pasul „${step}" nu a răspuns în ${Math.round(timeoutMs / 1000)}s și a fost întrerupt`
          )
        ),
      timeoutMs
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
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

  // Fiecare fază e cronometrată și limitată în timp; duratele ajung în log,
  // ca să se vadă exact care pas a durat (sau a fost întrerupt).
  const phaseMs: Record<string, number> = {};
  const phase = async <T>(
    name: string,
    timeoutMs: number,
    fn: () => Promise<T>
  ): Promise<T> => {
    const t0 = Date.now();
    try {
      return await withTimeout(fn(), timeoutMs, name);
    } finally {
      phaseMs[name] = Date.now() - t0;
    }
  };

  const [allSources, config] = await phase("config", 30_000, () =>
    Promise.all([loadSources(db), loadAutomationConfig(db)])
  );

  // Doar sursele cu flux (RSS & co.) se sincronizează automat; cele care
  // cer conector (Facebook, website, custom) sunt stocate dar nu simulate.
  let active = allSources.filter(
    (s) => s.enabled && !s.blocked && sourceSyncMode(s.kind ?? "rss") === "feed"
  );
  if (opts.onlyDue) active = active.filter((s) => isDue(s, config.intervalMinutes));
  if (active.length === 0) {
    return { added: 0, autoApproved: 0, itemsFound: 0, sourcesChecked: 0, errors: [] };
  }

  const byName = new Map(active.map((s) => [s.name, s]));

  // Cel mai lung pas legitim: descărcarea feed-urilor + scoringul AI.
  // Serverul are propriile timeout-uri (feed 10s, AI 180s + 1 retry).
  const { items, perSource, feedErrors } = await phase(
    "feeds+scoring",
    420_000,
    () =>
      callApi<{
        items: InboxScoredItem[];
        perSource: SourceSyncResult[];
        feedErrors: string[];
      }>(
        auth,
        "/api/inbox/refresh",
        { sources: active.map((s) => ({ id: s.id, name: s.name, url: s.url })) },
        410_000
      )
  );

  // Itemele existente în inbox — pentru dedup
  const existing = await phase("dedup", 30_000, async () => {
    const snap = await getDocs(collection(db, "inbox"));
    return new Set(snap.docs.map((d) => d.id));
  });

  const rule = config.rules.autoApprove;
  const fresh = items.filter(
    (item) => item.keep && !existing.has(hashLink(item.link))
  );

  // ── Story Engine: fiecare semnal nou aparține unui Story ──
  // Eșecul asignării nu blochează importul (itemele rămân fără storyId).
  const storyIdByIndex = new Map<number, string>();
  const storiesById = new Map<string, Story>();
  if (fresh.length > 0) {
    try {
      const candidates = await phase("story-index", 30_000, () =>
        getActiveStories(db)
      );
      for (const s of candidates) storiesById.set(s.id, s);
      const result = await phase("story-assign", 190_000, () =>
        callApi<StoryAssignmentResult>(
          auth,
          "/api/stories/assign",
          {
            items: fresh.map((i) => ({
              titlu: i.titlu,
              descriere: i.descriere,
              sursa: i.sursa,
              categorie: i.categorie,
              countryCode: i.countryCode,
            })),
            candidates: candidates.map((s) => ({
              id: s.id,
              title: s.title,
              summary: s.summary,
              entities: [...s.entities, ...s.people, ...s.organizations],
            })),
          },
          180_000
        )
      );
      // Creăm story-urile noi propuse de AI
      const refToId = new Map<string, string>();
      await phase("story-create", 60_000, async () => {
        for (const def of result.newStories) {
          // Categoria/țara story-ului: din primul item asignat acestui ref
          const firstIdx = result.assignments.find(
            (a) => a.storyRef === def.ref
          )?.index;
          const seed = firstIdx !== undefined ? fresh[firstIdx] : undefined;
          const story = await createAndSaveStory(
            db,
            def,
            seed?.categorie ?? "Actualitate",
            seed?.countryCode ?? "RO"
          );
          refToId.set(def.ref, story.id);
          storiesById.set(story.id, story);
        }
      });
      for (const a of result.assignments) {
        const storyId = a.storyRef.startsWith("NEW::")
          ? refToId.get(a.storyRef)
          : storiesById.has(a.storyRef)
            ? a.storyRef
            : undefined;
        if (storyId) storyIdByIndex.set(a.index, storyId);
      }
    } catch (err) {
      feedErrors.push(
        `Story Engine: ${err instanceof Error ? err.message : "asignare eșuată"}`
      );
    }
  }

  // ── Monitor local (workspace Vâlcea): etichete + analiză AI ──
  // Complet fail-safe: orice eroare aici NU blochează importul.
  const wsByIndex = new Map<number, Workspace[]>();
  const localByIndex = new Map<number, LocalAnalysis>();
  if (fresh.length > 0) {
    try {
      const cfg = await phase("monitor-config", 30_000, () =>
        loadWorkspaceConfig(db)
      );
      const valceaSources = new Set(
        allSources.filter((s) => s.workspace === "valcea").map((s) => s.name)
      );
      const kwByIndex = new Map<number, string[]>();
      const candidates: number[] = [];
      fresh.forEach((item, i) => {
        const kws = matchKeywords(`${item.titlu} ${item.descriere}`, cfg.keywords);
        kwByIndex.set(i, kws);
        wsByIndex.set(
          i,
          itemWorkspaces(kws, valceaSources.has(item.sursa) ? "valcea" : undefined)
        );
        if (wsByIndex.get(i)!.includes("valcea")) candidates.push(i);
      });

      if (candidates.length > 0) {
        const analysis = await phase("local-analysis", 160_000, () =>
          callApi<LocalAnalysisResult>(
            auth,
            "/api/monitor/analyze",
            {
              items: candidates.map((i) => ({
                titlu: fresh[i].titlu,
                descriere: fresh[i].descriere,
              })),
              region: "județul Vâlcea",
              institutions: cfg.institutions.map((x) => x.name),
            },
            150_000
          )
        );
        const raw = new Map(analysis.items.map((x) => [x.index, x]));
        candidates.forEach((itemIdx, batchIdx) => {
          const r = raw.get(batchIdx);
          if (!r) return;
          const alertType =
            r.alertType !== "none" && ALERT_TYPES.includes(r.alertType as AlertType)
              ? (r.alertType as AlertType)
              : null;
          const pct = (n: number) =>
            Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
          localByIndex.set(itemIdx, {
            relevance: pct(r.relevance),
            institutionScore: pct(r.institutionScore),
            publicInterest: pct(r.publicInterest),
            urgency: r.urgency,
            priority: pct(r.priority),
            commScore: pct(r.commScore),
            ...(r.suggestion?.trim() ? { suggestion: r.suggestion.trim() } : {}),
            institutions: r.institutions,
            keywords: kwByIndex.get(itemIdx) ?? [],
            alertType,
          });
        });
      }
    } catch (err) {
      feedErrors.push(
        `Monitor local: ${err instanceof Error ? err.message : "analiză eșuată"}`
      );
    }
  }

  let added = 0;
  let autoApproved = 0;
  const writtenIndexes = new Set<number>();

  await phase("inbox-write", 120_000, async () => {
    for (let i = 0; i < fresh.length; i++) {
      const item = fresh[i];
      if (added >= config.maxPerRun) break; // rate limiting
      const id = hashLink(item.link);

      const source = byName.get(item.sursa);
      const approve =
        rule.enabled &&
        item.importanceScore >= rule.minImportance &&
        item.trustScore >= rule.minTrust &&
        (!rule.trustedOnly || !!source?.trusted);

      const storyId = storyIdByIndex.get(i);
      const local = localByIndex.get(i);
      await setDoc(doc(db, "inbox", id), {
        ...item,
        ...(storyId ? { storyId } : {}),
        workspaces: wsByIndex.get(i) ?? ["national"],
        ...(local ? { local } : {}),
        status: approve ? "approved" : "new",
        addedAt: new Date().toISOString(),
        autoImported: trigger === "auto",
      });
      added++;
      writtenIndexes.add(i);
      if (approve) autoApproved++;

      // Actualizăm story-ul cu semnalul (scoruri, timeline, coroborare)
      if (storyId) {
        const story = storiesById.get(storyId);
        if (story) {
          storiesById.set(
            storyId,
            applySignalInMemory(story, {
              refId: id,
              titlu: item.titlu,
              sursa: item.sursa,
              publicatLa: item.publicatLa,
              importanceScore: item.importanceScore,
              trustScore: item.trustScore,
              countryCode: item.countryCode,
            })
          );
        }
      }
    }
  });

  // Persistăm story-urile atinse (o singură scriere per story).
  // Eșecul nu blochează importul — itemele sunt deja în inbox.
  try {
    const touchedStories = [...storiesById.values()].filter((s) =>
      [...storyIdByIndex.values()].includes(s.id)
    );
    await phase("story-save", 60_000, () =>
      Promise.all(touchedStories.map((s) => saveStory(db, s)))
    );
  } catch (err) {
    feedErrors.push(
      `Story Engine: ${err instanceof Error ? err.message : "salvare eșuată"}`
    );
  }

  // ── Entity Intelligence: extragem și agregăm entitățile semnalelor ──
  // Complet fail-safe: orice eroare aici NU blochează importul.
  if (fresh.length > 0) {
    try {
      const extraction = await phase("entity-extract", 190_000, () =>
        callApi<EntityExtractionResult>(
          auth,
          "/api/entities/extract",
          {
            items: fresh.map((i) => ({ titlu: i.titlu, descriere: i.descriere })),
          },
          180_000
        )
      );
      const byIndex = new Map(extraction.items.map((x) => [x.index, x.entities]));
      const signals: SignalEntities[] = fresh.map((item, i) => ({
        storyId: storyIdByIndex.get(i),
        importance: item.importanceScore,
        entities: byIndex.get(i) ?? [],
      }));
      const existingEntities = await phase("entity-index", 60_000, () =>
        loadEntities(db)
      );
      const touched = resolveMentions(existingEntities, signals);
      await phase("entity-save", 60_000, () =>
        Promise.all(touched.map((e) => saveEntity(db, e)))
      );
    } catch (err) {
      feedErrors.push(
        `Entity Engine: ${err instanceof Error ? err.message : "extracție eșuată"}`
      );
    }
  }

  // ── Monitor local: alertele semnalelor analizate (fail-safe) ──
  if (localByIndex.size > 0) {
    try {
      const now = new Date().toISOString();
      const alerts: MonitorAlert[] = [];
      for (const [i, la] of localByIndex) {
        if (!writtenIndexes.has(i)) continue; // doar itemele salvate în inbox
        const item = fresh[i];
        alerts.push(
          ...deriveAlerts(
            {
              id: hashLink(item.link),
              titlu: item.titlu,
              sursa: item.sursa,
              storyId: storyIdByIndex.get(i),
            },
            la,
            now
          )
        );
      }
      if (alerts.length > 0) {
        await phase("alerts", 30_000, () =>
          Promise.all(alerts.map((a) => saveAlert(db, a)))
        );
      }
    } catch (err) {
      feedErrors.push(
        `Monitor local: alerte — ${err instanceof Error ? err.message : "scriere eșuată"}`
      );
    }
  }

  // ── Acoperirea story-urilor locale (source-neutrality, fail-safe) ──
  // Pentru story-urile locale atinse: surse independente + clase, analiza
  // BOGATĂ de consistență (rezumate, entități, cifre-cheie, cronologie —
  // evoluția în timp NU e conflict) și scorul Confidence Engine.
  {
    const localStoryIds = new Set(
      [...localByIndex.keys()]
        .map((i) => storyIdByIndex.get(i))
        .filter((id): id is string => !!id)
    );
    if (localStoryIds.size > 0) {
      try {
        const now = new Date().toISOString();
        const touched = [...localStoryIds]
          .map((id) => storiesById.get(id))
          .filter((s): s is Story => !!s);

        const coverageById = new Map(
          touched.map((s) => [
            s.id,
            computeStoryCoverage(s.sources, allSources),
          ])
        );

        // Descrierile semnalelor proaspete, pe story (pentru comparația bogată)
        const freshByStory = new Map<string, Map<string, string>>();
        for (const [i, storyId] of storyIdByIndex) {
          const item = fresh[i];
          if (!item?.descriere) continue;
          if (!freshByStory.has(storyId)) freshByStory.set(storyId, new Map());
          freshByStory.get(storyId)!.set(item.titlu, item.descriere);
        }

        // Consistență: doar story-urile cu ≥2 surse independente
        const verdictById = new Map<
          string,
          { verdict: ConsistencyRaw["verdict"]; note: string }
        >();
        const multi = touched.filter(
          (s) => (coverageById.get(s.id)?.independentSources ?? 0) >= 2
        );
        if (multi.length > 0) {
          const payload = multi.map((s) => ({
            title: s.title,
            summary: s.summary,
            entities: [
              ...s.entities,
              ...s.people,
              ...s.locations,
              ...s.organizations,
            ],
            signals: s.timeline
              .filter((e) => e.type === "signal")
              .slice(-8)
              .map((e) => ({
                sursa: e.source ?? "Sursă",
                titlu: e.title,
                at: e.at,
                descriere: freshByStory.get(s.id)?.get(e.title),
              })),
          }));
          const res = await phase("story-consistency", 160_000, () =>
            callApi<ConsistencyResult>(
              auth,
              "/api/monitor/conflicts",
              { stories: payload },
              150_000
            )
          );
          res.items.forEach((r) => {
            const story = multi[r.index];
            if (story) {
              verdictById.set(story.id, {
                verdict: r.verdict,
                note: r.note?.trim() ?? "",
              });
            }
          });
        }

        await phase("story-coverage", 30_000, () =>
          Promise.all(
            touched.map((s) => {
              const cov = coverageById.get(s.id)!;
              const v = verdictById.get(s.id);
              // Scorurile de trust ale surselor story-ului, din registru
              const byName = new Map(
                allSources.map((src) => [src.name, src])
              );
              const sourceTrust = s.sources
                .map((name) => byName.get(name))
                .filter((src): src is RssSource => !!src)
                .map((src) => trustScore(src));
              const confidence = computeConfidence({
                coverage: cov,
                sourceTrust,
                verdict: v?.verdict ?? "unchecked",
                lastUpdated: s.lastUpdated,
              });
              return saveStoryCoverage(db, {
                storyId: s.id,
                workspace: "valcea",
                ...cov,
                conflict: verdictToConflict(v?.verdict),
                ...(v?.note ? { conflictNote: v.note } : {}),
                ...(v ? { consistencyDetail: v.verdict } : {}),
                confidence: confidence.score,
                confidenceLabel: confidence.label,
                updatedAt: now,
              });
            })
          )
        );
      } catch (err) {
        feedErrors.push(
          `Monitor local: acoperire — ${err instanceof Error ? err.message : "scriere eșuată"}`
        );
      }
    }
  }

  // Actualizăm sănătatea fiecărei surse sincronizate — best-effort
  try {
    const resultById = new Map(perSource.map((r) => [r.id, r]));
    await phase("source-health", 30_000, () =>
      Promise.all(
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
      )
    );
  } catch {
    /* sănătatea surselor e statistică — nu blochează importul */
  }

  // Log de import — best-effort; include durata fiecărei faze
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
    phaseMs,
  };
  try {
    await withTimeout(setDoc(doc(db, "import_logs", logId), log), 15_000, "log");
  } catch {
    /* logul e diagnostic — nu blochează importul */
  }

  return {
    added,
    autoApproved,
    itemsFound: items.length,
    sourcesChecked: active.length,
    errors,
  };
}
