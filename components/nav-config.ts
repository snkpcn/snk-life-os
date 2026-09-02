export type NavItem = { href: string; labelKey: string; icon: string };

export const PRIMARY_NAV: NavItem[] = [
  { href: "/", labelKey: "nav.today", icon: "⌂" },
  { href: "/tasks", labelKey: "nav.tasks", icon: "✓" },
  { href: "/money", labelKey: "nav.money", icon: "฿" },
  { href: "/stark", labelKey: "nav.stark", icon: "S" },
];

export const MORE_NAV: NavItem[] = [
  { href: "/news", labelKey: "nav.news", icon: "📰" },
  { href: "/timeline", labelKey: "nav.timeline", icon: "≡" },
  { href: "/schedule", labelKey: "nav.schedule", icon: "◷" },
  { href: "/business", labelKey: "nav.business", icon: "▣" },
  { href: "/projects", labelKey: "nav.projects", icon: "▦" },
  { href: "/goals", labelKey: "nav.goals", icon: "◎" },
  { href: "/wishlist", labelKey: "nav.wishlist", icon: "♡" },
  { href: "/portfolio", labelKey: "nav.portfolio", icon: "▲" },
  { href: "/markets", labelKey: "nav.markets", icon: "$" },
  { href: "/notes", labelKey: "nav.notes", icon: "✎" },
  { href: "/decisions", labelKey: "nav.decisions", icon: "⚖" },
  { href: "/reviews", labelKey: "nav.reviews", icon: "★" },
  { href: "/settings", labelKey: "nav.settings", icon: "⚙" },
  { href: "/backup", labelKey: "nav.backup", icon: "⇅" },
];

export const ALL_NAV = [...PRIMARY_NAV, ...MORE_NAV];
