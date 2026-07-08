"use client";

import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore/lite";
import type { GeneratedArticle, InboxScoredItem } from "@/lib/ai-types";
import { callApi, hashLink } from "./api";
import AiProgress from "./AiProgress";
import { generatedToForm } from "./formState";
import { useNewsroom } from "@/components/admin/newsroom-provider";

interface InboxDoc extends InboxScoredItem {
  id: string;
  status: "nou" | "respins" | "procesat";
  adaugatLa: string;
}

function scorClass(scor: number): string {
  if (scor >= 80) return "admin-score high";
  if (scor >= 50) return "admin-score mid";
  return "admin-score low";
}

export default function InboxTab() {
  const { db, auth, requestEdit } = useNewsroom();
  const [items, setItems] = useState<InboxDoc[]>([]);
  const [status, setStatus] = useState("");
  const [eroare, setEroare] = useState("");
  const [busy, setBusy] = useState<"" | "refresh" | string>("");
  const [arataRespinse, setArataRespinse] = useState(false);

  const incarca = useCallback(async () => {
    const snap = await getDocs(collection(db, "inbox"));
    const lista = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as InboxDoc);
    lista.sort((a, b) => b.scor - a.scor);
    setItems(lista);
  }, [db]);

  useEffect(() => {
    // Încărcare inițială de date — setState rulează după await, nu sincron
    // eslint-disable-next-line react-hooks/set-state-in-effect
    incarca().catch(() => setEroare("Nu am putut încărca inboxul."));
  }, [incarca]);

  async function refresh() {
    setBusy("refresh");
    setEroare("");
    setStatus("");
    try {
      const { items: scored, feedErrors } = await callApi<{
        items: InboxScoredItem[];
        feedErrors: string[];
      }>(auth, "/api/inbox/refresh", {});

      const existente = new Set(items.map((i) => i.id));
      let noi = 0;
      for (const item of scored) {
        if (!item.retine) continue;
        const id = hashLink(item.link);
        if (existente.has(id)) continue;
        const docNou: Omit<InboxDoc, "id"> = {
          ...item,
          status: "nou",
          adaugatLa: new Date().toISOString(),
        };
        await setDoc(doc(db, "inbox", id), docNou);
        noi++;
      }
      await incarca();
      setStatus(
        `✓ ${noi} știri noi în inbox (${scored.length} evaluate).` +
          (feedErrors.length ? ` Fluxuri indisponibile: ${feedErrors.join("; ")}` : "")
      );
    } catch (err) {
      setStatus("");
      setEroare(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  }

  async function genereazaDraft(item: InboxDoc) {
    setBusy(item.id);
    setEroare("");
    setStatus("");
    try {
      const g = await callApi<GeneratedArticle>(auth, "/api/ai/generate", {
        url: item.link,
      });
      const form = generatedToForm(g, item.link);
      if (!form.sursaNume) form.sursaNume = item.sursa;
      await updateDoc(doc(db, "inbox", item.id), { status: "procesat" });
      await incarca();
      setStatus("");
      requestEdit({ form, editId: null, social: null });
    } catch (err) {
      setStatus("");
      setEroare(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  }

  async function respinge(item: InboxDoc) {
    await updateDoc(doc(db, "inbox", item.id), { status: "respins" });
    await incarca();
  }

  const vizibile = items.filter(
    (i) => arataRespinse || i.status !== "respins"
  );

  return (
    <div>
      <div className="admin-topbar">
        <h2>Inbox Știri — RSS + scor AI</h2>
        <button className="share-btn" onClick={refresh} disabled={busy !== ""}>
          {busy === "refresh" ? "Se caută…" : "🔄 Caută știri noi"}
        </button>
      </div>
      <p className="admin-muted">
        Surse: Digi24, HotNews, G4Media, Biziday. AI-ul dă fiecărei știri un
        scor de importanță (0-100) și o categorie — publici întâi ce are scorul
        cel mai mare.
      </p>

      {status && <p className="admin-status">{status}</p>}
      {eroare && <p className="admin-error">{eroare}</p>}

      {busy === "refresh" && (
        <AiProgress
          durata={35}
          etape={[
            "Citesc fluxurile RSS (Digi24, HotNews, G4Media, Biziday)…",
            "AI-ul evaluează importanța fiecărei știri…",
            "Calculez scorurile și categoriile…",
            "Salvez știrile noi în inbox…",
          ]}
        />
      )}
      {busy !== "" && busy !== "refresh" && (
        <AiProgress
          durata={45}
          etape={[
            "Descarc articolul-sursă…",
            "AI-ul citește și analizează știrea…",
            "Scriu draftul în formatul PulsNow24…",
            "Generez SEO, taguri și imaginea…",
            "Aproape gata…",
          ]}
        />
      )}

      <label className="admin-check">
        <input
          type="checkbox"
          checked={arataRespinse}
          onChange={(e) => setArataRespinse(e.target.checked)}
        />
        Arată și știrile respinse
      </label>

      <ul className="admin-list">
        {vizibile.length === 0 && (
          <li className="admin-muted">
            {"Inboxul e gol — apasă „Caută știri noi”."}
          </li>
        )}
        {vizibile.map((item) => (
          <li key={item.id} className={item.status !== "nou" ? "admin-dim" : ""}>
            <div className="admin-inbox-main">
              <div className="admin-inbox-meta">
                <span className={scorClass(item.scor)}>{item.scor}%</span>
                <span className="admin-chip">{item.sursa}</span>
                <span className="admin-chip">{item.categorie}</span>
                {item.status === "procesat" && (
                  <span className="admin-chip ok">draft generat</span>
                )}
                {item.status === "respins" && (
                  <span className="admin-chip">respins</span>
                )}
              </div>
              <strong>{item.titlu}</strong>
              {item.motiv && <div className="admin-muted">{item.motiv}</div>}
            </div>
            <div className="admin-list-actions">
              <a className="back-btn" href={item.link} target="_blank" rel="noreferrer">
                Vezi
              </a>
              {item.status === "nou" && (
                <>
                  <button
                    className="back-btn"
                    onClick={() => genereazaDraft(item)}
                    disabled={busy !== ""}
                  >
                    {busy === item.id ? "Se scrie…" : "✓ Generează draft"}
                  </button>
                  <button
                    className="back-btn admin-danger"
                    onClick={() => respinge(item)}
                    disabled={busy !== ""}
                  >
                    Respinge
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
