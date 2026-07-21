import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPreviewData, relatedTo, toPreviewList, CONFIDENCE_LABEL_RO } from "@/lib/preview/data";
import { getStories } from "@/lib/stories";
import { ThemeToggle, SearchTrigger, MobileNav } from "@/components/preview/controls";
import { TintSurface, ConfidenceMeter, sourceLabel } from "@/components/preview/bits";

export const dynamic = "force-dynamic";
const NAV = ["Live", "Actualitate", "Geopolitică", "Business", "Vâlcea"];

export default async function DirectionBStory() {
  const data = await getPreviewData();
  if (!data) return <div className="dir-b pv-root"><p style={{ padding: 60 }}>Fără date.</p></div>;
  const s = data.storyPage;
  const related = relatedTo(s, toPreviewList(await getStories({ limit: 60 })), 4);

  return (
    <div className="dir-b pv-root" data-theme="dark">
      <header className="b-head">
        <div className="pv-wrap b-head-in">
          <Link href="/preview/b" className="b-brand"><span className="sq">P</span> PulsNow24</Link>
          <nav className="b-nav pv-hide-mobile">{NAV.map((n) => <a key={n} href="#">{n}</a>)}</nav>
          <div className="b-head-right">
            <span className="b-livepill pv-hide-mobile"><span className="pv-live-dot" /> LIVE</span>
            <div className="pv-hide-mobile"><SearchTrigger /></div>
            <ThemeToggle initial="dark" />
            <MobileNav items={NAV} />
          </div>
        </div>
      </header>

      <div className="pv-wrap">
        <div className="b-doc pv-in">
          <div className="b-doc-main">
            <Link href="/preview/b" className="b-mono-meta" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><ArrowLeft size={14} /> ÎNAPOI LA FLUX</Link>
            <div style={{ marginTop: 18 }}><span className="b-tag"><span className="pv-live-dot" /> {s.category}</span></div>
            <h1>{s.title}</h1>
            <p className="lead">{s.summary}</p>

            <TintSurface story={s} className="hero-panel"><span>{s.category} · dosar de inteligență</span></TintSurface>

            <div className="b-doc-block">
              <span className="lbl">Rezumat</span>
              <p>{s.summary}</p>
            </div>

            <div className="b-doc-block">
              <span className="lbl">De ce contează</span>
              <p>
                Subiect din categoria {s.category}, susținut de {sourceLabel(s.sourceCount)} independente,
                cu un nivel de încredere de {s.confidence}/100. {s.isLocal ? "Relevanță locală pentru județul Vâlcea. " : ""}
                Urmărește cronologia de mai jos pentru a vedea cum a evoluat evenimentul.
              </p>
            </div>

            {s.timeline.length > 0 && (
              <div className="b-tl" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".06em", color: "var(--fg-mute)" }}>Cronologie</h3>
                {s.timeline.slice().reverse().map((e, i) => (
                  <div key={i} className="b-tl-row">
                    <div className="ts">{new Date(e.at).toLocaleString("ro-RO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
                    <div className="tc"><h5>{e.title}</h5>{e.source && <span>{e.source}</span>}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sticky aside — intelligence panels */}
          <aside className="b-aside">
            <div className="b-panel">
              <h4>Nivel de încredere</h4>
              <div className="confbig">{s.confidence}<span style={{ fontSize: 16, color: "var(--fg-mute)" }}>/100</span></div>
              <div style={{ margin: "12px 0" }}><ConfidenceMeter story={s} width={230} showLabel /></div>
              <div className="confexp">Din încrederea agregată a surselor, coroborare ({sourceLabel(s.sourceCount)}) și prospețime. {CONFIDENCE_LABEL_RO[s.confidenceLabel]}.</div>
            </div>
            <div className="b-panel">
              <h4>Surse ({s.sourceCount})</h4>
              {s.sources.map((src) => <div key={src} className="b-srcrow">{src}</div>)}
            </div>
            {s.entities.length > 0 && (
              <div className="b-panel">
                <h4>Entități</h4>
                <div className="b-chips">{s.entities.map((e) => <a key={e} href="#">{e}</a>)}</div>
              </div>
            )}
            {related.length > 0 && (
              <div className="b-panel">
                <h4>Context anterior</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {related.map((r) => (
                    <Link key={r.id} href="/preview/b/story" style={{ fontSize: 13.5, lineHeight: 1.4 }}>
                      <span className="b-mono-meta" style={{ color: "var(--accent)" }}>{r.category}</span><br />{r.title}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      <footer className="b-foot">
        <div className="pv-wrap"><div className="base"><span>© {new Date().getFullYear()} PulsNow24</span><span>AI News Terminal · preview</span></div></div>
      </footer>
    </div>
  );
}
