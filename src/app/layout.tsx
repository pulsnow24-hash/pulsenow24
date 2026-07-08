import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PulsNow24",
  description:
    "PulsNow24: cele mai importante știri ale zilei, verificate și rezumate clar.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
