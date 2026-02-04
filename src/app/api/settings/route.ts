import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-static";

const isMobileBuild = process.env.BUILD_TARGET === "mobile";

export async function GET() {
  if (isMobileBuild) {
    return NextResponse.json({});
  }

  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  if (isMobileBuild) {
    return NextResponse.json({ error: "Not available in mobile build" }, { status: 501 });
  }

  const { key, value } = await req.json();
  if (!key || typeof key !== "string") {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, String(value));
  return NextResponse.json({ ok: true });
}
