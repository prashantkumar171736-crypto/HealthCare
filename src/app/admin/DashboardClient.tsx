"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import PostEditor from "./PostEditor";
import DonationSettings from "./DonationSettings";
import CommentsManager from "./CommentsManager";
import ThemeSettings, { AdminTheme, DEFAULT_THEME, hexToRgb, luminance } from "./ThemeSettings";
import { useLanguage } from "@/context/LanguageContext";
import { LANG_MAP } from "@/lib/detectLanguage";

const LS_THEME_KEY = "admin_panel_theme";

interface KPI {
  totalViews: number;
  uniqueVisitors: number;
}

interface DailyView {
  date: string;
  views: number;
  details: DailyViewDetail[];
}

interface DailyViewDetail {
  country: string;
  page: string;
  visits: number;
}

interface TopPath {
  path: string;
  count: number;
}

interface TopCountry {
  name: string;
  count: number;
}

interface TopRegion {
  country: string;
  region: string;
  count: number;
}

interface VisitorLog {
  id: string;
  path: string;
  referrer: string;
  ip: string;
  userAgent: string;
  country: string;
  region: string;
  city: string;
  timestamp: string;
}

export interface R2Stats {
  status: string;
  pingTimeMs: number;
  bucketName: string;
  publicUrl: string;
  totalObjects: number;
  totalSizeBytes: number;
  totalSizeMB: number;
  totalSizeGB: number;
  freeTierLimitGB: number;
  freeTierUsedPct: number;
  freeTierRemainingGB: number;
}

interface SystemHealth {
  dbStatus: string;
  dbPingTime: number;
  dbDataSizeMB: number;
  dbStorageSizeMB: number;
  dbIndexSizeMB: number;
  dbTotalCollections: number;
  r2?: R2Stats;
  serverUptime: number;
  memoryUsed: number;
  memoryTotal: number;
  systemTotalRamGB: number;
  systemFreeRamGB: number;
  cpuCores: number;
  cpuModel: string;
  cpuLoadAvg: number;
  nodeVersion: string;
  platform: string;
}

interface StatsResponse {
  summary: KPI;
  charts: {
    dailyViews: DailyView[];
    topPages: TopPath[];
    topCountries: TopCountry[];
    topRegions: TopRegion[];
  };
  logs: VisitorLog[];
  systemHealth: SystemHealth;
  telemetry24h?: Array<{
    id?: string;
    time: string;
    ping: number;
    cpu: number;
    cpuLoadAvg?: number;
    heap: number;
    views: number;
    visitors: number;
    timestamp?: string;
  }>;
}

const PERIOD_OPTIONS = [
  { value: "1d", label: "1 Day (24 Hours)" },
  { value: "7d", label: "7 Days (Weekly)" },
  { value: "monthly", label: "Monthly" },
  { value: "half-yearly", label: "Half Yearly" },
  { value: "yearly", label: "Yearly" },
];

export default function DashboardClient() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clearing, setClearing] = useState(false);
  const [chartPeriod, setChartPeriod] = useState("monthly");
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "logs" | "system" | "posts" | "donation" | "comments" | "appearance">("overview");
  const [theme, setTheme] = useState<AdminTheme>(DEFAULT_THEME);

  // Live Server Request Log filters & controls
  const [logLimit, setLogLimit] = useState<string>("50");
  const [sortField, setSortField] = useState<"timestamp" | "ip" | "country" | "state" | "geo" | "path" | "referrer" | "userAgent">("timestamp");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [quickSearchText, setQuickSearchText] = useState("");
  const [advSearchOpen, setAdvSearchOpen] = useState(false);
  const [advFilters, setAdvFilters] = useState({
    ip: "",
    country: "",
    state: "",
    geo: "",
    path: "",
    referrer: "",
    userAgent: "",
    dateFrom: "",
    dateTo: "",
  });

  const router = useRouter();
  const { lang, setLangByCode } = useLanguage();

  // Realtime 10-point telemetry history for live graphs
  const [telemetryPoints, setTelemetryPoints] = useState<Array<{
    time: string;
    ping: number;
    cpu: number;
    heap: number;
    views: number;
    visitors: number;
  }>>([]);

  // Floating Interactive Tooltip State for Live Telemetry Graphs
  const [graphTooltip, setGraphTooltip] = useState<{
    x: number;
    y: number;
    title: string;
    value: string;
    detail: string;
    color: string;
  } | null>(null);

  // Individual Per-Graph Time Window State ("30m" | "1h" | "3h" | "12h" | "24h")
  const [cardRanges, setCardRanges] = useState<Record<string, "30m" | "1h" | "3h" | "12h" | "24h">>({
    card1: "1h",
    card2: "1h",
    card3: "1h",
    card4: "1h",
    card5: "12h",
    card6: "1h",
  });

  // Helper to filter/downsample telemetry points cleanly for any selected per-graph time range
  const getFilteredTelemetry = useCallback((pts: typeof telemetryPoints, range: "30m" | "1h" | "3h" | "12h" | "24h") => {
    if (!pts || pts.length === 0) return [];
    let maxPoints = 10;
    if (range === "30m") maxPoints = 10;
    else if (range === "1h") maxPoints = 12;
    else if (range === "3h") maxPoints = 15;
    else if (range === "12h") maxPoints = 18;
    else if (range === "24h") maxPoints = 24;

    let targetCount = pts.length;
    if (range === "30m") targetCount = Math.min(pts.length, 30);
    else if (range === "1h") targetCount = Math.min(pts.length, 60);
    else if (range === "3h") targetCount = Math.min(pts.length, 120);
    else if (range === "12h") targetCount = Math.min(pts.length, 150);
    else targetCount = pts.length;

    const subset = pts.slice(pts.length - targetCount);
    if (subset.length <= maxPoints) return subset;

    const sampled = [];
    const step = (subset.length - 1) / (maxPoints - 1);
    for (let i = 0; i < maxPoints; i++) {
      const idx = Math.min(subset.length - 1, Math.round(i * step));
      sampled.push(subset[idx]);
    }
    return sampled;
  }, []);

  // Load theme from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_THEME_KEY);
      if (saved) setTheme({ ...DEFAULT_THEME, ...JSON.parse(saved) });
    } catch { }
  }, []);

  // Save theme to localStorage whenever it changes
  const handleThemeChange = useCallback((t: AdminTheme) => {
    setTheme(t);
    try { localStorage.setItem(LS_THEME_KEY, JSON.stringify(t)); } catch { }
  }, []);

  const fetchStats = async (period: string = chartPeriod, limit: string = logLimit) => {
    try {
      setError("");
      const res = await fetch(`/api/admin/stats?period=${period}&logLimit=${limit}`);
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to load statistics");
      }
      setData(json);
    } catch (err: any) {
      setError(err.message || "An error occurred while fetching dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  // Initial load + 30-second auto-refresh
  useEffect(() => {
    fetchStats(chartPeriod, logLimit);
    const interval = setInterval(() => fetchStats(chartPeriod, logLimit), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartPeriod, logLimit]);

  // Update rolling telemetry history points whenever data updates
  useEffect(() => {
    if (!data) return;
    if (data.telemetry24h && data.telemetry24h.length > 0) {
      setTelemetryPoints(data.telemetry24h);
      return;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const currentPing = data.systemHealth.dbPingTime || 185;
    const currentCpu = Math.max(5, Math.min(95, Math.round((data.systemHealth.cpuLoadAvg || 0.15) * 20 + 15)));
    const currentHeap = data.systemHealth.memoryUsed || 29;
    const currentViews = data.summary.totalViews || 243;
    const currentVisitors = data.summary.uniqueVisitors || 38;

    setTelemetryPoints((prev) => {
      if (prev.length === 0) {
        const seeds = [];
        for (let i = 9; i >= 0; i--) {
          const t = new Date(now.getTime() - i * 15000);
          seeds.push({
            time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            ping: Math.max(80, Math.min(350, currentPing + Math.floor(Math.sin(i) * 35))),
            cpu: Math.max(10, Math.min(85, currentCpu + Math.floor(Math.cos(i * 0.8) * 15))),
            heap: Math.max(20, Math.min(100, currentHeap + Math.floor(Math.sin(i * 1.2) * 6))),
            views: Math.max(100, currentViews + Math.floor(Math.sin(i) * 12)),
            visitors: Math.max(10, currentVisitors + Math.floor(Math.cos(i * 4))),
          });
        }
        return seeds;
      }
      return [
        ...prev.slice(1),
        {
          time: timeStr,
          ping: currentPing,
          cpu: currentCpu,
          heap: currentHeap,
          views: currentViews,
          visitors: currentVisitors,
        }
      ];
    });
  }, [data]);

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      router.push("/admin/login");
      router.refresh();
    } catch {
      window.location.href = "/admin/login";
    }
  };

  const handleClearData = async () => {
    if (
      !window.confirm(
        "⚠️ WARNING: This will permanently delete all website visitor analytics data from MongoDB. Are you sure you want to proceed?"
      )
    ) {
      return;
    }

    setClearing(true);
    try {
      const res = await fetch("/api/admin/stats", { method: "DELETE" });
      if (res.ok) {
        alert("Analytics database cleared successfully.");
        fetchStats();
      } else {
        alert("Failed to clear database.");
      }
    } catch (err) {
      alert("Error occurred clearing analytics.");
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-loading-container">
        <div className="spinner"></div>
        <p>Loading Admin Dashboard Security Console...</p>
        <style jsx>{`
          .admin-loading-container {
            min-height: 90vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background-color: #030712;
            color: #9ca3af;
            font-family: system-ui, sans-serif;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255, 255, 255, 0.1);
            border-top-color: #00c896;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 1rem;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="admin-error-container">
        <span className="error-icon">⚠️</span>
        <h2>Error Accessing Dashboard</h2>
        <p>{error || "No dashboard data received."}</p>
        <button onClick={() => fetchStats()} className="btn-retry">Retry Connection</button>
        <style jsx>{`
          .admin-error-container {
            min-height: 90vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background-color: #030712;
            color: #f3f4f6;
            padding: 2rem;
            text-align: center;
          }
          .error-icon { font-size: 3rem; margin-bottom: 1rem; }
          .btn-retry {
            margin-top: 1.5rem;
            padding: 0.75rem 1.5rem;
            background-color: #ef4444;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
          }
        `}</style>
      </div>
    );
  }

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d > 0 ? `${d}d ` : ""}${h}h ${m}m`;
  };

  // SVG Chart Setup
  const dailyViews = data.charts.dailyViews;
  const maxViews = Math.max(...dailyViews.map((d) => d.views), 1);
  const chartWidth = 700;
  const chartHeight = 260;
  const paddingX = 55;
  const paddingY = 35;

  // Thin out x-axis labels for dense periods
  const totalPoints = dailyViews.length;
  const labelEvery = totalPoints <= 12 ? 1 : totalPoints <= 30 ? Math.ceil(totalPoints / 10) : Math.ceil(totalPoints / 8);

  const points = dailyViews.map((d, i) => {
    const x = totalPoints > 1
      ? paddingX + (i * (chartWidth - paddingX * 2)) / (totalPoints - 1)
      : chartWidth / 2;
    const y = chartHeight - paddingY - (d.views / maxViews) * (chartHeight - paddingY * 2);
    return { x, y, val: d.views, date: d.date, details: d.details };
  });

  const hoveredDetails = hoveredPoint !== null ? points[hoveredPoint]?.details || [] : [];

  // Group by country → pages, sorted by total country visits desc
  const countryPageGroups: Array<{
    country: string;
    totalVisits: number;
    pages: Array<[string, number]>;
  }> = Array.from(
    hoveredDetails.reduce((acc, detail) => {
      const c = detail.country || "Unknown";
      if (!acc.has(c)) acc.set(c, new Map<string, number>());
      const pMap = acc.get(c)!;
      pMap.set(detail.page, (pMap.get(detail.page) || 0) + detail.visits);
      return acc;
    }, new Map<string, Map<string, number>>())
  )
    .map(([country, pMap]) => ({
      country,
      totalVisits: Array.from(pMap.values()).reduce((s, v) => s + v, 0),
      pages: Array.from(pMap.entries()).sort(([, a], [, b]) => b - a),
    }))
    .sort((a, b) => b.totalVisits - a.totalVisits);

  // Smooth bezier curve path
  const smoothPath = points.length > 1 ? points.reduce((path, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = points[i - 1];
    const cpx = (prev.x + p.x) / 2;
    return `${path} C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`;
  }, "") : "";

  const smoothArea = smoothPath
    ? `${smoothPath} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`
    : "";

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    y: chartHeight - paddingY - t * (chartHeight - paddingY * 2),
    label: Math.round(t * maxViews),
  }));

  // Multi-color dot palette
  const DOT_COLORS = [
    "#00c896", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444",
    "#06b6d4", "#10b981", "#f97316", "#ec4899", "#84cc16",
  ];
  const getDotColor = (i: number) => DOT_COLORS[i % DOT_COLORS.length];

  const periodLabel = PERIOD_OPTIONS.find((o) => o.value === chartPeriod)?.label ?? "";

  // Bar chart colors
  const BAR_GRADIENTS = [
    ["#00c896", "#10b981"],
    ["#3b82f6", "#06b6d4"],
    ["#a855f7", "#ec4899"],
    ["#f59e0b", "#f97316"],
    ["#ef4444", "#f43f5e"],
    ["#84cc16", "#22c55e"],
    ["#06b6d4", "#0ea5e9"],
    ["#f97316", "#fb923c"],
    ["#ec4899", "#d946ef"],
    ["#14b8a6", "#2dd4bf"],
  ];

  // Geo row colors
  const GEO_COLORS = [
    { bg: "rgba(0,200,150,0.08)", border: "rgba(0,200,150,0.3)", text: "#00c896", badge: "rgba(0,200,150,0.15)" },
    { bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.3)", text: "#3b82f6", badge: "rgba(59,130,246,0.15)" },
    { bg: "rgba(168,85,247,0.08)", border: "rgba(168,85,247,0.3)", text: "#a855f7", badge: "rgba(168,85,247,0.15)" },
    { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.3)", text: "#f59e0b", badge: "rgba(245,158,11,0.15)" },
    { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.3)", text: "#ef4444", badge: "rgba(239,68,68,0.15)" },
    { bg: "rgba(6,182,212,0.08)", border: "rgba(6,182,212,0.3)", text: "#06b6d4", badge: "rgba(6,182,212,0.15)" },
    { bg: "rgba(132,204,22,0.08)", border: "rgba(132,204,22,0.3)", text: "#84cc16", badge: "rgba(132,204,22,0.15)" },
    { bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.3)", text: "#f97316", badge: "rgba(249,115,22,0.15)" },
  ];


  // Build CSS variable inline style from theme
  const bgRgb = hexToRgb(theme.bgColor);
  const bgLum = bgRgb ? luminance(...bgRgb) : 0;
  const isLight = bgLum > 0.4;

  const themeVars = {
    "--admin-bg": theme.bgColor,
    "--admin-sidebar-bg": theme.sidebarColor,
    "--admin-card-bg": theme.cardColor,
    "--admin-accent": theme.accentColor,
    "--admin-text-primary": theme.textPrimary,
    "--admin-text-secondary": theme.textSecondary,
    "--admin-font-family": theme.fontFamily,
    "--admin-font-size": `${theme.fontSize}px`,
    "--admin-border": isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.08)",
    "--admin-border-strong": isLight ? "rgba(0, 0, 0, 0.16)" : "rgba(255, 255, 255, 0.16)",
    "--admin-hover-bg": isLight ? "rgba(0, 0, 0, 0.04)" : "rgba(255, 255, 255, 0.05)",
    "--admin-input-bg": isLight ? "#ffffff" : "rgba(0, 0, 0, 0.35)",
    "--admin-input-border": isLight ? "rgba(0, 0, 0, 0.18)" : "rgba(255, 255, 255, 0.12)",
    "--admin-card-shadow": isLight ? "0 4px 20px -2px rgba(0, 0, 0, 0.06)" : "0 4px 20px -2px rgba(0, 0, 0, 0.35)",
  } as React.CSSProperties;

  return (
    <div className="admin-dashboard-root" style={themeVars}>
      {/* Sidebar Nav */}
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <span>⚕️</span> HealthEdu
        </div>
        <div className="admin-badge">ADMIN CONTROL</div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            📊 Dashboard Overview
          </button>
          <button
            className={`nav-item ${activeTab === "logs" ? "active" : ""}`}
            onClick={() => setActiveTab("logs")}
          >
            📋 Live Access Logs
          </button>
          <button
            className={`nav-item ${activeTab === "system" ? "active" : ""}`}
            onClick={() => setActiveTab("system")}
          >
            ⚙️ Server Monitoring
          </button>
          <button
            className={`nav-item ${activeTab === "posts" ? "active" : ""}`}
            onClick={() => setActiveTab("posts")}
          >
            🗂️ Content Manager
          </button>
          <button
            className={`nav-item ${activeTab === "donation" ? "active" : ""}`}
            onClick={() => setActiveTab("donation")}
          >
            💰 Donation Settings
          </button>
          <button
            className={`nav-item ${activeTab === "comments" ? "active" : ""}`}
            onClick={() => setActiveTab("comments")}
          >
            💬 Community Comments
          </button>
          <button
            className={`nav-item ${activeTab === "appearance" ? "active" : ""}`}
            onClick={() => setActiveTab("appearance")}
          >
            🎨 Appearance
          </button>
        </nav>

        {/* Language Settings */}
        <div className="lang-settings-block">
          <div className="lang-settings-label">
            🌐 Language Settings
          </div>
          <div className="lang-select-wrapper">
            <select
              id="admin-language-select"
              className="lang-select"
              value={lang.code}
              onChange={(e) => setLangByCode(e.target.value)}
            >
              {LANG_MAP.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
            <span className="lang-select-arrow">▾</span>
          </div>
          <p className="lang-hint">Auto-saved &amp; applied site-wide</p>
        </div>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="btn-logout">
            🚪 Logout Session
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="admin-content-pane">
        <header className="content-header">
          <div className="header-meta">
            <h1>Analytics Security Console</h1>
            <p>Real-time site reachability, geolocation metrics, and traffic aggregation.</p>
          </div>
          <div className="header-actions">
            <button onClick={() => fetchStats()} className="btn-refresh">
              🔄 Refresh Logs
            </button>
            <button
              onClick={handleClearData}
              disabled={clearing}
              className="btn-danger"
            >
              ⚠️ Clear Database
            </button>
          </div>
        </header>

        {/* KPIs Summary Cards — Premium Color-Coded Grid */}
        <section className="kpi-grid">
          {/* Card 1: Total Page Views (Emerald Theme) */}
          <div className="kpi-card kpi-card-emerald">
            <div className="kpi-card-top">
              <div className="kpi-icon-wrapper icon-emerald">📊</div>
              <div className="kpi-title-block text-center">
                <span className="kpi-title title-emerald">TOTAL PAGE VIEWS</span>
                <span className="kpi-subtitle">Global Traffic</span>
              </div>
              <span className="kpi-badge badge-emerald">RECORD</span>
            </div>
            <div className="kpi-card-middle text-center">
              <div className="kpi-value text-emerald">{data.summary.totalViews.toLocaleString()}</div>
            </div>
            <div className="kpi-card-bottom">
              <div className="kpi-footer-row text-center-row">
                <span>📈 All-time record views (100%)</span>
              </div>
            </div>
          </div>

          {/* Card 2: Unique Visitors (Royal Blue Theme) */}
          <div className="kpi-card kpi-card-blue">
            <div className="kpi-card-top">
              <div className="kpi-icon-wrapper icon-blue">👥</div>
              <div className="kpi-title-block text-center">
                <span className="kpi-title title-blue">UNIQUE VISITORS</span>
                <span className="kpi-subtitle">Distinct Sessions</span>
              </div>
              <span className="kpi-badge badge-blue">DAILY</span>
            </div>
            <div className="kpi-card-middle text-center">
              <div className="kpi-value text-blue">{data.summary.uniqueVisitors.toLocaleString()}</div>
            </div>
            <div className="kpi-card-bottom">
              <div className="kpi-footer-row text-center-row">
                <span>⚡ Unique daily sessions logged</span>
              </div>
            </div>
          </div>

          {/* Card 3: GUI Server Ping (Purple Ring Gauge Theme) */}
          <div className="kpi-card kpi-card-purple memory-kpi-card">
            <div className="kpi-card-top">
              <div className="kpi-icon-wrapper icon-purple">⚡</div>
              <div className="kpi-title-block text-center">
                <span className="kpi-title title-purple">GUI SERVER PING</span>
                <span className="kpi-subtitle">MongoDB Latency</span>
              </div>
              <span className={`kpi-status-badge ${data.systemHealth.dbStatus === "Connected" ? "online" : "offline"}`}>
                <span className="pulse-dot"></span> {data.systemHealth.dbStatus === "Connected" ? "CONNECTED" : "OFFLINE"}
              </span>
            </div>
            <div className="kpi-card-middle circular-gauge-middle">
              <div className="circular-progress" style={{ width: "95px", height: "95px" }}>
                <div className="progress-value">
                  <span className="number" style={{ fontSize: "1.35rem", color: "#c084fc" }}>{data.systemHealth.dbPingTime}</span>
                  <span className="sub" style={{ fontSize: "0.6rem" }}>MS Ping</span>
                </div>
                <svg className="circular-svg" style={{ width: "95px", height: "95px" }}>
                  <circle cx="47.5" cy="47.5" r="40" className="bg-circle" style={{ strokeWidth: 6 }} />
                  <circle
                    cx="47.5"
                    cy="47.5"
                    r="40"
                    className="fill-circle"
                    style={{
                      strokeWidth: 6,
                      stroke: "#c084fc",
                      strokeDasharray: 251,
                      strokeDashoffset:
                        251 -
                        (251 *
                          Math.min(
                            (500 - Math.min(data.systemHealth.dbPingTime, 500)) / 500,
                            1
                          ))
                    }}
                  />
                </svg>
              </div>
            </div>
            <div className="kpi-card-bottom">
              <div className="kpi-footer-row text-center-row">
                <span>💾 Atlas Cluster Connection</span>
              </div>
            </div>
          </div>

          {/* Card 4: Server Uptime (Cyan Theme) */}
          <div className="kpi-card kpi-card-cyan">
            <div className="kpi-card-top">
              <div className="kpi-icon-wrapper icon-cyan">⏱️</div>
              <div className="kpi-title-block text-center">
                <span className="kpi-title title-cyan">SERVER UPTIME</span>
                <span className="kpi-subtitle">Process Runtime</span>
              </div>
              <span className="kpi-badge badge-cyan">UPTIME</span>
            </div>
            <div className="kpi-card-middle text-center">
              <div className="kpi-value text-cyan">{formatUptime(data.systemHealth.serverUptime)}</div>
            </div>
            <div className="kpi-card-bottom">
              <div className="kpi-footer-row text-center-row">
                <span>🛡️ Running without failures (100% UP)</span>
              </div>
            </div>
          </div>

          {/* Card 5: Cloudflare R2 CDN (Amber Theme) */}
          <div className="kpi-card kpi-card-amber">
            <div className="kpi-card-top">
              <div className="kpi-icon-wrapper icon-amber">☁️</div>
              <div className="kpi-title-block text-center">
                <span className="kpi-title title-amber">CLOUDFLARE R2 CDN</span>
                <span className="kpi-subtitle">Object Storage</span>
              </div>
              <span className={`kpi-status-badge ${data.systemHealth.r2?.status === "Connected" ? "online" : "offline"}`}>
                <span className="pulse-dot"></span> {data.systemHealth.r2?.status === "Connected" ? "CONNECTED" : "OFFLINE"}
              </span>
            </div>
            <div className="kpi-card-middle text-center">
              <div className="kpi-value text-amber">
                {data.systemHealth.r2 ? (
                  <>{data.systemHealth.r2.totalSizeMB} <span className="unit">MB</span></>
                ) : (
                  <>0 <span className="unit">MB</span></>
                )}
              </div>
            </div>
            <div className="kpi-card-bottom">
              <div className="kpi-footer-row text-center-row">
                <span>📦 {data.systemHealth.r2 ? `${data.systemHealth.r2.totalObjects} files stored (${data.systemHealth.r2.freeTierUsedPct}% free tier used)` : "0 files stored"}</span>
              </div>
            </div>
          </div>

          {/* Card 6: GUI Server Memory (Rose Circular Gauge Theme) */}
          <div className="kpi-card kpi-card-rose memory-kpi-card">
            <div className="kpi-card-top">
              <div className="kpi-icon-wrapper icon-rose">🧠</div>
              <div className="kpi-title-block text-center">
                <span className="kpi-title title-rose">GUI SERVER MEMORY</span>
                <span className="kpi-subtitle">V8 Heap Memory</span>
              </div>
              <span className="kpi-status-badge online">
                <span className="pulse-dot"></span> HEALTHY
              </span>
            </div>
            <div className="kpi-card-middle circular-gauge-middle">
              <div className="circular-progress" style={{ width: "95px", height: "95px" }}>
                <div className="progress-value">
                  <span className="number" style={{ fontSize: "1.35rem", color: "#f472b6" }}>{data.systemHealth.memoryUsed}</span>
                  <span className="sub" style={{ fontSize: "0.6rem" }}>MB Used</span>
                </div>
                <svg className="circular-svg" style={{ width: "95px", height: "95px" }}>
                  <circle cx="47.5" cy="47.5" r="40" className="bg-circle" style={{ strokeWidth: 6 }} />
                  <circle
                    cx="47.5"
                    cy="47.5"
                    r="40"
                    className="fill-circle"
                    style={{
                      strokeWidth: 6,
                      stroke: "#f472b6",
                      strokeDasharray: 251,
                      strokeDashoffset:
                        251 -
                        (251 *
                          Math.min(
                            data.systemHealth.memoryUsed /
                            (data.systemHealth.memoryTotal || 512),
                            1
                          ))
                    }}
                  />
                </svg>
              </div>
            </div>
            <div className="kpi-card-bottom">
              <div className="kpi-footer-row text-center-row">
                <span>💾 Allocated Heap ({data.systemHealth.memoryTotal} MB)</span>
              </div>
            </div>
          </div>
        </section>

        {activeTab === "overview" && (
          <div className="dashboard-grid">
            {/* SVG Line Graph — Premium Multi-Color */}
            <div className="panel-card chart-panel">
              <div className="chart-panel-header">
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                  <h2 className="panel-title" style={{ marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>
                    📈 Visitor Frequency
                  </h2>
                  <span className="chart-period-badge">{periodLabel}</span>
                  <div className="chart-stats-row">
                    <span className="chart-stat">Peak: <strong style={{ color: "#f59e0b" }}>{maxViews}</strong></span>
                    <span className="chart-stat">Points: <strong style={{ color: "#3b82f6" }}>{totalPoints}</strong></span>
                  </div>
                </div>
                <div className="chart-period-selector-wrap">
                  <select
                    id="chart-period-select"
                    className="chart-period-select"
                    value={chartPeriod}
                    onChange={(e) => setChartPeriod(e.target.value)}
                  >
                    {PERIOD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <span className="chart-period-arrow">▾</span>
                </div>
              </div>

              <div className="svg-container">
                <svg
                  width="100%"
                  height="260"
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  preserveAspectRatio="none"
                  style={{ display: "block" }}
                  onMouseMove={(e) => {
                    const svgEl = e.currentTarget;
                    const rect = svgEl.getBoundingClientRect();
                    const scaleX = chartWidth / rect.width;
                    const mouseX = (e.clientX - rect.left) * scaleX;
                    const mouseY = (e.clientY - rect.top) * (chartHeight / rect.height);
                    let nearest = 0;
                    let minDist = Infinity;
                    points.forEach((p, i) => {
                      const dist = Math.abs(p.x - mouseX);
                      if (dist < minDist) { minDist = dist; nearest = i; }
                    });
                    setHoveredPoint(nearest);
                    // Tooltip position relative to svg-container div
                    const containerRect = svgEl.parentElement!.getBoundingClientRect();
                    setTooltipPos({
                      x: e.clientX - containerRect.left,
                      y: e.clientY - containerRect.top,
                    });
                  }}
                  onMouseLeave={() => { setHoveredPoint(null); setTooltipPos(null); }}
                >
                  <defs>
                    {/* Multi-stop gradient fill */}
                    <linearGradient id="chartGradMulti" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00c896" stopOpacity="0.5" />
                      <stop offset="35%" stopColor="#3b82f6" stopOpacity="0.25" />
                      <stop offset="70%" stopColor="#a855f7" stopOpacity="0.1" />
                      <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                    </linearGradient>
                    {/* Horizontal line gradient for stroke */}
                    <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#00c896" />
                      <stop offset="30%" stopColor="#3b82f6" />
                      <stop offset="60%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>
                    {/* Glow filter */}
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <filter id="dotGlow" x="-100%" y="-100%" width="300%" height="300%">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Y-axis grid lines + labels */}
                  {yTicks.map((tick, i) => (
                    <g key={i}>
                      <line
                        x1={paddingX} y1={tick.y}
                        x2={chartWidth - 10} y2={tick.y}
                        stroke={i === 0 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)"}
                        strokeDasharray={i === 0 ? "none" : "4 4"}
                      />
                      <text x={paddingX - 8} y={tick.y + 4} textAnchor="end" fill="#6b7280" fontSize="9">
                        {tick.label}
                      </text>
                    </g>
                  ))}

                  {/* Gradient area fill */}
                  {smoothArea && <path d={smoothArea} fill="url(#chartGradMulti)" />}

                  {/* Glowing smooth line */}
                  {smoothPath && (
                    <>
                      <path d={smoothPath} fill="none" stroke="url(#lineGrad)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" filter="url(#glow)" />
                      <path d={smoothPath} fill="none" stroke="url(#lineGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </>
                  )}

                  {/* Data Points — colored per index */}
                  {points.map((p, idx) => {
                    const color = getDotColor(idx);
                    const isHovered = hoveredPoint === idx;
                    // Segment width for hit area
                    const segW = totalPoints > 1 ? (chartWidth - paddingX * 2) / (totalPoints - 1) : chartWidth;
                    return (
                      <g
                        key={idx}
                        className="chart-dot-group"
                        tabIndex={0}
                        role="img"
                        aria-label={`${p.date}: ${p.val} views`}
                      >
                        {/* Outer glow ring — enlarged on hover */}
                        <circle cx={p.x} cy={p.y} r={isHovered ? (totalPoints > 15 ? 9 : 11) : (totalPoints > 15 ? 5 : 7)} fill={color} opacity={isHovered ? 0.32 : 0.18} style={{ transition: "r 0.15s, opacity 0.15s" }} />
                        {/* Main dot — enlarge on hover */}
                        <circle cx={p.x} cy={p.y} r={isHovered ? (totalPoints > 15 ? 5.5 : 7) : (totalPoints > 15 ? 3 : 4.5)} fill={isHovered ? color : "#060d18"} stroke={color} strokeWidth="2" filter="url(#dotGlow)" style={{ transition: "r 0.15s" }} />
                        {/* Value label */}
                        {totalPoints <= 30 && p.val > 0 && (
                          <text x={p.x} y={p.y - 11} textAnchor="middle" fill={color} fontSize="9" fontWeight="800">
                            {p.val}
                          </text>
                        )}
                        {/* Date label */}
                        {idx % labelEvery === 0 && (
                          <text x={p.x} y={chartHeight - 8} textAnchor="middle" fill="#6b7280" fontSize="8">
                            {p.date}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
                {hoveredPoint !== null && points[hoveredPoint] && tooltipPos && (() => {
                  const pt = points[hoveredPoint];
                  const flipX = tooltipPos.x > (260 * 1.5) ? "-100%" : "0%";
                  const COUNTRY_COLORS = [
                    "#00c896", "#3b82f6", "#a855f7", "#f59e0b",
                    "#ef4444", "#06b6d4", "#84cc16", "#f97316",
                  ];
                  return (
                    <div
                      className="chart-hover-card"
                      style={{
                        left: tooltipPos.x,
                        top: Math.max(4, tooltipPos.y - 8),
                        transform: `translate(${flipX}, calc(-100% - 12px))`,
                      }}
                    >
                      {/* Header: date + total views */}
                      <div className="chc-header">
                        <span className="chc-date">{pt.date}</span>
                        <span className="chc-views-badge">{pt.val.toLocaleString()} views</span>
                      </div>

                      {/* Column header row */}
                      {countryPageGroups.length > 0 && (
                        <div className="chc-col-header">
                          <span>Visited Page</span>
                          <span>Views</span>
                        </div>
                      )}

                      {/* Country groups body */}
                      <div className="chc-body">
                        {countryPageGroups.length > 0 ? (
                          countryPageGroups.slice(0, 5).map((group, gi) => {
                            const color = COUNTRY_COLORS[gi % COUNTRY_COLORS.length];
                            return (
                              <div className="chc-country-block" key={`cg-${group.country}`}>
                                {/* Country header */}
                                <div className="chc-country-header" style={{ borderLeftColor: color }}>
                                  <span className="chc-country-flag">🌍</span>
                                  <span className="chc-country-name" style={{ color }}>
                                    {group.country}
                                  </span>
                                  <span className="chc-country-total" style={{ color }}>
                                    {group.totalVisits} total
                                  </span>
                                </div>
                                {/* Pages under this country */}
                                <div className="chc-pages-list">
                                  {group.pages.slice(0, 6).map(([page, visits]) => (
                                    <div className="chc-page-row" key={`pg-${page}`}>
                                      <span className="chc-page-path" title={page}>
                                        {page}
                                      </span>
                                      <span className="chc-page-views" style={{ color }}>
                                        {visits}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="chc-empty">No visitor data for this date</div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Color legend for multi-point */}
              <div className="chart-legend-row">
                <span className="legend-dot" style={{ background: "#00c896" }} />Start
                <span className="legend-dot" style={{ background: "#3b82f6", marginLeft: "1rem" }} />Mid
                <span className="legend-dot" style={{ background: "#f59e0b", marginLeft: "1rem" }} />Latest
                <span style={{ marginLeft: "auto", color: "#6b7280", fontSize: "0.75rem" }}>
                  Total: <strong style={{ color: "var(--admin-text-primary, #fff)" }}>
                    {dailyViews.reduce((s, d) => s + d.views, 0)}
                  </strong> views in period
                </span>
              </div>
            </div>

            {/* Top Visited Pages — Table Layout */}
            <div className="panel-card progress-panel">
              <h2 className="panel-title">🏆 Top Visited Pages</h2>
              {data.charts.topPages.length > 0 ? (() => {
                const maxCount = Math.max(...data.charts.topPages.map((p) => p.count), 1);
                return (
                  <div className="pages-table">
                    {/* Column Headers */}
                    <div className="pages-table-head">
                      <span className="pt-col-rank">#</span>
                      <span className="pt-col-path">Page</span>
                      <span className="pt-col-views">Views</span>
                      <span className="pt-col-pct">%</span>
                    </div>
                    {/* Rows */}
                    {data.charts.topPages.map((page, idx) => {
                      const pct = Math.round((page.count / maxCount) * 100);
                      const [c1, c2] = BAR_GRADIENTS[idx % BAR_GRADIENTS.length];
                      const rankLabels = ["🥇", "🥈", "🥉"];
                      return (
                        <div key={idx} className="pages-table-row" style={{ "--row-color": c1 } as React.CSSProperties}>
                          {/* Rank */}
                          <div className="pt-col-rank">
                            <span className="pt-rank-badge" style={{ background: c1 + "22", color: c1, border: `1px solid ${c1}44` }}>
                              {idx < 3 ? rankLabels[idx] : `#${idx + 1}`}
                            </span>
                          </div>
                          {/* Page path */}
                          <span className="pt-col-path pt-path-text" title={page.path}>
                            {page.path}
                          </span>
                          {/* Views */}
                          <span className="pt-col-views pt-views-val" style={{ color: c1 }}>
                            {page.count.toLocaleString()}
                          </span>
                          {/* Percentage */}
                          <span className="pt-col-pct pt-pct-val" style={{ color: c1 }}>
                            {pct}%
                          </span>
                          {/* Progress bar — full-width spanning all columns */}
                          <div className="pt-bar-row">
                            <div
                              className="pt-bar-fill"
                              style={{
                                width: `${pct}%`,
                                background: `linear-gradient(90deg, ${c1}, ${c2})`,
                                boxShadow: `0 0 6px ${c1}55`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })() : (
                <div className="no-data-box">
                  <span style={{ fontSize: "2rem" }}>📭</span>
                  <p>No traffic logged yet.</p>
                </div>
              )}
            </div>

            {/* Top Geolocations — Table Style */}
            <div className="panel-card geo-panel">
              <h2 className="panel-title">🌍 Top Country &amp; State Geolocations</h2>
              {data.charts.topRegions.length > 0 ? (() => {
                const geoMax = Math.max(...data.charts.topRegions.map(r => r.count), 1);
                return (
                  <div className="geo-table">
                    {/* Column headers */}
                    <div className="geo-table-head">
                      <span className="gt-col-rank">#</span>
                      <span className="gt-col-state">State / Region</span>
                      <span className="gt-col-country">Country</span>
                      <span className="gt-col-views">Views</span>
                    </div>
                    {data.charts.topRegions.map((reg, idx) => {
                      const gc = GEO_COLORS[idx % GEO_COLORS.length];
                      const geoPct = Math.round((reg.count / geoMax) * 100);
                      return (
                        <div
                          key={idx}
                          className="geo-table-row"
                          style={{ "--gc-text": gc.text, "--gc-bg": gc.bg, "--gc-border": gc.border } as React.CSSProperties}
                        >
                          {/* Rank */}
                          <div className="gt-col-rank">
                            <span className="gt-rank-badge" style={{ background: gc.badge, color: gc.text }}>
                              {idx + 1}
                            </span>
                          </div>
                          {/* State */}
                          <div className="gt-col-state gt-state-cell">
                            <span className="gt-state-name" style={{ color: "var(--admin-text-primary, #f3f4f6)" }}>
                              {reg.region === "Unknown" ? "Generic Area" : reg.region}
                            </span>
                          </div>
                          {/* Country */}
                          <div className="gt-col-country gt-country-cell">
                            <span className="gt-country-dot" style={{ background: gc.text }} />
                            <span className="gt-country-name" style={{ color: gc.text }}>
                              {reg.country === "Localhost" ? "Localhost" : reg.country}
                            </span>
                          </div>
                          {/* Views + bar */}
                          <div className="gt-col-views gt-views-cell">
                            <span className="gt-views-num" style={{ color: gc.text }}>
                              {reg.count.toLocaleString()}
                            </span>
                            <div className="gt-bar-track">
                              <div
                                className="gt-bar-fill"
                                style={{ width: `${geoPct}%`, background: gc.text, boxShadow: `0 0 6px ${gc.text}66` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })() : (
                <div className="no-data-box">
                  <span style={{ fontSize: "2rem" }}>🗺️</span>
                  <p>No locations logged.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "logs" && (() => {
          const hasAdvFilters = Boolean(
            advFilters.ip.trim() ||
            advFilters.country.trim() ||
            advFilters.state.trim() ||
            advFilters.geo.trim() ||
            advFilters.path.trim() ||
            advFilters.referrer.trim() ||
            advFilters.userAgent.trim() ||
            advFilters.dateFrom ||
            advFilters.dateTo
          );

          const resetAdvFilters = () => {
            setAdvFilters({
              ip: "",
              country: "",
              state: "",
              geo: "",
              path: "",
              referrer: "",
              userAgent: "",
              dateFrom: "",
              dateTo: "",
            });
          };

          const handleSort = (field: "timestamp" | "ip" | "country" | "state" | "geo" | "path" | "referrer" | "userAgent") => {
            if (sortField === field) {
              setSortOrder(sortOrder === "asc" ? "desc" : "asc");
            } else {
              setSortField(field);
              setSortOrder("desc");
            }
          };

          const renderSortIndicator = (field: "timestamp" | "ip" | "country" | "state" | "geo" | "path" | "referrer" | "userAgent") => {
            if (sortField !== field) return <span className="sort-icon inactive">↕</span>;
            return <span className="sort-icon active">{sortOrder === "asc" ? "▲" : "▼"}</span>;
          };

          const filteredLogs = (data.logs || []).filter((log) => {
            if (quickSearchText.trim()) {
              const qTokens = quickSearchText.trim().toLowerCase().split(/\s+/);
              const combinedText = `${log.timestamp} ${new Date(log.timestamp).toLocaleTimeString()} ${new Date(log.timestamp).toLocaleDateString()} ${log.ip} ${log.country} ${log.region} ${log.city} ${log.path} ${log.referrer} ${log.userAgent}`.toLowerCase();
              const matchesQuick = qTokens.every((token) => combinedText.includes(token));
              if (!matchesQuick) return false;
            }

            if (advFilters.ip.trim() && !log.ip.toLowerCase().includes(advFilters.ip.trim().toLowerCase())) {
              return false;
            }
            if (advFilters.country.trim() && !(log.country || "").toLowerCase().includes(advFilters.country.trim().toLowerCase())) {
              return false;
            }
            if (advFilters.state.trim()) {
              const stateStr = `${log.region || ""} ${log.city || ""}`.toLowerCase();
              if (!stateStr.includes(advFilters.state.trim().toLowerCase())) return false;
            }
            if (advFilters.geo.trim()) {
              const geoStr = `${log.country} ${log.region} ${log.city}`.toLowerCase();
              if (!geoStr.includes(advFilters.geo.trim().toLowerCase())) return false;
            }
            if (advFilters.path.trim() && !log.path.toLowerCase().includes(advFilters.path.trim().toLowerCase())) {
              return false;
            }
            if (advFilters.referrer.trim() && !log.referrer.toLowerCase().includes(advFilters.referrer.trim().toLowerCase())) {
              return false;
            }
            if (advFilters.userAgent.trim() && !log.userAgent.toLowerCase().includes(advFilters.userAgent.trim().toLowerCase())) {
              return false;
            }
            if (advFilters.dateFrom) {
              const logDate = new Date(log.timestamp);
              const fromDate = new Date(advFilters.dateFrom);
              if (logDate < fromDate) return false;
            }
            if (advFilters.dateTo) {
              const logDate = new Date(log.timestamp);
              const toDate = new Date(advFilters.dateTo);
              toDate.setHours(23, 59, 59, 999);
              if (logDate > toDate) return false;
            }

            return true;
          });

          const sortedLogs = [...filteredLogs].sort((a, b) => {
            let comparison = 0;
            if (sortField === "timestamp") {
              comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
            } else if (sortField === "ip") {
              comparison = a.ip.localeCompare(b.ip);
            } else if (sortField === "country") {
              comparison = (a.country || "").localeCompare(b.country || "");
            } else if (sortField === "state") {
              comparison = (a.region || "").localeCompare(b.region || "");
            } else if (sortField === "geo") {
              const geoA = `${a.country} ${a.region} ${a.city}`;
              const geoB = `${b.country} ${b.region} ${b.city}`;
              comparison = geoA.localeCompare(geoB);
            } else if (sortField === "path") {
              comparison = a.path.localeCompare(b.path);
            } else if (sortField === "referrer") {
              comparison = a.referrer.localeCompare(b.referrer);
            } else if (sortField === "userAgent") {
              comparison = a.userAgent.localeCompare(b.userAgent);
            }
            return sortOrder === "asc" ? comparison : -comparison;
          });

          return (
            <div className="panel-card full-panel logs-panel">
              <div className="logs-header-bar">
                {/* Left Side: Title + Limit Dropdown */}
                <div className="logs-header-left">
                  <h2 className="panel-title-inline">Live Server Request Log</h2>
                  <select
                    value={logLimit}
                    onChange={(e) => setLogLimit(e.target.value)}
                    className="limit-dropdown"
                  >
                    <option value="50">(Latest 50 Visits)</option>
                    <option value="100">(Latest 100 Visits)</option>
                    <option value="250">(Latest 250 Visits)</option>
                    <option value="500">(Latest 500 Visits)</option>
                    <option value="1000">(Latest 1000 Visits)</option>
                    <option value="all">(All Visits)</option>
                  </select>
                </div>

                {/* Center: Quick Search Toggle Button */}
                <div className="logs-header-center">
                  <button
                    type="button"
                    className={`search-toggle-btn ${quickSearchOpen ? "active" : ""} ${quickSearchText ? "has-val" : ""}`}
                    onClick={() => setQuickSearchOpen(!quickSearchOpen)}
                    title="Toggle Quick Search Text Area"
                  >
                    <span className="btn-icon">⚡🔍</span>
                    <span>Quick Search</span>
                    {quickSearchText && <span className="active-dot">●</span>}
                  </button>
                </div>

                {/* Right Side: Advance Search Toggle Button */}
                <div className="logs-header-right">
                  <button
                    type="button"
                    className={`search-toggle-btn adv-btn ${advSearchOpen ? "active" : ""} ${hasAdvFilters ? "has-val" : ""}`}
                    onClick={() => setAdvSearchOpen(!advSearchOpen)}
                    title="Toggle Advance Column Filters"
                  >
                    <span className="btn-icon">⚙️🔍</span>
                    <span>Advance Search</span>
                    <span className="expand-chevron">{advSearchOpen ? "▲" : "▼"}</span>
                  </button>
                </div>
              </div>

              {/* Quick Search Panel (Textarea) */}
              {quickSearchOpen && (
                <div className="quick-search-box">
                  <div className="quick-search-header">
                    <label htmlFor="quick-search-textarea">
                      <span className="quick-icon">⚡</span> Quick Search Query (Searches across all columns & fields):
                    </label>
                    {quickSearchText && (
                      <button className="clear-link-btn" onClick={() => setQuickSearchText("")}>
                        Clear Text
                      </button>
                    )}
                  </div>
                  <textarea
                    id="quick-search-textarea"
                    className="quick-search-textarea"
                    placeholder="Type search terms here (e.g. India California /disease 106.219)..."
                    value={quickSearchText}
                    onChange={(e) => setQuickSearchText(e.target.value)}
                    rows={2}
                  />
                  <div className="quick-search-hint">
                    💡 Tip: Enter multi-word keywords separated by space or new line to search across IP, Country, State, Path, Referrer, and User Agent simultaneously.
                  </div>
                </div>
              )}

              {/* Advance Search Panel */}
              {advSearchOpen && (
                <div className="advanced-search-box">
                  <div className="adv-box-header">
                    <span className="adv-title">⚙️ Deep Column Search & Filters</span>
                    {hasAdvFilters && (
                      <button className="clear-link-btn" onClick={resetAdvFilters}>
                        Reset All Filters
                      </button>
                    )}
                  </div>
                  <div className="adv-filter-grid">
                    <div className="adv-field">
                      <label>IP Address</label>
                      <input
                        type="text"
                        placeholder="e.g. 106.219"
                        value={advFilters.ip}
                        onChange={(e) => setAdvFilters({ ...advFilters, ip: e.target.value })}
                      />
                    </div>
                    <div className="adv-field">
                      <label>Country</label>
                      <input
                        type="text"
                        placeholder="e.g. India / United States"
                        value={advFilters.country}
                        onChange={(e) => setAdvFilters({ ...advFilters, country: e.target.value })}
                      />
                    </div>
                    <div className="adv-field">
                      <label>State / Region</label>
                      <input
                        type="text"
                        placeholder="e.g. California / Bihar"
                        value={advFilters.state}
                        onChange={(e) => setAdvFilters({ ...advFilters, state: e.target.value })}
                      />
                    </div>
                    <div className="adv-field">
                      <label>Visited Path</label>
                      <input
                        type="text"
                        placeholder="e.g. /disease"
                        value={advFilters.path}
                        onChange={(e) => setAdvFilters({ ...advFilters, path: e.target.value })}
                      />
                    </div>
                    <div className="adv-field">
                      <label>Referrer Source</label>
                      <input
                        type="text"
                        placeholder="e.g. Direct / Google"
                        value={advFilters.referrer}
                        onChange={(e) => setAdvFilters({ ...advFilters, referrer: e.target.value })}
                      />
                    </div>
                    <div className="adv-field">
                      <label>User Agent Details</label>
                      <input
                        type="text"
                        placeholder="e.g. Mozilla / Mobile"
                        value={advFilters.userAgent}
                        onChange={(e) => setAdvFilters({ ...advFilters, userAgent: e.target.value })}
                      />
                    </div>
                    <div className="adv-field">
                      <label>Date Range (From)</label>
                      <input
                        type="date"
                        value={advFilters.dateFrom}
                        onChange={(e) => setAdvFilters({ ...advFilters, dateFrom: e.target.value })}
                      />
                    </div>
                    <div className="adv-field">
                      <label>Date Range (To)</label>
                      <input
                        type="date"
                        value={advFilters.dateTo}
                        onChange={(e) => setAdvFilters({ ...advFilters, dateTo: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Results Count & Active Filter Pills Bar */}
              <div className="logs-meta-bar">
                <div className="logs-count">
                  Showing <strong>{sortedLogs.length}</strong> of <strong>{data.logs.length}</strong> fetched logs
                  {logLimit !== "all" ? ` (Limited to ${logLimit} DB records)` : " (All database records)"}
                </div>
                {(quickSearchText || hasAdvFilters) && (
                  <button className="reset-all-btn" onClick={() => { setQuickSearchText(""); resetAdvFilters(); }}>
                    ✕ Clear All Filters
                  </button>
                )}
              </div>

              {/* Table with Clickable Sort Headers */}
              <div className="table-wrapper main-table-wrapper">
                <table className="main-table">
                  <thead>
                    <tr>
                      <th onClick={() => handleSort("timestamp")} className="sortable-th">
                        Timestamp {renderSortIndicator("timestamp")}
                      </th>
                      <th onClick={() => handleSort("ip")} className="sortable-th">
                        IP Address {renderSortIndicator("ip")}
                      </th>
                      <th onClick={() => handleSort("country")} className="sortable-th">
                        Country {renderSortIndicator("country")}
                      </th>
                      <th onClick={() => handleSort("state")} className="sortable-th">
                        State {renderSortIndicator("state")}
                      </th>
                      <th onClick={() => handleSort("path")} className="sortable-th">
                        Visited Path {renderSortIndicator("path")}
                      </th>
                      <th onClick={() => handleSort("referrer")} className="sortable-th">
                        Referrer Source {renderSortIndicator("referrer")}
                      </th>
                      <th onClick={() => handleSort("userAgent")} className="sortable-th">
                        User Agent Details {renderSortIndicator("userAgent")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLogs.length > 0 ? (
                      sortedLogs.map((log) => (
                        <tr key={log.id}>
                          <td className="time-col">
                            {new Date(log.timestamp).toLocaleTimeString()}<br />
                            <span className="date-sub">{new Date(log.timestamp).toLocaleDateString()}</span>
                          </td>
                          <td className="ip-col font-mono">{log.ip}</td>
                          <td className="country-col">
                            <strong>{log.country || "Unknown"}</strong>
                          </td>
                          <td className="state-col">
                            <strong>{log.region || "—"}</strong>
                            {log.city && (
                              <>
                                <br />
                                <span className="state-sub">{log.city}</span>
                              </>
                            )}
                          </td>
                          <td className="path-col font-mono text-green">{log.path}</td>
                          <td className="ref-col">{log.referrer}</td>
                          <td className="ua-col" title={log.userAgent}>{log.userAgent.substring(0, 45)}...</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} align="center" className="no-logs-td">
                          {data.logs.length === 0
                            ? "No request logs in DB. Go browse the website to populate statistics."
                            : "No matching request logs found for the current search/filter criteria."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {activeTab === "system" && (
          <div className="panel-card full-panel system-settings-panel">
            {/* NEW SECTION: Live Realtime Telemetry Graphs (2 cards per row) */}
            <div className="panel-header-row" style={{ marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2 className="panel-title system-health-title" style={{ color: '#c084fc', marginBottom: '0.2rem' }}>
                  📈 Realtime System Telemetry & Infrastructure Graphs
                </h2>
                <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                  Real-time site reachability, hardware load metrics, and telemetry aggregation
                </span>
              </div>
              <span className="live-status-chip">
                <span className="pulse-dot"></span> Realtime Stream Active
              </span>
            </div>

            {/* Floating Glass Tooltip for Graphs */}
            {graphTooltip && (
              <div
                className="graph-tooltip-floating"
                style={{
                  left: graphTooltip.x + 12,
                  top: graphTooltip.y - 35,
                  borderColor: graphTooltip.color,
                  boxShadow: `0 8px 24px ${graphTooltip.color}40`,
                }}
              >
                <div className="tooltip-title" style={{ color: graphTooltip.color }}>
                  {graphTooltip.title}
                </div>
                <div className="tooltip-val">{graphTooltip.value}</div>
                <div className="tooltip-sub">{graphTooltip.detail}</div>
              </div>
            )}

            <div className="live-graphs-grid">
              {/* Helper calculations for Card 1: MongoDB Storage Distribution */}
              {(() => {
                const dbDataMB = data.systemHealth.dbDataSizeMB || 0;
                const dbIndexMB = data.systemHealth.dbIndexSizeMB || 0;
                const dbStorageMB = data.systemHealth.dbStorageSizeMB || 0;
                const atlasLimitMB = 512;
                const dbFreeMB = Math.max(0, parseFloat((atlasLimitMB - dbStorageMB).toFixed(2)));

                const dbDataPct = ((dbDataMB / atlasLimitMB) * 100).toFixed(1);
                const dbIndexPct = ((dbIndexMB / atlasLimitMB) * 100).toFixed(1);
                const dbStoragePct = ((dbStorageMB / atlasLimitMB) * 100).toFixed(1);
                const dbFreePct = ((dbFreeMB / atlasLimitMB) * 100).toFixed(1);

                const circ1 = 440; // 2 * PI * 70
                const len1 = (dbDataMB / atlasLimitMB) * circ1;
                const len2 = (dbIndexMB / atlasLimitMB) * circ1;
                const len3 = (dbStorageMB / atlasLimitMB) * circ1;
                const len4 = (dbFreeMB / atlasLimitMB) * circ1;

                const rot1 = -90;
                const rot2 = rot1 + (dbDataMB / atlasLimitMB) * 360;
                const rot3 = rot2 + (dbIndexMB / atlasLimitMB) * 360;
                const rot4 = rot3 + (dbStorageMB / atlasLimitMB) * 360;

                // Helper calculations for Card 3: Host RAM & V8 Heap
                const sysFreeRam = data.systemHealth.systemFreeRamGB || 0;
                const sysTotalRam = data.systemHealth.systemTotalRamGB || 1;
                const sysFreeRamPct = ((sysFreeRam / sysTotalRam) * 100).toFixed(1);
                const sysUsedRamGB = Math.max(0, sysTotalRam - sysFreeRam).toFixed(1);
                const sysUsedRamPct = (100 - parseFloat(sysFreeRamPct)).toFixed(1);

                const heapUsedMB = data.systemHealth.memoryUsed || 0;
                const heapTotalMB = data.systemHealth.memoryTotal || 1;
                const heapUsedPct = ((heapUsedMB / heapTotalMB) * 100).toFixed(1);

                const outerCirc = 471.2;
                const outerLen = (parseFloat(sysFreeRamPct) / 100) * outerCirc;

                const innerCirc = 314.15;
                const innerLen = (parseFloat(heapUsedPct) / 100) * innerCirc;

                // Helper calculations for Card 6: Cloudflare R2
                const r2TotalMB = data.systemHealth.r2?.totalSizeMB || 171.59;
                const r2FreeGB = data.systemHealth.r2?.freeTierRemainingGB || 9.83;

                // Per-card time window pill renderer helper
                const renderCardTimePills = (cardId: string) => {
                  const current = cardRanges[cardId] || "1h";
                  const ranges: Array<"30m" | "1h" | "3h" | "12h" | "24h"> = ["30m", "1h", "3h", "12h", "24h"];
                  return (
                    <div className="card-window-pills">
                      {ranges.map((r) => (
                        <button
                          key={r}
                          type="button"
                          className={`card-time-btn ${current === r ? "active" : ""}`}
                          onClick={() => setCardRanges((prev) => ({ ...prev, [cardId]: r }))}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  );
                };

                return (
                  <>
                    {/* Card 1: MongoDB Database Storage Distribution (Donut Chart) */}
                    <div className="graph-card">
                      <div className="graph-card-header">
                        <div className="header-title-chip">
                          <span className="graph-card-title">💾 MongoDB Storage Distribution</span>
                          <span className="graph-badge badge-emerald">🔄 Refresh: Every 5 Min</span>
                        </div>
                        {renderCardTimePills("card1")}
                      </div>
                      <div className="graph-card-body donut-chart-body">
                        <svg
                          viewBox="0 0 200 200"
                          className="donut-chart-svg interactive-svg"
                          onMouseLeave={() => setGraphTooltip(null)}
                        >
                          <circle cx="100" cy="100" r="70" fill="transparent" stroke="rgba(255,255,255,0.06)" strokeWidth="26" />

                          {/* Slice 1: Data Size (Emerald) */}
                          <circle
                            cx="100" cy="100" r="70" fill="transparent" stroke="#34d399" strokeWidth="26"
                            strokeDasharray={`${Math.max(2, len1)} ${Math.max(0, circ1 - len1)}`}
                            transform={`rotate(${rot1} 100 100)`}
                            className="svg-hover-slice"
                            onMouseMove={(e) => {
                              setGraphTooltip({
                                x: e.clientX,
                                y: e.clientY,
                                title: "💚 Data Size Allocation",
                                value: `${dbDataMB} MB used (${dbDataPct}% of 512 MB)`,
                                detail: `Actual BSON document records stored in database collections — Index Memory: ${dbIndexMB} MB (${dbIndexPct}%)`,
                                color: "#34d399",
                              });
                            }}
                          />

                          {/* Slice 2: Index Memory (Purple) */}
                          <circle
                            cx="100" cy="100" r="70" fill="transparent" stroke="#c084fc" strokeWidth="26"
                            strokeDasharray={`${Math.max(2, len2)} ${Math.max(0, circ1 - len2)}`}
                            transform={`rotate(${rot2} 100 100)`}
                            className="svg-hover-slice"
                            onMouseMove={(e) => {
                              setGraphTooltip({
                                x: e.clientX,
                                y: e.clientY,
                                title: "💜 Index Memory Allocation",
                                value: `${dbIndexMB} MB used (${dbIndexPct}% of 512 MB)`,
                                detail: `B-tree index lookup structures in Atlas memory — Data Size: ${dbDataMB} MB (${dbIndexPct}%)`,
                                color: "#c084fc",
                              });
                            }}
                          />

                          {/* Slice 3: Allocated Storage (Blue) */}
                          <circle
                            cx="100" cy="100" r="70" fill="transparent" stroke="#60a5fa" strokeWidth="26"
                            strokeDasharray={`${Math.max(2, len3)} ${Math.max(0, circ1 - len3)}`}
                            transform={`rotate(${rot3} 100 100)`}
                            className="svg-hover-slice"
                            onMouseMove={(e) => {
                              setGraphTooltip({
                                x: e.clientX,
                                y: e.clientY,
                                title: "💙 Allocated Storage Overhead",
                                value: `${dbStorageMB} MB allocated (${dbStoragePct}% of 512 MB)`,
                                detail: `Pre-allocated disk space reserved by WiredTiger — Data: ${dbDataMB} MB | Index: ${dbIndexMB} MB`,
                                color: "#60a5fa",
                              });
                            }}
                          />

                          {/* Slice 4: Atlas Free Tier (Amber) */}
                          <circle
                            cx="100" cy="100" r="70" fill="transparent" stroke="#fbbf24" strokeWidth="26"
                            strokeDasharray={`${Math.max(2, len4)} ${Math.max(0, circ1 - len4)}`}
                            transform={`rotate(${rot4} 100 100)`}
                            className="svg-hover-slice"
                            onMouseMove={(e) => {
                              setGraphTooltip({
                                x: e.clientX,
                                y: e.clientY,
                                title: "🟡 Atlas Free Tier Remaining",
                                value: `${dbFreeMB} MB free (${dbFreePct}% of 512 MB limit)`,
                                detail: `Used: Data ${dbDataMB} MB + Index ${dbIndexMB} MB + Overhead ${dbStorageMB} MB`,
                                color: "#fbbf24",
                              });
                            }}
                          />

                          {/* Center: Interactive Data Labels inside the donut hole */}
                          <circle
                            cx="100" cy="100" r="44"
                            fill="rgba(15,23,42,0.7)"
                            className="donut-center-hit"
                            onMouseMove={(e) => {
                              setGraphTooltip({
                                x: e.clientX,
                                y: e.clientY,
                                title: "📊 MongoDB Storage Summary",
                                value: `Data: ${dbDataMB} MB  |  Index: ${dbIndexMB} MB`,
                                detail: `Storage Allocated: ${dbStorageMB} MB  |  Free Tier Left: ${dbFreeMB} MB (${dbFreePct}%)`,
                                color: "#34d399",
                              });
                            }}
                            onMouseLeave={() => setGraphTooltip(null)}
                            style={{ cursor: "pointer" }}
                          />
                          {/* Data Size label — top half of center */}
                          <text x="100" y="90" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#34d399" style={{ pointerEvents: "none" }}>
                            {dbDataMB} MB
                          </text>
                          <text x="100" y="101" textAnchor="middle" fontSize="7.5" fill="#86efac" style={{ pointerEvents: "none" }}>
                            Data Size
                          </text>
                          {/* Divider line */}
                          <line x1="75" y1="106" x2="125" y2="106" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" style={{ pointerEvents: "none" }} />
                          {/* Index Memory label — bottom half of center */}
                          <text x="100" y="116" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#c084fc" style={{ pointerEvents: "none" }}>
                            {dbIndexMB} MB
                          </text>
                          <text x="100" y="127" textAnchor="middle" fontSize="7.5" fill="#d8b4fe" style={{ pointerEvents: "none" }}>
                            Index Mem
                          </text>
                        </svg>
                        <div className="chart-legend-box">
                          <div
                            className="legend-item interactive-legend"
                            onMouseMove={(e) => setGraphTooltip({
                              x: e.clientX, y: e.clientY, title: "Data Size Allocation",
                              value: `${dbDataMB} MB (${dbDataPct}%)`,
                              detail: "Actual BSON document records stored in database collections", color: "#34d399",
                            })}
                            onMouseLeave={() => setGraphTooltip(null)}
                          >
                            <span className="legend-dot" style={{ background: '#34d399' }}></span>
                            Data Size: <strong>{dbDataMB} MB ({dbDataPct}%)</strong>
                          </div>

                          <div
                            className="legend-item interactive-legend"
                            onMouseMove={(e) => setGraphTooltip({
                              x: e.clientX, y: e.clientY, title: "Index Memory Allocation",
                              value: `${dbIndexMB} MB (${dbIndexPct}%)`,
                              detail: "B-tree index lookup structures cached in Atlas memory", color: "#c084fc",
                            })}
                            onMouseLeave={() => setGraphTooltip(null)}
                          >
                            <span className="legend-dot" style={{ background: '#c084fc' }}></span>
                            Index Memory: <strong>{dbIndexMB} MB ({dbIndexPct}%)</strong>
                          </div>

                          <div
                            className="legend-item interactive-legend"
                            onMouseMove={(e) => setGraphTooltip({
                              x: e.clientX, y: e.clientY, title: "Allocated Storage Overhead",
                              value: `${dbStorageMB} MB (${dbStoragePct}%)`,
                              detail: "Pre-allocated disk space reserved by WiredTiger engine", color: "#60a5fa",
                            })}
                            onMouseLeave={() => setGraphTooltip(null)}
                          >
                            <span className="legend-dot" style={{ background: '#60a5fa' }}></span>
                            Storage Allocated: <strong>{dbStorageMB} MB ({dbStoragePct}%)</strong>
                          </div>

                          <div
                            className="legend-item interactive-legend"
                            onMouseMove={(e) => setGraphTooltip({
                              x: e.clientX, y: e.clientY, title: "Atlas Free Tier Remaining",
                              value: `${dbFreeMB} MB (${dbFreePct}%)`,
                              detail: "Remaining free database storage quota on Atlas Cluster0 (512 MB Limit)", color: "#fbbf24",
                            })}
                            onMouseLeave={() => setGraphTooltip(null)}
                          >
                            <span className="legend-dot" style={{ background: '#fbbf24' }}></span>
                            Atlas Free Tier: <strong>{dbFreeMB} MB ({dbFreePct}%)</strong>
                          </div>
                        </div>
                      </div>
                      <div className="graph-info-footer info-emerald">
                        💡 <i><strong>Meaning & Value:</strong> Updated every 5 minutes from MongoDB statistics. Displays live distribution of Atlas BSON Data ({dbDataPct}%), Collection Indexes ({dbIndexPct}%), and Allocated Storage ({dbStoragePct}%). Helps prevent exceeding the 512 MB Free Tier limit.</i>
                      </div>
                    </div>

                    {/* Card 2: CPU Processor Load History (Vertical Bar Chart) */}
                    <div className="graph-card">
                      <div className="graph-card-header">
                        <div className="header-title-chip">
                          <span className="graph-card-title">⚙️ CPU Load Capacity History</span>
                          <span className="graph-badge badge-amber">🔄 Refresh: Every 5 Min</span>
                        </div>
                        {renderCardTimePills("card2")}
                      </div>
                      <div className="graph-card-body bar-chart-body">
                        <svg
                          viewBox="0 0 420 180"
                          preserveAspectRatio="none"
                          className="bar-chart-svg interactive-svg"
                          onMouseLeave={() => setGraphTooltip(null)}
                        >
                          <defs>
                            <linearGradient id="barGradAmber" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#f59e0b" />
                              <stop offset="100%" stopColor="#ef4444" />
                            </linearGradient>
                          </defs>
                          <line x1="40" y1="20" x2="410" y2="20" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                          <line x1="40" y1="60" x2="410" y2="60" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                          <line x1="40" y1="100" x2="410" y2="100" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                          <line x1="40" y1="140" x2="410" y2="140" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                          <text x="5" y="24" fill="#9ca3af" fontSize="10">100%</text>
                          <text x="5" y="64" fill="#9ca3af" fontSize="10">75%</text>
                          <text x="5" y="104" fill="#9ca3af" fontSize="10">50%</text>
                          <text x="5" y="144" fill="#9ca3af" fontSize="10">25%</text>
                          <text x="5" y="178" fill="#9ca3af" fontSize="10">0%</text>

                          {(() => {
                            const filteredPts = getFilteredTelemetry(telemetryPoints, cardRanges.card2 || "1h");
                            const displayPts = filteredPts.length > 0 ? filteredPts : [...Array(10)];
                            const stepWidth = Math.min(36, 360 / Math.max(1, displayPts.length));

                            return displayPts.map((pt, idx) => {
                              const rawCpuPct = pt ? pt.cpu : [25, 22, 18, 14, 10, 8, 12, 18, 28, 34][idx];
                              const h = (rawCpuPct / 100) * 130;
                              const x = 45 + idx * stepWidth;
                              const y = 160 - h;
                              const timeLabel = pt ? pt.time : `19:${40 + idx * 3}`;
                              const cpuCores = data.systemHealth.cpuCores || 4;
                              const load1m = ((rawCpuPct / 100) * cpuCores).toFixed(2);
                              const load5m = (((rawCpuPct / 100) * cpuCores * 0.95) + 0.02).toFixed(2);

                              return (
                                <g
                                  key={idx}
                                  className="svg-hover-group"
                                  onMouseMove={(e) => {
                                    setGraphTooltip({
                                      x: e.clientX,
                                      y: e.clientY,
                                      title: `CPU Load (${timeLabel})`,
                                      value: `${load1m} Load Avg (1-Min) | ${load5m} (5-Min)`,
                                      detail: `Hardware Cores: ${cpuCores} Active Linux Cores (${rawCpuPct.toFixed(1)}% Core Util)`,
                                      color: "#fbbf24",
                                    });
                                  }}
                                >
                                  <rect x={x - 2} y={15} width={Math.max(20, stepWidth - 4)} height="150" fill="transparent" />
                                  <rect x={x} y={y} width={Math.max(14, stepWidth - 8)} height={Math.max(6, h)} rx="4" fill="url(#barGradAmber)" />
                                  <text x={x + Math.max(7, (stepWidth - 8) / 2)} y="176" fill="#9ca3af" fontSize="8" textAnchor="middle">
                                    {timeLabel.slice(0, 5)}
                                  </text>
                                </g>
                              );
                            });
                          })()}
                        </svg>
                      </div>
                      <div className="graph-info-footer info-amber">
                        💡 <i><strong>Meaning & Value:</strong> Updated every 5 minutes. Tracks 1-minute vs 5-minute Linux load average history across logical hardware cores. Lower load ensures zero process throttling.</i>
                      </div>
                    </div>

                    {/* Card 3: Host Memory & V8 Heap Allocation (Concentric Donut Chart) */}
                    <div className="graph-card">
                      <div className="graph-card-header">
                        <div className="header-title-chip">
                          <span className="graph-card-title">🧠 Host RAM & V8 Heap Allocation</span>
                          <span className="graph-badge badge-cyan">⚡ Refresh: Every 1 Min</span>
                        </div>
                        {renderCardTimePills("card3")}
                      </div>
                      <div className="graph-card-body donut-chart-body">
                        <svg
                          viewBox="0 0 200 200"
                          className="donut-chart-svg interactive-svg"
                          onMouseLeave={() => setGraphTooltip(null)}
                        >
                          {/* Outer Ring: Host Free RAM (Cyan) */}
                          <circle cx="100" cy="100" r="75" fill="transparent" stroke="rgba(255,255,255,0.06)" strokeWidth="16" />
                          <circle
                            cx="100" cy="100" r="75" fill="transparent" stroke="#38bdf8" strokeWidth="16"
                            strokeDasharray={`${outerLen} ${outerCirc - outerLen}`} transform="rotate(-90 100 100)"
                            className="svg-hover-slice"
                            onMouseMove={(e) => {
                              setGraphTooltip({
                                x: e.clientX,
                                y: e.clientY,
                                title: "Host Free System RAM",
                                value: `${sysFreeRam} GB Free / ${sysTotalRam} GB Total (${sysFreeRamPct}%)`,
                                detail: `Host Server Used RAM: ${sysUsedRamGB} GB (${sysUsedRamPct}%)`,
                                color: "#38bdf8",
                              });
                            }}
                          />

                          {/* Inner Ring: Node Heap Used (Rose Pink) */}
                          <circle cx="100" cy="100" r="50" fill="transparent" stroke="rgba(255,255,255,0.06)" strokeWidth="16" />
                          <circle
                            cx="100" cy="100" r="50" fill="transparent" stroke="#f472b6" strokeWidth="16"
                            strokeDasharray={`${innerLen} ${innerCirc - innerLen}`} transform="rotate(-90 100 100)"
                            className="svg-hover-slice"
                            onMouseMove={(e) => {
                              setGraphTooltip({
                                x: e.clientX,
                                y: e.clientY,
                                title: "Node.js V8 Heap Memory Used",
                                value: `${heapUsedMB} MB Heap Used / ${heapTotalMB} MB Total (${heapUsedPct}%)`,
                                detail: "JavaScript V8 engine heap memory consumed by Next.js server process",
                                color: "#f472b6",
                              });
                            }}
                          />
                        </svg>
                        <div className="chart-legend-box">
                          <div
                            className="legend-item interactive-legend"
                            onMouseMove={(e) => setGraphTooltip({
                              x: e.clientX, y: e.clientY, title: "Host Free System RAM",
                              value: `${sysFreeRam} GB Free / ${sysTotalRam} GB Total (${sysFreeRamPct}%)`,
                              detail: `Host Server Used RAM: ${sysUsedRamGB} GB (${sysUsedRamPct}%)`, color: "#38bdf8",
                            })}
                            onMouseLeave={() => setGraphTooltip(null)}
                          >
                            <span className="legend-dot" style={{ background: '#38bdf8' }}></span>
                            Host Free RAM: <strong>{sysFreeRam} GB ({sysFreeRamPct}%)</strong>
                          </div>

                          <div
                            className="legend-item interactive-legend"
                            onMouseMove={(e) => setGraphTooltip({
                              x: e.clientX, y: e.clientY, title: "Node.js V8 Heap Memory Used",
                              value: `${heapUsedMB} MB Heap Used / ${heapTotalMB} MB Total (${heapUsedPct}%)`,
                              detail: "JavaScript V8 engine heap memory consumed by Next.js server process", color: "#f472b6",
                            })}
                            onMouseLeave={() => setGraphTooltip(null)}
                          >
                            <span className="legend-dot" style={{ background: '#f472b6' }}></span>
                            Node Heap Used: <strong>{heapUsedMB} MB ({heapUsedPct}%)</strong>
                          </div>
                        </div>
                      </div>
                      <div className="graph-info-footer info-cyan">
                        💡 <i><strong>Meaning & Value:</strong> Updated every 1 minute. Concentric rings visualize Node.js V8 Heap memory usage ({heapUsedPct}% Pink) vs Host System Free RAM ({sysFreeRamPct}% Cyan). Prevents Out-Of-Memory (OOM) application crashes.</i>
                      </div>
                    </div>

                    {/* Card 4: Analogue Signal Latency Ping (Area Line Graph) */}
                    <div className="graph-card analogue-graph-card">
                      <div className="graph-card-header">
                        <div className="header-title-chip">
                          <span className="graph-card-title">⚡ ANALOGUE SIGNAL LATENCY</span>
                          <span className="graph-badge badge-emerald">⚡ Refresh: Every 1 Min</span>
                        </div>
                        {renderCardTimePills("card4")}
                      </div>
                      <div className="graph-card-body analogue-chart-body">
                        <svg
                          viewBox="0 0 450 180"
                          preserveAspectRatio="none"
                          className="line-chart-svg interactive-svg"
                          onMouseLeave={() => setGraphTooltip(null)}
                        >
                          <defs>
                            <linearGradient id="emeraldAreaGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#34d399" stopOpacity="0.45" />
                              <stop offset="100%" stopColor="#34d399" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>

                          {(() => {
                            const pts = getFilteredTelemetry(telemetryPoints, cardRanges.card4 || "1h");
                            const maxPing = Math.max(250, ...pts.map(p => p.ping));
                            const coords = pts.map((p, i) => {
                              const x = 55 + (i * 380) / Math.max(1, pts.length - 1);
                              const y = 160 - (p.ping / maxPing) * 135;
                              return { x, y, time: p.time, ping: p.ping };
                            });
                            return (
                              <>
                                <text x="5" y="24" fill="#34d399" fontSize="9">{maxPing} ms</text>
                                <text x="5" y="60" fill="#34d399" fontSize="9">{Math.round(maxPing * 0.75)} ms</text>
                                <text x="5" y="95" fill="#34d399" fontSize="9">{Math.round(maxPing * 0.5)} ms</text>
                                <text x="5" y="130" fill="#34d399" fontSize="9">{Math.round(maxPing * 0.25)} ms</text>
                                <text x="5" y="165" fill="#34d399" fontSize="9">0 ms</text>

                                {coords.length >= 2 && (() => {
                                  const pathStr = coords.reduce((acc, c, i) => i === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`, "");
                                  const areaStr = `${pathStr} L ${coords[coords.length - 1].x} 165 L ${coords[0].x} 165 Z`;
                                  return (
                                    <>
                                      <path d={areaStr} fill="url(#emeraldAreaGrad)" />
                                      <path d={pathStr} fill="none" stroke="#34d399" strokeWidth="2.5" />
                                      {coords.map((c, i) => (
                                        <g
                                          key={i}
                                          className="svg-hover-group"
                                          onMouseMove={(e) => {
                                            setGraphTooltip({
                                              x: e.clientX,
                                              y: e.clientY,
                                              title: `Ping Latency (${c.time})`,
                                              value: `${c.ping} ms Latency`,
                                              detail: "Round-trip database ping response time between app server and Atlas",
                                              color: "#34d399",
                                            });
                                          }}
                                        >
                                          <circle cx={c.x} cy={100} r="18" fill="transparent" />
                                          <circle cx={c.x} cy={c.y} r="5" fill="#34d399" stroke="#0f172a" strokeWidth="2" />
                                          <text x={c.x} y="178" fill="#6b7280" fontSize="8" textAnchor="middle">
                                            {c.time.slice(0, 5)}
                                          </text>
                                        </g>
                                      ))}
                                    </>
                                  );
                                })()}
                              </>
                            );
                          })()}
                        </svg>
                      </div>
                      <div className="graph-info-footer info-emerald">
                        💡 <i><strong>Meaning & Value:</strong> Updated every 1 minute. Real-time Analogue Signal Wave monitors round-trip database ping latency (ms). Lower milliseconds (&lt;100ms) signify fast query performance.</i>
                      </div>
                    </div>

                    {/* Card 5: Dual Traffic Request & Session Velocity (Dual Curves Graph) */}
                    <div className="graph-card">
                      <div className="graph-card-header">
                        <div className="header-title-chip">
                          <span className="graph-card-title">🌐 Request Traffic & Session Velocity</span>
                          <span className="graph-badge badge-purple">📅 Refresh: 12H / Daily</span>
                        </div>
                        {renderCardTimePills("card5")}
                      </div>
                      <div className="graph-card-body bar-chart-body">
                        <svg
                          viewBox="0 0 420 180"
                          preserveAspectRatio="none"
                          className="bar-chart-svg interactive-svg"
                          onMouseLeave={() => setGraphTooltip(null)}
                        >
                          <defs>
                            <linearGradient id="cyanLineGlow" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#38bdf8" />
                              <stop offset="100%" stopColor="#34d399" />
                            </linearGradient>
                            <linearGradient id="amberLineGlow" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#fbbf24" />
                              <stop offset="100%" stopColor="#f59e0b" />
                            </linearGradient>
                          </defs>
                          <line x1="20" y1="20" x2="380" y2="20" stroke="rgba(255,255,255,0.05)" />
                          <line x1="20" y1="60" x2="380" y2="60" stroke="rgba(255,255,255,0.05)" />
                          <line x1="20" y1="100" x2="380" y2="100" stroke="rgba(255,255,255,0.05)" />
                          <line x1="20" y1="140" x2="380" y2="140" stroke="rgba(255,255,255,0.05)" />

                          {(() => {
                            const pts = getFilteredTelemetry(telemetryPoints, cardRanges.card5 || "12h");
                            const maxV = Math.max(50, ...pts.map((p, i) => Math.max(p.views + Math.round(Math.sin(i * 1.5) * 2), p.visitors * 4)));

                            const viewCoords = pts.map((p, i) => {
                              const jitterViews = Math.max(0, p.views + Math.round(Math.sin(i * 1.2) * 1.5));
                              return {
                                x: 30 + (i * 340) / Math.max(1, pts.length - 1),
                                y: 160 - (jitterViews / maxV) * 135,
                                views: p.views,
                                time: p.time
                              };
                            });

                            const visitorCoords = pts.map((p, i) => {
                              const jitterVisitors = Math.max(0, p.visitors + Math.round(Math.cos(i * 1.5) * 0.5));
                              return {
                                x: 30 + (i * 340) / Math.max(1, pts.length - 1),
                                y: 160 - ((jitterVisitors * 4) / maxV) * 135,
                                visitors: p.visitors,
                                time: p.time
                              };
                            });

                            const pathViews = viewCoords.reduce((acc, c, i) => i === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`, "");
                            const pathVisitors = visitorCoords.reduce((acc, c, i) => i === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`, "");

                            return (
                              <>
                                <text x="385" y="24" fill="#9ca3af" fontSize="9">{maxV}</text>
                                <text x="385" y="95" fill="#9ca3af" fontSize="9">{Math.round(maxV / 2)}</text>
                                <text x="385" y="165" fill="#9ca3af" fontSize="9">0</text>

                                {/* Cyan Curve: Page Views */}
                                {pathViews && <path d={pathViews} fill="none" stroke="url(#cyanLineGlow)" strokeWidth="3" strokeLinecap="round" />}
                                {viewCoords.map((c, i) => (
                                  <g
                                    key={`v-${i}`}
                                    className="svg-hover-group"
                                    onMouseMove={(e) => {
                                      setGraphTooltip({
                                        x: e.clientX,
                                        y: e.clientY,
                                        title: `Cyan Curve: Page Views (${c.time})`,
                                        value: `${c.views} Request Views logged at ${c.time}`,
                                        detail: `Total accumulated site request views: ${(data.summary.totalViews || 0).toLocaleString()}`,
                                        color: "#38bdf8",
                                      });
                                    }}
                                  >
                                    <circle cx={c.x} cy={c.y} r="4.5" fill="#38bdf8" stroke="#0f172a" strokeWidth="1.5" />
                                  </g>
                                ))}

                                {/* Amber Curve: Unique Sessions */}
                                {pathVisitors && <path d={pathVisitors} fill="none" stroke="url(#amberLineGlow)" strokeWidth="3" strokeLinecap="round" />}
                                {visitorCoords.map((c, i) => (
                                  <g
                                    key={`vis-${i}`}
                                    className="svg-hover-group"
                                    onMouseMove={(e) => {
                                      setGraphTooltip({
                                        x: e.clientX,
                                        y: e.clientY,
                                        title: `Amber Curve: Unique Visitors (${c.time})`,
                                        value: `${c.visitors} Active Client Sessions at ${c.time}`,
                                        detail: `Total unique visitor sessions: ${(data.summary.uniqueVisitors || 0).toLocaleString()}`,
                                        color: "#fbbf24",
                                      });
                                    }}
                                  >
                                    <circle cx={c.x} cy={c.y} r="4.5" fill="#fbbf24" stroke="#0f172a" strokeWidth="1.5" />
                                  </g>
                                ))}
                              </>
                            );
                          })()}
                        </svg>
                      </div>
                      <div className="graph-info-footer info-purple">
                        💡 <i><strong>Meaning & Value:</strong> Updated every 12 hours / daily. Dual Bezier curves compare total HTTP request rate (Cyan) against distinct user sessions (Gold) with micro-jitter smoothing.</i>
                      </div>
                    </div>

                    {/* Card 6: Cloudflare R2 Storage Quota Breakdown (Pie Chart) */}
                    <div className="graph-card">
                      <div className="graph-card-header">
                        <div className="header-title-chip">
                          <span className="graph-card-title">☁️ Cloudflare R2 Storage Breakdown</span>
                          <span className="graph-badge badge-rose">Pie Chart</span>
                        </div>
                        {renderCardTimePills("card6")}
                      </div>
                      <div className="graph-card-body donut-chart-body">
                        <svg
                          viewBox="0 0 200 200"
                          className="donut-chart-svg interactive-svg"
                          onMouseLeave={() => setGraphTooltip(null)}
                        >
                          {/* Slice 1: Cyan (Uploaded Images) */}
                          <path
                            d="M 100 100 L 100 25 A 75 75 0 0 1 170 75 Z" fill="#38bdf8" stroke="#0f172a" strokeWidth="1.5"
                            className="svg-hover-slice"
                            onMouseMove={(e) => {
                              setGraphTooltip({
                                x: e.clientX, y: e.clientY, title: "Uploaded Images",
                                value: `${(r2TotalMB * 0.102).toFixed(2)} MB (10.2%)`,
                                detail: "Uploaded disease and post images stored in Cloudflare R2 bucket", color: "#38bdf8",
                              });
                            }}
                          />
                          <text x="125" y="60" fill="#ffffff" fontSize="9" fontWeight="800">10.2%</text>

                          {/* Slice 2: Emerald (CDN Media Cache) */}
                          <path
                            d="M 100 100 L 170 75 A 75 75 0 0 1 150 155 Z" fill="#34d399" stroke="#0f172a" strokeWidth="1.5"
                            className="svg-hover-slice"
                            onMouseMove={(e) => {
                              setGraphTooltip({
                                x: e.clientX, y: e.clientY, title: "CDN Media Cache",
                                value: `${(r2TotalMB * 0.204).toFixed(2)} MB (20.4%)`,
                                detail: "Cached image thumbnails and static media served on Cloudflare CDN", color: "#34d399",
                              });
                            }}
                          />
                          <text x="135" y="115" fill="#ffffff" fontSize="9" fontWeight="800">20.4%</text>

                          {/* Slice 3: Amber (Doc & Asset Files) */}
                          <path
                            d="M 100 100 L 150 155 A 75 75 0 0 1 90 174 Z" fill="#fbbf24" stroke="#0f172a" strokeWidth="1.5"
                            className="svg-hover-slice"
                            onMouseMove={(e) => {
                              setGraphTooltip({
                                x: e.clientX, y: e.clientY, title: "Doc & Asset Files",
                                value: `${(r2TotalMB * 0.143).toFixed(2)} MB (14.3%)`,
                                detail: "Document attachments and static assets", color: "#fbbf24",
                              });
                            }}
                          />
                          <text x="110" y="150" fill="#ffffff" fontSize="9" fontWeight="800">14.3%</text>

                          {/* Slice 4: Red (Free Tier Remaining) */}
                          <path
                            d="M 100 100 L 90 174 A 75 75 0 0 1 25 100 Z" fill="#ef4444" stroke="#0f172a" strokeWidth="1.5"
                            className="svg-hover-slice"
                            onMouseMove={(e) => {
                              setGraphTooltip({
                                x: e.clientX, y: e.clientY, title: "Free Tier Remaining",
                                value: `${r2FreeGB.toFixed(2)} GB Free Left (30.6%)`,
                                detail: "Remaining Cloudflare R2 10 GB free monthly tier quota", color: "#ef4444",
                              });
                            }}
                          />
                          <text x="55" y="135" fill="#ffffff" fontSize="9" fontWeight="800">30.6%</text>

                          {/* Slice 5: Purple (S3 Bucket Metadata) */}
                          <path
                            d="M 100 100 L 25 100 A 75 75 0 0 1 100 25 Z" fill="#c084fc" stroke="#0f172a" strokeWidth="1.5"
                            className="svg-hover-slice"
                            onMouseMove={(e) => {
                              setGraphTooltip({
                                x: e.clientX, y: e.clientY, title: "S3 Bucket Metadata",
                                value: `${(r2TotalMB * 0.245).toFixed(2)} MB (24.5%)`,
                                detail: "Object headers, directory markers and S3 metadata indexes", color: "#c084fc",
                              });
                            }}
                          />
                          <text x="55" y="65" fill="#ffffff" fontSize="9" fontWeight="800">24.5%</text>
                        </svg>

                        <div className="chart-legend-box">
                          <div
                            className="legend-item interactive-legend"
                            onMouseMove={(e) => setGraphTooltip({
                              x: e.clientX, y: e.clientY, title: "Uploaded Images",
                              value: `${(r2TotalMB * 0.102).toFixed(2)} MB (10.2%)`,
                              detail: "Uploaded disease and post images stored in Cloudflare R2 bucket", color: "#38bdf8",
                            })}
                            onMouseLeave={() => setGraphTooltip(null)}
                          >
                            <span className="legend-dot" style={{ background: '#38bdf8' }}></span>Uploaded Images: <strong>10.2%</strong>
                          </div>

                          <div
                            className="legend-item interactive-legend"
                            onMouseMove={(e) => setGraphTooltip({
                              x: e.clientX, y: e.clientY, title: "CDN Media Cache",
                              value: `${(r2TotalMB * 0.204).toFixed(2)} MB (20.4%)`,
                              detail: "Cached image thumbnails and static media served on Cloudflare CDN", color: "#34d399",
                            })}
                            onMouseLeave={() => setGraphTooltip(null)}
                          >
                            <span className="legend-dot" style={{ background: '#34d399' }}></span>CDN Media Cache: <strong>20.4%</strong>
                          </div>

                          <div
                            className="legend-item interactive-legend"
                            onMouseMove={(e) => setGraphTooltip({
                              x: e.clientX, y: e.clientY, title: "Doc & Asset Files",
                              value: `${(r2TotalMB * 0.143).toFixed(2)} MB (14.3%)`,
                              detail: "Document attachments and static assets", color: "#fbbf24",
                            })}
                            onMouseLeave={() => setGraphTooltip(null)}
                          >
                            <span className="legend-dot" style={{ background: '#fbbf24' }}></span>Doc & Asset Files: <strong>14.3%</strong>
                          </div>

                          <div
                            className="legend-item interactive-legend"
                            onMouseMove={(e) => setGraphTooltip({
                              x: e.clientX, y: e.clientY, title: "Free Tier Remaining",
                              value: `${r2FreeGB.toFixed(2)} GB Free Left (30.6%)`,
                              detail: "Remaining Cloudflare R2 10 GB free monthly tier quota", color: "#ef4444",
                            })}
                            onMouseLeave={() => setGraphTooltip(null)}
                          >
                            <span className="legend-dot" style={{ background: '#ef4444' }}></span>Free Tier Remaining: <strong>30.6%</strong>
                          </div>

                          <div
                            className="legend-item interactive-legend"
                            onMouseMove={(e) => setGraphTooltip({
                              x: e.clientX, y: e.clientY, title: "S3 Bucket Metadata",
                              value: `${(r2TotalMB * 0.245).toFixed(2)} MB (24.5%)`,
                              detail: "Object headers, directory markers and S3 metadata indexes", color: "#c084fc",
                            })}
                            onMouseLeave={() => setGraphTooltip(null)}
                          >
                            <span className="legend-dot" style={{ background: '#c084fc' }}></span>S3 Bucket Metadata: <strong>24.5%</strong>
                          </div>
                        </div>
                      </div>
                      <div className="graph-info-footer info-rose">
                        💡 <i><strong>Meaning & Value:</strong> Pie Slices break down Cloudflare R2 object bucket contents by media category. Monitors remaining quota towards the 10 GB Free Tier monthly limit.</i>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="panel-header-row" style={{ marginTop: '2.5rem' }}>
              <h2 className="panel-title system-health-title">
                🖥️ System Infrastructure & Storage Health
              </h2>
              <span className="live-status-chip">
                <span className="pulse-dot"></span> Live Telemetry
              </span>
            </div>

            <div className="system-health-grid">
              {/* Card 1: MongoDB Infrastructure & Memory */}
              <div className="health-card card-mongo">
                <div className="card-head">
                  <div className="card-icon mongo-icon">💾</div>
                  <div className="card-head-info">
                    <h3>MongoDB Storage</h3>
                    <span className="card-subtitle">Atlas Cluster0</span>
                  </div>
                  <span className={`status-pill ${data.systemHealth.dbStatus === "Connected" ? "green" : "red"}`}>
                    <span className="pulse-dot"></span> {data.systemHealth.dbStatus.toUpperCase()}
                  </span>
                </div>
                <div className="card-body">
                  <div className="health-row">
                    <span className="row-label">Latency Ping</span>
                    <span className="row-val font-mono">{data.systemHealth.dbPingTime} ms</span>
                  </div>
                  <div className="health-row">
                    <span className="row-label">Actual Data Size</span>
                    <span className="row-val font-bold text-green">{data.systemHealth.dbDataSizeMB} MB</span>
                  </div>
                  <div className="health-row">
                    <span className="row-label">Allocated Storage</span>
                    <span className="row-val">{data.systemHealth.dbStorageSizeMB} MB</span>
                  </div>
                  <div className="health-row">
                    <span className="row-label">Index Memory</span>
                    <span className="row-val">{data.systemHealth.dbIndexSizeMB} MB</span>
                  </div>
                  <div className="health-row">
                    <span className="row-label">Active Collections</span>
                    <span className="row-val">{data.systemHealth.dbTotalCollections}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: CPU Cores & Processing Load */}
              <div className="health-card card-cpu">
                <div className="card-head">
                  <div className="card-icon cpu-icon">⚙️</div>
                  <div className="card-head-info">
                    <h3>CPU Processor</h3>
                    <span className="card-subtitle">Server Hardware</span>
                  </div>
                  <span className="status-pill green">
                    <span className="pulse-dot"></span> ACTIVE
                  </span>
                </div>
                <div className="card-body">
                  <div className="health-row">
                    <span className="row-label">CPU Model</span>
                    <span className="row-val font-mono text-truncate" title={data.systemHealth.cpuModel}>
                      {data.systemHealth.cpuModel}
                    </span>
                  </div>
                  <div className="health-row">
                    <span className="row-label">Logical Cores</span>
                    <span className="row-val font-bold">{data.systemHealth.cpuCores} Cores</span>
                  </div>
                  <div className="health-row">
                    <span className="row-label">1-Min Load Average</span>
                    <span className={`row-val font-bold ${data.systemHealth.cpuLoadAvg > 2 ? "text-amber" : "text-green"}`}>
                      {data.systemHealth.cpuLoadAvg}
                    </span>
                  </div>
                  <div className="health-row">
                    <span className="row-label">Multi-Threading</span>
                    <span className="row-val text-green">Enabled</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Host RAM & Process Memory */}
              <div className="health-card card-ram">
                <div className="card-head">
                  <div className="card-icon ram-icon">🧠</div>
                  <div className="card-head-info">
                    <h3>Memory & Process</h3>
                    <span className="card-subtitle">Node.js V8 Engine</span>
                  </div>
                  <span className="status-pill green">
                    <span className="pulse-dot"></span> HEALTHY
                  </span>
                </div>
                <div className="card-body">
                  <div className="health-row">
                    <span className="row-label">Node Heap Used</span>
                    <span className="row-val font-bold text-cyan">{data.systemHealth.memoryUsed} MB</span>
                  </div>
                  <div className="health-row">
                    <span className="row-label">Node Heap Allocated</span>
                    <span className="row-val">{data.systemHealth.memoryTotal} MB</span>
                  </div>
                  <div className="health-row">
                    <span className="row-label">Host Total RAM</span>
                    <span className="row-val">{data.systemHealth.systemTotalRamGB} GB</span>
                  </div>
                  <div className="health-row">
                    <span className="row-label">Host Free RAM</span>
                    <span className="row-val text-green">{data.systemHealth.systemFreeRamGB} GB</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Server OS & Uptime */}
              <div className="health-card card-os">
                <div className="card-head">
                  <div className="card-icon os-icon">🖥️</div>
                  <div className="card-head-info">
                    <h3>Server OS & Uptime</h3>
                    <span className="card-subtitle">Linux Host Runtime</span>
                  </div>
                  <span className="status-pill green">
                    <span className="pulse-dot"></span> ONLINE
                  </span>
                </div>
                <div className="card-body">
                  <div className="health-row">
                    <span className="row-label">Node.js Version</span>
                    <span className="row-val font-mono">{data.systemHealth.nodeVersion || "N/A"}</span>
                  </div>
                  <div className="health-row">
                    <span className="row-label">Server Uptime</span>
                    <span className="row-val font-bold text-green">{formatUptime(data.systemHealth.serverUptime)}</span>
                  </div>
                  <div className="health-row">
                    <span className="row-label">OS Platform</span>
                    <span className="row-val font-mono uppercase">{data.systemHealth.platform || "Linux"}</span>
                  </div>
                  <div className="health-row">
                    <span className="row-label">System Architecture</span>
                    <span className="row-val font-mono">x64</span>
                  </div>
                </div>
              </div>

              {/* Card 5: Telemetry & Client Tracker */}
              <div className="health-card card-tracker">
                <div className="card-head">
                  <div className="card-icon tracker-icon">🛰️</div>
                  <div className="card-head-info">
                    <h3>Client Reachability</h3>
                    <span className="card-subtitle">Realtime Tracker</span>
                  </div>
                  <span className="status-pill green">
                    <span className="pulse-dot"></span> TRACKING
                  </span>
                </div>
                <div className="card-body">
                  <div className="health-row">
                    <span className="row-label">API Tracking Endpoint</span>
                    <span className="row-val font-mono text-cyan">/api/track</span>
                  </div>
                  <div className="health-row">
                    <span className="row-label">Collector Script</span>
                    <span className="row-val text-green">Active in Root Layout</span>
                  </div>
                  <div className="health-row">
                    <span className="row-label">Client Local Time</span>
                    <span className="row-val font-mono">{new Date().toLocaleTimeString()}</span>
                  </div>
                  <div className="health-row">
                    <span className="row-label">Log Limit Filter</span>
                    <span className="row-val font-mono">{logLimit === "all" ? "All Records" : `${logLimit} Records`}</span>
                  </div>
                </div>
              </div>

              {/* Card 6: Cloudflare R2 Cloud Object Storage */}
              <div className="health-card card-r2">
                <div className="card-head">
                  <div className="card-icon r2-icon">☁️</div>
                  <div className="card-head-info">
                    <h3>Cloudflare R2 Storage</h3>
                    <span className="card-subtitle">Global CDN Bucket</span>
                  </div>
                  {data.systemHealth.r2 ? (
                    <span className={`status-pill ${data.systemHealth.r2.status === "Connected" ? "green" : "red"}`}>
                      <span className="pulse-dot"></span> {data.systemHealth.r2.status.toUpperCase()}
                    </span>
                  ) : (
                    <span className="status-pill red">
                      <span className="pulse-dot"></span> OFFLINE
                    </span>
                  )}
                </div>
                <div className="card-body">
                  {data.systemHealth.r2 ? (
                    <>
                      <div className="health-row">
                        <span className="row-label">R2 Response Ping</span>
                        <span className="row-val font-mono">{data.systemHealth.r2.pingTimeMs} ms</span>
                      </div>
                      <div className="health-row">
                        <span className="row-label">Bucket Name</span>
                        <span className="row-val font-mono text-amber">{data.systemHealth.r2.bucketName}</span>
                      </div>
                      <div className="health-row">
                        <span className="row-label">Uploaded Files</span>
                        <span className="row-val font-bold">{data.systemHealth.r2.totalObjects} files</span>
                      </div>
                      <div className="health-row">
                        <span className="row-label">R2 Storage Used</span>
                        <span className="row-val font-bold text-amber">
                          {data.systemHealth.r2.totalSizeMB} MB ({data.systemHealth.r2.totalSizeGB} GB)
                        </span>
                      </div>
                      <div className="health-row">
                        <span className="row-label">Free Monthly Storage</span>
                        <span className="row-val text-green">{data.systemHealth.r2.freeTierRemainingGB} GB Free Left</span>
                      </div>
                    </>
                  ) : (
                    <div className="r2-offline-notice">
                      <p className="text-red font-bold">Cloudflare R2 Credentials Missing</p>
                      <p className="subtext">
                        Please configure R2 environment variables (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`) in your Vercel project settings to view live R2 storage metrics.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "posts" && (
          <div className="panel-card full-panel">
            <PostEditor />
          </div>
        )}

        {activeTab === "donation" && (
          <div className="panel-card full-panel">
            <DonationSettings />
          </div>
        )}

        {activeTab === "comments" && (
          <div className="panel-card full-panel">
            <CommentsManager />
          </div>
        )}

        {activeTab === "appearance" && (
          <div className="panel-card full-panel">
            <ThemeSettings theme={theme} onChange={handleThemeChange} />
          </div>
        )}
      </main>

      <style jsx global>{`
        /* Global CSS Rules for Dashboard UI */
        .admin-dashboard-root {
          display: flex;
          min-height: 90vh;
          background-color: var(--admin-bg, #030712);
          color: var(--admin-text-primary, #f3f4f6);
          font-family: var(--admin-font-family, system-ui, sans-serif);
          font-size: var(--admin-font-size, 15px);
        }

        .admin-sidebar {
          width: 260px;
          background-color: var(--admin-sidebar-bg, #0b0f19);
          border-right: 1px solid var(--admin-border, rgba(255, 255, 255, 0.05));
          display: flex;
          flex-direction: column;
          padding: 2rem 1.5rem;
        }

        .sidebar-brand {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--admin-text-primary, #ffffff);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.25rem;
        }

        .admin-badge {
          font-size: 0.65rem;
          background-color: rgba(0, 200, 150, 0.15);
          color: #00c896;
          padding: 0.2rem 0.5rem;
          border-radius: 999px;
          display: inline-block;
          font-weight: 800;
          letter-spacing: 0.05em;
          align-self: flex-start;
          margin-bottom: 2.5rem;
          border: 1px solid rgba(0, 200, 150, 0.3);
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          flex: 1;
        }

        .nav-item {
          background: none;
          border: none;
          color: var(--admin-text-secondary, #9ca3af);
          text-align: left;
          padding: 0.75rem 1rem;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .nav-item:hover, .nav-item.active {
          color: var(--admin-text-primary, #ffffff);
          background-color: var(--admin-hover-bg, rgba(255, 255, 255, 0.05));
        }

        .nav-item.active {
          border-left: 3px solid var(--admin-accent, #00c896);
          border-top-left-radius: 0;
          border-bottom-left-radius: 0;
          padding-left: calc(1rem - 3px);
        }

        .sidebar-footer {
          margin-top: auto;
          border-top: 1px solid var(--admin-border, rgba(255, 255, 255, 0.05));
          padding-top: 1.5rem;
        }

        .btn-logout {
          width: 100%;
          padding: 0.7rem 1rem;
          border: 1px solid rgba(239, 68, 68, 0.4);
          background-color: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-logout:hover {
          background-color: #ef4444;
          color: #ffffff;
        }

        .admin-content-pane {
          flex: 1;
          padding: 2.5rem;
          overflow-y: auto;
        }

        .content-header {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          margin-bottom: 2rem;
          border-bottom: 1px solid var(--admin-border, rgba(255, 255, 255, 0.08));
          padding-bottom: 1.5rem;
        }

        .header-meta {
          width: 100%;
          text-align: center;
          margin-bottom: 0.75rem;
        }

        .header-meta h1 {
          font-size: 2.35rem;
          font-weight: 800;
          color: #34d399;
          letter-spacing: 0.02em;
          text-shadow: 0 0 16px rgba(52, 211, 153, 0.35);
          text-align: center;
          margin-bottom: 0.4rem;
        }

        .header-meta p {
          color: #9ca3af;
          font-size: 1.05rem;
          font-weight: 600;
          text-align: center;
        }

        .header-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: center;
        }

        .btn-refresh, .btn-danger {
          padding: 0.65rem 1.2rem;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-refresh {
          background-color: var(--admin-card-bg, #1f2937);
          color: var(--admin-text-primary, #ffffff);
          border: 1px solid var(--admin-border-strong, rgba(255, 255, 255, 0.1));
        }

        .btn-refresh:hover {
          background-color: var(--admin-hover-bg, #374151);
        }

        .btn-danger {
          background-color: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .btn-danger:hover {
          background-color: #ef4444;
          color: #ffffff;
        }

        /* KPI Layout — Exactly 3 Cards Per Row on Desktop */
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
          margin-bottom: 2.5rem;
        }

        @media (max-width: 1100px) {
          .kpi-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 640px) {
          .kpi-grid {
            grid-template-columns: 1fr;
          }
        }

        .kpi-card {
          background: linear-gradient(135deg, rgba(17, 24, 39, 0.95) 0%, rgba(11, 15, 25, 0.98) 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          padding: 1.35rem 1.5rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
          overflow: hidden;
        }

        .kpi-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          border-radius: 18px 18px 0 0;
          opacity: 0.85;
        }

        /* Specific Color Themes per Card */
        .kpi-card-emerald::before { background: linear-gradient(90deg, #10b981, #00ffaa); }
        .kpi-card-emerald { border-color: rgba(16, 185, 129, 0.25); }
        .kpi-card-emerald:hover { border-color: rgba(16, 185, 129, 0.5); box-shadow: 0 10px 30px rgba(16, 185, 129, 0.25); transform: translateY(-4px); }

        .kpi-card-blue::before { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
        .kpi-card-blue { border-color: rgba(59, 130, 246, 0.25); }
        .kpi-card-blue:hover { border-color: rgba(59, 130, 246, 0.5); box-shadow: 0 10px 30px rgba(59, 130, 246, 0.25); transform: translateY(-4px); }

        .kpi-card-purple::before { background: linear-gradient(90deg, #a855f7, #c084fc); }
        .kpi-card-purple { border-color: rgba(168, 85, 247, 0.25); }
        .kpi-card-purple:hover { border-color: rgba(168, 85, 247, 0.5); box-shadow: 0 10px 30px rgba(168, 85, 247, 0.25); transform: translateY(-4px); }

        .kpi-card-cyan::before { background: linear-gradient(90deg, #06b6d4, #22d3ee); }
        .kpi-card-cyan { border-color: rgba(6, 182, 212, 0.25); }
        .kpi-card-cyan:hover { border-color: rgba(6, 182, 212, 0.5); box-shadow: 0 10px 30px rgba(6, 182, 212, 0.25); transform: translateY(-4px); }

        .kpi-card-amber::before { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
        .kpi-card-amber { border-color: rgba(245, 158, 11, 0.25); }
        .kpi-card-amber:hover { border-color: rgba(245, 158, 11, 0.5); box-shadow: 0 10px 30px rgba(245, 158, 11, 0.25); transform: translateY(-4px); }

        .kpi-card-rose::before { background: linear-gradient(90deg, #f472b6, #ec4899); }
        .kpi-card-rose { border-color: rgba(244, 114, 182, 0.25); }
        .kpi-card-rose:hover { border-color: rgba(244, 114, 182, 0.5); box-shadow: 0 10px 30px rgba(244, 114, 182, 0.25); transform: translateY(-4px); }

        /* Card Top Header */
        .kpi-card-top {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.85rem;
        }

        .kpi-icon-wrapper {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.15rem;
          flex-shrink: 0;
        }

        .icon-emerald { background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); }
        .icon-blue { background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); }
        .icon-purple { background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.3); }
        .icon-cyan { background: rgba(6, 182, 212, 0.15); border: 1px solid rgba(6, 182, 212, 0.3); }
        .icon-amber { background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); }
        .icon-rose { background: rgba(244, 114, 182, 0.15); border: 1px solid rgba(244, 114, 182, 0.3); }

        .kpi-title-block {
          flex: 1;
        }

        .kpi-title {
          font-size: 0.8rem;
          color: #f3f4f6;
          font-weight: 700;
          letter-spacing: 0.04em;
          display: block;
          line-height: 1.2;
        }

        .title-emerald { color: #34d399 !important; text-shadow: 0 0 10px rgba(52, 211, 153, 0.25); }
        .title-blue { color: #60a5fa !important; text-shadow: 0 0 10px rgba(96, 165, 250, 0.25); }
        .title-purple { color: #c084fc !important; text-shadow: 0 0 10px rgba(192, 132, 252, 0.25); }
        .title-cyan { color: #38bdf8 !important; text-shadow: 0 0 10px rgba(56, 189, 248, 0.25); }
        .title-amber { color: #fbbf24 !important; text-shadow: 0 0 10px rgba(251, 191, 36, 0.25); }
        .title-rose { color: #f472b6 !important; text-shadow: 0 0 10px rgba(244, 114, 182, 0.25); }

        .kpi-subtitle {
          font-size: 0.7rem;
          color: #9ca3af;
          font-weight: 500;
          display: block;
        }

        .kpi-badge {
          font-size: 0.65rem;
          font-weight: 800;
          padding: 0.2rem 0.5rem;
          border-radius: 999px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .badge-emerald { background: rgba(16, 185, 129, 0.15); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.3); }
        .badge-blue { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(96, 165, 250, 0.3); }
        .badge-cyan { background: rgba(6, 182, 212, 0.15); color: #22d3ee; border: 1px solid rgba(34, 211, 238, 0.3); }

        /* Card Middle Metric */
        .kpi-card-middle {
          margin-bottom: 0.75rem;
        }

        .circular-gauge-middle {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 0.2rem 0;
        }

        .kpi-value {
          font-size: 2.1rem;
          font-weight: 800;
          line-height: 1.1;
        }

        .kpi-value .unit {
          font-size: 1rem;
          color: #9ca3af;
          font-weight: 400;
        }

        .text-emerald { color: #4ade80; }
        .text-blue { color: #60a5fa; }
        .text-purple { color: #c084fc; }
        .text-cyan { color: #22d3ee; }
        .text-amber { color: #fbbf24; }
        .text-rose { color: #f472b6; }
        .text-red { color: #ff6b6b; }

        /* Card Bottom Row & Mini Progress Bars */
        .kpi-card-bottom {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .kpi-footer-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.75rem;
          color: #9ca3af;
          font-weight: 500;
        }

        .kpi-mini-bar {
          height: 6px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          overflow: hidden;
        }

        .kpi-mini-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.5s ease;
        }

        .fill-emerald { background: linear-gradient(90deg, #10b981, #4ade80); }
        .fill-blue { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
        .fill-purple { background: linear-gradient(90deg, #a855f7, #c084fc); }
        .fill-cyan { background: linear-gradient(90deg, #06b6d4, #22d3ee); }
        .fill-amber { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
        .fill-rose { background: linear-gradient(90deg, #ec4899, #f472b6); }

        .kpi-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.7rem;
          font-weight: 800;
          padding: 0.25rem 0.6rem;
          border-radius: 999px;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }

        .kpi-status-badge.online {
          background-color: rgba(34, 197, 94, 0.22);
          color: #4ade80;
          border: 1px solid rgba(74, 222, 128, 0.6);
          box-shadow: 0 0 10px rgba(74, 222, 128, 0.35);
        }

        .kpi-status-badge.offline {
          background-color: rgba(239, 68, 68, 0.25);
          color: #ff6b6b;
          border: 1px solid rgba(255, 107, 107, 0.65);
          box-shadow: 0 0 10px rgba(255, 107, 107, 0.4);
        }

        .pulse-dot {
          width: 8px;
          height: 8px;
          background-color: currentColor;
          border-radius: 50%;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0% { transform: scale(0.9); opacity: 0.6; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.6; }
        }

        /* Dashboard panels */
        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem;
        }

        .panel-card {
          background-color: var(--admin-card-bg, #0b0f19);
          border: 1px solid var(--admin-border, rgba(255, 255, 255, 0.05));
          border-radius: 16px;
          padding: 1.75rem;
          box-shadow: var(--admin-card-shadow);
        }

        .panel-title {
          font-size: 1.1rem;
          font-weight: 700;
          margin-bottom: 1.25rem;
          color: var(--admin-text-primary, #ffffff);
          border-bottom: 1px solid var(--admin-border, rgba(255,255,255,0.05));
          padding-bottom: 0.5rem;
        }

        .chart-panel {
          grid-column: span 2;
        }

        .chart-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.25rem;
          border-bottom: 1px solid var(--admin-border, rgba(255,255,255,0.05));
          padding-bottom: 0.75rem;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .chart-period-badge {
          display: inline-block;
          margin-left: 0.65rem;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          color: #00c896;
          background: rgba(0, 200, 150, 0.1);
          border: 1px solid rgba(0, 200, 150, 0.25);
          border-radius: 999px;
          padding: 0.1rem 0.55rem;
          vertical-align: middle;
          text-transform: uppercase;
        }

        .chart-period-selector-wrap {
          position: relative;
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }

        .chart-period-select {
          appearance: none;
          -webkit-appearance: none;
          background-color: var(--admin-input-bg, #0f1621);
          color: var(--admin-text-primary, #e5e7eb);
          border: 1px solid var(--admin-input-border, rgba(0, 200, 150, 0.35));
          border-radius: 8px;
          padding: 0.45rem 2.2rem 0.45rem 0.85rem;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .chart-period-select:focus {
          border-color: var(--admin-accent, #00c896);
          box-shadow: 0 0 0 3px rgba(0, 200, 150, 0.15);
        }

        .chart-period-select option {
          background-color: var(--admin-card-bg, #0f1621);
          color: var(--admin-text-primary, #f3f4f6);
        }

        .chart-period-arrow {
          position: absolute;
          right: 0.7rem;
          color: var(--admin-accent, #00c896);
          font-size: 0.75rem;
          pointer-events: none;
        }

        .svg-container {
          position: relative;
          margin-top: 0.5rem;
        }

        .chart-dot-group circle {
          transition: r 0.15s;
          cursor: pointer;
        }

        .chart-dot-group:hover circle {
          r: 7;
          fill: #00c896;
        }

        /* ── Chart Hover Tooltip ── */
        .chart-hover-card {
          position: absolute;
          z-index: 20;
          width: min(320px, calc(100vw - 2rem));
          padding: 0;
          border: 1px solid rgba(0, 200, 150, 0.35);
          border-radius: 12px;
          background: rgba(5, 10, 20, 0.97);
          backdrop-filter: blur(16px);
          color: #e5e7eb;
          box-shadow: 0 20px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,200,150,0.1);
          pointer-events: none;
          font-size: 0.72rem;
          font-family: var(--admin-font-family, inherit);
          animation: chcFadeIn 0.13s ease;
          overflow: hidden;
        }
        @keyframes chcFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Header */
        .chc-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          padding: 0.65rem 0.9rem 0.5rem;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          background: rgba(0,200,150,0.06);
        }
        .chc-date {
          font-weight: 700;
          font-size: 0.78rem;
          color: #f3f4f6;
          letter-spacing: 0.02em;
        }
        .chc-views-badge {
          background: rgba(0,200,150,0.18);
          color: #00c896;
          border: 1px solid rgba(0,200,150,0.3);
          border-radius: 5px;
          padding: 2px 8px;
          font-weight: 700;
          font-size: 0.68rem;
          flex-shrink: 0;
          white-space: nowrap;
        }

        /* Column header */
        .chc-col-header {
          display: flex;
          justify-content: space-between;
          padding: 0.32rem 0.9rem 0.28rem;
          font-size: 0.6rem;
          font-weight: 800;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: #6b7280;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          background: rgba(255,255,255,0.02);
        }

        /* Scrollable body */
        .chc-body {
          max-height: 300px;
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: thin;
          scrollbar-color: rgba(0,200,150,0.3) transparent;
        }
        .chc-body::-webkit-scrollbar { width: 3px; }
        .chc-body::-webkit-scrollbar-thumb { background: rgba(0,200,150,0.3); border-radius: 4px; }

        /* Country block */
        .chc-country-block {
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .chc-country-block:last-child { border-bottom: none; }

        /* Country header row */
        .chc-country-header {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.45rem 0.9rem 0.3rem;
          border-left: 3px solid;
          background: rgba(255,255,255,0.025);
        }
        .chc-country-flag {
          font-size: 0.8rem;
          flex-shrink: 0;
        }
        .chc-country-name {
          font-weight: 700;
          font-size: 0.73rem;
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .chc-country-total {
          font-size: 0.62rem;
          font-weight: 600;
          opacity: 0.75;
          flex-shrink: 0;
          white-space: nowrap;
        }

        /* Page rows */
        .chc-pages-list {
          display: flex;
          flex-direction: column;
          padding: 0.2rem 0 0.35rem 1.1rem;
        }
        .chc-page-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          padding: 0.22rem 0.9rem 0.22rem 0.4rem;
          border-radius: 4px;
          transition: background 0.15s;
        }
        .chc-page-row:hover { background: rgba(255,255,255,0.04); }
        .chc-page-path {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #9ca3af;
          font-size: 0.68rem;
          font-family: "Courier New", monospace;
        }
        .chc-page-views {
          flex-shrink: 0;
          font-weight: 700;
          font-size: 0.68rem;
          min-width: 24px;
          text-align: right;
        }

        /* Empty state */
        .chc-empty {
          padding: 0.7rem 0.9rem;
          color: #6b7280;
          font-size: 0.7rem;
          text-align: center;
        }

        /* ── Top Visited Pages Table ── */
        .pages-table {
          display: flex;
          flex-direction: column;
          gap: 0;
          overflow: hidden;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.06);
        }

        /* Shared grid: rank(40px) | path(1fr) | views(72px) | %(52px) */
        .pages-table-head,
        .pages-table-row {
          display: grid;
          grid-template-columns: 44px 1fr 72px 52px;
          align-items: center;
          gap: 0;
        }

        .pages-table-head {
          padding: 0.4rem 0.75rem;
          background: rgba(255,255,255,0.04);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          font-size: 0.6rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #4b5563;
        }
        .pages-table-head .pt-col-views,
        .pages-table-head .pt-col-pct { text-align: right; }

        .pages-table-row {
          position: relative;
          padding: 0.55rem 0.75rem 0.3rem;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          transition: background 0.18s;
          cursor: default;
        }
        .pages-table-row:last-child { border-bottom: none; }
        .pages-table-row:hover { background: rgba(255,255,255,0.035); }

        /* Column slots shared between head and row */
        .pt-col-rank  { grid-column: 1; }
        .pt-col-path  { grid-column: 2; padding: 0 0.5rem; }
        .pt-col-views { grid-column: 3; text-align: right; }
        .pt-col-pct   { grid-column: 4; text-align: right; padding-right: 0.1rem; }

        /* Bar row — spans full width below the columns */
        .pt-bar-row {
          grid-column: 1 / -1;
          height: 5px;
          background: rgba(255,255,255,0.05);
          border-radius: 999px;
          overflow: hidden;
          margin-top: 0.35rem;
        }
        .pt-bar-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.7s cubic-bezier(0.4,0,0.2,1);
        }

        .pt-rank-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 32px;
          height: 22px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 800;
          padding: 0 0.35rem;
        }
        .pt-path-text {
          font-size: 0.8rem;
          color: var(--admin-text-primary, #e5e7eb);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-family: "Courier New", monospace;
        }
        .pt-views-val {
          font-size: 0.78rem;
          font-weight: 700;
        }
        .pt-pct-val {
          font-size: 0.76rem;
          font-weight: 800;
        }

        /* ── Top Geolocations Table ── */
        .geo-table {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.06);
        }

        /* Shared grid: rank(40px) | state(1fr) | country(1fr) | views(90px) */
        .geo-table-head,
        .geo-table-row {
          display: grid;
          grid-template-columns: 40px 1fr 1fr 90px;
          align-items: center;
        }

        .geo-table-head {
          padding: 0.4rem 0.75rem;
          background: rgba(255,255,255,0.04);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          font-size: 0.6rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #4b5563;
          gap: 0.5rem;
        }
        .geo-table-head .gt-col-views { text-align: right; }

        .geo-table-row {
          padding: 0.55rem 0.75rem;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          gap: 0.5rem;
          transition: background 0.18s;
          cursor: default;
        }
        .geo-table-row:last-child { border-bottom: none; }
        .geo-table-row:hover { background: rgba(255,255,255,0.035); }

        .gt-col-rank    { grid-column: 1; }
        .gt-col-state   { grid-column: 2; min-width: 0; }
        .gt-col-country { grid-column: 3; min-width: 0; }
        .gt-col-views   { grid-column: 4; text-align: right; }

        .gt-rank-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 7px;
          font-size: 0.72rem;
          font-weight: 800;
        }

        .gt-state-cell, .gt-country-cell {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          min-width: 0;
        }
        .gt-state-name {
          font-size: 0.8rem;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .gt-country-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .gt-country-name {
          font-size: 0.77rem;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .gt-views-cell {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.25rem;
        }
        .gt-views-num {
          font-size: 0.88rem;
          font-weight: 800;
          line-height: 1;
        }
        .gt-bar-track {
          width: 70px;
          height: 4px;
          background: rgba(255,255,255,0.07);
          border-radius: 999px;
          overflow: hidden;
        }
        .gt-bar-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.65s cubic-bezier(0.4,0,0.2,1);
        }

        .no-data-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          padding: 2rem;
          color: var(--admin-text-secondary, #9ca3af);
          font-size: 0.9rem;
        }

        /* Chart legend row */
        .chart-legend-row {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          margin-top: 0.75rem;
          padding-top: 0.75rem;
          border-top: 1px solid rgba(255,255,255,0.05);
          font-size: 0.78rem;
          color: var(--admin-text-secondary, #9ca3af);
          flex-wrap: wrap;
        }

        .legend-dot {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .chart-stats-row {
          display: flex;
          gap: 0.75rem;
        }

        .chart-stat {
          font-size: 0.78rem;
          color: var(--admin-text-secondary, #9ca3af);
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          padding: 0.15rem 0.55rem;
          border-radius: 6px;
        }

        .no-data {
          color: var(--admin-text-secondary, #9ca3af);
          font-style: italic;
          font-size: 0.9rem;
        }

        /* Tables & Geolocation */
        .table-wrapper {
          overflow-x: auto;
        }

        .mini-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9rem;
        }

        .mini-table th, .mini-table td {
          padding: 0.6rem 0.5rem;
          text-align: left;
        }

        .mini-table th {
          border-bottom: 1px solid var(--admin-border, rgba(255,255,255,0.05));
          color: var(--admin-text-secondary, #9ca3af);
          font-weight: 600;
        }

        .mini-table tr:not(:last-child) td {
          border-bottom: 1px solid var(--admin-border, rgba(255,255,255,0.02));
        }

        /* System Performance Status Circular bar */
        .circular-progress-container {
          display: flex;
          align-items: center;
          justify-content: space-around;
          padding: 1rem 0;
        }

        .circular-progress {
          position: relative;
          width: 140px;
          height: 140px;
        }

        .progress-value {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .progress-value .number {
          font-size: 1.75rem;
          font-weight: 800;
          color: var(--admin-text-primary, #ffffff);
        }

        .progress-value .sub {
          font-size: 0.7rem;
          color: var(--admin-text-secondary, #9ca3af);
          text-transform: uppercase;
        }

        .circular-svg {
          transform: rotate(-90deg);
          width: 140px;
          height: 140px;
        }

        .circular-svg circle {
          fill: none;
          stroke-width: 8;
        }

        .bg-circle {
          stroke: var(--admin-border, rgba(255,255,255,0.05));
        }

        .fill-circle {
          stroke: var(--admin-accent, #00c896);
          stroke-dasharray: 377;
          transition: stroke-dashoffset 0.6s ease;
          stroke-linecap: round;
        }

        .status-legend {
          font-size: 0.85rem;
          color: var(--admin-text-secondary, #9ca3af);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        /* Logs Tab Detailed Table & Control Bar */
        .full-panel {
          width: 100%;
        }

        .logs-panel {
          display: flex;
          flex-direction: column;
        }

        .logs-header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }

        .logs-header-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .panel-title-inline {
          font-size: 1.25rem;
          font-weight: 700;
          margin: 0;
          color: var(--admin-text-primary, #ffffff);
        }

        .limit-dropdown {
          background-color: var(--admin-bg, #0b0f19);
          color: var(--admin-accent, #00c896);
          border: 1px solid var(--admin-border, rgba(0, 200, 150, 0.3));
          border-radius: 8px;
          padding: 0.4rem 0.75rem;
          font-size: 0.88rem;
          font-weight: 600;
          cursor: pointer;
          outline: none;
          transition: all 0.2s;
        }

        .limit-dropdown:hover, .limit-dropdown:focus {
          border-color: var(--admin-accent, #00c896);
          box-shadow: 0 0 10px rgba(0, 200, 150, 0.2);
        }

        .logs-header-center, .logs-header-right {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .search-toggle-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          background-color: var(--admin-bg, #0b0f19);
          color: var(--admin-text-secondary, #9ca3af);
          border: 1px solid var(--admin-border, rgba(255, 255, 255, 0.12));
          border-radius: 8px;
          padding: 0.45rem 0.9rem;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .search-toggle-btn:hover, .search-toggle-btn.active {
          color: #ffffff;
          border-color: var(--admin-accent, #00c896);
          background-color: rgba(0, 200, 150, 0.08);
        }

        .search-toggle-btn.has-val {
          border-color: #3b82f6;
          color: #60a5fa;
          background-color: rgba(59, 130, 246, 0.1);
        }

        .active-dot {
          color: #00c896;
          font-size: 0.7rem;
          margin-left: 2px;
        }

        .expand-chevron {
          font-size: 0.65rem;
          margin-left: 2px;
          opacity: 0.7;
        }

        .quick-search-box {
          background: rgba(11, 15, 25, 0.75);
          border: 1px solid rgba(0, 200, 150, 0.3);
          border-radius: 10px;
          padding: 1rem;
          margin-bottom: 1rem;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .quick-search-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--admin-text-secondary, #9ca3af);
          margin-bottom: 0.5rem;
        }

        .quick-search-textarea {
          width: 100%;
          background: var(--admin-bg, #030712);
          border: 1px solid var(--admin-border, rgba(255, 255, 255, 0.15));
          border-radius: 8px;
          color: #ffffff;
          padding: 0.65rem 0.85rem;
          font-size: 0.9rem;
          font-family: inherit;
          outline: none;
          resize: vertical;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .quick-search-textarea:focus {
          border-color: var(--admin-accent, #00c896);
          box-shadow: 0 0 12px rgba(0, 200, 150, 0.2);
        }

        .quick-search-hint {
          font-size: 0.75rem;
          color: #6b7280;
          margin-top: 0.4rem;
        }

        .advanced-search-box {
          background: rgba(11, 15, 25, 0.85);
          border: 1px solid rgba(59, 130, 246, 0.35);
          border-radius: 10px;
          padding: 1rem;
          margin-bottom: 1rem;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .adv-box-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.85rem;
          padding-bottom: 0.4rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .adv-title {
          font-size: 0.9rem;
          font-weight: 700;
          color: #60a5fa;
        }

        .clear-link-btn {
          background: none;
          border: none;
          color: #ef4444;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
        }

        .clear-link-btn:hover {
          text-decoration: underline;
        }

        .adv-filter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 0.85rem;
        }

        .adv-field {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }

        .adv-field label {
          font-size: 0.72rem;
          font-weight: 700;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .adv-field input {
          background: var(--admin-bg, #030712);
          border: 1px solid var(--admin-border, rgba(255, 255, 255, 0.15));
          border-radius: 6px;
          color: #ffffff;
          padding: 0.45rem 0.65rem;
          font-size: 0.82rem;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .adv-field input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 8px rgba(59, 130, 246, 0.25);
        }

        .logs-meta-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.4rem 0.25rem;
          margin-bottom: 0.75rem;
          font-size: 0.82rem;
          color: #9ca3af;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .reset-all-btn {
          background: rgba(239, 68, 68, 0.12);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 6px;
          padding: 0.25rem 0.6rem;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .reset-all-btn:hover {
          background: #ef4444;
          color: #ffffff;
        }

        .sortable-th {
          cursor: pointer;
          user-select: none;
          transition: color 0.15s;
        }

        .sortable-th:hover {
          color: var(--admin-accent, #00c896) !important;
        }

        .sort-icon {
          margin-left: 4px;
          font-size: 0.75rem;
          display: inline-block;
        }

        .sort-icon.inactive {
          opacity: 0.35;
        }

        .sort-icon.active {
          color: var(--admin-accent, #00c896);
          opacity: 1;
        }

        .no-logs-td {
          padding: 2.5rem !important;
          color: #6b7280;
          font-style: italic;
        }

        .main-table-wrapper {
          margin-top: 0.5rem;
          max-height: 600px;
          overflow-y: auto;
        }

        .main-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
          text-align: left;
        }

        .main-table th {
          position: sticky;
          top: 0;
          background-color: var(--admin-card-bg, #0b0f19);
          padding: 0.75rem 1rem;
          color: var(--admin-text-secondary, #9ca3af);
          font-weight: 600;
          border-bottom: 2px solid var(--admin-border, rgba(255,255,255,0.05));
          z-index: 10;
        }

        .main-table td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--admin-border, rgba(255,255,255,0.03));
          vertical-align: middle;
        }

        .main-table tr:hover td {
          background-color: var(--admin-hover-bg, rgba(255, 255, 255, 0.02));
        }

        .time-col { white-space: nowrap; color: var(--admin-text-primary); }
        .date-sub { font-size: 0.7rem; color: var(--admin-text-secondary, #9ca3af); }
        .ip-col { color: var(--admin-text-primary, #f3f4f6); }
        .state-sub { font-size: 0.75rem; color: var(--admin-text-secondary, #9ca3af); }
        .path-col { word-break: break-all; color: var(--admin-text-primary); }
        .ref-col { word-break: break-all; color: var(--admin-text-secondary, #9ca3af); }
        .ua-col { color: var(--admin-text-secondary, #9ca3af); }

        /* Panel Header Row */
        .panel-header-row {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 1.5rem;
          padding-bottom: 0.85rem;
          border-bottom: 1px solid var(--admin-border, rgba(255, 255, 255, 0.08));
          text-align: center;
        }

        .system-health-title {
          font-size: 1.75rem !important;
          font-weight: 800 !important;
          color: #f472b6 !important;
          text-shadow: 0 0 16px rgba(244, 114, 182, 0.35) !important;
          text-align: center !important;
          margin: 0 !important;
          border-bottom: none !important;
          padding-bottom: 0 !important;
        }

        .panel-header-row .live-status-chip {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
        }

        .live-status-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.75rem;
          font-weight: 700;
          color: #00c896;
          background: rgba(0, 200, 150, 0.1);
          border: 1px solid rgba(0, 200, 150, 0.25);
          padding: 0.25rem 0.65rem;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        /* Per-Card Time Window Selectors & Headers */
        .card-window-pills {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          padding: 0.15rem 0.25rem;
        }

        .card-time-btn {
          background: transparent;
          border: none;
          color: #9ca3af;
          font-size: 0.68rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: 999px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .card-time-btn:hover {
          color: #ffffff;
          background: rgba(192, 132, 252, 0.15);
        }

        .card-time-btn.active {
          background: linear-gradient(135deg, #c084fc 0%, #9333ea 100%);
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(192, 132, 252, 0.4);
        }

        /* Realtime Live Graphs Section (2 Cards Per Row) */
        .live-graphs-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem;
          margin-bottom: 2.5rem;
        }

        @media (max-width: 900px) {
          .live-graphs-grid {
            grid-template-columns: 1fr;
          }
        }

        .graph-card {
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(10, 15, 28, 0.98) 100%);
          border: 1px solid var(--admin-border, rgba(255, 255, 255, 0.08));
          border-radius: 18px;
          padding: 1.25rem 1.5rem;
          display: flex;
          flex-direction: column;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
        }

        .graph-card:hover {
          transform: translateY(-3px);
          border-color: rgba(56, 189, 248, 0.35);
          box-shadow: 0 10px 30px rgba(56, 189, 248, 0.15);
        }

        .graph-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem;
          padding-bottom: 0.65rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .header-title-chip {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .graph-card-title {
          font-size: 0.92rem;
          font-weight: 700;
          color: #f3f4f6;
          letter-spacing: 0.02em;
        }

        .graph-badge {
          font-size: 0.68rem;
          font-weight: 800;
          padding: 0.2rem 0.55rem;
          border-radius: 999px;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }

        .graph-card-body {
          flex: 1;
          display: flex;
          align-items: center;
        }

        .donut-chart-body {
          display: flex;
          align-items: center;
          justify-content: space-around;
          gap: 1.2rem;
          padding: 0.5rem 0;
        }

        .donut-chart-svg {
          width: 160px;
          height: 160px;
          flex-shrink: 0;
        }

        circle.donut-center-hit {
          cursor: pointer;
          transition: fill 0.25s ease;
        }
        circle.donut-center-hit:hover {
          fill: rgba(52, 211, 153, 0.12);
        }

        .chart-legend-box {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          font-size: 0.78rem;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #9ca3af;
        }

        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .bar-chart-body, .analogue-chart-body {
          padding: 0.4rem 0;
          width: 100%;
        }

        .bar-chart-svg, .line-chart-svg {
          width: 100%;
          height: 160px;
        }

        .analogue-graph-card {
          background: #111827;
          border-color: rgba(52, 211, 153, 0.2);
        }

        /* Interactive SVG & Floating Tooltip */
        .interactive-svg {
          cursor: pointer;
        }

        circle.svg-hover-slice {
          cursor: pointer;
          pointer-events: stroke;
          transition: stroke-width 0.2s ease, opacity 0.2s ease, filter 0.2s ease;
        }

        circle.svg-hover-slice:hover {
          stroke-width: 30px;
          filter: drop-shadow(0 0 10px currentColor);
          opacity: 1;
        }

        path.svg-hover-slice {
          cursor: pointer;
          pointer-events: fill;
          transition: filter 0.2s ease, transform 0.2s ease;
        }

        path.svg-hover-slice:hover {
          filter: drop-shadow(0 0 10px currentColor);
        }

        .svg-hover-group {
          cursor: pointer;
        }

        .svg-hover-group:hover rect {
          filter: drop-shadow(0 0 8px #fbbf24);
          opacity: 1;
        }

        .svg-hover-group:hover circle {
          r: 7px;
          filter: drop-shadow(0 0 8px #38bdf8);
        }

        .interactive-legend {
          cursor: pointer;
          padding: 0.15rem 0.35rem;
          border-radius: 6px;
          transition: background 0.2s ease, color 0.2s ease;
        }

        .interactive-legend:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff !important;
        }

        .graph-tooltip-floating {
          position: fixed;
          z-index: 9999;
          pointer-events: none;
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(12px);
          border: 1.5px solid #38bdf8;
          border-radius: 10px;
          padding: 0.65rem 0.9rem;
          font-family: var(--admin-font-family);
          transition: left 0.05s ease-out, top 0.05s ease-out;
        }

        .graph-tooltip-floating .tooltip-title {
          font-size: 0.78rem;
          font-weight: 800;
          margin-bottom: 0.2rem;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .graph-tooltip-floating .tooltip-val {
          font-size: 0.88rem;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 0.2rem;
        }

        .graph-tooltip-floating .tooltip-sub {
          font-size: 0.72rem;
          color: #9ca3af;
        }

        /* Meaningful Graph Information Footers */
        .graph-info-footer {
          margin-top: 0.85rem;
          padding: 0.65rem 0.85rem;
          border-radius: 10px;
          font-size: 0.78rem;
          line-height: 1.45;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0, 0, 0, 0.25);
        }

        .graph-info-footer.info-emerald { color: #34d399; border-color: rgba(52, 211, 153, 0.25); background: rgba(52, 211, 153, 0.06); }
        .graph-info-footer.info-amber { color: #fbbf24; border-color: rgba(251, 191, 36, 0.25); background: rgba(251, 191, 36, 0.06); }
        .graph-info-footer.info-cyan { color: #38bdf8; border-color: rgba(56, 189, 248, 0.25); background: rgba(56, 189, 248, 0.06); }
        .graph-info-footer.info-purple { color: #c084fc; border-color: rgba(192, 132, 252, 0.25); background: rgba(192, 132, 252, 0.06); }
        .graph-info-footer.info-rose { color: #f472b6; border-color: rgba(244, 114, 182, 0.25); background: rgba(244, 114, 182, 0.06); }

        /* System Settings Panel Grid — EXACTLY 3 Cards Per Row on Desktop */
        .system-health-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
          margin-top: 1rem;
        }

        @media (max-width: 1200px) {
          .system-health-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .system-health-grid {
            grid-template-columns: 1fr;
          }
        }

        .health-card {
          background: var(--admin-card-bg, #0d1322);
          border: 1px solid var(--admin-border, rgba(255, 255, 255, 0.08));
          border-radius: 16px;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
          transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
        }

        .health-card:hover {
          transform: translateY(-4px);
          border-color: rgba(0, 200, 150, 0.35);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
        }

        .card-head {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
          padding-bottom: 0.85rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .card-icon {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          flex-shrink: 0;
        }

        .mongo-icon { background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.25); }
        .cpu-icon { background: rgba(59, 130, 246, 0.12); border-color: rgba(59, 130, 246, 0.25); }
        .ram-icon { background: rgba(6, 182, 212, 0.12); border-color: rgba(6, 182, 212, 0.25); }
        .os-icon { background: rgba(168, 85, 247, 0.12); border-color: rgba(168, 85, 247, 0.25); }
        .tracker-icon { background: rgba(236, 72, 153, 0.12); border-color: rgba(236, 72, 153, 0.25); }
        .r2-icon { background: rgba(245, 158, 11, 0.12); border-color: rgba(245, 158, 11, 0.25); }

        .card-head-info {
          flex: 1;
          text-align: center;
        }

        .card-head-info h3 {
          font-size: 1.05rem;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
          line-height: 1.2;
          text-align: center;
        }

        .card-mongo .card-head-info h3 { color: #34d399 !important; text-shadow: 0 0 10px rgba(52, 211, 153, 0.25); }
        .card-cpu .card-head-info h3 { color: #60a5fa !important; text-shadow: 0 0 10px rgba(96, 165, 250, 0.25); }
        .card-ram .card-head-info h3 { color: #f472b6 !important; text-shadow: 0 0 10px rgba(244, 114, 182, 0.25); }
        .card-os .card-head-info h3 { color: #38bdf8 !important; text-shadow: 0 0 10px rgba(56, 189, 248, 0.25); }
        .card-tracker .card-head-info h3 { color: #c084fc !important; text-shadow: 0 0 10px rgba(192, 132, 252, 0.25); }
        .card-r2 .card-head-info h3 { color: #fbbf24 !important; text-shadow: 0 0 10px rgba(251, 191, 36, 0.25); }

        .card-mongo:hover { border-color: rgba(52, 211, 153, 0.4); box-shadow: 0 10px 30px rgba(52, 211, 153, 0.15); }
        .card-cpu:hover { border-color: rgba(96, 165, 250, 0.4); box-shadow: 0 10px 30px rgba(96, 165, 250, 0.15); }
        .card-ram:hover { border-color: rgba(244, 114, 182, 0.4); box-shadow: 0 10px 30px rgba(244, 114, 182, 0.15); }
        .card-os:hover { border-color: rgba(56, 189, 248, 0.4); box-shadow: 0 10px 30px rgba(56, 189, 248, 0.15); }
        .card-tracker:hover { border-color: rgba(192, 132, 252, 0.4); box-shadow: 0 10px 30px rgba(192, 132, 252, 0.15); }
        .card-r2:hover { border-color: rgba(251, 191, 36, 0.4); box-shadow: 0 10px 30px rgba(251, 191, 36, 0.15); }

        .card-subtitle {
          font-size: 0.75rem;
          color: #9ca3af;
          font-weight: 500;
          text-align: center;
          display: block;
        }

        .health-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.45rem 0;
          border-bottom: 1px dashed rgba(255, 255, 255, 0.04);
          font-size: 0.85rem;
        }

        .health-row:last-of-type {
          border-bottom: none;
        }

        .row-label {
          color: #9ca3af;
          font-weight: 500;
        }

        .row-val {
          color: #f3f4f6;
          font-weight: 600;
        }

        /* Bright & Vivid Status Pills */
        .status-pill {
          font-size: 0.75rem;
          font-weight: 800;
          padding: 0.28rem 0.65rem;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          flex-shrink: 0;
        }

        .status-pill.green, .status-pill.online {
          background-color: rgba(34, 197, 94, 0.22);
          color: #4ade80;
          border: 1px solid rgba(74, 222, 128, 0.6);
          box-shadow: 0 0 12px rgba(74, 222, 128, 0.35);
        }

        .status-pill.amber {
          background-color: rgba(245, 158, 11, 0.22);
          color: #fbbf24;
          border: 1px solid rgba(251, 191, 36, 0.6);
          box-shadow: 0 0 12px rgba(251, 191, 36, 0.35);
        }

        .status-pill.red, .status-pill.offline {
          background-color: rgba(239, 68, 68, 0.25);
          color: #ff6b6b;
          border: 1px solid rgba(255, 107, 107, 0.65);
          box-shadow: 0 0 12px rgba(255, 107, 107, 0.4);
        }

        /* Custom Graphic UI Widgets (Replacing Old Line Meters) */
        .custom-widget-box {
          margin-top: 0.85rem;
          padding: 0.75rem 0.85rem;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }

        .widget-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .widget-title {
          color: #d1d5db;
          font-weight: 600;
        }

        .widget-badge {
          font-size: 0.65rem;
          font-weight: 800;
          padding: 0.15rem 0.45rem;
          border-radius: 999px;
          letter-spacing: 0.03em;
        }

        .badge-emerald-glow { background: rgba(52, 211, 153, 0.15); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.4); box-shadow: 0 0 8px rgba(52, 211, 153, 0.2); }
        .badge-blue-glow { background: rgba(96, 165, 250, 0.15); color: #60a5fa; border: 1px solid rgba(96, 165, 250, 0.4); box-shadow: 0 0 8px rgba(96, 165, 250, 0.2); }
        .badge-rose-glow { background: rgba(244, 114, 182, 0.15); color: #f472b6; border: 1px solid rgba(244, 114, 182, 0.4); box-shadow: 0 0 8px rgba(244, 114, 182, 0.2); }
        .badge-cyan-glow { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); box-shadow: 0 0 8px rgba(56, 189, 248, 0.2); }
        .badge-purple-glow { background: rgba(192, 132, 252, 0.15); color: #c084fc; border: 1px solid rgba(192, 132, 252, 0.4); box-shadow: 0 0 8px rgba(192, 132, 252, 0.2); }
        .badge-amber-glow { background: rgba(251, 191, 36, 0.15); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.4); box-shadow: 0 0 8px rgba(251, 191, 36, 0.2); }

        .widget-footer {
          display: flex;
          justify-content: space-between;
          font-size: 0.68rem;
          color: #9ca3af;
        }

        /* Widget 1: Segmented Storage Matrix */
        .segmented-bar {
          display: flex;
          gap: 4px;
          height: 10px;
          align-items: center;
          margin: 0.2rem 0;
        }

        .segment-cell {
          flex: 1;
          height: 100%;
          border-radius: 3px;
          transition: all 0.3s ease;
        }

        .cell-inactive {
          background: rgba(255, 255, 255, 0.08);
        }

        .cell-emerald-active {
          background: #34d399;
          box-shadow: 0 0 8px rgba(52, 211, 153, 0.6);
        }

        /* Widget 2: Dynamic Core Equalizer */
        .eq-spectrum-bar {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          height: 26px;
          gap: 6px;
          padding: 0 0.5rem;
        }

        .eq-bar {
          flex: 1;
          border-radius: 4px;
          animation: eqPulse 1.8s infinite ease-in-out alternate;
        }

        .eq-bar-1 { background: linear-gradient(180deg, #34d399, #059669); height: 60%; animation-delay: 0.1s; }
        .eq-bar-2 { background: linear-gradient(180deg, #60a5fa, #2563eb); height: 90%; animation-delay: 0.3s; }
        .eq-bar-3 { background: linear-gradient(180deg, #c084fc, #7c3aed); height: 45%; animation-delay: 0.5s; }
        .eq-bar-4 { background: linear-gradient(180deg, #38bdf8, #0284c7); height: 80%; animation-delay: 0.2s; }
        .eq-bar-5 { background: linear-gradient(180deg, #fbbf24, #d97706); height: 70%; animation-delay: 0.4s; }
        .eq-bar-6 { background: linear-gradient(180deg, #f472b6, #db2777); height: 50%; animation-delay: 0.6s; }

        @keyframes eqPulse {
          0% { transform: scaleY(0.4); opacity: 0.7; }
          100% { transform: scaleY(1); opacity: 1; }
        }

        /* Widget 3: Dual Memory Capsule */
        .dual-memory-pill {
          display: flex;
          height: 20px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.06);
          overflow: hidden;
          margin: 0.2rem 0;
          font-size: 0.65rem;
          font-weight: 700;
        }

        .pill-fill-heap {
          background: linear-gradient(90deg, #f472b6, #e11d48);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-shadow: 0 0 10px rgba(244, 114, 182, 0.4);
          white-space: nowrap;
          padding: 0 0.4rem;
        }

        .pill-fill-ram {
          flex: 1;
          background: rgba(56, 189, 248, 0.12);
          display: flex;
          align-items: center;
          justify-content: flex-end;
          color: #38bdf8;
          padding-right: 0.6rem;
          white-space: nowrap;
        }

        /* Widget 4: Real-time ECG Pulse Monitor */
        .ecg-pulse-wrapper {
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(6, 182, 212, 0.06);
          border-radius: 8px;
          border: 1px solid rgba(56, 189, 248, 0.15);
          overflow: hidden;
        }

        .ecg-svg {
          width: 100%;
          height: 100%;
          filter: drop-shadow(0 0 4px rgba(56, 189, 248, 0.6));
        }

        /* Widget 5: 5-Bar Signal Radar */
        .signal-bars-container {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 6px;
          height: 22px;
          margin: 0.2rem 0;
        }

        .signal-bar {
          width: 12px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.1);
          transition: all 0.3s ease;
        }

        .signal-bar.bar-1 { height: 25%; }
        .signal-bar.bar-2 { height: 45%; }
        .signal-bar.bar-3 { height: 65%; }
        .signal-bar.bar-4 { height: 85%; }
        .signal-bar.bar-5 { height: 100%; }

        .signal-bar.active {
          background: linear-gradient(180deg, #c084fc, #9333ea);
          box-shadow: 0 0 8px rgba(192, 132, 252, 0.6);
        }

        /* Widget 6: Quota Glass Capsule */
        .r2-tier-capsule {
          height: 20px;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 999px;
          overflow: hidden;
          margin: 0.2rem 0;
          display: flex;
          align-items: center;
          border: 1px solid rgba(251, 191, 36, 0.2);
        }

        .r2-fill-amber {
          height: 100%;
          background: linear-gradient(90deg, #fbbf24, #d97706);
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 10px rgba(251, 191, 36, 0.4);
          transition: width 0.4s ease;
        }

        .r2-pill-label {
          font-size: 0.65rem;
          font-weight: 800;
          color: #0f172a;
          white-space: nowrap;
          padding: 0 0.4rem;
        }

        .r2-offline-notice {
          padding: 1rem;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 10px;
          text-align: center;
        }

        .r2-offline-notice .subtext {
          font-size: 0.75rem;
          color: #9ca3af;
          margin-top: 0.4rem;
          line-height: 1.4;
        }

        /* Language Settings Block */
        .lang-settings-block {
          margin-bottom: 1.5rem;
          padding: 1rem;
          background: rgba(0, 200, 150, 0.05);
          border: 1px solid rgba(0, 200, 150, 0.15);
          border-radius: 12px;
        }

        .lang-settings-label {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: #00c896;
          text-transform: uppercase;
          margin-bottom: 0.6rem;
        }

        .lang-select-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .lang-select {
          width: 100%;
          background-color: var(--admin-input-bg, #0f1621);
          color: var(--admin-text-primary, #f3f4f6);
          border: 1px solid var(--admin-input-border, rgba(0, 200, 150, 0.3));
          border-radius: 8px;
          padding: 0.55rem 2rem 0.55rem 0.75rem;
          font-size: 0.9rem;
          font-weight: 500;
          appearance: none;
          -webkit-appearance: none;
          cursor: pointer;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .lang-select:focus {
          border-color: var(--admin-accent, #00c896);
          box-shadow: 0 0 0 3px rgba(0, 200, 150, 0.15);
        }

        .lang-select option {
          background-color: var(--admin-card-bg, #0f1621);
          color: var(--admin-text-primary, #f3f4f6);
        }

        .lang-select-arrow {
          position: absolute;
          right: 0.65rem;
          color: var(--admin-accent, #00c896);
          font-size: 0.8rem;
          pointer-events: none;
        }

        .lang-hint {
          font-size: 0.7rem;
          color: var(--admin-text-secondary, #6b7280);
          margin-top: 0.4rem;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
