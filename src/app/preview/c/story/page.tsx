import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPreviewData, relatedTo, toPreviewList, CONFIDENCE_LABEL_RO } from "@/lib/preview/data";
import { getStories } from "@/lib/stories";
import { ThemeToggle, SearchTrigger, MobileNav } from "@/components/preview/controls";
import { TintSurface, sourceLabel } from "@/components/preview/bits";

export const dynamic = "force-dynamic";
const NAV = ["Actualitate", "Geopolitică", "Business", "AI & Tech", "Vâlcea"];

export default async function DirectionCStory() {
  const data = await getPreviewData();
  if (!data) return <div className="dir-c pv-root"><p style={{ padding: 60 }}>Fără date.</p></div>;
  const s = data.storyPage;
  const related = relatedTo(s, toPreviewList(await getStories({ limit: 60 })), 4);

  return (
    <div className="dir-c pv-root" data-theme="dark">
      <header className="c-head" style={{ position: "sticky", background: "color-mix(in srgb, var(--bg) 85%, transparent)", backdropFilter: "blur(12px)", borderBottom: "var(--border)" }}>
        <div className="c-wrap c-head-in">
          <Link href="/preview/c" className="c-brand" style={{ textShadow: "none" }}>Puls<b>Now</b>24</Link>
          <nav className="c-nav pv-hide-mobile">{NAV.map((n) => <a key={n} href="#" style={{ color: "var(--fg-soft)", textShadow: "none" }}>{n}</a>)}</nav>
          <div className="c-head-right">
            <div className="pv-hide-mobile"><SearchTrigger /></div>
            <ThemeToggle initial="dark" />
            <MobileNav items={NAV} />
          </div>
        </div>
      </header>

      <div className="c-wrap">
        <article className="c-doc pv-in" style={{ paddingTop: 40 }}>
          <Link href="/preview/c" className="back"><ArrowLeft size={15} /> Înapoi</Link>

          <div className="c-doc-hero pv-reveal">
            <TintSurface story={s} className="surf" />
            <div className="content">
              <span className="cat">{s.category}</span>
              <h1>{s.title}</h1>
              <div className="m">
                <span>{sourceLabel(s.sourceCount)} independente</span>
                <span>· Încredere {s.confidence}/100</span>
                <span>· Actualizat {s.updatedLabel}</span>
                <span>· {s.readingMins} min</span>
              </div>
            </div>
          </div>

          <p className="lead">{s.summary}</p>

          <div className="c-block summary">
            <span className="lbl">Pe scurt (rezumat)</span>
            <p style={{ fontSize: 17, color: "var(--fg-soft)" }}>{s.summary}</p>
          </div>

          <div className="c-block">
            <span className="lbl">Transparență & încredere</span>
            <div className="c-doc-cards">
              <div className="c-doc-card">
                <h4>Nivel de încredere</h4>
                <div className="big">{s.confidence}<span style={{ fontSize: 16, color: "var(--fg-mute)" }}>/100</span></div>
                <p className="exp" style={{ marginTop: 10 }}>{CONFIDENCE_LABEL_RO[s.confidenceLabel]}. Din încrederea surselor, coroborare și prospețime.</p>
              </div>
              <div className="c-doc-card">
                <h4>{sourceLabel(s.sourceCount)} independente</h4>
                {s.sources.map((src) => <div key={src} className="s">{src}</div>)}
              </div>
            </div>
          </div>

          {s.timeline.length > 0 && (
            <div className="c-block">
              <span className="lbl">Cum a evoluat</span>
              <div className="c-tl-wrap" style={{ padding: 26 }}>
                {s.timeline.slice().reverse().map((e, i, arr) => (
                  <div key={i} className="c-tl-item">
                    <div className="c-tl-dot"><i />{i < arr.length - 1 && <span className="l" />}</div>
                    <div>
                      <div className="tt">{new Date(e.at).toLocaleString("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                      <h5>{e.title}</h5>
                      {e.source && <div className="tt" style={{ marginTop: 4 }}>{e.source}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {s.entities.length > 0 && (
            <div className="c-block">
              <span className="lbl">Entități din poveste</span>
              <div className="c-ent">{s.entities.map((e) => <a key={e} href="#">{e}</a>)}</div>
            </div>
          )}

          {related.length > 0 && (
            <div className="c-block">
              <span className="lbl">Context anterior</span>
              <div className="c-doc-cards">
                {related.map((r) => (
                  <Link key={r.id} href="/preview/c/story" className="c-doc-card pv-card-hover">
                    <span className="cat" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--accent)" }}>{r.category}</span>
                    <h4 style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--fg)", textTransform: "none", letterSpacing: 0, marginTop: 8, lineHeight: 1.3 }}>{r.title}</h4>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>

      <footer className="c-foot">
        <div className="c-wrap"><div className="base"><span>© {new Date().getFullYear()} PulsNow24</span><span>Cinematic News · preview</span></div></div>
      </footer>
    </div>
  );
}
