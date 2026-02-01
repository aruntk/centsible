import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.FINTRACKER_DB_PATH || path.join(process.cwd(), "fin-tracker.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6b7280',
      icon TEXT NOT NULL DEFAULT 'tag'
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

  // Seed new categories if missing
  const existingCats = db.prepare("SELECT name FROM categories").all() as { name: string }[];
  const existingNames = new Set(existingCats.map((c) => c.name));
  const newCats: [string, string, string][] = [
    ["Vices", "#b91c1c", "cigarette"],
    ["Subscriptions", "#7c3aed", "repeat"],
    ["Family & Friends", "#f59e0b", "users"],
    ["Loans", "#64748b", "hand-coins"],
    ["Grocery", "#16a34a", "shopping-cart"],
    ["Real Estate", "#854d0e", "building"],
    ["CCBILL", "#0369a1", "credit-card"],
    ["Gold", "#ca8a04", "coins"],
    ["Car", "#475569", "car"],
    ["Fraud", "#dc2626", "alert-triangle"],
    ["Travel", "#0891b2", "plane"],
  ];
  for (const [name, color, icon] of newCats) {
    if (!existingNames.has(name)) {
      db.prepare("INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)").run(name, color, icon);
    }
  }

  // Seed default categories if empty
  const count = db.prepare("SELECT COUNT(*) as c FROM categories").get() as { c: number };
  if (count.c === 0) {
    seedDefaults(db);
  }
}

export function seedDefaults(db: Database.Database) {
  const categories: [string, string, string][] = [
    ["Food & Dining", "#ef4444", "utensils"],
    ["Shopping", "#f97316", "shopping-bag"],
    ["Transport", "#eab308", "car"],
    ["Bills & Utilities", "#84cc16", "receipt"],
    ["Transfers", "#22c55e", "arrow-right-left"],
    ["Salary/Income", "#10b981", "banknote"],
    ["Entertainment", "#06b6d4", "tv"],
    ["Health", "#3b82f6", "heart-pulse"],
    ["Education", "#8b5cf6", "graduation-cap"],
    ["ATM Withdrawal", "#a855f7", "landmark"],
    ["Credit Card", "#d946ef", "credit-card"],
    ["Taxes & Charges", "#f43f5e", "percent"],
    ["Investments", "#0ea5e9", "trending-up"],
    ["Vices", "#b91c1c", "cigarette"],
    ["Subscriptions", "#7c3aed", "repeat"],
    ["Family & Friends", "#f59e0b", "users"],
    ["Loans", "#64748b", "hand-coins"],
    ["Grocery", "#16a34a", "shopping-cart"],
    ["Real Estate", "#854d0e", "building"],
    ["CCBILL", "#0369a1", "credit-card"],
    ["Gold", "#ca8a04", "coins"],
    ["Car", "#475569", "car"],
    ["Fraud", "#dc2626", "alert-triangle"],
    ["Travel", "#0891b2", "plane"],
    ["Other", "#6b7280", "tag"],
  ];

  const insertCat = db.prepare("INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)");
  const insertRule = db.prepare("INSERT INTO category_rules (category_id, keyword, priority) VALUES (?, ?, ?)");

  const insertAll = db.transaction(() => {
    const catIds: Record<string, number> = {};
    for (const [name, color, icon] of categories) {
      const result = insertCat.run(name, color, icon);
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

export type Category = {
  id: number;
  name: string;
  color: string;
  icon: string;
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
