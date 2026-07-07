"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore/lite";
import { getFirebaseApp } from "@/lib/firebase";
import type { ArticleSocial } from "@/lib/articles";
import type { FormState } from "./formState";
import ArticleTab from "./ArticleTab";
import InboxTab from "./InboxTab";
import PublishedTab from "./PublishedTab";

type Tab = "articol" | "inbox" | "publicate";

/** Cerere de editare trimisă din alte taburi către formularul de articol */
export interface EditRequest {
  form: FormState;
  editId: string | null;
  social: ArticleSocial | null;
}

export default function AdminClient() {
  const app = useMemo(() => getFirebaseApp(), []);
  const auth = useMemo(() => (app ? getAuth(app) : null), [app]);
  const db = useMemo(() => (app ? getFirestore(app) : null), [app]);

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, [auth]);

  if (!app || !auth || !db) {
    return (
      <div className="admin-wrap">
        <h1>Administrare</h1>
        <p className="admin-error">
          Firebase nu e configurat — completează .env.local și repornește
          serverul.
        </p>
      </div>
    );
  }
  if (!authReady) {
    return (
      <div className="admin-wrap">
        <p className="admin-muted">Se încarcă…</p>
      </div>
    );
  }
  if (!user) {
    return <LoginForm auth={auth} />;
  }
  return <Dashboard db={db} auth={auth} userEmail={user.email ?? ""} />;
}

function LoginForm({ auth }: { auth: Auth }) {
  const [email, setEmail] = useState("");
  const [parola, setParola] = useState("");
  const [eroare, setEroare] = useState("");
  const [busy, setBusy] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setEroare("");
    try {
      await signInWithEmailAndPassword(auth, email, parola);
    } catch {
      setEroare("Email sau parolă greșită.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-wrap admin-login">
      <h1>Administrare PulsNow24</h1>
      <form onSubmit={login} className="admin-form">
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Parolă
          <input
            type="password"
            value={parola}
            onChange={(e) => setParola(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {eroare && <p className="admin-error">{eroare}</p>}
        <button className="share-btn" type="submit" disabled={busy}>
          {busy ? "Se conectează…" : "Conectare"}
        </button>
      </form>
    </div>
  );
}

const TABS: { id: Tab; label: string }[] = [
  { id: "articol", label: "✍️ Articol" },
  { id: "inbox", label: "📥 Inbox Știri" },
  { id: "publicate", label: "📰 Publicate" },
];

function Dashboard({
  db,
  auth,
  userEmail,
}: {
  db: Firestore;
  auth: Auth;
  userEmail: string;
}) {
  const [tab, setTab] = useState<Tab>("articol");
  const [editRequest, setEditRequest] = useState<EditRequest | null>(null);

  // Alte taburi trimit un articol spre editare și comută pe tabul Articol
  function openInEditor(request: EditRequest) {
    setEditRequest(request);
    setTab("articol");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="admin-wrap admin-wide">
      <div className="admin-topbar">
        <h1>Redacția PulsNow24</h1>
        <div className="admin-user">
          <span className="admin-muted">{userEmail}</span>
          <button className="back-btn" onClick={() => signOut(auth)}>
            Deconectare
          </button>
        </div>
      </div>

      <div className="admin-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`admin-tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div hidden={tab !== "articol"}>
        <ArticleTab
          db={db}
          auth={auth}
          editRequest={editRequest}
          onEditRequestConsumed={() => setEditRequest(null)}
        />
      </div>
      <div hidden={tab !== "inbox"}>
        <InboxTab db={db} auth={auth} onOpenInEditor={openInEditor} />
      </div>
      <div hidden={tab !== "publicate"}>
        <PublishedTab db={db} active={tab === "publicate"} onOpenInEditor={openInEditor} />
      </div>
    </div>
  );
}
