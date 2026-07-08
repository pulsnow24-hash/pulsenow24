import { Images } from "lucide-react";
import SectionPlaceholder from "@/components/admin/section-placeholder";

export default function MediaPage() {
  return (
    <SectionPlaceholder
      icon={Images}
      title="Media"
      description="Galeria de imagini din Firebase Storage: încărcare, căutare și reutilizare în articole."
      phase="Fază planificată"
    />
  );
}
