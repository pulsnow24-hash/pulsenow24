import {
  CONFIDENCE_LABEL_RO,
  type ConfidenceLabel,
  type PreviewStory,
} from "@/lib/preview/data";

/** Clasa de categorie pentru suprafața tintată (mapare sigură pentru CSS). */
export function catClass(category: string): string {
  const map: Record<string, string> = {
    "AI & Tech": "cat-AITech",
    Geopolitică: "cat-Geopolitică",
    Politică: "cat-Politică",
    Business: "cat-Business",
    Actualitate: "cat-Actualitate",
    Monden: "cat-Monden",
    Viral: "cat-Viral",
  };
  return map[category] ?? "cat-Actualitate";
}

/** Suprafață pentru story-uri fără imagine: tentă de categorie controlată,
 *  cu inițiala/eticheta — niciodată o fotografie inventată. */
export function TintSurface({
  story,
  className = "",
  children,
}: {
  story: PreviewStory;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`pv-tint ${catClass(story.category)} ${className}`}>{children}</div>
  );
}

export function ConfidenceMeter({
  story,
  width = 44,
  showLabel = false,
}: {
  story: PreviewStory;
  width?: number;
  showLabel?: boolean;
}) {
  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      title={`${CONFIDENCE_LABEL_RO[story.confidenceLabel]} (${story.confidence}/100) — din încrederea surselor, coroborare și prospețime`}
    >
      <span className={`pv-conf conf-${story.confidenceLabel}`} style={{ width }}>
        <i style={{ width: `${story.confidence}%` }} />
      </span>
      <span className="pv-mono" style={{ fontSize: 11, opacity: 0.85 }}>
        {story.confidence}
      </span>
      {showLabel && (
        <span style={{ fontSize: 11, color: "var(--fg-mute)" }}>
          {CONFIDENCE_LABEL_RO[story.confidenceLabel]}
        </span>
      )}
    </span>
  );
}

const LABEL_SHORT: Record<ConfidenceLabel, string> = {
  high: "ridicată",
  medium: "medie",
  low: "în verificare",
};

export function confidenceShort(label: ConfidenceLabel): string {
  return LABEL_SHORT[label];
}

export function sourceLabel(n: number): string {
  return `${n} ${n === 1 ? "sursă" : "surse"}`;
}
