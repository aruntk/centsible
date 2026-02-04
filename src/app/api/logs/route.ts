import { NextRequest, NextResponse } from "next/server";
import { getServerLogs, clearServerLogs } from "@/lib/server-logger";

export const dynamic = "force-static";

const isMobileBuild = process.env.BUILD_TARGET === "mobile";

export async function GET(request: NextRequest) {
  if (isMobileBuild) {
    return NextResponse.json({ logs: [] });
  }

  const sinceId = request.nextUrl.searchParams.get("since");
  const logs = getServerLogs(sinceId ? parseInt(sinceId, 10) : undefined);
  return NextResponse.json({ logs });
}

export async function DELETE() {
  if (isMobileBuild) {
    return NextResponse.json({ success: true });
  }
  clearServerLogs();
  return NextResponse.json({ success: true });
}
