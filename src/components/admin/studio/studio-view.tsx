"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { doc, getDoc, setDoc } from "firebase/firestore/lite";
import { toast } from "sonner";
import { Bot, Gauge, Eye } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNewsroom } from "@/components/admin/newsroom-provider";
import { callApi } from "@/app/admin/api";
import {
  FORM_GOL,
  formToArticle,
  generatedToForm,
  slugify,
  type FormState,
} from "@/app/admin/formState";
import type { Article, ArticleSocial } from "@/lib/articles";
import type { CopilotResult, GeneratedArticle } from "@/lib/ai-types";
import {
  PUBLICATION,
  blockByField,
  workflowMeta,
  type WorkflowState,
} from "@/lib/engine/publication";
import type { Story } from "@/lib/engine/story";
import {
  ensureStoryForArticle,
  getStory,
  linkArticleToStory,
} from "@/lib/story-store";
import BlockCard from "./block-card";
import StoryCard from "./story-card";
import OutlinePanel, { type SaveState } from "./outline-panel";
import CopilotPanel, { type CopilotApply } from "./copilot-panel";
import SeoPanel from "./seo-panel";
import PreviewPanel from "./preview-panel";
import { AiImportCard, DetailsCard, FaqCard, MediaCard } from "./cards";

type TextField = keyof Pick<
  FormState,
  "sumar" | "fapt" | "deCeConteaza" | "unghi" | "opinie" | "predictie" | "dezbatere"
>;

export default function StudioView() {
  const { db, auth, consumePendingEdit } = useNewsroom();

  const [form, setForm] = useState<FormState>(FORM_GOL);
  const [editId, setEditId] = useState<string | null>(null);
  const [existing, setExisting] = useState<Article | null>(null);
  const [social, setSocial] = useState<ArticleSocial | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowState>("draft");
  const [scheduledFor, setScheduledFor] = useState("");

  const [focusedField, setFocusedField] = useState<TextField | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [busyBlock, setBusyBlock] = useState<string | null>(null);

  const [dragField, setDragField] = useState<string | null>(null);
  const [overField, setOverField] = useState<string | null>(null);
  const [story, setStory] = useState<Story | null>(null);

  const savedRef = useRef<string>("");

  const set = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) =>
      setForm((f) => ({ ...f, [key]: value })),
    []
  );

  /* ── Preluarea articolului din Inbox / Articole ─────────── */
  useEffect(() => {
    const req = consumePendingEdit();
    if (!req) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(req.form);
    setEditId(req.editId);
    setSocial(req.social);
    if (req.editId) {
      getDoc(doc(db, "articles", req.editId)).then((snap) => {
        if (!snap.exists()) return;
        const art = { ...snap.data(), id: snap.id } as Article;
        setExisting(art);
        const w = (art.workflow as WorkflowState) ?? (art.status === "publicat" ? "published" : "draft");
        setWorkflow(w);
        if (w === "scheduled" && art.publicatLa) {
          setScheduledFor(art.publicatLa.slice(0, 16));
        }
      });
    }
    // Rulează o singură dată, la montare
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Story context: încarcă story-ul articolului curent ─── */
  useEffect(() => {
    const storyId = form.storyId.trim();
    if (!storyId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStory(null);
      return;
    }
    let cancelled = false;
    getStory(db, storyId)
      .then((s) => {
        if (!cancelled) setStory(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [db, form.storyId]);

  /* ── Salvare ────────────────────────────────────────────── */
  const snapshot = JSON.stringify({ form, social, workflow, scheduledFor });

  const save = useCallback(
    async (announce: boolean) => {
      const id = editId ?? (form.id || slugify(form.titlu));
      if (!id) {
        if (announce) toast.error("Scrie un titlu mai întâi.");
        return;
      }
      if (workflow === "scheduled" && !scheduledFor) {
        if (announce) toast.error("Alege data și ora programării.");
        return;
      }
      setSaving(true);
      setSaveState("saving");
      try {
        const articol = formToArticle(form, {
          workflow,
          scheduledFor: scheduledFor || undefined,
          existent: existing ?? undefined,
          social,
        });
        await setDoc(doc(db, "articles", id), articol);
        setEditId(id);
        setExisting({ ...articol, id });
        if (!form.id) set("id", id);

        // ── Story Engine: fiecare articol aparține unui Story ──
        // Eșecul legăturii nu blochează salvarea articolului.
        try {
          if (form.storyId.trim()) {
            const updated = await linkArticleToStory(db, form.storyId.trim(), {
              id,
              titlu: articol.titlu,
              imagine: articol.imagine,
            });
            if (updated) setStory(updated);
          } else {
            const created = await ensureStoryForArticle(db, {
              id,
              titlu: articol.titlu,
              sumar: articol.sumar,
              categorie: articol.categorie,
              taguri: articol.taguri,
              imagine: articol.imagine,
            });
            set("storyId", created.id);
            await setDoc(doc(db, "articles", id), {
              ...articol,
              storyId: created.id,
            });
            setStory(created);
          }
        } catch {
          /* story indisponibil — articolul rămâne salvat */
        }
        savedRef.current = snapshot;
        setLastSavedAt(new Date());
        setSaveState("saved");
        if (announce) {
          if (workflow === "published") {
            toast.success(`Articol publicat: /articol/${id}`);
          } else if (workflow === "scheduled") {
            toast.success(
              `Programat pentru ${new Date(scheduledFor).toLocaleString("ro-RO")}`
            );
          } else {
            toast.success("Salvat.");
          }
        }
      } catch (e) {
        setSaveState("dirty");
        toast.error(
          `Nu am putut salva: ${e instanceof Error ? e.message : e}`
        );
      } finally {
        setSaving(false);
      }
    },
    [db, editId, existing, form, scheduledFor, set, snapshot, social, workflow]
  );

  /* ── Autosave (doar pentru stările non-live) ────────────── */
  useEffect(() => {
    if (!form.titlu.trim()) return;
    if (savedRef.current === snapshot) return;
    setSaveState("dirty");
    if (workflowMeta(workflow).live) return;
    const timer = setTimeout(() => save(false), 2500);
    return () => clearTimeout(timer);
  }, [snapshot, form.titlu, workflow, save]);

  /* ── ⌘S ─────────────────────────────────────────────────── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  /* ── AI Copilot ─────────────────────────────────────────── */
  const copilotContext = useMemo(
    () => ({
      titlu: form.titlu,
      sumar: form.sumar,
      fapt: form.fapt,
      deCeConteaza: form.deCeConteaza,
      unghi: form.unghi,
      opinie: form.opinie,
      predictie: form.predictie,
      dezbatere: form.dezbatere,
      categorie: form.categorie,
      taguri: form.taguri,
      keywords: form.keywords,
      sursaNume: form.sursaNume,
      sursaUrl: form.sursaUrl,
    }),
    [form]
  );

  const buildTarget = useCallback(
    (field: TextField) => {
      const block = blockByField(field);
      return {
        field,
        label: block?.title ?? field,
        text: (form[field] as string) ?? "",
        hint: block?.aiHint,
      };
    },
    [form]
  );

  const runCopilot = useCallback(
    async (actionId: string): Promise<CopilotResult> => {
      setBusyAction(actionId);
      try {
        return await callApi<CopilotResult>(auth, "/api/ai/copilot", {
          action: actionId,
          article: copilotContext,
          target: focusedField ? buildTarget(focusedField) : undefined,
        });
      } finally {
        setBusyAction(null);
      }
    },
    [auth, copilotContext, focusedField, buildTarget]
  );

  const setFieldWithUndo = useCallback(
    (field: string, value: string) => {
      const prev = (form[field as keyof FormState] as string) ?? "";
      set(field as keyof FormState, value as never);
      toast.success("Text aplicat.", {
        action: {
          label: "Anulează",
          onClick: () => set(field as keyof FormState, prev as never),
        },
      });
    },
    [form, set]
  );

  const copilotApply: CopilotApply = useMemo(
    () => ({
      setTitle: (v) => set("titlu", v),
      setFieldWithUndo,
      setMeta: (v) => set("metaDescription", v),
      setKeywords: (v) => set("keywords", v),
      setQa: (qa) => set("qa", qa),
      setSocial: (k, v) => setSocial((s) => ({ ...(s ?? {}), [k]: v })),
      setImagePrompt: (v) => set("imagineSugestie", v),
    }),
    [set, setFieldWithUndo]
  );

  /** Acțiune AI direct de pe un bloc (regenerare, rescriere, ton…). */
  const runBlockAction = useCallback(
    async (field: TextField, actionId: string) => {
      setBusyBlock(field);
      try {
        const result = await callApi<CopilotResult>(auth, "/api/ai/copilot", {
          action: actionId,
          article: copilotContext,
          target: buildTarget(field),
        });
        if (result.kind === "text") setFieldWithUndo(field, result.text);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyBlock(null);
      }
    },
    [auth, copilotContext, buildTarget, setFieldWithUndo]
  );

  const generateFaq = useCallback(async () => {
    setBusyAction("faq");
    try {
      const result = await callApi<CopilotResult>(auth, "/api/ai/copilot", {
        action: "faq",
        article: copilotContext,
      });
      if (result.kind === "qa") {
        set("qa", result.qa);
        toast.success("FAQ generat.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyAction(null);
    }
  }, [auth, copilotContext, set]);

  /* ── Drag & drop pentru blocurile de conținut ───────────── */
  function reorder(target: string) {
    if (!dragField || dragField === target) return;
    const order = form.blockOrder.filter((f) => f !== dragField);
    order.splice(order.indexOf(target), 0, dragField);
    set("blockOrder", order);
  }

  /* ── Randare ────────────────────────────────────────────── */
  const isLive = workflowMeta(workflow).live && existing?.status === "publicat";
  const hasContent = !!form.titlu.trim();
  const slugValue = editId ?? form.id;
  const focusedBlock = focusedField ? blockByField(focusedField) : null;

  const publishInfo =
    workflow === "scheduled" && scheduledFor
      ? new Date(scheduledFor).toLocaleString("ro-RO", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : (existing?.data?.split(",")[0] ?? "la publicare");

  const blockProps = (field: TextField, draggable: boolean) => {
    const block = blockByField(field)!;
    return {
      block,
      value: (form[field] as string) ?? "",
      onChange: (v: string) => set(field, v as never),
      onFocus: () => setFocusedField(field),
      collapsed: collapsed.has(field),
      onToggleCollapse: () =>
        setCollapsed((c) => {
          const next = new Set(c);
          if (next.has(field)) next.delete(field);
          else next.add(field);
          return next;
        }),
      onAiAction: (actionId: string) => runBlockAction(field, actionId),
      aiBusy: busyBlock === field,
      draggable,
      dragging: dragField === field,
      dropTarget: overField === field && dragField !== field,
      onDragStart: () => setDragField(field),
      onDragEnd: () => {
        setDragField(null);
        setOverField(null);
      },
      onDragOver: (e: React.DragEvent) => {
        if (!dragField) return;
        e.preventDefault();
        setOverField(field);
      },
      onDrop: () => {
        reorder(field);
        setDragField(null);
        setOverField(null);
      },
    };
  };

  return (
    <div className="flex h-full">
      {/* STÂNGA — outline & workflow */}
      <aside className="hidden w-60 shrink-0 border-r border-border xl:block">
        <OutlinePanel
          form={form}
          social={social}
          workflow={workflow}
          onWorkflowChange={setWorkflow}
          scheduledFor={scheduledFor}
          onScheduledChange={setScheduledFor}
          saveState={saveState}
          lastSavedAt={lastSavedAt}
          onSave={() => save(true)}
          saving={saving}
          editId={editId}
          isLive={isLive}
        />
      </aside>

      {/* CENTRU — editorul */}
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[760px] space-y-3 px-6 py-6">
          <AiImportCard
            auth={auth}
            hasContent={hasContent}
            onGenerated={(g: GeneratedArticle, sourceUrl: string) => {
              setForm(generatedToForm(g, sourceUrl));
              setEditId(null);
              setExisting(null);
              setSocial(null);
              setWorkflow("draft");
            }}
          />

          {/* Titlu */}
          <textarea
            value={form.titlu}
            onChange={(e) => set("titlu", e.target.value.replace(/\n/g, " "))}
            placeholder="Titlul articolului…"
            rows={1}
            className="block w-full resize-none bg-transparent px-1 pt-3 text-[27px] font-medium leading-tight tracking-tight text-foreground outline-none placeholder:text-muted-foreground/40 [field-sizing:content]"
          />

          {/* Slug */}
          <div className="flex items-center gap-1 px-1 font-mono text-xs text-muted-foreground">
            <span>/articol/</span>
            <input
              value={slugValue}
              onChange={(e) => set("id", slugify(e.target.value))}
              disabled={!!editId}
              placeholder={slugify(form.titlu) || "slug-generat-din-titlu"}
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground/40 disabled:opacity-60"
            />
          </div>

          {/* Teaser */}
          <BlockCard {...blockProps(PUBLICATION.teaserBlock.field as TextField, false)} />

          {/* Blocurile de conținut — reordonabile */}
          {form.blockOrder.map((field) => (
            <BlockCard key={field} {...blockProps(field as TextField, true)} />
          ))}

          {/* Dezbatere */}
          <BlockCard {...blockProps(PUBLICATION.debateBlock.field as TextField, false)} />

          <FaqCard
            qa={form.qa}
            onChange={(qa) => set("qa", qa)}
            onGenerate={generateFaq}
            busy={busyAction === "faq"}
          />

          <MediaCard auth={auth} form={form} set={set} />

          <DetailsCard form={form} set={set} publishInfo={publishInfo} />

          {story && <StoryCard story={story} currentArticleId={editId} />}
        </div>
      </div>

      {/* DREAPTA — Copilot / SEO / Preview */}
      <aside className="hidden w-[370px] shrink-0 border-l border-border lg:block">
        <Tabs defaultValue="copilot" className="flex h-full flex-col gap-0">
          <TabsList className="m-3 grid w-auto grid-cols-3">
            <TabsTrigger value="copilot" className="gap-1.5 text-xs">
              <Bot className="size-3.5" />
              Copilot
            </TabsTrigger>
            <TabsTrigger value="seo" className="gap-1.5 text-xs">
              <Gauge className="size-3.5" />
              SEO
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1.5 text-xs">
              <Eye className="size-3.5" />
              Preview
            </TabsTrigger>
          </TabsList>
          <TabsContent value="copilot" className="min-h-0 flex-1">
            <CopilotPanel
              focusedLabel={focusedBlock?.title ?? null}
              focusedField={focusedField}
              run={runCopilot}
              api={copilotApply}
              busyAction={busyAction}
            />
          </TabsContent>
          <TabsContent value="seo" className="min-h-0 flex-1">
            <SeoPanel form={form} set={set} db={db} editId={editId} />
          </TabsContent>
          <TabsContent value="preview" className="min-h-0 flex-1">
            <PreviewPanel form={form} />
          </TabsContent>
        </Tabs>
      </aside>
    </div>
  );
}
