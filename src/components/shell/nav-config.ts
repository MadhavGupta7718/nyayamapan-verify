import {
  Award,
  Bell,
  BookOpenCheck,
  Building2,
  CalendarRange,
  ClipboardCheck,
  FileStack,
  Gauge,
  LayoutDashboard,
  MapPinned,
  ScrollText,
  Settings,
  UserRound,
  Users,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { canAccessModule, type ModuleKey } from "@/lib/permissions";

export type NavItem = {
  module: ModuleKey;
  href: string;
  icon: LucideIcon;
  labelKey: string;
};

export type NavGroup = { key: string; labelKey?: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "main",
    items: [{ module: "overview", href: "/dashboard", icon: LayoutDashboard, labelKey: "overview" }],
  },
  {
    key: "operations",
    labelKey: "groupOperations",
    items: [
      { module: "applications", href: "/applications", icon: FileStack, labelKey: "applications" },
      { module: "instruments", href: "/instruments", icon: Gauge, labelKey: "instruments" },
      { module: "verification", href: "/verification", icon: ClipboardCheck, labelKey: "verification" },
      { module: "scheduling", href: "/scheduling", icon: CalendarRange, labelKey: "scheduling" },
      { module: "certificates", href: "/certificates", icon: Award, labelKey: "certificates" },
      { module: "gatc", href: "/gatc", icon: Building2, labelKey: "gatc" },
    ],
  },
  {
    key: "insights",
    labelKey: "groupInsights",
    items: [
      { module: "reports", href: "/reports", icon: BarChart3, labelKey: "reports" },
      { module: "notifications", href: "/notifications", icon: Bell, labelKey: "notifications" },
    ],
  },
  {
    key: "admin",
    labelKey: "groupAdministration",
    items: [
      { module: "rules", href: "/rules", icon: BookOpenCheck, labelKey: "rules" },
      { module: "users", href: "/users", icon: Users, labelKey: "users" },
      { module: "geography", href: "/geography", icon: MapPinned, labelKey: "geography" },
      { module: "audit", href: "/audit", icon: ScrollText, labelKey: "audit" },
    ],
  },
];

export const ACCOUNT_ITEMS: NavItem[] = [
  { module: "profile", href: "/profile", icon: UserRound, labelKey: "profile" },
  { module: "settings", href: "/settings", icon: Settings, labelKey: "settings" },
];

export function navForRole(role: Role): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => canAccessModule(role, i.module)) })).filter(
    (g) => g.items.length > 0
  );
}

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Maps a first path segment to its nav label key for breadcrumbs. */
export const SEGMENT_LABELS: Record<string, string> = Object.fromEntries(
  [...NAV_GROUPS.flatMap((g) => g.items), ...ACCOUNT_ITEMS].map((i) => [i.href.slice(1), i.labelKey])
);
