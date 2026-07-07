import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleById, getArticles } from "@/lib/articles";
import { badgeClass, iconColor } from "@/components/ArticleCards";
import { PulsIcon } from "@/components/BrandLogo";
import ShareRow from "@/components/ShareRow";

interface Props {
  params: Promise<{ id: string }>;
}

// Articolele noi din Firestore se randează la cerere și se
// reîmprospătează cel mult o dată pe minut
export const revalidate = 60;

export async function generateStaticParams() {
  const articole = await getArticles();
  return articole.map((a) => ({ id: a.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticleById(id);
  if (!article || article.status === "draft") return {};
  const title = article.seo?.title || article.titlu;
  const description = article.seo?.metaDescription || article.sumar;
  return {
    title: `${title} — PulsNow24`,
    description,
    keywords: article.seo?.keywords,
    openGraph: {
      title,
      description,
      type: "article",
      locale: "ro_RO",
      siteName: "PulsNow24",
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { id } = await params;
  const article = await getArticleById(id);
  if (!article || article.status === "draft") notFound();

  return (
    <div className="article-view">
      <Link className="back-btn" href="/">
        ← Înapoi la știri
      </Link>
      <div>
        <span className={`badge ${badgeClass(article)}`}>{article.categorie}</span>
      </div>
      <h1>{article.titlu}</h1>
      <div className="article-byline">
        <span>De Redacția PulsNow24</span>
        <span>·</span>
        <span>{article.data}</span>
        <span>·</span>
        <span>{article.citire} citire</span>
      </div>
      {article.imagine ? (
        <figure className="article-figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={article.imagine} alt={article.titlu} />
          {article.imagineCredit && (
            <figcaption>{article.imagineCredit}</figcaption>
          )}
        </figure>
      ) : (
        <div className={`article-hero${article.buzz ? " is-buzz" : ""}`}>
          <PulsIcon color={iconColor(article)} size={80} />
        </div>
      )}
      <div className="article-body">
        <div className="format-block fb-fact">
          <span className="fb-label">● Faptul verificat</span>
          <p>{article.fapt}</p>
        </div>
        <div className="format-block fb-angle">
          <span className="fb-label">◆ Unghiul ascuns</span>
          <p>{article.unghi}</p>
        </div>
        <div className="format-block fb-opinion">
          <span className="fb-label">▲ Opinia PulsNow24</span>
          <p>{article.opinie}</p>
        </div>
        <div className="format-block fb-predict">
          <span className="fb-label">↗ Predicția</span>
          <p>{article.predictie}</p>
        </div>

        <div className="aeo-box">
          <div className="aeo-header">
            <span className="tag">Răspuns rapid</span>
            <h4>Întrebări frecvente despre acest subiect</h4>
          </div>
          {article.qa.map((pair) => (
            <div className="qa-item" key={pair.q}>
              <div className="qa-q">{pair.q}</div>
              <div className="qa-a">{pair.a}</div>
            </div>
          ))}
        </div>

        <div className="debate-box">
          <div className="db-label">Tu ce crezi?</div>
          <div className="db-q">{article.dezbatere}</div>
        </div>

        {article.taguri && article.taguri.length > 0 && (
          <div className="tag-row">
            {article.taguri.map((tag) => (
              <span className="tag-chip" key={tag}>
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="source-note">
          {article.sursa?.nume || article.sursa?.url ? (
            <>
              <strong>Sursă:</strong>{" "}
              {article.sursa.url ? (
                <a href={article.sursa.url} target="_blank" rel="noreferrer nofollow">
                  {article.sursa.nume || article.sursa.url}
                </a>
              ) : (
                article.sursa.nume
              )}
              {article.sursa.autor && <> · {article.sursa.autor}</>}
            </>
          ) : (
            <>
              <strong>Sursă:</strong> Articol demonstrativ. Conținutul e
              exemplificativ, pentru a-ți arăta cum arată formatul PulsNow24 pe
              site.
            </>
          )}
        </div>

        <ShareRow article={article} />
      </div>
    </div>
  );
}
