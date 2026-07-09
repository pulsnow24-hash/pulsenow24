import type { ArticleSocial } from "@/lib/articles";
import type { FormState } from "@/app/admin/formState";

export interface CompletenessItem {
  label: string;
  done: boolean;
}

/** Elementele care compun scorul de pregătire pentru publicare. */
export function completeness(form: FormState, social: ArticleSocial | null) {
  const items: CompletenessItem[] = [
    { label: "Titlu", done: !!form.titlu.trim() },
    { label: "Pe scurt, acum", done: !!form.sumar.trim() },
    { label: "Ce s-a întâmplat", done: !!form.fapt.trim() },
    { label: "De ce contează", done: !!form.deCeConteaza.trim() },
    { label: "Unghiul ascuns", done: !!form.unghi.trim() },
    { label: "Opinia PulsNow24", done: !!form.opinie.trim() },
    { label: "Ce urmează", done: !!form.predictie.trim() },
    { label: "Întrebarea zilei", done: !!form.dezbatere.trim() },
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
  const done = items.filter((i) => i.done).length;
  return {
    items,
    done,
    total: items.length,
    percent: Math.round((done / items.length) * 100),
    missing: items.filter((i) => !i.done),
  };
}
