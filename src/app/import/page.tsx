"use client";

import { useState, useRef } from "react";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";
import { isCapacitor } from "@/lib/platform";

export default function ImportPage() {
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; total: number; bank?: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadMobile = async (file: File) => {
    // Dynamic imports to avoid bundling issues
    const { parseStatement } = await import("@/lib/parsers");
    const { initClientDb, importTransactions, categorizeTransactionClient, getCategoryRules } = await import("@/lib/db-client");

    const text = await file.text();
    const { bank, transactions: parsed } = parseStatement(text, file.name);

    console.log(`[import] Parsed ${parsed.length} transactions from ${bank}`);
    if (parsed.length > 0) {
      console.log(`[import] Sample parsed transaction:`, JSON.stringify(parsed[0]));
    }

    if (parsed.length === 0) {
      throw new Error("No transactions found in file");
    }

    // Initialize client database
    await initClientDb();

    // Ensure rules are loaded before categorizing
    const rules = await getCategoryRules();
    console.log(`[import] Loaded ${rules.length} rules for categorization`);

    // Categorize each transaction
    const categorizedTransactions = await Promise.all(
      parsed.map(async (t) => {
        const { category, merchant } = await categorizeTransactionClient(t.narration, t.withdrawal, t.deposit);
        return {
          ...t,
          category,
          merchant,
        };
      })
    );

    if (categorizedTransactions.length > 0) {
      console.log(`[import] Sample categorized transaction:`, JSON.stringify(categorizedTransactions[0]));
    }

    const { imported, skipped } = await importTransactions(categorizedTransactions);
    console.log(`[import] Result: ${imported} imported, ${skipped} skipped`);
    return { imported, skipped, total: parsed.length, bank };
  };

  const uploadServer = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/import", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  };

  const upload = async (file: File) => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = isCapacitor() ? await uploadMobile(file) : await uploadServer(file);
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Import Statement</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Upload a bank statement (.txt or .csv)</p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) upload(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-colors active:bg-gray-50 dark:active:bg-gray-800 ${
          dragging ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
        }`}
      >
        <Upload className="w-12 h-12 sm:w-10 sm:h-10 mx-auto text-gray-400 mb-3" />
        <p className="text-gray-600 dark:text-gray-300 font-medium text-sm sm:text-base">
          {loading ? "Processing..." : "Tap to select file"}
        </p>
        <p className="text-gray-400 dark:text-gray-500 text-xs sm:text-sm mt-2 px-2">
          HDFC, SBI, ICICI, Axis, Kotak, Yes Bank, PNB, BOB, Federal
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
          }}
        />
      </div>

      {result && (
        <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 sm:p-4 flex gap-3 items-start">
          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-emerald-800 dark:text-emerald-300 text-sm sm:text-base">
              Success{result.bank ? ` — ${result.bank}` : ""}
            </p>
            <p className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-400 mt-0.5">
              {result.imported} imported, {result.skipped} skipped
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 sm:p-4 flex gap-3 items-start">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-red-800 dark:text-red-300 text-sm sm:text-base">Import failed</p>
            <p className="text-xs sm:text-sm text-red-700 dark:text-red-400 mt-0.5 break-words">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
