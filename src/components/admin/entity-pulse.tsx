"use client";

import { useEffect, useState } from "react";
import { Network, TrendingUp, User, Building2, Flame } from "lucide-react";
import { useNewsroom } from "./newsroom-provider";
import { loadEntities } from "@/lib/entity-store";
import {
  ENTITY_TYPE_LABELS,
  type Entity,
} from "@/lib/engine/entity";
import { cn } from "@/lib/utils";

function EntityList({
  title,
  icon: Icon,
  entities,
  metric,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  entities: Entity[];
  metric: (e: Entity) => string;
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3" />
        {title}
      </p>
      {entities.length === 0 ? (
        <p className="text-[11.5px] text-muted-foreground/60">— încă nimic</p>
      ) : (
        <div className="space-y-1">
          {entities.map((e) => (
            <div key={e.id} className="flex items-center gap-2 text-[12.5px]">
              <span className="min-w-0 flex-1 truncate">{e.name}</span>
              <span className="shrink-0 rounded bg-secondary px-1 font-mono text-[9px] uppercase text-muted-foreground">
                {ENTITY_TYPE_LABELS[e.type] ?? e.type}
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                {metric(e)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Cardul compact „Entity Pulse" de pe dashboard. */
export default function EntityPulse() {
  const { db } = useNewsroom();
  const [entities, setEntities] = useState<Entity[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadEntities(db)
      .then((list) => {
        if (!cancelled) setEntities(list);
      })
      .catch(() => {
        if (!cancelled) setEntities([]);
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const list = entities ?? [];
  const byMentions = [...list].sort((a, b) => b.mentionCount - a.mentionCount);
  const top = byMentions.slice(0, 5);
  const trending = [...list]
    .filter((e) => e.trendScore > 0)
    .sort((a, b) => b.trendScore - a.trendScore || b.mentionCount - a.mentionCount)
    .slice(0, 5);
  const people = byMentions.filter((e) => e.type === "person").slice(0, 5);
  const orgs = byMentions
    .filter((e) => ["organization", "institution", "company", "party"].includes(e.type))
    .slice(0, 5);

  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Network className="size-4" />
          Entity Pulse
        </h2>
        <span className="font-mono text-[11px] text-muted-foreground">
          {list.length} entități urmărite
        </span>
      </div>
      <div
        className={cn(
          "grid gap-5 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4",
          entities === null && "animate-pulse"
        )}
      >
        <EntityList title="Top entități" icon={Flame} entities={top} metric={(e) => `${e.mentionCount}×`} />
        <EntityList title="În creștere" icon={TrendingUp} entities={trending} metric={(e) => `${e.trendScore}`} />
        <EntityList title="Persoane" icon={User} entities={people} metric={(e) => `${e.mentionCount}×`} />
        <EntityList title="Organizații" icon={Building2} entities={orgs} metric={(e) => `${e.mentionCount}×`} />
      </div>
    </div>
  );
}
