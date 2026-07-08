import { Search } from "lucide-react";
import SectionPlaceholder from "@/components/admin/section-placeholder";

export default function SeoPage() {
  return (
    <SectionPlaceholder
      icon={Search}
      title="SEO Center"
      description="Title, meta description, slug, keywords și canonical — cu scor SEO și previzualizare în Google, generate de AI."
      phase="Faza 5"
    />
  );
}
