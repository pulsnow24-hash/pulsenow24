"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
} from "firebase/firestore/lite";
import { getFirebaseApp } from "@/lib/firebase";
import type { Article, ArticleBadge, QAPair } from "@/lib/articles";

const CATEGORII = [
  "Actualitate",
  "Business",
  "AI & Tech",
  "Politică",
  "Geopolitică",
  "Monden",
  "Viral",
];
const CATEGORII_BUZZ = new Set(["Monden", "Viral"]);

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function estimateCitire(...texte: string[]): string {
  const cuvinte = texte.join(" ").split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(cuvinte / 200))} min`;
}

function dataAfisata(d: Date): string {
  const zi = d.toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const ora = d.toLocaleTimeString("ro-RO", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${zi}, ${ora}`;
}

interface FormState {
  id: string;
  titlu: string;
  sumar: string;
  categorie: string;
  breaking: boolean;
  citire: string;
  fapt: string;
  unghi: string;
  opinie: string;
  predictie: string;
  dezbatere: string;
  qa: QAPair[];
}

const FORM_GOL: FormState = {
  id: "",
  titlu: "",
  sumar: "",
  categorie: "Actualitate",
  breaking: false,
  citire: "",
  fapt: "",
  unghi: "",
  opinie: "",
  predictie: "",
  dezbatere: "",
  qa: [{ q: "", a: "" }],
};

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

function LoginForm({ auth }: { auth: ReturnType<typeof getAuth> }) {
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

function Dashboard({
  db,
  auth,
  userEmail,
}: {
  db: ReturnType<typeof getFirestore>;
  auth: ReturnType<typeof getAuth>;
  userEmail: string;
}) {
  const [form, setForm] = useState<FormState>(FORM_GOL);
  const [editId, setEditId] = useState<string | null>(null);
  const [articole, setArticole] = useState<Article[]>([]);
  const [ticker, setTicker] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const incarcaLista = useCallback(async () => {
    const snap = await getDocs(collection(db, "articles"));
    const lista = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Article);
    lista.sort((a, b) => (b.publicatLa ?? "").localeCompare(a.publicatLa ?? ""));
    setArticole(lista);
  }, [db]);

  useEffect(() => {
    incarcaLista();
    getDoc(doc(db, "config", "ticker")).then((snap) => {
      if (snap.exists()) setTicker((snap.data().items as string[]).join("\n"));
    });
  }, [db, incarcaLista]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function arataStatus(mesaj: string) {
    setStatus(mesaj);
    setTimeout(() => setStatus(""), 4000);
  }

  async function salveaza(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const id = editId ?? (form.id || slugify(form.titlu));
      if (!id) throw new Error("Titlul e gol");
      const buzz = CATEGORII_BUZZ.has(form.categorie);
      const badge: ArticleBadge = form.breaking
        ? "breaking"
        : buzz
          ? "buzz"
          : "blue";
      const existent = editId
        ? articole.find((a) => a.id === editId)
        : undefined;
      const acum = new Date();
      const articol: Omit<Article, "id"> = {
        publicatLa: existent?.publicatLa ?? acum.toISOString(),
        data: existent?.data ?? dataAfisata(acum),
        categorie: form.categorie,
        badge,
        buzz,
        titlu: form.titlu,
        sumar: form.sumar,
        citire:
          form.citire ||
          estimateCitire(form.fapt, form.unghi, form.opinie, form.predictie),
        fapt: form.fapt,
        unghi: form.unghi,
        opinie: form.opinie,
        predictie: form.predictie,
        dezbatere: form.dezbatere,
        qa: form.qa.filter((p) => p.q.trim() && p.a.trim()),
      };
      await setDoc(doc(db, "articles", id), articol);
      arataStatus(`✓ Salvat: /articol/${id} — apare pe site în cel mult un minut`);
      setForm(FORM_GOL);
      setEditId(null);
      await incarcaLista();
    } catch (err) {
      arataStatus(`Eroare la salvare: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(false);
    }
  }

  function editeaza(a: Article) {
    setEditId(a.id);
    setForm({
      id: a.id,
      titlu: a.titlu,
      sumar: a.sumar,
      categorie: a.categorie,
      breaking: a.badge === "breaking",
      citire: a.citire,
      fapt: a.fapt,
      unghi: a.unghi,
      opinie: a.opinie,
      predictie: a.predictie,
      dezbatere: a.dezbatere,
      qa: a.qa.length ? a.qa : [{ q: "", a: "" }],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function sterge(a: Article) {
    if (!confirm(`Ștergi definitiv „${a.titlu}"?`)) return;
    await deleteDoc(doc(db, "articles", a.id));
    if (editId === a.id) {
      setEditId(null);
      setForm(FORM_GOL);
    }
    await incarcaLista();
    arataStatus("Articol șters.");
  }

  async function salveazaTicker() {
    setBusy(true);
    try {
      const items = ticker.split("\n").map((s) => s.trim()).filter(Boolean);
      await setDoc(doc(db, "config", "ticker"), { items });
      arataStatus("✓ Ticker salvat");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-wrap">
      <div className="admin-topbar">
        <h1>{editId ? `Editezi: ${editId}` : "Articol nou"}</h1>
        <div className="admin-user">
          <span className="admin-muted">{userEmail}</span>
          <button className="back-btn" onClick={() => signOut(auth)}>
            Deconectare
          </button>
        </div>
      </div>

      {status && <p className="admin-status">{status}</p>}

      <form onSubmit={salveaza} className="admin-form">
        <label>
          Titlu
          <input
            value={form.titlu}
            onChange={(e) => set("titlu", e.target.value)}
            required
          />
        </label>
        <label>
          Sumar (apare pe carduri)
          <textarea
            rows={2}
            value={form.sumar}
            onChange={(e) => set("sumar", e.target.value)}
            required
          />
        </label>
        <div className="admin-row">
          <label>
            Categorie
            <select
              value={form.categorie}
              onChange={(e) => set("categorie", e.target.value)}
            >
              {CATEGORII.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Link (slug) — gol = generat din titlu
            <input
              value={editId ?? form.id}
              onChange={(e) => set("id", slugify(e.target.value))}
              disabled={!!editId}
              placeholder={slugify(form.titlu) || "ex: bnr-dobanda"}
            />
          </label>
          <label>
            Timp de citire — gol = estimat
            <input
              value={form.citire}
              onChange={(e) => set("citire", e.target.value)}
              placeholder="ex: 3 min"
            />
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={form.breaking}
              onChange={(e) => set("breaking", e.target.checked)}
            />
            Breaking news
          </label>
        </div>

        <label>
          ● Faptul verificat
          <textarea
            rows={3}
            value={form.fapt}
            onChange={(e) => set("fapt", e.target.value)}
            required
          />
        </label>
        <label>
          ◆ Unghiul ascuns
          <textarea
            rows={3}
            value={form.unghi}
            onChange={(e) => set("unghi", e.target.value)}
            required
          />
        </label>
        <label>
          ▲ Opinia PulsNow24
          <textarea
            rows={3}
            value={form.opinie}
            onChange={(e) => set("opinie", e.target.value)}
            required
          />
        </label>
        <label>
          ↗ Predicția
          <textarea
            rows={3}
            value={form.predictie}
            onChange={(e) => set("predictie", e.target.value)}
            required
          />
        </label>
        <label>
          💬 Întrebarea de dezbatere
          <input
            value={form.dezbatere}
            onChange={(e) => set("dezbatere", e.target.value)}
            required
          />
        </label>

        <fieldset className="admin-qa">
          <legend>Răspuns rapid (întrebări frecvente)</legend>
          {form.qa.map((pair, i) => (
            <div className="admin-qa-pair" key={i}>
              <input
                placeholder="Întrebare"
                value={pair.q}
                onChange={(e) => {
                  const qa = [...form.qa];
                  qa[i] = { ...qa[i], q: e.target.value };
                  set("qa", qa);
                }}
              />
              <input
                placeholder="Răspuns"
                value={pair.a}
                onChange={(e) => {
                  const qa = [...form.qa];
                  qa[i] = { ...qa[i], a: e.target.value };
                  set("qa", qa);
                }}
              />
              <button
                type="button"
                className="back-btn admin-qa-del"
                aria-label="Șterge întrebarea"
                onClick={() =>
                  set("qa", form.qa.filter((_, j) => j !== i))
                }
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className="back-btn"
            onClick={() => set("qa", [...form.qa, { q: "", a: "" }])}
          >
            + Adaugă întrebare
          </button>
        </fieldset>

        <div className="admin-actions">
          <button className="share-btn" type="submit" disabled={busy}>
            {busy ? "Se salvează…" : editId ? "Salvează modificările" : "Publică articolul"}
          </button>
          {editId && (
            <button
              type="button"
              className="share-btn secondary"
              onClick={() => {
                setEditId(null);
                setForm(FORM_GOL);
              }}
            >
              Renunță la editare
            </button>
          )}
        </div>
      </form>

      <div className="admin-section">
        <h2>Ticker (o știre pe rând)</h2>
        <textarea
          rows={4}
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
        />
        <button
          className="share-btn secondary"
          onClick={salveazaTicker}
          disabled={busy}
        >
          Salvează tickerul
        </button>
      </div>

      <div className="admin-section">
        <h2>Articole publicate ({articole.length})</h2>
        <ul className="admin-list">
          {articole.map((a) => (
            <li key={a.id}>
              <div>
                <strong>{a.titlu}</strong>
                <span className="admin-muted">
                  {" "}
                  — {a.categorie} · {a.data}
                </span>
              </div>
              <div className="admin-list-actions">
                <a
                  className="back-btn"
                  href={`/articol/${a.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Vezi
                </a>
                <button className="back-btn" onClick={() => editeaza(a)}>
                  Editează
                </button>
                <button
                  className="back-btn admin-danger"
                  onClick={() => sterge(a)}
                >
                  Șterge
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
