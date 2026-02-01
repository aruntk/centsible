import { NextRequest, NextResponse } from "next/server";
import { getDb, type Transaction } from "@/lib/db";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const category = sp.get("category");
  const search = sp.get("search");
  const from = sp.get("from");
  const to = sp.get("to");
  const page = parseInt(sp.get("page") || "1");
  const limit = parseInt(sp.get("limit") || "50");
  const offset = (page - 1) * limit;

  const db = getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (category && category !== "All") {
    conditions.push("category = ?");
    params.push(category);
  }
  if (search) {
    conditions.push("(narration LIKE ? OR merchant LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  const merchant = sp.get("merchant");
  if (merchant) {
    conditions.push("merchant = ?");
    params.push(merchant);
  }
  if (from) {
    conditions.push("date >= ?");
    params.push(from);
  }
  if (to) {
    conditions.push("date <= ?");
    params.push(to);
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const total = (db.prepare(`SELECT COUNT(*) as c FROM transactions ${where}`).get(...params) as { c: number }).c;
  const transactions = db.prepare(
    `SELECT * FROM transactions ${where} ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset) as Transaction[];

  return NextResponse.json({ transactions, total, page, limit });
}
