/**
 * Încarcă articolele demonstrative în Firestore.
 *
 * Rulare:  npm run seed
 * Cerințe: .env.local completat cu configul Firebase și reguli Firestore
 *          care permit scrierea (modul test) sau rulare înainte de a
 *          restrânge regulile.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initializeApp } from "firebase/app";
import { doc, getFirestore, setDoc } from "firebase/firestore/lite";
import { DEMO_ARTICOLE, DEMO_TICKER } from "../src/lib/demo-articles";

// Încarcă .env.local (fără dependențe externe)
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*)"?\s*$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!projectId) {
  console.error("Lipsește NEXT_PUBLIC_FIREBASE_PROJECT_ID din .env.local");
  process.exit(1);
}

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
});
const db = getFirestore(app);

console.log(`Încarc ${DEMO_ARTICOLE.length} articole în proiectul "${projectId}"...`);
for (const { id, ...campuri } of DEMO_ARTICOLE) {
  await setDoc(doc(db, "articles", id), campuri);
  console.log(`  ✓ articles/${id}`);
}
await setDoc(doc(db, "config", "ticker"), { items: DEMO_TICKER });
console.log("  ✓ config/ticker");
console.log("Gata. Verifică în consola Firebase → Firestore Database.");
