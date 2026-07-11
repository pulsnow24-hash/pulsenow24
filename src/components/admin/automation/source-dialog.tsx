"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { Auth } from "firebase/auth";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { callApi } from "@/app/admin/api";
import { PUBLICATION } from "@/lib/engine/publication";
import { newSource, type RssSource } from "@/lib/engine/sources";
import {
  SOURCE_KINDS,
  SOURCE_KIND_LABELS,
  WORKSPACES,
  sourceSyncMode,
  type SourceKind,
  type Workspace,
} from "@/lib/engine/workspace";
import { countryFlag, countryName } from "@/components/admin/inbox/helpers";

interface ValidationResult {
  valid: boolean;
  error?: string;
  responseTime?: number;
  language?: string;
  feedTitle?: string;
  sample?: string[];
}

const COUNTRIES = ["RO", "US", "GB", "FR", "DE", "IT", "ES", "UA", "RU", "MD", "EU", "XX"];

export default function SourceDialog({
  auth,
  open,
  onOpenChange,
  editing,
  onSave,
}: {
  auth: Auth;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: RssSource | null;
  onSave: (id: string, data: Omit<RssSource, "id">) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState(PUBLICATION.categories[0]);
  const [countryCode, setCountryCode] = useState("RO");
  const [priority, setPriority] = useState("3");
  const [refreshInterval, setRefreshInterval] = useState("0");
  const [trusted, setTrusted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [kind, setKind] = useState<SourceKind>("rss");
  const [workspace, setWorkspace] = useState<Workspace>("national");
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Sincronizează formularul cu sursa editată la deschiderea dialogului
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResult(null);
    setValidating(false);
    if (editing) {
      setName(editing.name);
      setUrl(editing.url);
      setCategory(editing.category);
      setCountryCode(editing.countryCode);
      setPriority(String(editing.priority));
      setRefreshInterval(String(editing.refreshInterval));
      setTrusted(editing.trusted);
      setBlocked(editing.blocked);
      setKind(editing.kind ?? "rss");
      setWorkspace(editing.workspace ?? "national");
    } else {
      setName("");
      setUrl("");
      setCategory(PUBLICATION.categories[0]);
      setCountryCode("RO");
      setPriority("3");
      setRefreshInterval("0");
      setTrusted(false);
      setBlocked(false);
      setKind("rss");
      setWorkspace("national");
    }
  }, [open, editing]);

  async function validate() {
    if (!url.trim()) return;
    setValidating(true);
    setResult(null);
    try {
      const r = await callApi<ValidationResult>(auth, "/api/sources/validate", {
        url: url.trim(),
      });
      setResult(r);
      if (r.valid) {
        if (!name.trim() && r.feedTitle) setName(r.feedTitle);
        if (r.language && r.language !== "other") {
          setCountryCode((c) => (c === "RO" && r.language === "en" ? "US" : c));
        }
      }
    } catch (e) {
      setResult({ valid: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setValidating(false);
    }
  }

  async function save() {
    if (!name.trim() || !url.trim()) {
      toast.error("Completează numele și URL-ul.");
      return;
    }
    setSaving(true);
    try {
      const slug =
        name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 40) || `sursa-${Date.now()}`;
      const id = editing?.id ?? slug;

      const base = editing ?? newSource({ name, url });
      const data: Omit<RssSource, "id"> = {
        ...base,
        name: name.trim(),
        url: url.trim(),
        category,
        countryCode,
        priority: Number(priority),
        refreshInterval: Number(refreshInterval),
        trusted,
        blocked,
        kind,
        workspace,
      };
      // Nu trimitem language=undefined către Firestore
      const lang = result?.language ?? base.language;
      if (lang) data.language = lang;
      else delete (data as Partial<RssSource>).language;
      await onSave(id, data);
      onOpenChange(false);
      toast.success(editing ? "Sursă actualizată." : "Sursă adăugată.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editează sursa" : "Adaugă sursă RSS"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">URL flux RSS</Label>
            <div className="flex gap-2">
              <Input
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setResult(null);
                }}
                placeholder="https://sursa.ro/feed"
                className="font-mono text-xs"
              />
              <Button variant="outline" onClick={validate} disabled={validating || !url.trim()}>
                {validating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Validează
              </Button>
            </div>
          </div>

          {result && (
            <div
              className={cn(
                "rounded-lg border p-3 text-sm",
                result.valid
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-red-500/30 bg-red-500/5"
              )}
            >
              <div className="flex items-center gap-2">
                {result.valid ? (
                  <CheckCircle2 className="size-4 text-emerald-500" />
                ) : (
                  <XCircle className="size-4 text-red-500" />
                )}
                <span className="font-medium">
                  {result.valid ? "Feed valid" : "Feed invalid"}
                </span>
                {result.responseTime !== undefined && (
                  <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                    {result.responseTime}ms · {result.language}
                  </span>
                )}
              </div>
              {result.error && (
                <p className="mt-1 text-[12px] text-red-400">{result.error}</p>
              )}
              {result.sample && (
                <ul className="mt-2 space-y-0.5">
                  {result.sample.slice(0, 3).map((t, i) => (
                    <li key={i} className="truncate text-[12px] text-muted-foreground">
                      · {t}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nume sursă</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tip sursă</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as SourceKind)}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {SOURCE_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Workspace</Label>
              <Select
                value={workspace}
                onValueChange={(v) => setWorkspace(v as Workspace)}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKSPACES.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.emoji} {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {sourceSyncMode(kind) === "connector" && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[12px] text-amber-500">
              <strong>Conector necesar</strong> — acest tip de sursă nu se poate
              sincroniza automat prin RSS. Sursa va fi stocată și monitorizată
              manual până la conectarea unui conector dedicat (ex: API-ul
              oficial Facebook). Nu simulăm date.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Categorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PUBLICATION.categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Țară</Label>
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {countryFlag(c)} {countryName(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Prioritate</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 4, 3, 2, 1].map((p) => (
                    <SelectItem key={p} value={String(p)}>
                      P{p} {p === 5 ? "(maximă)" : p === 1 ? "(minoră)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Interval refresh (min)
              </Label>
              <Input
                type="number"
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(e.target.value)}
                placeholder="0 = global"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <Switch checked={trusted} onCheckedChange={setTrusted} />
              <span className="text-xs text-muted-foreground">Sursă de încredere</span>
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={blocked} onCheckedChange={setBlocked} />
              <span className="text-xs text-muted-foreground">Blocată</span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Anulează
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {editing ? "Salvează" : "Adaugă sursa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
