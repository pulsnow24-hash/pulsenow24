import { Settings } from "lucide-react";
import SectionPlaceholder from "@/components/admin/section-placeholder";

export default function SettingsPage() {
  return (
    <SectionPlaceholder
      icon={Settings}
      title="Setări"
      description="Cont, chei API, reguli de publicare și preferințe ale redacției."
      phase="Faza 9"
    />
  );
}
