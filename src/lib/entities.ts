/**
 * Accesul public (server-side) la entități — pregătirea backend-ului pentru
 * viitoarele pagini de entitate. NU există încă pagini publice.
 */
import { collection, doc, getDoc, getDocs } from "firebase/firestore/lite";
import { getDb } from "./firebase";
import type { Entity, EntityType } from "./engine/entity";
import { normalizeAlias, aliasKeys } from "./engine/entity";

function fromDoc(id: string, data: Record<string, unknown>): Entity {
  return { ...(data as Omit<Entity, "id">), id };
}

async function allEntities(): Promise<Entity[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, "entities"));
    return snap.docs.map((d) => fromDoc(d.id, d.data()));
  } catch {
    return [];
  }
}

/** Cele mai menționate entități, opțional filtrate pe tip. */
export async function getTopEntities(options?: {
  type?: EntityType;
  limit?: number;
}): Promise<Entity[]> {
  let entities = await allEntities();
  if (options?.type) entities = entities.filter((e) => e.type === options.type);
  entities.sort((a, b) => b.mentionCount - a.mentionCount);
  return entities.slice(0, options?.limit ?? 20);
}

/** Entitățile cu cea mai rapidă creștere a mențiunilor. */
export async function getTrendingEntities(limit = 10): Promise<Entity[]> {
  const entities = await allEntities();
  return entities
    .filter((e) => e.trendScore > 0)
    .sort((a, b) => b.trendScore - a.trendScore || b.mentionCount - a.mentionCount)
    .slice(0, limit);
}

export async function getEntityById(id: string): Promise<Entity | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, "entities", id));
    return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
  } catch {
    return null;
  }
}

/** Rezolvă un nume (sau alias) la entitatea canonică. */
export async function findEntityByName(name: string): Promise<Entity | null> {
  const needle = normalizeAlias(name);
  if (!needle) return null;
  const entities = await allEntities();
  return entities.find((e) => aliasKeys(e).includes(needle)) ?? null;
}

/** Entitățile legate de o entitate dată (co-ocurență), cele mai active întâi. */
export async function getRelatedEntities(id: string, limit = 10): Promise<Entity[]> {
  const entity = await getEntityById(id);
  if (!entity) return [];
  const entities = await allEntities();
  const byId = new Map(entities.map((e) => [e.id, e]));
  return entity.relatedEntityIds
    .map((rid) => byId.get(rid))
    .filter((e): e is Entity => !!e)
    .sort((a, b) => b.mentionCount - a.mentionCount)
    .slice(0, limit);
}
