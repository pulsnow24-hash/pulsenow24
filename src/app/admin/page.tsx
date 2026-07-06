import type { Metadata } from "next";
import AdminClient from "./AdminClient";

export const metadata: Metadata = {
  title: "Administrare — PulsNow24",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminClient />;
}
