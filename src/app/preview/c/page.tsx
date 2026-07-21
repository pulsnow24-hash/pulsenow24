import Link from "next/link";
import { Play } from "lucide-react";
import { getPreviewData } from "@/lib/preview/data";
import { ThemeToggle, SearchTrigger, MobileNav } from "@/components/preview/controls";
import { TintSurface, ConfidenceMeter, sourceLabel, confidenceShort } from "@/components/preview/bits";

export const dynamic = "force-dynamic";
const NAV = ["Actualitate", "Geopolitică", "Business", "AI & Tech", "Vâlcea"];

export default async function DirectionC() {
  const data = await getPreviewData();
  if (!data) return <div className="dir-c pv-root"><p style={{ padding: 60 }}>Fără date.</p></div>;
  const { hero, live, top, explain, timelineStory, trending, valcea } = data;

  return (
    <div className="dir-c pv-root" data-theme="dark">
      <header className="c-head">
        <div className="c-wrap c-head-in">
          <div className="c-brand">Puls<b>Now</b>24</div>
          <nav className="c-nav pv-hide-mobile">{NAV.map((n) => <a key={n} href="#">{n}</a>)}</nav>
          <div className="c-head-right">
            <span className="c-livechip pv-hide-mobile"><span className="pv-live-dot" /> În direct</span>
            <div className="pv-hide-mobile"><SearchTrigger /></div>
            <div className="pv-only-mobile"><SearchTrigger compact /></div>
            <ThemeToggle initial="dark" />
            <MobileNav items={NAV} />
          </div>
        </div>
      </header>

      {/* Hero imersiv */}
      <section className="c-hero">
        <TintSurface story={hero} className="c-hero-bg pv-reveal" />
        <div className="c-wrap">
          <div className="c-hero-inner pv-in">
            <span className="c-hero-kicker"><span className="pv-live-dot" /> {hero.category} · se dezvoltă acum</span>
            <h1>{hero.title}</h1>
            <p className="sum">{hero.summary}</p>
            <div className="c-hero-meta">
              <span className="chip"><b>{sourceLabel(hero.sourceCount)}</b> independente</span>
              <span className="chip">Încredere {confidenceShort(hero.confidenceLabel)} · {hero.confidence}</span>
              <span className="chip">Actualizat {hero.updatedLabel}</span>
            </div>
            <Link href="/preview/c/story" className="c-hero-cta"><Play size={16} fill="currentColor" /> Intră în poveste</Link>
          </div>
        </div>
      </section>

      <div className="c-wrap">
        {/* Live rail */}
        <div className="c-sec-h"><div><h2>Se întâmplă acum</h2><div className="sub">Story-uri active, actualizate în timp real</div></div><a href="#">Toate →</a></div>
        <div className="c-rail">
          {live.concat(top.slice(0, 2)).map((s) => (
            <Link key={s.id} href="/preview/c/story" className="c-railcard pv-card-hover">
              <TintSurface story={s} className="poster">
                <span className="live"><span className="pv-live-dot" /> {s.category}</span>
              </TintSurface>
              <div className="body">
                <h3>{s.title}</h3>
                <div className="m"><span>{s.updatedLabel}</span><span>·</span><span>{sourceLabel(s.sourceCount)}</span></div>
              </div>
            </Link>
          ))}
        </div>

        {/* Top posters */}
        <div className="c-sec-h"><div><h2>Story-urile momentului</h2><div className="sub">Selectate după impact, încredere și coroborare</div></div></div>
        <div className="c-posters">
          {top.slice(0, 3).map((s) => (
            <Link key={s.id} href="/preview/c/story" className="c-poster pv-card-hover">
              <TintSurface story={s} className="surf" />
              <div className="content">
                <span className="cat">{s.category}</span>
                <h3>{s.title}</h3>
                <div className="m"><ConfidenceMeter story={s} width={40} /><span>{sourceLabel(s.sourceCount)}</span></div>
              </div>
            </Link>
          ))}
        </div>

        {/* Feature — de ce contează */}
        <section className="c-feature">
          <TintSurface story={explain[0] ?? hero} className="art" />
          <div className="txt">
            <span className="lbl">De ce contează</span>
            <h2>Nu doar ce s-a întâmplat — ce înseamnă.</h2>
            <p>{(explain[0] ?? hero).summary}</p>
            <div className="items">
              {explain.slice(0, 3).map((s, i) => (
                <div key={s.id} className="fi">
                  <span className="n">0{i + 1}</span>
                  <h4>{s.title}</h4>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Timeline + trending */}
        <div className="c-split">
          <div className="c-tl-wrap">
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--accent)", marginBottom: 8, fontWeight: 700 }}>Cronologie</div>
            <h3>{timelineStory.title}</h3>
            {timelineStory.timeline.slice().reverse().map((e, i, arr) => (
              <div key={i} className="c-tl-item">
                <div className="c-tl-dot"><i />{i < arr.length - 1 && <span className="l" />}</div>
                <div>
                  <div className="tt">{new Date(e.at).toLocaleString("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                  <h5>{e.title}</h5>
                </div>
              </div>
            ))}
          </div>
          <div className="c-trend-wrap">
            <h3>În tendințe</h3>
            <div className="c-trend-pills">
              {trending.map((t) => <a key={t.name} href="#">{t.name} <b>{t.mentionCount}×</b></a>)}
            </div>
          </div>
        </div>

        {/* Vâlcea */}
        <section className="c-valcea">
          <TintSurface story={valcea[0] ?? hero} className="bg" />
          <div className="c-valcea-in">
            <div className="h"><span style={{ fontSize: 22 }}>📍</span><h2>Vâlcea</h2><span className="tag pv-hide-mobile">Monitorizare locală</span></div>
            <div className="c-valcea-grid">
              {(valcea.length ? valcea : top.slice(0, 4)).slice(0, 4).map((s) => (
                <Link key={s.id} href="/preview/c/story" className="c-valcea-card pv-card-hover">
                  <h4>{s.title}</h4>
                  <div className="m"><ConfidenceMeter story={s} width={34} /><span>{sourceLabel(s.sourceCount)}</span></div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="c-cta">
          <div className="bg" />
          <div className="c-cta-in">
            <h2>Povestea zilei, în fiecare dimineață</h2>
            <p>Abonează-te la brief-ul PulsNow24 — cele mai importante story-uri, explicate clar, cu surse și context.</p>
            <form><input placeholder="adresa ta de email" aria-label="email" /><button type="button">Abonează-te</button></form>
          </div>
        </section>
      </div>

      <footer className="c-foot">
        <div className="c-wrap">
          <div className="c-foot-grid">
            <div><div className="c-brand" style={{ textShadow: "none" }}>Puls<b>Now</b>24</div><p>Știri imersive, verificate și explicate. Nu doar le citești — le trăiești și le înțelegi.</p></div>
            <div><h5>Secțiuni</h5><ul>{NAV.map((n) => <li key={n}><a href="#">{n}</a></li>)}</ul></div>
            <div><h5>Platformă</h5><ul><li><a href="#">Cum funcționează</a></li><li><a href="#">Surse</a></li><li><a href="#">Încredere</a></li></ul></div>
            <div><h5>Companie</h5><ul><li><a href="#">Despre</a></li><li><a href="#">Contact</a></li></ul></div>
          </div>
          <div className="base"><span>© {new Date().getFullYear()} PulsNow24</span><span>Cinematic News · preview</span></div>
        </div>
      </footer>
    </div>
  );
}
