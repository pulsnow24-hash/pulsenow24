import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Ticker from "@/components/Ticker";
import { getTickerItems } from "@/lib/articles";

export const metadata: Metadata = {
  title: "PulsNow24 — Pulsul zilei, pe scurt",
  description:
    "PulsNow24: cele mai importante știri ale zilei, verificate și rezumate clar. Business, AI, politică, geopolitică și viral — cu răspunsuri rapide.",
  openGraph: {
    title: "PulsNow24 — Pulsul zilei, pe scurt",
    description: "Știri verificate, rezumate clar. Business, AI, politică, viral.",
    type: "website",
    locale: "ro_RO",
    siteName: "PulsNow24",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "NewsMediaOrganization",
  name: "PulsNow24",
  description: "Pulsul zilei, pe scurt — știri verificate și rezumate clar",
  url: "https://pulsnow24.com",
};

export default async function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tickerItems = await getTickerItems();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Ticker items={tickerItems} />
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}
