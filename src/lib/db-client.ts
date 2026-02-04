/**
 * Client-side database service for Capacitor mobile apps.
 *
 * On mobile, we can't use server-side API routes because there's no Node.js server.
 * Instead, we use @capacitor-community/sqlite to run SQLite directly in the app.
 *
 * This module provides the same operations as the API routes but using client-side SQLite.
 */

import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from "@capacitor-community/sqlite";
import {
  DB_SCHEMA,
  DEFAULT_CATEGORIES,
  DEFAULT_RULES,
  NEW_CATEGORIES,
  Transaction,
  Category,
  CategoryRule,
} from "./db-interface";

const DB_NAME = "centsible";

let _sqlite: SQLiteConnection | null = null;
let _db: SQLiteDBConnection | null = null;
let _initialized = false;

/**
 * Initialize the mobile database connection.
 * Must be called before any database operations on mobile.
 */
export async function initClientDb(): Promise<void> {
  if (_initialized && _db) {
    return;
  }

  _sqlite = new SQLiteConnection(CapacitorSQLite);

  // Check for existing connection
  const retCC = await _sqlite.checkConnectionsConsistency();
  const isConn = (await _sqlite.isConnection(DB_NAME, false)).result;

  if (retCC.result && isConn) {
    _db = await _sqlite.retrieveConnection(DB_NAME, false);
  } else {
    _db = await _sqlite.createConnection(DB_NAME, false, "no-encryption", 1, false);
  }

  await _db.open();

  // Initialize schema
  await _db.execute(DB_SCHEMA);
  await _db.execute("PRAGMA foreign_keys = ON;");

  // Run migrations
  await runMigrations();

  // Seed defaults if empty
  await seedIfEmpty();

  _initialized = true;
}

async function runMigrations(): Promise<void> {
  if (!_db) return;

  // Check for condition columns
  const tableInfo = await _db.query("PRAGMA table_info(category_rules)");
  const colNames = new Set((tableInfo.values || []).map((row) => row[1] as string));

  if (!colNames.has("condition_field")) {
    await _db.execute("ALTER TABLE category_rules ADD COLUMN condition_field TEXT");
    await _db.execute("ALTER TABLE category_rules ADD COLUMN condition_op TEXT");
    await _db.execute("ALTER TABLE category_rules ADD COLUMN condition_value REAL");
  }
  if (!colNames.has("condition_value2")) {
    await _db.execute("ALTER TABLE category_rules ADD COLUMN condition_value2 REAL");
  }

  // Seed new categories if missing
  const existingCats = await _db.query("SELECT name FROM categories");
  const existingNames = new Set((existingCats.values || []).map((row) => row[0] as string));

  for (const [name, color, icon] of NEW_CATEGORIES) {
    if (!existingNames.has(name)) {
      await _db.run("INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)", [name, color, icon]);
    }
  }
}

async function seedIfEmpty(): Promise<void> {
  if (!_db) return;

  const count = await _db.query("SELECT COUNT(*) as c FROM categories");
  const c = (count.values?.[0]?.[0] as number) || 0;

  if (c === 0) {
    await seedDefaults();
  }
}

async function seedDefaults(): Promise<void> {
  if (!_db) return;

  const catIds: Record<string, number> = {};

  for (const [name, color, icon] of DEFAULT_CATEGORIES) {
    const result = await _db.run("INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)", [name, color, icon]);
    catIds[name] = result.changes?.lastId || 0;
  }

  for (const [catName, keyword, priority] of DEFAULT_RULES) {
    await _db.run("INSERT INTO category_rules (category_id, keyword, priority) VALUES (?, ?, ?)", [
      catIds[catName],
      keyword,
      priority,
    ]);
  }
}

/**
 * Close the database connection.
 */
export async function closeClientDb(): Promise<void> {
  if (_db && _sqlite) {
    await _sqlite.closeConnection(DB_NAME, false);
    _db = null;
    _initialized = false;
  }
}

// =============================================================================
// Transaction Operations
// =============================================================================

export interface GetTransactionsParams {
  category?: string;
  search?: string;
  merchant?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface GetTransactionsResult {
  transactions: Transaction[];
  total: number;
  page: number;
  limit: number;
}

export async function getTransactions(params: GetTransactionsParams = {}): Promise<GetTransactionsResult> {
  if (!_db) throw new Error("Database not initialized");

  const { category, search, merchant, from, to, page = 1, limit = 50 } = params;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const queryParams: (string | number)[] = [];

  if (category && category !== "All") {
    conditions.push("category = ?");
    queryParams.push(category);
  }
  if (search) {
    conditions.push("(narration LIKE ? OR merchant LIKE ?)");
    queryParams.push(`%${search}%`, `%${search}%`);
  }
  if (merchant) {
    conditions.push("merchant = ?");
    queryParams.push(merchant);
  }
  if (from) {
    conditions.push("date >= ?");
    queryParams.push(from);
  }
  if (to) {
    conditions.push("date <= ?");
    queryParams.push(to);
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const countResult = await _db.query(`SELECT COUNT(*) as c FROM transactions ${where}`, queryParams);
  const total = (countResult.values?.[0]?.[0] as number) || 0;

  const dataResult = await _db.query(
    `SELECT id, date, narration, ref_no, value_date, withdrawal, deposit, closing_balance, category, merchant
     FROM transactions ${where} ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`,
    [...queryParams, limit, offset]
  );

  const transactions = (dataResult.values || []).map(rowToTransaction);

  return { transactions, total, page, limit };
}

export async function createTransaction(data: Omit<Transaction, "id">): Promise<number> {
  if (!_db) throw new Error("Database not initialized");

  const result = await _db.run(
    `INSERT INTO transactions (date, narration, ref_no, value_date, withdrawal, deposit, closing_balance, category, merchant)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.date,
      data.narration,
      data.ref_no || null,
      data.value_date || data.date,
      data.withdrawal || 0,
      data.deposit || 0,
      data.closing_balance || 0,
      data.category || "Other",
      data.merchant || "",
    ]
  );

  return result.changes?.lastId || 0;
}

export async function updateTransaction(id: number, updates: Partial<Transaction>): Promise<void> {
  if (!_db) throw new Error("Database not initialized");

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.category !== undefined) {
    fields.push("category = ?");
    values.push(updates.category);
  }
  if (updates.merchant !== undefined) {
    fields.push("merchant = ?");
    values.push(updates.merchant);
  }
  if (updates.narration !== undefined) {
    fields.push("narration = ?");
    values.push(updates.narration);
  }
  if (updates.date !== undefined) {
    fields.push("date = ?");
    values.push(updates.date);
  }
  if (updates.withdrawal !== undefined) {
    fields.push("withdrawal = ?");
    values.push(updates.withdrawal);
  }
  if (updates.deposit !== undefined) {
    fields.push("deposit = ?");
    values.push(updates.deposit);
  }

  if (fields.length === 0) return;

  values.push(id);
  await _db.run(`UPDATE transactions SET ${fields.join(", ")} WHERE id = ?`, values);
}

export async function deleteTransaction(id: number): Promise<void> {
  if (!_db) throw new Error("Database not initialized");
  await _db.run("DELETE FROM transactions WHERE id = ?", [id]);
}

// =============================================================================
// Category Operations
// =============================================================================

export async function getCategories(): Promise<Category[]> {
  if (!_db) throw new Error("Database not initialized");

  const result = await _db.query("SELECT id, name, color, icon FROM categories ORDER BY name");
  return (result.values || []).map(rowToCategory);
}

export async function createCategory(name: string, color: string, icon: string): Promise<number> {
  if (!_db) throw new Error("Database not initialized");

  const result = await _db.run("INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)", [name, color, icon]);
  return result.changes?.lastId || 0;
}

export async function updateCategory(id: number, name: string, color: string, icon: string): Promise<void> {
  if (!_db) throw new Error("Database not initialized");
  await _db.run("UPDATE categories SET name = ?, color = ?, icon = ? WHERE id = ?", [name, color, icon, id]);
}

export async function deleteCategory(id: number): Promise<void> {
  if (!_db) throw new Error("Database not initialized");
  await _db.run("DELETE FROM categories WHERE id = ?", [id]);
}

// =============================================================================
// Category Rules Operations
// =============================================================================

export async function getCategoryRules(): Promise<(CategoryRule & { category_name: string })[]> {
  if (!_db) throw new Error("Database not initialized");

  const result = await _db.query(`
    SELECT r.id, r.category_id, r.keyword, r.priority, r.condition_field, r.condition_op, r.condition_value, r.condition_value2, c.name as category_name
    FROM category_rules r
    JOIN categories c ON r.category_id = c.id
    ORDER BY r.priority DESC
  `);

  return (result.values || []).map((row) => ({
    id: row[0] as number,
    category_id: row[1] as number,
    keyword: row[2] as string | null,
    priority: row[3] as number,
    condition_field: row[4] as string | null,
    condition_op: row[5] as string | null,
    condition_value: row[6] as number | null,
    condition_value2: row[7] as number | null,
    category_name: row[8] as string,
  }));
}

export async function createCategoryRule(rule: Omit<CategoryRule, "id">): Promise<number> {
  if (!_db) throw new Error("Database not initialized");

  const result = await _db.run(
    `INSERT INTO category_rules (category_id, keyword, priority, condition_field, condition_op, condition_value, condition_value2)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      rule.category_id,
      rule.keyword,
      rule.priority,
      rule.condition_field,
      rule.condition_op,
      rule.condition_value,
      rule.condition_value2,
    ]
  );

  return result.changes?.lastId || 0;
}

export async function deleteCategoryRule(id: number): Promise<void> {
  if (!_db) throw new Error("Database not initialized");
  await _db.run("DELETE FROM category_rules WHERE id = ?", [id]);
}

// =============================================================================
// Analytics Operations
// =============================================================================

export interface AnalyticsResult {
  byCategory: { category: string; total: number; count: number }[];
  byMonth: { month: string; withdrawal: number; deposit: number }[];
  topMerchants: { merchant: string; total: number; count: number }[];
}

export async function getAnalytics(from?: string, to?: string): Promise<AnalyticsResult> {
  if (!_db) throw new Error("Database not initialized");

  const conditions: string[] = [];
  const params: string[] = [];

  if (from) {
    conditions.push("date >= ?");
    params.push(from);
  }
  if (to) {
    conditions.push("date <= ?");
    params.push(to);
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  // By category
  const categoryResult = await _db.query(
    `SELECT category, SUM(withdrawal) as total, COUNT(*) as count FROM transactions ${where} GROUP BY category ORDER BY total DESC`,
    params
  );
  const byCategory = (categoryResult.values || []).map((row) => ({
    category: row[0] as string,
    total: row[1] as number,
    count: row[2] as number,
  }));

  // By month
  const monthResult = await _db.query(
    `SELECT strftime('%Y-%m', date) as month, SUM(withdrawal) as withdrawal, SUM(deposit) as deposit
     FROM transactions ${where} GROUP BY month ORDER BY month`,
    params
  );
  const byMonth = (monthResult.values || []).map((row) => ({
    month: row[0] as string,
    withdrawal: row[1] as number,
    deposit: row[2] as number,
  }));

  // Top merchants
  const merchantResult = await _db.query(
    `SELECT merchant, SUM(withdrawal) as total, COUNT(*) as count FROM transactions ${where} AND merchant != '' GROUP BY merchant ORDER BY total DESC LIMIT 10`,
    params
  );
  const topMerchants = (merchantResult.values || []).map((row) => ({
    merchant: row[0] as string,
    total: row[1] as number,
    count: row[2] as number,
  }));

  return { byCategory, byMonth, topMerchants };
}

// =============================================================================
// Import Operations
// =============================================================================

export async function importTransactions(
  transactions: Omit<Transaction, "id">[],
  checkDuplicates = true
): Promise<{ imported: number; skipped: number }> {
  if (!_db) throw new Error("Database not initialized");

  let existingRefs = new Set<string>();
  if (checkDuplicates) {
    const refsResult = await _db.query("SELECT ref_no FROM transactions WHERE ref_no IS NOT NULL");
    existingRefs = new Set((refsResult.values || []).map((row) => row[0] as string));
  }

  let imported = 0;
  let skipped = 0;

  for (const t of transactions) {
    if (checkDuplicates && t.ref_no && existingRefs.has(t.ref_no)) {
      skipped++;
      continue;
    }

    await _db.run(
      `INSERT INTO transactions (date, narration, ref_no, value_date, withdrawal, deposit, closing_balance, category, merchant)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.date, t.narration, t.ref_no, t.value_date, t.withdrawal, t.deposit, t.closing_balance, t.category, t.merchant]
    );
    imported++;
  }

  return { imported, skipped };
}

// =============================================================================
// Settings Operations
// =============================================================================

export async function getSetting(key: string): Promise<string | null> {
  if (!_db) throw new Error("Database not initialized");

  const result = await _db.query("SELECT value FROM settings WHERE key = ?", [key]);
  return (result.values?.[0]?.[0] as string) || null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  if (!_db) throw new Error("Database not initialized");

  await _db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value]);
}

// =============================================================================
// Reset Operations
// =============================================================================

export async function resetAllData(): Promise<void> {
  if (!_db) throw new Error("Database not initialized");

  await _db.execute("DELETE FROM transactions");
  await _db.execute("DELETE FROM category_rules");
  await _db.execute("DELETE FROM categories");
  await _db.execute("DELETE FROM settings");

  // Re-seed defaults
  await seedDefaults();
}

// =============================================================================
// Helper Functions
// =============================================================================

function rowToTransaction(row: unknown[]): Transaction {
  return {
    id: row[0] as number,
    date: row[1] as string,
    narration: row[2] as string,
    ref_no: row[3] as string,
    value_date: row[4] as string,
    withdrawal: row[5] as number,
    deposit: row[6] as number,
    closing_balance: row[7] as number,
    category: row[8] as string,
    merchant: row[9] as string,
  };
}

function rowToCategory(row: unknown[]): Category {
  return {
    id: row[0] as number,
    name: row[1] as string,
    color: row[2] as string,
    icon: row[3] as string,
  };
}
