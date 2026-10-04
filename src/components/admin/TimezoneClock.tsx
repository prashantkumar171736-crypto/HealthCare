"use client";

import { useEffect, useId, useState } from "react";

type ClockPhase = "Day" | "Night" | "Sunrise" | "Sunset";

interface TimezoneClockProps {
  label: string;
  timeZone: string;
  offsetLabel: string;
  countryLabel?: string;
  previewHour?: number;
}

interface ClockSnapshot {
  hour: number;
  minute: number;
  second: number;
  time: string;
  date: string;
}

const STAR_POSITIONS = [
  [20, 14], [48, 32], [75, 12], [110, 26], [140, 10], [170, 30],
  [205, 16], [235, 34], [262, 12], [285, 28], [95, 44], [190, 48],
] as const;

function getClockSnapshot(timeZone: string, previewHour?: number): ClockSnapshot {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).formatToParts(new Date());
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  const zonedHour = Number(getPart("hour"));
  const zonedMinute = Number(getPart("minute"));
  const zonedSecond = Number(getPart("second"));
  const hour = previewHour === undefined ? zonedHour : Math.floor(previewHour);
  const previewMinute = previewHour === undefined ? zonedMinute : Math.floor((previewHour - hour) * 60);
  const previewSecond = previewHour === undefined
    ? zonedSecond
    : Math.floor((((previewHour - hour) * 60) - previewMinute) * 60);

  return {
    hour,
    minute: previewMinute,
    second: previewSecond,
    time: `${String(hour).padStart(2, "0")}:${String(previewMinute).padStart(2, "0")}:${String(previewSecond).padStart(2, "0")}`,
    date: `${getPart("weekday")}, ${getPart("day")} ${getPart("month")} ${getPart("year")}`,
  };
}

function getPhase(time: number): ClockPhase {
  if (time >= 5 && time < 7) return "Sunrise";
  if (time >= 7 && time < 17) return "Day";
  if (time >= 17 && time < 19) return "Sunset";
  return "Night";
}

function getBodyTransform(fraction: number): string {
  if (fraction < 0 || fraction > 1) return "translate(150px, 150px)";
  const x = 30 + 240 * fraction;
  const y = 98 - 72 * Math.sin(Math.PI * fraction);
  return `translate(${x}px, ${y}px)`;
}

function PhaseIcon({ phase }: { phase: ClockPhase }) {
  if (phase === "Night") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M15.8 12.8A7 7 0 0 1 7.2 4.2a7.2 7.2 0 1 0 8.6 8.6Z" />
      </svg>
    );
  }

  if (phase === "Sunrise" || phase === "Sunset") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M3 13h14M5 10a5 5 0 0 1 10 0M10 2v2M3.8 5.2l1.4 1.4m9.6-1.4-1.4 1.4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 1.5v2m0 13v2m8.5-8.5h-2m-13 0h-2m14.5-6-1.4 1.4m-9.2 9.2L3 16m13 0-1.4-1.4M4.4 4.4 3 3" />
    </svg>
  );
}

export default function TimezoneClock({ label, timeZone, offsetLabel, countryLabel, previewHour }: TimezoneClockProps) {
  const reactId = useId();
  const maskId = `clock-moon-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [snapshot, setSnapshot] = useState<ClockSnapshot | null>(null);

  useEffect(() => {
    const update = () => setSnapshot(getClockSnapshot(timeZone, previewHour));
    update();
    const intervalId = window.setInterval(update, 1000);
    return () => window.clearInterval(intervalId);
  }, [timeZone, previewHour]);

  const hour = snapshot?.hour ?? 0;
  const minute = snapshot?.minute ?? 0;
  const second = snapshot?.second ?? 0;
  const decimalHour = hour + minute / 60 + second / 3600;
  const phase = snapshot ? getPhase(decimalHour) : "Night";
  const skyColor = phase === "Day" ? "#B5D4F4" : phase === "Night" ? "#042C53" : "#F5C4B3";
  const groundColor = phase === "Day" ? "#639922" : phase === "Night" ? "#173404" : "#3B6D11";
  const starsOpacity = phase === "Night" ? 1 : phase === "Day" ? 0 : 0.35;
  const cloudsOpacity = phase === "Night" ? 0.15 : phase === "Day" ? 1 : 0.7;
  const sunFraction = (decimalHour - 6) / 12;
  const moonFraction = ((decimalHour - 18 + 24) % 24) / 12;

  return (
    <section className="timezone-clock" aria-label={`${label} clock`}>
      <div className="timezone-clock-scene">
        <svg
          viewBox="0 0 300 120"
          preserveAspectRatio="xMidYMid slice"
          role="img"
          aria-label={`${label}, ${phase.toLowerCase()}`}
        >
          <rect className="clock-sky" x="0" y="0" width="300" height="120" style={{ fill: skyColor }} />

          <g className="clock-stars" style={{ opacity: starsOpacity }}>
            {STAR_POSITIONS.map(([x, y], index) => (
              <circle
                key={`${x}-${y}`}
                className="clock-star"
                cx={x}
                cy={y}
                r="1.3"
                style={{ animationDelay: `${index * 0.35}s` }}
              />
            ))}
          </g>

          <g className="clock-clouds" style={{ opacity: cloudsOpacity }}>
            <g className="clock-cloud clock-cloud-one">
              <circle cx="13" cy="30" r="12" />
              <circle cx="31" cy="25" r="16" />
              <circle cx="50" cy="31" r="11" />
              <rect x="11" y="29" width="41" height="14" rx="7" />
            </g>
            <g className="clock-cloud clock-cloud-two">
              <circle cx="12" cy="58" r="10" />
              <circle cx="29" cy="54" r="14" />
              <circle cx="47" cy="59" r="10" />
              <rect x="10" y="57" width="39" height="12" rx="6" />
            </g>
          </g>

          <g className="clock-sun" style={{ transform: getBodyTransform(sunFraction) }}>
            <g className="clock-sun-rays">
              {Array.from({ length: 8 }, (_, index) => (
                <line key={index} x1="0" y1="-19" x2="0" y2="-27" transform={`rotate(${index * 45})`} />
              ))}
            </g>
            <circle cx="0" cy="0" r="14" fill="#EF9F27" />
          </g>

          <g className="clock-moon" style={{ transform: getBodyTransform(moonFraction) }}>
            <mask id={maskId}>
              <rect x="-20" y="-20" width="40" height="40" fill="white" />
              <circle cx="6" cy="-4" r="10" fill="black" />
            </mask>
            <circle cx="0" cy="0" r="13" fill="#F1EFE8" mask={`url(#${maskId})`} />
          </g>

          <path
            className="clock-ground"
            d="M0 120 L0 98 Q40 82 85 96 Q130 108 175 92 Q225 76 300 98 L300 120 Z"
            style={{ fill: groundColor }}
          />
        </svg>
      </div>

      <div className="timezone-clock-content">
        <div className="timezone-clock-heading">
          <div className="timezone-clock-title">
            {countryLabel && <span className="timezone-clock-country">{countryLabel}</span>}
            <span className="timezone-clock-label">{label}</span>
          </div>
          <span className={`timezone-clock-phase ${phase === "Night" ? "is-night" : "is-day"}`}>
            <PhaseIcon phase={phase} />
            {phase}
          </span>
        </div>
        <div className="timezone-clock-time" aria-live="off">{snapshot?.time ?? "--:--:--"}</div>
        <div className="timezone-clock-details">
          <span>{snapshot?.date ?? "---, -- --- ----"}</span>
          <span>{offsetLabel}</span>
        </div>
      </div>

      <style jsx>{`
        .timezone-clock {
          width: 100%;
          max-width: 300px;
          overflow: hidden;
          border: 1px solid var(--admin-border, #e2e8f0);
          border-radius: 12px;
          background: var(--admin-card-bg, var(--surface, #ffffff));
          --clock-rose-text: color-mix(in srgb, #fb7185 72%, var(--admin-text-primary, #0f172a));
          --clock-rose-strong: color-mix(in srgb, #f43f5e 76%, var(--admin-text-primary, #0f172a));
          --clock-rose-surface: color-mix(in srgb, #fb7185 18%, var(--admin-card-bg, #ffffff));
          color: var(--clock-rose-text);
          text-align: left;
        }

        .timezone-clock-scene {
          width: 100%;
          height: 68px;
          overflow: hidden;
        }

        .timezone-clock-scene svg {
          display: block;
          width: 100%;
          height: 100%;
        }

        .clock-sky,
        .clock-ground {
          transition: fill 1.6s ease;
        }

        .clock-stars,
        .clock-clouds {
          transition: opacity 1.6s ease;
        }

        .clock-star {
          fill: #ffffff;
          animation: star-twinkle 3s ease-in-out infinite;
        }

        .clock-cloud {
          fill: #ffffff;
          animation-name: cloud-drift;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        .clock-cloud-one {
          animation-duration: 46s;
          animation-delay: -10s;
        }

        .clock-cloud-two {
          animation-duration: 62s;
          animation-delay: -40s;
        }

        .clock-sun,
        .clock-moon {
          transition: transform 1.4s ease;
        }

        .clock-sun-rays {
          transform-box: fill-box;
          transform-origin: center;
          animation: rays-rotate 24s linear infinite;
        }

        .clock-sun-rays line {
          stroke: #EF9F27;
          stroke-width: 3;
          stroke-linecap: round;
        }

        .timezone-clock-content {
          padding: 8px 11px 9px;
        }

        .timezone-clock-heading,
        .timezone-clock-details {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
        }

        .timezone-clock-title {
          display: flex;
          min-width: 0;
          align-items: baseline;
          gap: 6px;
        }

        .timezone-clock-label {
          overflow: hidden;
          color: var(--clock-rose-text);
          font-size: 13px;
          font-style: italic;
          font-weight: 800;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .timezone-clock-country {
          flex: 0 0 auto;
          color: var(--clock-rose-strong);
          font-size: 13px;
          font-style: italic;
          font-weight: 900;
          white-space: nowrap;
        }

        .timezone-clock-phase {
          display: inline-flex;
          flex: 0 0 auto;
          align-items: center;
          gap: 3px;
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.25;
        }

        .timezone-clock-phase.is-day {
          background: var(--clock-rose-surface);
          border: 1px solid color-mix(in srgb, #fb7185 34%, transparent);
          color: var(--clock-rose-strong);
        }

        .timezone-clock-phase.is-night {
          background: var(--clock-rose-surface);
          color: var(--clock-rose-strong);
          border: 1px solid color-mix(in srgb, #f43f5e 38%, transparent);
        }

        .timezone-clock-phase svg {
          width: 14px;
          height: 14px;
          fill: none;
          stroke: currentColor;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 1.7;
        }

        .timezone-clock-time {
          margin: 1px 0;
          font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
          color: var(--clock-rose-strong);
          font-size: 23px;
          font-variant-numeric: tabular-nums;
          font-weight: 700;
          letter-spacing: 0;
          line-height: 1.15;
        }

        .timezone-clock-details {
          color: var(--clock-rose-text);
          font-size: 12px;
          font-variant-numeric: tabular-nums;
          font-style: italic;
          font-weight: 800;
          line-height: 1.25;
        }

        @keyframes star-twinkle {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 1; }
        }

        @keyframes cloud-drift {
          from { transform: translateX(-90px); }
          to { transform: translateX(360px); }
        }

        @keyframes rays-rotate {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 767px) {
          .timezone-clock-scene,
          .timezone-clock-details {
            display: none;
          }

          .timezone-clock-content {
            padding: 7px 9px;
          }

          .timezone-clock-time {
            font-size: 20px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .clock-star,
          .clock-cloud,
          .clock-sun-rays {
            animation: none !important;
          }
        }
      `}</style>
    </section>
  );
}