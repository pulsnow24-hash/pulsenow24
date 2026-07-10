/**
 * Operațiile Firestore pentru Story-uri (colecția "stories").
 * Folosit de pipeline-ul de import și de Studio. Logica de domeniu (scoruri,
 * timeline) stă în lib/engine/story.ts — aici doar citim/scriem.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  type Firestore,
} from "firebase/firestore/lite";
import {
  applySignal,
  attachArticle,
  createStory,
  slugifyStoryId,
  type NewStoryDefinition,
  type Story,
  type StorySignal,
} from "@/lib/engine/story";

function fromDoc(id: string, data: Record<string, unknown>): Story {
  return { ...(data as Omit<Story, "id">), id };
}

/** Curăță câmpurile undefined — Firestore le respinge. */
function sanitize(story: Omit<Story, "id">): Record<string, unknown> {
  const out: Record<string, unknown> = { ...story };
  for (const key of Object.keys(out)) {
    if (out[key] === undefined) delete out[key];
  }
  return out;
}

export async function getStory(
  db: Firestore,
  id: string
): Promise<Story | null> {
  const snap = await getDoc(doc(db, "stories", id));
  return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
}

export async function saveStory(db: Firestore, story: Story): Promise<void> {
  const { id, ...rest } = story;
  await setDoc(doc(db, "stories", id), sanitize(rest));
}

/**
 * Story-urile active (nearhivate, actualizate recent) — candidatele pentru
 * potrivirea AI. Limităm contextul trimis modelului.
 */
export async function getActiveStories(
  db: Firestore,
  maxAgeDays = 14,
  maxCount = 40
): Promise<Story[]> {
  const snap = await getDocs(collection(db, "stories"));
  const cutoff = Date.now() - maxAgeDays * 86400_000;
  return snap.docs
    .map((d) => fromDoc(d.id, d.data()))
    .filter(
      (s) =>
        s.status !== "archived" &&
        new Date(s.lastUpdated).getTime() >= cutoff
    )
    .sort(
      (a, b) =>
        new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
    )
    .slice(0, maxCount);
}

/** Creează un story nou (din definiția AI) și îl persistă. */
export async function createAndSaveStory(
  db: Firestore,
  def: NewStoryDefinition,
  categorie: string,
  countryCode: string
): Promise<Story> {
  const id = slugifyStoryId(def.title);
  const story: Story = { id, ...createStory(def, categorie, countryCode) };
  await saveStory(db, story);
  return story;
}

/** Aplică un semnal pe un story (în memorie) — apelantul salvează la final. */
export function applySignalInMemory(story: Story, signal: StorySignal): Story {
  return applySignal(story, signal);
}

/**
 * Leagă un articol de story-ul lui (la salvarea din Studio).
 * Idempotent: articolele deja legate doar împrospătează lastUpdated.
 */
export async function linkArticleToStory(
  db: Firestore,
  storyId: string,
  article: { id: string; titlu: string; imagine?: string }
): Promise<Story | null> {
  const story = await getStory(db, storyId);
  if (!story) return null;
  const next = attachArticle(story, article);
  await saveStory(db, next);
  return next;
}

/**
 * Asigură un Story pentru un articol scris manual (fără storyId).
 * Nu folosește AI — derivă definiția direct din articol. Backward compatible:
 * articolele vechi rămân fără story până sunt editate și salvate din nou.
 */
export async function ensureStoryForArticle(
  db: Firestore,
  article: {
    id: string;
    titlu: string;
    sumar: string;
    categorie: string;
    taguri?: string[];
    imagine?: string;
  }
): Promise<Story> {
  const def: NewStoryDefinition = {
    title: article.titlu.slice(0, 80),
    summary: article.sumar || article.titlu,
    entities: article.taguri ?? [],
    people: [],
    locations: [],
    organizations: [],
  };
  const created = await createAndSaveStory(db, def, article.categorie, "RO");
  const withArticle = attachArticle(created, article);
  await saveStory(db, withArticle);
  return withArticle;
}
