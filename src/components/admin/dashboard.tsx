"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore/lite";
import {
  Newspaper,
  FileEdit,
  Inbox,
  CheckCircle2,
  Plus,
  ArrowUpRight,
} from "lucide-react";
import type { Article } from "@/lib/articles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useNewsroom } from "./newsroom-provider";
import EntityPulse from "./entity-pulse";

interface Stats {
  publicate: number;
  drafturi: number;
  inbox: number;
  recente: Article[];
}

const METRICS = [
  { key: "publicate", label: "Publicate", icon: CheckCircle2 },
  { key: "drafturi", label: "Drafturi", icon: FileEdit },
  { key: "inbox", label: "În inbox", icon: Inbox },
  { key: "total", label: "Total articole", icon: Newspaper },
] as const;

export default function Dashboard() {
  const { db, user } = useNewsroom();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [artSnap, inboxSnap] = await Promise.all([
        getDocs(collection(db, "articles")),
        getDocs(collection(db, "inbox")).catch(() => null),
      ]);
      if (cancelled) return;
      const articole = artSnap.docs.map(
        (d) => ({ ...d.data(), id: d.id }) as Article
      );
      articole.sort((a, b) =>
        (b.publicatLa ?? "").localeCompare(a.publicatLa ?? "")
      );
      const inboxNoi = inboxSnap
        ? inboxSnap.docs.filter((d) => d.data().status === "nou").length
        : 0;
      setStats({
        publicate: articole.filter((a) => a.status !== "draft").length,
        drafturi: articole.filter((a) => a.status === "draft").length,
        inbox: inboxNoi,
        recente: articole.slice(0, 6),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [db]);

  const value = (key: string): number => {
    if (!stats) return 0;
    if (key === "total") return stats.publicate + stats.drafturi;
    return (stats as unknown as Record<string, number>)[key] ?? 0;
  };

  const azi = new Date().toLocaleDateString("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {azi}
          </p>
          <h1 className="mt-1 text-2xl font-medium tracking-tight">
            Bună, {(user.email ?? "").split("@")[0]}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/inbox">
              <Inbox className="size-4" />
              AI Inbox
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/editor">
              <Plus className="size-4" />
              Articol nou
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {METRICS.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.key}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">
                  {m.label}
                </span>
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <div className="mt-3 font-mono text-2xl font-medium tabular-nums">
                {stats ? (
                  value(m.key)
                ) : (
                  <Skeleton className="h-7 w-10" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            Articole recente
          </h2>
          <Link
            href="/admin/articles"
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Vezi toate
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        <div className="overflow-hidden rounded-xl border border-border">
          {!stats &&
            [0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-border p-3 last:border-0"
              >
                <Skeleton className="h-4 w-full max-w-md" />
              </div>
            ))}
          {stats?.recente.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Niciun articol încă. Începe din AI Inbox sau scrie unul nou.
            </div>
          )}
          {stats?.recente.map((a) => (
            <Link
              key={a.id}
              href="/admin/editor"
              className="flex items-center gap-3 border-b border-border p-3 transition-colors last:border-0 hover:bg-accent/50"
            >
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  a.status === "draft" ? "bg-muted-foreground" : "bg-primary"
                )}
              />
              <span className="min-w-0 flex-1 truncate text-sm">{a.titlu}</span>
              <Badge
                variant="outline"
                className="shrink-0 font-mono text-[10px] text-muted-foreground"
              >
                {a.categorie}
              </Badge>
              {a.status === "draft" && (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  draft
                </Badge>
              )}
              <span className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:block">
                {(a.data ?? "").split(",")[0]}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <EntityPulse />
    </div>
  );
}
