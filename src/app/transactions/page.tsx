"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, type ColDef, type CellValueChangedEvent } from "ag-grid-community";
import { formatCurrency, formatDate } from "@/lib/utils";
import SelectionRulePopover from "@/components/SelectionRulePopover";

ModuleRegistry.registerModules([AllCommunityModule]);

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

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const gridRef = useRef<AgGridReact>(null);

  const load = useCallback(() => {
    fetch("/api/transactions?limit=10000")
      .then((r) => r.json())
      .then((d) => setTransactions(d.transactions));
  }, []);

  useEffect(() => { load(); }, [load]);

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
      cellStyle: { color: "#dc2626" },
      filter: "agNumberColumnFilter",
    },
    {
      field: "deposit",
      headerName: "Deposit",
      width: 130,
      type: "rightAligned",
      valueFormatter: (p) => p.value ? formatCurrency(p.value) : "",
      cellStyle: { color: "#059669" },
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
  ], []);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    resizable: true,
    filter: true,
    cellClass: "select-none",
  }), []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <span className="text-sm text-gray-500">{transactions.length} transactions</span>
      </div>
      <SelectionRulePopover onRuleAdded={load} />
      <div className="ag-theme-alpine" style={{ height: "calc(100vh - 140px)", width: "100%" }}>
        <AgGridReact
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
