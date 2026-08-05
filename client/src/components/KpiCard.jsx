import { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { num, signedPct } from '../lib/format.js';
import { Sparkline } from '../charts/index.jsx';
import { Skeleton } from './ui/index.jsx';

/**
 * Counts up to the value on mount.
 *
 * The animation is decoration; the number is the point. requestAnimationFrame
 * does not fire in a hidden or non-compositing tab, so a purely rAF-driven
 * count would leave every figure reading 0 -- a wrong number, not just a
 * missing flourish. A timer backstop always snaps to the final value.
 */
function useCountUp(target, ms = 620) {
  const [value, setValue] = useState(target ?? 0);
  const frame = useRef();

  useEffect(() => {
    if (target == null) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || document.hidden) {
      setValue(target);
      return undefined;
    }

    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms);
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);

    // Backstop: if rAF never runs, land on the real figure anyway.
    const settle = setTimeout(() => setValue(target), ms + 80);

    return () => {
      cancelAnimationFrame(frame.current);
      clearTimeout(settle);
    };
  }, [target, ms]);

  return value;
}

export function DeltaPill({ pct: pctValue, change }) {
  // null pct means there was no previous period to compare against.
  const tone = pctValue == null ? 'flat' : pctValue > 0 ? 'up' : pctValue < 0 ? 'down' : 'flat';
  const Icon = tone === 'up' ? TrendingUp : tone === 'down' ? TrendingDown : Minus;

  return (
    <span className={`delta delta-${tone}`}>
      <Icon size={11} strokeWidth={2.4} />
      {pctValue == null ? 'new' : signedPct(pctValue, Math.abs(pctValue) < 10 ? 1 : 0)}
      {change != null && pctValue != null && (
        <span style={{ opacity: 0.7, fontWeight: 500 }}>
          ({change > 0 ? '+' : ''}
          {change})
        </span>
      )}
    </span>
  );
}

export function KpiCard({ label, value, caption, accent, icon: Icon, sparkline, loading, delta }) {
  const animated = useCountUp(loading ? null : value);

  if (loading) {
    return (
      <div className="kpi">
        <Skeleton w={90} h={9} />
        <Skeleton w={64} h={28} style={{ marginTop: 12 }} />
        <Skeleton w={110} h={9} style={{ marginTop: 9 }} />
      </div>
    );
  }

  return (
    <div className="kpi">
      {sparkline?.length > 1 && (
        <div className="kpi-spark">
          <Sparkline rows={sparkline} color={accent} />
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <div className="kpi-label">
          {Icon && (
            /* colour set here so the chip's background can derive from it
               via color-mix(currentColor) rather than needing a second token */
            <span className="kpi-chip" style={{ color: accent || 'var(--text-muted)' }}>
              <Icon size={14} strokeWidth={2} />
            </span>
          )}
          {label}
        </div>
        <div className="kpi-value">{num(animated)}</div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {delta && <DeltaPill {...delta} />}
          {caption && <span className="kpi-caption">{caption}</span>}
        </div>
      </div>
    </div>
  );
}

/**
 * Period comparison card. Shows the current count, the delta, and the previous
 * period's count so the comparison is never a bare percentage the reader has
 * to take on trust.
 */
export function ComparisonCard({ period, loading }) {
  const animated = useCountUp(loading ? null : period?.current);

  if (loading || !period) {
    return (
      <div className="kpi">
        <Skeleton w={78} h={9} />
        <Skeleton w={52} h={24} style={{ marginTop: 11 }} />
        <Skeleton w={96} h={9} style={{ marginTop: 9 }} />
      </div>
    );
  }

  return (
    <div className="kpi">
      <div className="kpi-label">{period.title}</div>
      <div className="kpi-value" style={{ fontSize: 27 }}>
        {num(animated)}
      </div>
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        <DeltaPill pct={period.pct} />
        <span className="kpi-caption">
          {num(period.previous)} {period.caption}
        </span>
      </div>
    </div>
  );
}
