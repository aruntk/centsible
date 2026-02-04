import { NextResponse } from "next/server";
import pkg from "../../../../package.json";


const isMobileBuild = process.env.BUILD_TARGET === "mobile";

export async function GET() {
  if (isMobileBuild) {
    return NextResponse.json({ currentVersion: pkg.version, releases: [] });
  }

  try {
    const currentVersion = pkg.version;

    const res = await fetch(
      "https://api.github.com/repos/aruntk/centsible/releases",
      {
        headers: { Accept: "application/vnd.github+json" },
        next: { revalidate: 300 },
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `GitHub API returned ${res.status}` },
        { status: 502 }
      );
    }

    const releases = await res.json();

    const mapped = releases.map(
      (r: {
        tag_name: string;
        name: string;
        body: string;
        published_at: string;
        html_url: string;
        prerelease: boolean;
        draft: boolean;
        assets: { name: string; browser_download_url: string; size: number }[];
      }) => ({
        tag: r.tag_name,
        version: r.tag_name.replace(/^v/, ""),
        name: r.name || r.tag_name,
        body: r.body || "",
        publishedAt: r.published_at,
        url: r.html_url,
        prerelease: r.prerelease,
        draft: r.draft,
        assets: r.assets.map((a) => ({
          name: a.name,
          downloadUrl: a.browser_download_url,
          size: a.size,
        })),
      })
    );

    return NextResponse.json({ currentVersion, releases: mapped });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
