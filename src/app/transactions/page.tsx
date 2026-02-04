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

  const load = useCallback(() => {
    const txParams = new URLSearchParams(apiParams);
    txParams.set("limit", "10000");
    fetch(`/api/transactions?${txParams}`)
      .then((r) => r.json())
      .then((d) => setTransactions(d.transactions));
    fetch(`/api/analytics?${apiParams}`)
      .then((r) => r.json())
      .then((d) => setBalanceData({ openingBalance: d.openingBalance, closingBalance: d.closingBalance }));
  }, [apiParams]);

  useEffect(() => { load(); }, [load]);

  const addTransaction = async () => {
    if (!form.date || !form.narration.trim()) return;
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

  const importCSV = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append("file", file);
      setImportResult("Importing...");
      const res = await fetch("/api/transactions/import-csv", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setImportResult(data.error || "Import failed");
      } else {
        setImportResult(`Imported ${data.imported}, skipped ${data.skipped} of ${data.total} rows`);
        load();
      }
    };
    input.click();
  };

  const onCategoryChanged = useCallback(async (event: CellValueChangedEvent) => {
    if (event.colDef.field === "category" && event.newValue !== event.oldValue) {
      await fetch(`/api/transactions/${event.data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: event.newValue }),
      });
    }
  }, []);

  const columnDefs = useMemo<ColDef<Transaction>[]>(() => [
    {
      field: "date",
      headerName: "Date",
      width: 130,
      valueFormatter: (p) => formatDate(p.value),
      filter: "agDateColumnFilter",
      sort: "desc",
    },
    {
      field: "narration",
      headerName: "Narration",
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
    },
    {
      field: "withdrawal",
      headerName: "Withdrawal",
      width: 130,
      type: "rightAligned",
      valueFormatter: (p) => p.value ? formatCurrency(p.value) : "",
      cellStyle: { color: isDark ? "#f87171" : "#dc2626" },
      filter: "agNumberColumnFilter",
    },
    {
      field: "deposit",
      headerName: "Deposit",
      width: 130,
      type: "rightAligned",
      valueFormatter: (p) => p.value ? formatCurrency(p.value) : "",
      cellStyle: { color: isDark ? "#6ee7b7" : "#059669" },
      filter: "agNumberColumnFilter",
    },
    {
      field: "closing_balance",
      headerName: "Balance",
      width: 130,
      type: "rightAligned",
      valueFormatter: (p) => formatCurrency(p.value),
      filter: "agNumberColumnFilter",
    },
    {
      field: "category",
      headerName: "Category",
      width: 160,
      editable: true,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: CATEGORIES },
      filter: "agTextColumnFilter",
    },
  ], [isDark]);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    resizable: true,
    filter: true,
    cellClass: "select-none",
  }), []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Transactions</h1>
        <div className="flex flex-wrap items-center gap-3">
          <TimeFilter />
          {importResult && <span className="text-sm text-emerald-600 dark:text-emerald-400">{importResult}</span>}
          {exportStatus && <span className="text-sm text-blue-600 dark:text-blue-400">{exportStatus}</span>}
          <span className="text-sm text-gray-500 dark:text-gray-400">{transactions.length} transactions</span>
          <button
            onClick={exportTransactions}
            className="flex items-center gap-1.5 border dark:border-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 border dark:border-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Download className="w-4 h-4" /> Template
          </button>
          <button
            onClick={importCSV}
            className="flex items-center gap-1.5 border dark:border-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200"
          >
            {showForm ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            Add Transaction
          </button>
        </div>
      </div>
      {balanceData && (
        <div className="flex items-center gap-3 bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-800 px-4 py-2.5 shadow-sm text-sm">
          <span className="text-purple-600 dark:text-purple-400 font-medium">Opening: {formatCurrency(balanceData.openingBalance)}</span>
          <span className="text-gray-300 dark:text-gray-600">→</span>
          <span className="text-amber-600 dark:text-amber-400 font-medium">Closing: {formatCurrency(balanceData.closingBalance)}</span>
        </div>
      )}
      {showForm && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="border dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Narration</label>
              <input
                type="text"
                value={form.narration}
                onChange={(e) => setForm({ ...form, narration: e.target.value })}
                placeholder="Description of the transaction"
                className="w-full border dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
            <div className="min-w-[140px]">
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Merchant</label>
              <input
                type="text"
                value={form.merchant}
                onChange={(e) => setForm({ ...form, merchant: e.target.value })}
                placeholder="e.g. Swiggy"
                className="w-full border dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Withdrawal</label>
              <input
                type="number"
                value={form.withdrawal}
                onChange={(e) => setForm({ ...form, withdrawal: e.target.value })}
                placeholder="0"
                className="border dark:border-gray-700 rounded-lg px-3 py-2 text-sm w-32 bg-white dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Deposit</label>
              <input
                type="number"
                value={form.deposit}
                onChange={(e) => setForm({ ...form, deposit: e.target.value })}
                placeholder="0"
                className="border dark:border-gray-700 rounded-lg px-3 py-2 text-sm w-32 bg-white dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="border dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-200"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button
              onClick={addTransaction}
              disabled={!form.date || !form.narration.trim()}
              className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-40"
            >
              <Plus className="w-4 h-4" /> Add
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
