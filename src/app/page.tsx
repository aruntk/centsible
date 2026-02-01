"use client";

import { useEffect, useState, useCallback } from "react";
import DashboardCards from "@/components/DashboardCards";
import CategoryPieChart from "@/components/CategoryPieChart";
import MonthlyBarChart from "@/components/MonthlyBarChart";
import SpendingTrend from "@/components/SpendingTrend";
import InvestmentBarChart from "@/components/InvestmentBarChart";
import { formatCurrency } from "@/lib/utils";

type Analytics = {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  byCategory: { category: string; total: number; count: number }[];
  byMonth: { month: string; expenses: number; income: number }[];
  topMerchants: { merchant: string; total: number; count: number }[];
  dailySpending: { date: string; total: number }[];
  investmentByMonth: { month: string; total: number }[];
  avgMonthlyInvestment: number;
};

// Indian financial years: April to March
function getFYOptions(): { label: string; from: string; to: string }[] {
  const now = new Date();
  const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const options: { label: string; from: string; to: string }[] = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    options.push({
      label: `FY ${y}-${String(y + 1).slice(2)}`,
      from: `${y}-04-01`,
      to: `${y + 1}-03-31`,
    });
  }
  return options;
}

const FY_OPTIONS = getFYOptions();

export default function DashboardPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [preset, setPreset] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (preset === "custom") {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    } else if (preset !== "all") {
      const fy = FY_OPTIONS.find((f) => f.label === preset);
      if (fy) {
        params.set("from", fy.from);
        params.set("to", fy.to);
      }
    }
    fetch(`/api/analytics?${params}`).then((r) => r.json()).then(setData);
  }, [preset, from, to]);

  useEffect(() => { load(); }, [load]);

  if (!data) return <div className="text-center py-20 text-gray-400">Loading...</div>;

  if (data.totalIncome === 0 && data.totalExpenses === 0 && preset === "all") {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 dark:text-gray-400 text-lg">No transactions yet.</p>
        <a href="/import" className="text-blue-600 dark:text-blue-400 underline mt-2 inline-block">Import a bank statement</a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            className="border dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="all">All Time</option>
            {FY_OPTIONS.map((fy) => (
              <option key={fy.label} value={fy.label}>{fy.label}</option>
            ))}
            <option value="custom">Custom Range</option>
          </select>
          {preset === "custom" && (
            <>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="border dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-200"
              />
              <span className="text-sm text-gray-400">to</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="border dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-200"
              />
            </>
          )}
        </div>
      </div>

      <DashboardCards totalIncome={data.totalIncome} totalExpenses={data.totalExpenses} balance={data.balance} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Spending by Category</h2>
          <CategoryPieChart data={data.byCategory} />
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Monthly Income vs Expenses</h2>
          <MonthlyBarChart data={data.byMonth} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Weekly Spending Trend</h2>
          <SpendingTrend data={data.dailySpending} />
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Investments per Month</h2>
          <InvestmentBarChart data={data.investmentByMonth} />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-5 shadow-sm">
        <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Top Merchants</h2>
        <div className="divide-y dark:divide-gray-800">
          {data.topMerchants.map((m, i) => (
            <div key={i} className="flex items-center justify-between py-2.5">
              <div>
                <span className="font-medium text-gray-800 dark:text-gray-200">{m.merchant}</span>
                <span className="text-gray-400 text-sm ml-2">({m.count} txns)</span>
              </div>
              <span className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(m.total)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
