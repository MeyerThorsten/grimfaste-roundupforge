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
  const [sheetsConfig, setSheetsConfig] = useState<SheetsConfig | null>(null);
  const [sheetsSaving, setSheetsSaving] = useState(false);
  const [sheetsResult, setSheetsResult] = useState<string | null>(null);

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
    if (!project || (project.status !== "running" && project.status !== "pending")) return;
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [project?.status, loadData]);

  async function handleRetry() {
    await fetch(`/api/projects/${projectId}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retryOnly: true }),
    });
    loadData();
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
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-gray-600 text-sm mt-1">
            {project.completedKeywords} completed, {project.failedKeywords} failed of{" "}
            {project.totalKeywords} keywords
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={project.status} />
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
          <a
            href={`/api/projects/${projectId}/export?format=json`}
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
        </div>
      </div>

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
