import { createClient } from "@/lib/supabase/client";

export async function markWishlistItemPurchased(
  item: { id: string; name: string; currency?: string | null },
  opts: { price: number; accountId: string | null; date: string }
) {
  const supabase = createClient();

  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .insert({
      type: "expense",
      amount: opts.price,
      currency: item.currency || "THB",
      account_id: opts.accountId,
      description: `Wishlist purchase: ${item.name}`,
      occurred_at: opts.date,
    })
    .select("id")
    .single();

  if (txError || !tx) return { error: txError?.message || "Could not record transaction" };

  const { error: updateError } = await supabase
    .from("wishlist_items")
    .update({
      status: "purchased",
      purchased_at: opts.date,
      purchased_transaction_id: tx.id,
    })
    .eq("id", item.id);

  if (updateError) return { error: updateError.message };
  return { error: null };
}

export function computeSavingsBalance(
  contributions: { amount: number; entry_type: string }[]
) {
  return contributions.reduce((sum, c) => {
    return c.entry_type === "withdrawal" ? sum - Number(c.amount) : sum + Number(c.amount);
  }, 0);
}
