"use client";

import { useRef, useState } from "react";
import {
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import {
  Sparkles,
  Upload,
  Download,
  Trash2,
  Image as ImageIcon,
  Settings2,
  Loader2,
  Plus,
  X,
  ChevronDown,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Auth } from "firebase/auth";
import type { GeneratedArticle } from "@/lib/ai-types";
import type { QAPair } from "@/lib/articles";
import { PUBLICATION, FAQ_ICON } from "@/lib/engine/publication";
import { callApi } from "@/app/admin/api";
import AiProgress from "@/app/admin/AiProgress";
import {
  estimateCitire,
  slugify,
  type FormState,
} from "@/app/admin/formState";

/* ── Card generic de secțiune ─────────────────────────────── */

export function SectionCard({
  icon: Icon,
  title,
  children,
  defaultOpen = true,
  id,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} className="rounded-xl border border-border bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <Icon className="size-4 text-muted-foreground" />
        <h3 className="flex-1 text-[13px] font-medium">{title}</h3>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground/60 transition-transform duration-200",
            !open && "-rotate-90"
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 px-4 pb-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

/* ── Import AI (URL / text) ───────────────────────────────── */

export function AiImportCard({
  auth,
  onGenerated,
  hasContent,
}: {
  auth: Auth;
  onGenerated: (article: GeneratedArticle, sourceUrl: string) => void;
  hasContent: boolean;
}) {
  const [open, setOpen] = useState(!hasContent);
  const [mode, setMode] = useState<"url" | "text">("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function generate() {
    const input = mode === "url" ? { url: url.trim() } : { text: text.trim() };
    if (!input.url && !input.text) {
      toast.info("Lipește un link sau un text mai întâi.");
      return;
    }
    setBusy(true);
    try {
      const g = await callApi<GeneratedArticle>(auth, "/api/ai/generate", input, 320_000);
      onGenerated(g, input.url ?? "");
      setOpen(false);
      toast.success("Articol generat — verifică fiecare bloc înainte de publicare.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/[0.07] to-transparent">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <Sparkles className="size-4 text-primary" />
        <h3 className="flex-1 text-[13px] font-medium">
          Începe de la un draft AI
          <span className="ml-2 font-normal text-muted-foreground">
            — link sau text, formularul se completează singur
          </span>
        </h3>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground/60 transition-transform duration-200",
            !open && "-rotate-90"
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 px-4 pb-4">
            <div className="flex gap-1 rounded-lg border border-border bg-card p-0.5 w-fit">
              {(["url", "text"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs text-muted-foreground transition-colors",
                    mode === m && "bg-accent text-foreground"
                  )}
                >
                  {m === "url" ? "Link articol" : "Text lipit"}
                </button>
              ))}
            </div>
            {mode === "url" ? (
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://exemplu.ro/stirea-sursa"
              />
            ) : (
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                placeholder="Lipește aici textul știrii-sursă…"
              />
            )}
            <Button onClick={generate} disabled={busy}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Importă și generează cu AI
            </Button>
            {busy && (
              <AiProgress
                durata={45}
                etape={[
                  "Descarc pagina-sursă…",
                  "Extrag conținutul și imaginea…",
                  "AI-ul citește și analizează știrea…",
                  "Scriu articolul în formatul redacției…",
                  "Generez SEO, taguri și sursa…",
                  "Aproape gata…",
                ]}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Media (imagine principală) ───────────────────────────── */

export function MediaCard({
  auth,
  form,
  set,
}: {
  auth: Auth;
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const isExternal =
    !!form.imagineUrl.trim() &&
    !form.imagineUrl.includes("firebasestorage.googleapis.com") &&
    !form.imagineUrl.includes(".firebasestorage.app");

  async function toStorage(blob: Blob, contentType: string): Promise<string> {
    const storage = getStorage(auth.app);
    const ext = (contentType.split("/")[1] ?? "jpg").split("+")[0];
    const name = `${slugify(form.titlu) || "imagine"}-${Date.now()}.${ext}`;
    const r = storageRef(storage, `articole/${name}`);
    await uploadBytes(r, blob, { contentType });
    return getDownloadURL(r);
  }

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Fișierul ales nu e o imagine.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Imaginea depășește 10 MB.");
      return;
    }
    setBusy(true);
    try {
      set("imagineUrl", await toStorage(file, file.type));
      toast.success("Imagine încărcată.");
    } catch (e) {
      toast.error(
        `Nu am putut încărca imaginea: ${e instanceof Error ? e.message : e}`
      );
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function importFromSource() {
    if (!form.imagineUrl.trim()) return;
    setBusy(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Sesiune expirată");
      const token = await user.getIdToken();
      const res = await fetch("/api/image/fetch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: form.imagineUrl.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Eroare server (${res.status})`);
      }
      const blob = await res.blob();
      set("imagineUrl", await toStorage(blob, blob.type || "image/jpeg"));
      toast.success("Imaginea a fost copiată în galeria ta.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard icon={ImageIcon} title="Imagine principală" id="block-imagine">
      {form.imagineUrl.trim() ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={form.imagineUrl}
            alt="Previzualizare"
            className="max-h-56 w-full rounded-lg border border-border object-cover"
          />
          {isExternal && (
            <p className="text-[11.5px] text-amber-400">
              Imaginea e găzduită pe site-ul sursă — importă-o în galeria ta ca
              să nu dispară.
            </p>
          )}
        </div>
      ) : (
        <p className="text-[12.5px] text-muted-foreground">
          Nicio imagine. Încarcă una sau generează articolul dintr-un link —
          AI-ul preia automat imaginea sursei.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          Încarcă
        </Button>
        {isExternal && (
          <Button size="sm" variant="outline" onClick={importFromSource} disabled={busy}>
            <Download className="size-4" />
            Importă în galerie
          </Button>
        )}
        {form.imagineUrl.trim() && (
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => set("imagineUrl", "")}
            disabled={busy}
          >
            <Trash2 className="size-4" />
            Elimină
          </Button>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">URL imagine</Label>
          <Input
            value={form.imagineUrl}
            onChange={(e) => set("imagineUrl", e.target.value)}
            placeholder="https://…"
            className="h-8 font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Credit foto</Label>
          <Input
            value={form.imagineCredit}
            onChange={(e) => set("imagineCredit", e.target.value)}
            placeholder="ex: Foto: Agerpres"
            className="h-8 text-xs"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          Imagine sugerată de AI (brief pentru editor foto)
        </Label>
        <Input
          value={form.imagineSugestie}
          onChange={(e) => set("imagineSugestie", e.target.value)}
          className="h-8 text-xs"
        />
      </div>
    </SectionCard>
  );
}

/* ── Detalii (categorie, taguri, sursă, timp) ─────────────── */

export function DetailsCard({
  form,
  set,
  publishInfo,
}: {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  publishInfo: string;
}) {
  return (
    <SectionCard icon={Settings2} title="Detalii & sursă">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Categorie</Label>
          <Select
            value={form.categorie}
            onValueChange={(v) => set("categorie", v)}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PUBLICATION.categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 self-end rounded-lg border border-border px-3 py-2">
          <Switch
            checked={form.breaking}
            onCheckedChange={(v) => set("breaking", v)}
          />
          <span className="text-xs text-muted-foreground">Breaking news</span>
        </label>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          Taguri (separate prin virgulă)
        </Label>
        <Input
          value={form.taguri}
          onChange={(e) => set("taguri", e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Sursa</Label>
          <Input
            value={form.sursaNume}
            onChange={(e) => set("sursaNume", e.target.value)}
            placeholder="ex: Reuters"
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs text-muted-foreground">Link original</Label>
          <Input
            value={form.sursaUrl}
            onChange={(e) => set("sursaUrl", e.target.value)}
            placeholder="https://…"
            className="h-8 font-mono text-xs"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Autor sursă</Label>
          <Input
            value={form.autor}
            onChange={(e) => set("autor", e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Timp de citire</Label>
          <div className="flex gap-1.5">
            <Input
              value={form.citire}
              onChange={(e) => set("citire", e.target.value)}
              placeholder="auto"
              className="h-8 text-xs"
            />
            <Button
              size="icon"
              variant="outline"
              className="size-8 shrink-0"
              aria-label="Estimează timpul de citire"
              onClick={() =>
                set(
                  "citire",
                  estimateCitire(
                    form.fapt,
                    form.deCeConteaza,
                    form.unghi,
                    form.opinie,
                    form.predictie
                  )
                )
              }
            >
              <Timer className="size-3.5" />
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Publicare</Label>
          <p className="flex h-8 items-center rounded-lg border border-border px-2.5 font-mono text-[11px] text-muted-foreground">
            {publishInfo}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

/* ── FAQ / Răspuns rapid ──────────────────────────────────── */

export function FaqCard({
  qa,
  onChange,
  onGenerate,
  busy,
}: {
  qa: QAPair[];
  onChange: (qa: QAPair[]) => void;
  onGenerate: () => void;
  busy: boolean;
}) {
  return (
    <SectionCard icon={FAQ_ICON} title="Răspuns rapid (FAQ)" id="block-qa">
      {qa.map((pair, i) => (
        <div key={i} className="flex gap-2">
          <div className="flex-1 space-y-1.5">
            <Input
              value={pair.q}
              placeholder="Întrebare"
              onChange={(e) => {
                const next = [...qa];
                next[i] = { ...next[i], q: e.target.value };
                onChange(next);
              }}
              className="h-8 text-xs"
            />
            <Input
              value={pair.a}
              placeholder="Răspuns"
              onChange={(e) => {
                const next = [...qa];
                next[i] = { ...next[i], a: e.target.value };
                onChange(next);
              }}
              className="h-8 text-xs"
            />
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="size-8 shrink-0 self-center text-muted-foreground"
            aria-label="Șterge întrebarea"
            onClick={() => onChange(qa.filter((_, j) => j !== i))}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onChange([...qa, { q: "", a: "" }])}
        >
          <Plus className="size-4" />
          Adaugă
        </Button>
        <Button size="sm" variant="outline" onClick={onGenerate} disabled={busy}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          Generează cu AI
        </Button>
      </div>
    </SectionCard>
  );
}
