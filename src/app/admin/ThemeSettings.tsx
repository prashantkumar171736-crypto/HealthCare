"use client";

import { useEffect, useState, useCallback } from "react";

/* ─────────────────────────────────────────────────────────────
   Types & Constants
───────────────────────────────────────────────────────────── */
export interface AdminTheme {
  bgColor: string;        // main background
  sidebarColor: string;   // sidebar background
  cardColor: string;      // panel/card background
  accentColor: string;    // brand accent (buttons, borders, chart)
  textPrimary: string;    // primary text
  textSecondary: string;  // muted text
  fontFamily: string;     // font-family stack
  fontSize: number;       // base rem-px (14–18)
  autoAdjust: boolean;    // auto-compute text colors from backgrounds
}

export const DEFAULT_THEME: AdminTheme = {
  bgColor: "#030712",
  sidebarColor: "#0b0f19",
  cardColor: "#0b0f19",
  accentColor: "#00c896",
  textPrimary: "#f3f4f6",
  textSecondary: "#9ca3af",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontSize: 15,
  autoAdjust: true,
};

const PRESET_THEMES: { name: string; emoji: string; theme: Partial<AdminTheme> }[] = [
  {
    name: "Midnight (Default)",
    emoji: "🌑",
    theme: {
      bgColor: "#030712", sidebarColor: "#0b0f19", cardColor: "#0b0f19",
      accentColor: "#00c896",
    },
  },
  {
    name: "Deep Navy",
    emoji: "🌊",
    theme: {
      bgColor: "#0a0e1a", sidebarColor: "#0d1526", cardColor: "#111827",
      accentColor: "#3b82f6",
    },
  },
  {
    name: "Obsidian Purple",
    emoji: "🔮",
    theme: {
      bgColor: "#0f0a1e", sidebarColor: "#160d2b", cardColor: "#1a1030",
      accentColor: "#a855f7",
    },
  },
  {
    name: "Crimson Dark",
    emoji: "🔴",
    theme: {
      bgColor: "#110a0a", sidebarColor: "#1a0d0d", cardColor: "#1f1010",
      accentColor: "#ef4444",
    },
  },
  {
    name: "Slate Frost",
    emoji: "🧊",
    theme: {
      bgColor: "#0f172a", sidebarColor: "#1e293b", cardColor: "#1e293b",
      accentColor: "#06b6d4",
    },
  },
  {
    name: "Forest Night",
    emoji: "🌲",
    theme: {
      bgColor: "#071a0f", sidebarColor: "#0d2318", cardColor: "#0f2a1c",
      accentColor: "#22c55e",
    },
  },
  {
    name: "Amber Noir",
    emoji: "🟠",
    theme: {
      bgColor: "#120c00", sidebarColor: "#1c1300", cardColor: "#221800",
      accentColor: "#f59e0b",
    },
  },
  {
    name: "Arctic Light",
    emoji: "☁️",
    theme: {
      bgColor: "#f8fafc", sidebarColor: "#f1f5f9", cardColor: "#ffffff",
      accentColor: "#0ea5e9",
    },
  },
  {
    name: "Warm Ivory",
    emoji: "🪔",
    theme: {
      bgColor: "#faf7f2", sidebarColor: "#f5f0e8", cardColor: "#ffffff",
      accentColor: "#d97706",
    },
  },
  {
    name: "Soft Lavender",
    emoji: "💜",
    theme: {
      bgColor: "#f5f3ff", sidebarColor: "#ede9fe", cardColor: "#ffffff",
      accentColor: "#7c3aed",
    },
  },
];

const FONT_OPTIONS = [
  { label: "System Default", value: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  { label: "Inter", value: "'Inter', system-ui, sans-serif" },
  { label: "Roboto", value: "'Roboto', system-ui, sans-serif" },
  { label: "Outfit", value: "'Outfit', system-ui, sans-serif" },
  { label: "Poppins", value: "'Poppins', system-ui, sans-serif" },
  { label: "DM Sans", value: "'DM Sans', system-ui, sans-serif" },
  { label: "Fira Code (Mono)", value: "'Fira Code', 'Cascadia Code', 'Courier New', monospace" },
  { label: "JetBrains Mono", value: "'JetBrains Mono', monospace" },
];

/* ─────────────────────────────────────────────────────────────
   Color Utilities
───────────────────────────────────────────────────────────── */
function hexToRgb(hex: string): [number, number, number] | null {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6) return null;
  return [
    parseInt(cleaned.slice(0, 2), 16),
    parseInt(cleaned.slice(2, 4), 16),
    parseInt(cleaned.slice(4, 6), 16),
  ];
}

function luminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return 1;
  const L1 = luminance(...rgb1);
  const L2 = luminance(...rgb2);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Given a background hex, return black or white with best contrast. */
function bestTextColor(bg: string): string {
  const withBlack = contrastRatio(bg, "#000000");
  const withWhite = contrastRatio(bg, "#ffffff");
  return withWhite >= withBlack ? "#ffffff" : "#000000";
}

/** Derive a muted version of the best text color. */
function mutedTextColor(bg: string): string {
  const base = bestTextColor(bg);
  return base === "#ffffff" ? "#9ca3af" : "#4b5563";
}

/** Auto-compute text colors based on backgrounds. */
function autoAdjustColors(theme: AdminTheme): Pick<AdminTheme, "textPrimary" | "textSecondary"> {
  // Use bgColor as the dominant surface for text
  return {
    textPrimary: bestTextColor(theme.bgColor),
    textSecondary: mutedTextColor(theme.bgColor),
  };
}

/* ─────────────────────────────────────────────────────────────
   ThemeSettings Component
───────────────────────────────────────────────────────────── */
interface Props {
  theme: AdminTheme;
  onChange: (t: AdminTheme) => void;
}

export default function ThemeSettings({ theme, onChange }: Props) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const update = useCallback((partial: Partial<AdminTheme>) => {
    const next = { ...theme, ...partial };
    if (next.autoAdjust) {
      const adjusted = autoAdjustColors(next);
      onChange({ ...next, ...adjusted });
    } else {
      onChange(next);
    }
  }, [theme, onChange]);

  const applyPreset = (idx: number) => {
    const preset = PRESET_THEMES[idx];
    const next = { ...theme, ...preset.theme };
    if (next.autoAdjust) {
      const adjusted = autoAdjustColors(next);
      onChange({ ...next, ...adjusted });
    } else {
      onChange(next);
    }
  };

  const resetToDefault = () => onChange(DEFAULT_THEME);

  // When autoAdjust is toggled ON, re-derive text colors immediately
  const toggleAutoAdjust = (val: boolean) => {
    const next = { ...theme, autoAdjust: val };
    if (val) {
      const adjusted = autoAdjustColors(next);
      onChange({ ...next, ...adjusted });
    } else {
      onChange(next);
    }
  };

  const bgLum = (() => {
    const rgb = hexToRgb(theme.bgColor);
    return rgb ? luminance(...rgb) : 0;
  })();
  const isDark = bgLum < 0.2;
  const previewContrast = contrastRatio(theme.bgColor, theme.textPrimary).toFixed(1);
  const wcagLevel = parseFloat(previewContrast) >= 7 ? "AAA ✅" : parseFloat(previewContrast) >= 4.5 ? "AA ✅" : "⚠️ Low";

  return (
    <div className="theme-settings-root">

      {/* ── Header ── */}
      <div className="ts-header">
        <div>
          <h2 className="ts-title">🎨 Appearance & Theme</h2>
          <p className="ts-subtitle">Customize the look of your admin panel. Changes are saved automatically.</p>
        </div>
        <button className="ts-reset-btn" onClick={resetToDefault}>↺ Reset to Default</button>
      </div>

      {/* ── Preset Themes ── */}
      <section className="ts-section">
        <h3 className="ts-section-title">Preset Themes</h3>
        <div className="ts-presets-grid">
          {PRESET_THEMES.map((p, i) => (
            <button
              key={i}
              className={`ts-preset-card ${previewIndex === i ? "selected" : ""}`}
              style={{ "--preset-accent": p.theme.accentColor ?? "#00c896", "--preset-bg": p.theme.bgColor ?? "#030712" } as React.CSSProperties}
              onClick={() => { setPreviewIndex(i); applyPreset(i); }}
            >
              <span className="ts-preset-swatch">
                <span className="swatch-bg" style={{ background: p.theme.bgColor ?? "#030712" }} />
                <span className="swatch-sidebar" style={{ background: p.theme.sidebarColor ?? "#0b0f19" }} />
                <span className="swatch-accent" style={{ background: p.theme.accentColor ?? "#00c896" }} />
              </span>
              <span className="ts-preset-emoji">{p.emoji}</span>
              <span className="ts-preset-name">{p.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Custom Colors ── */}
      <section className="ts-section">
        <h3 className="ts-section-title">Custom Colors</h3>
        <div className="ts-color-grid">
          {[
            { label: "Main Background", key: "bgColor" as const, hint: "Page background" },
            { label: "Sidebar Background", key: "sidebarColor" as const, hint: "Left nav panel" },
            { label: "Card / Panel", key: "cardColor" as const, hint: "Stats & content cards" },
            { label: "Accent / Brand", key: "accentColor" as const, hint: "Buttons, borders, chart line" },
          ].map(({ label, key, hint }) => (
            <div className="ts-color-row" key={key}>
              <div className="ts-color-info">
                <label className="ts-color-label" htmlFor={`color-${key}`}>{label}</label>
                <span className="ts-color-hint">{hint}</span>
              </div>
              <div className="ts-color-input-wrap">
                <input
                  id={`color-${key}`}
                  type="color"
                  className="ts-color-input"
                  value={theme[key]}
                  onChange={(e) => update({ [key]: e.target.value })}
                />
                <input
                  type="text"
                  className="ts-hex-input"
                  value={theme[key]}
                  maxLength={7}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) update({ [key]: v });
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Auto-Adjust ── */}
      <section className="ts-section">
        <div className="ts-auto-adjust-card">
          <div className="ts-auto-adjust-left">
            <div className="ts-auto-adjust-title">
              <span className="ts-aa-icon">✨</span>
              Auto-Adjust Text Colors
            </div>
            <p className="ts-auto-adjust-desc">
              Automatically computes the best readable text colors based on your chosen backgrounds
              using WCAG luminance contrast. Turns your manual text color controls off.
            </p>
            <div className="ts-contrast-badge">
              <span>Current contrast ratio: </span>
              <strong style={{ color: parseFloat(previewContrast) >= 4.5 ? "#22c55e" : "#ef4444" }}>
                {previewContrast}:1
              </strong>
              <span className="ts-wcag-level">{wcagLevel}</span>
            </div>
          </div>
          <label className="ts-toggle" htmlFor="auto-adjust-toggle">
            <input
              id="auto-adjust-toggle"
              type="checkbox"
              checked={theme.autoAdjust}
              onChange={(e) => toggleAutoAdjust(e.target.checked)}
            />
            <span className="ts-toggle-track">
              <span className="ts-toggle-thumb" />
            </span>
          </label>
        </div>

        {/* Manual text colors — shown only when autoAdjust is OFF */}
        {!theme.autoAdjust && (
          <div className="ts-manual-text">
            <h4 className="ts-manual-title">Manual Text Colors</h4>
            <div className="ts-color-grid">
              {[
                { label: "Primary Text", key: "textPrimary" as const, hint: "Headings & body" },
                { label: "Secondary / Muted Text", key: "textSecondary" as const, hint: "Labels & hints" },
              ].map(({ label, key, hint }) => (
                <div className="ts-color-row" key={key}>
                  <div className="ts-color-info">
                    <label className="ts-color-label" htmlFor={`color-${key}`}>{label}</label>
                    <span className="ts-color-hint">{hint}</span>
                  </div>
                  <div className="ts-color-input-wrap">
                    <input
                      id={`color-${key}`}
                      type="color"
                      className="ts-color-input"
                      value={theme[key]}
                      onChange={(e) => update({ [key]: e.target.value })}
                    />
                    <input
                      type="text"
                      className="ts-hex-input"
                      value={theme[key]}
                      maxLength={7}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^#[0-9a-fA-F]{0,6}$/.test(v)) update({ [key]: v });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Typography ── */}
      <section className="ts-section">
        <h3 className="ts-section-title">Typography</h3>
        <div className="ts-type-grid">
          <div className="ts-type-field">
            <label className="ts-color-label" htmlFor="font-family-select">Font Family</label>
            <div className="ts-select-wrap">
              <select
                id="font-family-select"
                className="ts-select"
                value={theme.fontFamily}
                onChange={(e) => update({ fontFamily: e.target.value })}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <span className="ts-select-arrow">▾</span>
            </div>
            <span className="ts-color-hint" style={{ fontFamily: theme.fontFamily }}>
              Preview: The quick brown fox jumps over the lazy dog.
            </span>
          </div>
          <div className="ts-type-field">
            <label className="ts-color-label" htmlFor="font-size-range">
              Base Font Size: <strong>{theme.fontSize}px</strong>
            </label>
            <input
              id="font-size-range"
              type="range"
              className="ts-range"
              min={12}
              max={20}
              step={1}
              value={theme.fontSize}
              onChange={(e) => update({ fontSize: parseInt(e.target.value) })}
            />
            <div className="ts-range-labels">
              <span>12px (Small)</span>
              <span>16px</span>
              <span>20px (Large)</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Live Preview Swatch ── */}
      <section className="ts-section">
        <h3 className="ts-section-title">Live Preview</h3>
        <div
          className="ts-preview-box"
          style={{
            background: theme.bgColor,
            fontFamily: theme.fontFamily,
            fontSize: `${theme.fontSize}px`,
          }}
        >
          <div
            className="ts-preview-sidebar"
            style={{ background: theme.sidebarColor }}
          >
            <div style={{ color: theme.accentColor, fontWeight: 700, fontSize: "1.1em" }}>⚕️ HealthEdu</div>
            <div className="ts-preview-nav-item" style={{ color: theme.accentColor, borderLeft: `3px solid ${theme.accentColor}` }}>📊 Dashboard</div>
            <div className="ts-preview-nav-item" style={{ color: theme.textSecondary }}>📋 Logs</div>
            <div className="ts-preview-nav-item" style={{ color: theme.textSecondary }}>⚙️ System</div>
          </div>
          <div className="ts-preview-content">
            <div
              className="ts-preview-card"
              style={{ background: theme.cardColor, border: `1px solid ${theme.accentColor}22` }}
            >
              <div style={{ color: theme.textSecondary, fontSize: "0.75em", fontWeight: 700, letterSpacing: "0.05em" }}>TOTAL VIEWS</div>
              <div style={{ color: theme.textPrimary, fontSize: "2em", fontWeight: 800 }}>1,234</div>
              <div style={{ color: theme.accentColor, fontSize: "0.8em" }}>● All-time record</div>
            </div>
            <div
              className="ts-preview-card"
              style={{ background: theme.cardColor, border: `1px solid ${theme.accentColor}22` }}
            >
              <div style={{ color: theme.textSecondary, fontSize: "0.75em", fontWeight: 700, letterSpacing: "0.05em" }}>VISITORS</div>
              <div style={{ color: theme.textPrimary, fontSize: "2em", fontWeight: 800 }}>567</div>
              <div style={{ color: theme.accentColor, fontSize: "0.8em" }}>● Unique sessions</div>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .theme-settings-root {
          color: var(--admin-text-primary, #f3f4f6);
          font-family: var(--admin-font-family, system-ui, sans-serif);
          font-size: var(--admin-font-size, 15px);
        }

        .ts-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 2rem;
          flex-wrap: wrap;
        }

        .ts-title {
          font-size: 1.4rem;
          font-weight: 800;
          color: var(--admin-text-primary, #f3f4f6);
          margin-bottom: 0.3rem;
        }

        .ts-subtitle {
          color: var(--admin-text-secondary, #9ca3af);
          font-size: 0.88rem;
        }

        .ts-reset-btn {
          padding: 0.55rem 1.1rem;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: var(--admin-text-secondary, #9ca3af);
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
        }
        .ts-reset-btn:hover {
          background: rgba(255,255,255,0.1);
          color: var(--admin-text-primary, #f3f4f6);
        }

        .ts-section {
          margin-bottom: 2.5rem;
        }

        .ts-section-title {
          font-size: 0.8rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--admin-text-secondary, #9ca3af);
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        /* Preset Cards */
        .ts-presets-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 0.75rem;
        }

        .ts-preset-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.4rem;
          padding: 0.85rem 0.5rem;
          border-radius: 12px;
          border: 2px solid transparent;
          background: rgba(255,255,255,0.03);
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.82rem;
        }

        .ts-preset-card:hover {
          border-color: rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.06);
          transform: translateY(-2px);
        }

        .ts-preset-card.selected {
          border-color: var(--admin-accent, #00c896);
          background: rgba(0, 200, 150, 0.06);
        }

        .ts-preset-swatch {
          display: flex;
          width: 60px;
          height: 32px;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.1);
          flex-shrink: 0;
        }
        .swatch-bg { flex: 2; }
        .swatch-sidebar { flex: 1.5; }
        .swatch-accent { flex: 1; }

        .ts-preset-emoji { font-size: 1.1rem; }
        .ts-preset-name {
          color: var(--admin-text-primary, #f3f4f6);
          font-weight: 600;
          text-align: center;
        }

        /* Color Grid */
        .ts-color-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
        }

        .ts-color-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          padding: 0.85rem 1rem;
        }

        .ts-color-info {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .ts-color-label {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--admin-text-primary, #f3f4f6);
        }

        .ts-color-hint {
          font-size: 0.75rem;
          color: var(--admin-text-secondary, #9ca3af);
          margin-top: 0.2rem;
          display: block;
        }

        .ts-color-input-wrap {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        .ts-color-input {
          width: 38px;
          height: 38px;
          border-radius: 8px;
          border: 2px solid rgba(255,255,255,0.1);
          cursor: pointer;
          padding: 0;
          background: none;
          overflow: hidden;
        }
        .ts-color-input::-webkit-color-swatch-wrapper { padding: 0; }
        .ts-color-input::-webkit-color-swatch { border: none; border-radius: 6px; }

        .ts-hex-input {
          width: 88px;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          color: var(--admin-text-primary, #f3f4f6);
          font-family: 'Fira Code', monospace;
          font-size: 0.85rem;
          padding: 0.4rem 0.5rem;
          text-transform: uppercase;
          transition: border-color 0.2s;
        }
        .ts-hex-input:focus {
          outline: none;
          border-color: var(--admin-accent, #00c896);
        }

        /* Auto-Adjust Card */
        .ts-auto-adjust-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1.5rem;
          background: rgba(0, 200, 150, 0.04);
          border: 1px solid rgba(0, 200, 150, 0.2);
          border-radius: 14px;
          padding: 1.25rem 1.5rem;
          flex-wrap: wrap;
        }

        .ts-auto-adjust-left { flex: 1; min-width: 220px; }

        .ts-auto-adjust-title {
          font-size: 1rem;
          font-weight: 700;
          color: var(--admin-text-primary, #f3f4f6);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.4rem;
        }
        .ts-aa-icon { font-size: 1.2rem; }

        .ts-auto-adjust-desc {
          font-size: 0.83rem;
          color: var(--admin-text-secondary, #9ca3af);
          line-height: 1.6;
          margin-bottom: 0.75rem;
        }

        .ts-contrast-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.82rem;
          color: var(--admin-text-secondary, #9ca3af);
          background: rgba(0,0,0,0.25);
          padding: 0.3rem 0.75rem;
          border-radius: 999px;
        }

        .ts-wcag-level {
          font-weight: 700;
          margin-left: 0.25rem;
        }

        /* Toggle Switch */
        .ts-toggle {
          display: flex;
          align-items: center;
          cursor: pointer;
          flex-shrink: 0;
        }

        .ts-toggle input { display: none; }

        .ts-toggle-track {
          width: 52px;
          height: 28px;
          background: rgba(255,255,255,0.1);
          border-radius: 999px;
          position: relative;
          transition: background 0.25s;
          border: 1px solid rgba(255,255,255,0.08);
        }

        .ts-toggle input:checked + .ts-toggle-track {
          background: var(--admin-accent, #00c896);
          border-color: transparent;
        }

        .ts-toggle-thumb {
          position: absolute;
          top: 3px; left: 3px;
          width: 20px; height: 20px;
          background: #ffffff;
          border-radius: 50%;
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }

        .ts-toggle input:checked ~ .ts-toggle-track .ts-toggle-thumb,
        .ts-toggle input:checked + .ts-toggle-track .ts-toggle-thumb {
          transform: translateX(24px);
        }

        .ts-manual-text {
          margin-top: 1rem;
          padding: 1rem;
          background: rgba(255,255,255,0.02);
          border: 1px dashed rgba(255,255,255,0.08);
          border-radius: 10px;
        }

        .ts-manual-title {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--admin-text-secondary, #9ca3af);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 0.75rem;
        }

        /* Typography */
        .ts-type-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }
        @media (max-width: 700px) {
          .ts-type-grid { grid-template-columns: 1fr; }
        }

        .ts-type-field {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .ts-select-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .ts-select {
          width: 100%;
          appearance: none;
          -webkit-appearance: none;
          background: #0f1621;
          color: var(--admin-text-primary, #f3f4f6);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 8px;
          padding: 0.55rem 2.2rem 0.55rem 0.85rem;
          font-size: 0.9rem;
          cursor: pointer;
          outline: none;
          transition: border-color 0.2s;
        }
        .ts-select:focus {
          border-color: var(--admin-accent, #00c896);
          box-shadow: 0 0 0 3px rgba(0,200,150,0.1);
        }

        .ts-select-arrow {
          position: absolute;
          right: 0.75rem;
          color: var(--admin-accent, #00c896);
          font-size: 0.8rem;
          pointer-events: none;
        }

        /* Range Slider */
        .ts-range {
          width: 100%;
          accent-color: var(--admin-accent, #00c896);
          cursor: pointer;
          height: 4px;
        }

        .ts-range-labels {
          display: flex;
          justify-content: space-between;
          font-size: 0.72rem;
          color: var(--admin-text-secondary, #9ca3af);
        }

        /* Live Preview */
        .ts-preview-box {
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.08);
          display: flex;
          height: 180px;
        }

        .ts-preview-sidebar {
          width: 140px;
          flex-shrink: 0;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          font-size: 0.78em;
        }

        .ts-preview-nav-item {
          padding: 0.3rem 0.5rem;
          border-radius: 4px;
          font-weight: 600;
        }

        .ts-preview-content {
          flex: 1;
          display: flex;
          gap: 0.75rem;
          padding: 1rem;
          align-items: flex-start;
        }

        .ts-preview-card {
          flex: 1;
          padding: 0.85rem;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
