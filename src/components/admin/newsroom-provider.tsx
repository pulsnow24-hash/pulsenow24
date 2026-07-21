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
  signOut,
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

/** Roluri de redacție, din custom claims (nu din email). */
export type NewsroomRole = "admin" | "editor" | "viewer";
const APPROVED_ROLES: NewsroomRole[] = ["admin", "editor", "viewer"];

interface NewsroomContextValue {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  user: User;
  /** Rolul aprobat al utilizatorului curent (din token). */
  role: NewsroomRole;
  /** Scriere permisă (editor/admin); viewer e read-only. */
  canWrite: boolean;
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
  // Rolul din custom claims: undefined = încă necunoscut; null = niciun rol aprobat.
  const [role, setRole] = useState<NewsroomRole | null | undefined>(undefined);
  const pendingEdit = useRef<EditRequest | null>(null);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setRole(null);
        setReady(true);
        return;
      }
      // Citim rolul DOAR din tokenul semnat, plus emailul verificat.
      try {
        const token = await u.getIdTokenResult();
        const claimRole = token.claims.role as NewsroomRole | undefined;
        const emailOk = u.emailVerified || token.claims.email_verified === true;
        setRole(
          emailOk && claimRole && APPROVED_ROLES.includes(claimRole)
            ? claimRole
            : null
        );
      } catch {
        setRole(null);
      }
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

  // Autentificat dar fără rol aprobat / email neverificat → acces refuzat.
  // Nu se randează niciun date intern și nu se dezvăluie ce documente există.
  if (!role) {
    return <AccessDenied auth={auth} email={user.email} />;
  }

  const value: NewsroomContextValue = {
    app,
    auth,
    db,
    user,
    role,
    canWrite: role === "admin" || role === "editor",
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

/**
 * Stare „Acces refuzat": utilizator autentificat, dar fără rol de redacție
 * aprobat (sau cu email neverificat). Nu se afișează niciun date intern și
 * nu se dezvăluie ce documente/colecții există — doar un mesaj clar.
 */
function AccessDenied({ auth, email }: { auth: Auth; email: string | null }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold text-foreground">Acces refuzat</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Contul {email ? <span className="font-mono">{email}</span> : "tău"} nu
          are un rol de redacție aprobat. Accesul la datele interne necesită un
          rol (viewer, editor sau admin) și un email verificat, alocate de un
          administrator.
        </p>
        <button
          onClick={() => signOut(auth)}
          className="mt-5 rounded-lg border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
        >
          Deconectează-te
        </button>
      </div>
    </div>
  );
}
