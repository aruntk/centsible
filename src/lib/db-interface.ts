/**
 * Database interface that abstracts SQLite operations across platforms.
 * - Desktop (Electron): Uses better-sqlite3 via Node.js
 * - Mobile (Capacitor): Uses @capacitor-community/sqlite
 */

export type Transaction = {
  id: number;
  date: string;
  narration: string;
  ref_no: string;
  value_date: string;
  withdrawal: number;
  deposit: number;
  closing_balance: number;
  category: string;
  merchant: string;
};

export type CategoryGroup = 'income' | 'living_expenditure' | 'loan' | 'investment' | 'other';

export type Category = {
  id: number;
  name: string;
  color: string;
  icon: string;
  category_group: CategoryGroup;
};

export type CategoryRule = {
  id: number;
  category_id: number;
  keyword: string | null;
  priority: number;
  condition_field: string | null;
  condition_op: string | null;
  condition_value: number | null;
  condition_value2: number | null;
};

export interface DbRunResult {
  lastInsertRowid: number | bigint;
  changes: number;
}

export interface DbStatement<T = unknown> {
  run(...params: unknown[]): DbRunResult;
  get(...params: unknown[]): T | undefined;
  all(...params: unknown[]): T[];
}

export interface IDatabase {
  exec(sql: string): void;
  prepare<T = unknown>(sql: string): DbStatement<T>;
  transaction<T>(fn: () => T): () => T;
  pragma(pragma: string): unknown;
}

export const DB_SCHEMA = `
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#6b7280',
    icon TEXT NOT NULL DEFAULT 'tag',
    category_group TEXT NOT NULL DEFAULT 'other'
  );

  CREATE TABLE IF NOT EXISTS category_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    keyword TEXT,
    priority INTEGER NOT NULL DEFAULT 0,
    condition_field TEXT,
    condition_op TEXT,
    condition_value REAL,
    condition_value2 REAL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    narration TEXT NOT NULL,
    ref_no TEXT,
    value_date TEXT,
    withdrawal REAL DEFAULT 0,
    deposit REAL DEFAULT 0,
    closing_balance REAL DEFAULT 0,
    category TEXT DEFAULT 'Other',
    merchant TEXT DEFAULT ''
  );
`;

export const DEFAULT_CATEGORIES: [string, string, string, CategoryGroup][] = [
  ["Food & Dining", "#ef4444", "utensils", "living_expenditure"],
  ["Shopping", "#f97316", "shopping-bag", "living_expenditure"],
  ["Transport", "#eab308", "car", "living_expenditure"],
  ["Bills & Utilities", "#84cc16", "receipt", "living_expenditure"],
  ["Transfers", "#22c55e", "arrow-right-left", "other"],
  ["Salary/Income", "#10b981", "banknote", "income"],
  ["Entertainment", "#06b6d4", "tv", "living_expenditure"],
  ["Health", "#3b82f6", "heart-pulse", "living_expenditure"],
  ["Education", "#8b5cf6", "graduation-cap", "living_expenditure"],
  ["ATM Withdrawal", "#a855f7", "landmark", "other"],
  ["Credit Card", "#d946ef", "credit-card", "loan"],
  ["Taxes & Charges", "#f43f5e", "percent", "other"],
  ["Investments", "#0ea5e9", "trending-up", "investment"],
  ["Vices", "#b91c1c", "cigarette", "living_expenditure"],
  ["Subscriptions", "#7c3aed", "repeat", "living_expenditure"],
  ["Family & Friends", "#f59e0b", "users", "other"],
  ["Loans", "#64748b", "hand-coins", "loan"],
  ["Grocery", "#16a34a", "shopping-cart", "living_expenditure"],
  ["Real Estate", "#854d0e", "building", "investment"],
  ["CCBILL", "#0369a1", "credit-card", "loan"],
  ["Gold", "#ca8a04", "coins", "investment"],
  ["Car", "#475569", "car", "living_expenditure"],
  ["Fraud", "#dc2626", "alert-triangle", "other"],
  ["Travel", "#0891b2", "plane", "living_expenditure"],
  ["Other", "#6b7280", "tag", "other"],
];

export const DEFAULT_RULES: [string, string, number][] = [
  ["Food & Dining", "swiggy", 10],
  ["Food & Dining", "zomato", 10],
  ["Food & Dining", "blinkit", 8],
  ["Food & Dining", "zepto", 8],
  ["Food & Dining", "instamart", 8],
  ["Food & Dining", "shriyan cafe", 5],
  ["Food & Dining", "country delight", 5],
  ["Food & Dining", "licious", 5],
  ["Food & Dining", "bharatpe", 3],
  ["Food & Dining", "bigbasket", 5],
  ["Food & Dining", "dunzo", 5],
  ["Shopping", "amazon", 10],
  ["Shopping", "flipkart", 10],
  ["Shopping", "myntra", 10],
  ["Shopping", "ajio", 10],
  ["Shopping", "meesho", 10],
  ["Shopping", "google play", 5],
  ["Transport", "uber", 10],
  ["Transport", "ola", 10],
  ["Transport", "rapido", 10],
  ["Transport", "irctc", 10],
  ["Transport", "fuel", 5],
  ["Transport", "petrol", 5],
  ["Bills & Utilities", "bbps", 8],
  ["Bills & Utilities", "electricity", 8],
  ["Bills & Utilities", "broadband", 8],
  ["Bills & Utilities", "jio", 5],
  ["Bills & Utilities", "airtel", 5],
  ["Bills & Utilities", "vodafone", 5],
  ["Bills & Utilities", "locker rent", 5],
  ["Transfers", "transfer", 5],
  ["Transfers", "payment from phone", 1],
  ["Salary/Income", "salary", 15],
  ["Salary/Income", "neft cr", 10],
  ["Salary/Income", "interest paid", 8],
  ["Entertainment", "netflix", 10],
  ["Entertainment", "hotstar", 10],
  ["Entertainment", "spotify", 10],
  ["Entertainment", "youtube", 8],
  ["Health", "pharma", 8],
  ["Health", "medical", 8],
  ["Health", "hospital", 8],
  ["Health", "apollo", 8],
  ["Education", "udemy", 8],
  ["Education", "coursera", 8],
  ["ATM Withdrawal", "atm", 10],
  ["ATM Withdrawal", "cash wdl", 10],
  ["Credit Card", "credit card", 10],
  ["Credit Card", "cc payment", 8],
  ["Taxes & Charges", "cgst", 10],
  ["Taxes & Charges", "sgst", 10],
  ["Taxes & Charges", "gst", 8],
  ["Taxes & Charges", "tax", 5],
  ["Taxes & Charges", "tds", 8],
  ["Investments", "groww", 10],
  ["Investments", "mutual fund", 10],
  ["Investments", "mf purchase", 10],
  ["Investments", "sip", 8],
];

export const NEW_CATEGORIES: [string, string, string, CategoryGroup][] = [
  ["Vices", "#b91c1c", "cigarette", "living_expenditure"],
  ["Subscriptions", "#7c3aed", "repeat", "living_expenditure"],
  ["Family & Friends", "#f59e0b", "users", "other"],
  ["Loans", "#64748b", "hand-coins", "loan"],
  ["Grocery", "#16a34a", "shopping-cart", "living_expenditure"],
  ["Real Estate", "#854d0e", "building", "investment"],
  ["CCBILL", "#0369a1", "credit-card", "loan"],
  ["Gold", "#ca8a04", "coins", "investment"],
  ["Car", "#475569", "car", "living_expenditure"],
  ["Fraud", "#dc2626", "alert-triangle", "other"],
  ["Travel", "#0891b2", "plane", "living_expenditure"],
];
