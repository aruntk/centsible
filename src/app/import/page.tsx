"use client";

import { useState, useRef } from "react";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";

export default function ImportPage() {
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; total: number; bank?: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setLoading(true);
    setError("");
    setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Import Statement</h1>
      <p className="text-gray-500 dark:text-gray-400">Upload a bank account statement (.txt or .csv file)</p>

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
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          dragging ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
        }`}
      >
        <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
        <p className="text-gray-600 dark:text-gray-300 font-medium">
          {loading ? "Uploading..." : "Drop statement file here or click to browse"}
        </p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
          Supported banks: HDFC, SBI, ICICI, Axis, Kotak, Yes Bank, PNB, Bank of Baroda, Federal Bank
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
        <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 flex gap-3 items-start">
          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <div>
            <p className="font-medium text-emerald-800 dark:text-emerald-300">
              Import successful{result.bank ? ` — ${result.bank}` : ""}
            </p>
            <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">
              {result.imported} transactions imported, {result.skipped} duplicates skipped (total {result.total} in file)
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 flex gap-3 items-start">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
          <div>
            <p className="font-medium text-red-800 dark:text-red-300">Import failed</p>
            <p className="text-sm text-red-700 dark:text-red-400 mt-1">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
