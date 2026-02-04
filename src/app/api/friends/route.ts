import { NextResponse } from "next/server";

export const dynamic = "force-static";

const isMobileBuild = process.env.BUILD_TARGET === "mobile";

export async function GET() {
  if (isMobileBuild) {
    return NextResponse.json({ people: [], totalSent: 0, totalReceived: 0 });
  }

  const { getDb } = await import("@/lib/db");
  const db = getDb();

  // Aggregate Family & Friends transactions by merchant/person
  // withdrawal = you paid them (they owe you)
  // deposit = they paid you (you owe less)
  const rows = db.prepare(`
    SELECT
      CASE WHEN merchant != '' THEN merchant ELSE narration END AS person,
      SUM(withdrawal) AS sent,
      SUM(deposit) AS received,
      SUM(withdrawal) - SUM(deposit) AS net_owed,
      COUNT(*) AS txn_count,
      MIN(date) AS first_txn,
      MAX(date) AS last_txn
    FROM transactions
    WHERE category = 'Family & Friends'
    GROUP BY person
    ORDER BY net_owed DESC
  `).all() as {
    person: string;
    sent: number;
    received: number;
    net_owed: number;
    txn_count: number;
    first_txn: string;
    last_txn: string;
  }[];

  const totalSent = rows.reduce((s, r) => s + r.sent, 0);
  const totalReceived = rows.reduce((s, r) => s + r.received, 0);

  return NextResponse.json({ people: rows, totalSent, totalReceived });
}
