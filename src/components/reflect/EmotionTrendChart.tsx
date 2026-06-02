import { Card } from '../primitives';
import type { EmotionChartData, EmotionHeadline } from '../../lib/reflect-patterns';

// D.43 (Stream 0.5s pieces #4 + #6) — aggregate emotion trend chart.
//
// Three SVG polylines (worth-it / regret / neutral) over 6 months,
// Y-axis is each month's percentage. Headline above the chart is the
// 3-second-readability anchor — user reads the headline, glances at the
// chart, understands their pattern.
//
// Bucketing semantic: occurred_at (Path B from B.18). Same as the
// per-merchant trend cards behind the Know more expand.
//
// Zero-reflection months drop all three lines to y=0% — honest about
// sparse periods rather than interpolating across gaps. Months with
// only one emotion present spike one line to 100%; accurate even if
// visually punchy.

interface Props {
  data: EmotionChartData;
  headline: EmotionHeadline;
}

const COLOR_WORTH_IT = '#3B6D11';
const COLOR_REGRET   = '#A32D2D';
const COLOR_NEUTRAL  = '#888880';
const COLOR_AXIS     = '#D3D1C7';
const COLOR_TICK     = '#888880';

// SVG canvas math kept inline so the layout is auditable without trace
// constants. 340×180 viewBox; ~50px left padding for Y-axis labels,
// ~30px right padding so the May column doesn't kiss the right edge,
// 20px top padding for the 100% tick, 30px bottom for X-axis labels.
const SVG_W = 340;
const SVG_H = 180;
const PAD_LEFT = 38;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 30;
const PLOT_W = SVG_W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = SVG_H - PAD_TOP - PAD_BOTTOM;
const X_AXIS_Y = PAD_TOP + PLOT_H;

function xFor(index: number, total: number): number {
  if (total <= 1) return PAD_LEFT + PLOT_W / 2;
  return PAD_LEFT + (index * PLOT_W) / (total - 1);
}

function yForPct(pct: number): number {
  // pct in [0..100]. 0% → bottom (X_AXIS_Y), 100% → top (PAD_TOP).
  return X_AXIS_Y - (pct / 100) * PLOT_H;
}

function buildPolyline(
  data: EmotionChartData,
  key: 'worthIt' | 'regret' | 'neutral',
): string {
  return data.map((p, i) => {
    const x = xFor(i, data.length);
    const pct = p.total === 0 ? 0 : (p[key] / p.total) * 100;
    return `${x.toFixed(1)},${yForPct(pct).toFixed(1)}`;
  }).join(' ');
}

export function EmotionTrendChart({ data, headline }: Props) {
  const ariaSummary = data.map(p => {
    const t = p.total;
    if (t === 0) return `${p.month}: no reflections`;
    const w = Math.round((p.worthIt / t) * 100);
    const r = Math.round((p.regret / t) * 100);
    const n = Math.round((p.neutral / t) * 100);
    return `${p.month}: ${w}% worth-it, ${r}% regret, ${n}% neutral`;
  }).join('; ');

  return (
    <Card className="mb-3" style={{ padding: 16 }}>
      {/* D.43 Piece #6 — headline interpretation above the chart. Renders
          prefix + accent-colored emphasis word + suffix when emphasis is set;
          falls back to prefix-only for the empty/balanced states. */}
      <div
        style={{
          fontSize: 13,
          color: '#1A1A1A',
          fontWeight: 500,
          textAlign: 'center',
          marginBottom: 10,
          lineHeight: 1.4,
        }}
      >
        {headline.prefix}
        {headline.emphasis && (
          <span style={{ color: headline.emphasisColor, fontWeight: 500 }}>
            {headline.emphasis}
          </span>
        )}
        {headline.suffix}
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 14,
          marginBottom: 8,
          fontSize: 11,
          color: '#5A6B5F',
        }}
      >
        <LegendItem color={COLOR_WORTH_IT} label="Worth-it" />
        <LegendItem color={COLOR_REGRET}   label="Regret" />
        <LegendItem color={COLOR_NEUTRAL}  label="Neutral" dashed />
      </div>

      <svg
        role="img"
        aria-label={`Emotion trend over the last 6 months. ${ariaSummary}.`}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {/* Horizontal gridlines at 0/25/50/75/100% */}
        {[0, 25, 50, 75, 100].map(pct => (
          <line
            key={pct}
            x1={PAD_LEFT}
            y1={yForPct(pct)}
            x2={SVG_W - PAD_RIGHT}
            y2={yForPct(pct)}
            stroke={COLOR_AXIS}
            strokeWidth={pct === 0 ? 0.8 : 0.4}
            strokeDasharray={pct === 0 ? undefined : '2,3'}
          />
        ))}

        {/* Y-axis tick labels */}
        {[0, 50, 100].map(pct => (
          <text
            key={pct}
            x={PAD_LEFT - 6}
            y={yForPct(pct) + 3}
            fontSize={9}
            fill={COLOR_TICK}
            textAnchor="end"
          >
            {pct}%
          </text>
        ))}

        {/* X-axis month labels */}
        {data.map((p, i) => (
          <text
            key={p.month + i}
            x={xFor(i, data.length)}
            y={X_AXIS_Y + 16}
            fontSize={10}
            fill={COLOR_TICK}
            textAnchor="middle"
          >
            {p.month}
          </text>
        ))}

        {/* Three polylines — neutral first (dashed, behind), then regret,
            then worth-it on top so the improving signal reads dominant. */}
        <polyline
          points={buildPolyline(data, 'neutral')}
          fill="none"
          stroke={COLOR_NEUTRAL}
          strokeWidth={1.8}
          strokeDasharray="3,2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={buildPolyline(data, 'regret')}
          fill="none"
          stroke={COLOR_REGRET}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={buildPolyline(data, 'worthIt')}
          fill="none"
          stroke={COLOR_WORTH_IT}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data point circles per emotion per month */}
        {data.map((p, i) => {
          const x = xFor(i, data.length);
          const wPct = p.total === 0 ? 0 : (p.worthIt / p.total) * 100;
          const rPct = p.total === 0 ? 0 : (p.regret / p.total) * 100;
          const nPct = p.total === 0 ? 0 : (p.neutral / p.total) * 100;
          return (
            <g key={`pts-${i}`}>
              <circle cx={x} cy={yForPct(nPct)} r={2.5} fill={COLOR_NEUTRAL} />
              <circle cx={x} cy={yForPct(rPct)} r={2.5} fill={COLOR_REGRET} />
              <circle cx={x} cy={yForPct(wPct)} r={2.5} fill={COLOR_WORTH_IT} />
            </g>
          );
        })}
      </svg>
    </Card>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span
        style={{
          width: 14,
          height: 2,
          background: dashed
            ? `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 5px)`
            : color,
          display: 'inline-block',
        }}
        aria-hidden
      />
      <span>{label}</span>
    </span>
  );
}
