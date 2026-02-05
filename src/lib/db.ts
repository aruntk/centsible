import { NEW_CATEGORIES } from "./db-interface";

// Re-export types from interface for backward compatibility
export type { Transaction, Category, CategoryRule } from "./db-interface";

// Dynamic import for better-sqlite3 - only works in Node.js environment
// This prevents build errors during static export (mobile builds)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DatabaseType = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Database: any = null;
let _db: DatabaseType | null = null;

// Check if we're in a Node.js server environment (not static export)
const isNodeServer = typeof window === "undefined" && process.env.BUILD_TARGET !== "mobile";

/**
 * Get the desktop SQLite database instance.
 * This uses better-sqlite3 which only works in Node.js (Electron main process or Next.js server).
 * For mobile (Capacitor), use the db-mobile.ts implementation instead.
 */
export function getDb(): DatabaseType {
  if (!isNodeServer) {
    throw new Error("getDb() can only be called in Node.js server environment. For mobile, use db-mobile.ts");
  }

  if (!_db) {
    // Dynamic require to avoid bundling issues during static export
    if (!Database) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      Database = require("better-sqlite3");
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path");
    const DB_PATH = process.env.FINTRACKER_DB_PATH || path.join(process.cwd(), "fin-tracker.db");
    _db = new Database(DB_PATH);
    _db!.pragma("journal_mode = WAL");
    _db!.pragma("foreign_keys = ON");
    initSchema(_db!);
  }
  return _db!;
}

function initSchema(db: DatabaseType) {
  db.exec(`
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
  `);

  // Migrate: add condition columns if missing
  const cols = db.prepare("PRAGMA table_info(category_rules)").all() as { name: string }[];
  const colNames = new Set(cols.map((c) => c.name));
  if (!colNames.has("condition_field")) {
    db.exec("ALTER TABLE category_rules ADD COLUMN condition_field TEXT");
    db.exec("ALTER TABLE category_rules ADD COLUMN condition_op TEXT");
    db.exec("ALTER TABLE category_rules ADD COLUMN condition_value REAL");
  }
  if (!colNames.has("condition_value2")) {
    db.exec("ALTER TABLE category_rules ADD COLUMN condition_value2 REAL");
  }

  // Migrate: add category_group column if missing
  const catCols = db.prepare("PRAGMA table_info(categories)").all() as { name: string }[];
  const catColNames = new Set(catCols.map((c) => c.name));
  if (!catColNames.has("category_group")) {
    db.exec("ALTER TABLE categories ADD COLUMN category_group TEXT NOT NULL DEFAULT 'other'");
    // Update existing categories with appropriate groups
    const groupMap: Record<string, string> = {
      "Salary/Income": "income",
      "Food & Dining": "living_expenditure",
      "Shopping": "living_expenditure",
      "Transport": "living_expenditure",
      "Bills & Utilities": "living_expenditure",
      "Entertainment": "living_expenditure",
      "Health": "living_expenditure",
      "Education": "living_expenditure",
      "Vices": "living_expenditure",
      "Subscriptions": "living_expenditure",
      "Grocery": "living_expenditure",
      "Car": "living_expenditure",
      "Travel": "living_expenditure",
      "Credit Card": "loan",
      "CCBILL": "loan",
      "Loans": "loan",
      "Investments": "investment",
      "Real Estate": "investment",
      "Gold": "investment",
    };
    for (const [name, group] of Object.entries(groupMap)) {
      db.prepare("UPDATE categories SET category_group = ? WHERE name = ?").run(group, name);
    }
  }

  // Seed new categories if missing
  const existingCats = db.prepare("SELECT name FROM categories").all() as { name: string }[];
  const existingNames = new Set(existingCats.map((c) => c.name));
  for (const [name, color, icon, group] of NEW_CATEGORIES) {
    if (!existingNames.has(name)) {
      db.prepare("INSERT INTO categories (name, color, icon, category_group) VALUES (?, ?, ?, ?)").run(name, color, icon, group);
    }
  }

  // Seed default categories if empty
  const count = db.prepare("SELECT COUNT(*) as c FROM categories").get() as { c: number };
  if (count.c === 0) {
    seedDefaults(db);
  }
}

export function seedDefaults(db: DatabaseType) {
  const categories: [string, string, string, string][] = [
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

  const insertCat = db.prepare("INSERT INTO categories (name, color, icon, category_group) VALUES (?, ?, ?, ?)");
  const insertRule = db.prepare("INSERT INTO category_rules (category_id, keyword, priority) VALUES (?, ?, ?)");

  const insertAll = db.transaction(() => {
    const catIds: Record<string, number> = {};
    for (const [name, color, icon, group] of categories) {
      const result = insertCat.run(name, color, icon, group);
      catIds[name] = result.lastInsertRowid as number;
    }

    const rules: [string, string, number][] = [
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

    for (const [catName, keyword, priority] of rules) {
      insertRule.run(catIds[catName], keyword, priority);
    }
  });

  insertAll();
}