"use client";

import { LayoutGrid, List, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface InboxFilters {
  search: string;
  category: string;
  country: string;
  source: string;
  minImportance: number;
  breakingOnly: boolean;
  verifiedOnly: boolean;
  date: "today" | "7d" | "all";
}

export const DEFAULT_FILTERS: InboxFilters = {
  search: "",
  category: "",
  country: "",
  source: "",
  minImportance: 0,
  breakingOnly: false,
  verifiedOnly: false,
  date: "all",
};

const SENTINEL = "all";

export default function InboxToolbar({
  filters,
  onChange,
  categories,
  countries,
  sources,
  view,
  onViewChange,
  onRefresh,
  refreshing,
  searchRef,
}: {
  filters: InboxFilters;
  onChange: (patch: Partial<InboxFilters>) => void;
  categories: string[];
  countries: string[];
  sources: string[];
  view: "cards" | "table";
  onViewChange: (v: "cards" | "table") => void;
  onRefresh: () => void;
  refreshing: boolean;
  searchRef: React.RefObject<HTMLInputElement | null>;
}) {
  const dirty =
    filters.search ||
    filters.category ||
    filters.country ||
    filters.source ||
    filters.minImportance > 0 ||
    filters.breakingOnly ||
    filters.verifiedOnly ||
    filters.date !== "all";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="Caută în titluri și descrieri…  (/)"
            className="h-9 pl-9"
          />
        </div>

        <div className="flex items-center rounded-lg border border-border p-0.5">
          <button
            onClick={() => onViewChange("cards")}
            aria-label="Vizualizare carduri"
            className={cn(
              "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors",
              view === "cards" && "bg-accent text-foreground"
            )}
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            onClick={() => onViewChange("table")}
            aria-label="Vizualizare tabel"
            className={cn(
              "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors",
              view === "table" && "bg-accent text-foreground"
            )}
          >
            <List className="size-4" />
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          <span className="hidden sm:inline">Caută știri</span>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          value={filters.category}
          onChange={(v) => onChange({ category: v })}
          placeholder="Categorie"
          allLabel="Toate categoriile"
          options={categories}
        />
        <FilterSelect
          value={filters.country}
          onChange={(v) => onChange({ country: v })}
          placeholder="Țară"
          allLabel="Toate țările"
          options={countries}
        />
        <FilterSelect
          value={filters.source}
          onChange={(v) => onChange({ source: v })}
          placeholder="Sursă"
          allLabel="Toate sursele"
          options={sources}
        />

        <Select
          value={String(filters.minImportance)}
          onValueChange={(v) => onChange({ minImportance: Number(v) })}
        >
          <SelectTrigger size="sm" className="w-[130px]">
            <SelectValue placeholder="Importanță" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Orice scor</SelectItem>
            <SelectItem value="40">40+</SelectItem>
            <SelectItem value="70">70+</SelectItem>
            <SelectItem value="90">90+</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.date}
          onValueChange={(v) =>
            onChange({ date: v as InboxFilters["date"] })
          }
        >
          <SelectTrigger size="sm" className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Oricând</SelectItem>
            <SelectItem value="today">Azi</SelectItem>
            <SelectItem value="7d">7 zile</SelectItem>
          </SelectContent>
        </Select>

        <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
          <Switch
            checked={filters.breakingOnly}
            onCheckedChange={(v) => onChange({ breakingOnly: v })}
          />
          <Label className="cursor-pointer text-xs text-muted-foreground">
            Breaking
          </Label>
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
          <Switch
            checked={filters.verifiedOnly}
            onCheckedChange={(v) => onChange({ verifiedOnly: v })}
          />
          <Label className="cursor-pointer text-xs text-muted-foreground">
            Verificate
          </Label>
        </label>

        {dirty && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => onChange(DEFAULT_FILTERS)}
          >
            <X className="size-4" />
            Resetează
          </Button>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  allLabel,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  allLabel: string;
  options: string[];
}) {
  return (
    <Select
      value={value || SENTINEL}
      onValueChange={(v) => onChange(v === SENTINEL ? "" : v)}
    >
      <SelectTrigger size="sm" className="w-[150px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SENTINEL}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
