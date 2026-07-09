import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleById, type Article } from "@/lib/articles";
import { badgeClass, iconColor } from "@/components/ArticleCards";
import { PulsIcon } from "@/components/BrandLogo";
import ShareRow from "@/components/ShareRow";

interface Props {
  params: Promise<{ id: string }>;
}

// Randare la fiecare cerere: articolele noi și editările din Firestore
// apar imediat, fără cache și fără redeploy.
export const dynamic = "force-dynamic";

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

/** Blocurile de conținut, în ordinea salvată din Studio (sau cea implicită) */
const BODY_BLOCKS: Record<
  string,
  { className: string; label: string; value: (a: Article) => string | undefined }
> = {
  fapt: { className: "fb-fact", label: "● Faptul verificat", value: (a) => a.fapt },
  deCeConteaza: {
    className: "fb-why",
    label: "◎ De ce contează",
    value: (a) => a.deCeConteaza,
  },
  unghi: { className: "fb-angle", label: "◆ Unghiul ascuns", value: (a) => a.unghi },
  opinie: { className: "fb-opinion", label: "▲ Opinia PulsNow24", value: (a) => a.opinie },
  predictie: { className: "fb-predict", label: "↗ Predicția", value: (a) => a.predictie },
};
const DEFAULT_ORDER = ["fapt", "deCeConteaza", "unghi", "opinie", "predictie"];

export default async function ArticlePage({ params }: Props) {
  const { id } = await params;
  const article = await getArticleById(id);
  if (!article || article.status === "draft") notFound();

  const order = article.blockOrder?.length ? article.blockOrder : DEFAULT_ORDER;
  const blocks = order
    .map((field) => ({ field, def: BODY_BLOCKS[field] }))
    .filter((b) => b.def && b.def.value(article)?.trim());

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.seo?.title || article.titlu,
    description: article.seo?.metaDescription || article.sumar,
    datePublished: article.publicatLa,
    inLanguage: "ro",
    articleSection: article.categorie,
    ...(article.imagine ? { image: [article.imagine] } : {}),
    ...(article.taguri?.length ? { keywords: article.taguri.join(", ") } : {}),
    author: { "@type": "Organization", name: "PulsNow24" },
    publisher: { "@type": "Organization", name: "PulsNow24" },
  };

  return (
    <div className="article-view">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
        {blocks.map(({ field, def }) => (
          <div className={`format-block ${def.className}`} key={field}>
            <span className="fb-label">{def.label}</span>
            <p>{def.value(article)}</p>
          </div>
        ))}

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
