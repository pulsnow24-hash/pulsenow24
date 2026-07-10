/**
 * Operațiile Firestore pentru entități (colecția "entities").
 * Logica de domeniu (potrivire, aliasuri, agregate) stă în engine/entity.ts.
 */
import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore/lite";
import {
  applyMention,
  canonicalize,
  createEntity,
  matchEntity,
  ENTITY_TYPES,
  type Entity,
  type EntityType,
  type ExtractedEntity,
} from "@/lib/engine/entity";
import type { ExtractedEntityRaw } from "@/lib/ai-types";

export function fromDoc(id: string, data: Record<string, unknown>): Entity {
  return { ...(data as Omit<Entity, "id">), id };
}

export async function loadEntities(db: Firestore): Promise<Entity[]> {
  const snap = await getDocs(collection(db, "entities"));
  return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

export async function saveEntity(db: Firestore, entity: Entity): Promise<void> {
  const { id, ...rest } = entity;
  await setDoc(doc(db, "entities", id), rest);
}

function isValidType(t: string): t is EntityType {
  return (ENTITY_TYPES as string[]).includes(t);
}

/** Un semnal cu entitățile lui extrase, gata de procesare. */
export interface SignalEntities {
  storyId?: string;
  articleId?: string;
  importance: number;
  entities: ExtractedEntityRaw[];
}

/**
 * Rezolvă și aplică mențiunile de entități pentru un lot de semnale, în
 * memorie, pornind de la indexul existent. Întoarce entitățile modificate
 * (de persistat) — o singură scriere per entitate atinsă.
 */
export function resolveMentions(
  existing: Entity[],
  signals: SignalEntities[]
): Entity[] {
  // Index viu: pornim de la entitățile existente și îl îmbogățim pe parcurs
  const index: Entity[] = [...existing];
  const touched = new Map<string, Entity>();

  for (const signal of signals) {
    // 1) Canonicalizăm și rezolvăm fiecare candidat la o entitate din index
    const resolved: { entity: Entity; candidate: ExtractedEntity }[] = [];
    for (const raw of signal.entities) {
      if (!raw.name?.trim() || !isValidType(raw.type)) continue;
      const candidate = canonicalize({
        name: raw.name.trim(),
        type: raw.type,
        aliases: (raw.aliases ?? []).filter(Boolean),
      });
      let entity = matchEntity(candidate, index);
      if (!entity) {
        entity = createEntity(candidate);
        index.push(entity);
      }
      // Evităm dubla mențiune a aceleiași entități în același semnal
      if (!resolved.some((r) => r.entity.id === entity!.id)) {
        resolved.push({ entity, candidate });
      }
    }

    // 2) Aplicăm mențiunile, cu co-ocurență între entitățile semnalului
    const ids = resolved.map((r) => r.entity.id);
    for (const { entity, candidate } of resolved) {
      const updated = applyMention(touched.get(entity.id) ?? entity, {
        storyId: signal.storyId,
        articleId: signal.articleId,
        importance: signal.importance,
        coEntityIds: ids,
        newAliases: candidate.aliases,
      });
      touched.set(entity.id, updated);
      // Ținem indexul sincronizat pentru potrivirile următoare
      const pos = index.findIndex((e) => e.id === entity.id);
      if (pos >= 0) index[pos] = updated;
    }
  }

  return [...touched.values()];
}

/**
 * Leagă un articol de entitățile story-ului lui (la salvarea din Studio).
 * Operație aditivă, fail-safe — apelantul o împachetează în try/catch.
 */
export async function linkArticleToEntities(
  db: Firestore,
  storyId: string,
  articleId: string
): Promise<number> {
  const entities = await loadEntities(db);
  const related = entities.filter((e) => e.relatedStoryIds.includes(storyId));
  await Promise.all(
    related.map((e) =>
      updateDoc(doc(db, "entities", e.id), {
        relatedArticleIds: arrayUnion(articleId),
      })
    )
  );
  return related.length;
}
