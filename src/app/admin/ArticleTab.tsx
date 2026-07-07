"use client";

import { useEffect, useRef, useState } from "react";
import type { Auth } from "firebase/auth";
import { doc, setDoc, type Firestore } from "firebase/firestore/lite";
import {
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import type { ArticleSocial } from "@/lib/articles";
import type { GeneratedArticle, SocialPosts } from "@/lib/ai-types";
import { callApi } from "./api";
import {
  CATEGORII,
  FORM_GOL,
  formToArticle,
  generatedToForm,
  slugify,
  type FormState,
} from "./formState";
import type { EditRequest } from "./AdminClient";

/** Elementele care compun scorul de completitudine al unui articol */
function verificaCompletitudine(form: FormState, social: ArticleSocial | null) {
  const items: { label: string; done: boolean }[] = [
    { label: "Titlu", done: !!form.titlu.trim() },
    { label: "Sumar", done: !!form.sumar.trim() },
    { label: "Faptul verificat", done: !!form.fapt.trim() },
    { label: "Unghiul ascuns", done: !!form.unghi.trim() },
    { label: "Opinia", done: !!form.opinie.trim() },
    { label: "Predicția", done: !!form.predictie.trim() },
    { label: "Întrebarea de dezbatere", done: !!form.dezbatere.trim() },
    {
      label: "Min. 3 întrebări rapide",
      done: form.qa.filter((p) => p.q.trim() && p.a.trim()).length >= 3,
    },
    { label: "Title SEO", done: !!form.seoTitle.trim() },
    { label: "Meta description", done: !!form.metaDescription.trim() },
    { label: "Keywords", done: !!form.keywords.trim() },
    { label: "Taguri", done: !!form.taguri.trim() },
    { label: "Imagine principală", done: !!form.imagineUrl.trim() },
    { label: "Credit foto", done: !!form.imagineCredit.trim() },
    { label: "Sursă", done: !!form.sursaNume.trim() || !!form.sursaUrl.trim() },
    {
      label: "Postări social media",
      done: !!social && Object.values(social).some((v) => v && v.trim()),
    },
  ];
  const gata = items.filter((i) => i.done).length;
  const procent = Math.round((gata / items.length) * 100);
  return { items, procent, lipsesc: items.filter((i) => !i.done) };
}

function ProgressPublicare({
  form,
  social,
}: {
  form: FormState;
  social: ArticleSocial | null;
}) {
  const { procent, lipsesc } = verificaCompletitudine(form, social);
  const nivel = procent >= 80 ? "high" : procent >= 50 ? "mid" : "low";
  return (
    <div className="admin-progress">
      <div className="admin-progress-head">
        <span>Pregătire pentru publicare</span>
        <strong className={`admin-progress-pct ${nivel}`}>{procent}%</strong>
      </div>
      <div
        className="admin-progress-track"
        role="progressbar"
        aria-valuenow={procent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`admin-progress-fill ${nivel}`}
          style={{ width: `${procent}%` }}
        />
      </div>
      {lipsesc.length > 0 ? (
        <div className="admin-progress-missing">
          {lipsesc.map((item) => (
            <span className="admin-chip" key={item.label}>
              {item.label}
            </span>
          ))}
        </div>
      ) : (
        <p className="admin-progress-done">✓ Articol complet — gata de publicare!</p>
      )}
    </div>
  );
}

const PLATFORME: { key: keyof ArticleSocial; label: string }[] = [
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "x", label: "X (Twitter)" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "tiktok", label: "TikTok (idee clip)" },
];

export default function ArticleTab({
  db,
  auth,
  editRequest,
  onEditRequestConsumed,
}: {
  db: Firestore;
  auth: Auth;
  editRequest: EditRequest | null;
  onEditRequestConsumed: () => void;
}) {
  const [form, setForm] = useState<FormState>(FORM_GOL);
  const [editId, setEditId] = useState<string | null>(null);
  const [social, setSocial] = useState<ArticleSocial | null>(null);
  const [status, setStatus] = useState("");
  const [eroare, setEroare] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "ai" | "social" | "imagine">("");
  const fileInput = useRef<HTMLInputElement>(null);

  // Sursa AI
  const [aiMode, setAiMode] = useState<"url" | "text">("url");
  const [aiUrl, setAiUrl] = useState("");
  const [aiText, setAiText] = useState("");

  useEffect(() => {
    if (!editRequest) return;
    setForm(editRequest.form);
    setEditId(editRequest.editId);
    setSocial(editRequest.social);
    setStatus(
      editRequest.editId
        ? `Editezi articolul: ${editRequest.editId}`
        : "Draft generat — verifică fiecare secțiune înainte de publicare."
    );
    setEroare("");
    onEditRequestConsumed();
  }, [editRequest, onEditRequestConsumed]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function arataStatus(mesaj: string) {
    setEroare("");
    setStatus(mesaj);
  }
  function arataEroare(mesaj: string) {
    setStatus("");
    setEroare(mesaj);
  }

  async function genereazaCuAI() {
    const input =
      aiMode === "url" ? { url: aiUrl.trim() } : { text: aiText.trim() };
    if (!input.url && !input.text) {
      arataEroare("Lipește un link sau un text mai întâi.");
      return;
    }
    setBusy("ai");
    arataStatus("AI-ul citește sursa și scrie articolul… durează 30-60 de secunde.");
    try {
      const g = await callApi<GeneratedArticle>(auth, "/api/ai/generate", input);
      setForm(generatedToForm(g, input.url ?? ""));
      setEditId(null);
      setSocial(null);
      arataStatus(
        "✓ Articol generat. Verifică faptele și tonul, apoi salvează ca draft sau publică."
      );
    } catch (err) {
      arataEroare(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  }

  async function genereazaSocial() {
    if (!form.titlu.trim()) {
      arataEroare("Completează articolul înainte de a genera postările.");
      return;
    }
    setBusy("social");
    arataStatus("AI-ul scrie postările pentru rețele…");
    try {
      const posts = await callApi<SocialPosts>(auth, "/api/ai/social", {
        titlu: form.titlu,
        sumar: form.sumar,
        fapt: form.fapt,
        opinie: form.opinie,
        dezbatere: form.dezbatere,
      });
      setSocial(posts);
      arataStatus("✓ Postări generate — le poți edita direct în casete.");
    } catch (err) {
      arataEroare(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  }

  /** Urcă un blob în Firebase Storage și întoarce URL-ul public */
  async function urcaInStorage(blob: Blob, contentType: string): Promise<string> {
    const storage = getStorage(auth.app);
    const ext = (contentType.split("/")[1] ?? "jpg").split("+")[0];
    const nume = `${slugify(form.titlu) || "imagine"}-${Date.now()}.${ext}`;
    const r = storageRef(storage, `articole/${nume}`);
    await uploadBytes(r, blob, { contentType });
    return getDownloadURL(r);
  }

  async function incarcaImagine(file: File) {
    if (!file.type.startsWith("image/")) {
      arataEroare("Fișierul ales nu e o imagine.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      arataEroare("Imaginea depășește 10 MB.");
      return;
    }
    setBusy("imagine");
    arataStatus("Se încarcă imaginea…");
    try {
      const url = await urcaInStorage(file, file.type);
      set("imagineUrl", url);
      arataStatus("✓ Imagine încărcată.");
    } catch (err) {
      arataEroare(
        `Nu am putut încărca imaginea: ${err instanceof Error ? err.message : err}. Verifică regulile Firebase Storage.`
      );
    } finally {
      setBusy("");
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  /** Copiază imaginea din sursa externă în Firebase Storage */
  async function importaImagineaSursei() {
    if (!form.imagineUrl.trim()) return;
    setBusy("imagine");
    arataStatus("Se importă imaginea din sursă…");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Sesiune expirată");
      const token = await user.getIdToken();
      const res = await fetch("/api/image/fetch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: form.imagineUrl.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Eroare server (${res.status})`);
      }
      const blob = await res.blob();
      const url = await urcaInStorage(blob, blob.type || "image/jpeg");
      set("imagineUrl", url);
      arataStatus("✓ Imaginea a fost copiată în galeria ta — nu mai depinzi de site-ul sursă.");
    } catch (err) {
      arataEroare(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  }

  const imagineExterna =
    !!form.imagineUrl.trim() &&
    !form.imagineUrl.includes("firebasestorage.googleapis.com") &&
    !form.imagineUrl.includes(".firebasestorage.app");

  async function salveaza(statusArticol: "draft" | "publicat") {
    if (!form.titlu.trim()) {
      arataEroare("Titlul e obligatoriu.");
      return;
    }
    setBusy("save");
    try {
      const id = editId ?? (form.id || slugify(form.titlu));
      if (!id) throw new Error("Titlul e gol");
      const articol = formToArticle(form, { status: statusArticol, social });
      await setDoc(doc(db, "articles", id), articol);
      if (statusArticol === "publicat") {
        arataStatus(`✓ Publicat: /articol/${id} — apare pe site în cel mult un minut.`);
      } else {
        arataStatus(`✓ Salvat ca draft: ${id}. Îl găsești în tabul Publicate.`);
      }
      setEditId(id);
      setForm((f) => ({ ...f, id }));
    } catch (err) {
      arataEroare(
        `Eroare la salvare: ${err instanceof Error ? err.message : err}`
      );
    } finally {
      setBusy("");
    }
  }

  function formNou() {
    setForm(FORM_GOL);
    setEditId(null);
    setSocial(null);
    setStatus("");
    setEroare("");
  }

  return (
    <div>
      {/* ASISTENT AI */}
      <div className="admin-ai">
        <div className="admin-ai-header">
          <span className="tag">AI</span>
          <h2>Generează cu AI</h2>
        </div>
        <div className="admin-ai-modes">
          <label className="admin-check">
            <input
              type="radio"
              checked={aiMode === "url"}
              onChange={() => setAiMode("url")}
            />
            Link articol
          </label>
          <label className="admin-check">
            <input
              type="radio"
              checked={aiMode === "text"}
              onChange={() => setAiMode("text")}
            />
            Text lipit
          </label>
        </div>
        {aiMode === "url" ? (
          <input
            className="admin-input"
            placeholder="https://exemplu.ro/stirea-sursa"
            value={aiUrl}
            onChange={(e) => setAiUrl(e.target.value)}
          />
        ) : (
          <textarea
            className="admin-input"
            rows={5}
            placeholder="Lipește aici textul știrii-sursă…"
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
          />
        )}
        <button
          className="share-btn admin-ai-btn"
          onClick={genereazaCuAI}
          disabled={busy !== ""}
        >
          {busy === "ai" ? "Se generează…" : "⚡ Importă și generează cu AI"}
        </button>
        <p className="admin-muted">
          AI-ul completează automat tot formularul: titlu, format PulsNow24,
          SEO, taguri, sursă. Tu doar verifici.
        </p>
      </div>

      {status && <p className="admin-status">{status}</p>}
      {eroare && <p className="admin-error">{eroare}</p>}

      <div className="admin-topbar">
        <h2>{editId ? `Editezi: ${editId}` : "Articol nou"}</h2>
        {(editId || form.titlu) && (
          <button className="back-btn" onClick={formNou}>
            + Articol gol
          </button>
        )}
      </div>

      <ProgressPublicare form={form} social={social} />

      <form className="admin-form" onSubmit={(e) => e.preventDefault()}>
        <label>
          Titlu
          <input value={form.titlu} onChange={(e) => set("titlu", e.target.value)} />
        </label>
        <label>
          Sumar (apare pe carduri)
          <textarea
            rows={2}
            value={form.sumar}
            onChange={(e) => set("sumar", e.target.value)}
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
          <textarea rows={3} value={form.fapt} onChange={(e) => set("fapt", e.target.value)} />
        </label>
        <label>
          ◆ Unghiul ascuns
          <textarea rows={3} value={form.unghi} onChange={(e) => set("unghi", e.target.value)} />
        </label>
        <label>
          ▲ Opinia PulsNow24
          <textarea rows={3} value={form.opinie} onChange={(e) => set("opinie", e.target.value)} />
        </label>
        <label>
          ↗ Predicția
          <textarea rows={3} value={form.predictie} onChange={(e) => set("predictie", e.target.value)} />
        </label>
        <label>
          💬 Întrebarea de dezbatere
          <input value={form.dezbatere} onChange={(e) => set("dezbatere", e.target.value)} />
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
                onClick={() => set("qa", form.qa.filter((_, j) => j !== i))}
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

        <fieldset className="admin-qa">
          <legend>SEO</legend>
          <div className="admin-row">
            <label>
              Title SEO ({form.seoTitle.length}/60)
              <input value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} />
            </label>
            <label>
              Taguri (separate prin virgulă)
              <input value={form.taguri} onChange={(e) => set("taguri", e.target.value)} />
            </label>
          </div>
          <label>
            Meta description ({form.metaDescription.length}/155)
            <textarea
              rows={2}
              value={form.metaDescription}
              onChange={(e) => set("metaDescription", e.target.value)}
            />
          </label>
          <div className="admin-row">
            <label>
              Keywords (separate prin virgulă)
              <input value={form.keywords} onChange={(e) => set("keywords", e.target.value)} />
            </label>
            <label>
              Canonical / link original
              <input value={form.canonical} onChange={(e) => set("canonical", e.target.value)} />
            </label>
          </div>
        </fieldset>

        <fieldset className="admin-qa">
          <legend>Sursă</legend>
          <div className="admin-row">
            <label>
              Sursa (publicația)
              <input
                value={form.sursaNume}
                onChange={(e) => set("sursaNume", e.target.value)}
                placeholder="ex: Reuters, HotNews"
              />
            </label>
            <label>
              Link original
              <input value={form.sursaUrl} onChange={(e) => set("sursaUrl", e.target.value)} />
            </label>
            <label>
              Autor sursă
              <input value={form.autor} onChange={(e) => set("autor", e.target.value)} />
            </label>
          </div>
        </fieldset>

        <fieldset className="admin-qa">
          <legend>Imagine principală</legend>
          {form.imagineUrl.trim() ? (
            <div className="admin-img-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.imagineUrl} alt="Previzualizare imagine articol" />
              {imagineExterna && (
                <p className="admin-muted">
                  ⚠️ Imaginea e găzduită pe site-ul sursă — importă-o în galeria
                  ta ca să nu dispară dacă sursa o șterge.
                </p>
              )}
            </div>
          ) : (
            <p className="admin-muted">
              Nicio imagine. Încarcă una sau generează articolul dintr-un link —
              AI-ul preia automat imaginea principală a sursei.
            </p>
          )}
          <div className="admin-actions">
            <button
              type="button"
              className="share-btn secondary"
              onClick={() => fileInput.current?.click()}
              disabled={busy !== ""}
            >
              {busy === "imagine" ? "Se procesează…" : "📁 Încarcă imagine"}
            </button>
            {imagineExterna && (
              <button
                type="button"
                className="share-btn secondary"
                onClick={importaImagineaSursei}
                disabled={busy !== ""}
              >
                ⤓ Importă în galeria mea
              </button>
            )}
            {form.imagineUrl.trim() && (
              <button
                type="button"
                className="back-btn admin-danger"
                onClick={() => set("imagineUrl", "")}
                disabled={busy !== ""}
              >
                Elimină imaginea
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) incarcaImagine(file);
            }}
          />
          <div className="admin-row">
            <label>
              URL imagine (sau lipește unul direct)
              <input
                value={form.imagineUrl}
                onChange={(e) => set("imagineUrl", e.target.value)}
                placeholder="https://…"
              />
            </label>
            <label>
              Credit foto
              <input
                value={form.imagineCredit}
                onChange={(e) => set("imagineCredit", e.target.value)}
                placeholder="ex: Foto: Agerpres"
              />
            </label>
          </div>
          <label>
            Imagine sugerată de AI (descriere pentru editor)
            <input
              value={form.imagineSugestie}
              onChange={(e) => set("imagineSugestie", e.target.value)}
            />
          </label>
        </fieldset>

        <fieldset className="admin-qa">
          <legend>Social media</legend>
          <button
            type="button"
            className="share-btn secondary"
            onClick={genereazaSocial}
            disabled={busy !== ""}
          >
            {busy === "social" ? "Se generează…" : "Generează postări"}
          </button>
          {social &&
            PLATFORME.map(({ key, label }) => (
              <label key={key}>
                {label}
                <textarea
                  rows={3}
                  value={social[key] ?? ""}
                  onChange={(e) =>
                    setSocial((s) => ({ ...(s ?? {}), [key]: e.target.value }))
                  }
                />
                <button
                  type="button"
                  className="back-btn admin-copy"
                  onClick={() => navigator.clipboard.writeText(social[key] ?? "")}
                >
                  Copiază
                </button>
              </label>
            ))}
        </fieldset>

        <div className="admin-actions">
          <button
            type="button"
            className="share-btn"
            onClick={() => salveaza("publicat")}
            disabled={busy !== ""}
          >
            {busy === "save" ? "Se salvează…" : "Publică articolul"}
          </button>
          <button
            type="button"
            className="share-btn secondary"
            onClick={() => salveaza("draft")}
            disabled={busy !== ""}
          >
            Salvează ca draft
          </button>
        </div>
      </form>
    </div>
  );
}
