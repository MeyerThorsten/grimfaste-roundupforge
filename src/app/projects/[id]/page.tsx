"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { ProjectData, KeywordWithProducts, ProductData } from "@/types";

interface SheetsConfig {
  configured: boolean;
  defaultSpreadsheetId: string;
}

export default function ProjectResultsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<ProjectData | null>(null);
  const [keywords, setKeywords] = useState<KeywordWithProducts[]>([]);
  const [expandedKeyword, setExpandedKeyword] = useState<number | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [runStartTime, setRunStartTime] = useState<number | null>(null);
  const [liveElapsed, setLiveElapsed] = useState(0);
  const [sheetsConfig, setSheetsConfig] = useState<SheetsConfig | null>(null);
  const [sheetsSaving, setSheetsSaving] = useState(false);
  const [sheetsResult, setSheetsResult] = useState<string | null>(null);
  const [roundupPacks, setRoundupPacks] = useState<{ pack: number; totalPacks: number; filename: string; content: string }[] | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");

  // Relevance filter state
  const [showRelevanceModal, setShowRelevanceModal] = useState(false);
  const [relevanceKeyword, setRelevanceKeyword] = useState("");
  const [relevanceThreshold, setRelevanceThreshold] = useState(50);
  const [relevanceRunning, setRelevanceRunning] = useState(false);
  const [relevanceResult, setRelevanceResult] = useState<{ kept: number; dropped: number; droppedProducts?: { id: number; title: string; asin: string }[] } | null>(null);

  useEffect(() => {
    fetch("/api/sheets/config")
      .then((r) => r.json())
      .then(setSheetsConfig)
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to load project");
      const data = await res.json();
      setProject(data.project);
      setKeywords(data.keywords);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-poll while running
  useEffect(() => {
    if (!project || (project.status !== "running" && project.status !== "pending" && !project.status.startsWith("retrying"))) return;
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [project?.status, loadData]);

  // Track when running starts for live timer
  useEffect(() => {
    if ((project?.status === "running" || project?.status?.startsWith("retrying")) && !runStartTime) {
      setRunStartTime(Date.now());
    }
    if (project && project.status !== "running" && project.status !== "pending" && !project.status.startsWith("retrying")) {
      setRunStartTime(null);
    }
  }, [project?.status]);

  // Live timer tick
  useEffect(() => {
    if (!runStartTime) return;
    const interval = setInterval(() => {
      setLiveElapsed(Date.now() - runStartTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [runStartTime]);

  async function handleRename() {
    if (!nameValue.trim()) return;
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameValue.trim() }),
    });
    setEditingName(false);
    loadData();
  }

  async function handleStop() {
    await fetch(`/api/projects/${projectId}/stop`, { method: "POST" });
    // Poll quickly to pick up the stopped state
    setTimeout(loadData, 1000);
  }

  async function handleRetry() {
    await fetch(`/api/projects/${projectId}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retryOnly: true }),
    });
    loadData();
  }

  async function handleExportRoundup() {
    setRoundupPacks(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/export?format=roundup&pack=100`
      );
      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("text/plain")) {
        // Single file — trigger download
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `project-${projectId}-roundup.txt`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Multiple packs — show download buttons
        const data = await res.json();
        setRoundupPacks(data.packs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }

  function downloadPack(pack: { filename: string; content: string }) {
    const blob = new Blob([pack.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = pack.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadAllPacks() {
    if (!roundupPacks) return;
    for (const pack of roundupPacks) {
      downloadPack(pack);
    }
  }

  async function handleSaveToSheets() {
    setSheetsSaving(true);
    setSheetsResult(null);
    try {
      const res = await fetch("/api/sheets/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: Number(projectId),
          spreadsheetId: sheetsConfig?.defaultSpreadsheetId || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSheetsResult(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save to Sheets");
    } finally {
      setSheetsSaving(false);
    }
  }

  async function handleToggleExclude(product: ProductData) {
    await fetch(`/api/projects/${projectId}/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ excluded: !product.excluded }),
    });
    loadData();
  }

  function openRelevanceModal() {
    const firstKeyword = keywords.length > 0 ? keywords[0].keyword : "";
    setRelevanceKeyword(firstKeyword);
    setRelevanceThreshold(50);
    setRelevanceResult(null);
    setShowRelevanceModal(true);
  }

  async function handleRunRelevance() {
    setRelevanceRunning(true);
    setRelevanceResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/relevance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: relevanceKeyword, threshold: relevanceThreshold }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRelevanceResult(data);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Relevance filter failed");
    } finally {
      setRelevanceRunning(false);
    }
  }

  function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  const totalElapsed = (project?.elapsedMs || 0) + (runStartTime ? liveElapsed : 0);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!project) return <p className="text-gray-500">Loading...</p>;

  const progress =
    project.totalKeywords > 0
      ? Math.round(
          ((project.completedKeywords + project.failedKeywords) / project.totalKeywords) * 100
        )
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") setEditingName(false);
                }}
                className="text-2xl font-bold text-gray-900 border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                onClick={handleRename}
                className="text-sm text-blue-600 hover:underline"
              >
                Save
              </button>
              <button
                onClick={() => setEditingName(false)}
                className="text-sm text-gray-500 hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <h1
              className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-blue-600 group"
              onClick={() => {
                setNameValue(project.name);
                setEditingName(true);
              }}
              title="Click to rename"
            >
              {project.name}
              <span className="text-gray-300 text-sm ml-2 opacity-0 group-hover:opacity-100">
                edit
              </span>
            </h1>
          )}
          <p className="text-gray-600 text-sm mt-1">
            {project.completedKeywords} completed, {project.failedKeywords} failed of{" "}
            {project.totalKeywords} keywords
            {project.status === "running" && (
              <span className="text-gray-400 ml-2">
                (concurrency: {(project as any).concurrency || "?"})
              </span>
            )}
          </p>
          <p className="text-gray-400 text-xs mt-0.5 font-mono">
            {project.status === "running" ? (
              <>Time: {formatDuration(totalElapsed)}</>
            ) : totalElapsed > 0 ? (
              <>Completed in {formatDuration(totalElapsed)}</>
            ) : null}
          </p>
          {(project as any).relevanceFilter && (
            <div className="flex items-center gap-2 mt-1">
              {(project as any).relevanceStatus === "running" && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Relevance filter running...
                </span>
              )}
              {(project as any).relevanceStatus === "pending" && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                  Relevance filter pending (runs after scraping)
                </span>
              )}
              {(project as any).relevanceStatus === "done" && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                  Relevance filter: {(project as any).relevanceDropped} products excluded (threshold: {(project as any).relevanceThreshold})
                </span>
              )}
              {(project as any).relevanceStatus === "failed" && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                  Relevance filter failed
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={project.status} />
          {(project.status === "running" || project.status === "pending" || project.status.startsWith("retrying")) && (
            <button
              onClick={handleStop}
              className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700"
            >
              Stop Batch
            </button>
          )}
          {project.failedKeywords > 0 && project.status !== "running" && (
            <button
              onClick={handleRetry}
              className="bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700"
            >
              Retry Failed
            </button>
          )}
          {sheetsConfig?.configured && (
            <button
              onClick={handleSaveToSheets}
              disabled={sheetsSaving}
              className="bg-emerald-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {sheetsSaving ? "Saving..." : "Save to Sheets"}
            </button>
          )}
          <button
            onClick={handleExportRoundup}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            Export Roundup
          </button>
          <a
            href={`/api/projects/${projectId}/export?format=json`}
            download="Export JSON.json"
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200"
          >
            Export JSON
          </a>
          <a
            href={`/api/projects/${projectId}/export?format=csv`}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200"
          >
            Export CSV
          </a>
          {project.status === "completed" && (
            <button
              onClick={openRelevanceModal}
              className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-700"
            >
              Relevance Filter
            </button>
          )}
        </div>
      </div>

      {roundupPacks && roundupPacks.length > 1 && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              Roundup export split into {roundupPacks.length} packs (100 keywords each)
            </span>
            <button
              onClick={downloadAllPacks}
              className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-blue-700"
            >
              Download All Packs
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {roundupPacks.map((pack) => (
              <button
                key={pack.pack}
                onClick={() => downloadPack(pack)}
                className="bg-white border border-blue-300 text-blue-700 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-blue-100"
              >
                Pack {pack.pack}/{pack.totalPacks}
              </button>
            ))}
          </div>
        </div>
      )}

      {sheetsResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 flex items-center gap-2 text-sm">
          <span className="text-emerald-700">Results saved to Google Sheets:</span>
          <a
            href={sheetsResult}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 font-medium hover:underline"
          >
            Open Spreadsheet
          </a>
        </div>
      )}

      {(project.status === "running" || project.status === "pending") && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Relevance Filter Modal */}
      {showRelevanceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Relevance Filter</h2>
              <button
                onClick={() => setShowRelevanceModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Use an LLM to score each product&apos;s relevance to a keyword and auto-exclude low-scoring products.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Keyword</label>
              <input
                type="text"
                value={relevanceKeyword}
                onChange={(e) => setRelevanceKeyword(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="Enter search keyword"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Threshold: {relevanceThreshold}
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={relevanceThreshold}
                onChange={(e) => setRelevanceThreshold(Number(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Products scoring below {relevanceThreshold} will be excluded.
              </p>
            </div>

            {relevanceResult && (
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3 space-y-2">
                <div className="flex gap-4 text-sm">
                  <span className="text-green-700 font-medium">{relevanceResult.kept} kept</span>
                  <span className="text-orange-700 font-medium">{relevanceResult.dropped} excluded</span>
                </div>
                {relevanceResult.droppedProducts && relevanceResult.droppedProducts.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {relevanceResult.droppedProducts.map((p) => (
                      <p key={p.id} className="text-xs text-gray-500 truncate">
                        [{p.asin}] {p.title}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowRelevanceModal(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Close
              </button>
              <button
                onClick={handleRunRelevance}
                disabled={relevanceRunning || !relevanceKeyword}
                className="px-4 py-2 text-sm text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50"
              >
                {relevanceRunning ? "Running..." : "Run Filter"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {keywords.map((kw) => (
          <div
            key={kw.id}
            className="bg-white rounded-lg border border-gray-200 overflow-hidden"
          >
            <button
              onClick={() =>
                setExpandedKeyword(expandedKeyword === kw.id ? null : kw.id)
              }
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left"
            >
              <div>
                <span className="font-medium text-sm text-gray-900">{kw.keyword}</span>
                <span className="text-gray-500 text-xs ml-2">
                  {kw.products.filter((p) => !p.excluded).length} products
                  {kw.products.some((p) => p.excluded) && (
                    <span className="text-orange-500 ml-1">
                      ({kw.products.filter((p) => p.excluded).length} excluded)
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <KeywordStatusBadge status={kw.status} error={kw.errorMessage} />
                <span className="text-gray-400">
                  {expandedKeyword === kw.id ? "\u25B2" : "\u25BC"}
                </span>
              </div>
            </button>

            {expandedKeyword === kw.id && (
              <div className="border-t border-gray-200 p-4 space-y-3">
                {kw.searchUrl && (
                  <p className="text-xs text-gray-500">
                    Search:{" "}
                    <a
                      href={kw.searchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {kw.searchUrl}
                    </a>
                  </p>
                )}
                {kw.errorMessage && (
                  <p className="text-sm text-red-600">Error: {kw.errorMessage}</p>
                )}
                {kw.products.length === 0 && kw.status === "success" && (
                  <p className="text-sm text-gray-500">No products found.</p>
                )}
                {kw.products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    expanded={expandedProduct === product.id}
                    onToggle={() =>
                      setExpandedProduct(
                        expandedProduct === product.id ? null : product.id
                      )
                    }
                    onToggleExclude={() => handleToggleExclude(product)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductCard({
  product,
  expanded,
  onToggle,
  onToggleExclude,
}: {
  product: ProductData;
  expanded: boolean;
  onToggle: () => void;
  onToggleExclude: () => void;
}) {
  return (
    <div
      className={`border rounded-md p-3 ${
        product.excluded ? "border-orange-200 bg-orange-50 opacity-60" : "border-gray-100"
      }`}
    >
      <div className="flex items-start gap-3">
        {product.imageUrl && (
          <img
            src={product.imageUrl}
            alt={product.title}
            className="w-16 h-16 object-contain flex-shrink-0 cursor-pointer"
            onClick={onToggle}
          />
        )}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggle}>
          <h4
            className={`font-medium text-sm text-gray-900 ${
              product.excluded ? "line-through" : ""
            }`}
          >
            #{product.position} — {product.title}
          </h4>
          <div className="flex gap-3 mt-1 text-xs text-gray-500">
            {product.asin && <span>ASIN: {product.asin}</span>}
            <a
              href={product.affiliateUrl || product.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View on Amazon
            </a>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExclude();
            }}
            className={`text-xs px-2 py-1 rounded ${
              product.excluded
                ? "bg-green-100 text-green-700 hover:bg-green-200"
                : "bg-orange-100 text-orange-700 hover:bg-orange-200"
            }`}
          >
            {product.excluded ? "Include" : "Exclude"}
          </button>
          <span
            className="text-gray-400 text-xs cursor-pointer"
            onClick={onToggle}
          >
            {expanded ? "\u25B2" : "\u25BC"}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 text-sm">
          <Section title="Feature Bullets" content={product.featureBullets} />
          <Section title="Product Description" content={product.productDescription} />
          <Section title="Product Facts" content={product.productFacts} />
          <Section title="Tech Details" content={product.techDetails} />
          <Section title="Reviews" content={product.reviews} />
          <details className="mt-2">
            <summary className="text-xs text-gray-400 cursor-pointer">
              Scrape Debug
            </summary>
            <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-x-auto">
              {typeof product.scrapeDebug === "string"
                ? product.scrapeDebug
                : JSON.stringify(product.scrapeDebug, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

function Section({ title, content }: { title: string; content: string }) {
  if (!content) return null;
  return (
    <div>
      <h5 className="text-xs font-medium text-gray-500 uppercase">{title}</h5>
      <p className="text-gray-700 whitespace-pre-line">{content}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isRetrying = status.startsWith("retrying");
  const colors: Record<string, string> = {
    pending: "bg-gray-100 text-gray-700",
    running: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  };
  const colorClass = isRetrying
    ? "bg-amber-100 text-amber-700"
    : colors[status] || colors.pending;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {isRetrying ? `Retrying (${status.replace("retrying ", "")}) — waiting 30s` : status}
    </span>
  );
}

function KeywordStatusBadge({
  status,
  error,
}: {
  status: string;
  error: string | null;
}) {
  if (status === "pending")
    return <span className="text-xs text-gray-400">pending</span>;
  if (status === "running")
    return <span className="text-xs text-blue-600">running...</span>;
  if (status === "failed")
    return (
      <span className="text-xs text-red-600" title={error || ""}>
        failed
      </span>
    );
  return <span className="text-xs text-green-600">done</span>;
}
