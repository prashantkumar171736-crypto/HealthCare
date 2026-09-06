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

interface SystemHealth {
  dbStatus: string;
  dbPingTime: number;
  serverUptime: number;
  memoryUsed: number;
  memoryTotal: number;
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
  const [activeTab, setActiveTab] = useState<"overview" | "logs" | "system" | "posts" | "donation" | "comments" | "appearance">("overview");
  const [theme, setTheme] = useState<AdminTheme>(DEFAULT_THEME);
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

  const fetchStats = async (period: string = chartPeriod) => {
    try {
      setError("");
      const res = await fetch(`/api/admin/stats?period=${period}`);
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
    fetchStats(chartPeriod);
    const interval = setInterval(() => fetchStats(chartPeriod), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartPeriod]);

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
    return { x, y, val: d.views, date: d.date };
  });

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
                <svg width="100%" height="260" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
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
                    return (
                      <g key={idx} className="chart-dot-group">
                        {/* Outer glow ring */}
                        <circle cx={p.x} cy={p.y} r={totalPoints > 15 ? 5 : 7} fill={color} opacity="0.18" />
                        {/* Main dot */}
                        <circle cx={p.x} cy={p.y} r={totalPoints > 15 ? 3 : 4.5} fill="#060d18" stroke={color} strokeWidth="2" filter="url(#dotGlow)" />
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

            {/* Top Visited Pages — Premium Multi-Color */}
            <div className="panel-card progress-panel">
              <h2 className="panel-title">🏆 Top Visited Pages</h2>
              <div className="progress-list">
                {data.charts.topPages.length > 0 ? (
                  (() => {
                    const maxCount = Math.max(...data.charts.topPages.map((p) => p.count), 1);
                    return data.charts.topPages.map((page, idx) => {
                      const pct = Math.round((page.count / maxCount) * 100);
                      const [c1, c2] = BAR_GRADIENTS[idx % BAR_GRADIENTS.length];
                      const rankLabels = ["🥇", "🥈", "🥉"];
                      return (
                        <div key={idx} className="progress-row-v2">
                          <div className="prv2-top">
                            <div className="prv2-rank-badge" style={{ background: c1 + "22", color: c1, border: `1px solid ${c1}44` }}>
                              {idx < 3 ? rankLabels[idx] : `#${idx + 1}`}
                            </div>
                            <span className="prv2-path">{page.path}</span>
                            <span className="prv2-count" style={{ color: c1 }}>{page.count.toLocaleString()} views</span>
                          </div>
                          <div className="prv2-bar-track">
                            <div
                              className="prv2-bar-fill"
                              style={{
                                width: `${pct}%`,
                                background: `linear-gradient(90deg, ${c1}, ${c2})`,
                                boxShadow: `0 0 8px ${c1}55`,
                              }}
                            />
                            <span className="prv2-pct" style={{ color: c1 }}>{pct}%</span>
                          </div>
                        </div>
                      );
                    });
                  })()
                ) : (
                  <div className="no-data-box">
                    <span style={{ fontSize: "2rem" }}>📭</span>
                    <p>No traffic logged yet.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Top Geolocations — Premium Card Style */}
            <div className="panel-card geo-panel">
              <h2 className="panel-title">🌍 Top Country &amp; State Geolocations</h2>
              <div className="geo-cards-list">
                {data.charts.topRegions.length > 0 ? (() => {
                  const geoMax = Math.max(...data.charts.topRegions.map(r => r.count), 1);
                  return data.charts.topRegions.map((reg, idx) => {
                    const gc = GEO_COLORS[idx % GEO_COLORS.length];
                    const geoPct = Math.round((reg.count / geoMax) * 100);
                    return (
                      <div
                        key={idx}
                        className="geo-card"
                        style={{ background: gc.bg, borderColor: gc.border }}
                      >
                        <div className="geo-card-left">
                          <span className="geo-rank-badge" style={{ background: gc.badge, color: gc.text }}>
                            #{idx + 1}
                          </span>
                          <div className="geo-info">
                            <div className="geo-region" style={{ color: "var(--admin-text-primary, #fff)" }}>
                              {reg.region === "Unknown" ? "📍 Generic Area" : `📍 ${reg.region}`}
                            </div>
                            <div className="geo-country" style={{ color: gc.text }}>
                              {reg.country === "Localhost" ? "🖥️ Localhost" : `🌐 ${reg.country}`}
                            </div>
                          </div>
                        </div>
                        <div className="geo-card-right">
                          <div className="geo-visits" style={{ color: gc.text }}>{reg.count.toLocaleString()}</div>
                          <div className="geo-mini-bar-track">
                            <div className="geo-mini-bar-fill" style={{ width: `${geoPct}%`, background: gc.text }} />
                          </div>
                        </div>
                      </div>
                    );
                  });
                })() : (
                  <div className="no-data-box">
                    <span style={{ fontSize: "2rem" }}>🗺️</span>
                    <p>No locations logged.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Server Performance monitor */}
            <div className="panel-card system-perf-panel">
              <h2 className="panel-title">GUI Server Memory Status</h2>
              <div className="circular-progress-container">
                <div className="circular-progress">
                  <div className="progress-value">
                    <span className="number">{data.systemHealth.memoryUsed}</span>
                    <span className="sub">MB Used</span>
                  </div>
                  <svg className="circular-svg">
                    <circle cx="70" cy="70" r="60" className="bg-circle" />
                    <circle
                      cx="70"
                      cy="70"
                      r="60"
                      className="fill-circle"
                      style={{
                        strokeDashoffset:
                          377 -
                          (377 *
                            Math.min(
                              data.systemHealth.memoryUsed /
                                (data.systemHealth.memoryTotal || 512),
                              1
                            ))
                      }}
                    />
                  </svg>
                </div>
                <div className="status-legend">
                  <p>
                    <strong>Allocated Heap:</strong> {data.systemHealth.memoryTotal} MB
                  </p>
                  <p>
                    <strong>Node.js Process:</strong> Online & Reachable
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "logs" && (
          <div className="panel-card full-panel">
            <h2 className="panel-title">Live Server Request Log (Latest 50 Visits)</h2>
            <div className="table-wrapper main-table-wrapper">
              <table className="main-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>IP Address</th>
                    <th>Country / State</th>
                    <th>Visited Path</th>
                    <th>Referrer Source</th>
                    <th>User Agent Details</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.length > 0 ? (
                    data.logs.map((log) => (
                      <tr key={log.id}>
                        <td className="time-col">
                          {new Date(log.timestamp).toLocaleTimeString()}<br />
                          <span className="date-sub">{new Date(log.timestamp).toLocaleDateString()}</span>
                        </td>
                        <td className="ip-col font-mono">{log.ip}</td>
                        <td className="geo-col">
                          <strong>{log.country}</strong><br />
                          <span className="state-sub">{log.region} · {log.city}</span>
                        </td>
                        <td className="path-col font-mono text-green">{log.path}</td>
                        <td className="ref-col">{log.referrer}</td>
                        <td className="ua-col" title={log.userAgent}>{log.userAgent.substring(0, 45)}...</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} align="center">No request logs in DB. Go browse the website to populate statistics.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "system" && (
          <div className="panel-card full-panel system-settings-panel">
            <h2 className="panel-title">System Health & API Reachability</h2>
            <div className="system-health-grid">
              <div className="health-box">
                <h3>MongoDB Infrastructure</h3>
                <p>Status: <span className="status-pill online">ONLINE</span></p>
                <p>Latency Ping: <strong>{data.systemHealth.dbPingTime} ms</strong></p>
                <p>Database: <code>healthcare</code></p>
              </div>
              <div className="health-box">
                <h3>Server Environment</h3>
                <p>Node version: <code>{data.systemHealth.nodeVersion || "N/A"}</code></p>
                <p>Server Uptime: <code>{Math.round(data.systemHealth.serverUptime || 0)}s</code></p>
                <p>Platform Host: <code>{data.systemHealth.platform || "N/A"}</code></p>
              </div>
              <div className="health-box">
                <h3>Client Reachability Tracker</h3>
                <p>API Endpoint: <code>/api/track</code></p>
                <p>Collector Script: Active in Root Layout</p>
                <p>Client Local Time: {new Date().toLocaleTimeString()}</p>
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

        /* KPI Layout */
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2.5rem;
        }

        .kpi-card {
          background-color: var(--admin-card-bg, #0b0f19);
          border: 1px solid var(--admin-border, rgba(255, 255, 255, 0.05));
          border-radius: 12px;
          padding: 1.5rem;
          box-shadow: var(--admin-card-shadow, 0 4px 6px -1px rgba(0, 0, 0, 0.1));
          position: relative;
        }

        .kpi-title {
          font-size: 0.75rem;
          color: var(--admin-text-secondary, #9ca3af);
          font-weight: 700;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
        }

        .kpi-value {
          font-size: 2rem;
          font-weight: 800;
          color: var(--admin-text-primary, #ffffff);
          line-height: 1;
          margin-bottom: 0.5rem;
        }

        .kpi-value .unit {
          font-size: 1rem;
          color: var(--admin-text-secondary, #9ca3af);
          font-weight: 400;
        }

        .kpi-footer {
          font-size: 0.8rem;
          color: var(--admin-text-secondary, #9ca3af);
        }

        .text-green { color: #10b981; }
        .text-blue { color: #3b82f6; }
        .font-bold { font-weight: 700; }

        .kpi-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.8rem;
          font-weight: 600;
          padding: 0.2rem 0.6rem;
          border-radius: 999px;
          border: 1px solid transparent;
        }

        .kpi-status-badge.online {
          background-color: rgba(16, 185, 129, 0.1);
          color: #10b981;
          border-color: rgba(16, 185, 129, 0.2);
        }

        .kpi-status-badge.offline {
          background-color: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border-color: rgba(239, 68, 68, 0.2);
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

        /* Progress List V2 (Top Pages) */
        .progress-list {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }

        .progress-row-v2 {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          padding: 0.6rem 0.75rem;
          border-radius: 10px;
          background: var(--admin-hover-bg, rgba(255,255,255,0.02));
          border: 1px solid var(--admin-border, rgba(255,255,255,0.04));
          transition: background 0.2s;
        }
        .progress-row-v2:hover {
          background: var(--admin-border-strong, rgba(255,255,255,0.08));
        }

        .prv2-top {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .prv2-rank-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 32px;
          height: 22px;
          border-radius: 6px;
          font-size: 0.78rem;
          font-weight: 800;
          flex-shrink: 0;
          padding: 0 0.4rem;
        }

        .prv2-path {
          font-size: 0.82rem;
          color: var(--admin-text-primary, #e5e7eb);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
        }

        .prv2-count {
          font-size: 0.78rem;
          font-weight: 700;
          flex-shrink: 0;
        }

        .prv2-bar-track {
          position: relative;
          height: 6px;
          background: rgba(255,255,255,0.06);
          border-radius: 999px;
          overflow: visible;
          display: flex;
          align-items: center;
        }

        .prv2-bar-fill {
          height: 6px;
          border-radius: 999px;
          transition: width 0.7s cubic-bezier(0.4,0,0.2,1);
        }

        .prv2-pct {
          position: absolute;
          right: -2.5rem;
          font-size: 0.7rem;
          font-weight: 700;
        }

        /* Geo Cards */
        .geo-cards-list {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
        }

        .geo-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.65rem 0.85rem;
          border-radius: 10px;
          border: 1px solid;
          transition: filter 0.2s;
        }
        .geo-card:hover {
          filter: brightness(1.15);
        }

        .geo-card-left {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          min-width: 0;
        }

        .geo-rank-badge {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.72rem;
          font-weight: 800;
          flex-shrink: 0;
        }

        .geo-info { min-width: 0; }

        .geo-region {
          font-size: 0.85rem;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .geo-country {
          font-size: 0.75rem;
          font-weight: 600;
          margin-top: 0.1rem;
        }

        .geo-card-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.3rem;
          flex-shrink: 0;
        }

        .geo-visits {
          font-size: 1rem;
          font-weight: 800;
        }

        .geo-mini-bar-track {
          width: 60px;
          height: 4px;
          background: rgba(255,255,255,0.08);
          border-radius: 999px;
          overflow: hidden;
        }

        .geo-mini-bar-fill {
          height: 4px;
          border-radius: 999px;
          transition: width 0.6s ease;
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

        /* Logs Tab Detailed Table */
        .full-panel {
          width: 100%;
        }

        .main-table-wrapper {
          margin-top: 1rem;
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

        /* System settings panel grid */
        .system-health-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          margin-top: 1rem;
        }

        .health-box {
          background-color: var(--admin-hover-bg, rgba(255,255,255,0.02));
          border: 1px solid var(--admin-border, rgba(255,255,255,0.05));
          border-radius: 12px;
          padding: 1.5rem;
        }

        .health-box h3 {
          font-size: 1.05rem;
          color: var(--admin-text-primary, #ffffff);
          margin-bottom: 1rem;
          border-bottom: 1px solid var(--admin-border, rgba(255,255,255,0.05));
          padding-bottom: 0.5rem;
        }

        .health-box p {
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
          color: var(--admin-text-secondary, #d1d5db);
        }

        .health-box code {
          background-color: var(--admin-input-bg, rgba(0,0,0,0.3));
          padding: 0.1rem 0.4rem;
          border-radius: 4px;
          color: var(--admin-accent, #00c896);
          font-family: monospace;
          font-size: 0.85rem;
        }

        .status-pill {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 0.1rem 0.4rem;
          border-radius: 4px;
          color: #ffffff;
        }

        .status-pill.online {
          background-color: #10b981;
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
