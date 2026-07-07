"use client";

import { useEffect, useState } from "react";

/**
 * Bară de progres pentru operațiile AI. Serverul nu trimite progres real
 * (răspunsul vine într-o singură cerere), așa că procentul e estimat pe
 * baza duratei tipice: crește repede la început și încetinește spre 95%,
 * iar la final componenta dispare odată cu răspunsul.
 */
export default function AiProgress({
  etape,
  durata,
}: {
  /** Mesajele afișate pe măsură ce avansează */
  etape: string[];
  /** Durata tipică a operației, în secunde */
  durata: number;
}) {
  const [pct, setPct] = useState(2);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      const t = (Date.now() - start) / 1000;
      const p = 95 * (1 - Math.exp(-t / (durata / 2.2)));
      setPct(Math.min(95, Math.max(2, p)));
    }, 150);
    return () => clearInterval(timer);
  }, [durata]);

  const etapa =
    etape[Math.min(etape.length - 1, Math.floor((pct / 95) * etape.length))];

  return (
    <div className="admin-aiprogress" role="status" aria-live="polite">
      <div
        className="admin-progress-track"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="admin-progress-fill ai" style={{ width: `${pct}%` }} />
      </div>
      <div className="admin-aiprogress-label">
        <span className="admin-spinner" aria-hidden="true" />
        <span>{etapa}</span>
        <strong>{Math.round(pct)}%</strong>
      </div>
    </div>
  );
}
