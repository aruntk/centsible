"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { isCapacitor, isMobile } from "@/lib/platform";
import * as clientDb from "@/lib/db-client";
import type { Transaction, Category, CategoryRule } from "@/lib/db-interface";

interface DatabaseContextType {
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  isMobileDb: boolean;

  // Transaction operations
  getTransactions: (params?: clientDb.GetTransactionsParams) => Promise<clientDb.GetTransactionsResult>;
  createTransaction: (data: Omit<Transaction, "id">) => Promise<number>;
  updateTransaction: (id: number, updates: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: number) => Promise<void>;

  // Category operations
  getCategories: () => Promise<Category[]>;
  createCategory: (name: string, color: string, icon: string) => Promise<number>;
  updateCategory: (id: number, name: string, color: string, icon: string) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;

  // Category rules operations
  getCategoryRules: () => Promise<(CategoryRule & { category_name: string })[]>;
  createCategoryRule: (rule: Omit<CategoryRule, "id">) => Promise<number>;
  deleteCategoryRule: (id: number) => Promise<void>;

  // Analytics
  getAnalytics: (from?: string, to?: string) => Promise<clientDb.AnalyticsResult>;

  // Import
  importTransactions: (
    transactions: Omit<Transaction, "id">[],
    checkDuplicates?: boolean
  ) => Promise<{ imported: number; skipped: number }>;

  // Settings
  getSetting: (key: string) => Promise<string | null>;
  setSetting: (key: string, value: string) => Promise<void>;

  // Reset
  resetAllData: () => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType | null>(null);

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobileDb, setIsMobileDb] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        // Check if we're running on Capacitor mobile
        if (isCapacitor() && isMobile()) {
          await clientDb.initClientDb();
          setIsMobileDb(true);
        }
        setIsReady(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize database");
        console.error("Database initialization error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    init();

    return () => {
      if (isMobileDb) {
        clientDb.closeClientDb().catch(console.error);
      }
    };
  }, [isMobileDb]);

  // Wrapper functions that use client DB for mobile, API for web/desktop
  const getTransactions = useCallback(
    async (params?: clientDb.GetTransactionsParams) => {
      if (isMobileDb) {
        return clientDb.getTransactions(params);
      }
      const sp = new URLSearchParams();
      if (params?.category) sp.set("category", params.category);
      if (params?.search) sp.set("search", params.search);
      if (params?.merchant) sp.set("merchant", params.merchant);
      if (params?.from) sp.set("from", params.from);
      if (params?.to) sp.set("to", params.to);
      if (params?.page) sp.set("page", String(params.page));
      if (params?.limit) sp.set("limit", String(params.limit));
      const res = await fetch(`/api/transactions?${sp}`);
      return res.json();
    },
    [isMobileDb]
  );

  const createTransaction = useCallback(
    async (data: Omit<Transaction, "id">) => {
      if (isMobileDb) {
        return clientDb.createTransaction(data);
      }
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      return json.id;
    },
    [isMobileDb]
  );

  const updateTransaction = useCallback(
    async (id: number, updates: Partial<Transaction>) => {
      if (isMobileDb) {
        return clientDb.updateTransaction(id, updates);
      }
      await fetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
    },
    [isMobileDb]
  );

  const deleteTransaction = useCallback(
    async (id: number) => {
      if (isMobileDb) {
        return clientDb.deleteTransaction(id);
      }
      await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    },
    [isMobileDb]
  );

  const getCategories = useCallback(async () => {
    if (isMobileDb) {
      return clientDb.getCategories();
    }
    const res = await fetch("/api/categories");
    return res.json();
  }, [isMobileDb]);

  const createCategory = useCallback(
    async (name: string, color: string, icon: string) => {
      if (isMobileDb) {
        return clientDb.createCategory(name, color, icon);
      }
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color, icon }),
      });
      const json = await res.json();
      return json.id;
    },
    [isMobileDb]
  );

  const updateCategory = useCallback(
    async (id: number, name: string, color: string, icon: string) => {
      if (isMobileDb) {
        return clientDb.updateCategory(id, name, color, icon);
      }
      await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color, icon }),
      });
    },
    [isMobileDb]
  );

  const deleteCategory = useCallback(
    async (id: number) => {
      if (isMobileDb) {
        return clientDb.deleteCategory(id);
      }
      await fetch(`/api/categories/${id}`, { method: "DELETE" });
    },
    [isMobileDb]
  );

  const getCategoryRules = useCallback(async () => {
    if (isMobileDb) {
      return clientDb.getCategoryRules();
    }
    const res = await fetch("/api/categories/rules");
    return res.json();
  }, [isMobileDb]);

  const createCategoryRule = useCallback(
    async (rule: Omit<CategoryRule, "id">) => {
      if (isMobileDb) {
        return clientDb.createCategoryRule(rule);
      }
      const res = await fetch("/api/categories/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
      });
      const json = await res.json();
      return json.id;
    },
    [isMobileDb]
  );

  const deleteCategoryRule = useCallback(
    async (id: number) => {
      if (isMobileDb) {
        return clientDb.deleteCategoryRule(id);
      }
      await fetch(`/api/categories/rules/${id}`, { method: "DELETE" });
    },
    [isMobileDb]
  );

  const getAnalytics = useCallback(
    async (from?: string, to?: string) => {
      if (isMobileDb) {
        return clientDb.getAnalytics(from, to);
      }
      const sp = new URLSearchParams();
      if (from) sp.set("from", from);
      if (to) sp.set("to", to);
      const res = await fetch(`/api/analytics?${sp}`);
      return res.json();
    },
    [isMobileDb]
  );

  const importTransactions = useCallback(
    async (transactions: Omit<Transaction, "id">[], checkDuplicates = true) => {
      if (isMobileDb) {
        return clientDb.importTransactions(transactions, checkDuplicates);
      }
      // For web/desktop, we use the file upload API
      // This function would be called after parsing on the client
      const res = await fetch("/api/transactions/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions, checkDuplicates }),
      });
      return res.json();
    },
    [isMobileDb]
  );

  const getSetting = useCallback(
    async (key: string) => {
      if (isMobileDb) {
        return clientDb.getSetting(key);
      }
      const res = await fetch(`/api/settings?key=${encodeURIComponent(key)}`);
      const json = await res.json();
      return json.value;
    },
    [isMobileDb]
  );

  const setSetting = useCallback(
    async (key: string, value: string) => {
      if (isMobileDb) {
        return clientDb.setSetting(key, value);
      }
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
    },
    [isMobileDb]
  );

  const resetAllData = useCallback(async () => {
    if (isMobileDb) {
      return clientDb.resetAllData();
    }
    await fetch("/api/reset", { method: "POST" });
  }, [isMobileDb]);

  const value: DatabaseContextType = {
    isReady,
    isLoading,
    error,
    isMobileDb,
    getTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoryRules,
    createCategoryRule,
    deleteCategoryRule,
    getAnalytics,
    importTransactions,
    getSetting,
    setSetting,
    resetAllData,
  };

  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error("useDatabase must be used within a DatabaseProvider");
  }
  return context;
}
