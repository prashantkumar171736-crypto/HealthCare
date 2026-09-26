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
}

const PERIOD_OPTIONS = [
  { value: "1d",          label: "1 Day (24 Hours)" },
  { value: "7d",          label: "7 Days (Weekly)" },
  { value: "monthly",     label: "Monthly" },
  { value: "half-yearly", label: "Half Yearly" },
  { value: "yearly",      label: "Yearly" },
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

  // Load theme from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_THEME_KEY);
      if (saved) setTheme({ ...DEFAULT_THEME, ...JSON.parse(saved) });
    } catch {}
  }, []);

  // Save theme to localStorage whenever it changes
  const handleThemeChange = useCallback((t: AdminTheme) => {
    setTheme(t);
    try { localStorage.setItem(LS_THEME_KEY, JSON.stringify(t)); } catch {}
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
    "--admin-bg":             theme.bgColor,
    "--admin-sidebar-bg":    theme.sidebarColor,
    "--admin-card-bg":       theme.cardColor,
    "--admin-accent":        theme.accentColor,
    "--admin-text-primary":   theme.textPrimary,
    "--admin-text-secondary": theme.textSecondary,
    "--admin-font-family":    theme.fontFamily,
    "--admin-font-size":      `${theme.fontSize}px`,
    "--admin-border":         isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.08)",
    "--admin-border-strong":  isLight ? "rgba(0, 0, 0, 0.16)" : "rgba(255, 255, 255, 0.16)",
    "--admin-hover-bg":       isLight ? "rgba(0, 0, 0, 0.04)" : "rgba(255, 255, 255, 0.05)",
    "--admin-input-bg":       isLight ? "#ffffff" : "rgba(0, 0, 0, 0.35)",
    "--admin-input-border":   isLight ? "rgba(0, 0, 0, 0.18)" : "rgba(255, 255, 255, 0.12)",
    "--admin-card-shadow":   isLight ? "0 4px 20px -2px rgba(0, 0, 0, 0.06)" : "0 4px 20px -2px rgba(0, 0, 0, 0.35)",
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

        {/* KPIs Summary Cards */}
        <section className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-title">TOTAL PAGE VIEWS</div>
            <div className="kpi-value">{data.summary.totalViews.toLocaleString()}</div>
            <div className="kpi-footer text-green">All-time record</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-title">UNIQUE VISITORS</div>
            <div className="kpi-value">{data.summary.uniqueVisitors.toLocaleString()}</div>
            <div className="kpi-footer text-blue">Unique daily sessions</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-title">GUI SERVER PING</div>
            <div className="kpi-value">
              {data.systemHealth.dbPingTime} <span className="unit">ms</span>
            </div>
            <div className={`kpi-status-badge ${data.systemHealth.dbStatus === "Connected" ? "online" : "offline"}`}>
              <span className="pulse-dot"></span> MongoDB {data.systemHealth.dbStatus}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-title">SERVER UPTIME</div>
            <div className="kpi-value">{formatUptime(data.systemHealth.serverUptime)}</div>
            <div className="kpi-footer">Running without failures</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-title">CLOUDFLARE R2 CDN</div>
            <div className="kpi-value">
              {data.systemHealth.r2 ? (
                <>{data.systemHealth.r2.totalSizeMB} <span className="unit">MB</span></>
              ) : (
                <>0 <span className="unit">MB</span></>
              )}
            </div>
            <div className={`kpi-status-badge ${data.systemHealth.r2?.status === "Connected" ? "online" : "offline"}`}>
              <span className="pulse-dot"></span> {data.systemHealth.r2 ? `R2 ${data.systemHealth.r2.status} (${data.systemHealth.r2.totalObjects} files)` : "R2 Offline (0 files)"}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-title">GUI SERVER MEMORY</div>
            <div className="kpi-value">
              {data.systemHealth.memoryUsed} <span className="unit">MB</span>
            </div>
            <div className="kpi-status-badge online">
              <span className="pulse-dot"></span> Heap Healthy ({data.systemHealth.memoryTotal} MB Allocated)
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
            <div className="panel-header-row">
              <h2 className="panel-title" style={{ marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>
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

                  {/* Meter */}
                  <div className="meter-box">
                    <div className="meter-header">
                      <span>Database Storage Usage</span>
                      <span className="meter-pct text-green">
                        {((data.systemHealth.dbStorageSizeMB / 512) * 100).toFixed(1)}% of 512 MB
                      </span>
                    </div>
                    <div className="meter-track">
                      <div
                        className="meter-fill green-gradient"
                        style={{ width: `${Math.min(100, Math.max(3, (data.systemHealth.dbStorageSizeMB / 512) * 100))}%` }}
                      ></div>
                    </div>
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

                  {/* Meter */}
                  <div className="meter-box">
                    <div className="meter-header">
                      <span>CPU Core Capacity</span>
                      <span className="meter-pct text-blue">{data.systemHealth.cpuCores} Cores Available</span>
                    </div>
                    <div className="meter-track">
                      <div className="meter-fill blue-gradient" style={{ width: "100%" }}></div>
                    </div>
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

                  {/* Meter */}
                  <div className="meter-box">
                    <div className="meter-header">
                      <span>Node Heap Allocation</span>
                      <span className="meter-pct text-cyan">
                        {Math.round((data.systemHealth.memoryUsed / (data.systemHealth.memoryTotal || 1)) * 100)}% Used
                      </span>
                    </div>
                    <div className="meter-track">
                      <div
                        className="meter-fill cyan-gradient"
                        style={{
                          width: `${Math.min(100, Math.max(5, (data.systemHealth.memoryUsed / (data.systemHealth.memoryTotal || 1)) * 100))}%`,
                        }}
                      ></div>
                    </div>
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

                  <div className="meter-box">
                    <div className="meter-header">
                      <span>Server Stability</span>
                      <span className="meter-pct text-green">100% Operational</span>
                    </div>
                    <div className="meter-track">
                      <div className="meter-fill green-gradient" style={{ width: "100%" }}></div>
                    </div>
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

                  <div className="meter-box">
                    <div className="meter-header">
                      <span>Telemetry Collector</span>
                      <span className="meter-pct text-green">Active & Logging</span>
                    </div>
                    <div className="meter-track">
                      <div className="meter-fill green-gradient" style={{ width: "100%" }}></div>
                    </div>
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

                      {/* Meter */}
                      <div className="meter-box">
                        <div className="meter-header">
                          <span>R2 10 GB Free Tier Usage</span>
                          <span className="meter-pct text-amber">
                            {data.systemHealth.r2.freeTierUsedPct}% of 10 GB
                          </span>
                        </div>
                        <div className="meter-track">
                          <div
                            className="meter-fill amber-gradient"
                            style={{
                              width: `${Math.min(100, Math.max(3, data.systemHealth.r2.freeTierUsedPct))}%`,
                            }}
                          ></div>
                        </div>
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
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2.5rem;
          border-bottom: 1px solid var(--admin-border, rgba(255, 255, 255, 0.05));
          padding-bottom: 1.5rem;
        }

        .header-meta h1 {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--admin-text-primary, #ffffff);
          margin-bottom: 0.25rem;
        }

        .header-meta p {
          color: var(--admin-text-secondary, #9ca3af);
          font-size: 0.9rem;
        }

        .header-actions {
          display: flex;
          gap: 0.75rem;
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
          background-color: var(--admin-card-bg, #0d131f);
          border: 1px solid var(--admin-border, rgba(255, 255, 255, 0.08));
          border-radius: 16px;
          padding: 1.5rem;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
          position: relative;
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
        }

        .kpi-card:hover {
          transform: translateY(-3px);
          border-color: rgba(0, 200, 150, 0.35);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
        }

        .kpi-title {
          font-size: 0.8rem;
          color: var(--admin-text-secondary, #9ca3af);
          font-weight: 700;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
          text-align: center;
        }

        .kpi-value {
          font-size: 2.1rem;
          font-weight: 800;
          color: var(--admin-text-primary, #ffffff);
          line-height: 1.1;
          margin-bottom: 0.5rem;
          text-align: center;
        }

        .kpi-value .unit {
          font-size: 1rem;
          color: var(--admin-text-secondary, #9ca3af);
          font-weight: 400;
        }

        .kpi-footer {
          font-size: 0.8rem;
          color: var(--admin-text-secondary, #9ca3af);
          text-align: center;
        }

        .text-green { color: #4ade80; }
        .text-blue { color: #60a5fa; }
        .text-cyan { color: #22d3ee; }
        .text-amber { color: #fbbf24; }
        .text-red { color: #ff6b6b; }
        .font-bold { font-weight: 700; }

        .kpi-status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          font-size: 0.75rem;
          font-weight: 800;
          padding: 0.3rem 0.75rem;
          border-radius: 999px;
          border: 1px solid transparent;
          margin: 0 auto;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .kpi-status-badge.online {
          background-color: rgba(34, 197, 94, 0.22);
          color: #4ade80;
          border-color: rgba(74, 222, 128, 0.6);
          box-shadow: 0 0 12px rgba(74, 222, 128, 0.35);
        }

        .kpi-status-badge.offline {
          background-color: rgba(239, 68, 68, 0.25);
          color: #ff6b6b;
          border-color: rgba(255, 107, 107, 0.65);
          box-shadow: 0 0 12px rgba(255, 107, 107, 0.4);
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
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--admin-border, rgba(255, 255, 255, 0.08));
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

        /* Meter Progress Bars */
        .meter-box {
          margin-top: 1rem;
          padding-top: 0.75rem;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .meter-header {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          font-weight: 600;
          color: #9ca3af;
          margin-bottom: 0.4rem;
        }

        .meter-track {
          height: 8px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          overflow: hidden;
        }

        .meter-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.5s ease;
        }

        .green-gradient { background: linear-gradient(90deg, #10b981, #059669); }
        .blue-gradient { background: linear-gradient(90deg, #3b82f6, #2563eb); }
        .cyan-gradient { background: linear-gradient(90deg, #06b6d4, #0891b2); }
        .amber-gradient { background: linear-gradient(90deg, #f59e0b, #d97706); }

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
