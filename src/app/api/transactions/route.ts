import { NextRequest, NextResponse } from "next/server";
import type { Transaction } from "@/lib/db";
import { logger } from "@/lib/server-logger";


const isMobileBuild = process.env.BUILD_TARGET === "mobile";

export async function GET(req: NextRequest) {
  if (isMobileBuild) {
    return NextResponse.json({ transactions: [], total: 0, page: 1, limit: 50 });
  }

  const sp = req.nextUrl.searchParams;
  logger.debug("transactions", "GET /api/transactions", {
    category: sp.get("category"),
    search: sp.get("search"),
    from: sp.get("from"),
    to: sp.get("to"),
    page: sp.get("page"),
  });
  const category = sp.get("category");
  const search = sp.get("search");
  const from = sp.get("from");
  const to = sp.get("to");
  const page = parseInt(sp.get("page") || "1");
  const limit = parseInt(sp.get("limit") || "50");
  const offset = (page - 1) * limit;

  const { getDb } = await import("@/lib/db");
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

  logger.info("transactions", `Fetched ${transactions.length} of ${total} transactions`);
  return NextResponse.json({ transactions, total, page, limit });
}

export async function POST(req: NextRequest) {
  if (isMobileBuild) {
    return NextResponse.json({ error: "Not available in mobile build" }, { status: 501 });
  }

  const body = await req.json();
  const { date, narration, withdrawal, deposit, category, merchant, ref_no, closing_balance } = body;

  logger.info("transactions", "POST /api/transactions - Creating transaction", {
    date,
    narration: narration?.substring(0, 50),
    category,
  });

  if (!date || !narration) {
    logger.warn("transactions", "Missing required fields", { date, narration });
    return NextResponse.json({ error: "Date and narration are required" }, { status: 400 });
  }

  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const result = db.prepare(
    `INSERT INTO transactions (date, narration, ref_no, value_date, withdrawal, deposit, closing_balance, category, merchant)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    date,
    narration,
    ref_no || null,
    date,
    withdrawal || 0,
    deposit || 0,
    closing_balance || 0,
    category || "Other",
    merchant || "",
  );

  logger.info("transactions", `Created transaction id=${result.lastInsertRowid}`);
  return NextResponse.json({ id: result.lastInsertRowid });
}
