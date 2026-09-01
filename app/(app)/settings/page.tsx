"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/supabase/useUser";
import { Btn, Card, SectionHead } from "@/components/ui";

type Profile = { display_name: string | null; currency: string; timezone: string; start_of_week: string };

export default function SettingsPage() {
  const { user } = useUser();
  const [profile, setProfile] = useState<Profile>({
    display_name: "",
    currency: "THB",
    timezone: "Asia/Bangkok",
    start_of_week: "monday",
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("display_name, currency, timezone, start_of_week")
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProfile(data as Profile);
      });
  }, []);

  async function save() {
    setBusy(true);
    setSaved(false);
    const supabase = createClient();
    await supabase.from("profiles").upsert({ id: user?.id, ...profile } as any);
    setBusy(false);
    setSaved(true);
  }

  return (
    <div>
      <SectionHead title="Settings" subtitle={user?.email || undefined} />
      <Card className="space-y-3">
        <div>
          <label className="mb-1 block text-[11px] text-muted">Display name</label>
          <input
            value={profile.display_name || ""}
            onChange={(e) => setProfile((p) => ({ ...p, display_name: e.target.value }))}
            className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted">Currency</label>
          <input
            value={profile.currency || ""}
            onChange={(e) => setProfile((p) => ({ ...p, currency: e.target.value }))}
            className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted">Timezone</label>
          <input
            value={profile.timezone || ""}
            onChange={(e) => setProfile((p) => ({ ...p, timezone: e.target.value }))}
            className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted">Start of week</label>
          <select
            value={profile.start_of_week}
            onChange={(e) => setProfile((p) => ({ ...p, start_of_week: e.target.value }))}
            className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
          >
            <option value="sunday">Sunday</option>
            <option value="monday">Monday</option>
          </select>
        </div>
        <Btn variant="gold" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Btn>
        {saved && <span className="ml-3 text-sm text-green">Saved.</span>}
      </Card>
    </div>
  );
}
