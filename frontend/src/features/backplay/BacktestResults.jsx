/**
 * BacktestResults — plain-language results for one backtest: summary cards,
 * equity curve vs the stock itself, and the trade-by-trade table.
 */
import {
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import Acronym from '../../components/common/Acronym';

const EXIT_REASON_LABELS = {
  exit_rule: 'sell rule',
  stop_loss: 'stop loss',
  take_profit: 'take profit',
  max_hold: 'time limit',
  end_of_data: 'end of test',
};

export function formatPct(value, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const number = Number(value);
  const sign = number > 0 ? '+' : '';
  return `${sign}${number.toFixed(digits)}%`;
}

export function formatMoney(value, { signed = false } = {}) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const number = Number(value);
  const sign = signed && number > 0 ? '+' : '';
  return `${sign}${number.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })}`;
}

function pctColor(value) {
  if (value == null) return 'text.primary';
  return Number(value) >= 0 ? 'success.main' : 'error.main';
}

function SummaryCard({ label, value, color, hint }) {
  return (
    <Card variant="outlined" sx={{ minWidth: 130, flex: '1 1 130px' }}>
      <CardContent sx={{ py: 1 }}>
        <Typography variant="caption" color="text.secondary" component="div">
          {label}
        </Typography>
        <Typography variant="h6" sx={{ color, fontWeight: 700 }}>
          {value}
        </Typography>
        {hint && (
          <Typography variant="caption" color="text.secondary" component="div">
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export function BacktestSummaryCards({ summary }) {
  if (!summary) return null;
  const startingCash = Number(summary.starting_cash ?? 0);
  const finalEquity = Number(summary.final_equity ?? startingCash);
  const dollarProfit = finalEquity - startingCash;
  const beatBuyHold =
    summary.total_return_pct != null && summary.buy_hold_return_pct != null
      ? summary.total_return_pct >= summary.buy_hold_return_pct
      : null;

  return (
    <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
      <SummaryCard
        label="Strategy result"
        value={formatPct(summary.total_return_pct)}
        color={pctColor(summary.total_return_pct)}
        hint={`${formatMoney(startingCash)} → ${formatMoney(finalEquity)}`}
      />
      <SummaryCard
        label="Dollar profit / loss"
        value={formatMoney(dollarProfit, { signed: true })}
        color={pctColor(dollarProfit)}
        hint="Cash kept after the test"
      />
      <SummaryCard
        label={<Acronym term="Buy & Hold">Just holding it</Acronym>}
        value={formatPct(summary.buy_hold_return_pct)}
        color={pctColor(summary.buy_hold_return_pct)}
        hint={beatBuyHold == null ? null : beatBuyHold ? 'Your rule beat holding' : 'Holding did better'}
      />
      <SummaryCard label="Trades" value={summary.num_trades ?? 0} />
      <SummaryCard
        label={<Acronym term="Win Rate">Winning trades</Acronym>}
        value={summary.win_rate == null ? '—' : `${Math.round(summary.win_rate * 100)}%`}
      />
      <SummaryCard
        label={<Acronym term="Drawdown">Worst drop</Acronym>}
        value={formatPct(summary.max_drawdown_pct)}
        color="error.main"
      />
    </Stack>
  );
}

export function EquityCurveChart({ equityCurve, height = 220 }) {
  if (!equityCurve?.length) return null;
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        <Acronym term="Equity Curve">Account value over the test</Acronym>
      </Typography>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={equityCurve} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={48} />
          <YAxis
            tick={{ fontSize: 10 }}
            domain={['auto', 'auto']}
            tickFormatter={(value) => `$${Math.round(value / 1000)}k`}
            width={44}
          />
          <RechartsTooltip
            formatter={(value) => [`$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 'Value']}
          />
          <Line type="monotone" dataKey="value" stroke="#2196f3" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}

export function TradesTable({ trades }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Bought</TableCell>
            <TableCell align="right">At</TableCell>
            <TableCell>Sold</TableCell>
            <TableCell align="right">At</TableCell>
            <TableCell align="right">Result</TableCell>
            <TableCell>Why it sold</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(trades || []).map((trade, index) => (
            <TableRow key={`${trade.entry_date}-${index}`}>
              <TableCell>{trade.entry_date}</TableCell>
              <TableCell align="right">{trade.entry_price?.toFixed(2)}</TableCell>
              <TableCell>{trade.exit_date || '—'}</TableCell>
              <TableCell align="right">{trade.exit_price?.toFixed(2) ?? '—'}</TableCell>
              <TableCell align="right" sx={{ color: pctColor(trade.return_pct), fontWeight: 600 }}>
                {formatPct(trade.return_pct)}
              </TableCell>
              <TableCell>
                <Chip
                  size="small"
                  variant="outlined"
                  label={EXIT_REASON_LABELS[trade.exit_reason] || trade.exit_reason || 'open'}
                />
              </TableCell>
            </TableRow>
          ))}
          {(!trades || trades.length === 0) && (
            <TableRow>
              <TableCell colSpan={6} align="center">
                <Typography variant="body2" color="text.secondary">
                  The rule never triggered a trade in this window.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function BacktestResults({ results }) {
  if (!results) return null;
  return (
    <Stack spacing={2}>
      <BacktestSummaryCards summary={results.summary} />
      <EquityCurveChart equityCurve={results.equity_curve} />
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
          Every trade the rule made
        </Typography>
        <TradesTable trades={results.trades} />
      </Box>
    </Stack>
  );
}

export default BacktestResults;
