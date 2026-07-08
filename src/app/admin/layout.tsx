import type { Metadata } from "next";
import { NewsroomProvider } from "@/components/admin/newsroom-provider";
import AppShell from "@/components/admin/app-shell";

export const metadata: Metadata = {
  title: "Newsroom — PulsNow24",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NewsroomProvider>
      <AppShell>{children}</AppShell>
    </NewsroomProvider>
  );
}
