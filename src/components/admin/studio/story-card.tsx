"use client";

import { Layers, FileText, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  corroboration,
  storyConfidence,
  storyStatusMeta,
  type Story,
} from "@/lib/engine/story";
import { relativeTime } from "@/components/admin/inbox/helpers";
import { SectionCard } from "./cards";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="font-mono text-base font-medium tabular-nums">{value}</p>
    </div>
  );
}

/**
 * Contextul de Story al articolului curent — afișat în Studio.
 * Doar citire: articolul e output-ul, story-ul e activul.
 */
export default function StoryCard({
  story,
  currentArticleId,
}: {
  story: Story;
  currentArticleId: string | null;
}) {
  const meta = storyStatusMeta(story.status);
  const timeline = [...story.timeline]
    .filter((e) => e.type !== "created")
    .slice(-6)
    .reverse();

  return (
    <SectionCard icon={Layers} title="Story (evenimentul)" id="block-story">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium",
            meta.className
          )}
        >
          {meta.label}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
          {story.title}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {relativeTime(story.lastUpdated)}
        </span>
      </div>

      {story.summary && (
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          {story.summary}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-secondary/30 p-3 sm:grid-cols-4">
        <Stat label="Surse" value={corroboration(story)} />
        <Stat label="Semnale" value={story.signalCount} />
        <Stat label="Încredere" value={`${storyConfidence(story)}%`} />
        <Stat label="Importanță" value={story.importanceScore} />
      </div>

      {timeline.length > 0 && (
        <div>
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            Cronologie
          </p>
          <div className="space-y-1.5">
            {timeline.map((e, i) => (
              <div key={i} className="flex items-start gap-2 text-[12px]">
                {e.type === "article" ? (
                  <FileText className="mt-0.5 size-3 shrink-0 text-primary" />
                ) : (
                  <Radio className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1 truncate text-foreground/85">
                  {e.title}
                </span>
                {e.source && (
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {e.source}
                  </span>
                )}
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {relativeTime(e.at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {story.articleIds.length > 0 && (
        <p className="font-mono text-[11px] text-muted-foreground">
          {story.articleIds.length}{" "}
          {story.articleIds.length === 1 ? "articol" : "articole"} în acest story
          {currentArticleId && story.articleIds.includes(currentArticleId)
            ? " (inclusiv cel curent)"
            : ""}
        </p>
      )}
    </SectionCard>
  );
}
