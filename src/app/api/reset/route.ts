import { NextResponse } from "next/server";


const isMobileBuild = process.env.BUILD_TARGET === "mobile";

export async function POST() {
  if (isMobileBuild) {
    return NextResponse.json({ error: "Not available in mobile build" }, { status: 501 });
  }

  const { getDb, seedDefaults } = await import("@/lib/db");
  const db = getDb();
  db.exec("DELETE FROM category_rules");
  db.exec("DELETE FROM transactions");
  db.exec("DELETE FROM categories");
  seedDefaults(db);
  return NextResponse.json({ success: true });
}
