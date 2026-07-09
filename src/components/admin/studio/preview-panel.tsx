"use client";

import { useState } from "react";
import { Monitor, Tablet, Smartphone, Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FormState } from "@/app/admin/formState";
import { PUBLICATION, blockByField } from "@/lib/engine/publication";

/** Maparea câmp → stilurile publice (identice cu pagina de articol). */
const PREVIEW_BLOCKS: Record<string, { className: string; label: string }> = {
  fapt: { className: "fb-fact", label: "● Faptul verificat" },
  deCeConteaza: { className: "fb-why", label: "◎ De ce contează" },
  unghi: { className: "fb-angle", label: "◆ Unghiul ascuns" },
  opinie: { className: "fb-opinion", label: "▲ Opinia PulsNow24" },
  predictie: { className: "fb-predict", label: "↗ Predicția" },
};

function siteHost(): string {
  return PUBLICATION.url.replace(/^https?:\/\//, "");
}

/** Articolul randat cu stilurile REALE ale site-ului public. */
function ArticlePreview({ form }: { form: FormState }) {
  const qa = form.qa.filter((p) => p.q.trim() && p.a.trim());
  return (
    <div style={{ background: "var(--bg)", color: "var(--ink)" }} className="px-6 py-8">
      <div className="article-view" style={{ display: "block" }}>
        <div>
          <span className={`badge ${form.breaking ? "breaking" : "cat-blue"}`}>
            {form.breaking ? "Breaking" : form.categorie}
          </span>
        </div>
        <h1 style={{ fontFamily: "var(--serif)" }}>
          {form.titlu || "Titlul articolului"}
        </h1>
        <div className="article-byline">
          <span>De Redacția {PUBLICATION.name}</span>
          <span>·</span>
          <span>{new Date().toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })}</span>
          {form.citire && (
            <>
              <span>·</span>
              <span>{form.citire} citire</span>
            </>
          )}
        </div>
        {form.imagineUrl.trim() && (
          <figure className="article-figure">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={form.imagineUrl} alt="" />
            {form.imagineCredit && <figcaption>{form.imagineCredit}</figcaption>}
          </figure>
        )}
        <div className="article-body">
          {form.blockOrder.map((field) => {
            const def = PREVIEW_BLOCKS[field];
            const text = (form[field as keyof FormState] as string) ?? "";
            if (!def || !text.trim()) return null;
            return (
              <div className={`format-block ${def.className}`} key={field}>
                <span className="fb-label">{def.label}</span>
                <p>{text}</p>
              </div>
            );
          })}
          {qa.length > 0 && (
            <div className="aeo-box">
              <div className="aeo-header">
                <span className="tag">Răspuns rapid</span>
                <h4>Întrebări frecvente despre acest subiect</h4>
              </div>
              {qa.map((pair) => (
                <div className="qa-item" key={pair.q}>
                  <div className="qa-q">{pair.q}</div>
                  <div className="qa-a">{pair.a}</div>
                </div>
              ))}
            </div>
          )}
          {form.dezbatere.trim() && (
            <div className="debate-box">
              <div className="db-label">Tu ce crezi?</div>
              <div className="db-q">{form.dezbatere}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const DEVICES = [
  { id: "mobile", label: "Mobil", icon: Smartphone, width: 375 },
  { id: "tablet", label: "Tabletă", icon: Tablet, width: 768 },
  { id: "desktop", label: "Desktop", icon: Monitor, width: 1060 },
] as const;

export default function PreviewPanel({ form }: { form: FormState }) {
  const [device, setDevice] = useState<(typeof DEVICES)[number]["id"]>("mobile");
  const active = DEVICES.find((d) => d.id === device)!;
  const teaserBlock = blockByField(PUBLICATION.teaserBlock.field);

  return (
    <div className="h-full space-y-5 overflow-y-auto p-4">
      {/* Google Discover */}
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Google Discover
        </p>
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          {form.imagineUrl.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.imagineUrl}
              alt=""
              className="aspect-video w-full object-cover"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center bg-zinc-200 text-xs text-zinc-500">
              fără imagine — invizibil în Discover
            </div>
          )}
          <div className="space-y-1 p-3">
            <p className="text-[15px] font-medium leading-snug text-zinc-900">
              {form.titlu || "Titlul articolului"}
            </p>
            <p className="text-[11px] text-zinc-500">
              {siteHost()} · {new Date().toLocaleDateString("ro-RO", { day: "numeric", month: "short" })}
            </p>
          </div>
        </div>
      </div>

      {/* Facebook */}
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Facebook
        </p>
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          {form.imagineUrl.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.imagineUrl}
              alt=""
              className="aspect-[1.91/1] w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[1.91/1] w-full items-center justify-center bg-zinc-200 text-xs text-zinc-500">
              og:image lipsă
            </div>
          )}
          <div className="space-y-0.5 border-t border-zinc-200 bg-zinc-100 p-3">
            <p className="font-mono text-[10px] uppercase text-zinc-500">
              {siteHost()}
            </p>
            <p className="text-[14px] font-semibold leading-snug text-zinc-900">
              {form.seoTitle.trim() || form.titlu || "Titlul articolului"}
            </p>
            <p className="line-clamp-2 text-[12px] text-zinc-600">
              {form.metaDescription.trim() || form.sumar || teaserBlock?.placeholder}
            </p>
          </div>
        </div>
      </div>

      {/* Live preview pe dispozitive */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Maximize2 className="size-4" />
            Previzualizare completă
          </Button>
        </DialogTrigger>
        <DialogContent className="flex h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1160px]">
          <DialogHeader className="flex-row items-center justify-between space-y-0 border-b border-border px-4 py-3">
            <DialogTitle className="text-sm">Previzualizare articol</DialogTitle>
            <div className="mr-6 flex items-center rounded-lg border border-border p-0.5">
              {DEVICES.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDevice(d.id)}
                  aria-label={d.label}
                  className={cn(
                    "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs text-muted-foreground transition-colors",
                    device === d.id && "bg-accent text-foreground"
                  )}
                >
                  <d.icon className="size-3.5" />
                  {d.label}
                </button>
              ))}
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto bg-black/40 p-6">
            <div
              className="mx-auto overflow-hidden rounded-xl border border-border shadow-2xl transition-[max-width] duration-300"
              style={{ maxWidth: active.width }}
            >
              <ArticlePreview form={form} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
