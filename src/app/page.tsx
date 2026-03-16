"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ScrapeProfileData, ProjectData } from "@/types";

interface SheetsConfig {
  configured: boolean;
  defaultSpreadsheetId: string;
}

export default function HomePage() {
  const router = useRouter();
  const [keywords, setKeywords] = useState("");
  const [productsPerKeyword, setProductsPerKeyword] = useState(5);
  const [randomProducts, setRandomProducts] = useState(false);
  const [scrapeMode, setScrapeMode] = useState<"full" | "fast">("full");
  const [concurrency, setConcurrency] = useState(20);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [projectName, setProjectName] = useState("");
  const [profiles, setProfiles] = useState<ScrapeProfileData[]>([]);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Google Sheets state
  const [sheetsConfig, setSheetsConfig] = useState<SheetsConfig | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [sheetTab, setSheetTab] = useState("Keywords");
  const [availableTabs, setAvailableTabs] = useState<string[]>([]);
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [syncToSheets, setSyncToSheets] = useState(false);

  useEffect(() => {
    fetch("/api/profiles")
      .then((r) => r.json())
      .then((data) => {
        setProfiles(data);
        if (data.length > 0 && !profileId) setProfileId(data[0].id);
      });
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects);
    fetch("/api/sheets/config")
      .then((r) => r.json())
      .then((config: SheetsConfig) => {
        setSheetsConfig(config);
        if (config.defaultSpreadsheetId) {
          setSpreadsheetId(config.defaultSpreadsheetId);
          setSyncToSheets(true);
        }
      })
      .catch(() => {});
  }, []);

  const keywordCount = keywords
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean).length;

  async function handleLoadTabs() {
    if (!spreadsheetId) return;
    setSheetsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/sheets/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadsheetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAvailableTabs(data.tabs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tabs");
    } finally {
      setSheetsLoading(false);
    }
  }

  async function handleLoadKeywords() {
    if (!spreadsheetId) {
      setError("Enter a Google Sheet ID");
      return;
    }
    setSheetsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ spreadsheetId, tab: sheetTab });
      const res = await fetch(`/api/sheets/keywords?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setKeywords(data.keywords.join("\n"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load keywords");
    } finally {
      setSheetsLoading(false);
    }
  }

  async function handleRunBatch() {
    setError("");
    const lines = keywords
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setError("Enter at least one keyword");
      return;
    }
    if (lines.length > 10000) {
      setError("Maximum 10,000 keywords allowed");
      return;
    }
    if (!profileId) {
      setError("Select a scrape profile");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: lines,
          profileId,
          productsPerKeyword,
          randomProducts,
          scrapeMode,
          concurrency,
          name: projectName || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create project");
      }
      const project = await res.json();

      await fetch(`/api/projects/${project.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetsSpreadsheetId: syncToSheets && spreadsheetId ? spreadsheetId : undefined,
        }),
      });

      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Amazon Roundup Scout</h1>
        <p className="text-gray-600 mt-1">
          Paste keywords or load them from Google Sheets. Results auto-sync back when configured.
        </p>
      </div>

      {/* Google Sheets Panel */}
      {sheetsConfig?.configured && (
        <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z"/>
            </svg>
            <h3 className="font-medium text-emerald-900 text-sm">Google Sheets Integration</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-emerald-800 mb-1">
                Spreadsheet ID
              </label>
              <input
                type="text"
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                onBlur={handleLoadTabs}
                className="w-full border border-emerald-300 rounded-md px-3 py-1.5 text-sm bg-white"
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
              />
              <p className="text-[10px] text-emerald-600 mt-0.5">From the Sheet URL after /d/</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-emerald-800 mb-1">
                Keywords Tab
              </label>
              <div className="flex gap-1">
                {availableTabs.length > 0 ? (
                  <select
                    value={sheetTab}
                    onChange={(e) => setSheetTab(e.target.value)}
                    className="flex-1 border border-emerald-300 rounded-md px-3 py-1.5 text-sm bg-white"
                  >
                    {availableTabs.map((tab) => (
                      <option key={tab} value={tab}>{tab}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={sheetTab}
                    onChange={(e) => setSheetTab(e.target.value)}
                    className="flex-1 border border-emerald-300 rounded-md px-3 py-1.5 text-sm bg-white"
                  />
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleLoadKeywords}
                disabled={sheetsLoading || !spreadsheetId}
                className="bg-emerald-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {sheetsLoading ? "Loading..." : "Load Keywords"}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-emerald-800">
            <input
              type="checkbox"
              checked={syncToSheets}
              onChange={(e) => setSyncToSheets(e.target.checked)}
            />
            Auto-sync results back to this spreadsheet when batch completes
          </label>
        </div>
      )}

      {!sheetsConfig?.configured && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 text-sm text-gray-500">
          Google Sheets integration available. Set <code className="text-xs bg-gray-100 px-1 rounded">GOOGLE_SERVICE_ACCOUNT_JSON</code> in your .env to enable.
        </div>
      )}

      {/* Keywords + Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">
              Keywords (one per line)
            </label>
            <span className="text-xs text-gray-500">{keywordCount} keywords</span>
          </div>
          <textarea
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            rows={8}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={"best robotic pool cleaners for inground pools\nbest robotic pool cleaners for above ground pools\nbest cordless robotic pool cleaners"}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Name (optional)
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="Auto-generated from first keyword"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scrape Profile
            </label>
            <select
              value={profileId || ""}
              onChange={(e) => setProfileId(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              {profiles
                .filter((p) => p.enabled)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.domain})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mode
            </label>
            <select
              value={scrapeMode}
              onChange={(e) => setScrapeMode(e.target.value as "full" | "fast")}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="fast">Fast — search page only (1 call/keyword)</option>
              <option value="full">Full — visit each product page (1 + N calls/keyword)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end mt-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Products/keyword: {productsPerKeyword}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={5}
                max={15}
                value={productsPerKeyword}
                onChange={(e) => setProductsPerKeyword(Number(e.target.value))}
                className="flex-1"
              />
              <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={randomProducts}
                  onChange={(e) => setRandomProducts(e.target.checked)}
                />
                Random (5–{productsPerKeyword})
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Concurrency: {concurrency}
            </label>
            <input
              type="range"
              min={1}
              max={25}
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">
              ScrapeOwl slots (lower if ZimmWriter is running)
            </p>
          </div>

          <div className="text-xs text-gray-500 bg-gray-50 rounded-md p-2">
            <strong>Est. calls:</strong>{" "}
            {scrapeMode === "fast"
              ? `${keywordCount} (1 per keyword)`
              : `~${keywordCount * (1 + (randomProducts ? Math.round((5 + productsPerKeyword) / 2) : productsPerKeyword))} (1 + ${randomProducts ? `5–${productsPerKeyword}` : productsPerKeyword} per keyword)`}
          </div>

          <button
            onClick={handleRunBatch}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 h-[38px]"
          >
            {loading ? "Starting..." : "Run Batch"}
          </button>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>

      {/* Recent Projects */}
      {projects.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Projects</h2>
          <div className="space-y-2">
            {projects.map((p) => (
              <a
                key={p.id}
                href={`/projects/${p.id}`}
                className="flex items-center justify-between p-3 rounded-md hover:bg-gray-50 border border-gray-100"
              >
                <div>
                  <span className="font-medium text-sm">{p.name}</span>
                  <span className="text-gray-500 text-xs ml-2">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-600">
                    {p.completedKeywords}/{p.totalKeywords} done
                  </span>
                  {p.failedKeywords > 0 && (
                    <span className="text-red-600">{p.failedKeywords} failed</span>
                  )}
                  <StatusBadge status={p.status} />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-gray-100 text-gray-700",
    running: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.pending}`}
    >
      {status}
    </span>
  );
}
