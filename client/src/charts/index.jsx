import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from 'recharts';
import { useChartTheme, axisProps, gridProps, ChartTooltip, ChartLegend, seriesColor } from './ChartTheme.jsx';
import { num, formatBucket, pct } from '../lib/format.js';
import { EmptyState } from '../components/ui/index.jsx';
import { BarChart3 } from 'lucide-react';

const NoData = ({ height }) => (
  <div style={{ height }} className="grid place-items-center">
    <EmptyState icon={BarChart3} title="No data in this range" description="Adjust the filters to see results." />
  </div>
);

/* ==========================================================================
   Trend -- joinings (and completions) over time
   ========================================================================== */

export function TrendChart({ rows = [], height = 268, showCompleted = true }) {
  const tokens = useChartTheme();
  if (!rows.length) return <NoData height={height} />;

  const joinedColor = seriesColor(tokens, 0);
  const completedColor = seriesColor(tokens, 1);

  return (
    <div>
      <div className="px-5 pb-2">
        <ChartLegend
          items={[
            { label: 'Joined', color: joinedColor },
            ...(showCompleted ? [{ label: 'Finished', color: completedColor }] : []),
          ]}
        />
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={rows} margin={{ top: 6, right: 18, left: 4, bottom: 4 }}>
          <defs>
            <linearGradient id="grad-joined" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={joinedColor} stopOpacity={0.26} />
              <stop offset="100%" stopColor={joinedColor} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="grad-completed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={completedColor} stopOpacity={0.18} />
              <stop offset="100%" stopColor={completedColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid {...gridProps(tokens)} />
          <XAxis dataKey="bucket" tickFormatter={formatBucket} {...axisProps(tokens)} minTickGap={18} />
          <YAxis {...axisProps(tokens)} width={34} allowDecimals={false} />
          <Tooltip
            content={<ChartTooltip labelFormatter={formatBucket} valueFormatter={num} />}
            cursor={{ stroke: tokens.axis, strokeWidth: 1 }}
          />

          <Area
            type="monotone"
            dataKey="joined"
            name="Joined"
            stroke={joinedColor}
            strokeWidth={2}
            fill="url(#grad-joined)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: tokens.surface }}
          />
          {showCompleted && (
            <Area
              type="monotone"
              dataKey="completed"
              name="Finished"
              stroke={completedColor}
              strokeWidth={2}
              strokeDasharray="4 3"
              fill="url(#grad-completed)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: tokens.surface }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ==========================================================================
   Horizontal breakdown bar
   ========================================================================== */

/**
 * Horizontal because the labels are long names (universities, departments) --
 * vertical bars would force rotated ticks, which are hard to read.
 * Direct value labels double as the "relief" for slots that sit under 3:1
 * contrast on the light surface.
 */
export function BreakdownBar({ rows = [], height = 300, colorIndex = 0, maxRows = 10, labelKey = 'short_label' }) {
  const tokens = useChartTheme();
  const data = useMemo(() => rows.slice(0, maxRows), [rows, maxRows]);
  if (!data.length) return <NoData height={height} />;

  const color = seriesColor(tokens, colorIndex);
  const longest = Math.max(...data.map((r) => String(r[labelKey] ?? r.label).length));
  // ~6.9px per character at the 12.5px tick size, so longer names still fit.
  const axisWidth = Math.min(210, Math.max(84, longest * 6.9));

  return (
    <ResponsiveContainer width="100%" height={Math.max(height, data.length * 30 + 26)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, left: 4, bottom: 4 }}>
        <CartesianGrid {...gridProps(tokens)} horizontal={false} vertical />
        <XAxis type="number" {...axisProps(tokens)} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey={labelKey}
          {...axisProps(tokens)}
          width={axisWidth}
          tick={{ fill: tokens.axisLabel, fontSize: 12.5 }}
        />
        <Tooltip
          content={
            <ChartTooltip
              valueFormatter={num}
              labelFormatter={(l) => data.find((d) => d[labelKey] === l)?.label ?? l}
            />
          }
          cursor={{ fill: tokens.grid, fillOpacity: 0.5 }}
        />
        <Bar dataKey="total" name="Internees" fill={color} radius={[0, 4, 4, 0]} barSize={13} maxBarSize={15}>
          <LabelList
            dataKey="total"
            position="right"
            offset={7}
            style={{ fill: tokens.textSecondary, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ==========================================================================
   Donut
   ========================================================================== */

/**
 * @param remainder  Count of records the server left out of `rows` because of
 *   its row limit. It has to be folded into "Other" -- without it the donut
 *   silently reports a total smaller than the real population.
 */
export function BreakdownDonut({ rows = [], height = 268, maxSlices = 6, remainder = 0, grandTotal }) {
  const tokens = useChartTheme();
  const [activeIndex, setActiveIndex] = useState(null);

  // Past the slot count, the tail folds into "Other" -- a 9th hue is never
  // generated, and thin slivers are unreadable anyway.
  const data = useMemo(() => {
    if (rows.length <= maxSlices && !remainder) return rows;

    const head = rows.slice(0, maxSlices - 1);
    const tail = rows.slice(maxSlices - 1);
    const otherCount = tail.reduce((sum, r) => sum + r.total, 0) + remainder;
    if (!otherCount) return head;

    return [
      ...head,
      {
        label: `Other (${tail.length + (remainder ? 1 : 0) === 1 ? '1 group' : `${tail.length} shown + ${remainder} more`})`,
        short_label: 'Other',
        total: otherCount,
        isOther: true,
      },
    ];
  }, [rows, maxSlices, remainder]);

  if (!data.length) return <NoData height={height} />;

  const total = grandTotal ?? data.reduce((sum, r) => sum + r.total, 0);
  const colorFor = (i, row) => (row.isOther ? tokens.axis : seriesColor(tokens, i));

  return (
    <div className="flex flex-col gap-2">
      <div style={{ position: 'relative' }}>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="61%"
              outerRadius="88%"
              paddingAngle={2}
              stroke={tokens.surface}
              strokeWidth={2}
              onMouseEnter={(_, i) => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {data.map((row, i) => (
                <Cell
                  key={row.label}
                  fill={colorFor(i, row)}
                  opacity={activeIndex == null || activeIndex === i ? 1 : 0.42}
                />
              ))}
            </Pie>
            <Tooltip
              content={
                <ChartTooltip
                  valueFormatter={(v) => `${num(v)} (${pct((v / total) * 100)})`}
                />
              }
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Centre figure: the total the slices add up to. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              className="tnum"
              style={{ fontSize: 25, fontWeight: 650, letterSpacing: '-0.02em', color: 'var(--text)' }}
            >
              {num(activeIndex == null ? total : data[activeIndex].total)}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: -1 }}>
              {activeIndex == null ? 'internees' : data[activeIndex].short_label || data[activeIndex].label}
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 pb-1">
        <ChartLegend
          items={data.map((row, i) => ({
            label: `${row.short_label || row.label} · ${num(row.total)}`,
            color: colorFor(i, row),
          }))}
        />
      </div>
    </div>
  );
}

/* ==========================================================================
   Year-over-year comparison
   ========================================================================== */

/** Grouped (never stacked) so each year's bar can be compared against a shared baseline. */
export function YoYChart({ rows = [], height = 262 }) {
  const tokens = useChartTheme();
  if (!rows.length) return <NoData height={height} />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 16, right: 12, left: 4, bottom: 4 }}>
        <CartesianGrid {...gridProps(tokens)} />
        <XAxis dataKey="label" {...axisProps(tokens)} />
        <YAxis {...axisProps(tokens)} width={34} allowDecimals={false} />
        <Tooltip content={<ChartTooltip valueFormatter={num} />} cursor={{ fill: tokens.grid, fillOpacity: 0.5 }} />
        <Bar dataKey="total" name="Internees" radius={[4, 4, 0, 0]} maxBarSize={54}>
          {rows.map((row, i) => (
            <Cell key={row.label} fill={seriesColor(tokens, i)} />
          ))}
          <LabelList
            dataKey="total"
            position="top"
            offset={6}
            style={{ fill: tokens.textSecondary, fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ==========================================================================
   Sparkline for KPI cards
   ========================================================================== */

export function Sparkline({ rows = [], color, height = 34 }) {
  const tokens = useChartTheme();
  if (rows.length < 2) return null;
  const stroke = color || seriesColor(tokens, 0);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={rows} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${stroke.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.32} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="total"
          stroke={stroke}
          strokeWidth={1.6}
          fill={`url(#spark-${stroke.replace('#', '')})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ==========================================================================
   Stacked status bar -- one row, composition at a glance
   ========================================================================== */

export function StatusBar({ rows = [] }) {
  const tokens = useChartTheme();
  const total = rows.reduce((sum, r) => sum + r.total, 0);
  if (!total) return null;

  const TONE = {
    Active: 'var(--success)',
    Completed: 'var(--info)',
    Upcoming: 'var(--primary)',
    Extended: 'var(--warning)',
    Terminated: 'var(--danger)',
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 2, /* 2px surface gap between segments, per the mark spec */
          height: 9,
          borderRadius: 999,
          overflow: 'hidden',
          background: tokens.grid,
        }}
      >
        {rows.map((row) => (
          <div
            key={row.label}
            title={`${row.label}: ${num(row.total)}`}
            style={{
              width: `${(row.total / total) * 100}%`,
              background: TONE[row.label] ?? tokens.axis,
              borderRadius: 999,
            }}
          />
        ))}
      </div>
      <div className="chart-legend mt-3">
        {rows.map((row) => (
          <span className="chart-legend-item" key={row.label}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: TONE[row.label] ?? tokens.axis,
                display: 'inline-block',
              }}
            />
            {row.label}
            <strong className="tnum" style={{ color: 'var(--text)', fontWeight: 600 }}>
              {num(row.total)}
            </strong>
            <span style={{ color: 'var(--text-muted)' }}>{pct((row.total / total) * 100, 0)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
