import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/server-logger";


const isMobileBuild = process.env.BUILD_TARGET === "mobile";

export async function GET(req: NextRequest) {
  if (isMobileBuild) {
    return NextResponse.json({
      totalIncome: 0,
      totalExpenses: 0,
      totalInvestments: 0,
      totalLoans: 0,
      balance: 0,
      openingBalance: 0,
      closingBalance: 0,
      currentBalance: 0,
      byCategory: [],
      byMonth: [],
      topMerchants: [],
      dailySpending: [],
      investmentByMonth: [],
      avgMonthlyInvestment: 0,
      avgMonthlyGold: 0,
      avgMonthlyRealEstate: 0,
      avgMonthlyExpense: 0,
    });
  }

  const sp = req.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");

  logger.info("analytics", `GET /api/analytics - from=${from}, to=${to}`);

  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const conditions: string[] = [];
  const params: string[] = [];

  if (from) { conditions.push("date >= ?"); params.push(from); }
  if (to) { conditions.push("date <= ?"); params.push(to); }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  const andWhere = conditions.length ? "AND " + conditions.join(" AND ") : "";

  // Total income: sum of deposits from income category_group
  const totalIncome = (db.prepare(`
    SELECT COALESCE(SUM(t.deposit), 0) as v
    FROM transactions t
    LEFT JOIN categories c ON t.category = c.name
    WHERE c.category_group = 'income' ${andWhere.replace(/date/g, 't.date')}
  `).get(...params) as { v: number }).v;

  const totalWithdrawals = (db.prepare(`SELECT COALESCE(SUM(withdrawal), 0) as v FROM transactions ${where}`).get(...params) as { v: number }).v;

  // Total expenses: withdrawals from living_expenditure category_group
  const totalExpenses = (db.prepare(`
    SELECT COALESCE(SUM(t.withdrawal), 0) as v
    FROM transactions t
    LEFT JOIN categories c ON t.category = c.name
    WHERE c.category_group = 'living_expenditure' ${andWhere.replace(/date/g, 't.date')}
  `).get(...params) as { v: number }).v;

  // Total investments: withdrawals from investment category_group
  const totalInvestments = (db.prepare(`
    SELECT COALESCE(SUM(t.withdrawal), 0) as v
    FROM transactions t
    LEFT JOIN categories c ON t.category = c.name
    WHERE c.category_group = 'investment' ${andWhere.replace(/date/g, 't.date')}
  `).get(...params) as { v: number }).v;

  // Total loans: withdrawals from loan category_group
  const totalLoans = (db.prepare(`
    SELECT COALESCE(SUM(t.withdrawal), 0) as v
    FROM transactions t
    LEFT JOIN categories c ON t.category = c.name
    WHERE c.category_group = 'loan' ${andWhere.replace(/date/g, 't.date')}
  `).get(...params) as { v: number }).v;

  const byCategory = db.prepare(`
    SELECT category, SUM(withdrawal) as total, COUNT(*) as count
    FROM transactions WHERE withdrawal > 0 ${andWhere}
    GROUP BY category ORDER BY total DESC
  `).all(...params) as { category: string; total: number; count: number }[];

  const byMonth = db.prepare(`
    SELECT strftime('%Y-%m', date) as month,
           SUM(withdrawal) as expenses,
           SUM(deposit) as income
    FROM transactions ${where}
    GROUP BY month ORDER BY month
  `).all(...params) as { month: string; expenses: number; income: number }[];

  const topMerchants = db.prepare(`
    SELECT merchant, SUM(withdrawal) as total, COUNT(*) as count
    FROM transactions WHERE withdrawal > 0 AND merchant != '' ${andWhere}
    GROUP BY merchant ORDER BY total DESC LIMIT 10
  `).all(...params) as { merchant: string; total: number; count: number }[];

  const dailySpending = db.prepare(`
    SELECT date, SUM(withdrawal) as total
    FROM transactions WHERE withdrawal > 0 ${andWhere}
    GROUP BY date ORDER BY date
  `).all(...params) as { date: string; total: number }[];

  const investmentByMonth = db.prepare(`
    SELECT strftime('%Y-%m', t.date) as month, SUM(t.withdrawal) as total
    FROM transactions t
    LEFT JOIN categories c ON t.category = c.name
    WHERE c.category_group = 'investment' AND t.withdrawal > 0 ${andWhere.replace(/date/g, 't.date')}
    GROUP BY month ORDER BY month
  `).all(...params) as { month: string; total: number }[];

  // Total months span (first to last transaction) for accurate monthly averages
  const monthSpan = db.prepare(`
    SELECT MIN(date) as first_date, MAX(date) as last_date FROM transactions ${where}
  `).get(...params) as { first_date: string | null; last_date: string | null };

  let totalMonths = 1;
  if (monthSpan.first_date && monthSpan.last_date) {
    const d1 = new Date(monthSpan.first_date);
    const d2 = new Date(monthSpan.last_date);
    totalMonths = Math.max(1, (d2.getFullYear() - d1.getFullYear()) * 12 + d2.getMonth() - d1.getMonth() + 1);
  }

  const investmentCategoryTotal = investmentByMonth.reduce((s, m) => s + m.total, 0);
  const avgMonthlyInvestment = investmentCategoryTotal / totalMonths;

  // Current balance from the very last transaction (regardless of filters)
  const lastTxGlobal = db.prepare("SELECT closing_balance FROM transactions ORDER BY date DESC, id DESC LIMIT 1").get() as { closing_balance: number } | undefined;
  const currentBalance = lastTxGlobal?.closing_balance ?? 0;

  // Opening balance: closing_balance of the first transaction in the time window
  const firstTxInWindow = db.prepare(
    `SELECT closing_balance FROM transactions ${where} ORDER BY date ASC, id ASC LIMIT 1`
  ).get(...params) as { closing_balance: number } | undefined;
  const openingBalance = firstTxInWindow?.closing_balance ?? 0;

  // Closing balance: closing_balance of the last transaction in the time window
  const lastTxInWindow = db.prepare(
    `SELECT closing_balance FROM transactions ${where} ORDER BY date DESC, id DESC LIMIT 1`
  ).get(...params) as { closing_balance: number } | undefined;
  const closingBalance = lastTxInWindow?.closing_balance ?? 0;

  const goldByMonth = db.prepare(`
    SELECT strftime('%Y-%m', date) as month, SUM(withdrawal) as total
    FROM transactions WHERE category = 'Gold' AND withdrawal > 0 ${andWhere}
    GROUP BY month ORDER BY month
  `).all(...params) as { month: string; total: number }[];

  const totalGold = goldByMonth.reduce((s, m) => s + m.total, 0);
  const avgMonthlyGold = totalGold / totalMonths;

  const realEstateByMonth = db.prepare(`
    SELECT strftime('%Y-%m', date) as month, SUM(withdrawal) as total
    FROM transactions WHERE category = 'Real Estate' AND withdrawal > 0 ${andWhere}
    GROUP BY month ORDER BY month
  `).all(...params) as { month: string; total: number }[];

  const totalRealEstate = realEstateByMonth.reduce((s, m) => s + m.total, 0);
  const avgMonthlyRealEstate = totalRealEstate / totalMonths;

  const avgMonthlyExpense = totalExpenses / totalMonths;

  return NextResponse.json({
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
    avgMonthlyExpense,
  });
}
