import Link from "next/link";
import { ArrowRight, Activity } from "lucide-react";
import { getPreviewData } from "@/lib/preview/data";
import { ThemeToggle, SearchTrigger, MobileNav } from "@/components/preview/controls";
import { TintSurface, ConfidenceMeter, sourceLabel, confidenceShort } from "@/components/preview/bits";

export const dynamic = "force-dynamic";
const NAV = ["Live", "Actualitate", "Geopolitică", "Business", "Vâlcea"];

function Pips({ n, max = 5 }: { n: number; max?: number }) {
  return (
    <span className="b-src-pips" title={sourceLabel(n)}>
      {Array.from({ length: max }).map((_, i) => (
        <i key={i} className={i < n ? "" : "off"} />
      ))}
    </span>
  );
}

export default async function DirectionB() {
  const data = await getPreviewData();
  if (!data) return <div className="dir-b pv-root"><p style={{ padding: 60 }}>Fără date.</p></div>;
  const { hero, live, top, explain, timelineStory, trending, valcea, total } = data;

  return (
    <div className="dir-b pv-root" data-theme="dark">
      <header className="b-head">
        <div className="pv-wrap b-head-in">
          <div className="b-brand"><span className="sq">P</span> PulsNow24</div>
          <nav className="b-nav pv-hide-mobile">{NAV.map((n) => <a key={n} href="#">{n}</a>)}</nav>
          <div className="b-head-right">
            <span className="b-livepill pv-hide-mobile"><span className="pv-live-dot" /> LIVE · {live.length} active</span>
            <div className="pv-hide-mobile"><SearchTrigger /></div>
            <div className="pv-only-mobile"><SearchTrigger compact /></div>
            <ThemeToggle initial="dark" />
            <MobileNav items={NAV} />
          </div>
        </div>
      </header>

      <div className="pv-wrap">
        {/* Status bar */}
        <div className="b-statusbar">
          <span className="item"><Activity size={13} style={{ verticalAlign: -2, color: "var(--accent)" }} /> STATUS: <b>live</b></span>
          <span className="item">STORY-URI URMĂRITE: <b>{total}</b></span>
          <span className="item">SE DEZVOLTĂ: <b>{live.length}</b></span>
          <span className="item">ULTIMA ACTUALIZARE: <b>{hero.updatedLabel}</b></span>
          <span className="item">ÎNTREBAREA ZILEI: de ce contează, nu doar ce s-a întâmplat</span>
        </div>

        {/* Hero */}
        <section className="b-hero">
          <div className="b-hero-main pv-in">
            <span className="b-tag"><span className="pv-live-dot" /> {hero.category}</span>
            <h1>{hero.title}</h1>
            <p className="why">{hero.summary}</p>
            <div className="b-hero-metrics">
              <div className="b-metric">
                <span className="k">Încredere</span>
                <span className="v" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {hero.confidence} <ConfidenceMeter story={hero} width={54} />
                </span>
              </div>
              <div className="b-metric"><span className="k">Surse independente</span><span className="v" style={{ display: "flex", alignItems: "center", gap: 8 }}>{hero.sourceCount} <Pips n={hero.sourceCount} /></span></div>
              <div className="b-metric"><span className="k">Momente cronologie</span><span className="v">{hero.timeline.length}</span></div>
              <div className="b-metric"><span className="k">Actualizat</span><span className="v" style={{ fontSize: 14 }}>{hero.updatedLabel}</span></div>
            </div>
            <Link href="/preview/b/story" className="b-cta">Deschide dosarul <ArrowRight size={15} /></Link>
          </div>
          <div className="b-feed pv-in-2">
            <div className="b-feed-h"><span className="pv-live-dot" /> FLUX LIVE</div>
            {live.map((s) => (
              <Link key={s.id} href="/preview/b/story" className="b-feed-item">
                <div className="fh"><span className="pv-live-dot" /> {s.updatedLabel} · {s.category}</div>
                <h4>{s.title}</h4>
                <div className="fm"><ConfidenceMeter story={s} width={36} /> <span className="b-mono-meta">{sourceLabel(s.sourceCount)}</span></div>
              </Link>
            ))}
          </div>
        </section>

        {/* Top Stories */}
        <div className="b-sec-h"><h2>Top story-uri</h2><span className="badge">ranked</span><span className="line" /></div>
        <div className="b-grid">
          {top.map((s) => (
            <Link key={s.id} href="/preview/b/story" className="b-card pv-card-hover">
              <div className="ch"><span className="b-tag">{s.category}</span>{s.breaking && <span className="b-mono-meta" style={{ color: "var(--alert)" }}>BREAKING</span>}</div>
              <h3>{s.title}</h3>
              <p>{s.summary.slice(0, 120)}{s.summary.length > 120 ? "…" : ""}</p>
              <div className="cf">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><ConfidenceMeter story={s} width={44} /></span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Pips n={s.sourceCount} /> <span className="b-mono-meta">{s.updatedLabel}</span></span>
              </div>
            </Link>
          ))}
        </div>

        {/* De ce contează */}
        <div className="b-sec-h"><h2>De ce contează</h2><span className="badge">analiză</span><span className="line" /></div>
        <div className="b-why">
          {explain.map((s, i) => (
            <div key={s.id} className="b-why-card">
              <span className="num">0{i + 1} · {s.category}</span>
              <h4>{s.title}</h4>
              <p>{s.summary}</p>
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
                <ConfidenceMeter story={s} width={40} showLabel />
              </div>
            </div>
          ))}
        </div>

        {/* Timeline + Trending */}
        <div className="b-sec-h"><h2>Evoluție & tendințe</h2><span className="line" /></div>
        <div className="b-split">
          <div className="b-tl">
            <h3>{timelineStory.title}</h3>
            {timelineStory.timeline.slice().reverse().map((e, i) => (
              <div key={i} className="b-tl-row">
                <div className="ts">{new Date(e.at).toLocaleString("ro-RO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
                <div className="tc"><h5>{e.title}</h5>{e.source && <span>{e.source}</span>}</div>
              </div>
            ))}
          </div>
          <div className="b-trend">
            <h3>În tendințe acum</h3>
            {trending.slice(0, 8).map((t) => (
              <div key={t.name} className="b-trend-row">
                <span className="nm">{t.name}</span>
                <span className="ty">{t.type}</span>
                <span className="tv">{t.mentionCount}×</span>
              </div>
            ))}
          </div>
        </div>

        {/* Vâlcea */}
        <div className="b-valcea">
          <div className="b-valcea-h">
            <span>📍</span><h2>Monitor Vâlcea</h2>
            <span className="live"><span className="pv-live-dot" /> inteligență locală publică</span>
          </div>
          <div className="b-valcea-grid">
            {(valcea.length ? valcea : top.slice(0, 4)).slice(0, 4).map((s) => (
              <Link key={s.id} href="/preview/b/story" className="b-valcea-item">
                <div className="fh b-mono-meta" style={{ marginBottom: 8 }}>{s.updatedLabel}</div>
                <h4>{s.title}</h4>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}><ConfidenceMeter story={s} width={36} /> <span className="b-mono-meta">{sourceLabel(s.sourceCount)}</span></div>
              </Link>
            ))}
          </div>
        </div>

        {/* CTA */}
        <section className="b-cta-band">
          <div><h2>Brief-ul zilnic de inteligență</h2><p>Story-urile care contează, cu încredere, surse și context — livrate în fiecare dimineață.</p></div>
          <form><input placeholder="email@exemplu.ro" aria-label="email" /><button type="button">Activează</button></form>
        </section>
      </div>

      <footer className="b-foot">
        <div className="pv-wrap">
          <div className="b-foot-grid">
            <div><div className="b-brand"><span className="sq">P</span> PulsNow24</div><p>Platforma care te ajută să înțelegi știrile: încredere, surse, cronologie și context — în timp real.</p></div>
            <div><h5>Live</h5><ul>{NAV.slice(0, 4).map((n) => <li key={n}><a href="#">{n}</a></li>)}</ul></div>
            <div><h5>Inteligență</h5><ul><li><a href="#">Încredere</a></li><li><a href="#">Surse</a></li><li><a href="#">Cronologii</a></li></ul></div>
            <div><h5>Companie</h5><ul><li><a href="#">Despre</a></li><li><a href="#">Contact</a></li></ul></div>
          </div>
          <div className="base"><span>© {new Date().getFullYear()} PulsNow24</span><span>AI News Terminal · preview</span></div>
        </div>
      </footer>
    </div>
  );
}
