import { LineChart } from "lucide-react";
import SectionPlaceholder from "@/components/admin/section-placeholder";

export default function AnalyticsPage() {
  return (
    <SectionPlaceholder
      icon={LineChart}
      title="Analytics"
      description="Trafic, articolele cu cele mai multe vizualizări și performanța pe categorii și surse."
      phase="Faza 7"
    />
  );
}
