"use client";

import { Suspense, useEffect, useState, useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, type ColDef, type CellValueChangedEvent, themeQuartz, colorSchemeDark, colorSchemeLight } from "ag-grid-community";
import { formatCurrency, formatDate } from "@/lib/utils";
import { writeFileToDocuments } from "@/lib/file-picker";
import SelectionRulePopover from "@/components/SelectionRulePopover";
import TimeFilter from "@/components/TimeFilter";
import { useTimeFilter } from "@/hooks/useTimeFilter";
import { Plus, ChevronUp, Upload, Download } from "lucide-react";
import { isCapacitor } from "@/lib/platform";

ModuleRegistry.registerModules([AllCommunityModule]);

function subscribeTheme(cb: () => void) {
  const observer = new MutationObserver(cb);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
function getIsDark() {
  return document.documentElement.classList.contains("dark");
}

type Transaction = {
  id: number;
  date: string;
  narration: string;
  ref_no: string;
  withdrawal: number;
  deposit: number;
  closing_balance: number;
  category: string;
  merchant: string;
};

const CATEGORIES = [
  "Food & Dining", "Shopping", "Transport", "Bills & Utilities",
  "Transfers", "Salary/Income", "Entertainment", "Health", "Education",
  "ATM Withdrawal", "Credit Card", "Taxes & Charges", "Investments",
  "Vices", "Subscriptions", "Family & Friends", "Loans", "Grocery", "Real Estate", "CCBILL", "Gold", "Car", "Fraud", "Travel", "Other",
];

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  narration: "",
  merchant: "",
  withdrawal: "",
  deposit: "",
  category: "Other",
};

function TransactionsInner() {
  const isDark = useSyncExternalStore(subscribeTheme, getIsDark, () => false);
  const gridTheme = useMemo(
    () => themeQuartz.withPart(isDark ? colorSchemeDark : colorSchemeLight),
    [isDark]
  );
  const { apiParams } = useTimeFilter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balanceData, setBalanceData] = useState<{ openingBalance: number; closingBalance: number } | null>(null);
  const gridRef = useRef<AgGridReact>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [importResult, setImportResult] = useState("");
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobileView(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const load = useCallback(async () => {
    const isMobile = isCapacitor();
    if (isMobile) {
      // Mobile: use client-side database
      const { initClientDb, getTransactions, getFullAnalytics } = await import("@/lib/db-client");
      await initClientDb();

      // Parse from/to from apiParams
      const fromDate = apiParams.get("from") || undefined;
      const toDate = apiParams.get("to") || undefined;

      const txResult = await getTransactions({ from: fromDate, to: toDate, limit: 10000 });
      setTransactions(txResult.transactions);

      const analytics = await getFullAnalytics(fromDate, toDate);
      setBalanceData({ openingBalance: analytics.openingBalance, closingBalance: analytics.closingBalance });
    } else {
      // Desktop: use API
      const txParams = new URLSearchParams(apiParams);
      txParams.set("limit", "10000");
      fetch(`/api/transactions?${txParams}`)
        .then((r) => r.json())
        .then((d) => setTransactions(d.transactions));
      fetch(`/api/analytics?${apiParams}`)
        .then((r) => r.json())
        .then((d) => setBalanceData({ openingBalance: d.openingBalance, closingBalance: d.closingBalance }));
    }
  }, [apiParams]);

  useEffect(() => { load(); }, [load]);

  const addTransaction = async () => {
    if (!form.date || !form.narration.trim()) return;
    if (isCapacitor()) {
      const { initClientDb, createTransaction } = await import("@/lib/db-client");
      await initClientDb();
      await createTransaction({
        date: form.date,
        narration: form.narration.trim(),
        merchant: form.merchant.trim(),
        withdrawal: form.withdrawal ? Number(form.withdrawal) : 0,
        deposit: form.deposit ? Number(form.deposit) : 0,
        category: form.category,
        ref_no: "",
        value_date: form.date,
        closing_balance: 0,
      });
    } else {
      await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          narration: form.narration.trim(),
          merchant: form.merchant.trim(),
          withdrawal: form.withdrawal ? Number(form.withdrawal) : 0,
          deposit: form.deposit ? Number(form.deposit) : 0,
          category: form.category,
        }),
      });
    }
    setForm(emptyForm);
    setShowForm(false);
    load();
  };

  const [exportStatus, setExportStatus] = useState("");

  const exportTransactions = async () => {
    const header = "Date,Narration,Merchant,Withdrawal,Deposit,Closing Balance,Category,Ref No\n";
    const rows = transactions.map((t) =>
      [t.date, `"${(t.narration || "").replace(/"/g, '""')}"`, `"${(t.merchant || "").replace(/"/g, '""')}"`, t.withdrawal || 0, t.deposit || 0, t.closing_balance || 0, t.category || "", t.ref_no || ""].join(",")
    ).join("\n");
    const fileName = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    const success = await writeFileToDocuments(fileName, header + rows);
    if (success) {
      setExportStatus(`Exported to ${fileName}`);
      setTimeout(() => setExportStatus(""), 3000);
    } else {
      setExportStatus("Export failed");
    }
  };

  const downloadTemplate = async () => {
    const csv = "Date,Narration,Merchant,Withdrawal,Deposit,Closing Balance,Category,Ref No\n2025-01-15,Swiggy Order,Swiggy,450,0,50000,Food & Dining,\n2025-01-16,Salary Credit,,0,100000,150000,Salary/Income,REF123\n";
    const success = await writeFileToDocuments("transactions-template.csv", csv);
    if (success) {
      setExportStatus("Template saved");
      setTimeout(() => setExportStatus(""), 3000);
    } else {
      setExportStatus("Download failed");
    }
  };

  const importCSVMobile = async (file: File) => {
    const { parseCSVLine } = await import("@/lib/parsers/utils");
    const { initClientDb, importTransactions, categorizeTransactionClient } = await import("@/lib/db-client");

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      throw new Error("CSV must have a header row and at least one data row");
    }

    const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));

    const colMap: Record<string, number> = {};
    const aliases: Record<string, string[]> = {
      date: ["date", "txn date", "transaction date", "trans date"],
      narration: ["narration", "description", "particulars", "details", "remarks", "memo"],
      withdrawal: ["withdrawal", "debit", "withdrawal amt", "debit amount", "amount debited"],
      deposit: ["deposit", "credit", "deposit amt", "credit amount", "amount credited"],
      closing_balance: ["closing balance", "balance", "closing bal"],
      category: ["category", "cat"],
      merchant: ["merchant", "payee"],
      ref_no: ["ref no", "reference", "ref", "reference no", "cheque no", "chq no"],
    };

    for (const [field, names] of Object.entries(aliases)) {
      const idx = header.findIndex((h) => names.includes(h));
      if (idx !== -1) colMap[field] = idx;
    }

    if (!("date" in colMap) || !("narration" in colMap)) {
      throw new Error("CSV must have at least 'Date' and 'Narration' columns");
    }

    await initClientDb();

    const transactions = [];
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const date = cols[colMap.date] ?? "";
      const narration = cols[colMap.narration] ?? "";
      if (!date || !narration) {
        skipped++;
        continue;
      }

      const withdrawal = colMap.withdrawal !== undefined ? parseFloat(cols[colMap.withdrawal]) || 0 : 0;
      const deposit = colMap.deposit !== undefined ? parseFloat(cols[colMap.deposit]) || 0 : 0;
      const closingBalance = colMap.closing_balance !== undefined ? parseFloat(cols[colMap.closing_balance]) || 0 : 0;
      const refNo = colMap.ref_no !== undefined ? cols[colMap.ref_no] || "" : "";

      let category = colMap.category !== undefined ? cols[colMap.category] || "" : "";
      let merchant = colMap.merchant !== undefined ? cols[colMap.merchant] || "" : "";

      if (!category) {
        const auto = await categorizeTransactionClient(narration, withdrawal, deposit);
        category = auto.category;
        if (!merchant) merchant = auto.merchant;
      }

      transactions.push({
        date,
        narration,
        ref_no: refNo,
        value_date: date,
        withdrawal,
        deposit,
        closing_balance: closingBalance,
        category,
        merchant,
      });
    }

    const { imported, skipped: dupSkipped } = await importTransactions(transactions);
    return { imported, skipped: skipped + dupSkipped, total: lines.length - 1 };
  };

  const importCSV = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setImportResult("Processing...");
      try {
        let data;
        if (isCapacitor()) {
          data = await importCSVMobile(file);
        } else {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/transactions/import-csv", { method: "POST", body: fd });
          data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "Import failed");
          }
        }
        setImportResult(`Imported ${data.imported}, skipped ${data.skipped} of ${data.total} rows`);
        load();
      } catch (err) {
        setImportResult(err instanceof Error ? err.message : "Import failed");
      }
    };
    input.click();
  };

  const onCategoryChanged = useCallback(async (event: CellValueChangedEvent) => {
    if (event.colDef.field === "category" && event.newValue !== event.oldValue) {
      if (isCapacitor()) {
        const { initClientDb, updateTransaction } = await import("@/lib/db-client");
        await initClientDb();
        await updateTransaction(event.data.id, { category: event.newValue });
      } else {
        await fetch(`/api/transactions/${event.data.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: event.newValue }),
        });
      }
    }
  }, [isCapacitor()]);

  const columnDefs = useMemo<ColDef<Transaction>[]>(() => [
    {
      field: "date",
      headerName: "Date",
      width: isMobileView ? 90 : 130,
      valueFormatter: (p) => isMobileView ? p.value?.slice(5) : formatDate(p.value), // MM-DD on mobile
      filter: "agDateColumnFilter",
      sort: "desc",
    },
    {
      field: "narration",
      headerName: "Narration",
      minWidth: 200,
      flex: 2,
      filter: "agTextColumnFilter",
      tooltipField: "narration",
      cellClass: "!select-text",
    },
    {
      field: "merchant",
      headerName: "Merchant",
      width: 150,
      filter: "agTextColumnFilter",
      hide: isMobileView,
    },
    {
      field: "withdrawal",
      headerName: isMobileView ? "Dr" : "Withdrawal",
      width: isMobileView ? 90 : 130,
      type: "rightAligned",
      valueFormatter: (p) => p.value ? formatCurrency(p.value) : "",
      cellStyle: { color: isDark ? "#f87171" : "#dc2626" },
      filter: "agNumberColumnFilter",
    },
    {
      field: "deposit",
      headerName: isMobileView ? "Cr" : "Deposit",
      width: isMobileView ? 90 : 130,
      type: "rightAligned",
      valueFormatter: (p) => p.value ? formatCurrency(p.value) : "",
      cellStyle: { color: isDark ? "#6ee7b7" : "#059669" },
      filter: "agNumberColumnFilter",
    },
    {
      field: "closing_balance",
      headerName: "Balance",
      width: isMobileView ? 100 : 130,
      type: "rightAligned",
      valueFormatter: (p) => formatCurrency(p.value),
      filter: "agNumberColumnFilter",
      hide: isMobileView,
    },
    {
      field: "category",
      headerName: "Category",
      width: isMobileView ? 120 : 160,
      editable: true,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: CATEGORIES },
      filter: "agTextColumnFilter",
    },
  ], [isDark, isMobileView]);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    resizable: true,
    filter: true,
    cellClass: "select-none",
  }), []);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Transactions</h1>
        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{transactions.length} txns</span>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <TimeFilter />
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={exportTransactions}
            className="flex items-center gap-1 border dark:border-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={downloadTemplate}
            className="hidden sm:flex items-center gap-1.5 border dark:border-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 whitespace-nowrap"
          >
            <Download className="w-4 h-4" /> Template
          </button>
          <button
            onClick={importCSV}
            className="flex items-center gap-1 border dark:border-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Import</span>
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-2 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 whitespace-nowrap"
          >
            {showForm ? <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>
      </div>

      {/* Status messages */}
      {(importResult || exportStatus) && (
        <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
          {importResult && <span className="text-emerald-600 dark:text-emerald-400">{importResult}</span>}
          {exportStatus && <span className="text-blue-600 dark:text-blue-400">{exportStatus}</span>}
        </div>
      )}

      {/* Balance bar */}
      {balanceData && (
        <div className="flex items-center gap-2 sm:gap-3 bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-800 px-3 py-2 sm:px-4 sm:py-2.5 shadow-sm text-xs sm:text-sm overflow-x-auto">
          <span className="text-purple-600 dark:text-purple-400 font-medium whitespace-nowrap">Open: {formatCurrency(balanceData.openingBalance)}</span>
          <span className="text-gray-300 dark:text-gray-600">→</span>
          <span className="text-amber-600 dark:text-amber-400 font-medium whitespace-nowrap">Close: {formatCurrency(balanceData.closingBalance)}</span>
        </div>
      )}
      {showForm && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-3 sm:p-4 shadow-sm space-y-3">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3">
            <div className="col-span-1">
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full border dark:border-gray-700 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
            <div className="col-span-1 sm:min-w-[140px]">
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Merchant</label>
              <input
                type="text"
                value={form.merchant}
                onChange={(e) => setForm({ ...form, merchant: e.target.value })}
                placeholder="e.g. Swiggy"
                className="w-full border dark:border-gray-700 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
            <div className="col-span-2 sm:flex-1 sm:min-w-[200px]">
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Narration</label>
              <input
                type="text"
                value={form.narration}
                onChange={(e) => setForm({ ...form, narration: e.target.value })}
                placeholder="Description"
                className="w-full border dark:border-gray-700 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
          </div>
          <div className="grid grid-cols-4 sm:flex sm:flex-wrap gap-2 sm:gap-3 items-end">
            <div className="col-span-1">
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Debit</label>
              <input
                type="number"
                value={form.withdrawal}
                onChange={(e) => setForm({ ...form, withdrawal: e.target.value })}
                placeholder="0"
                className="w-full border dark:border-gray-700 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
            <div className="col-span-1">
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Credit</label>
              <input
                type="number"
                value={form.deposit}
                onChange={(e) => setForm({ ...form, deposit: e.target.value })}
                placeholder="0"
                className="w-full border dark:border-gray-700 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
            <div className="col-span-1">
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full border dark:border-gray-700 rounded-lg px-1 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm bg-white dark:bg-gray-800 dark:text-gray-200"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button
              onClick={addTransaction}
              disabled={!form.date || !form.narration.trim()}
              className="col-span-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-2 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center gap-1 hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Add</span>
            </button>
          </div>
        </div>
      )}
      <SelectionRulePopover onRuleAdded={load} />
      <div style={{ height: "calc(100vh - 180px)", width: "100%" }}>
        <AgGridReact
          theme={gridTheme}
          ref={gridRef}
          rowData={transactions}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onCellValueChanged={onCategoryChanged}
          pagination={true}
          paginationPageSize={100}
          paginationPageSizeSelector={[50, 100, 200, 500]}
          getRowId={(params) => String(params.data.id)}
          enableCellTextSelection={true}
          ensureDomOrder={true}
        />
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-400">Loading...</div>}>
      <TransactionsInner />
    </Suspense>
  );
}
