"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { formatCurrency } from "@/lib/utils";

export default function MonthlyBarChart({ data }: {
  data: { month: string; expenses: number; income: number }[];
}) {
  if (!data?.length) return <div className="text-gray-400 text-center py-10">No data</div>;

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
        <Tooltip formatter={(value) => formatCurrency(value as number)} />
        <Legend />
        <Bar dataKey="income" fill="#22c55e" name="Income" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
