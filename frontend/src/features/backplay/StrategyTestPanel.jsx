/**
 * Strategy Test (Backplay mode 3) — one stock, a date range, a rule.
 * Runs the backend engine and shows plain-language results.
 */
import { useMutation } from '@tanstack/react-query';
import { Alert, Button, CircularProgress, InputAdornment, Paper, Stack, TextField, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import { useState } from 'react';

import { runBackplay, runBackplayComparison } from '../../api/backplay';
import BacktestResults from './BacktestResults';
import ComparisonReport from './ComparisonReport';
import StrategyPicker, { DEFAULT_STRATEGY } from './StrategyPicker';

function StrategyTestPanel({ prefillSymbol = '' }) {
  const [symbol, setSymbol] = useState(prefillSymbol);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startingCash, setStartingCash] = useState(10000);
  const [strategy, setStrategy] = useState(DEFAULT_STRATEGY);

  const mutation = useMutation({ mutationFn: runBackplay });
  const comparisonMutation = useMutation({ mutationFn: runBackplayComparison });

  const buildPayload = () => ({
    mode: 'single',
    symbol: symbol.trim().toUpperCase(),
    strategy,
    starting_cash: Number(startingCash),
    ...(startDate ? { start_date: startDate } : {}),
    ...(endDate ? { end_date: endDate } : {}),
  });

  const handleRun = () => {
    comparisonMutation.reset();
    mutation.mutate(buildPayload());
  };

  const errorDetail = mutation.error?.response?.data?.detail;

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Pick a stock and a rule; the test walks through past days one at a time, buying and
            selling exactly when the rule says — then shows what would have happened.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              label="Stock"
              placeholder="e.g. NVDA"
              size="small"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value.toUpperCase())}
              sx={{ width: 140 }}
            />
            <TextField
              label="From"
              type="date"
              size="small"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Starting budget"
              type="number"
              size="small"
              value={startingCash}
              onChange={(event) => setStartingCash(event.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              inputProps={{ min: 1, step: 1000 }}
              sx={{ width: 180 }}
            />
            <TextField
              label="To"
              type="date"
              size="small"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
          <StrategyPicker value={strategy} onChange={setStrategy} />
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button
              variant="contained"
              startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
              disabled={!symbol.trim() || !Number(startingCash) || Number(startingCash) <= 0 || mutation.isPending}
              onClick={handleRun}
            >
              Run backtest
            </Button>
            <Typography variant="caption" color="text.secondary">
              Leave dates empty to use all cached history (up to 5 years).
            </Typography>
          </Stack>
        </Stack>
      </Paper>

      {mutation.isError && (
        <Alert severity="error">{errorDetail || 'The backtest failed — try another stock or rule.'}</Alert>
      )}

      {mutation.data && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            {mutation.data.symbol} — what the rule would have done
          </Typography>
          <BacktestResults results={mutation.data.results} />
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={comparisonMutation.isPending ? <CircularProgress size={16} /> : <CompareArrowsIcon />}
              disabled={comparisonMutation.isPending}
              onClick={() => comparisonMutation.mutate(mutation.variables)}
            >
              Compare 4 alternative strategies
            </Button>
            <Typography variant="caption" color="text.secondary">
              Spawns four saved backtests using the same dates and budget.
            </Typography>
          </Stack>
        </Paper>
      )}

      {comparisonMutation.isError && (
        <Alert severity="error">The comparison report could not be created.</Alert>
      )}

      {comparisonMutation.data && mutation.data && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <ComparisonReport primary={mutation.data} comparison={comparisonMutation.data} />
        </Paper>
      )}
    </Stack>
  );
}

export default StrategyTestPanel;
