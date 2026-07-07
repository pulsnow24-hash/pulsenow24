"use client";

import { useEffect, useState } from "react";
import type { Auth } from "firebase/auth";
import { doc, setDoc, type Firestore } from "firebase/firestore/lite";
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
  const [busy, setBusy] = useState<"" | "save" | "ai" | "social">("");

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
          <legend>Sursă & imagine</legend>
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
          <label>
            Imagine sugerată (descriere pentru editor)
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
