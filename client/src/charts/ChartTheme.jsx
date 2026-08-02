import { useEffect, useState } from 'react';

/**
 * Charts read their colours from the CSS design tokens rather than holding
 * their own hexes, so light/dark and any future rebrand happen in one file.
 *
 * The categorical order below is the validated one -- its slot ORDER is the
 * colourblind-safety mechanism, so series must be assigned by identity in a
 * fixed order and never cycled or re-sorted by rank.
 */
const SERIES_SLOTS = 8;

function readTokens() {
  const style = getComputedStyle(document.documentElement);
  const token = (name) => style.getPropertyValue(name).trim();

  return {
    series: Array.from({ length: SERIES_SLOTS }, (_, i) => token(`--series-${i + 1}`)),
    sequential: [100, 200, 300, 400, 500, 600, 700].map((step) => token(`--seq-${step}`)),
    grid: token('--gridline'),
    axis: token('--axis'),
    axisLabel: token('--axis-label'),
    text: token('--text'),
    textSecondary: token('--text-secondary'),
    surface: token('--chart-surface'),
    primary: token('--primary'),
  };
}

/** Re-reads tokens whenever the theme attribute flips. */
export function useChartTheme() {
  const [tokens, setTokens] = useState(readTokens);

  useEffect(() => {
    const observer = new MutationObserver(() => setTokens(readTokens()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return tokens;
}

/** Colour for categorical slot n, assigned by identity and never cycled. */
export const seriesColor = (tokens, index) => tokens.series[index % SERIES_SLOTS];

/* Shared axis styling -- grid and axes stay recessive so the data reads first. */
export const axisProps = (tokens) => ({
  tick: { fill: tokens.axisLabel, fontSize: 12 },
  tickLine: false,
  axisLine: false,
  style: { fontVariantNumeric: 'tabular-nums' },
});

export const gridProps = (tokens) => ({
  stroke: tokens.grid,
  strokeDasharray: '3 3',
  vertical: false,
});

/** Tooltip card matching the surface style rather than Recharts' default. */
export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter, unit = '' }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      {label != null && (
        <div className="chart-tooltip-label">{labelFormatter ? labelFormatter(label) : label}</div>
      )}
      {payload.map((entry, i) => (
        <div className="chart-tooltip-row" key={`${entry.dataKey}-${i}`}>
          <span className="flex items-center gap-1.5 min-w-0">
            <span
              className="chart-tooltip-swatch"
              style={{ background: entry.color || entry.payload?.fill }}
            />
            <span className="truncate-1">{entry.name}</span>
          </span>
          <strong className="tnum" style={{ color: 'var(--text)' }}>
            {valueFormatter ? valueFormatter(entry.value) : entry.value}
            {unit}
          </strong>
        </div>
      ))}
    </div>
  );
}

/**
 * Legend as plain markup rather than Recharts' built-in, so it can sit in the
 * card header and wrap without stealing plot height.
 */
export function ChartLegend({ items }) {
  return (
    <div className="chart-legend">
      {items.map((item) => (
        <span className="chart-legend-item" key={item.label}>
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: 2.5,
              background: item.color,
              display: 'inline-block',
            }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
