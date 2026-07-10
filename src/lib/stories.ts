/**
 * Accesul public (server-side) la Story-uri — pregătirea backend-ului pentru
 * viitoarele pagini: Live Story, Timeline, Breaking, pagini de entitate.
 * NU există încă pagini publice; acest modul doar expune datele.
 */
import { collection, doc, getDoc, getDocs } from "firebase/firestore/lite";
import { getDb } from "./firebase";
import { getArticles, type Article } from "./articles";
import type { Story, StoryStatus } from "./engine/story";

function fromDoc(id: string, data: Record<string, unknown>): Story {
  return { ...(data as Omit<Story, "id">), id };
}

/** Story-urile publice, cele mai recente întâi. Opțional filtrate pe status. */
export async function getStories(options?: {
  status?: StoryStatus;
  limit?: number;
}): Promise<Story[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, "stories"));
    let stories = snap.docs
      .map((d) => fromDoc(d.id, d.data()))
      .filter((s) => s.status !== "archived");
    if (options?.status) {
      stories = stories.filter((s) => s.status === options.status);
    }
    stories.sort(
      (a, b) =>
        new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
    );
    return options?.limit ? stories.slice(0, options.limit) : stories;
  } catch {
    return [];
  }
}

/** Story-urile breaking active — pentru viitoarele pagini/bannere breaking. */
export async function getBreakingStories(limit = 5): Promise<Story[]> {
  return getStories({ status: "breaking", limit });
}

export async function getStoryById(id: string): Promise<Story | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, "stories", id));
    return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
  } catch {
    return null;
  }
}

/** Articolele publicate ale unui story (pentru paginile Live Story/Timeline). */
export async function getArticlesForStory(storyId: string): Promise<Article[]> {
  const articole = await getArticles();
  return articole.filter((a) => a.storyId === storyId);
}

/**
 * Story-urile în care apare o entitate (persoană/loc/organizație/temă) —
 * fundația viitoarelor pagini de entitate.
 */
export async function getStoriesForEntity(name: string): Promise<Story[]> {
  const needle = name.trim().toLowerCase();
  if (!needle) return [];
  const stories = await getStories();
  return stories.filter((s) =>
    [...s.entities, ...s.people, ...s.locations, ...s.organizations].some(
      (e) => e.toLowerCase() === needle
    )
  );
}
