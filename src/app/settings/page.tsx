"use client";

import { useState, useEffect, useRef } from "react";

interface GeneralConfig {
  retryCount: number;
}

interface GoogleConfig {
  configured: boolean;
  serviceAccountEmail: string;
  sheetId: string;
}

interface ScraperInfo {
  id: string;
  name: string;
  envVar: string;
  envVar2: string | null;
  enabledVar: string;
  url: string;
  description: string;
  role: string;
  fields: string[];
  hasPlan: boolean;
  configured: boolean;
  enabled: boolean;
  active: boolean;
  maskedKey: string;
  maskedKey2: string | null;
  planId: string | null;
  plan: { id: string; name: string; credits: number; concurrent: number } | null;
}

interface PlanOption {
  id: string;
  name: string;
  credits: number;
  concurrent: number;
}

interface ScrapersConfig {
  scrapers: ScraperInfo[];
  activeCount: number;
  plans: Record<string, PlanOption[]>;
}

export default function SettingsPage() {
  const [generalConfig, setGeneralConfig] = useState<GeneralConfig | null>(null);
  const [retryCount, setRetryCount] = useState(4);
  const [googleConfig, setGoogleConfig] = useState<GoogleConfig | null>(null);
  const [scrapersConfig, setScrapersConfig] = useState<ScrapersConfig | null>(null);
  const [sheetId, setSheetId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [keyValue, setKeyValue] = useState("");
  const [keyValue2, setKeyValue2] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // LLM Providers state
  interface LlmProviderData {
    id: number;
    name: string;
    type: string;
    baseUrl: string;
    apiKey: string;
    model: string;
    purpose: string;
    isDefault: boolean;
    enabled: boolean;
  }
  const [llmProviders, setLlmProviders] = useState<LlmProviderData[]>([]);
  const [llmShowForm, setLlmShowForm] = useState(false);
  const [llmTesting, setLlmTesting] = useState<number | null>(null);
  const [llmTestResult, setLlmTestResult] = useState<{ id: number; ok: boolean; error?: string } | null>(null);

  // LLM form state
  const [llmFormName, setLlmFormName] = useState("");
  const [llmFormType, setLlmFormType] = useState("openai-compatible");
  const [llmFormBaseUrl, setLlmFormBaseUrl] = useState("");
  const [llmFormApiKey, setLlmFormApiKey] = useState("");
  const [llmFormModel, setLlmFormModel] = useState("");
  const [llmFormPurpose, setLlmFormPurpose] = useState("all");
  const [llmSaving, setLlmSaving] = useState(false);
  const [llmFormError, setLlmFormError] = useState("");
  const [llmAvailableModels, setLlmAvailableModels] = useState<string[]>([]);
  const [llmLoadingModels, setLlmLoadingModels] = useState(false);

  useEffect(() => {
    loadGeneralConfig();
    loadGoogleConfig();
    loadScrapersConfig();
    loadLlmProviders();
  }, []);

  async function loadGeneralConfig() {
    const res = await fetch("/api/settings/general");
    const data = await res.json();
    setGeneralConfig(data);
    setRetryCount(data.retryCount ?? 4);
  }

  async function handleSaveRetryCount() {
    clearMessages();
    try {
      const res = await fetch("/api/settings/general", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retryCount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(`Retry count saved: ${data.retryCount}`);
      loadGeneralConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function loadGoogleConfig() {
    const res = await fetch("/api/settings/google");
    const data = await res.json();
    setGoogleConfig(data);
    setSheetId(data.sheetId || "");
  }

  async function loadScrapersConfig() {
    const res = await fetch("/api/settings/scrapers");
    const data = await res.json();
    setScrapersConfig(data);
  }

  async function loadLlmProviders() {
    try {
      const res = await fetch("/api/settings/llm");
      if (res.ok) setLlmProviders(await res.json());
    } catch {
      // No LLM providers yet
    }
  }

  const LLM_PRESETS = [
    { name: "OpenAI", type: "openai-compatible", baseUrl: "https://api.openai.com/v1", model: "gpt-4o" },
    { name: "Claude (Anthropic)", type: "anthropic", baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-4-20250514" },
    { name: "OpenRouter", type: "openai-compatible", baseUrl: "https://openrouter.ai/api/v1", model: "meta-llama/llama-3.1-70b-instruct" },
    { name: "Ollama (Local)", type: "openai-compatible", baseUrl: "http://localhost:11434/v1", model: "llama3.1:8b" },
    { name: "LM Studio (Local)", type: "openai-compatible", baseUrl: "http://localhost:1234/v1", model: "local-model" },
  ];

  function applyLlmPreset(idx: number) {
    const p = LLM_PRESETS[idx];
    setLlmFormName(p.name);
    setLlmFormType(p.type);
    setLlmFormBaseUrl(p.baseUrl);
    setLlmFormModel(p.model);
    fetchLlmModels(p.type, p.baseUrl, llmFormApiKey);
  }

  async function fetchLlmModels(type: string, baseUrl: string, apiKey: string) {
    if (!baseUrl) return;
    setLlmLoadingModels(true);
    try {
      const params = new URLSearchParams({ type, baseUrl, apiKey });
      const res = await fetch(`/api/settings/llm/models?${params}`);
      const data = await res.json();
      setLlmAvailableModels(data.models || []);
    } catch {
      setLlmAvailableModels([]);
    }
    setLlmLoadingModels(false);
  }

  async function handleSaveLlm() {
    setLlmFormError("");
    setLlmSaving(true);
    try {
      const res = await fetch("/api/settings/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: llmFormName,
          type: llmFormType,
          baseUrl: llmFormBaseUrl,
          apiKey: llmFormApiKey,
          model: llmFormModel,
          purpose: llmFormPurpose,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      setLlmShowForm(false);
      setLlmFormName("");
      setLlmFormApiKey("");
      setLlmFormBaseUrl("");
      setLlmFormModel("");
      setLlmAvailableModels([]);
      loadLlmProviders();
    } catch (err) {
      setLlmFormError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLlmSaving(false);
    }
  }

  async function handleTestLlm(id: number) {
    setLlmTesting(id);
    setLlmTestResult(null);
    const res = await fetch("/api/settings/llm/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    setLlmTestResult({ id, ok: data.ok, error: data.error });
    setLlmTesting(null);
  }

  async function handleDeleteLlm(id: number) {
    await fetch(`/api/settings/llm?id=${id}`, { method: "DELETE" });
    loadLlmProviders();
  }

  function clearMessages() {
    setError("");
    setMessage("");
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    clearMessages();
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await fetch("/api/settings/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceAccountJson: json }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(data.message);
      loadGoogleConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSaveSheetId() {
    clearMessages();
    try {
      const res = await fetch("/api/settings/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage("Spreadsheet ID saved.");
      loadGoogleConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function handleToggleScraper(id: string, enabled: boolean) {
    clearMessages();
    try {
      const res = await fetch("/api/settings/scrapers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", id, enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(`${id} ${enabled ? "enabled" : "disabled"}.`);
      loadScrapersConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle");
    }
  }

  async function handleSaveScraperKey(scraper: ScraperInfo) {
    clearMessages();
    try {
      const res = await fetch("/api/settings/scrapers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setKey",
          envVar: scraper.envVar,
          value: keyValue,
          value2: scraper.envVar2 ? keyValue2 : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(`${data.scraper} API key saved.`);
      setEditingKey(null);
      setKeyValue("");
      setKeyValue2("");
      loadScrapersConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function handleSetPlan(id: string, planId: string) {
    clearMessages();
    try {
      const res = await fetch("/api/settings/scrapers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setPlan", id, planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(`Plan set to ${data.plan.name} (${data.plan.concurrent} concurrent).`);
      loadScrapersConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set plan");
    }
  }

  async function handleRemoveScraperKey(id: string) {
    clearMessages();
    try {
      const res = await fetch("/api/settings/scrapers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "removeKey", id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(`${data.scraper} API key removed.`);
      loadScrapersConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove");
    }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Configure scraper API keys and integrations.</p>
      </div>

      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-sm text-emerald-800">
          {message}
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
          {error}
        </div>
      )}

      {/* ── General Settings ──────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">General</h2>
            <p className="text-sm text-gray-500">Scraping behavior settings.</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Auto-retry failed keywords: {retryCount}x
          </label>
          <p className="text-xs text-gray-500">
            When keywords fail during a batch, automatically retry them up to this many times with a 30-second wait between attempts. Set to 0 to disable.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={10}
              value={retryCount}
              onChange={(e) => setRetryCount(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-sm font-mono text-gray-700 w-6 text-center">{retryCount}</span>
            <button
              onClick={handleSaveRetryCount}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {/* ── LLM Providers ─────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">LLM Providers</h2>
          <button
            onClick={() => setLlmShowForm(!llmShowForm)}
            className="bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            {llmShowForm ? "Cancel" : "Add Provider"}
          </button>
        </div>

        {llmShowForm && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Quick Preset</label>
              <div className="flex gap-2 flex-wrap">
                {LLM_PRESETS.map((p, i) => (
                  <button
                    key={p.name}
                    onClick={() => applyLlmPreset(i)}
                    className="text-xs bg-white border border-gray-300 rounded px-2 py-1 hover:bg-gray-100"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={llmFormName}
                  onChange={(e) => setLlmFormName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                  placeholder="OpenAI"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={llmFormType}
                  onChange={(e) => setLlmFormType(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                >
                  <option value="openai-compatible">OpenAI-compatible (OpenAI, OpenRouter, Ollama, LM Studio)</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Base URL</label>
                <input
                  type="text"
                  value={llmFormBaseUrl}
                  onChange={(e) => setLlmFormBaseUrl(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">API Key</label>
                <input
                  type="password"
                  value={llmFormApiKey}
                  onChange={(e) => setLlmFormApiKey(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                  placeholder="sk-..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Model
                  {llmFormBaseUrl && (
                    <button
                      onClick={() => fetchLlmModels(llmFormType, llmFormBaseUrl, llmFormApiKey)}
                      disabled={llmLoadingModels}
                      className="ml-2 text-blue-600 hover:underline text-xs font-normal"
                    >
                      {llmLoadingModels ? "Loading..." : "Fetch Models"}
                    </button>
                  )}
                </label>
                {llmAvailableModels.length > 0 ? (
                  <select
                    value={llmFormModel}
                    onChange={(e) => setLlmFormModel(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                  >
                    <option value="">Select a model...</option>
                    {llmAvailableModels.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={llmFormModel}
                    onChange={(e) => setLlmFormModel(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                    placeholder="Enter API key first, then click Fetch Models"
                  />
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Purpose</label>
                <select
                  value={llmFormPurpose}
                  onChange={(e) => setLlmFormPurpose(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                >
                  <option value="all">All tasks</option>
                  <option value="relevance">Relevance filtering only</option>
                </select>
              </div>
            </div>

            {llmFormError && <p className="text-red-600 text-sm">{llmFormError}</p>}

            <button
              onClick={handleSaveLlm}
              disabled={llmSaving || !llmFormName || !llmFormBaseUrl || !llmFormModel}
              className="bg-green-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {llmSaving ? "Saving..." : "Save Provider"}
            </button>
          </div>
        )}

        {llmProviders.length === 0 && !llmShowForm && (
          <p className="text-sm text-gray-500">No LLM providers configured. Add one to use the relevance filter.</p>
        )}

        {llmProviders.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between border border-gray-100 rounded-md p-3"
          >
            <div>
              <span className="font-medium text-sm">{p.name}</span>
              <span className="text-gray-500 text-xs ml-2">{p.model} ({p.type})</span>
              <span className="text-gray-400 text-xs ml-2">[{p.purpose}]</span>
              {p.isDefault && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">default</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {llmTestResult?.id === p.id && (
                <span className={`text-xs ${llmTestResult.ok ? "text-green-600" : "text-red-600"}`}>
                  {llmTestResult.ok ? "Connected" : llmTestResult.error || "Failed"}
                </span>
              )}
              <button
                onClick={() => handleTestLlm(p.id)}
                disabled={llmTesting === p.id}
                className="text-xs text-blue-600 hover:underline disabled:opacity-50"
              >
                {llmTesting === p.id ? "Testing..." : "Test"}
              </button>
              <button
                onClick={() => handleDeleteLlm(p.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Scraper API Keys ──────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
          </svg>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Scraper API Keys</h2>
            <p className="text-sm text-gray-500">
              {scrapersConfig
                ? `${scrapersConfig.activeCount} active`
                : "Loading..."}
              {" "}&mdash; Primary handles all requests, fallbacks used on 503 errors.
            </p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-600 space-y-1">
          <p><strong>How it works:</strong> The primary scraper handles all requests. If it returns a 503 (Amazon block), the request automatically fails over to the next enabled fallback. Toggle scrapers on/off without removing their keys.</p>
        </div>

        <div className="space-y-3">
          {scrapersConfig?.scrapers.map((s) => (
            <div
              key={s.id}
              className={`border rounded-lg p-4 transition-opacity ${
                s.active
                  ? "border-emerald-200 bg-emerald-50/30"
                  : s.configured && !s.enabled
                  ? "border-gray-200 bg-gray-50 opacity-60"
                  : "border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {/* Enable/Disable toggle */}
                    {s.configured && (
                      <button
                        onClick={() => handleToggleScraper(s.id, !s.enabled)}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          s.enabled ? "bg-emerald-500" : "bg-gray-300"
                        }`}
                        title={s.enabled ? "Disable" : "Enable"}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            s.enabled ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    )}
                    <h3 className="font-medium text-sm text-gray-900">{s.name}</h3>
                    {s.role === "primary" && (
                      <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase">
                        Primary
                      </span>
                    )}
                    {s.role === "fallback" && (
                      <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase">
                        Fallback
                      </span>
                    )}
                    {s.active && (
                      <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-medium">
                        Active
                      </span>
                    )}
                    {s.configured && !s.enabled && (
                      <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded text-[10px] font-medium">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {s.description}
                    {s.plan && (
                      <span className="ml-1 text-gray-400">
                        {s.plan.credits.toLocaleString()} credits, {s.plan.concurrent} concurrent
                      </span>
                    )}
                  </p>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {s.url.replace("https://", "")}
                  </a>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {s.configured && editingKey !== s.id && (
                    <>
                      <code className="text-xs text-gray-400 font-mono">{s.maskedKey}</code>
                      <button
                        onClick={() => {
                          setEditingKey(s.id);
                          setKeyValue("");
                          setKeyValue2("");
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Change
                      </button>
                      <button
                        onClick={() => handleRemoveScraperKey(s.id)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </>
                  )}
                  {!s.configured && editingKey !== s.id && (
                    <button
                      onClick={() => {
                        setEditingKey(s.id);
                        setKeyValue("");
                        setKeyValue2("");
                      }}
                      className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-200 font-medium"
                    >
                      Add Key
                    </button>
                  )}
                </div>
              </div>

              {s.hasPlan && s.configured && scrapersConfig?.plans?.[s.id] && (
                <div className="mt-3 flex items-center gap-3">
                  <label className="text-xs font-medium text-gray-700">Plan:</label>
                  <select
                    value={s.planId || 'startup'}
                    onChange={(e) => handleSetPlan(s.id, e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-1 text-xs"
                  >
                    {scrapersConfig.plans[s.id].map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} — {plan.credits.toLocaleString()} credits, {plan.concurrent} concurrent
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editingKey === s.id && (
                <div className="mt-3 space-y-2">
                  {s.fields.includes("apiKey") && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={keyValue}
                        onChange={(e) => setKeyValue(e.target.value)}
                        className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm font-mono"
                        placeholder={`Paste your ${s.name} API key`}
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveScraperKey(s)}
                        disabled={!keyValue}
                        className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setEditingKey(null); setKeyValue(""); setKeyValue2(""); }}
                        className="text-sm text-gray-500 hover:text-gray-700 px-2"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {s.fields.includes("login") && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={keyValue}
                        onChange={(e) => setKeyValue(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm font-mono"
                        placeholder="API Login (email)"
                        autoFocus
                      />
                      <input
                        type="password"
                        value={keyValue2}
                        onChange={(e) => setKeyValue2(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm font-mono"
                        placeholder="API Password"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveScraperKey(s)}
                          disabled={!keyValue || !keyValue2}
                          className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setEditingKey(null); setKeyValue(""); setKeyValue2(""); }}
                          className="text-sm text-gray-500 hover:text-gray-700 px-2"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Google Sheets Integration ─────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <div className="flex items-center gap-3">
          <svg className="w-8 h-8 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z"/>
          </svg>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Google Sheets Integration</h2>
            <p className="text-sm text-gray-500">
              Load keywords from and save results to Google Sheets.
            </p>
          </div>
          {googleConfig?.configured && (
            <span className="ml-auto bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
              Connected
            </span>
          )}
        </div>

        {/* Setup Guide */}
        <div className="bg-gray-50 rounded-lg p-5 space-y-4">
          <h3 className="font-medium text-gray-900 text-sm">Setup Guide</h3>
          <div className="space-y-3 text-sm text-gray-700">
            <div>
              <h4 className="font-medium text-gray-800">Step 1: Create a Google Cloud Service Account</h4>
              <ol className="list-decimal list-inside mt-1.5 space-y-1 text-gray-600">
                <li>Go to{" "}<a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">console.cloud.google.com</a></li>
                <li>Create a new project (or use an existing one)</li>
                <li>Go to <strong>APIs &amp; Services &gt; Library</strong> &rarr; search <strong>&quot;Google Sheets API&quot;</strong> &rarr; click <strong>Enable</strong></li>
                <li>Go to <strong>APIs &amp; Services &gt; Credentials</strong> &rarr; <strong>Create Credentials</strong> &rarr; <strong>Service Account</strong></li>
                <li>Name it (e.g., &quot;RoundupForge&quot;) &rarr; click through to finish</li>
                <li>Click the service account &rarr; <strong>Keys</strong> tab &rarr; <strong>Add Key</strong> &rarr; <strong>Create new key</strong> &rarr; <strong>JSON</strong></li>
                <li>A <code>.json</code> file downloads to your computer</li>
              </ol>
            </div>
            <div>
              <h4 className="font-medium text-gray-800">Step 2: Upload the JSON key file below</h4>
              <p className="text-gray-600 mt-0.5">The file is read locally and saved to your <code>.env</code>. It never leaves your machine.</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-800">Step 3: Share your Google Sheet</h4>
              <p className="text-gray-600 mt-0.5">Open your Google Sheet &rarr; click <strong>Share</strong> &rarr; add the service account email as an <strong>Editor</strong>.</p>
              {googleConfig?.serviceAccountEmail && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-500">Service account email:</span>
                  <code className="text-xs bg-white border border-gray-200 px-2 py-1 rounded select-all">{googleConfig.serviceAccountEmail}</code>
                  <button onClick={() => navigator.clipboard.writeText(googleConfig.serviceAccountEmail)} className="text-xs text-blue-600 hover:underline">Copy</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Upload */}
        <div className="space-y-3">
          <h3 className="font-medium text-gray-900 text-sm">Service Account Key</h3>
          {googleConfig?.configured ? (
            <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-md border border-emerald-200">
              <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm">
                <p className="text-emerald-800 font-medium">Connected</p>
                <p className="text-emerald-600 text-xs">{googleConfig.serviceAccountEmail}</p>
              </div>
              <label className="ml-auto text-xs text-gray-500 hover:text-gray-700 cursor-pointer">
                Replace
                <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <div className="flex flex-col items-center gap-1">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <span className="text-sm font-medium text-gray-600">{uploading ? "Uploading..." : "Upload service account JSON key file"}</span>
                <span className="text-xs text-gray-400">The .json file from Google Cloud Console</span>
              </div>
              <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileUpload} disabled={uploading} className="hidden" />
            </label>
          )}
        </div>

        {/* Sheet ID */}
        <div className="space-y-2">
          <h3 className="font-medium text-gray-900 text-sm">Default Spreadsheet</h3>
          <p className="text-xs text-gray-500">The Spreadsheet ID is the long string in your Google Sheet URL between <code>/d/</code> and <code>/edit</code></p>
          <div className="flex gap-2">
            <input type="text" value={sheetId} onChange={(e) => setSheetId(e.target.value)} className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm font-mono" placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" />
            <button onClick={handleSaveSheetId} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">Save</button>
          </div>
        </div>
      </div>

      {/* ── About ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold text-sm">
            G
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">About RoundupForge</h2>
            <p className="text-sm text-gray-500">
              A free tool by{" "}
              <a href="https://grimfaste.com" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline font-medium">
                Grimfaste
              </a>
            </p>
          </div>
        </div>

        <div className="text-sm text-gray-700 space-y-3">
          <p>
            <strong>RoundupForge</strong> is a free Amazon product research tool for publishers and affiliate marketers
            who create &quot;best of&quot; roundup articles. It automates the tedious process of searching Amazon, collecting
            product ASINs, and organizing results by keyword — ready for article creation.
          </p>

          <p>
            Built and maintained by{" "}
            <a href="https://grimfaste.com" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline font-medium">
              Grimfaste
            </a>
            {" "}— the analytics command center for publishers managing hundreds of WordPress sites.
            Grimfaste provides real-time traffic analytics, content intelligence, revenue tracking, automated content
            decay detection, and AI-powered Amazon product box templates across your entire site portfolio.
          </p>

          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 space-y-2">
            <h3 className="font-medium text-teal-900 text-sm">Grimfaste Platform Features</h3>
            <ul className="text-xs text-teal-800 space-y-1 list-disc list-inside">
              <li>Real-time traffic tracking across hundreds of WordPress sites</li>
              <li>Content decay detection and topic gap analysis</li>
              <li>Amazon Associates and Google AdSense revenue attribution</li>
              <li>11 professionally designed Amazon product box templates with AI rewriting</li>
              <li>Site health scoring across performance, SEO, monetization, and engagement</li>
              <li>Affiliate link health monitoring and automated alerts</li>
              <li>Team collaboration with role-based access controls</li>
            </ul>
            <a
              href="https://grimfaste.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-xs font-medium text-teal-700 bg-teal-100 hover:bg-teal-200 px-3 py-1.5 rounded-md transition-colors"
            >
              Learn more at grimfaste.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
