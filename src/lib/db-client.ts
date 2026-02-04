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

  // Check existing columns in category_rules table
  const tableInfo = await _db.query("PRAGMA table_info(category_rules)");
  const existingColumns = new Set(
    (tableInfo.values || []).map((row) => {
      // Column name is at index 1 in PRAGMA table_info result
      return Array.isArray(row) ? row[1] as string : (row as Record<string, string>).name;
    })
  );

  // Add columns only if they don't exist
  const columnsToAdd: [string, string][] = [
    ["condition_field", "TEXT"],
    ["condition_op", "TEXT"],
    ["condition_value", "REAL"],
    ["condition_value2", "REAL"],
  ];

  for (const [colName, colType] of columnsToAdd) {
    if (!existingColumns.has(colName)) {
      await _db.execute(`ALTER TABLE category_rules ADD COLUMN ${colName} ${colType}`);
    }
  }

  // Seed new categories if missing - use INSERT OR IGNORE to handle duplicates
  for (const [name, color, icon] of NEW_CATEGORIES) {
    await _db.run("INSERT OR IGNORE INTO categories (name, color, icon) VALUES (?, ?, ?)", [name, color, icon]);
  }
}

async function seedIfEmpty(): Promise<void> {
  if (!_db) return;

  const count = await _db.query("SELECT COUNT(*) as c FROM categories");
  // Handle different result formats from Capacitor SQLite
  let c = 0;
  if (count.values && count.values.length > 0) {
    const row = count.values[0];
    // Could be an array [count] or an object {c: count}
    c = typeof row === "object" && row !== null
      ? (Array.isArray(row) ? (row[0] as number) : ((row as Record<string, number>).c || 0))
      : 0;
  }

  if (c === 0) {
    await seedDefaults();
  }
}

async function seedDefaults(): Promise<void> {
  if (!_db) return;

  const catIds: Record<string, number> = {};

  for (const [name, color, icon] of DEFAULT_CATEGORIES) {
    // Use INSERT OR IGNORE in case category already exists
    const result = await _db.run("INSERT OR IGNORE INTO categories (name, color, icon) VALUES (?, ?, ?)", [name, color, icon]);
    if (result.changes?.lastId) {
      catIds[name] = result.changes.lastId;
    } else {
      // Category already existed, get its ID
      const existing = await _db.query("SELECT id FROM categories WHERE name = ?", [name]);
      if (existing.values && existing.values.length > 0) {
        const row = existing.values[0];
        catIds[name] = Array.isArray(row) ? (row[0] as number) : ((row as Record<string, number>).id || 0);
      }
    }
  }

  for (const [catName, keyword, priority] of DEFAULT_RULES) {
    if (catIds[catName]) {
      // Use INSERT OR IGNORE for rules too
      await _db.run("INSERT OR IGNORE INTO category_rules (category_id, keyword, priority) VALUES (?, ?, ?)", [
        catIds[catName],
        keyword,
        priority,
      ]);
    }
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
  let total = 0;
  if (countResult.values && countResult.values.length > 0) {
    const row = countResult.values[0];
    total = Array.isArray(row) ? (row[0] as number) : ((row as Record<string, number>).c || 0);
  }

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

  return (result.values || []).map((row) => {
    // Handle both array format and object format from Capacitor SQLite
    if (Array.isArray(row)) {
      return {
        id: row[0] as number,
        category_id: row[1] as number,
        keyword: row[2] as string | null,
        priority: row[3] as number,
        condition_field: row[4] as string | null,
        condition_op: row[5] as string | null,
        condition_value: row[6] as number | null,
        condition_value2: row[7] as number | null,
        category_name: row[8] as string,
      };
    }
    const obj = row as Record<string, unknown>;
    return {
      id: obj.id as number,
      category_id: obj.category_id as number,
      keyword: obj.keyword as string | null,
      priority: obj.priority as number,
      condition_field: obj.condition_field as string | null,
      condition_op: obj.condition_op as string | null,
      condition_value: obj.condition_value as number | null,
      condition_value2: obj.condition_value2 as number | null,
      category_name: obj.category_name as string,
    };
  });
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

export async function updateCategoryRule(id: number, rule: Partial<Omit<CategoryRule, "id">>): Promise<void> {
  if (!_db) throw new Error("Database not initialized");

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (rule.category_id !== undefined) {
    fields.push("category_id = ?");
    values.push(rule.category_id);
  }
  if (rule.keyword !== undefined) {
    fields.push("keyword = ?");
    values.push(rule.keyword);
  }
  if (rule.priority !== undefined) {
    fields.push("priority = ?");
    values.push(rule.priority);
  }
  if (rule.condition_field !== undefined) {
    fields.push("condition_field = ?");
    values.push(rule.condition_field);
  }
  if (rule.condition_op !== undefined) {
    fields.push("condition_op = ?");
    values.push(rule.condition_op);
  }
  if (rule.condition_value !== undefined) {
    fields.push("condition_value = ?");
    values.push(rule.condition_value);
  }
  if (rule.condition_value2 !== undefined) {
    fields.push("condition_value2 = ?");
    values.push(rule.condition_value2);
  }

  if (fields.length === 0) return;

  values.push(id);
  await _db.run(`UPDATE category_rules SET ${fields.join(", ")} WHERE id = ?`, values);
}

// =============================================================================
// Analytics Operations
// =============================================================================

const INVESTMENT_CATEGORIES = ['Investments', 'Gold', 'Real Estate'];
const LOAN_CATEGORIES = ['Loans'];

export interface FullAnalyticsResult {
  totalIncome: number;
  totalExpenses: number;
  totalInvestments: number;
  totalLoans: number;
  balance: number;
  openingBalance: number;
  closingBalance: number;
  currentBalance: number;
  byCategory: { category: string; total: number; count: number }[];
  byMonth: { month: string; expenses: number; income: number }[];
  topMerchants: { merchant: string; total: number; count: number }[];
  dailySpending: { date: string; total: number }[];
  investmentByMonth: { month: string; total: number }[];
  avgMonthlyInvestment: number;
  avgMonthlyGold: number;
  avgMonthlyRealEstate: number;
}

async function queryScalar(sql: string, params: (string | number)[] = []): Promise<number> {
  if (!_db) return 0;
  const result = await _db.query(sql, params);
  if (result.values && result.values.length > 0) {
    const row = result.values[0];
    const val = Array.isArray(row) ? row[0] : Object.values(row as Record<string, unknown>)[0];
    return (val as number) || 0;
  }
  return 0;
}

async function queryRows<T>(sql: string, params: (string | number)[] = [], mapper: (row: unknown[] | Record<string, unknown>) => T): Promise<T[]> {
  if (!_db) return [];
  const result = await _db.query(sql, params);
  return (result.values || []).map(mapper);
}

export async function getFullAnalytics(from?: string, to?: string): Promise<FullAnalyticsResult> {
  if (!_db) throw new Error("Database not initialized");

  console.log(`[db-client] getFullAnalytics: from=${from}, to=${to}`);

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (from) { conditions.push("date >= ?"); params.push(from); }
  if (to) { conditions.push("date <= ?"); params.push(to); }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  const andWhere = conditions.length ? "AND " + conditions.join(" AND ") : "";

  console.log(`[db-client] where="${where}", andWhere="${andWhere}", params=${JSON.stringify(params)}`);

  const totalIncome = await queryScalar(`SELECT COALESCE(SUM(deposit), 0) as v FROM transactions ${where}`, params);
  const totalWithdrawals = await queryScalar(`SELECT COALESCE(SUM(withdrawal), 0) as v FROM transactions ${where}`, params);

  console.log(`[db-client] totalIncome=${totalIncome}, totalWithdrawals=${totalWithdrawals}`);

  // Total expenses excluding investments and loans
  const expenseExclusions = [...INVESTMENT_CATEGORIES, ...LOAN_CATEGORIES];
  const expenseParams = [...expenseExclusions, ...params];
  const expensePlaceholders = expenseExclusions.map(() => '?').join(',');
  const totalExpenses = await queryScalar(
    `SELECT COALESCE(SUM(withdrawal), 0) as v FROM transactions WHERE category NOT IN (${expensePlaceholders}) ${andWhere}`,
    expenseParams
  );

  console.log(`[db-client] totalExpenses=${totalExpenses}, expenseExclusions=${JSON.stringify(expenseExclusions)}`);

  // Total investments
  const invPlaceholders = INVESTMENT_CATEGORIES.map(() => '?').join(',');
  const invParams = [...INVESTMENT_CATEGORIES, ...params];
  const invSql = `SELECT COALESCE(SUM(withdrawal), 0) as v FROM transactions WHERE category IN (${invPlaceholders}) ${andWhere}`;
  console.log(`[db-client] Investment SQL: ${invSql}`);
  console.log(`[db-client] Investment params: ${JSON.stringify(invParams)}`);
  const totalInvestments = await queryScalar(invSql, invParams);
  console.log(`[db-client] totalInvestments=${totalInvestments}`);

  // Debug: Check what categories actually exist in transactions
  const categoryCheck = await _db.query("SELECT DISTINCT category FROM transactions");
  console.log(`[db-client] Distinct categories in transactions:`, JSON.stringify(categoryCheck.values));

  // Debug: Check investment category counts (without date filter)
  const invCountCheck = await _db.query(
    `SELECT category, COUNT(*) as cnt, SUM(withdrawal) as total FROM transactions WHERE category IN (${invPlaceholders}) GROUP BY category`,
    INVESTMENT_CATEGORIES
  );
  console.log(`[db-client] Investment category breakdown (no date filter):`, JSON.stringify(invCountCheck.values));

  // Total loans
  const loanPlaceholders = LOAN_CATEGORIES.map(() => '?').join(',');
  const loanParams = [...LOAN_CATEGORIES, ...params];
  const loanSql = `SELECT COALESCE(SUM(withdrawal), 0) as v FROM transactions WHERE category IN (${loanPlaceholders}) ${andWhere}`;
  console.log(`[db-client] Loan SQL: ${loanSql}`);
  console.log(`[db-client] Loan params: ${JSON.stringify(loanParams)}`);
  const totalLoans = await queryScalar(loanSql, loanParams);
  console.log(`[db-client] totalLoans=${totalLoans}`);

  // Debug: Check loan category counts (without date filter)
  const loanCountCheck = await _db.query(
    `SELECT category, COUNT(*) as cnt, SUM(withdrawal) as total FROM transactions WHERE category IN (${loanPlaceholders}) GROUP BY category`,
    LOAN_CATEGORIES
  );
  console.log(`[db-client] Loan category breakdown (no date filter):`, JSON.stringify(loanCountCheck.values));

  // By category
  const byCategory = await queryRows(
    `SELECT category, SUM(withdrawal) as total, COUNT(*) as count FROM transactions WHERE withdrawal > 0 ${andWhere} GROUP BY category ORDER BY total DESC`,
    params,
    (row) => {
      const r = row as unknown[];
      const o = row as Record<string, unknown>;
      if (Array.isArray(row)) {
        return { category: r[0] as string, total: r[1] as number, count: r[2] as number };
      }
      return { category: o.category as string, total: o.total as number, count: o.count as number };
    }
  );

  // By month
  const byMonth = await queryRows(
    `SELECT strftime('%Y-%m', date) as month, SUM(withdrawal) as expenses, SUM(deposit) as income FROM transactions ${where} GROUP BY month ORDER BY month`,
    params,
    (row) => {
      const r = row as unknown[];
      const o = row as Record<string, unknown>;
      if (Array.isArray(row)) {
        return { month: r[0] as string, expenses: r[1] as number, income: r[2] as number };
      }
      return { month: o.month as string, expenses: o.expenses as number, income: o.income as number };
    }
  );

  // Top merchants
  const topMerchants = await queryRows(
    `SELECT merchant, SUM(withdrawal) as total, COUNT(*) as count FROM transactions WHERE withdrawal > 0 AND merchant != '' ${andWhere} GROUP BY merchant ORDER BY total DESC LIMIT 10`,
    params,
    (row) => {
      const r = row as unknown[];
      const o = row as Record<string, unknown>;
      if (Array.isArray(row)) {
        return { merchant: r[0] as string, total: r[1] as number, count: r[2] as number };
      }
      return { merchant: o.merchant as string, total: o.total as number, count: o.count as number };
    }
  );

  // Daily spending
  const dailySpending = await queryRows(
    `SELECT date, SUM(withdrawal) as total FROM transactions WHERE withdrawal > 0 ${andWhere} GROUP BY date ORDER BY date`,
    params,
    (row) => {
      const r = row as unknown[];
      const o = row as Record<string, unknown>;
      if (Array.isArray(row)) {
        return { date: r[0] as string, total: r[1] as number };
      }
      return { date: o.date as string, total: o.total as number };
    }
  );

  // Investment by month
  const investmentByMonth = await queryRows(
    `SELECT strftime('%Y-%m', date) as month, SUM(withdrawal) as total FROM transactions WHERE category = 'Investments' AND withdrawal > 0 ${andWhere} GROUP BY month ORDER BY month`,
    params,
    (row) => {
      const r = row as unknown[];
      const o = row as Record<string, unknown>;
      if (Array.isArray(row)) {
        return { month: r[0] as string, total: r[1] as number };
      }
      return { month: o.month as string, total: o.total as number };
    }
  );

  // Month span for averages
  const monthSpanResult = await _db.query(`SELECT MIN(date) as first_date, MAX(date) as last_date FROM transactions ${where}`, params);
  let totalMonths = 1;
  if (monthSpanResult.values && monthSpanResult.values.length > 0) {
    const row = monthSpanResult.values[0];
    const firstDate = Array.isArray(row) ? row[0] as string : (row as Record<string, string>).first_date;
    const lastDate = Array.isArray(row) ? row[1] as string : (row as Record<string, string>).last_date;
    if (firstDate && lastDate) {
      const d1 = new Date(firstDate);
      const d2 = new Date(lastDate);
      totalMonths = Math.max(1, (d2.getFullYear() - d1.getFullYear()) * 12 + d2.getMonth() - d1.getMonth() + 1);
    }
  }

  const investmentTotal = investmentByMonth.reduce((s, m) => s + m.total, 0);
  const avgMonthlyInvestment = investmentTotal / totalMonths;

  // Gold by month
  const goldByMonth = await queryRows(
    `SELECT strftime('%Y-%m', date) as month, SUM(withdrawal) as total FROM transactions WHERE category = 'Gold' AND withdrawal > 0 ${andWhere} GROUP BY month ORDER BY month`,
    params,
    (row) => {
      const r = row as unknown[];
      const o = row as Record<string, unknown>;
      if (Array.isArray(row)) {
        return { month: r[0] as string, total: r[1] as number };
      }
      return { month: o.month as string, total: o.total as number };
    }
  );
  const totalGold = goldByMonth.reduce((s, m) => s + m.total, 0);
  const avgMonthlyGold = totalGold / totalMonths;

  // Real estate by month
  const realEstateByMonth = await queryRows(
    `SELECT strftime('%Y-%m', date) as month, SUM(withdrawal) as total FROM transactions WHERE category = 'Real Estate' AND withdrawal > 0 ${andWhere} GROUP BY month ORDER BY month`,
    params,
    (row) => {
      const r = row as unknown[];
      const o = row as Record<string, unknown>;
      if (Array.isArray(row)) {
        return { month: r[0] as string, total: r[1] as number };
      }
      return { month: o.month as string, total: o.total as number };
    }
  );
  const totalRealEstate = realEstateByMonth.reduce((s, m) => s + m.total, 0);
  const avgMonthlyRealEstate = totalRealEstate / totalMonths;

  // Current balance from the very last transaction (regardless of filters)
  const lastTxGlobalResult = await _db.query("SELECT closing_balance FROM transactions ORDER BY date DESC, id DESC LIMIT 1");
  let currentBalance = 0;
  if (lastTxGlobalResult.values && lastTxGlobalResult.values.length > 0) {
    const row = lastTxGlobalResult.values[0];
    currentBalance = Array.isArray(row) ? (row[0] as number) : ((row as Record<string, number>).closing_balance ?? 0);
  }
  console.log(`[db-client] currentBalance=${currentBalance}`);

  // Opening balance: closing_balance of the first transaction in the time window
  const firstTxResult = await _db.query(
    `SELECT closing_balance FROM transactions ${where} ORDER BY date ASC, id ASC LIMIT 1`,
    params
  );
  let openingBalance = 0;
  if (firstTxResult.values && firstTxResult.values.length > 0) {
    const row = firstTxResult.values[0];
    openingBalance = Array.isArray(row) ? (row[0] as number) : ((row as Record<string, number>).closing_balance ?? 0);
  }
  console.log(`[db-client] openingBalance=${openingBalance} (first tx closing_balance)`);

  // Closing balance: closing_balance of the last transaction in the time window
  const lastTxInWindowResult = await _db.query(
    `SELECT closing_balance FROM transactions ${where} ORDER BY date DESC, id DESC LIMIT 1`,
    params
  );
  let closingBalance = 0;
  if (lastTxInWindowResult.values && lastTxInWindowResult.values.length > 0) {
    const row = lastTxInWindowResult.values[0];
    closingBalance = Array.isArray(row) ? (row[0] as number) : ((row as Record<string, number>).closing_balance ?? 0);
  }
  console.log(`[db-client] closingBalance=${closingBalance} (last tx closing_balance)`);

  return {
    totalIncome,
    totalExpenses,
    totalInvestments,
    totalLoans,
    balance: totalIncome - totalWithdrawals,
    openingBalance,
    closingBalance,
    currentBalance,
    byCategory,
    byMonth,
    topMerchants,
    dailySpending,
    investmentByMonth,
    avgMonthlyInvestment,
    avgMonthlyGold,
    avgMonthlyRealEstate,
  };
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
    const refsResult = await _db.query("SELECT ref_no FROM transactions WHERE ref_no IS NOT NULL AND ref_no != ''");
    existingRefs = new Set(
      (refsResult.values || []).map((row) => {
        // Handle both array format [ref_no] and object format {ref_no: "..."}
        if (Array.isArray(row)) {
          return row[0] as string;
        }
        return (row as Record<string, string>).ref_no;
      }).filter(Boolean)
    );
  }

  let imported = 0;
  let skipped = 0;

  console.log(`[db-client] importTransactions: ${transactions.length} transactions, checkDuplicates=${checkDuplicates}, existingRefs=${existingRefs.size}`);

  for (const t of transactions) {
    const refNo = t.ref_no?.trim() || "";
    if (checkDuplicates && refNo && existingRefs.has(refNo)) {
      console.log(`[db-client] Skipping duplicate ref_no: ${refNo}`);
      skipped++;
      continue;
    }

    await _db.run(
      `INSERT INTO transactions (date, narration, ref_no, value_date, withdrawal, deposit, closing_balance, category, merchant)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.date, t.narration, refNo || null, t.value_date, t.withdrawal, t.deposit, t.closing_balance, t.category, t.merchant]
    );
    if (refNo) {
      existingRefs.add(refNo); // Add to set for within-batch duplicate detection
    }
    imported++;
  }

  console.log(`[db-client] importTransactions complete: ${imported} imported, ${skipped} skipped`);
  return { imported, skipped };
}

// =============================================================================
// Settings Operations
// =============================================================================

export async function getSetting(key: string): Promise<string | null> {
  if (!_db) throw new Error("Database not initialized");

  const result = await _db.query("SELECT value FROM settings WHERE key = ?", [key]);
  if (result.values && result.values.length > 0) {
    const row = result.values[0];
    return Array.isArray(row) ? (row[0] as string) : ((row as Record<string, string>).value || null);
  }
  return null;
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

  console.log("[db-client] resetAllData: Starting reset...");

  try {
    // Delete in correct order for foreign key constraints
    console.log("[db-client] Deleting transactions...");
    await _db.run("DELETE FROM transactions", []);

    console.log("[db-client] Deleting category_rules...");
    await _db.run("DELETE FROM category_rules", []);

    console.log("[db-client] Deleting categories...");
    await _db.run("DELETE FROM categories", []);

    console.log("[db-client] Deleting settings...");
    await _db.run("DELETE FROM settings", []);

    console.log("[db-client] Re-seeding defaults...");
    // Re-seed defaults
    await seedDefaults();

    console.log("[db-client] resetAllData: Complete!");
  } catch (error) {
    console.error("[db-client] resetAllData error:", error);
    throw error;
  }
}

// =============================================================================
// Import Category Rules
// =============================================================================

type ImportedCategory = {
  name: string;
  color?: string;
  icon?: string;
};

type ImportedRule = {
  category_name: string;
  keyword: string | null;
  priority: number;
  condition_field?: string | null;
  condition_op?: string | null;
  condition_value?: number | null;
  condition_value2?: number | null;
};

export async function importCategoryRules(
  importedRules: ImportedRule[],
  importedCategories: ImportedCategory[] = []
): Promise<{ imported: number; skipped: number }> {
  if (!_db) throw new Error("Database not initialized");

  // Create any missing categories from the export
  if (importedCategories.length > 0) {
    for (const cat of importedCategories) {
      if (cat.name?.trim()) {
        try {
          await _db.run(
            "INSERT OR IGNORE INTO categories (name, color, icon) VALUES (?, ?, ?)",
            [cat.name.trim(), cat.color || "#6b7280", cat.icon || "tag"]
          );
        } catch {
          // Ignore duplicate errors
        }
      }
    }
  }

  // Get category map
  const categoriesResult = await _db.query("SELECT id, name FROM categories");
  const catMap = new Map<string, number>();
  for (const row of categoriesResult.values || []) {
    const id = Array.isArray(row) ? (row[0] as number) : ((row as Record<string, number>).id);
    const name = Array.isArray(row) ? (row[1] as string) : ((row as Record<string, string>).name);
    catMap.set(name, id);
  }

  let imported = 0;
  let skipped = 0;

  for (const rule of importedRules) {
    const catId = catMap.get(rule.category_name);
    if (!catId) {
      skipped++;
      continue;
    }

    // Check for duplicate
    const existing = await _db.query(
      "SELECT id FROM category_rules WHERE category_id = ? AND COALESCE(keyword, '') = ? AND COALESCE(condition_field, '') = ? AND COALESCE(condition_op, '') = ? AND COALESCE(condition_value, 0) = ?",
      [catId, rule.keyword ?? "", rule.condition_field ?? "", rule.condition_op ?? "", rule.condition_value ?? 0]
    );

    if (existing.values && existing.values.length > 0) {
      skipped++;
      continue;
    }

    await _db.run(
      "INSERT INTO category_rules (category_id, keyword, priority, condition_field, condition_op, condition_value, condition_value2) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        catId,
        rule.keyword || null,
        rule.priority ?? 5,
        rule.condition_field || null,
        rule.condition_op || null,
        rule.condition_value ?? null,
        rule.condition_value2 ?? null,
      ]
    );
    imported++;
  }

  return { imported, skipped };
}

// =============================================================================
// Categorization Operations (Client-side)
// =============================================================================

type RuleWithCategory = CategoryRule & { category_name: string };

type TxContext = {
  narration: string;
  merchant?: string;
  withdrawal?: number;
  deposit?: number;
};

function ruleMatches(rule: RuleWithCategory, ctx: TxContext): boolean {
  // Keyword match (if specified) — checks narration and merchant
  if (rule.keyword) {
    const kw = rule.keyword.toLowerCase();
    const inNarration = (ctx.narration ?? "").toLowerCase().includes(kw);
    const inMerchant = (ctx.merchant ?? "").toLowerCase().includes(kw);
    if (!inNarration && !inMerchant) return false;
  }

  // Amount condition match (if specified)
  if (rule.condition_field && rule.condition_op && rule.condition_value != null) {
    const fieldVal = rule.condition_field === "withdrawal" ? (ctx.withdrawal ?? 0) : (ctx.deposit ?? 0);
    switch (rule.condition_op) {
      case "gt": if (!(fieldVal > rule.condition_value)) return false; break;
      case "lt": if (!(fieldVal < rule.condition_value)) return false; break;
      case "gte": if (!(fieldVal >= rule.condition_value)) return false; break;
      case "lte": if (!(fieldVal <= rule.condition_value)) return false; break;
      case "eq": if (!(fieldVal === rule.condition_value)) return false; break;
      case "between":
        if (rule.condition_value2 == null) return false;
        if (!(fieldVal >= rule.condition_value && fieldVal <= rule.condition_value2)) return false;
        break;
      default: return false;
    }
  }

  // Must have at least one condition
  if (!rule.keyword && !rule.condition_field) return false;

  return true;
}

function extractMerchant(narration: string | null | undefined): string {
  if (!narration) return "";

  const upiMatch = narration.match(/^UPI-([^-]+)/i);
  if (upiMatch) return cleanMerchantName(upiMatch[1]);

  const neftMatch = narration.match(/^NEFT CR-[^-]+-([^-]+)/i);
  if (neftMatch) return cleanMerchantName(neftMatch[1]);

  const achMatch = narration.match(/^ACH D-\s*([^-]+)/i);
  if (achMatch) return cleanMerchantName(achMatch[1]);

  const salaryMatch = narration.match(/^LOWES SALARY/i);
  if (salaryMatch) return "Lowes (Employer)";

  return "";
}

function cleanMerchantName(name: string): string {
  return name
    .replace(/\b(TECHNOLOGIES?|PRIVATE|LIMITED|PVT|LTD|SOLUTIONS?|P$)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Client-side transaction categorization.
 * Uses the same logic as the server-side categorizer but reads rules from client database.
 */
export async function categorizeTransactionClient(
  narration: string,
  withdrawal?: number,
  deposit?: number
): Promise<{ category: string; merchant: string }> {
  if (!_db) throw new Error("Database not initialized");

  const rules = await getCategoryRules();

  const ctx: TxContext = { narration, withdrawal, deposit };
  let bestMatch: { category: string; priority: number } | null = null;

  for (const rule of rules) {
    if (ruleMatches(rule, ctx)) {
      if (!bestMatch || rule.priority > bestMatch.priority) {
        bestMatch = { category: rule.category_name, priority: rule.priority };
      }
    }
  }

  const merchant = extractMerchant(narration);
  return {
    category: bestMatch?.category ?? "Other",
    merchant,
  };
}

/**
 * Batch re-categorize all transactions.
 * More efficient than calling categorizeTransactionClient for each transaction.
 */
export async function recategorizeAllTransactions(): Promise<number> {
  if (!_db) throw new Error("Database not initialized");

  console.log("[db-client] recategorizeAllTransactions: Starting...");

  // Fetch rules once
  const rules = await getCategoryRules();
  console.log(`[db-client] Loaded ${rules.length} rules`);
  if (rules.length > 0) {
    console.log(`[db-client] Sample rule:`, JSON.stringify(rules[0]));
  }

  // Fetch all transactions
  const txResult = await _db.query(
    "SELECT id, narration, withdrawal, deposit, category, merchant FROM transactions"
  );
  const transactions = txResult.values || [];
  console.log(`[db-client] Found ${transactions.length} transactions to process`);
  if (transactions.length > 0) {
    console.log(`[db-client] Sample transaction row:`, JSON.stringify(transactions[0]));
  }

  let count = 0;

  for (let i = 0; i < transactions.length; i++) {
    const row = transactions[i];
    const id = Array.isArray(row) ? row[0] as number : (row as Record<string, number>).id;
    const narration = (Array.isArray(row) ? row[1] : (row as Record<string, string>).narration) as string || "";
    const withdrawal = (Array.isArray(row) ? row[2] : (row as Record<string, number>).withdrawal) as number || 0;
    const deposit = (Array.isArray(row) ? row[3] : (row as Record<string, number>).deposit) as number || 0;
    const currentCategory = (Array.isArray(row) ? row[4] : (row as Record<string, string>).category) as string || "";
    const currentMerchant = (Array.isArray(row) ? row[5] : (row as Record<string, string>).merchant) as string || "";

    const ctx: TxContext = { narration, withdrawal, deposit };
    let bestMatch: { category: string; priority: number } | null = null;

    for (const rule of rules) {
      if (ruleMatches(rule, ctx)) {
        if (!bestMatch || rule.priority > bestMatch.priority) {
          bestMatch = { category: rule.category_name, priority: rule.priority };
        }
      }
    }

    const newCategory = bestMatch?.category ?? "Other";
    const newMerchant = extractMerchant(narration);

    if (newCategory !== currentCategory || newMerchant !== currentMerchant) {
      await _db.run("UPDATE transactions SET category = ?, merchant = ? WHERE id = ?", [
        newCategory,
        newMerchant,
        id,
      ]);
      count++;
    }

    // Log progress every 100 transactions
    if ((i + 1) % 100 === 0) {
      console.log(`[db-client] Processed ${i + 1}/${transactions.length} transactions, ${count} updated`);
    }
  }

  console.log(`[db-client] recategorizeAllTransactions: Complete! Updated ${count} transactions`);
  return count;
}

// =============================================================================
// Keywords Operations
// =============================================================================

export type Keyword = {
  keyword: string;
  count: number;
  samples: string[];
  has_rule: boolean;
};

export async function getKeywords(): Promise<Keyword[]> {
  if (!_db) throw new Error("Database not initialized");

  // Get merchants with counts (non-empty merchant field)
  const merchantResult = await _db.query(`
    SELECT merchant AS keyword, COUNT(*) AS count,
      GROUP_CONCAT(narration, '|||') AS narrations
    FROM transactions
    WHERE merchant != '' AND merchant IS NOT NULL
    GROUP BY merchant
    HAVING count >= 2
    ORDER BY count DESC
    LIMIT 200
  `);

  const merchantRows = (merchantResult.values || []).map((row) => {
    if (Array.isArray(row)) {
      return { keyword: row[0] as string, count: row[1] as number, narrations: row[2] as string };
    }
    const o = row as Record<string, unknown>;
    return { keyword: o.keyword as string, count: o.count as number, narrations: o.narrations as string };
  });

  // Also extract common narration tokens (first word/token patterns)
  const tokenResult = await _db.query(`
    SELECT
      CASE
        WHEN narration LIKE 'UPI-%' THEN SUBSTR(narration, 5, INSTR(SUBSTR(narration, 5), '-') - 1)
        WHEN narration LIKE 'NEFT-%' THEN SUBSTR(narration, 6, INSTR(SUBSTR(narration, 6), '-') - 1)
        WHEN narration LIKE 'IMPS-%' THEN SUBSTR(narration, 6, INSTR(SUBSTR(narration, 6), '-') - 1)
        ELSE SUBSTR(narration, 1, INSTR(narration || ' ', ' ') - 1)
      END AS keyword,
      COUNT(*) AS count,
      GROUP_CONCAT(narration, '|||') AS narrations
    FROM transactions
    GROUP BY keyword
    HAVING count >= 3 AND LENGTH(keyword) >= 3
    ORDER BY count DESC
    LIMIT 200
  `);

  const tokenRows = (tokenResult.values || []).map((row) => {
    if (Array.isArray(row)) {
      return { keyword: row[0] as string, count: row[1] as number, narrations: row[2] as string };
    }
    const o = row as Record<string, unknown>;
    return { keyword: o.keyword as string, count: o.count as number, narrations: o.narrations as string };
  });

  // Get existing rules
  const rulesResult = await _db.query("SELECT LOWER(keyword) AS kw FROM category_rules WHERE keyword IS NOT NULL");
  const ruleSet = new Set(
    (rulesResult.values || []).map((row) => {
      if (Array.isArray(row)) return (row[0] as string || "").toLowerCase();
      return ((row as Record<string, string>).kw || "").toLowerCase();
    })
  );

  // Merge and deduplicate (merchants take priority)
  const seen = new Set<string>();
  const allKeywords: Keyword[] = [];

  for (const rows of [merchantRows, tokenRows]) {
    for (const row of rows) {
      const key = (row.keyword || "").toLowerCase().trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);

      const narrationList = (row.narrations || "").split("|||");
      const samples = narrationList.slice(0, 2);

      allKeywords.push({
        keyword: row.keyword.trim(),
        count: row.count,
        samples,
        has_rule: ruleSet.has(key),
      });
    }
  }

  // Sort by count descending
  allKeywords.sort((a, b) => b.count - a.count);

  return allKeywords;
}

// =============================================================================
// Helper Functions
// =============================================================================

function rowToTransaction(row: unknown[] | Record<string, unknown>): Transaction {
  if (Array.isArray(row)) {
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
  return {
    id: row.id as number,
    date: row.date as string,
    narration: row.narration as string,
    ref_no: row.ref_no as string,
    value_date: row.value_date as string,
    withdrawal: row.withdrawal as number,
    deposit: row.deposit as number,
    closing_balance: row.closing_balance as number,
    category: row.category as string,
    merchant: row.merchant as string,
  };
}

function rowToCategory(row: unknown[] | Record<string, unknown>): Category {
  if (Array.isArray(row)) {
    return {
      id: row[0] as number,
      name: row[1] as string,
      color: row[2] as string,
      icon: row[3] as string,
    };
  }
  return {
    id: row.id as number,
    name: row.name as string,
    color: row.color as string,
    icon: row.icon as string,
  };
}
