import {
  Alert,
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

import Acronym from '../../components/common/Acronym';
import GlossaryText from '../../components/common/GlossaryText';
import { formatMoney, formatPct } from './BacktestResults';

function outcomeFor(result, symbol) {
  const run = (result.runs || []).find((entry) => entry.symbol === symbol);
  if (!run) return null;
  const summary = run.response?.results?.summary || {};
  const startingCash = Number(summary.starting_cash ?? 0);
  return {
    ...summary,
    runId: run.response?.id,
    dollarProfit: Number(summary.final_equity ?? startingCash) - startingCash,
  };
}

function SimilarStocksReport({ result }) {
  const discovery = result?.discovery;
  if (!discovery) return null;

  return (
    <Stack spacing={2}>
      <Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Similar-stock strategy report</Typography>
          <Chip size="small" label={`${result.runs?.length || 0} peer backtests`} />
          {discovery.feature_run?.as_of_date && (
            <Chip size="small" variant="outlined" label={`Peers as of ${discovery.feature_run.as_of_date}`} />
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Three explainable scans compared today&apos;s feature snapshot with {discovery.symbol}. The
          original rule was then replayed on each peer using the same dates and starting budget.
        </Typography>
      </Box>

      {result.errors?.length > 0 && (
        <Alert severity="warning">
          {result.errors.length} peer {result.errors.length === 1 ? 'backtest' : 'backtests'} could not
          run because cached price history was unavailable.
        </Alert>
      )}

      {(discovery.strategies || []).map((strategy) => (
        <Card key={strategy.id} variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              <GlossaryText>{strategy.name}</GlossaryText>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {strategy.description}
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Peer</TableCell>
                    <TableCell align="right">Similarity</TableCell>
                    <TableCell>Why it matched</TableCell>
                    <TableCell align="right">Backtest return</TableCell>
                    <TableCell align="right">Dollar profit / loss</TableCell>
                    <TableCell align="right"><Acronym term="Drawdown">Worst drop</Acronym></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(strategy.candidates || []).map((candidate) => {
                    const outcome = outcomeFor(result, candidate.symbol);
                    return (
                      <TableRow key={candidate.symbol}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{candidate.symbol}</Typography>
                          <Typography variant="caption" color="text.secondary">{candidate.company_name}</Typography>
                        </TableCell>
                        <TableCell align="right">{candidate.similarity.toFixed(1)}%</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            {(candidate.evidence || []).map((evidence) => (
                              <Chip key={evidence} size="small" variant="outlined" label={<GlossaryText>{evidence}</GlossaryText>} />
                            ))}
                          </Stack>
                        </TableCell>
                        <TableCell align="right">{outcome ? formatPct(outcome.total_return_pct) : 'Not tested'}</TableCell>
                        <TableCell align="right" sx={{ color: outcome ? (outcome.dollarProfit >= 0 ? 'success.main' : 'error.main') : 'text.secondary', fontWeight: 700 }}>
                          {outcome ? formatMoney(outcome.dollarProfit, { signed: true }) : '—'}
                        </TableCell>
                        <TableCell align="right">{outcome ? formatPct(outcome.max_drawdown_pct) : '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

export default SimilarStocksReport;
