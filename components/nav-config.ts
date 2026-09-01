export type NavItem = { href: string; label: string; icon: string };

export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Today", icon: "⌂" },
  { href: "/tasks", label: "Tasks", icon: "✓" },
  { href: "/money", label: "Money", icon: "฿" },
  { href: "/stark", label: "Stark", icon: "S" },
];

export const MORE_NAV: NavItem[] = [
  { href: "/timeline", label: "Timeline", icon: "≡" },
  { href: "/schedule", label: "Schedule", icon: "◷" },
  { href: "/business", label: "Business OS", icon: "▣" },
  { href: "/projects", label: "Projects", icon: "▦" },
  { href: "/goals", label: "Goals", icon: "◎" },
  { href: "/wishlist", label: "Wishlist & Savings", icon: "♡" },
  { href: "/portfolio", label: "Portfolio", icon: "▲" },
  { href: "/markets", label: "Markets", icon: "$" },
  { href: "/notes", label: "Notes", icon: "✎" },
  { href: "/decisions", label: "Decisions", icon: "⚖" },
  { href: "/reviews", label: "Reviews", icon: "★" },
  { href: "/settings", label: "Settings", icon: "⚙" },
  { href: "/backup", label: "Backup & Import", icon: "⇅" },
];

export const ALL_NAV = [...PRIMARY_NAV, ...MORE_NAV];
