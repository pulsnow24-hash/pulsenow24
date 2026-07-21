import Link from "next/link";
import { getPreviewData } from "@/lib/preview/data";

export const dynamic = "force-dynamic";

export default async function PreviewIndex() {
  const data = await getPreviewData();
  const count = data?.total ?? 0;

  const dirs = [
    {
      slug: "a",
      tag: "Direcția A",
      name: "Editorial Premium",
      desc: "Light-first, tipografie serif puternică, aer generos, ierarhie elegantă. Senzație de publicație premium, nu de portal de știri.",
    },
    {
      slug: "b",
      tag: "Direcția B",
      name: "AI News Terminal",
      desc: "Dark, indicatori live, încredere, număr de surse, cronologii, „de ce contează”. Platformă de inteligență, vie și mereu actualizată — dar publică.",
    },
    {
      slug: "c",
      tag: "Direcția C",
      name: "Cinematic News",
      desc: "Imersiv, hero mare, straturi, mișcare subtilă. Impact vizual de tip streaming premium, dramatic dar controlat.",
    },
  ];

  return (
    <div className="pv-index">
      <h1>PulsNow24 — Public Experience Redesign</h1>
      <p className="sub">
        Trei direcții de design pentru pagina publică, construite pe {count} story-uri
        reale de producție. Aceleași date, aceeași structură — pentru o comparație
        corectă. Fiecare are homepage + o pagină de story.
      </p>
      <div className="cards">
        {dirs.map((d) => (
          <Link key={d.slug} href={`/preview/${d.slug}`}>
            <div className="tag">{d.tag}</div>
            <h2>{d.name}</h2>
            <p>{d.desc}</p>
            <p style={{ marginTop: 16, color: "#e4e4e7", fontSize: 13 }}>
              /preview/{d.slug} · /preview/{d.slug}/story →
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
