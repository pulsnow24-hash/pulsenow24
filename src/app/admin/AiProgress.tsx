"use client";

import { useEffect, useState } from "react";

/**
 * Bară de progres pentru operațiile AI. Serverul nu trimite progres real
 * (răspunsul vine într-o singură cerere), așa că procentul e estimat pe
 * baza duratei tipice: crește repede la început și încetinește spre 95%.
 * Când operația se termină (`complete`), bara sare la 100% înainte să
 * dispară; dacă durează mult peste durata tipică, anunțăm explicit că
 * operația e încă în lucru, ca să nu pară blocată.
 */
export default function AiProgress({
  etape,
  durata,
  complete = false,
}: {
  /** Mesajele afișate pe măsură ce avansează */
  etape: string[];
  /** Durata tipică a operației, în secunde */
  durata: number;
  /** Operația s-a încheiat — afișează 100% */
  complete?: boolean;
}) {
  const [pct, setPct] = useState(2);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (complete) return;
    const start = Date.now();
    const timer = setInterval(() => {
      const t = (Date.now() - start) / 1000;
      const p = 95 * (1 - Math.exp(-t / (durata / 2.2)));
      setPct(Math.min(95, Math.max(2, p)));
      setElapsed(t);
    }, 150);
    return () => clearInterval(timer);
  }, [durata, complete]);

  const shownPct = complete ? 100 : pct;
  const overdue = !complete && elapsed > durata * 2.5;
  const etapa = complete
    ? "Finalizat"
    : overdue
      ? `Durează mai mult decât de obicei (${Math.round(elapsed)}s) — încă în lucru…`
      : etape[Math.min(etape.length - 1, Math.floor((pct / 95) * etape.length))];

  return (
    <div className="admin-aiprogress" role="status" aria-live="polite">
      <div
        className="admin-progress-track"
        role="progressbar"
        aria-valuenow={Math.round(shownPct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="admin-progress-fill ai"
          style={{ width: `${shownPct}%` }}
        />
      </div>
      <div className="admin-aiprogress-label">
        {!complete && <span className="admin-spinner" aria-hidden="true" />}
        <span>{etapa}</span>
        <strong>{Math.round(shownPct)}%</strong>
      </div>
    </div>
  );
}
