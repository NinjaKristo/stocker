import {
  Alert,
  Box,
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

import Acronym from '../../components/common/Acronym';
import GlossaryText from '../../components/common/GlossaryText';
import { formatMoney, formatPct } from './BacktestResults';

function resultColor(value) {
  return Number(value) >= 0 ? 'success.main' : 'error.main';
}

export function buildComparisonRows(primary, alternatives) {
  const runs = [
    { name: 'Your rule', response: primary, isPrimary: true },
    ...(alternatives?.runs || []),
  ];

  return runs
    .map((run) => {
      const summary = run.response?.results?.summary || {};
      const startingCash = Number(summary.starting_cash ?? 0);
      const finalEquity = Number(summary.final_equity ?? startingCash);
      return {
        ...run,
        summary,
        finalEquity,
        dollarProfit: finalEquity - startingCash,
      };
    })
    .sort((left, right) => right.finalEquity - left.finalEquity);
}

function ComparisonReport({ primary, comparison }) {
  const rows = buildComparisonRows(primary, comparison);

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Strategy comparison report
        </Typography>
        <Chip size="small" label={`${rows.length} rules`} />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Every rule used the same stock, dates, starting budget, and guardrails. The best ending
        account value is listed first.
      </Typography>

      {comparison?.errors?.length > 0 && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {comparison.errors.length} alternative {comparison.errors.length === 1 ? 'run' : 'runs'} could
          not be completed; successful runs are still shown.
        </Alert>
      )}

      <TableContainer>
        <Table size="small" aria-label="Strategy comparison report">
          <TableHead>
            <TableRow>
              <TableCell>Rank / strategy</TableCell>
              <TableCell align="right">Ending account</TableCell>
              <TableCell align="right">Dollar profit / loss</TableCell>
              <TableCell align="right">Return</TableCell>
              <TableCell align="right">Trades</TableCell>
              <TableCell align="right"><Acronym term="Win Rate" /></TableCell>
              <TableCell align="right"><Acronym term="Drawdown">Worst drop</Acronym></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={`${row.name}-${row.response?.id ?? index}`} selected={row.isPrimary}>
                <TableCell>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Typography component="span" sx={{ fontWeight: 700 }}>
                      {index + 1}. <GlossaryText>{row.name}</GlossaryText>
                    </Typography>
                    {row.isPrimary && <Chip size="small" color="primary" label="Your rule" />}
                  </Stack>
                </TableCell>
                <TableCell align="right">{formatMoney(row.finalEquity)}</TableCell>
                <TableCell align="right" sx={{ color: resultColor(row.dollarProfit), fontWeight: 700 }}>
                  {formatMoney(row.dollarProfit, { signed: true })}
                </TableCell>
                <TableCell align="right" sx={{ color: resultColor(row.summary.total_return_pct) }}>
                  {formatPct(row.summary.total_return_pct)}
                </TableCell>
                <TableCell align="right">{row.summary.num_trades ?? 0}</TableCell>
                <TableCell align="right">
                  {row.summary.win_rate == null ? '—' : `${Math.round(row.summary.win_rate * 100)}%`}
                </TableCell>
                <TableCell align="right">{formatPct(row.summary.max_drawdown_pct)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default ComparisonReport;
