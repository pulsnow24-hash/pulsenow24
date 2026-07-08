import { Workflow } from "lucide-react";
import SectionPlaceholder from "@/components/admin/section-placeholder";

export default function AutomationPage() {
  return (
    <SectionPlaceholder
      icon={Workflow}
      title="RSS & Automatizare"
      description="Gestionarea surselor RSS, reguli de scor și ingestie automată programată a știrilor."
      phase="Faza 8"
    />
  );
}
