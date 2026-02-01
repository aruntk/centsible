"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Download, ExternalLink, CheckCircle, ArrowUp } from "lucide-react";

type Asset = {
  name: string;
  downloadUrl: string;
  size: number;
};

type Release = {
  tag: string;
  version: string;
  name: string;
  body: string;
  publishedAt: string;
  url: string;
  prerelease: boolean;
  draft: boolean;
  assets: Asset[];
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

export default function UpdatesPage() {
  const [currentVersion, setCurrentVersion] = useState("");
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    fetch("/api/updates")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
        } else {
          setCurrentVersion(d.currentVersion);
          setReleases(d.releases.filter((r: Release) => !r.draft));
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const stableReleases = releases.filter((r) => !r.prerelease);
  const latest = stableReleases[0];
  const hasUpdate = latest && compareVersions(latest.version, currentVersion) > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Updates</h1>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 border dark:border-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Check for Updates
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Current Version</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">v{currentVersion || "..."}</p>
          </div>
          {!loading && !error && (
            hasUpdate ? (
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <ArrowUp className="w-5 h-5" />
                <span className="text-sm font-medium">Update available</span>
              </div>
            ) : latest ? (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">Up to date</span>
              </div>
            ) : null
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-400">
          Failed to check for updates: {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-10 text-gray-400">Checking for updates...</div>
      )}

      {!loading && !error && releases.length === 0 && (
        <div className="text-center py-10 text-gray-400">No releases found.</div>
      )}

      {!loading && releases.map((release) => {
        const isCurrent = release.version === currentVersion;
        const isNewer = compareVersions(release.version, currentVersion) > 0;

        return (
          <div
            key={release.tag}
            className={`bg-white dark:bg-gray-900 rounded-xl border shadow-sm overflow-hidden ${
              isNewer
                ? "border-blue-300 dark:border-blue-700"
                : "dark:border-gray-800"
            }`}
          >
            <div className="px-5 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">{release.name}</h2>
                  {isCurrent && (
                    <span className="text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                      current
                    </span>
                  )}
                  {release.prerelease && (
                    <span className="text-xs bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full font-medium">
                      pre-release
                    </span>
                  )}
                  {isNewer && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
                      new
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {formatDate(release.publishedAt)}
                </p>
              </div>
              <a
                href={release.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            {release.body && (
              <div className="px-5 pb-3">
                <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-sans leading-relaxed">
                  {release.body}
                </pre>
              </div>
            )}

            {release.assets.length > 0 && (
              <div className="border-t dark:border-gray-800 px-5 py-3 space-y-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Downloads</p>
                <div className="flex flex-wrap gap-2">
                  {release.assets.map((asset) => (
                    <a
                      key={asset.name}
                      href={asset.downloadUrl}
                      className="inline-flex items-center gap-1.5 border dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[200px]">{asset.name}</span>
                      <span className="text-xs text-gray-400">({formatBytes(asset.size)})</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
