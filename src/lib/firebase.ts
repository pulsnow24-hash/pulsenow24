/**
 * Inițializarea Firebase.
 *
 * Configul e citit din (în ordine):
 *  1. FIREBASE_WEBAPP_CONFIG — injectat automat de Firebase App Hosting în producție
 *  2. Variabilele NEXT_PUBLIC_FIREBASE_* din .env.local — pentru dezvoltare locală
 *
 * Dacă niciuna nu există, getDb() întoarce null și site-ul folosește
 * articolele demonstrative din demo-articles.ts.
 */
import {
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore/lite";

function getConfig(): FirebaseOptions | null {
  if (process.env.FIREBASE_WEBAPP_CONFIG) {
    return JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG) as FirebaseOptions;
  }
  if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    return {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
  }
  return null;
}

export function getFirebaseApp(): FirebaseApp | null {
  const config = getConfig();
  if (!config) return null;
  return getApps()[0] ?? initializeApp(config);
}

export function getDb(): Firestore | null {
  const app = getFirebaseApp();
  return app ? getFirestore(app) : null;
}
