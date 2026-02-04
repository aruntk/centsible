"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import DashboardCards from "@/components/DashboardCards";
import CategoryPieChart from "@/components/CategoryPieChart";
import MonthlyBarChart from "@/components/MonthlyBarChart";
import SpendingTrend from "@/components/SpendingTrend";
import InvestmentBarChart from "@/components/InvestmentBarChart";
import TimeFilter from "@/components/TimeFilter";
import { useTimeFilter } from "@/hooks/useTimeFilter";
import { formatCurrency } from "@/lib/utils";
import { isCapacitor } from "@/lib/platform";

type Analytics = {
  totalIncome: number;
  totalExpenses: number;
  totalInvestments: number;
  totalLoans: number;
  balance: number;
  openingBalance: number;
  closingBalance: number;
  currentBalance: number;
  byCategory: { category: string; total: number; count: number }[];
  byMonth: { month: string; expenses: number; income: number }[];
  topMerchants: { merchant: string; total: number; count: number }[];
  dailySpending: { date: string; total: number }[];
  investmentByMonth: { month: string; total: number }[];
  avgMonthlyInvestment: number;
};

function DashboardInner() {
  const { preset, apiParams, effectiveFrom, effectiveTo } = useTimeFilter();
  const [data, setData] = useState<Analytics | null>(null);

  const load = useCallback(async () => {
    if (isCapacitor()) {
      // Mobile: use client-side database
      const { initClientDb, getFullAnalytics } = await import("@/lib/db-client");
      await initClientDb();
      const analytics = await getFullAnalytics(effectiveFrom || undefined, effectiveTo || undefined);
      setData(analytics);
    } else {
      // Desktop: use API
      const res = await fetch(`/api/analytics?${apiParams}`);
      const json = await res.json();
      setData(json);
    }
  }, [apiParams, effectiveFrom, effectiveTo]);

  useEffect(() => { load(); }, [load]);

  if (!data) return <div className="text-center py-20 text-gray-400">Loading...</div>;

  if (data.totalIncome === 0 && data.totalExpenses === 0 && preset === "all") {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 dark:text-gray-400 text-lg">No transactions yet.</p>
        <Link href="/import" className="text-blue-600 dark:text-blue-400 underline mt-2 inline-block">Import a bank statement</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-3 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Balance:</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(data.currentBalance)}</span>
          </div>
        </div>
        <TimeFilter />
      </div>

      <DashboardCards
        totalIncome={data.totalIncome}
        totalExpenses={data.totalExpenses}
        totalInvestments={data.totalInvestments}
        totalLoans={data.totalLoans}
        openingBalance={data.openingBalance}
        closingBalance={data.closingBalance}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-3 sm:p-5 shadow-sm">
          <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 sm:mb-3 text-sm sm:text-base">Spending by Category</h2>
          <CategoryPieChart data={data.byCategory} />
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-3 sm:p-5 shadow-sm">
          <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 sm:mb-3 text-sm sm:text-base">Monthly Income vs Expenses</h2>
          <MonthlyBarChart data={data.byMonth} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-3 sm:p-5 shadow-sm">
          <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 sm:mb-3 text-sm sm:text-base">Weekly Spending Trend</h2>
          <SpendingTrend data={data.dailySpending} />
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-3 sm:p-5 shadow-sm">
          <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 sm:mb-3 text-sm sm:text-base">Investments per Month</h2>
          <InvestmentBarChart data={data.investmentByMonth} />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-3 sm:p-5 shadow-sm">
        <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 sm:mb-3 text-sm sm:text-base">Top Merchants</h2>
        <div className="divide-y dark:divide-gray-800">
          {data.topMerchants.map((m, i) => (
            <div key={i} className="flex items-center justify-between py-2 sm:py-2.5 gap-2">
              <div className="min-w-0 flex-1">
                <span className="font-medium text-gray-800 dark:text-gray-200 text-sm sm:text-base truncate block">{m.merchant}</span>
                <span className="text-gray-400 text-xs sm:text-sm">({m.count} txns)</span>
              </div>
              <span className="font-semibold text-red-600 dark:text-red-400 text-sm sm:text-base shrink-0">{formatCurrency(m.total)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-400">Loading...</div>}>
      <DashboardInner />
    </Suspense>
  );
}
