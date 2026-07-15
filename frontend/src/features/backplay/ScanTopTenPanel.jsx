/**
 * Scan Top 10 (Backplay mode 2) — a scan preset picks today's 10 best-scoring
 * stocks, then the same rule is tested on each of them.
 */
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { Fragment, useState } from 'react';

import { getBackplayPresets, runBackplay } from '../../api/backplay';
import Acronym from '../../components/common/Acronym';
import TickerLink from '../../components/common/TickerLink';
import BacktestResults, { formatPct } from './BacktestResults';
import StrategyPicker, { DEFAULT_STRATEGY } from './StrategyPicker';

function CombinedCards({ combined }) {
  if (!combined) return null;
  const items = [
    { label: 'Stocks tested', value: combined.symbols_tested },
    {
      label: 'Average result',
      value: formatPct(combined.avg_return_pct),
      color: combined.avg_return_pct >= 0 ? 'success.main' : 'error.main',
    },
    { label: 'Ended positive', value: `${combined.positive_symbols}/${combined.symbols_tested}` },
    {
      label: 'Avg win rate',
      value: combined.avg_win_rate == null ? '—' : `${Math.round(combined.avg_win_rate * 100)}%`,
    },
  ];
  return (
    <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
      {items.map((item) => (
        <Card key={item.label} variant="outlined" sx={{ minWidth: 130, flex: '1 1 130px' }}>
          <CardContent sx={{ py: 1 }}>
            <Typography variant="caption" color="text.secondary" component="div">
              {item.label}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: item.color }}>
              {item.value ?? '—'}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

function PerSymbolRow({ entry }) {
  const [open, setOpen] = useState(false);
  const summary = entry.summary;
  return (
    <Fragment>
      <TableRow hover>
        <TableCell>
          <IconButton size="small" onClick={() => setOpen((value) => !value)} disabled={entry.skipped}>
            {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell>
          <TickerLink symbol={entry.symbol} companyName={entry.company_name} />
        </TableCell>
        <TableCell align="right">{entry.composite_score?.toFixed(1) ?? '—'}</TableCell>
        {entry.skipped ? (
          <TableCell colSpan={4}>
            <Chip size="small" variant="outlined" label="no price history cached" />
          </TableCell>
        ) : (
          <Fragment>
            <TableCell
              align="right"
              sx={{ color: summary?.total_return_pct >= 0 ? 'success.main' : 'error.main', fontWeight: 600 }}
            >
              {formatPct(summary?.total_return_pct)}
            </TableCell>
            <TableCell align="right">{formatPct(summary?.buy_hold_return_pct)}</TableCell>
            <TableCell align="right">{summary?.num_trades ?? 0}</TableCell>
            <TableCell align="right">
              {summary?.win_rate == null ? '—' : `${Math.round(summary.win_rate * 100)}%`}
            </TableCell>
          </Fragment>
        )}
      </TableRow>
      {!entry.skipped && (
        <TableRow>
          <TableCell colSpan={7} sx={{ py: 0, border: 0 }}>
            <Collapse in={open} unmountOnExit>
              <Paper variant="outlined" sx={{ p: 2, my: 1 }}>
                <BacktestResults
                  results={{ summary: entry.summary, trades: entry.trades, equity_curve: entry.equity_curve }}
                />
              </Paper>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}

function ScanTopTenPanel() {
  const [presetKey, setPresetKey] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [strategy, setStrategy] = useState(DEFAULT_STRATEGY);

  const { data: presetData } = useQuery({
    queryKey: ['backplayPresets'],
    queryFn: getBackplayPresets,
    staleTime: 5 * 60 * 1000,
  });
  const presets = presetData?.presets || [];

  const mutation = useMutation({ mutationFn: runBackplay });

  const handleRun = () => {
    mutation.mutate({
      mode: 'scan_top10',
      preset_key: presetKey,
      strategy,
      ...(startDate ? { start_date: startDate } : {}),
      ...(endDate ? { end_date: endDate } : {}),
    });
  };

  const results = mutation.data?.results;
  const errorDetail = mutation.error?.response?.data?.detail;

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            <Acronym term="Scan2Trade">Scan-to-trade</Acronym>: the scan preset picks today&apos;s 10
            highest-scoring stocks, then your rule is tested on each of them. It answers &quot;does my
            rule work on the kind of stock this scan finds?&quot; — the picks come from today&apos;s scan,
            the test runs backwards over history.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              select
              label="Scan preset"
              size="small"
              value={presetKey}
              onChange={(event) => setPresetKey(event.target.value)}
              sx={{ minWidth: 260 }}
            >
              {presets.map((preset) => (
                <MenuItem key={preset.key} value={preset.key}>
                  {preset.name} {preset.source === 'custom' ? '(saved)' : ''}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="From"
              type="date"
              size="small"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="To"
              type="date"
              size="small"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>
          <StrategyPicker value={strategy} onChange={setStrategy} />
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
              disabled={!presetKey || mutation.isPending}
              onClick={handleRun}
            >
              Find top 10 & backtest
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {mutation.isError && (
        <Alert severity="error">{errorDetail || 'The scan backtest failed — try another preset.'}</Alert>
      )}

      {results && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {mutation.data.preset_name} — top {results.per_symbol?.length ?? 0} stocks, one rule
            </Typography>
            <CombinedCards combined={results.combined} />
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width={36} />
                    <TableCell>Stock</TableCell>
                    <TableCell align="right">Scan score</TableCell>
                    <TableCell align="right">Rule result</TableCell>
                    <TableCell align="right">Just holding</TableCell>
                    <TableCell align="right">Trades</TableCell>
                    <TableCell align="right">Win rate</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(results.per_symbol || []).map((entry) => (
                    <PerSymbolRow key={entry.symbol} entry={entry} />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

export default ScanTopTenPanel;
