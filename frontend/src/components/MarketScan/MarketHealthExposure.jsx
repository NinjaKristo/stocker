import { useMemo } from 'react';
import { Box, Chip, Grid, Paper, Typography } from '@mui/material';
import {
  Area,
  AreaChart,
  CartesianGrid,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parseISO } from 'date-fns';

// Stance band -> color. Mirrors the backend rubric ordering (high score = green).
const STANCE_COLORS = {
  'Power Trend': '#2e7d32',
  'Confirmed Uptrend': '#66bb6a',
  'Uptrend Under Pressure': '#f9a825',
  'Downtrend/Caution': '#ef6c00',
  'Correction — In Cash': '#c62828',
};

function stanceColor(stance) {
  return STANCE_COLORS[stance] || '#9e9e9e';
}

function humanize(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmt(value, digits = 2) {
  if (value == null || Number.isNaN(value)) return '-';
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function TimelineTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <Paper elevation={3} sx={{ p: 1 }}>
      <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
        {point.date}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', fontFamily: 'monospace' }}>
        {fmt(point.exposure_score, 0)} · {point.stance}
      </Typography>
    </Paper>
  );
}

function MarketHealthExposure({ exposure }) {
  const color = stanceColor(exposure?.stance);

  const history = useMemo(
    () =>
      (exposure?.history || []).map((point) => ({
        ...point,
        label: (() => {
          try {
            return format(parseISO(point.date), 'MMM d');
          } catch {
            return point.date;
          }
        })(),
      })),
    [exposure?.history],
  );

  // The "why": every score contribution except the starting base.
  const contributions = useMemo(
    () => Object.entries(exposure?.components || {}).filter(([key]) => key !== 'base'),
    [exposure?.components],
  );

  if (!exposure) {
    return (
      <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.5 }}>
          Market Health &amp; Exposure
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No exposure data yet. It is computed daily after the breadth step (or run the backfill).
        </Typography>
      </Paper>
    );
  }

  const score = exposure.exposure_score;

  return (
    <Paper elevation={0} sx={{ p: 1.5, mb: 2, border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Market Health &amp; Exposure
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '11px' }}>
          {exposure.date} · {exposure.benchmark_symbol || ''}
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {/* Left: gauge + stance + readout */}
        <Grid item xs={12} md={4}>
          <Box sx={{ position: 'relative', height: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="72%"
                outerRadius="100%"
                startAngle={180}
                endAngle={0}
                data={[{ value: score, fill: color }]}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background dataKey="value" cornerRadius={6} />
              </RadialBarChart>
            </ResponsiveContainer>
            <Box sx={{ position: 'absolute', inset: 0, top: '28%', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
              <Typography sx={{ fontSize: 34, fontWeight: 800, lineHeight: 1, color }}>
                {fmt(score, 0)}
              </Typography>
              <Typography variant="caption" color="text.secondary">/ 100 exposure</Typography>
            </Box>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 0.5 }}>
            <Chip label={exposure.stance} size="small" sx={{ bgcolor: color, color: '#fff', fontWeight: 600 }} />
          </Box>

          <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 0.5, columnGap: 1 }}>
            <Typography variant="caption" color="text.secondary">Distribution days</Typography>
            <Typography variant="caption" sx={{ fontFamily: 'monospace', textAlign: 'right', fontWeight: 600 }}>
              {exposure.distribution_day_count}
            </Typography>
            <Typography variant="caption" color="text.secondary">Trend</Typography>
            <Typography variant="caption" sx={{ fontFamily: 'monospace', textAlign: 'right', fontWeight: 600 }}>
              {exposure.trend || '-'}
            </Typography>
            <Typography variant="caption" color="text.secondary">Follow-through day</Typography>
            <Typography variant="caption" sx={{ fontFamily: 'monospace', textAlign: 'right', fontWeight: 600 }}>
              {exposure.follow_through_day ? 'Yes' : 'No'}
            </Typography>
            <Typography variant="caption" color="text.secondary">VIX</Typography>
            <Typography variant="caption" sx={{ fontFamily: 'monospace', textAlign: 'right', fontWeight: 600 }}>
              {exposure.vix != null ? fmt(exposure.vix, 1) : '-'}
            </Typography>
          </Box>
        </Grid>

        {/* Right: score-over-time timeline */}
        <Grid item xs={12} md={5}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Exposure over time
          </Typography>
          <Box sx={{ height: 170 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="exposureFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={24} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={28} />
                <Tooltip content={<TimelineTooltip />} />
                <Area type="monotone" dataKey="exposure_score" stroke={color} strokeWidth={2} fill="url(#exposureFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Grid>

        {/* Far right: transparent "why" breakdown */}
        <Grid item xs={12} md={3}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Why this score
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary">Base</Typography>
              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>100</Typography>
            </Box>
            {contributions.map(([key, value]) => {
              const isCap = key.endsWith('_cap');
              return (
                <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {humanize(key.replace(/_cap$/, ''))}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ fontFamily: 'monospace', fontWeight: 600, color: isCap ? 'warning.main' : value < 0 ? 'error.main' : 'success.main' }}
                  >
                    {isCap ? `cap ${fmt(value, 0)}` : `${value > 0 ? '+' : ''}${fmt(value, 0)}`}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
}

export default MarketHealthExposure;
