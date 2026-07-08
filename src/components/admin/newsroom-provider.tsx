"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  getAuth,
  onAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore/lite";
import type { FirebaseApp } from "firebase/app";
import { getFirebaseApp } from "@/lib/firebase";
import type { ArticleSocial } from "@/lib/articles";
import type { FormState } from "@/app/admin/formState";
import LoginScreen from "./login-screen";

/** Handoff de la Inbox/Articole către Editor, transportat prin context. */
export interface EditRequest {
  form: FormState;
  editId: string | null;
  social: ArticleSocial | null;
}

interface NewsroomContextValue {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  user: User;
  /** Trimite un articol în editor și navighează acolo. */
  requestEdit: (request: EditRequest) => void;
  /** Editorul consumă articolul primit (o singură dată). */
  consumePendingEdit: () => EditRequest | null;
}

const NewsroomContext = createContext<NewsroomContextValue | null>(null);

export function useNewsroom(): NewsroomContextValue {
  const ctx = useContext(NewsroomContext);
  if (!ctx) {
    throw new Error("useNewsroom trebuie folosit în interiorul <NewsroomProvider>");
  }
  return ctx;
}

export function NewsroomProvider({ children }: { children: React.ReactNode }) {
  const app = useMemo(() => getFirebaseApp(), []);
  const auth = useMemo(() => (app ? getAuth(app) : null), [app]);
  const db = useMemo(() => (app ? getFirestore(app) : null), [app]);
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const pendingEdit = useRef<EditRequest | null>(null);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
  }, [auth]);

  if (!app || !auth || !db) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <p className="max-w-sm text-sm text-destructive">
          Firebase nu e configurat — completează .env.local și repornește
          serverul.
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-5 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen auth={auth} />;
  }

  const value: NewsroomContextValue = {
    app,
    auth,
    db,
    user,
    requestEdit: (request) => {
      pendingEdit.current = request;
      router.push("/admin/editor");
    },
    consumePendingEdit: () => {
      const request = pendingEdit.current;
      pendingEdit.current = null;
      return request;
    },
  };

  return (
    <NewsroomContext.Provider value={value}>
      {children}
    </NewsroomContext.Provider>
  );
}
