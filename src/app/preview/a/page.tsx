import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getPreviewData } from "@/lib/preview/data";
import { ThemeToggle, SearchTrigger, MobileNav } from "@/components/preview/controls";
import { TintSurface, sourceLabel, confidenceShort } from "@/components/preview/bits";

export const dynamic = "force-dynamic";

const NAV = ["Actualitate", "Geopolitică", "Business", "AI & Tech", "Vâlcea"];
const today = () =>
  new Date().toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default async function DirectionA() {
  const data = await getPreviewData();
  if (!data) return <div className="dir-a pv-root"><p style={{ padding: 60 }}>Fără date.</p></div>;
  const { hero, live, top, explain, timelineStory, trending, valcea } = data;
  const [leadTop, ...restTop] = top;

  return (
    <div className="dir-a pv-root" data-theme="light">
      {/* Header */}
      <header className="a-head">
        <div className="pv-wrap a-head-in">
          <div className="a-brand">Puls<b>Now</b>24</div>
          <nav className="a-nav pv-hide-mobile">
            {NAV.map((n) => <a key={n} href="#">{n}</a>)}
          </nav>
          <div className="a-head-right">
            <span className="a-live pv-hide-mobile"><span className="pv-live-dot" /> ÎN DIRECT</span>
            <div className="pv-hide-mobile"><SearchTrigger /></div>
            <div className="pv-only-mobile"><SearchTrigger compact /></div>
            <ThemeToggle initial="light" />
            <MobileNav items={NAV} />
          </div>
        </div>
      </header>

      <div className="pv-wrap">
        {/* Masthead */}
        <div className="a-masthead">
          <span className="date">{today()}</span>
          <span className="tagline pv-hide-mobile">Nu doar citești știrile. Le înțelegi.</span>
        </div>

        {/* Hero */}
        <section className="a-hero">
          <div className="pv-in">
            <span className="a-kicker">{hero.category}</span>
            <h1>{hero.title}</h1>
            <p className="lead">{hero.summary}</p>
            <div className="a-meta">
              <span><b>{sourceLabel(hero.sourceCount)}</b> independente</span>
              <span>Încredere <b>{confidenceShort(hero.confidenceLabel)}</b></span>
              <span>Actualizat {hero.updatedLabel}</span>
            </div>
            <Link href="/preview/a/story" className="cta">Citește dosarul <ArrowRight size={16} /></Link>
          </div>
          <div className="a-hero-side pv-in-2">
            <TintSurface story={hero} className="a-hero-panel">
              <p className="q">„{hero.summary.slice(0, 130)}{hero.summary.length > 130 ? "…" : ""}”</p>
            </TintSurface>
          </div>
        </section>

        {/* Live Now */}
        <div className="a-section-h"><h2>Se dezvoltă acum</h2><a href="#">Toate</a></div>
        <div className="a-live-strip pv-in">
          {live.map((s) => (
            <Link key={s.id} href="/preview/a/story" className="a-live-item pv-card-hover">
              <div className="top"><span className="pv-live-dot" /> {s.category}</div>
              <h3>{s.title}</h3>
              <div className="u">Actualizat {s.updatedLabel} · {sourceLabel(s.sourceCount)}</div>
            </Link>
          ))}
        </div>

        {/* Top Stories */}
        <div className="a-section-h"><h2>Pe larg</h2></div>
        <section className="a-top">
          <Link href="/preview/a/story" className="a-story lead-col pv-card-hover">
            <TintSurface story={leadTop} className="lead-panel">
              <span>{leadTop.category}</span>
            </TintSurface>
            <span className="cat">{leadTop.category}</span>
            <h3>{leadTop.title}</h3>
            <p>{leadTop.summary}</p>
            <div className="m"><span>{sourceLabel(leadTop.sourceCount)}</span><span>·</span><span>Încredere {confidenceShort(leadTop.confidenceLabel)}</span><span>·</span><span>{leadTop.readingMins} min</span></div>
          </Link>
          <div>
            {restTop.slice(0, 3).map((s) => (
              <Link key={s.id} href="/preview/a/story" className="a-story">
                <span className="cat">{s.category}</span>
                <h3>{s.title}</h3>
                <div className="m"><span>{s.updatedLabel}</span><span>·</span><span>{sourceLabel(s.sourceCount)}</span></div>
              </Link>
            ))}
          </div>
          <div>
            {restTop.slice(3, 5).map((s) => (
              <Link key={s.id} href="/preview/a/story" className="a-story">
                <span className="cat">{s.category}</span>
                <h3>{s.title}</h3>
                <p>{s.summary.slice(0, 110)}{s.summary.length > 110 ? "…" : ""}</p>
                <div className="m"><span>{s.updatedLabel}</span></div>
              </Link>
            ))}
          </div>
        </section>

        {/* De ce contează */}
        <section className="a-why">
          <span className="lbl">De ce contează</span>
          <h2>Contextul din spatele titlurilor.</h2>
          <div className="a-why-grid">
            {explain.map((s) => (
              <div key={s.id} className="a-why-item">
                <h4>{s.title}</h4>
                <p>{s.summary}</p>
                <div className="m"><span>{s.category}</span><span>·</span><span>{sourceLabel(s.sourceCount)}</span></div>
              </div>
            ))}
          </div>
        </section>

        {/* Timeline + Trending */}
        <div className="a-split">
          <div>
            <div className="a-section-h"><h2>Cronologie · {timelineStory.category}</h2></div>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 26, lineHeight: 1.2, marginBottom: 22, letterSpacing: "-.01em" }}>{timelineStory.title}</h3>
            <div className="a-timeline">
              {timelineStory.timeline.slice().reverse().map((e, i) => (
                <div key={i} className="a-tl-item">
                  <div className="t">{new Date(e.at).toLocaleString("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                  <h4>{e.title}</h4>
                  {e.source && <div className="s">{e.source}</div>}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="a-section-h"><h2>În tendințe</h2></div>
            <div className="a-trend">
              {trending.map((t) => (
                <a key={t.name} href="#">{t.name} <b>{t.mentionCount}×</b></a>
              ))}
            </div>
          </div>
        </div>

        {/* Vâlcea */}
        <section className="a-valcea">
          <div className="a-valcea-h">
            <span className="pin">📍</span>
            <h2>Vâlcea</h2>
            <span className="tag pv-hide-mobile">Monitorizare locală</span>
          </div>
          <div className="a-valcea-grid">
            {(valcea.length ? valcea : top.slice(0, 4)).slice(0, 4).map((s) => (
              <Link key={s.id} href="/preview/a/story" className="a-valcea-item pv-card-hover">
                <h3>{s.title}</h3>
                <p>{s.summary.slice(0, 120)}{s.summary.length > 120 ? "…" : ""}</p>
                <div className="m"><span>{sourceLabel(s.sourceCount)}</span><span>·</span><span>Încredere {confidenceShort(s.confidenceLabel)}</span></div>
              </Link>
            ))}
          </div>
        </section>

        {/* Newsletter CTA */}
        <section className="a-cta">
          <div>
            <h2>Brief-ul zilnic PulsNow24</h2>
            <p>Cele mai importante story-uri ale zilei, explicate — în inbox, în fiecare dimineață.</p>
          </div>
          <form>
            <input placeholder="adresa ta de email" aria-label="email" />
            <button type="button">Abonează-te</button>
          </form>
        </section>
      </div>

      {/* Footer */}
      <footer className="a-foot">
        <div className="pv-wrap">
          <div className="a-foot-grid">
            <div>
              <div className="a-brand">Puls<b>Now</b>24</div>
              <p>Nu doar știri. Te ajutăm să înțelegi jocul. Story-uri verificate, cu surse și context.</p>
            </div>
            <div><h5>Secțiuni</h5><ul>{NAV.map((n) => <li key={n}><a href="#">{n}</a></li>)}</ul></div>
            <div><h5>Platformă</h5><ul><li><a href="#">Cum funcționează</a></li><li><a href="#">Transparența surselor</a></li><li><a href="#">Încredere</a></li></ul></div>
            <div><h5>Companie</h5><ul><li><a href="#">Despre</a></li><li><a href="#">Contact</a></li><li><a href="#">Confidențialitate</a></li></ul></div>
          </div>
          <div className="base"><span>© {new Date().getFullYear()} PulsNow24</span><span>Editorial Premium · preview</span></div>
        </div>
      </footer>
    </div>
  );
}
