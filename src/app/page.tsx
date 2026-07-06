import { getArticles, pickLead } from "@/lib/articles";
import { ArticleCard, LeadStory, SideStory } from "@/components/ArticleCards";

// Pagina se regenerează cel mult o dată pe minut — articolele noi
// din Firestore apar fără redeploy
export const revalidate = 60;

export default async function Home() {
  const articole = await getArticles();

  // Hero: articolul principal + 2 serioase și 1 buzz pe lateral
  const lead = pickLead(articole);
  const serioaseToate = articole.filter((a) => !a.buzz && a.id !== lead.id);
  const buzzToate = articole.filter((a) => a.buzz && a.id !== lead.id);
  const sideArticles = [...serioaseToate.slice(0, 2), ...buzzToate.slice(0, 1)];

  // Grilele afișează restul articolelor din lumea lor, mai puțin cele din hero
  const inHero = new Set([lead.id, ...sideArticles.map((a) => a.id)]);
  const serioase = articole.filter((a) => !a.buzz && !inHero.has(a.id));
  const buzz = articole.filter((a) => a.buzz && !inHero.has(a.id));

  return (
    <>
      <div className="section-label">Pe scurt, acum</div>
      <div className="hero-grid">
        <LeadStory article={lead} />
        <div className="side-stack">
          {sideArticles.map((a) => (
            <SideStory key={a.id} article={a} />
          ))}
        </div>
      </div>

      <div className="section-label">Actualitate &amp; analiză</div>
      <div className="news-grid">
        {serioase.map((a) => (
          <ArticleCard key={a.id} article={a} />
        ))}
      </div>

      <div className="section-label buzz">Viral &amp; monden</div>
      <div className="news-grid">
        {buzz.map((a) => (
          <ArticleCard key={a.id} article={a} />
        ))}
      </div>
    </>
  );
}
