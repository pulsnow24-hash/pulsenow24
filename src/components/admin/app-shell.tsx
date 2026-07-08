"use client";

import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Sidebar from "./sidebar";
import Topbar from "./topbar";
import CommandPalette from "./command-palette";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [commandOpen, setCommandOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen overflow-hidden bg-background font-sans text-foreground antialiased">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onOpenCommand={() => setCommandOpen(true)} />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
        <Toaster position="bottom-right" />
      </div>
    </TooltipProvider>
  );
}
