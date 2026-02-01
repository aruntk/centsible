"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatCurrency } from "@/lib/utils";

export default function SpendingTrend({ data }: {
  data: { date: string; total: number }[];
}) {
  if (!data?.length) return <div className="text-gray-400 text-center py-10">No data</div>;

  // Aggregate by week for readability
  const weekly: { week: string; total: number }[] = [];
  let accum = 0;
  let weekStart = data[0]?.date;
  let count = 0;

  for (const d of data) {
    accum += d.total;
    count++;
    if (count >= 7) {
      weekly.push({ week: weekStart, total: accum });
      accum = 0;
      weekStart = d.date;
      count = 0;
    }
  }
  if (count > 0) weekly.push({ week: weekStart, total: accum });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={weekly}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
        <Tooltip formatter={(value) => formatCurrency(value as number)} />
        <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
