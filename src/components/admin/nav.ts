import {
  LayoutDashboard,
  Inbox,
  PenSquare,
  Newspaper,
  Images,
  Search,
  Share2,
  LineChart,
  Workflow,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Prefixe suplimentare care marchează itemul ca activ */
  match?: string[];
}

/** Sursa unică de adevăr pentru navigarea CMS-ului (sidebar + command palette). */
export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { title: "AI Inbox", href: "/admin/inbox", icon: Inbox },
  { title: "Editor", href: "/admin/editor", icon: PenSquare },
  { title: "Articole", href: "/admin/articles", icon: Newspaper },
  { title: "Media", href: "/admin/media", icon: Images },
  { title: "SEO", href: "/admin/seo", icon: Search },
  { title: "Social", href: "/admin/social", icon: Share2 },
  { title: "Analytics", href: "/admin/analytics", icon: LineChart },
  { title: "Automatizare", href: "/admin/automation", icon: Workflow },
  { title: "Setări", href: "/admin/settings", icon: Settings },
];

/** Găsește itemul de navigare activ pentru un pathname dat. */
export function activeNavItem(pathname: string): NavItem | undefined {
  // Cea mai lungă potrivire câștigă, ca /admin să nu prindă /admin/inbox
  return [...NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find(
      (item) =>
        pathname === item.href ||
        pathname.startsWith(item.href + "/") ||
        item.match?.some((m) => pathname.startsWith(m))
    );
}
