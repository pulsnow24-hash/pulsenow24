/**
 * Motorul SEO al Studioului — verificări deterministe, calculate live
 * pe client, fără apeluri AI. Sunt euristici editoriale oneste, nu
 * garanții de ranking.
 */
import type { FormState } from "@/app/admin/formState";

export type CheckLevel = "pass" | "warn" | "fail";

export interface SeoCheck {
  label: string;
  level: CheckLevel;
  detail: string;
  weight: number;
}

function fullText(form: FormState): string {
  return [
    form.sumar,
    form.fapt,
    form.deCeConteaza,
    form.unghi,
    form.opinie,
    form.predictie,
  ]
    .filter(Boolean)
    .join(" ");
}

export function seoChecks(form: FormState): SeoCheck[] {
  const checks: SeoCheck[] = [];
  const add = (label: string, level: CheckLevel, detail: string, weight = 1) =>
    checks.push({ label, level, detail, weight });

  const t = form.titlu.trim();
  if (!t) add("Titlu", "fail", "Lipsește titlul.", 3);
  else if (t.length > 90) add("Titlu", "warn", `${t.length} caractere — peste 90 se taie în Google Discover.`, 3);
  else if (t.length < 25) add("Titlu", "warn", `${t.length} caractere — prea scurt ca să spună povestea.`, 3);
  else add("Titlu", "pass", `${t.length} caractere.`, 3);

  const st = form.seoTitle.trim();
  if (!st) add("Title SEO", "warn", "Gol — se va folosi titlul articolului.", 2);
  else if (st.length > 60) add("Title SEO", "warn", `${st.length}/60 caractere — se trunchiază în rezultate.`, 2);
  else add("Title SEO", "pass", `${st.length}/60 caractere.`, 2);

  const md = form.metaDescription.trim();
  if (!md) add("Meta description", "fail", "Lipsește — Google va improviza una.", 3);
  else if (md.length > 158) add("Meta description", "warn", `${md.length}/158 caractere — se trunchiază.`, 3);
  else if (md.length < 70) add("Meta description", "warn", `${md.length} caractere — prea scurtă, folosește spațiul.`, 3);
  else add("Meta description", "pass", `${md.length}/158 caractere.`, 3);

  const slug = form.id.trim();
  if (!slug) add("Slug", "warn", "Se generează din titlu la salvare.", 1);
  else if (slug.length > 60) add("Slug", "warn", "Slug foarte lung.", 1);
  else add("Slug", "pass", `/articol/${slug}`, 1);

  const kw = form.keywords.split(",").map((k) => k.trim()).filter(Boolean);
  if (kw.length === 0) add("Keywords", "fail", "Niciun keyword — generează cu AI din Copilot.", 2);
  else if (kw.length < 4) add("Keywords", "warn", `${kw.length} keywords — recomandat 5-8.`, 2);
  else add("Keywords", "pass", `${kw.length} keywords.`, 2);

  const kwInText = kw.length
    ? kw.filter((k) => (t + " " + fullText(form)).toLowerCase().includes(k.toLowerCase())).length
    : 0;
  if (kw.length > 0) {
    if (kwInText === 0) add("Keywords în text", "fail", "Niciun keyword nu apare în conținut.", 2);
    else if (kwInText < Math.ceil(kw.length / 2)) add("Keywords în text", "warn", `${kwInText}/${kw.length} apar în conținut.`, 2);
    else add("Keywords în text", "pass", `${kwInText}/${kw.length} apar în conținut.`, 2);
  }

  if (!form.imagineUrl.trim()) add("Imagine", "fail", "Fără imagine nu intri în Google Discover.", 3);
  else add("Imagine", "pass", "Imagine principală setată.", 3);

  const tags = form.taguri.split(",").map((x) => x.trim()).filter(Boolean);
  if (tags.length === 0) add("Taguri", "warn", "Fără taguri — leagă articolul de subiecte.", 1);
  else add("Taguri", "pass", `${tags.length} taguri.`, 1);

  const words = fullText(form).split(/\s+/).filter(Boolean).length;
  if (words < 120) add("Lungime conținut", "warn", `${words} cuvinte — sub pragul pentru indexare bună (~150+).`, 2);
  else add("Lungime conținut", "pass", `${words} cuvinte.`, 2);

  const qaCount = form.qa.filter((p) => p.q.trim() && p.a.trim()).length;
  if (qaCount >= 3) add("FAQ (răspuns rapid)", "pass", `${qaCount} întrebări — excelent pentru căutările AI.`, 2);
  else add("FAQ (răspuns rapid)", "warn", `${qaCount}/3 întrebări pentru rich results.`, 2);

  if (form.sursaUrl.trim()) add("Sursă externă", "pass", "Link extern către sursă — semnal de credibilitate.", 1);
  else add("Sursă externă", "warn", "Fără link către sursa originală.", 1);

  return checks;
}

export function seoScore(checks: SeoCheck[]): number {
  const total = checks.reduce((s, c) => s + c.weight, 0);
  const got = checks.reduce(
    (s, c) => s + (c.level === "pass" ? c.weight : c.level === "warn" ? c.weight * 0.5 : 0),
    0
  );
  return total ? Math.round((got / total) * 100) : 0;
}

/** Lizibilitate: euristică pentru română (lungimea frazelor + cuvinte lungi). */
export function readability(form: FormState): {
  score: number;
  label: string;
  detail: string;
} {
  const text = fullText(form);
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 20) {
    return { score: 0, label: "—", detail: "Prea puțin text pentru evaluare." };
  }
  const avgSentence = words.length / Math.max(1, sentences.length);
  const longWords = words.filter((w) => w.replace(/[^a-zăâîșț]/gi, "").length >= 10).length;
  const longRatio = longWords / words.length;
  // 100 = foarte ușor; penalizăm frazele lungi și cuvintele lungi
  const score = Math.max(0, Math.min(100, Math.round(120 - avgSentence * 2.4 - longRatio * 180)));
  const label = score >= 70 ? "Ușor de citit" : score >= 45 ? "Mediu" : "Greoi";
  return {
    score,
    label,
    detail: `~${Math.round(avgSentence)} cuvinte/frază · ${Math.round(longRatio * 100)}% cuvinte lungi`,
  };
}

/** Pregătirea pentru Google Discover — checklist dedicat. */
export function discoverChecks(form: FormState): SeoCheck[] {
  const checks: SeoCheck[] = [];
  const t = form.titlu.trim();
  checks.push({
    label: "Imagine mare",
    level: form.imagineUrl.trim() ? "pass" : "fail",
    detail: form.imagineUrl.trim()
      ? "Imagine prezentă (Discover cere min. 1200px lățime)."
      : "Obligatorie pentru Discover.",
    weight: 1,
  });
  checks.push({
    label: "Titlu care stârnește interes",
    level: !t ? "fail" : t.length >= 30 && t.length <= 90 ? "pass" : "warn",
    detail: t ? `${t.length} caractere.` : "Lipsește.",
    weight: 1,
  });
  checks.push({
    label: "Fără clickbait gol",
    level: /șoc|incredibil|nu o să crezi|bombă/i.test(t) ? "warn" : "pass",
    detail: /șoc|incredibil|nu o să crezi|bombă/i.test(t)
      ? "Formulările tabloide sunt penalizate de Discover."
      : "Titlul pare onest.",
    weight: 1,
  });
  checks.push({
    label: "Categorie & taguri",
    level: form.categorie && form.taguri.trim() ? "pass" : "warn",
    detail: "Ajută încadrarea tematică în Discover.",
    weight: 1,
  });
  return checks;
}
