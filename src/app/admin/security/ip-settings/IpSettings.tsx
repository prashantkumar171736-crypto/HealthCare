"use client";

import { useEffect, useState, type FormEvent } from "react";

interface IpBlock {
  id: string;
  ip: string;
  fingerprint: string;
  country: string;
  failedAttempts: number;
  status: "blocked" | "expired" | "unblocked";
  blockedAt: string;
  expiresAt: string;
}

interface IpListResponse {
  items: IpBlock[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface IpSettings {
  maxFailedAttempts: number;
  attemptWindowMinutes: number;
  blockDurationMinutes: number;
}

interface Filters {
  ip: string;
  fingerprint: string;
  country: string;
  status: string;
  attemptsMin: string;
  attemptsMax: string;
  blockedFrom: string;
  blockedTo: string;
  expiresFrom: string;
  expiresTo: string;
}

const EMPTY_FILTERS: Filters = {
  ip: "",
  fingerprint: "",
  country: "",
  status: "all",
  attemptsMin: "",
  attemptsMax: "",
  blockedFrom: "",
  blockedTo: "",
  expiresFrom: "",
  expiresTo: "",
};

const DEFAULT_SETTINGS: IpSettings = {
  maxFailedAttempts: 5,
  attemptWindowMinutes: 15,
  blockDurationMinutes: 1440,
};

const BLOCK_DURATIONS = [1440, 10080, 21600, 43200];

function makeQuery(page: number, pageSize: number, quickQuery: string, filters: Filters): string {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (quickQuery) params.set("q", quickQuery);
  for (const [key, value] of Object.entries(filters)) {
    if (value && !(key === "status" && value === "all")) params.set(key, value);
  }
  return params.toString();
}

function pageItems(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 3) return [1, 2, 3, 4, "ellipsis", total];
  if (current >= total - 2) return [1, "ellipsis", total - 3, total - 2, total - 1, total];
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total];
}

export default function IpSettings() {
  const [result, setResult] = useState<IpListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [quickInput, setQuickInput] = useState("");
  const [quickQuery, setQuickQuery] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [ipSettings, setIpSettings] = useState<IpSettings | null>(null);
  const [draftSettings, setDraftSettings] = useState<IpSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuickQuery(quickInput.trim());
      setPage(1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [quickInput]);

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/security/ip-list?${makeQuery(page, pageSize, quickQuery, appliedFilters)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load IP block history.");
        if (active) {
          setResult(data);
          setPage(data.page);
          setError("");
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load IP block history.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [page, pageSize, quickQuery, appliedFilters, reload]);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/security-settings", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load IP settings.");
        if (active) {
          setIpSettings(data);
          setDraftSettings(data);
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load IP settings.");
      });
    return () => { active = false; };
  }, []);

  function applyQuickSearch() {
    setQuickQuery(quickInput.trim());
    setPage(1);
  }

  function resetSearch() {
    setQuickInput("");
    setQuickQuery("");
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPageSize(100);
    setPage(1);
  }

  function exportResults() {
    const params = new URLSearchParams(makeQuery(page, pageSize, quickQuery, appliedFilters));
    params.set("format", "csv");
    window.location.assign(`/api/admin/security/ip-list?${params.toString()}`);
  }

  function applyAdvancedSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters({ ...draftFilters });
    setPage(1);
  }

  async function unblock(block: IpBlock) {
    if (!window.confirm(`Unblock ${block.ip} and reset its failed-login counter?`)) return;
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/security/blocks?id=${encodeURIComponent(block.id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to unblock this network.");
      setMessage("Network unblocked; its failed-login counter was reset.");
      setReload((value) => value + 1);
    } catch (unblockError) {
      setError(unblockError instanceof Error ? unblockError.message : "Unable to unblock this network.");
    }
  }

  async function saveIpSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/security-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftSettings),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save IP settings.");
      setIpSettings(draftSettings);
      setSettingsOpen(false);
      setMessage("IP settings saved. New settings apply to future blocks.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save IP settings.");
    } finally {
      setSaving(false);
    }
  }

  const totalPages = result?.totalPages || 0;
  const firstRow = result && result.total > 0 ? (result.page - 1) * result.pageSize + 1 : 0;
  const lastRow = result ? Math.min(result.page * result.pageSize, result.total) : 0;

  return (
    <section className="security-panel">
      <h2 className="security-title">IP Settings</h2>
      <p className="security-note">Blocks use keyed IP fingerprints. IP addresses are shown to admins only and deleted after 90 days. Older records may not include an IP address.</p>

      <div className="security-toolbar">
        <div className="security-toolbar-group">
          <button
            className="security-button"
            type="button"
            aria-label={quickSearchOpen ? "Close quick search" : "Open quick search"}
            title={quickSearchOpen ? "Close quick search" : "Quick search"}
            onClick={() => setQuickSearchOpen((open) => !open)}
          >
            ⌕
          </button>
          {quickSearchOpen && (
            <input
              className="security-search"
              type="search"
              aria-label="Search IP address, fingerprint, or country"
              placeholder="Search IP, fingerprint, country"
              value={quickInput}
              onChange={(event) => setQuickInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") applyQuickSearch(); }}
            />
          )}
          <button className="security-button" type="button" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((open) => !open)}>
            Advanced Search
          </button>
          <button className="security-button" type="button" onClick={resetSearch}>Reset</button>
          <button className="security-button" type="button" onClick={exportResults}>Export Excel (.csv)</button>
        </div>
        <button
          className="security-button"
          type="button"
          aria-label="IP blocking settings"
          title="IP blocking settings"
          onClick={() => setSettingsOpen((open) => !open)}
        >
          ⚙
        </button>
      </div>

      {advancedOpen && (
        <form className="security-filters" onSubmit={applyAdvancedSearch}>
          <label className="security-field">IP address<input value={draftFilters.ip} onChange={(event) => setDraftFilters({ ...draftFilters, ip: event.target.value })} /></label>
          <label className="security-field">Fingerprint<input value={draftFilters.fingerprint} onChange={(event) => setDraftFilters({ ...draftFilters, fingerprint: event.target.value })} /></label>
          <label className="security-field">Country<input value={draftFilters.country} onChange={(event) => setDraftFilters({ ...draftFilters, country: event.target.value })} /></label>
          <label className="security-field">Status
            <select value={draftFilters.status} onChange={(event) => setDraftFilters({ ...draftFilters, status: event.target.value })}>
              <option value="all">All</option><option value="blocked">Blocked</option><option value="expired">Expired</option><option value="unblocked">Unblocked</option>
            </select>
          </label>
          <label className="security-field">Failed attempts from<input type="number" min={0} step={1} value={draftFilters.attemptsMin} onChange={(event) => setDraftFilters({ ...draftFilters, attemptsMin: event.target.value })} /></label>
          <label className="security-field">Failed attempts to<input type="number" min={0} step={1} value={draftFilters.attemptsMax} onChange={(event) => setDraftFilters({ ...draftFilters, attemptsMax: event.target.value })} /></label>
          <label className="security-field">Blocked from<input type="date" value={draftFilters.blockedFrom} onChange={(event) => setDraftFilters({ ...draftFilters, blockedFrom: event.target.value })} /></label>
          <label className="security-field">Blocked to<input type="date" value={draftFilters.blockedTo} onChange={(event) => setDraftFilters({ ...draftFilters, blockedTo: event.target.value })} /></label>
          <label className="security-field">Blocked until from<input type="date" value={draftFilters.expiresFrom} onChange={(event) => setDraftFilters({ ...draftFilters, expiresFrom: event.target.value })} /></label>
          <label className="security-field">Blocked until to<input type="date" value={draftFilters.expiresTo} onChange={(event) => setDraftFilters({ ...draftFilters, expiresTo: event.target.value })} /></label>
          <div className="security-actions"><button className="security-button primary" type="submit">Search</button></div>
        </form>
      )}

      {settingsOpen && (
        <form className="security-config" onSubmit={saveIpSettings}>
          <label className="security-field" title="The number of failed administrator sign-in attempts from the same keyed IP fingerprint that triggers a temporary block.">Max failed attempts<input type="number" min={3} max={20} step={1} required value={draftSettings.maxFailedAttempts} onChange={(event) => setDraftSettings({ ...draftSettings, maxFailedAttempts: Number(event.target.value) })} /></label>
          <label className="security-field" title="The rolling time window used to count failed sign-in attempts. Attempts older than this window are not included when deciding whether to block the IP.">Attempt window (minutes)<input type="number" min={1} max={120} step={1} required value={draftSettings.attemptWindowMinutes} onChange={(event) => setDraftSettings({ ...draftSettings, attemptWindowMinutes: Number(event.target.value) })} /></label>
          <label className="security-field" title="How long a fingerprint that reaches the failed-attempt limit is prevented from signing in. This setting affects new blocks only.">Block duration
            <select required value={draftSettings.blockDurationMinutes} onChange={(event) => setDraftSettings({ ...draftSettings, blockDurationMinutes: Number(event.target.value) })}>
              {draftSettings.blockDurationMinutes !== 30 && !BLOCK_DURATIONS.includes(draftSettings.blockDurationMinutes) && <option value={draftSettings.blockDurationMinutes}>{draftSettings.blockDurationMinutes} minutes (current setting)</option>}
              <option value={1440}>1 day (24 Hours)</option>
              <option value={10080}>7 Days</option>
              <option value={21600}>15 Days</option>
              <option value={43200}>30 Days</option>
            </select>
          </label>
          <p className="security-note">New settings apply only to future blocks.</p>
          <div className="security-actions security-actions-centered">
            <button className="security-button primary" type="submit" disabled={saving || !ipSettings}>{saving ? "Saving..." : "Save"}</button>
            <button className="security-button" type="button" disabled={saving} onClick={() => setDraftSettings(DEFAULT_SETTINGS)}>Reset to defaults (5 / 15 / 1 day)</button>
          </div>
        </form>
      )}

      {error && <p className="security-feedback error" role="alert">{error}</p>}
      {message && <p className="security-feedback" role="status">{message}</p>}

      <div className="security-table-wrap">
        <table className="security-table">
          <thead><tr>
            <th scope="col">IP address</th><th scope="col">Fingerprint</th><th scope="col">Country</th>
            <th scope="col">Failed attempts</th><th scope="col">Blocked until</th><th scope="col">Status</th><th scope="col">Action</th>
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={7}>Loading IP history...</td></tr>}
            {!loading && result?.items.length === 0 && <tr><td colSpan={7}>No matching records.</td></tr>}
            {!loading && result?.items.map((block) => (
              <tr key={block.id} className={block.status === "expired" ? "expired" : ""}>
                <td>{block.ip}</td>
                <td><code>{block.fingerprint}</code></td>
                <td>{block.country}</td>
                <td>{block.failedAttempts}</td>
                <td>{new Date(block.expiresAt).toLocaleString()}</td>
                <td><span className={`security-status ${block.status}`}>{block.status}</span></td>
                <td>{block.status === "blocked" ? <button className="security-button" type="button" onClick={() => void unblock(block)}>Unblock</button> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="security-pagination">
        <label className="security-toolbar-group">Rows per page
          <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
            {[100, 250, 500, 1000].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <div className="security-page-numbers" aria-label="IP history pages">
          <button className="security-page-button" type="button" aria-label="Previous page" disabled={!result || result.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>‹</button>
          {pageItems(result?.page || 1, totalPages).map((item, index) => item === "ellipsis"
            ? <span key={`ellipsis-${index}`} aria-hidden="true">…</span>
            : <button key={item} className={`security-page-button ${result?.page === item ? "active" : ""}`} type="button" aria-current={result?.page === item ? "page" : undefined} onClick={() => setPage(item)}>{item}</button>)}
          <button className="security-page-button" type="button" aria-label="Next page" disabled={!result || result.page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>›</button>
        </div>
        <span>Showing {firstRow}–{lastRow} of {result?.total ?? 0}</span>
      </footer>
    </section>
  );
}