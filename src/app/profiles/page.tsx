"use client";

import { useState, useEffect } from "react";
import { ScrapeProfileData, TextSelectorEntry } from "@/types";

const AMAZON_MARKETPLACES = [
  { domain: 'amazon.com',    label: 'Amazon US' },
  { domain: 'amazon.co.uk',  label: 'Amazon UK' },
  { domain: 'amazon.de',     label: 'Amazon Germany' },
  { domain: 'amazon.fr',     label: 'Amazon France' },
  { domain: 'amazon.it',     label: 'Amazon Italy' },
  { domain: 'amazon.es',     label: 'Amazon Spain' },
  { domain: 'amazon.ca',     label: 'Amazon Canada' },
  { domain: 'amazon.com.au', label: 'Amazon Australia' },
  { domain: 'amazon.co.jp',  label: 'Amazon Japan' },
  { domain: 'amazon.in',     label: 'Amazon India' },
  { domain: 'amazon.com.br', label: 'Amazon Brazil' },
  { domain: 'amazon.com.mx', label: 'Amazon Mexico' },
  { domain: 'amazon.nl',     label: 'Amazon Netherlands' },
  { domain: 'amazon.se',     label: 'Amazon Sweden' },
  { domain: 'amazon.pl',     label: 'Amazon Poland' },
  { domain: 'amazon.com.be', label: 'Amazon Belgium' },
  { domain: 'amazon.sg',     label: 'Amazon Singapore' },
  { domain: 'amazon.sa',     label: 'Amazon Saudi Arabia' },
  { domain: 'amazon.ae',     label: 'Amazon UAE' },
  { domain: 'amazon.com.tr', label: 'Amazon Turkey' },
  { domain: 'amazon.eg',     label: 'Amazon Egypt' },
];

const DEFAULT_SELECTORS: TextSelectorEntry[] = [
  { label: "Feature Bullets", selector: "#feature-bullets", treatAsReview: false },
  { label: "Description", selector: "#productDescription_feature_div", treatAsReview: false },
  { label: "Product Details", selector: "#prodDetails", treatAsReview: false },
  { label: "Tech Specs", selector: "#tech", treatAsReview: false },
  { label: "Book Description", selector: "#bookDescription", treatAsReview: false },
  { label: "Product Facts", selector: "#productFactsDesktopExpander", treatAsReview: false },
  { label: "Reviews", selector: ".review-text", treatAsReview: true },
];

interface FormState {
  name: string;
  domain: string;
  titleSelector: string;
  imageSelector: string;
  textSelectorsRaw: string;
  affiliateCode: string;
  enabled: boolean;
}

function selectorsToText(selectors: TextSelectorEntry[]): string {
  return selectors
    .map((s) => `${s.label}|${s.selector}|${s.treatAsReview ? "review" : ""}`)
    .join("\n");
}

function textToSelectors(text: string): TextSelectorEntry[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return {
        label: parts[0] || parts[1] || "",
        selector: parts[1] || parts[0] || "",
        treatAsReview: parts[2] === "review",
      };
    });
}

const EMPTY_FORM: FormState = {
  name: "",
  domain: "amazon.com",
  titleSelector: "#productTitle",
  imageSelector: "#imgTagWrapperId img",
  textSelectorsRaw: selectorsToText(DEFAULT_SELECTORS),
  affiliateCode: "",
  enabled: true,
};

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<ScrapeProfileData[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    const res = await fetch("/api/profiles");
    setProfiles(await res.json());
  }

  function handleEdit(profile: ScrapeProfileData) {
    setEditingId(profile.id);
    setForm({
      name: profile.name,
      domain: profile.domain,
      titleSelector: profile.titleSelector,
      imageSelector: profile.imageSelector,
      textSelectorsRaw: selectorsToText(profile.textSelectors),
      affiliateCode: profile.affiliateCode,
      enabled: profile.enabled,
    });
    setError("");
  }

  function handleCancel() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
  }

  async function handleSave() {
    setError("");
    if (!form.name || !form.domain) {
      setError("Name and domain are required");
      return;
    }

    const payload = {
      name: form.name,
      domain: form.domain,
      titleSelector: form.titleSelector,
      imageSelector: form.imageSelector,
      textSelectors: textToSelectors(form.textSelectorsRaw),
      affiliateCode: form.affiliateCode,
      treatAsReview: false,
      enabled: form.enabled,
    };

    try {
      if (editingId) {
        const res = await fetch(`/api/profiles/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update profile");
      } else {
        const res = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create profile");
      }
      handleCancel();
      loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this profile?")) return;
    await fetch(`/api/profiles/${id}`, { method: "DELETE" });
    loadProfiles();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Scrape Profiles</h1>
        <p className="text-gray-600 mt-1">
          Configure how product data is extracted from Amazon.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-2">
        <h3 className="font-medium">Which fields are used in each mode?</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
          <div className="font-medium text-blue-700 col-span-2 mt-1 border-b border-blue-200 pb-1">
            Always used (both modes)
          </div>
          <div><span className="font-medium">Name</span> — shown in profile dropdown</div>
          <div><span className="font-medium">Domain</span> — builds search URL (e.g. amazon.com/s?k=...)</div>
          <div><span className="font-medium">Affiliate Code</span> — appended as ?tag= to product URLs</div>
          <div><span className="font-medium">Enabled</span> — only active profiles appear in dropdown</div>

          <div className="font-medium text-blue-700 col-span-2 mt-2 border-b border-blue-200 pb-1">
            Full mode only (visits each product page)
          </div>
          <div><span className="font-medium">Title Selector</span> — extracts title from product page</div>
          <div><span className="font-medium">Image Selector</span> — extracts main image from product page</div>
          <div className="col-span-2"><span className="font-medium">Text Selectors</span> — extracts bullets, description, reviews, specs (mark individual selectors with &quot;review&quot; flag)</div>

          <div className="col-span-2 mt-2 text-blue-600">
            Fast mode skips product pages entirely — it only uses Domain and Affiliate Code to collect ASINs from search results.
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">
          {editingId ? "Edit Profile" : "New Profile"}
        </h2>

        {!editingId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amazon Marketplace</label>
            <select
              onChange={(e) => {
                const mp = AMAZON_MARKETPLACES.find((m) => m.domain === e.target.value);
                if (mp) setForm({ ...form, name: mp.label, domain: mp.domain });
              }}
              value={form.domain}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Select a marketplace...</option>
              {AMAZON_MARKETPLACES.map((mp) => (
                <option key={mp.domain} value={mp.domain}>{mp.label} ({mp.domain})</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
            <input
              type="text"
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title Selector</label>
            <input
              type="text"
              value={form.titleSelector}
              onChange={(e) => setForm({ ...form, titleSelector: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image Selector</label>
            <input
              type="text"
              value={form.imageSelector}
              onChange={(e) => setForm({ ...form, imageSelector: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Affiliate Code</label>
            <input
              type="text"
              value={form.affiliateCode}
              onChange={(e) => setForm({ ...form, affiliateCode: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="your-tag-20"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
              Enabled
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Text Selectors (one per line: Label|#selector|review)
          </label>
          <textarea
            value={form.textSelectorsRaw}
            onChange={(e) => setForm({ ...form, textSelectorsRaw: e.target.value })}
            rows={7}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
            placeholder={"Feature Bullets|#feature-bullets|\nReviews|.review-text|review"}
          />
          <p className="text-xs text-gray-500 mt-1">
            Format: Label|CSS Selector|review (optional &quot;review&quot; flag routes text to reviews field)
          </p>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            {editingId ? "Update" : "Create"}
          </button>
          {editingId && (
            <button
              onClick={handleCancel}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-3">Existing Profiles</h2>
        {profiles.length === 0 ? (
          <p className="text-gray-500 text-sm">No profiles yet.</p>
        ) : (
          <div className="space-y-3">
            {profiles.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 rounded-md border border-gray-100"
              >
                <div>
                  <span className="font-medium text-sm">{p.name}</span>
                  <span className="text-gray-500 text-xs ml-2">({p.domain})</span>
                  <span className="text-gray-400 text-xs ml-2">
                    {p.textSelectors.length} selectors
                  </span>
                  {!p.enabled && (
                    <span className="ml-2 text-xs text-gray-400">disabled</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(p)}
                    className="text-blue-600 text-sm hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-red-600 text-sm hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
