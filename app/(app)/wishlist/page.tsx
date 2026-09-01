"use client";

import { Suspense } from "react";
import { Tabs, useActiveTab } from "@/components/tabs";
import { ResourceSection } from "@/components/resource-section";
import { RESOURCES } from "@/lib/resources";
import { WishlistItemsBoard } from "@/components/wishlist-items-board";
import { SavingsGoalsBoard } from "@/components/savings-goals-board";

const TABS = [
  { key: "items", label: "Wishlist" },
  { key: "goals", label: "Savings Goals" },
  { key: "contributions", label: "Contributions" },
  { key: "categories", label: "Categories" },
  { key: "prices", label: "Price History" },
];

function WishlistContent() {
  const active = useActiveTab(TABS);
  return (
    <div>
      <Tabs tabs={TABS} />
      {active === "items" && <WishlistItemsBoard />}
      {active === "goals" && <SavingsGoalsBoard />}
      {active === "contributions" && <ResourceSection resource={RESOURCES.savings_contributions} />}
      {active === "categories" && <ResourceSection resource={RESOURCES.wishlist_categories} />}
      {active === "prices" && <ResourceSection resource={RESOURCES.wishlist_price_history} />}
    </div>
  );
}

export default function WishlistPage() {
  return (
    <Suspense>
      <WishlistContent />
    </Suspense>
  );
}
