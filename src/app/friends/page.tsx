"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";

type Person = {
  person: string;
  sent: number;
  received: number;
  net_owed: number;
  txn_count: number;
  first_txn: string;
  last_txn: string;
};

export default function FriendsPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [totalSent, setTotalSent] = useState(0);
  const [totalReceived, setTotalReceived] = useState(0);
  const [filter, setFilter] = useState<"all" | "owe_me" | "i_owe">("all");

  useEffect(() => {
    fetch("/api/friends").then((r) => r.json()).then((d) => {
      setPeople(d.people);
      setTotalSent(d.totalSent);
      setTotalReceived(d.totalReceived);
    });
  }, []);

  const filtered = people.filter((p) => {
    if (filter === "owe_me") return p.net_owed > 0;
    if (filter === "i_owe") return p.net_owed < 0;
    return true;
  });

  const totalOwedToMe = people.filter((p) => p.net_owed > 0).reduce((s, p) => s + p.net_owed, 0);
  const totalIOwe = people.filter((p) => p.net_owed < 0).reduce((s, p) => s + Math.abs(p.net_owed), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Friends & Family</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4 shadow-sm text-center">
          <div className="text-xs text-gray-500 mb-1">Total Sent</div>
          <div className="text-lg font-bold text-red-600">{formatCurrency(totalSent)}</div>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm text-center">
          <div className="text-xs text-gray-500 mb-1">Total Received</div>
          <div className="text-lg font-bold text-emerald-600">{formatCurrency(totalReceived)}</div>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm text-center">
          <div className="text-xs text-gray-500 mb-1">Others Owe Me</div>
          <div className="text-lg font-bold text-blue-600">{formatCurrency(totalOwedToMe)}</div>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm text-center">
          <div className="text-xs text-gray-500 mb-1">I Owe Others</div>
          <div className="text-lg font-bold text-orange-600">{formatCurrency(totalIOwe)}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {(["all", "owe_me", "i_owe"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              filter === f ? "bg-gray-900 text-white" : "bg-white border text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f === "all" ? "All" : f === "owe_me" ? "They Owe Me" : "I Owe"}
          </button>
        ))}
        <span className="text-sm text-gray-400 ml-2">{filtered.length} people</span>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Person</th>
              <th className="text-right px-4 py-3 font-medium">Sent</th>
              <th className="text-right px-4 py-3 font-medium">Received</th>
              <th className="text-right px-4 py-3 font-medium">Net</th>
              <th className="text-center px-4 py-3 font-medium">Txns</th>
              <th className="text-left px-4 py-3 font-medium">Last Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((p) => (
              <tr key={p.person} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium">{p.person}</td>
                <td className="px-4 py-2.5 text-right text-red-600">
                  {p.sent ? formatCurrency(p.sent) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right text-emerald-600">
                  {p.received ? formatCurrency(p.received) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className={`inline-flex items-center gap-1 font-semibold ${
                    p.net_owed > 0 ? "text-blue-600" : p.net_owed < 0 ? "text-orange-600" : "text-gray-400"
                  }`}>
                    {p.net_owed > 0 && <ArrowDownLeft className="w-3 h-3" />}
                    {p.net_owed < 0 && <ArrowUpRight className="w-3 h-3" />}
                    {p.net_owed === 0 ? "Settled" : formatCurrency(Math.abs(p.net_owed))}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center text-gray-500">{p.txn_count}</td>
                <td className="px-4 py-2.5 text-gray-500">{formatDate(p.last_txn)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No transactions categorized as &quot;Family &amp; Friends&quot; yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
