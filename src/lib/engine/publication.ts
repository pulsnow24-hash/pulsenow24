/**
 * News Platform Engine — configurația publicației.
 *
 * Tot ce ține de identitatea editorială (blocuri, workflow, categorii, brand)
 * stă AICI, nu în componente. Editorul, panourile SEO și site-ul public citesc
 * această configurație, astfel încât un proiect nou (CryptoNow24, SportNow24,
 * Valcea24…) înseamnă doar o altă instanță de PublicationConfig.
 */
import {
  Zap,
  Newspaper,
  Target,
  EyeOff,
  TrendingUp,
  MessageCircleQuestion,
  PenLine,
  HelpCircle,
  FileEdit,
  Eye,
  ShieldCheck,
  CheckCircle2,
  CalendarClock,
  Globe,
  type LucideIcon,
} from "lucide-react";

/** Un bloc editorial: legat 1:1 de un câmp text din articol. */
export interface EditorialBlock {
  /** Cheia câmpului din Article/FormState */
  field: string;
  title: string;
  icon: LucideIcon;
  /** Clasa Tailwind pentru accentul blocului */
  accent: string;
  placeholder: string;
  /** Instrucțiune pentru AI la regenerarea blocului */
  aiHint: string;
  /** Blocurile fixate nu se pot reordona (teaser, dezbatere, FAQ) */
  pinned?: boolean;
  /** Rânduri implicite pentru textarea */
  rows?: number;
}

export type WorkflowState =
  | "draft"
  | "review"
  | "factchecked"
  | "ready"
  | "scheduled"
  | "published";

export interface WorkflowMeta {
  id: WorkflowState;
  label: string;
  icon: LucideIcon;
  /** Clase text/fundal pentru badge */
  className: string;
  /** Articolul e vizibil public în această stare? */
  live: boolean;
}

export interface PublicationConfig {
  name: string;
  tagline: string;
  url: string;
  categories: string[];
  buzzCategories: string[];
  /** Blocul-teaser (apare pe carduri, nu în corpul articolului) */
  teaserBlock: EditorialBlock;
  /** Blocurile de conținut, reordonabile prin drag & drop */
  bodyBlocks: EditorialBlock[];
  /** Blocul de dezbatere/engagement */
  debateBlock: EditorialBlock;
  workflow: WorkflowMeta[];
}

export const PUBLICATION: PublicationConfig = {
  name: "PulsNow24",
  tagline: "Pulsul zilei, pe scurt",
  url: "https://pulsnow24.com",
  categories: [
    "Actualitate",
    "Business",
    "AI & Tech",
    "Politică",
    "Geopolitică",
    "Monden",
    "Viral",
  ],
  buzzCategories: ["Monden", "Viral"],

  teaserBlock: {
    field: "sumar",
    title: "Pe scurt, acum",
    icon: Zap,
    accent: "text-sky-400",
    placeholder: "Esența știrii în 1-2 fraze — apare pe cardurile de pe prima pagină…",
    aiHint:
      "Rezumatul-teaser al știrii: 1-2 fraze care fac cititorul să deschidă articolul, fără clickbait gol.",
    pinned: true,
    rows: 2,
  },

  bodyBlocks: [
    {
      field: "fapt",
      title: "Ce s-a întâmplat",
      icon: Newspaper,
      accent: "text-blue-400",
      placeholder: "Doar faptele confirmate, fără interpretare…",
      aiHint:
        "Faptele verificate ale știrii: ce s-a întâmplat concret, cine, când, unde — fără opinie (2-4 fraze).",
      rows: 4,
    },
    {
      field: "deCeConteaza",
      title: "De ce contează",
      icon: Target,
      accent: "text-cyan-400",
      placeholder: "Impactul concret asupra cititorului…",
      aiHint:
        "De ce contează această știre pentru cititorul român obișnuit: impact concret, miză, consecințe practice (2-3 fraze).",
      rows: 3,
    },
    {
      field: "unghi",
      title: "Unghiul ascuns",
      icon: EyeOff,
      accent: "text-amber-400",
      placeholder: "Ce nu spune sursa direct — context, interese, implicații…",
      aiHint:
        "Unghiul ascuns: ce nu spune sursa direct — contextul, interesele din spate, implicațiile mai puțin evidente (2-3 fraze).",
      rows: 3,
    },
    {
      field: "opinie",
      title: "Opinia PulsNow24",
      icon: PenLine,
      accent: "text-violet-400",
      placeholder: "Poziția editorială, echilibrată dar cu personalitate…",
      aiHint:
        'Opinia editorială a publicației: echilibrată dar cu personalitate, începe cu "Părerea PulsNow24:" (2-3 fraze).',
      rows: 3,
    },
    {
      field: "predictie",
      title: "Ce urmează",
      icon: TrendingUp,
      accent: "text-emerald-400",
      placeholder: "Ce anticipăm că urmează, formulat prudent…",
      aiHint:
        'Predicția: ce urmează cel mai probabil, formulat prudent ("Estimăm…", "Anticipăm…") (1-2 fraze).',
      rows: 2,
    },
  ],

  debateBlock: {
    field: "dezbatere",
    title: "Întrebarea zilei",
    icon: MessageCircleQuestion,
    accent: "text-pink-400",
    placeholder: "O singură întrebare care invită cititorii la discuție…",
    aiHint:
      "O singură întrebare de dezbatere care invită cititorii la discuție în comentarii, legată direct de știre.",
    pinned: true,
    rows: 2,
  },

  workflow: [
    { id: "draft", label: "Draft", icon: FileEdit, className: "text-zinc-400 bg-zinc-500/10 border-zinc-500/30", live: false },
    { id: "review", label: "Necesită revizuire", icon: Eye, className: "text-amber-400 bg-amber-500/10 border-amber-500/30", live: false },
    { id: "factchecked", label: "Verificat", icon: ShieldCheck, className: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30", live: false },
    { id: "ready", label: "Gata de publicare", icon: CheckCircle2, className: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", live: false },
    { id: "scheduled", label: "Programat", icon: CalendarClock, className: "text-blue-400 bg-blue-500/10 border-blue-500/30", live: true },
    { id: "published", label: "Publicat", icon: Globe, className: "text-primary bg-primary/10 border-primary/30", live: true },
  ],
};

/** Ordinea implicită a blocurilor de conținut (câmpurile din bodyBlocks). */
export const DEFAULT_BLOCK_ORDER: string[] = PUBLICATION.bodyBlocks.map(
  (b) => b.field
);

export function workflowMeta(id: string | undefined): WorkflowMeta {
  return (
    PUBLICATION.workflow.find((w) => w.id === id) ?? PUBLICATION.workflow[0]
  );
}

export function blockByField(field: string): EditorialBlock | undefined {
  if (PUBLICATION.teaserBlock.field === field) return PUBLICATION.teaserBlock;
  if (PUBLICATION.debateBlock.field === field) return PUBLICATION.debateBlock;
  return PUBLICATION.bodyBlocks.find((b) => b.field === field);
}

/** Iconiță generică pentru FAQ (folosită de blocul Răspuns rapid). */
export const FAQ_ICON: LucideIcon = HelpCircle;
