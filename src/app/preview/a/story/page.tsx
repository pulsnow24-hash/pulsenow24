import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPreviewData, relatedTo, toPreviewList, CONFIDENCE_LABEL_RO } from "@/lib/preview/data";
import { getStories } from "@/lib/stories";
import { ThemeToggle, SearchTrigger, MobileNav } from "@/components/preview/controls";
import { TintSurface, sourceLabel } from "@/components/preview/bits";

export const dynamic = "force-dynamic";
const NAV = ["Actualitate", "Geopolitică", "Business", "AI & Tech", "Vâlcea"];

export default async function DirectionAStory() {
  const data = await getPreviewData();
  if (!data) return <div className="dir-a pv-root"><p style={{ padding: 60 }}>Fără date.</p></div>;
  const s = data.storyPage;
  const all = toPreviewList(await getStories({ limit: 60 }));
  const related = relatedTo(s, all, 4);

  return (
    <div className="dir-a pv-root" data-theme="light">
      <header className="a-head">
        <div className="pv-wrap a-head-in">
          <Link href="/preview/a" className="a-brand">Puls<b>Now</b>24</Link>
          <nav className="a-nav pv-hide-mobile">{NAV.map((n) => <a key={n} href="#">{n}</a>)}</nav>
          <div className="a-head-right">
            <div className="pv-hide-mobile"><SearchTrigger /></div>
            <div className="pv-only-mobile"><SearchTrigger compact /></div>
            <ThemeToggle initial="light" />
            <MobileNav items={NAV} />
          </div>
        </div>
      </header>

      <div className="pv-wrap">
        <article className="a-doc pv-in">
          <Link href="/preview/a" className="back"><ArrowLeft size={15} /> Înapoi</Link>
          <span className="a-kicker">{s.category}</span>
          <h1>{s.title}</h1>
          <p className="lead">{s.summary}</p>
          <div className="a-meta">
            <span><b>{sourceLabel(s.sourceCount)}</b> independente</span>
            <span>Actualizat {s.updatedLabel}</span>
            <span>{s.readingMins} min de citit</span>
          </div>

          <TintSurface story={s} className="hero-panel">
            <span>{s.category} · dosar în dezvoltare</span>
          </TintSurface>

          {/* AI summary */}
          <div className="a-block">
            <span className="lbl">Pe scurt (rezumat)</span>
            <div className="a-summary"><p>{s.summary}</p></div>
          </div>

          {/* Source transparency + confidence */}
          <div className="a-block">
            <span className="lbl">Transparența surselor</span>
            <div className="a-sources">
              <div className="col">
                <h5>{sourceLabel(s.sourceCount)} independente</h5>
                <div className="a-src-list">
                  {s.sources.map((src) => <div key={src} className="s">{src}</div>)}
                </div>
              </div>
              <div className="col a-conf-box">
                <h5>Nivel de încredere</h5>
                <div className="big">{s.confidence}<span style={{ fontSize: 16, color: "var(--fg-mute)" }}>/100</span></div>
                <div className="exp">
                  {CONFIDENCE_LABEL_RO[s.confidenceLabel]}. Calculat din încrederea agregată a
                  surselor, gradul de coroborare ({sourceLabel(s.sourceCount)}) și prospețimea informației.
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          {s.timeline.length > 0 && (
            <div className="a-block">
              <span className="lbl">Cum a evoluat</span>
              <div className="a-timeline" style={{ marginTop: 8 }}>
                {s.timeline.slice().reverse().map((e, i) => (
                  <div key={i} className="a-tl-item">
                    <div className="t">{new Date(e.at).toLocaleString("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                    <h4>{e.title}</h4>
                    {e.source && <div className="s">{e.source}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related entities */}
          {s.entities.length > 0 && (
            <div className="a-block">
              <span className="lbl">Entități din acest subiect</span>
              <div className="a-related-ent">
                {s.entities.map((e) => <a key={e} href="#">{e}</a>)}
              </div>
            </div>
          )}

          {/* Related stories */}
          {related.length > 0 && (
            <div className="a-block">
              <span className="lbl">Context anterior</span>
              <div className="a-rel-stories">
                {related.map((r) => (
                  <Link key={r.id} href="/preview/a/story">
                    <span className="cat">{r.category}</span>
                    <h4>{r.title}</h4>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>

      <footer className="a-foot">
        <div className="pv-wrap"><div className="base"><span>© {new Date().getFullYear()} PulsNow24</span><span>Editorial Premium · preview</span></div></div>
      </footer>
    </div>
  );
}
