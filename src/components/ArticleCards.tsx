import Link from "next/link";
import type { Article } from "@/lib/articles";
import { PulsIcon } from "./BrandLogo";

const BUZZ_COLOR = "#B026FF";
const PULSE_COLOR = "#1E90FF";

export function iconColor(a: Article) {
  return a.buzz ? BUZZ_COLOR : PULSE_COLOR;
}

export function badgeClass(a: Article) {
  if (a.badge === "breaking") return "breaking";
  return a.buzz ? "cat-buzz" : "cat-blue";
}

export function shortDate(a: Article) {
  return a.data.split(",")[0];
}

export function LeadStory({ article }: { article: Article }) {
  return (
    <Link className="lead-story" href={`/articol/${article.id}`}>
      <span className={`badge ${badgeClass(article)}`}>
        {article.badge === "breaking" ? "Breaking" : article.categorie}
      </span>
      <h2>{article.titlu}</h2>
      <p>{article.sumar}</p>
      <div className="meta">
        {article.categorie} · {shortDate(article)} · {article.citire} citire
      </div>
    </Link>
  );
}

export function SideStory({ article }: { article: Article }) {
  return (
    <Link
      className={`side-story${article.buzz ? " is-buzz" : ""}`}
      href={`/articol/${article.id}`}
    >
      <span className="cat">{article.categorie}</span>
      <h3>{article.titlu}</h3>
      <div className="meta">{shortDate(article)}</div>
    </Link>
  );
}

export function ArticleCard({ article }: { article: Article }) {
  return (
    <Link
      className={`card${article.buzz ? " is-buzz" : ""}`}
      href={`/articol/${article.id}`}
    >
      <div className="card-img">
        <div className="ph">
          <PulsIcon color={iconColor(article)} size={44} />
        </div>
      </div>
      <div className="card-body">
        <div className="cat">{article.categorie}</div>
        <h3>{article.titlu}</h3>
        <p>{article.sumar}</p>
        <div className="meta">
          {shortDate(article)} · {article.citire}
        </div>
      </div>
    </Link>
  );
}
