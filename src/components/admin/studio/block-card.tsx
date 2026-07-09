"use client";

import { useRef } from "react";
import {
  ChevronDown,
  GripVertical,
  Loader2,
  Sparkles,
  Wand2,
  Minimize2,
  Maximize2,
  Briefcase,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { EditorialBlock } from "@/lib/engine/publication";

/** Acțiunile AI disponibile pe un bloc (rulate prin Copilot). */
export const BLOCK_AI_ACTIONS = [
  { id: "rewrite", label: "Rescrie", icon: Wand2 },
  { id: "shorten", label: "Scurtează", icon: Minimize2 },
  { id: "expand", label: "Extinde", icon: Maximize2 },
  { id: "tone-professional", label: "Ton profesional", icon: Briefcase },
  { id: "tone-neutral", label: "Ton neutru", icon: Scale },
] as const;

export default function BlockCard({
  block,
  value,
  onChange,
  onFocus,
  collapsed,
  onToggleCollapse,
  onAiAction,
  aiBusy,
  draggable,
  dragging,
  dropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  block: EditorialBlock;
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onAiAction: (actionId: string) => void;
  aiBusy: boolean;
  draggable?: boolean;
  dragging?: boolean;
  dropTarget?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
}) {
  const Icon = block.icon;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const filled = !!value.trim();

  return (
    <section
      id={`block-${block.field}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "group/block rounded-xl border border-border bg-card transition-all",
        dragging && "opacity-40",
        dropTarget && "border-primary/60 ring-1 ring-primary/40",
        !dragging && "focus-within:border-input"
      )}
    >
      <header className="flex items-center gap-2 px-4 py-2.5">
        {draggable ? (
          <button
            aria-label={`Mută blocul ${block.title}`}
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            className="-ml-1 cursor-grab rounded p-0.5 text-muted-foreground/40 opacity-0 transition-opacity hover:text-muted-foreground group-hover/block:opacity-100 active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
        ) : (
          <span className="-ml-1 w-5" />
        )}
        <Icon className={cn("size-4", block.accent)} />
        <button
          onClick={onToggleCollapse}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <h3 className="truncate text-[13px] font-medium">{block.title}</h3>
          {!filled && (
            <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
              gol
            </span>
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-muted-foreground opacity-0 transition-opacity group-hover/block:opacity-100 data-[state=open]:opacity-100"
              aria-label={`Acțiuni AI pentru ${block.title}`}
              disabled={aiBusy}
            >
              {aiBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              AI · {block.title}
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onAiAction("regenerate-block")}>
              <Sparkles className="size-4" />
              Regenerează blocul
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {BLOCK_AI_ACTIONS.map((a) => (
              <DropdownMenuItem
                key={a.id}
                disabled={!filled}
                onClick={() => onAiAction(a.id)}
              >
                <a.icon className="size-4" />
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Extinde" : "Restrânge"}
              className="rounded p-1 text-muted-foreground/60 transition-transform hover:text-foreground"
            >
              <ChevronDown
                className={cn(
                  "size-4 transition-transform duration-200",
                  collapsed && "-rotate-90"
                )}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent>{collapsed ? "Extinde" : "Restrânge"}</TooltipContent>
        </Tooltip>
      </header>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200",
          collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
        )}
      >
        <div className="overflow-hidden">
          <textarea
            ref={textareaRef}
            value={value}
            rows={block.rows ?? 3}
            placeholder={block.placeholder}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onFocus}
            className="block w-full resize-none bg-transparent px-4 pb-4 pt-0.5 text-[14.5px] leading-relaxed text-foreground/95 outline-none placeholder:text-muted-foreground/50 [field-sizing:content]"
          />
        </div>
      </div>
    </section>
  );
}
