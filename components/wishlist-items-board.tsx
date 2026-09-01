"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { RESOURCES } from "@/lib/resources";
import { ResourceForm } from "@/components/resource-form";
import { Btn, Card, EmptyState, SectionHead, Sheet } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { markWishlistItemPurchased } from "@/lib/wishlist-actions";

type WishlistItem = {
  id: string;
  name: string;
  status: string;
  target_price: number | null;
  current_estimated_price: number | null;
  currency: string | null;
};
type Account = { id: string; name: string };

export function WishlistItemsBoard() {
  const [items, setItems] = useState<WishlistItem[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editing, setEditing] = useState<WishlistItem | null | "new">(null);
  const [purchasing, setPurchasing] = useState<WishlistItem | null>(null);
  const [price, setPrice] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: wi }, { data: acc }] = await Promise.all([
      supabase
        .from("wishlist_items")
        .select("id, name, status, target_price, current_estimated_price, currency")
        .is("archived_at", null)
        .order("position", { ascending: true }),
      supabase.from("financial_accounts").select("id, name").is("archived_at", null),
    ]);
    setItems(wi || []);
    setAccounts(acc || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmPurchase() {
    if (!purchasing) return;
    setBusy(true);
    setError(null);
    const result = await markWishlistItemPurchased(purchasing, {
      price: Number(price || purchasing.target_price || 0),
      accountId: accountId || null,
      date,
    });
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setPurchasing(null);
    setPrice("");
    setAccountId("");
    load();
  }

  return (
    <div>
      <SectionHead
        title="Wishlist"
        action={
          <Btn variant="gold" onClick={() => setEditing("new")}>
            ＋ Item
          </Btn>
        }
      />
      <Card>
        {items === null && <EmptyState label="Loading…" />}
        {items !== null && items.length === 0 && <EmptyState label="Wishlist is empty." />}
        {items?.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0">
            <button className="flex-1 text-left" onClick={() => setEditing(item)}>
              <b className="block text-sm">{item.name}</b>
              <small className="text-muted">
                {formatMoney(item.current_estimated_price ?? item.target_price, item.currency || "THB")} ·{" "}
                {item.status}
              </small>
            </button>
            {item.status !== "purchased" ? (
              <Btn
                variant="gold"
                onClick={() => {
                  setPurchasing(item);
                  setPrice(String(item.target_price ?? item.current_estimated_price ?? ""));
                }}
              >
                Mark Purchased
              </Btn>
            ) : (
              <span className="rounded-full bg-green/10 px-2 py-1 text-[10px] uppercase text-green">Purchased</span>
            )}
          </div>
        ))}
      </Card>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "New Wishlist Item" : "Edit Wishlist Item"}
      >
        <ResourceForm
          resource={RESOURCES.wishlist_items}
          existing={editing && editing !== "new" ? editing : null}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      </Sheet>

      <Sheet open={purchasing !== null} onClose={() => setPurchasing(null)} title="Mark as Purchased">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] text-muted">Actual price paid</label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-muted">Paid from account</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
            >
              <option value="">None</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-muted">Purchase date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
            />
          </div>
          {error && <div className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red">{error}</div>}
          <p className="text-xs text-muted">
            This will create an expense transaction and link it to this item.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Btn onClick={() => setPurchasing(null)}>Cancel</Btn>
            <Btn variant="gold" disabled={busy} onClick={confirmPurchase}>
              {busy ? "Saving…" : "Confirm Purchase"}
            </Btn>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
