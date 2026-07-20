/**
 * News Platform Engine — Confidence Engine.
 *
 * Scorul de încredere (0-100) al unui Story: cât de solid e susținut de
 * surse, nu cât de important e. Determinist, pur, fără I/O — aceleași
 * intrări dau întotdeauna același scor, ca deciziile editoriale să fie
 * explicabile.
 */
import type { StoryCoverage } from "./workspace";

/** Verdictul analizei de consistență între surse (vezi engine/workspace). */
export type ConsistencyVerdict =
  | "unchecked"
  | "consistent"
  | "contradiction"
  | "complementary"
  | "update";

export type ConfidenceLabel = "high" | "medium" | "low";

export const CONFIDENCE_LABELS: Record<ConfidenceLabel, string> = {
  high: "Încredere ridicată",
  medium: "Încredere medie",
  low: "Încredere scăzută",
};

export interface ConfidenceInput {
  coverage: Pick<
    StoryCoverage,
    "independentSources" | "diversityScore" | "officialCount" | "corroborated"
  >;
  /** Scorurile de trust ale surselor story-ului (0-100), din registru */
  sourceTrust: number[];
  verdict: ConsistencyVerdict;
  /** lastUpdated al story-ului (ISO) — prospețimea informației */
  lastUpdated: string;
  /** Momentul evaluării (injectat pentru determinism/teste) */
  now?: number;
}

export interface ConfidenceResult {
  score: number;
  label: ConfidenceLabel;
  /** Componentele scorului — pentru transparență/debug editorial */
  parts: {
    sources: number;
    diversity: number;
    official: number;
    trust: number;
    consistency: number;
    freshness: number;
  };
}

/**
 * Ponderi (documentate, deterministe):
 * - surse independente:  1→20, 2→35, 3→45, ≥4→50   (baza: coroborarea)
 * - diversitate:         0-15   (mixul oficial/presă/social)
 * - surse oficiale:      +12 dacă există cel puțin una
 * - trust mediu surse:   ±10    (media trustScore față de 50)
 * - consistență:         consistent/complementary +10, update +8,
 *                        unchecked 0, contradiction −25
 * - prospețime:          <24h +5, <72h +2, >7 zile −5
 * Praguri etichetă: ≥70 ridicată, 40-69 medie, <40 scăzută.
 */
export function computeConfidence(input: ConfidenceInput): ConfidenceResult {
  const { coverage, sourceTrust, verdict, lastUpdated } = input;
  const now = input.now ?? Date.now();

  const n = coverage.independentSources;
  const sources = n >= 4 ? 50 : n === 3 ? 45 : n === 2 ? 35 : n === 1 ? 20 : 0;

  const diversity = Math.round(coverage.diversityScore * 0.15);

  const official = coverage.officialCount > 0 ? 12 : 0;

  const avgTrust =
    sourceTrust.length > 0
      ? sourceTrust.reduce((a, b) => a + b, 0) / sourceTrust.length
      : 50;
  const trust = Math.round(((avgTrust - 50) / 50) * 10);

  const consistency =
    verdict === "contradiction"
      ? -25
      : verdict === "consistent" || verdict === "complementary"
        ? 10
        : verdict === "update"
          ? 8
          : 0;

  const ageMs = now - new Date(lastUpdated).getTime();
  const freshness = isNaN(ageMs)
    ? 0
    : ageMs < 24 * 3600_000
      ? 5
      : ageMs < 72 * 3600_000
        ? 2
        : ageMs > 7 * 24 * 3600_000
          ? -5
          : 0;

  const score = Math.max(
    0,
    Math.min(100, sources + diversity + official + trust + consistency + freshness)
  );
  const label: ConfidenceLabel =
    score >= 70 ? "high" : score >= 40 ? "medium" : "low";

  return {
    score,
    label,
    parts: { sources, diversity, official, trust, consistency, freshness },
  };
}
