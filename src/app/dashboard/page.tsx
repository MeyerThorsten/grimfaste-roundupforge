"use client";

import { useState, useEffect } from "react";

interface DashboardData {
  overview: {
    totalProjects: number;
    totalKeywords: number;
    totalProducts: number;
    totalCredits: number;
    totalExports: number;
    successRate: number;
    avgProductsPerKeyword: number;
    avgTimePerProject: number;
    avgTimePerKeyword: number;
  };
  statusCounts: Record<string, number>;
  recentProjects: {
    id: number;
    name: string;
    status: string;
    totalKeywords: number;
    completedKeywords: number;
    failedKeywords: number;
    creditsUsed: number;
    elapsedMs: number;
    createdAt: string;
  }[];
  dailyStats: {
    day: string;
    count: number;
    credits: number;
    keywords: number;
  }[];
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="text-red-600 p-8">{error}</p>;
  if (!data) return <p className="text-gray-500 p-8">Loading dashboard...</p>;

  const { overview, statusCounts, recentProjects, dailyStats } = data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Projects" value={overview.totalProjects} />
        <StatCard label="Keywords" value={overview.totalKeywords.toLocaleString()} />
        <StatCard label="Products" value={overview.totalProducts.toLocaleString()} />
        <StatCard label="Credits Used" value={overview.totalCredits.toLocaleString()} />
        <StatCard label="Exports" value={overview.totalExports} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Success Rate" value={`${overview.successRate}%`} color={overview.successRate >= 90 ? "green" : overview.successRate >= 70 ? "yellow" : "red"} />
        <StatCard label="Avg Products/Keyword" value={overview.avgProductsPerKeyword} />
        <StatCard label="Avg Time/Project" value={formatDuration(overview.avgTimePerProject)} />
        <StatCard label="Avg Time/Keyword" value={formatDuration(overview.avgTimePerKeyword)} />
      </div>

      {/* Status Distribution */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Project Status</h2>
        <div className="flex gap-4 flex-wrap">
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} className="flex items-center gap-2">
              <StatusDot status={status} />
              <span className="text-sm text-gray-700 capitalize">{status}</span>
              <span className="text-sm font-semibold text-gray-900">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Stats */}
      {dailyStats.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Last 30 Days</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Projects</th>
                  <th className="pb-2 pr-4">Keywords</th>
                  <th className="pb-2">Credits</th>
                </tr>
              </thead>
              <tbody>
                {dailyStats.map((d) => (
                  <tr key={d.day} className="border-b border-gray-50">
                    <td className="py-1.5 pr-4 font-mono text-gray-600">{d.day}</td>
                    <td className="py-1.5 pr-4">{d.count}</td>
                    <td className="py-1.5 pr-4">{d.keywords.toLocaleString()}</td>
                    <td className="py-1.5">{d.credits.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Projects */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Projects</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Keywords</th>
                <th className="pb-2 pr-4">Failed</th>
                <th className="pb-2 pr-4">Credits</th>
                <th className="pb-2 pr-4">Duration</th>
                <th className="pb-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentProjects.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 pr-4">
                    <a href={`/projects/${p.id}`} className="text-blue-600 hover:underline font-medium">{p.name}</a>
                  </td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="py-2 pr-4">{p.completedKeywords}/{p.totalKeywords}</td>
                  <td className="py-2 pr-4 text-red-600">{p.failedKeywords || "-"}</td>
                  <td className="py-2 pr-4 font-mono">{p.creditsUsed.toLocaleString()}</td>
                  <td className="py-2 pr-4 font-mono">{p.elapsedMs > 0 ? formatDuration(p.elapsedMs) : "-"}</td>
                  <td className="py-2 font-mono text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const colorClasses = {
    green: "bg-green-50 border-green-200 text-green-700",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
    red: "bg-red-50 border-red-200 text-red-700",
  };
  const cls = color ? colorClasses[color as keyof typeof colorClasses] : "bg-white border-gray-200 text-gray-900";
  return (
    <div className={`rounded-lg border p-4 ${cls}`}>
      <p className="text-xs font-medium text-gray-500 uppercase">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-gray-400",
    queued: "bg-yellow-400",
    running: "bg-blue-400",
    completed: "bg-green-400",
    failed: "bg-red-400",
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status] || colors.pending}`} />;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-gray-100 text-gray-700",
    queued: "bg-yellow-100 text-yellow-700",
    running: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.pending}`}>
      {status}
    </span>
  );
}
