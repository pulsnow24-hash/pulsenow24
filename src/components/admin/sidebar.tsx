"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NAV_ITEMS, activeNavItem } from "./nav";
import { useNewsroom } from "./newsroom-provider";

function initials(email: string): string {
  const name = email.split("@")[0] ?? "";
  return name.slice(0, 2).toUpperCase() || "PN";
}

export default function Sidebar() {
  const pathname = usePathname();
  const active = activeNavItem(pathname);
  const { auth, user } = useNewsroom();

  return (
    <aside className="flex w-14 shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-3">
      <Link
        href="/admin"
        aria-label="PulsNow24 Newsroom"
        className="flex size-9 items-center justify-center rounded-lg text-primary transition-colors hover:bg-sidebar-accent"
      >
        <Activity className="size-[18px]" />
      </Link>

      <div className="mt-4 h-px w-6 bg-sidebar-border" />

      <nav className="mt-3 flex flex-1 flex-col items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = active?.href === item.href;
          const Icon = item.icon;
          return (
            <Tooltip key={item.href} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  aria-label={item.title}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                    isActive && "bg-sidebar-accent text-primary"
                  )}
                >
                  {isActive && (
                    <span className="absolute -left-3 h-4 w-0.5 rounded-full bg-primary" />
                  )}
                  <Icon className="size-[18px]" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{item.title}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="mt-2 flex items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Cont"
          >
            <Avatar className="size-8 border border-border">
              <AvatarFallback className="bg-secondary text-[11px] font-medium text-muted-foreground">
                {initials(user.email ?? "")}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="end" className="w-56">
          <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
            {user.email}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut(auth)}>
            <LogOut className="size-4" />
            Deconectare
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </aside>
  );
}
