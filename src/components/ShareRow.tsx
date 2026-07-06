"use client";

import { useRef, useState } from "react";
import type { Article } from "@/lib/articles";

const DEFAULT_HINT = "Apasă, apoi lipește direct în postarea de Facebook";

function articleAsText(a: Article) {
  return [
    a.titlu,
    "● FAPT: " + a.fapt,
    "◆ UNGHI: " + a.unghi,
    "▲ OPINIA PULSNOW24: " + a.opinie,
    "↗ PREDICȚIE: " + a.predictie,
    "💬 " + a.dezbatere,
    "Citește analiza completă pe PulsNow24.",
  ].join("\n\n");
}

export default function ShareRow({ article }: { article: Article }) {
  const [hint, setHint] = useState(DEFAULT_HINT);
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copyArticle() {
    try {
      await navigator.clipboard.writeText(articleAsText(article));
      setHint("✓ Copiat! Lipește acum în Facebook.");
      setCopied(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => {
        setHint(DEFAULT_HINT);
        setCopied(false);
      }, 3000);
    } catch {
      setHint("Nu am putut copia automat — selectează manual textul.");
      setCopied(false);
    }
  }

  async function nativeShare() {
    const shareData = {
      title: article.titlu,
      text: article.sumar,
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // utilizatorul a închis fereastra de share — nu e o eroare
      }
    } else {
      await copyArticle();
    }
  }

  return (
    <div className="share-row">
      <button className="share-btn" onClick={copyArticle}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        Copiază pentru Facebook
      </button>
      <button className="share-btn secondary" onClick={nativeShare}>
        Distribuie
      </button>
      <span className={`share-hint${copied ? " copied" : ""}`}>{hint}</span>
    </div>
  );
}
