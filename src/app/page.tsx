"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import DashboardCards from "@/components/DashboardCards";
import CategoryPieChart from "@/components/CategoryPieChart";
import MonthlyBarChart from "@/components/MonthlyBarChart";
import SpendingTrend from "@/components/SpendingTrend";
import InvestmentBarChart from "@/components/InvestmentBarChart";
import TimeFilter from "@/components/TimeFilter";
import { useTimeFilter } from "@/hooks/useTimeFilter";
import { formatCurrency } from "@/lib/utils";

type Analytics = {
  totalIncome: number;
  totalExpenses: number;
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
  const { preset, apiParams } = useTimeFilter();
  const [data, setData] = useState<Analytics | null>(null);

  const load = useCallback(() => {
    fetch(`/api/analytics?${apiParams}`).then((r) => r.json()).then(setData);
  }, [apiParams]);

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
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Current Balance:</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(data.currentBalance)}</span>
          </div>
        </div>
        <TimeFilter />
      </div>

      <DashboardCards
        totalIncome={data.totalIncome}
        totalExpenses={data.totalExpenses}
        balance={data.balance}
        openingBalance={data.openingBalance}
        closingBalance={data.closingBalance}
      />

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

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-400">Loading...</div>}>
      <DashboardInner />
    </Suspense>
  );
}
