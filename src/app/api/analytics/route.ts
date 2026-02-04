import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const INVESTMENT_CATEGORIES = ['Investments', 'Gold', 'Real Estate'];
const LOAN_CATEGORIES = ['Loans'];

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");

  const db = getDb();
  const conditions: string[] = [];
  const params: string[] = [];

  if (from) { conditions.push("date >= ?"); params.push(from); }
  if (to) { conditions.push("date <= ?"); params.push(to); }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  const andWhere = conditions.length ? "AND " + conditions.join(" AND ") : "";

  const totalIncome = (db.prepare(`SELECT COALESCE(SUM(deposit), 0) as v FROM transactions ${where}`).get(...params) as { v: number }).v;
  const totalWithdrawals = (db.prepare(`SELECT COALESCE(SUM(withdrawal), 0) as v FROM transactions ${where}`).get(...params) as { v: number }).v;

  // Compute totalExpenses excluding investments and loans
  const expenseExclusions = [...INVESTMENT_CATEGORIES, ...LOAN_CATEGORIES];
  const totalExpenses = (db.prepare(`
    SELECT COALESCE(SUM(withdrawal), 0) as v
    FROM transactions
    WHERE category NOT IN (${expenseExclusions.map(() => '?').join(',')}) ${andWhere}
  `).get(...expenseExclusions, ...params) as { v: number }).v;

  // Compute total investments
  const totalInvestments = (db.prepare(`
    SELECT COALESCE(SUM(withdrawal), 0) as v
    FROM transactions
    WHERE category IN (${INVESTMENT_CATEGORIES.map(() => '?').join(',')}) ${andWhere}
  `).get(...INVESTMENT_CATEGORIES, ...params) as { v: number }).v;

  // Compute total loans
  const totalLoans = (db.prepare(`
    SELECT COALESCE(SUM(withdrawal), 0) as v
    FROM transactions
    WHERE category IN (${LOAN_CATEGORIES.map(() => '?').join(',')}) ${andWhere}
  `).get(...LOAN_CATEGORIES, ...params) as { v: number }).v;

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
    SELECT strftime('%Y-%m', date) as month, SUM(withdrawal) as total
    FROM transactions WHERE category = 'Investments' AND withdrawal > 0 ${andWhere}
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

  // Balance computation — derive current balance from last transaction's closing_balance
  const lastTx = db.prepare("SELECT closing_balance FROM transactions ORDER BY date DESC, id DESC LIMIT 1").get() as { closing_balance: number } | undefined;
  const currentBalance = lastTx?.closing_balance ?? 0;

  let openingBalance = 0;
  let closingBalance = 0;

  if (to) {
    const netAfter = (db.prepare("SELECT COALESCE(SUM(deposit), 0) - COALESCE(SUM(withdrawal), 0) as v FROM transactions WHERE date > ?").get(to) as { v: number }).v;
    closingBalance = currentBalance - netAfter;
  } else {
    closingBalance = currentBalance;
  }
  openingBalance = closingBalance - (totalIncome - totalWithdrawals);

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
  });
}
