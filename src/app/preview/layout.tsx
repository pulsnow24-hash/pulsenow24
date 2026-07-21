import type { Metadata } from "next";
import "./preview.css";

export const metadata: Metadata = {
  title: "PulsNow24 — Preview redesign",
  robots: { index: false, follow: false },
};

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
