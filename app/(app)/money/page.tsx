"use client";

import { Suspense, useState } from "react";
import { Tabs, useActiveTab } from "@/components/tabs";
import { MoneyStats } from "@/components/money-stats";
import { ResourceSection } from "@/components/resource-section";
import { RESOURCES } from "@/lib/resources";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "accounts", label: "Accounts" },
  { key: "transactions", label: "Transactions" },
  { key: "budgets", label: "Budgets" },
  { key: "assets", label: "Assets" },
  { key: "debts", label: "Debts" },
  { key: "recurring", label: "Recurring" },
  { key: "categories", label: "Categories" },
];

function MoneyContent() {
  const active = useActiveTab(TABS);
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <div>
      <Tabs tabs={TABS} />
      {active === "overview" && (
        <>
          <MoneyStats refreshKey={refreshKey} />
          <ResourceSection resource={RESOURCES.transactions} limit={10} onChange={bump} />
        </>
      )}
      {active === "accounts" && <ResourceSection resource={RESOURCES.financial_accounts} onChange={bump} />}
      {active === "transactions" && <ResourceSection resource={RESOURCES.transactions} onChange={bump} />}
      {active === "budgets" && <ResourceSection resource={RESOURCES.budgets} onChange={bump} />}
      {active === "assets" && <ResourceSection resource={RESOURCES.assets} onChange={bump} />}
      {active === "debts" && <ResourceSection resource={RESOURCES.debts} onChange={bump} />}
      {active === "recurring" && <ResourceSection resource={RESOURCES.recurring_transactions} onChange={bump} />}
      {active === "categories" && <ResourceSection resource={RESOURCES.transaction_categories} onChange={bump} />}
    </div>
  );
}

export default function MoneyPage() {
  return (
    <Suspense>
      <MoneyContent />
    </Suspense>
  );
}
