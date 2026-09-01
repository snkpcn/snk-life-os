"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PRIMARY_NAV, MORE_NAV } from "@/components/nav-config";
import { Sheet } from "@/components/ui";
import { CommandPalette } from "@/components/command-palette";
import { QuickAdd } from "@/components/quick-add";
import { createClient } from "@/lib/supabase/client";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl pb-28">
      <header className="safe-top sticky top-0 z-40 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-3 backdrop-blur">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.19em] text-gold">
            Executive Command Center
          </div>
          <div className="text-xl font-extrabold tracking-tight">SNK LIFE OS</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            className="grid h-10 w-10 place-items-center rounded-full border border-line bg-panel text-ink"
          >
            ⌕
          </button>
          <button
            onClick={() => setAddOpen(true)}
            aria-label="Quick add"
            className="grid h-10 w-10 place-items-center rounded-full border border-line bg-panel text-xl text-ink"
          >
            ＋
          </button>
        </div>
      </header>

      <main className="px-4 py-4">{children}</main>

      <nav className="safe-bottom fixed bottom-3 left-1/2 z-40 flex w-[min(560px,calc(100%-24px))] -translate-x-1/2 gap-1 rounded-3xl border border-line bg-panel/95 p-1.5 shadow-2xl backdrop-blur">
        {PRIMARY_NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-[58px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-bold ${
                active ? "bg-panel2 text-gold" : "text-muted"
              }`}
            >
              <span
                className={`text-lg ${item.icon === "S" ? "flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-gold to-goldDark text-xs font-black text-[#17130c]" : ""}`}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex min-h-[58px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-bold text-muted"
        >
          <span className="text-lg">⋯</span>
          More
        </button>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More" wide>
        <div className="grid grid-cols-3 gap-2">
          {MORE_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center text-xs font-semibold ${
                pathname === item.href ? "border-gold text-gold" : "border-line text-ink"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {item.label}
            </Link>
          ))}
          <button
            onClick={handleSignOut}
            className="flex flex-col items-center gap-2 rounded-xl border border-red/30 p-4 text-center text-xs font-semibold text-red"
          >
            <span className="text-xl">⏻</span>
            Log out
          </button>
        </div>
      </Sheet>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <QuickAdd open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
