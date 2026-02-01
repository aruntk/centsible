"use client";

import { useEffect, useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { formatCurrency } from "@/lib/utils";

function computeGrowth(lumpsum: number, monthly: number, annualReturn: number, stepUp: number, years: number) {
  const mr = annualReturn / 100 / 12;
  let value = lumpsum;
  let invested = lumpsum;
  let sip = monthly;
  const rows: { year: number; sip: number; invested: number; value: number }[] = [];

  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      value = (value + sip) * (1 + mr);
      invested += sip;
    }
    rows.push({ year: y, sip: Math.round(sip), invested: Math.round(invested), value: Math.round(value) });
    sip *= (1 + stepUp / 100);
  }
  return rows;
}

const fmt = (v: number) =>
  v >= 10000000 ? `₹${(v / 10000000).toFixed(1)}Cr` : v >= 100000 ? `₹${(v / 100000).toFixed(0)}L` : `₹${(v / 1000).toFixed(0)}k`;

export default function SIPCalculatorPage() {
  // SIP (equity/MF)
  const [sipLumpsum, setSipLumpsum] = useState(0);
  const [sipMonthly, setSipMonthly] = useState(10000);
  const [sipStepUp, setSipStepUp] = useState(10);
  const [sipReturn, setSipReturn] = useState(12);
  // Gold
  const [goldLumpsum, setGoldLumpsum] = useState(0);
  const [goldMonthly, setGoldMonthly] = useState(0);
  const [goldStepUp, setGoldStepUp] = useState(10);
  const [goldReturn, setGoldReturn] = useState(8);
  // Real Estate
  const [reLumpsum, setReLumpsum] = useState(0);
  const [reMonthly, setReMonthly] = useState(0);
  const [reStepUp, setReStepUp] = useState(10);
  const [reReturn, setReReturn] = useState(6);
  // Common
  const [inflation, setInflation] = useState(6);
  const [years, setYears] = useState(5);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => {
        if (d.avgMonthlyInvestment > 0) setSipMonthly(Math.round(d.avgMonthlyInvestment));
        if (d.avgMonthlyGold > 0) setGoldMonthly(Math.round(d.avgMonthlyGold));
        if (d.avgMonthlyRealEstate > 0) setReMonthly(Math.round(d.avgMonthlyRealEstate));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const sipRows = useMemo(() => computeGrowth(sipLumpsum, sipMonthly, sipReturn, sipStepUp, years), [sipLumpsum, sipMonthly, sipReturn, sipStepUp, years]);
  const goldRows = useMemo(() => computeGrowth(goldLumpsum, goldMonthly, goldReturn, goldStepUp, years), [goldLumpsum, goldMonthly, goldReturn, goldStepUp, years]);
  const reRows = useMemo(() => computeGrowth(reLumpsum, reMonthly, reReturn, reStepUp, years), [reLumpsum, reMonthly, reReturn, reStepUp, years]);

  const chartData = useMemo(() => sipRows.map((s, i) => ({
    year: `Y${s.year}`,
    "SIP (Equity)": s.value,
    "Gold": goldRows[i].value,
    "Real Estate": reRows[i].value,
    "Combined": s.value + goldRows[i].value + reRows[i].value,
  })), [sipRows, goldRows, reRows]);

  const totalInvested = (sipRows.at(-1)?.invested ?? 0) + (goldRows.at(-1)?.invested ?? 0) + (reRows.at(-1)?.invested ?? 0);
  const totalValue = (sipRows.at(-1)?.value ?? 0) + (goldRows.at(-1)?.value ?? 0) + (reRows.at(-1)?.value ?? 0);
  const inflationFactor = Math.pow(1 + inflation / 100, years);
  const realTotal = Math.round(totalValue / inflationFactor);

  if (!loaded) return <div className="text-center py-20 text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">SIP Calculator</h1>

      {/* SIP Inputs */}
      <div className="bg-white rounded-xl border p-5 shadow-sm">
        <h2 className="font-semibold text-gray-700 mb-3">Equity / Mutual Funds ({sipReturn}% return)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Lumpsum" value={sipLumpsum} onChange={setSipLumpsum} />
          <Field label="Monthly SIP" value={sipMonthly} onChange={setSipMonthly} />
          <Field label="Step-up %" value={sipStepUp} onChange={setSipStepUp} />
          <Field label="Return %" value={sipReturn} onChange={setSipReturn} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gold Inputs */}
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <h2 className="font-semibold text-yellow-700 mb-3">Gold ({goldReturn}% return)</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Lumpsum" value={goldLumpsum} onChange={setGoldLumpsum} />
            <Field label="Monthly" value={goldMonthly} onChange={setGoldMonthly} />
            <Field label="Step-up %" value={goldStepUp} onChange={setGoldStepUp} />
            <Field label="Return %" value={goldReturn} onChange={setGoldReturn} />
          </div>
        </div>

        {/* Real Estate Inputs */}
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <h2 className="font-semibold text-amber-800 mb-3">Real Estate ({reReturn}% return)</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Lumpsum" value={reLumpsum} onChange={setReLumpsum} />
            <Field label="Monthly" value={reMonthly} onChange={setReMonthly} />
            <Field label="Step-up %" value={reStepUp} onChange={setReStepUp} />
            <Field label="Return %" value={reReturn} onChange={setReReturn} />
          </div>
        </div>
      </div>

      {/* Common Inputs */}
      <div className="bg-white rounded-xl border p-5 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-2 gap-4 max-w-md">
          <Field label="Inflation %" value={inflation} onChange={setInflation} />
          <Field label="Duration (years)" value={years} onChange={(v) => setYears(Math.max(1, v))} />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="Total Invested" value={totalInvested} color="text-gray-800" />
        <Card label="SIP (Equity)" value={sipRows.at(-1)?.value ?? 0} sub={`Invested: ${formatCurrency(sipRows.at(-1)?.invested ?? 0)}`} color="text-emerald-600" />
        <Card label="Gold" value={goldRows.at(-1)?.value ?? 0} sub={`Invested: ${formatCurrency(goldRows.at(-1)?.invested ?? 0)}`} color="text-yellow-600" />
        <Card label="Real Estate" value={reRows.at(-1)?.value ?? 0} sub={`Invested: ${formatCurrency(reRows.at(-1)?.invested ?? 0)}`} color="text-amber-700" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card label="Combined Nominal" value={totalValue} sub={`Gain: ${formatCurrency(totalValue - totalInvested)}`} color="text-emerald-600" />
        <Card label="Combined Real (today's ₹)" value={realTotal} sub={`After ${inflation}% inflation`} color="text-blue-600" />
        <Card label="Wealth Multiplier" value={0} color="text-purple-600" custom={`${(totalValue / Math.max(totalInvested, 1)).toFixed(1)}x`} />
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border p-5 shadow-sm">
        <h2 className="font-semibold text-gray-700 mb-3">Growth Projection</h2>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={fmt} />
            <Tooltip formatter={(value) => formatCurrency(value as number)} />
            <Legend />
            <Area type="monotone" dataKey="SIP (Equity)" stroke="#22c55e" fill="#dcfce7" stackId="a" />
            <Area type="monotone" dataKey="Gold" stroke="#ca8a04" fill="#fef9c3" stackId="a" />
            <Area type="monotone" dataKey="Real Estate" stroke="#92400e" fill="#fde68a" stackId="a" />
            <Area type="monotone" dataKey="Combined" stroke="#7c3aed" fill="none" strokeDasharray="5 5" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b">
          <h2 className="font-semibold text-gray-700">Year-by-Year Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Year</th>
                <th className="text-right px-3 py-2 font-medium">SIP/mo</th>
                <th className="text-right px-3 py-2 font-medium">Equity Value</th>
                <th className="text-right px-3 py-2 font-medium">Gold/mo</th>
                <th className="text-right px-3 py-2 font-medium">Gold Value</th>
                <th className="text-right px-3 py-2 font-medium">RE/mo</th>
                <th className="text-right px-3 py-2 font-medium">RE Value</th>
                <th className="text-right px-3 py-2 font-medium">Combined</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sipRows.map((s, i) => (
                <tr key={s.year} className="hover:bg-gray-50">
                  <td className="px-3 py-2">{s.year}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(s.sip)}</td>
                  <td className="px-3 py-2 text-right text-emerald-600">{formatCurrency(s.value)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(goldRows[i].sip)}</td>
                  <td className="px-3 py-2 text-right text-yellow-600">{formatCurrency(goldRows[i].value)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(reRows[i].sip)}</td>
                  <td className="px-3 py-2 text-right text-amber-700">{formatCurrency(reRows[i].value)}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatCurrency(s.value + goldRows[i].value + reRows[i].value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs text-gray-500 block mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full border rounded-lg px-3 py-2 text-sm"
      />
    </div>
  );
}

function Card({ label, value, sub, color, custom }: { label: string; value: number; sub?: string; color: string; custom?: string }) {
  return (
    <div className="bg-white rounded-xl border p-5 shadow-sm text-center">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{custom ?? formatCurrency(value)}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}
