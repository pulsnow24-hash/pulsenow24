/**
 * Teste pentru regulile Firestore — rulate în emulator:
 *   npx firebase emulators:exec --only firestore --project demo-pulsnow "npx tsx tests/rules.test.mts"
 *
 * Acoperă exact tiparele de acces ale aplicației: site public (neautentificat)
 * și redacție (autentificat), pe toate cele 6 colecții.
 */
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
} from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-pulsnow",
  firestore: { rules: readFileSync("firestore.rules", "utf8") },
});

let passed = 0;
let failed = 0;
async function test(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name} — ${e instanceof Error ? e.message.split("\n")[0] : e}`);
  }
}

const validStory = {
  title: "Eveniment de test",
  status: "developing",
  summary: "Rezumat.",
  categorie: "Actualitate",
  timeline: [{ at: "2026-07-10T10:00:00Z", type: "created", title: "Story creat" }],
  articleIds: [],
  sources: ["Digi24"],
  signalCount: 1,
  entities: ["tema"],
  people: [],
  locations: [],
  organizations: [],
  trustScore: 70,
  importanceScore: 80,
  breakingScore: 50,
  localityScore: 80,
  countryCode: "RO",
  createdAt: "2026-07-10T10:00:00Z",
  lastUpdated: "2026-07-10T10:00:00Z",
};

const validArticle = {
  titlu: "Articol de test",
  sumar: "Sumar",
  categorie: "Actualitate",
  badge: "blue",
  buzz: false,
  data: "10 iulie 2026",
  publicatLa: "2026-07-10T10:00:00Z",
  citire: "2 min",
  fapt: "F",
  unghi: "U",
  opinie: "O",
  predictie: "P",
  dezbatere: "D?",
  qa: [],
  status: "publicat",
  workflow: "published",
};

// Date pre-existente (scrise ocolind regulile)
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "articles", "art1"), validArticle);
  await setDoc(doc(db, "config", "ticker"), { items: ["știre"] });
  await setDoc(doc(db, "config", "automation"), { autoRefresh: false });
  await setDoc(doc(db, "inbox", "item1"), { titlu: "x", status: "new" });
  await setDoc(doc(db, "sources", "digi24"), { name: "Digi24" });
  await setDoc(doc(db, "import_logs", "log1"), { at: "2026-07-10" });
  await setDoc(doc(db, "stories", "story1"), validStory);
});

const anon = env.unauthenticatedContext().firestore();
const editor = env.authenticatedContext("editor-uid").firestore();

console.log("\nPUBLIC (site-ul, neautentificat):");
await test("citește lista de articole", () => assertSucceeds(getDocs(collection(anon, "articles"))));
await test("citește un articol", () => assertSucceeds(getDoc(doc(anon, "articles", "art1"))));
await test("citește config/ticker", () => assertSucceeds(getDoc(doc(anon, "config", "ticker"))));
await test("NU citește config/automation", () => assertFails(getDoc(doc(anon, "config", "automation"))));
await test("citește lista de stories", () => assertSucceeds(getDocs(collection(anon, "stories"))));
await test("citește un story", () => assertSucceeds(getDoc(doc(anon, "stories", "story1"))));
await test("NU scrie articole", () => assertFails(setDoc(doc(anon, "articles", "hack"), validArticle)));
await test("NU scrie stories", () => assertFails(setDoc(doc(anon, "stories", "hack"), validStory)));
await test("NU șterge stories", () => assertFails(deleteDoc(doc(anon, "stories", "story1"))));
await test("NU citește inbox", () => assertFails(getDocs(collection(anon, "inbox"))));
await test("NU citește sources", () => assertFails(getDocs(collection(anon, "sources"))));
await test("NU citește import_logs", () => assertFails(getDocs(collection(anon, "import_logs"))));

console.log("\nREDACȚIE (autentificat):");
await test("scrie articole", () => assertSucceeds(setDoc(doc(editor, "articles", "art2"), validArticle)));
await test("citește+scrie inbox", () => assertSucceeds(setDoc(doc(editor, "inbox", "item2"), { titlu: "y", status: "new" })));
await test("scrie sources", () => assertSucceeds(setDoc(doc(editor, "sources", "hotnews"), { name: "HotNews" })));
await test("scrie import_logs", () => assertSucceeds(setDoc(doc(editor, "import_logs", "log2"), { at: "2026-07-10" })));
await test("scrie config/automation", () => assertSucceeds(setDoc(doc(editor, "config", "automation"), { autoRefresh: true })));
await test("scrie config/ticker", () => assertSucceeds(setDoc(doc(editor, "config", "ticker"), { items: ["a"] })));
await test("creează story valid", () => assertSucceeds(setDoc(doc(editor, "stories", "story2"), validStory)));
await test("actualizează story valid", () => assertSucceeds(setDoc(doc(editor, "stories", "story1"), { ...validStory, signalCount: 2 })));
await test("șterge story", () => assertSucceeds(deleteDoc(doc(editor, "stories", "story2"))));

console.log("\nVALIDARE SCHEMĂ STORIES (redacție):");
await test("respinge trustScore string", () => assertFails(setDoc(doc(editor, "stories", "bad1"), { ...validStory, trustScore: "90" })));
await test("respinge trustScore 150 (interval)", () => assertFails(setDoc(doc(editor, "stories", "bad2"), { ...validStory, trustScore: 150 })));
await test("respinge status necunoscut", () => assertFails(setDoc(doc(editor, "stories", "bad3"), { ...validStory, status: "viral" })));
await test("respinge fără titlu", () => assertFails(setDoc(doc(editor, "stories", "bad4"), { ...validStory, title: "" })));
await test("respinge timeline non-listă", () => assertFails(setDoc(doc(editor, "stories", "bad5"), { ...validStory, timeline: "nu" })));
await test("respinge câmp străin", () => assertFails(setDoc(doc(editor, "stories", "bad6"), { ...validStory, hacked: true })));
await test("acceptă coverImage opțional", () => assertSucceeds(setDoc(doc(editor, "stories", "ok1"), { ...validStory, coverImage: "https://x/1.jpg" })));

const validEntity = {
  name: "SUA",
  type: "country",
  aliases: ["statele unite", "united states", "usa"],
  firstSeen: "2026-07-10T10:00:00Z",
  lastSeen: "2026-07-10T10:00:00Z",
  mentionCount: 1,
  relatedStoryIds: ["story1"],
  relatedArticleIds: [],
  relatedEntityIds: [],
  trendScore: 60,
  importanceScore: 70,
  dailyMentions: { "2026-07-10": 1 },
};

console.log("\nENTITIES:");
await test("public citește entities", async () => {
  await env.withSecurityRulesDisabled(async (ctx) =>
    setDoc(doc(ctx.firestore(), "entities", "country-sua"), validEntity)
  );
  await assertSucceeds(getDocs(collection(anon, "entities")));
});
await test("public NU scrie entities", () => assertFails(setDoc(doc(anon, "entities", "hack"), validEntity)));
await test("redacție creează entitate validă", () => assertSucceeds(setDoc(doc(editor, "entities", "country-sua2"), validEntity)));
await test("redacție update parțial (relatedArticleIds)", () => assertSucceeds(setDoc(doc(editor, "entities", "country-sua"), { relatedArticleIds: ["art1"] }, { merge: true })));
await test("respinge tip necunoscut", () => assertFails(setDoc(doc(editor, "entities", "bad1"), { ...validEntity, type: "alien" })));
await test("respinge trendScore invalid", () => assertFails(setDoc(doc(editor, "entities", "bad2"), { ...validEntity, trendScore: "sus" })));
await test("respinge dailyMentions non-map", () => assertFails(setDoc(doc(editor, "entities", "bad3"), { ...validEntity, dailyMentions: [1, 2] })));

const validAlert = {
  workspace: "valcea",
  type: "emergency",
  severity: "urgent",
  status: "new",
  title: "Urgență",
  message: "Incendiu raportat la Brezoi",
  sourceName: "TestVâlcea",
  itemId: "item1",
  institutions: ["ISU Vâlcea"],
  at: "2026-07-11T10:00:00Z",
};

console.log("\nALERTS (inteligență internă — niciodată publice):");
await test("public NU citește alerts", async () => {
  await env.withSecurityRulesDisabled(async (ctx) =>
    setDoc(doc(ctx.firestore(), "alerts", "a1"), validAlert)
  );
  await assertFails(getDocs(collection(anon, "alerts")));
});
await test("public NU scrie alerts", () => assertFails(setDoc(doc(anon, "alerts", "hack"), validAlert)));
await test("redacția citește alerts", () => assertSucceeds(getDocs(collection(editor, "alerts"))));
await test("redacția creează alertă validă", () => assertSucceeds(setDoc(doc(editor, "alerts", "a2"), validAlert)));
await test("redacția actualizează statusul", () => assertSucceeds(setDoc(doc(editor, "alerts", "a1"), { status: "dismissed" }, { merge: true })));
await test("respinge tip de alertă necunoscut", () => assertFails(setDoc(doc(editor, "alerts", "bad1"), { ...validAlert, type: "ufo" })));
await test("respinge severitate invalidă", () => assertFails(setDoc(doc(editor, "alerts", "bad2"), { ...validAlert, severity: "panic" })));
await test("respinge titlu gol", () => assertFails(setDoc(doc(editor, "alerts", "bad3"), { ...validAlert, title: "" })));
await test("redacția șterge alertă", () => assertSucceeds(deleteDoc(doc(editor, "alerts", "a2"))));

const validCoverage = {
  workspace: "valcea",
  independentSources: 3,
  officialCount: 1,
  pressCount: 2,
  socialCount: 0,
  corroborated: true,
  singleSource: false,
  diversityScore: 80,
  conflict: "consistent",
  updatedAt: "2026-07-11T10:00:00Z",
};

console.log("\nSTORY COVERAGE (source-neutrality — internă):");
await test("public NU citește story_coverage", async () => {
  await env.withSecurityRulesDisabled(async (ctx) =>
    setDoc(doc(ctx.firestore(), "story_coverage", "s1"), validCoverage)
  );
  await assertFails(getDocs(collection(anon, "story_coverage")));
});
await test("public NU scrie story_coverage", () => assertFails(setDoc(doc(anon, "story_coverage", "hack"), validCoverage)));
await test("redacția scrie acoperire validă", () => assertSucceeds(setDoc(doc(editor, "story_coverage", "s2"), validCoverage)));
await test("respinge conflict invalid", () => assertFails(setDoc(doc(editor, "story_coverage", "bad1"), { ...validCoverage, conflict: "maybe" })));
await test("respinge diversityScore >100", () => assertFails(setDoc(doc(editor, "story_coverage", "bad2"), { ...validCoverage, diversityScore: 150 })));
await test("acceptă verdictul + confidence (opționale)", () => assertSucceeds(setDoc(doc(editor, "story_coverage", "s3"), { ...validCoverage, consistencyDetail: "update", confidence: 78, confidenceLabel: "high" })));
await test("respinge verdict necunoscut", () => assertFails(setDoc(doc(editor, "story_coverage", "bad3"), { ...validCoverage, consistencyDetail: "maybe" })));
await test("respinge confidence >100", () => assertFails(setDoc(doc(editor, "story_coverage", "bad4"), { ...validCoverage, confidence: 150 })));
await test("respinge confidenceLabel invalid", () => assertFails(setDoc(doc(editor, "story_coverage", "bad5"), { ...validCoverage, confidenceLabel: "huge" })));
await test("acceptă mergeSuggestion (opțional)", () => assertSucceeds(setDoc(doc(editor, "story_coverage", "s4"), { ...validCoverage, mergeSuggestion: { storyId: "sX", storyTitle: "T", reason: "r", status: "open" } })));
await test("respinge mergeSuggestion.status invalid", () => assertFails(setDoc(doc(editor, "story_coverage", "bad6"), { ...validCoverage, mergeSuggestion: { storyId: "sX", storyTitle: "T", reason: "r", status: "maybe" } })));

// storyId trebuie să == id-ul documentului (self-describing, verificabil de reguli)
const wf = (id: string, over: Record<string, unknown> = {}) => ({
  workspace: "valcea", storyId: id, status: "reviewed", followed: true,
  notes: [], updatedAt: "2026-07-21T10:00:00Z", ...over,
});
console.log("\nWORKFLOW (stare editorială — internă, separată de dovezi):");
await test("public NU citește workflow", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), "workflow", "story1"), wf("story1")));
  await assertFails(getDocs(collection(anon, "workflow")));
});
await test("public NU scrie workflow", () => assertFails(setDoc(doc(anon, "workflow", "hack"), wf("hack"))));
await test("redacția scrie workflow valid", () => assertSucceeds(setDoc(doc(editor, "workflow", "story2"), wf("story2"))));
await test("acceptă snapshot + draft valide", () => assertSucceeds(setDoc(doc(editor, "workflow", "story3"), wf("story3", {
  reviewedAt: "2026-07-21T09:00:00Z",
  snapshot: { confidence: 70, signalCount: 3, sourceCount: 2, officialCount: 1, conflict: "consistent" },
  draft: { factualSummary: "x", confirmedFacts: [], unconfirmedClaims: [], tone: "sobru", suggestedMessage: "m", openQuestions: [], createdAt: "2026-07-21T09:00:00Z" },
}))));
await test("respinge storyId != id document", () => assertFails(setDoc(doc(editor, "workflow", "story9"), wf("ALT"))));
await test("respinge workspace necunoscut", () => assertFails(setDoc(doc(editor, "workflow", "bad0"), wf("bad0", { workspace: "berlin" }))));
await test("respinge status workflow invalid", () => assertFails(setDoc(doc(editor, "workflow", "bad1"), wf("bad1", { status: "urgent" }))));
await test("respinge notes non-listă", () => assertFails(setDoc(doc(editor, "workflow", "bad2"), wf("bad2", { notes: "x" }))));
await test("respinge followed non-bool", () => assertFails(setDoc(doc(editor, "workflow", "bad3"), wf("bad3", { followed: "da" }))));
await test("respinge snapshot malformat", () => assertFails(setDoc(doc(editor, "workflow", "bad4"), wf("bad4", { snapshot: { confidence: "sus" } }))));
await test("respinge draft malformat", () => assertFails(setDoc(doc(editor, "workflow", "bad5"), wf("bad5", { draft: { factualSummary: 5 } }))));

const brief = (id: string, over: Record<string, unknown> = {}) => {
  const [workspace, ...rest] = id.split("-");
  return { workspace, date: rest.join("-"), generatedAt: "2026-07-21T06:00:00Z", counts: { urgent: 1 }, sections: { urgent: [] }, ...over };
};
console.log("\nBRIEFS (istoric brief zilnic — intern):");
await test("public NU citește briefs", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), "briefs", "valcea-2026-07-21"), brief("valcea-2026-07-21")));
  await assertFails(getDocs(collection(anon, "briefs")));
});
await test("public NU scrie briefs", () => assertFails(setDoc(doc(anon, "briefs", "valcea-2026-07-23"), brief("valcea-2026-07-23"))));
await test("redacția scrie brief valid", () => assertSucceeds(setDoc(doc(editor, "briefs", "valcea-2026-07-22"), brief("valcea-2026-07-22"))));
await test("respinge brief fără sections", () => assertFails(setDoc(doc(editor, "briefs", "valcea-2026-07-24"), { workspace: "valcea", date: "2026-07-24", generatedAt: "y", counts: {} })));
await test("respinge id != workspace-date", () => assertFails(setDoc(doc(editor, "briefs", "valcea-WRONG"), brief("valcea-2026-07-25"))));
await test("respinge workspace brief necunoscut", () => assertFails(setDoc(doc(editor, "briefs", "berlin-2026-07-22"), brief("berlin-2026-07-22"))));

console.log("\nCONFIG WORKSPACE (monitor-valcea):");
await test("redacția scrie config/monitor-valcea", () =>
  assertSucceeds(setDoc(doc(editor, "config", "monitor-valcea"), { keywords: ["Vâlcea"], institutions: [] })));
await test("public NU citește config/monitor-valcea", () => assertFails(getDoc(doc(anon, "config", "monitor-valcea"))));

await env.cleanup();
console.log(`\nREZULTAT: ${passed} trecute, ${failed} eșuate`);
process.exit(failed ? 1 : 0);
