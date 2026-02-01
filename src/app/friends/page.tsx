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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Friends & Family</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-4 shadow-sm text-center">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Sent</div>
          <div className="text-lg font-bold text-red-600 dark:text-red-400">{formatCurrency(totalSent)}</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-4 shadow-sm text-center">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Received</div>
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalReceived)}</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-4 shadow-sm text-center">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Others Owe Me</div>
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalOwedToMe)}</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-4 shadow-sm text-center">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">I Owe Others</div>
          <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{formatCurrency(totalIOwe)}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {(["all", "owe_me", "i_owe"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              filter === f
                ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                : "bg-white dark:bg-gray-900 border dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
          >
            {f === "all" ? "All" : f === "owe_me" ? "They Owe Me" : "I Owe"}
          </button>
        ))}
        <span className="text-sm text-gray-400 ml-2">{filtered.length} people</span>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Person</th>
              <th className="text-right px-4 py-3 font-medium">Sent</th>
              <th className="text-right px-4 py-3 font-medium">Received</th>
              <th className="text-right px-4 py-3 font-medium">Net</th>
              <th className="text-center px-4 py-3 font-medium">Txns</th>
              <th className="text-left px-4 py-3 font-medium">Last Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-800">
            {filtered.map((p) => (
              <tr key={p.person} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-2.5 font-medium">{p.person}</td>
                <td className="px-4 py-2.5 text-right text-red-600 dark:text-red-400">
                  {p.sent ? formatCurrency(p.sent) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right text-emerald-600 dark:text-emerald-400">
                  {p.received ? formatCurrency(p.received) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className={`inline-flex items-center gap-1 font-semibold ${
                    p.net_owed > 0 ? "text-blue-600 dark:text-blue-400" : p.net_owed < 0 ? "text-orange-600 dark:text-orange-400" : "text-gray-400"
                  }`}>
                    {p.net_owed > 0 && <ArrowDownLeft className="w-3 h-3" />}
                    {p.net_owed < 0 && <ArrowUpRight className="w-3 h-3" />}
                    {p.net_owed === 0 ? "Settled" : formatCurrency(Math.abs(p.net_owed))}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center text-gray-500 dark:text-gray-400">{p.txn_count}</td>
                <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{formatDate(p.last_txn)}</td>
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
