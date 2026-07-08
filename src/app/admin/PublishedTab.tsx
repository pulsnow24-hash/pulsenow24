"use client";

import { useCallback, useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore/lite";
import type { Article } from "@/lib/articles";
import { articleToForm } from "./formState";
import { useNewsroom } from "@/components/admin/newsroom-provider";

export default function PublishedTab() {
  const { db, requestEdit } = useNewsroom();
  const [articole, setArticole] = useState<Article[]>([]);
  const [ticker, setTicker] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const incarca = useCallback(async () => {
    const snap = await getDocs(collection(db, "articles"));
    const lista = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Article);
    lista.sort((a, b) => (b.publicatLa ?? "").localeCompare(a.publicatLa ?? ""));
    setArticole(lista);
  }, [db]);

  useEffect(() => {
    // Încărcare inițială de date — setState rulează după await, nu sincron
    // eslint-disable-next-line react-hooks/set-state-in-effect
    incarca();
    getDoc(doc(db, "config", "ticker")).then((snap) => {
      if (snap.exists()) setTicker((snap.data().items as string[]).join("\n"));
    });
  }, [db, incarca]);

  function arataStatus(mesaj: string) {
    setStatus(mesaj);
    setTimeout(() => setStatus(""), 4000);
  }

  function editeaza(a: Article) {
    requestEdit({
      form: articleToForm(a),
      editId: a.id,
      social: a.social ?? null,
    });
  }

  async function comutaStatus(a: Article) {
    const nou = a.status === "draft" ? "publicat" : "draft";
    const { id, ...campuri } = a;
    await setDoc(doc(db, "articles", id), { ...campuri, status: nou });
    await incarca();
    arataStatus(nou === "publicat" ? `✓ Publicat: ${a.id}` : `Retras în draft: ${a.id}`);
  }

  async function sterge(a: Article) {
    if (!confirm(`Ștergi definitiv „${a.titlu}"?`)) return;
    await deleteDoc(doc(db, "articles", a.id));
    await incarca();
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

  const drafturi = articole.filter((a) => a.status === "draft");
  const publicate = articole.filter((a) => a.status !== "draft");

  return (
    <div>
      {status && <p className="admin-status">{status}</p>}

      <div className="admin-section" style={{ marginTop: 0, borderTop: "none", paddingTop: 0 }}>
        <h2>Ticker (o știre pe rând)</h2>
        <textarea rows={4} value={ticker} onChange={(e) => setTicker(e.target.value)} />
        <button className="share-btn secondary" onClick={salveazaTicker} disabled={busy}>
          Salvează tickerul
        </button>
      </div>

      {drafturi.length > 0 && (
        <div className="admin-section">
          <h2>Drafturi ({drafturi.length})</h2>
          <ArticleList
            articole={drafturi}
            onEdit={editeaza}
            onToggle={comutaStatus}
            onDelete={sterge}
          />
        </div>
      )}

      <div className="admin-section">
        <h2>Articole publicate ({publicate.length})</h2>
        <ArticleList
          articole={publicate}
          onEdit={editeaza}
          onToggle={comutaStatus}
          onDelete={sterge}
        />
      </div>
    </div>
  );
}

function ArticleList({
  articole,
  onEdit,
  onToggle,
  onDelete,
}: {
  articole: Article[];
  onEdit: (a: Article) => void;
  onToggle: (a: Article) => void;
  onDelete: (a: Article) => void;
}) {
  return (
    <ul className="admin-list">
      {articole.map((a) => (
        <li key={a.id}>
          <div>
            {a.status === "draft" && <span className="admin-chip draft">DRAFT</span>}{" "}
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
            <button className="back-btn" onClick={() => onEdit(a)}>
              Editează
            </button>
            <button className="back-btn" onClick={() => onToggle(a)}>
              {a.status === "draft" ? "Publică" : "Retrage în draft"}
            </button>
            <button className="back-btn admin-danger" onClick={() => onDelete(a)}>
              Șterge
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
