"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ScrapeProfileData, ProjectData } from "@/types";
import { parseKeywordInput } from "@/lib/parsing/keyword-parser";

interface SheetsConfig {
  configured: boolean;
  defaultSpreadsheetId: string;
  sheetName: string;
}

export default function HomePage() {
  const router = useRouter();
  const [keywords, setKeywords] = useState("");
  const [productsPerKeyword, setProductsPerKeyword] = useState(15);
  const [randomProducts, setRandomProducts] = useState(true);
  const [randomMin, setRandomMin] = useState(7);
  const [scrapeMode, setScrapeMode] = useState<"full" | "fast">("fast");
  const [concurrency, setConcurrency] = useState(20);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [projectName, setProjectName] = useState("");
  const [profiles, setProfiles] = useState<ScrapeProfileData[]>([]);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [maxConcurrent, setMaxConcurrent] = useState(45);

  // Google Sheets state
  const [sheetsConfig, setSheetsConfig] = useState<SheetsConfig | null>(null);
  const [sheetTab, setSheetTab] = useState("");
  const [availableTabs, setAvailableTabs] = useState<string[]>([]);
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [syncToSheets, setSyncToSheets] = useState(false);
  const [bulkQueueing, setBulkQueueing] = useState(false);

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
    Promise.all([
      fetch("/api/scrapers").then((r) => r.json()),
      fetch("/api/settings/general").then((r) => r.json()),
    ]).then(([scraperData, generalData]) => {
      const scraperMax = scraperData.maxConcurrent || 45;
      const globalMax = generalData.maxConcurrency || 45;
      const effectiveMax = Math.min(scraperMax, globalMax);
      setMaxConcurrent(effectiveMax);
      if (concurrency > effectiveMax) setConcurrency(effectiveMax);
    }).catch(() => {});
    fetch("/api/sheets/config")
      .then((r) => r.json())
      .then((config: SheetsConfig) => {
        setSheetsConfig(config);
        if (config.defaultSpreadsheetId) {
          setSyncToSheets(true);
          // Load available tabs
          fetch("/api/sheets/keywords", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ spreadsheetId: config.defaultSpreadsheetId }),
          })
            .then((r) => r.json())
            .then((data) => {
              if (data.tabs) {
                setAvailableTabs(data.tabs);
                if (data.tabs.length > 0 && !sheetTab) {
                  setSheetTab(data.tabs[0]);
                  setProjectName(data.tabs[0]);
                }
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const parsed = parseKeywordInput(keywords);

  async function handleLoadKeywords() {
    const sid = sheetsConfig?.defaultSpreadsheetId;
    if (!sid) {
      setError("No spreadsheet configured. Go to Settings to set one up.");
      return;
    }
    setSheetsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ spreadsheetId: sid, tab: sheetTab || '' });
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

  async function handleBulkQueue() {
    if (!sheetsConfig?.defaultSpreadsheetId || !profileId) return;
    setBulkQueueing(true);
    setError("");
    try {
      const res = await fetch("/api/bulk-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spreadsheetId: sheetsConfig.defaultSpreadsheetId,
          tabNames: availableTabs,
          profileId,
          productsPerKeyword,
          concurrency,
          randomProducts,
          randomMin,
          scrapeMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Refresh project list
      const projRes = await fetch("/api/projects");
      setProjects(await projRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk queue failed");
    } finally {
      setBulkQueueing(false);
    }
  }

  async function handleRunBatch() {
    setError("");

    if (parsed.groups.length === 0) {
      setError("Enter at least one keyword");
      return;
    }
    if (parsed.errors.length > 0) {
      setError("Fix errors in the input before running");
      return;
    }
    if (parsed.keywordCount > 10000) {
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
          keywords: parsed.groups,
          profileId,
          productsPerKeyword,
          randomProducts,
          randomMin,
          scrapeMode,
          concurrency,
          name: projectName || undefined,
          sheetsSpreadsheetId: syncToSheets && sheetsConfig?.defaultSpreadsheetId ? sheetsConfig.defaultSpreadsheetId : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
        throw new Error(data.error || "Failed to create project");
      }
      const project = await res.json();
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
        <h1 className="text-2xl font-bold text-gray-900">RoundupForge</h1>
        <p className="text-gray-600 mt-1">
          Amazon Roundup Scout — Paste keywords or load them from Google Sheets.
          A free tool by{" "}
          <a
            href="https://grimfaste.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-600 hover:underline"
          >
            Grimfaste
          </a>.
        </p>
      </div>

      {/* Google Sheets Panel */}
      {sheetsConfig?.configured && sheetsConfig.defaultSpreadsheetId && (
        <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z"/>
              </svg>
              <div>
                <h3 className="font-medium text-emerald-900 text-sm">
                  {sheetsConfig.sheetName || "Google Sheet"}
                </h3>
                <p className="text-[10px] text-emerald-600">Connected via Settings</p>
              </div>
            </div>
            <a href="/settings" className="text-xs text-emerald-700 hover:underline">Change</a>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-emerald-800 mb-1">
                Load keywords from tab
              </label>
              {availableTabs.length > 0 ? (
                <select
                  value={sheetTab}
                  onChange={(e) => { setSheetTab(e.target.value); setProjectName(e.target.value); }}
                  className="w-full border border-emerald-300 rounded-md px-3 py-1.5 text-sm bg-white"
                >
                  {availableTabs.map((tab) => (
                    <option key={tab} value={tab}>{tab}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={sheetTab}
                  onChange={(e) => { setSheetTab(e.target.value); setProjectName(e.target.value); }}
                  className="w-full border border-emerald-300 rounded-md px-3 py-1.5 text-sm bg-white"
                  placeholder="Sheet1"
                />
              )}
            </div>
            <button
              onClick={handleLoadKeywords}
              disabled={sheetsLoading}
              className="bg-emerald-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {sheetsLoading ? "Loading..." : "Load Keywords"}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-emerald-800">
              <input
                type="checkbox"
                checked={syncToSheets}
                onChange={(e) => setSyncToSheets(e.target.checked)}
              />
              Auto-sync results back when batch completes
            </label>
            {availableTabs.length > 1 && (
              <button
                onClick={handleBulkQueue}
                disabled={bulkQueueing || !profileId}
                className="bg-emerald-700 text-white px-3 py-1 rounded-md text-xs font-medium hover:bg-emerald-800 disabled:opacity-50"
              >
                {bulkQueueing ? "Queuing..." : `Queue All ${availableTabs.length} Tabs`}
              </button>
            )}
          </div>
        </div>
      )}

      {sheetsConfig?.configured && !sheetsConfig.defaultSpreadsheetId && (
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-3 text-sm text-yellow-800">
          Google Sheets connected but no spreadsheet set. <a href="/settings" className="font-medium underline">Go to Settings</a> to configure one.
        </div>
      )}

      {!sheetsConfig?.configured && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 text-sm text-gray-500">
          Google Sheets integration available. <a href="/settings" className="text-blue-600 hover:underline">Go to Settings</a> to set it up.
        </div>
      )}

      {/* Keywords + Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">
              Keywords & Product URLs
            </label>
            <span className="text-xs text-gray-500">
              {parsed.keywordCount} keyword{parsed.keywordCount !== 1 ? "s" : ""}
              {parsed.productCount > 0 && ` · ${parsed.productCount} product${parsed.productCount !== 1 ? "s" : ""}`}
            </span>
          </div>
          <textarea
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            rows={8}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={"best robotic pool cleaners for inground pools\nhttps://www.amazon.com/dp/B07C4P8MBL\nhttps://www.amazon.com/dp/B07BHTBDQ3\n\nbest cordless robotic pool cleaners"}
          />
          {/* Live Preview */}
          {parsed.groups.length > 0 && (
            <div className="mt-2 space-y-1">
              {parsed.errors.length > 0 && (
                <div className="text-red-600 text-xs space-y-0.5">
                  {parsed.errors.map((err, i) => (
                    <p key={i}>{err}</p>
                  ))}
                </div>
              )}
              <div className="bg-gray-50 rounded-md border border-gray-200 p-3 space-y-1 max-h-40 overflow-y-auto">
                {parsed.groups.map((g, i) => (
                  <div key={i} className="text-xs text-gray-600 flex justify-between">
                    <span className="font-medium text-gray-800 truncate mr-2">{g.keyword}</span>
                    <span className="shrink-0">
                      {g.urls.length > 0
                        ? `${g.urls.length} product${g.urls.length !== 1 ? "s" : ""}`
                        : "will search Amazon"}
                    </span>
                  </div>
                ))}
              </div>
              {scrapeMode === "fast" && parsed.productCount > 0 && (
                <p className="text-xs text-blue-600">
                  Direct product URLs always use full scrape mode (1 API call per product)
                </p>
              )}
            </div>
          )}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start mt-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Products/keyword: {randomProducts ? `${randomMin}–${productsPerKeyword}` : productsPerKeyword}
            </label>
            <input
              type="range"
              min={3}
              max={15}
              value={productsPerKeyword}
              onChange={(e) => {
                const v = Number(e.target.value);
                setProductsPerKeyword(v);
                if (randomMin > v) setRandomMin(v);
              }}
              className="w-full"
            />
            <div className="flex items-center gap-3 mt-1.5">
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={randomProducts}
                  onChange={(e) => setRandomProducts(e.target.checked)}
                />
                Random
              </label>
              {randomProducts && (
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span>min:</span>
                  <input
                    type="number"
                    min={3}
                    max={productsPerKeyword}
                    value={randomMin}
                    onChange={(e) => setRandomMin(Math.min(Math.max(3, Number(e.target.value)), productsPerKeyword))}
                    className="w-14 border border-gray-300 rounded px-2 py-0.5 text-center text-xs"
                  />
                  <span>max: {productsPerKeyword}</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Concurrency: {concurrency}
            </label>
            <input
              type="range"
              min={1}
              max={maxConcurrent}
              value={Math.min(concurrency, maxConcurrent)}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-[10px] text-gray-400 mt-1.5">
              Max {maxConcurrent} (from ScrapeOwl plan). Lower if ZimmWriter is running.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end mt-3">
          <div className="text-xs text-gray-500 bg-gray-50 rounded-md p-2">
            <strong>Est. calls:</strong>{" "}
            {(() => {
              const searchKeywords = parsed.groups.filter((g) => g.urls.length === 0).length;
              const directProducts = parsed.productCount;
              const perSearchKeyword = scrapeMode === "fast"
                ? 1
                : 1 + (randomProducts ? Math.round((randomMin + productsPerKeyword) / 2) : productsPerKeyword);
              const total = searchKeywords * perSearchKeyword + directProducts;
              const parts: string[] = [];
              if (searchKeywords > 0) parts.push(`${searchKeywords * perSearchKeyword} from ${searchKeywords} search keyword${searchKeywords !== 1 ? "s" : ""}`);
              if (directProducts > 0) parts.push(`${directProducts} from direct URLs`);
              return parts.length > 0 ? `~${total} (${parts.join(" + ")})` : "0";
            })()}
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
  const isRetrying = status.startsWith("retrying");
  const colors: Record<string, string> = {
    pending: "bg-gray-100 text-gray-700",
    queued: "bg-yellow-100 text-yellow-700",
    running: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  };
  const colorClass = isRetrying
    ? "bg-amber-100 text-amber-700"
    : colors[status] || colors.pending;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {isRetrying ? "retrying" : status}
    </span>
  );
}
