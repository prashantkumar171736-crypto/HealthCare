"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PostEditor from "./PostEditor";
import DonationSettings from "./DonationSettings";

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

export default function DashboardClient() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clearing, setClearing] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "logs" | "system" | "posts" | "donation">("overview");
  const router = useRouter();

  const fetchStats = async () => {
    try {
      setError("");
      const res = await fetch("/api/admin/stats");
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

  useEffect(() => {
    fetchStats();
    // Auto refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <button onClick={fetchStats} className="btn-retry">Retry Connection</button>
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
  const maxViews = Math.max(...dailyViews.map((d) => d.views), 10);
  const chartWidth = 600;
  const chartHeight = 220;
  const paddingX = 40;
  const paddingY = 30;

  const points = dailyViews.map((d, i) => {
    const x = paddingX + (i * (chartWidth - paddingX * 2)) / (dailyViews.length - 1);
    const y = chartHeight - paddingY - (d.views / maxViews) * (chartHeight - paddingY * 2);
    return { x, y, val: d.views, date: d.date };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = points.length > 0 
    ? `${linePath} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`
    : "";

  return (
    <div className="admin-dashboard-root">
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
        </nav>

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
            <button onClick={fetchStats} className="btn-refresh">
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
            {/* SVG Line Graph */}
            <div className="panel-card chart-panel">
              <h2 className="panel-title">Visitor Frequency (Last 7 Days)</h2>
              <div className="svg-container">
                <svg width="100%" height="220" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(0, 200, 150, 0.4)" />
                      <stop offset="100%" stopColor="rgba(0, 200, 150, 0.0)" />
                    </linearGradient>
                  </defs>
                  {/* Grid Lines */}
                  <line x1={paddingX} y1={paddingY} x2={chartWidth - paddingX} y2={paddingY} stroke="rgba(255,255,255,0.05)" />
                  <line x1={paddingX} y1={chartHeight - paddingY} x2={chartWidth - paddingX} y2={chartHeight - paddingY} stroke="rgba(255,255,255,0.1)" />
                  <line x1={paddingX} y1={(chartHeight) / 2} x2={chartWidth - paddingX} y2={(chartHeight) / 2} stroke="rgba(255,255,255,0.05)" />

                  {/* Gradient Area Fill */}
                  {areaPath && <path d={areaPath} fill="url(#chartGrad)" />}

                  {/* Drawing Line */}
                  {linePath && <path d={linePath} fill="none" stroke="#00c896" strokeWidth="3" strokeLinecap="round" />}

                  {/* Data Points */}
                  {points.map((p, idx) => (
                    <g key={idx} className="chart-dot-group">
                      <circle cx={p.x} cy={p.y} r="5" fill="#030712" stroke="#00c896" strokeWidth="2.5" />
                      <text x={p.x} y={p.y - 10} textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">
                        {p.val}
                      </text>
                      <text x={p.x} y={chartHeight - 10} textAnchor="middle" fill="#9ca3af" fontSize="9">
                        {p.date.substring(5)}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            {/* Top Visited Pages (Progress List) */}
            <div className="panel-card progress-panel">
              <h2 className="panel-title">Top Visited Pages</h2>
              <div className="progress-list">
                {data.charts.topPages.length > 0 ? (
                  data.charts.topPages.map((page, idx) => {
                    const maxCount = Math.max(...data.charts.topPages.map((p) => p.count), 1);
                    const pct = Math.round((page.count / maxCount) * 100);
                    return (
                      <div key={idx} className="progress-row">
                        <div className="progress-label">
                          <span className="rank">#{idx + 1}</span> {page.path}
                        </div>
                        <div className="progress-bar-wrapper">
                          <div className="progress-bar" style={{ width: `${pct}%` }}></div>
                          <span className="count-label">{page.count} views</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="no-data">No traffic logged yet.</p>
                )}
              </div>
            </div>

            {/* Top Geolocations */}
            <div className="panel-card geo-panel">
              <h2 className="panel-title">Top Country & State Geolocations</h2>
              <div className="table-wrapper">
                <table className="mini-table">
                  <thead>
                    <tr>
                      <th>State / Region</th>
                      <th>Country</th>
                      <th align="right">Visits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.charts.topRegions.length > 0 ? (
                      data.charts.topRegions.map((reg, idx) => (
                        <tr key={idx}>
                          <td>{reg.region === "Unknown" ? "Generic Area" : reg.region}</td>
                          <td>
                            {reg.country === "Localhost" ? "🖥️ Localhost" : reg.country}
                          </td>
                          <td align="right" className="text-green font-bold">
                            {reg.count}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} align="center">No locations logged.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
      </main>

      <style jsx global>{`
        /* Global CSS Rules for Dashboard UI */
        .admin-dashboard-root {
          display: flex;
          min-height: 90vh;
          background-color: #030712;
          color: #f3f4f6;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .admin-sidebar {
          width: 260px;
          background-color: #0b0f19;
          border-right: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          flex-direction: column;
          padding: 2rem 1.5rem;
        }

        .sidebar-brand {
          font-size: 1.5rem;
          font-weight: 700;
          color: #ffffff;
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
          color: #9ca3af;
          text-align: left;
          padding: 0.75rem 1rem;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .nav-item:hover, .nav-item.active {
          color: #ffffff;
          background-color: rgba(255, 255, 255, 0.05);
        }

        .nav-item.active {
          border-left: 3px solid #00c896;
          border-top-left-radius: 0;
          border-bottom-left-radius: 0;
          padding-left: calc(1rem - 3px);
        }

        .sidebar-footer {
          margin-top: auto;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
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
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 1.5rem;
        }

        .header-meta h1 {
          font-size: 1.75rem;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 0.25rem;
        }

        .header-meta p {
          color: #9ca3af;
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
          border: none;
        }

        .btn-refresh {
          background-color: #1f2937;
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .btn-refresh:hover {
          background-color: #374151;
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
          background-color: #0b0f19;
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 1.5rem;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          position: relative;
        }

        .kpi-title {
          font-size: 0.75rem;
          color: #9ca3af;
          font-weight: 700;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
        }

        .kpi-value {
          font-size: 2rem;
          font-weight: 800;
          color: #ffffff;
          line-height: 1;
          margin-bottom: 0.5rem;
        }

        .kpi-value .unit {
          font-size: 1rem;
          color: #9ca3af;
          font-weight: 400;
        }

        .kpi-footer {
          font-size: 0.8rem;
          color: #9ca3af;
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
          background-color: #0b0f19;
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 1.75rem;
        }

        .panel-title {
          font-size: 1.1rem;
          font-weight: 700;
          margin-bottom: 1.25rem;
          color: #ffffff;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          padding-bottom: 0.5rem;
        }

        .chart-panel {
          grid-column: span 2;
        }

        .svg-container {
          margin-top: 1rem;
        }

        .chart-dot-group circle {
          transition: r 0.15s;
          cursor: pointer;
        }

        .chart-dot-group:hover circle {
          r: 7;
          fill: #00c896;
        }

        /* Progress List (Top Pages) */
        .progress-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .progress-row {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .progress-label {
          font-size: 0.85rem;
          color: #e5e7eb;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .progress-label .rank {
          color: #9ca3af;
          font-weight: bold;
          margin-right: 0.3rem;
        }

        .progress-bar-wrapper {
          display: flex;
          align-items: center;
          gap: 1rem;
          height: 18px;
        }

        .progress-bar {
          height: 8px;
          background: linear-gradient(90deg, #00c896 0%, #10b981 100%);
          border-radius: 4px;
          transition: width 0.5s ease;
        }

        .count-label {
          font-size: 0.75rem;
          color: #9ca3af;
          white-space: nowrap;
        }

        .no-data {
          color: #9ca3af;
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
          border-bottom: 1px solid rgba(255,255,255,0.05);
          color: #9ca3af;
          font-weight: 600;
        }

        .mini-table tr:not(:last-child) td {
          border-bottom: 1px solid rgba(255,255,255,0.02);
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
          color: #ffffff;
        }

        .progress-value .sub {
          font-size: 0.7rem;
          color: #9ca3af;
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
          stroke: rgba(255,255,255,0.05);
        }

        .fill-circle {
          stroke: #00c896;
          stroke-dasharray: 377;
          transition: stroke-dashoffset 0.6s ease;
          stroke-linecap: round;
        }

        .status-legend {
          font-size: 0.85rem;
          color: #9ca3af;
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
          background-color: #0b0f19;
          padding: 0.75rem 1rem;
          color: #9ca3af;
          font-weight: 600;
          border-bottom: 2px solid rgba(255,255,255,0.05);
          z-index: 10;
        }

        .main-table td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          vertical-align: middle;
        }

        .main-table tr:hover td {
          background-color: rgba(255, 255, 255, 0.02);
        }

        .time-col { white-space: nowrap; }
        .date-sub { font-size: 0.7rem; color: #9ca3af; }
        .ip-col { color: #f3f4f6; }
        .state-sub { font-size: 0.75rem; color: #9ca3af; }
        .path-col { word-break: break-all; }
        .ref-col { word-break: break-all; color: #9ca3af; }
        .ua-col { color: #9ca3af; }

        /* System settings panel grid */
        .system-health-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          margin-top: 1rem;
        }

        .health-box {
          background-color: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 1.5rem;
        }

        .health-box h3 {
          font-size: 1.05rem;
          color: #ffffff;
          margin-bottom: 1rem;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          padding-bottom: 0.5rem;
        }

        .health-box p {
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
          color: #d1d5db;
        }

        .health-box code {
          background-color: rgba(0,0,0,0.3);
          padding: 0.1rem 0.4rem;
          border-radius: 4px;
          color: #00c896;
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
      `}</style>
    </div>
  );
}
