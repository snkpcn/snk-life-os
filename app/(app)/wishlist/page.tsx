"use client";

import { Suspense } from "react";
import { Tabs, useActiveTab } from "@/components/tabs";
import { ResourceSection } from "@/components/resource-section";
import { RESOURCES } from "@/lib/resources";
import { WishlistItemsBoard } from "@/components/wishlist-items-board";
import { SavingsGoalsBoard } from "@/components/savings-goals-board";
import { useI18n } from "@/lib/i18n/context";

function WishlistContent() {
  const { t } = useI18n();
  const TABS = [
    { key: "items", label: t("wishlistPage.items") },
    { key: "goals", label: t("wishlistPage.goals") },
    { key: "contributions", label: t("wishlistPage.contributions") },
    { key: "categories", label: t("wishlistPage.categories") },
    { key: "prices", label: t("wishlistPage.prices") },
  ];
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
