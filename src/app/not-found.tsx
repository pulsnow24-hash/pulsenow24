import Link from "next/link";

export default function NotFound() {
  return (
    <div className="article-view" style={{ textAlign: "center", padding: "4rem 0" }}>
      <h1>Pagina nu a fost găsită</h1>
      <p style={{ color: "var(--ink-soft)", margin: "1rem 0 2rem" }}>
        Articolul căutat nu există sau a fost mutat.
      </p>
      <Link className="back-btn" href="/">
        ← Înapoi la știri
      </Link>
    </div>
  );
}
