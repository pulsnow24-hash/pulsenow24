"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PenSquare, Inbox } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { NAV_ITEMS } from "./nav";

export default function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Comenzi"
      description="Navighează sau execută o acțiune"
    >
      <CommandInput placeholder="Caută o secțiune sau o comandă…" />
      <CommandList>
        <CommandEmpty>Niciun rezultat.</CommandEmpty>
        <CommandGroup heading="Acțiuni">
          <CommandItem onSelect={() => go("/admin/editor")}>
            <PenSquare className="size-4" />
            Articol nou
          </CommandItem>
          <CommandItem onSelect={() => go("/admin/inbox")}>
            <Inbox className="size-4" />
            Deschide AI Inbox
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navigare">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.href}
                onSelect={() => go(item.href)}
                value={item.title}
              >
                <Icon className="size-4" />
                {item.title}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
