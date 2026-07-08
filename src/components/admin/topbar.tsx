"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { activeNavItem } from "./nav";

export default function Topbar({
  onOpenCommand,
}: {
  onOpenCommand: () => void;
}) {
  const pathname = usePathname();
  const active = activeNavItem(pathname);

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-4">
      <div className="flex min-w-0 items-center gap-2 font-mono text-xs text-muted-foreground">
        <span>Newsroom</span>
        <span className="text-border">/</span>
        <span className="truncate text-foreground">
          {active?.title ?? "Dashboard"}
        </span>
      </div>

      <button
        onClick={onOpenCommand}
        className="mx-auto flex h-8 w-full max-w-xs items-center gap-2 rounded-lg border border-border bg-card px-3 text-muted-foreground transition-colors hover:border-input"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left text-[13px]">
          Caută sau execută o comandă
        </span>
        <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px]">
          ⌘K
        </kbd>
      </button>

      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden items-center gap-1.5 font-mono text-[11px] text-muted-foreground sm:flex">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          LIVE
        </span>
        <Button asChild size="sm">
          <Link href="/admin/editor">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Articol nou</span>
          </Link>
        </Button>
      </div>
    </header>
  );
}
