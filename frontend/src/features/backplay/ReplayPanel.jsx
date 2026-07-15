/**
 * Replay (Backplay mode 1) — TradingView-style bar replay.
 *
 * The candlestick chart (lightweight-charts, the same library TradingView
 * open-sourced) reveals one day per tick; Buy/Sell act at the latest visible
 * close with an all-in $10,000 paper balance. You can't see tomorrow's bars
 * before deciding — that's the whole point.
 */
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Paper,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material';
import FastForwardIcon from '@mui/icons-material/FastForward';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ReplayIcon from '@mui/icons-material/Replay';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { getPriceHistory } from '../../api/stocks';
import Acronym from '../../components/common/Acronym';
import { formatPct } from './BacktestResults';
import {
  createReplayState,
  currentBar,
  currentEquity,
  openPositionPl,
  replayReducer,
} from './replayEngine';

const SPEED_OPTIONS = [
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
  { value: 4, label: '4×' },
  { value: 8, label: '8×' },
];
const BASE_TICK_MS = 700;
const INITIAL_VISIBLE_BARS = 40;

function ReplayChart({ bars, cursor, trades, entryDate }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const { createChart, CandlestickSeries, HistogramSeries, createSeriesMarkers } = await import(
        'lightweight-charts'
      );
      if (disposed || !containerRef.current) return;

      const chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: 380,
        layout: {
          background: { type: 'solid', color: isDarkMode ? '#1e1e1e' : '#ffffff' },
          textColor: isDarkMode ? '#d1d4dc' : '#333333',
        },
        grid: {
          vertLines: { color: isDarkMode ? '#363a45' : '#e0e0e0' },
          horzLines: { color: isDarkMode ? '#363a45' : '#e0e0e0' },
        },
        timeScale: { borderColor: isDarkMode ? '#485263' : '#cccccc' },
        rightPriceScale: { borderColor: isDarkMode ? '#485263' : '#cccccc' },
      });
      const candles = chart.addSeries(CandlestickSeries, {
        upColor: '#2196f3',
        downColor: '#E619CD',
        borderVisible: false,
        wickUpColor: '#2196f3',
        wickDownColor: '#E619CD',
      });
      const volume = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
        color: isDarkMode ? '#546e7a' : '#b0bec5',
      });
      volume.priceScale().applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } });
      const markers = createSeriesMarkers(candles, []);

      chartRef.current = { chart, candles, volume, markers };

      const handleResize = () => {
        if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
      };
      window.addEventListener('resize', handleResize);
      cleanup = () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
        chartRef.current = null;
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [isDarkMode]);

  useEffect(() => {
    const handles = chartRef.current;
    if (!handles) return;
    const visible = bars.slice(0, cursor);
    handles.candles.setData(
      visible.map((bar) => ({
        time: bar.date,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      }))
    );
    handles.volume.setData(visible.map((bar) => ({ time: bar.date, value: bar.volume })));

    const markers = [];
    for (const trade of trades) {
      markers.push({
        time: trade.entryDate,
        position: 'belowBar',
        color: '#4caf50',
        shape: 'arrowUp',
        text: 'Buy',
      });
      markers.push({
        time: trade.exitDate,
        position: 'aboveBar',
        color: '#f44336',
        shape: 'arrowDown',
        text: 'Sell',
      });
    }
    if (entryDate) {
      markers.push({
        time: entryDate,
        position: 'belowBar',
        color: '#4caf50',
        shape: 'arrowUp',
        text: 'Buy',
      });
    }
    markers.sort((a, b) => (a.time < b.time ? -1 : 1));
    handles.markers.setMarkers(markers);
    handles.chart.timeScale().scrollToRealTime();
  }, [bars, cursor, trades, entryDate]);

  return <Box ref={containerRef} sx={{ width: '100%', minHeight: 380 }} />;
}

function ReplayPanel({ prefillSymbol = '' }) {
  const [symbolInput, setSymbolInput] = useState(prefillSymbol);
  const [loadedSymbol, setLoadedSymbol] = useState('');
  const [state, dispatch] = useReducer(replayReducer, undefined, createReplayState);

  const { data: history, isFetching, error } = useQuery({
    queryKey: ['replayHistory', loadedSymbol],
    queryFn: () => getPriceHistory(loadedSymbol, '5y'),
    enabled: Boolean(loadedSymbol),
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (history?.length) {
      dispatch({ type: 'LOAD', bars: history, visibleBars: INITIAL_VISIBLE_BARS, startingCash: 10000 });
    }
  }, [history]);

  // The play loop: one STEP per tick while playing.
  useEffect(() => {
    if (!state.playing) return undefined;
    const interval = setInterval(() => dispatch({ type: 'STEP' }), BASE_TICK_MS / state.speed);
    return () => clearInterval(interval);
  }, [state.playing, state.speed]);

  const bar = currentBar(state);
  const equity = currentEquity(state);
  const positionPl = openPositionPl(state);
  const holding = state.shares > 0;

  const sessionReturnPct = useMemo(
    () => (state.bars.length ? (equity / state.startingCash - 1) * 100 : null),
    [equity, state.bars.length, state.startingCash]
  );

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            <Acronym term="Bar Replay">Bar replay</Acronym>: the chart plays the past one day at a
            time. Press <b>Buy</b> when you&apos;d get in and <b>Sell</b> when you&apos;d get out — your
            paper $10,000 keeps score. No peeking ahead.
          </Typography>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              label="Stock"
              placeholder="e.g. NVDA"
              size="small"
              value={symbolInput}
              onChange={(event) => setSymbolInput(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && symbolInput.trim()) setLoadedSymbol(symbolInput.trim());
              }}
              sx={{ width: 140 }}
            />
            <Button
              variant="contained"
              disabled={!symbolInput.trim() || isFetching}
              onClick={() => setLoadedSymbol(symbolInput.trim())}
              startIcon={isFetching ? <CircularProgress size={16} color="inherit" /> : null}
            >
              Load chart
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {error && <Alert severity="error">Could not load price history for {loadedSymbol}.</Alert>}

      {state.bars.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Button
                variant="contained"
                size="small"
                startIcon={state.playing ? <PauseIcon /> : <PlayArrowIcon />}
                onClick={() => dispatch({ type: state.playing ? 'PAUSE' : 'PLAY' })}
                disabled={state.done}
              >
                {state.playing ? 'Pause' : 'Play'}
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<SkipNextIcon />}
                onClick={() => dispatch({ type: 'STEP' })}
                disabled={state.done}
              >
                Next day
              </Button>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={state.speed}
                onChange={(_, speed) => speed && dispatch({ type: 'SET_SPEED', speed })}
              >
                {SPEED_OPTIONS.map((option) => (
                  <ToggleButton key={option.value} value={option.value}>
                    <FastForwardIcon sx={{ fontSize: 14, mr: 0.25 }} />
                    {option.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <Button
                variant="outlined"
                size="small"
                color="warning"
                startIcon={<ReplayIcon />}
                onClick={() => dispatch({ type: 'RESET' })}
              >
                Start over
              </Button>
              <Box sx={{ flexGrow: 1 }} />
              <Button
                variant="contained"
                color="success"
                disabled={holding || state.done || !bar}
                onClick={() => dispatch({ type: 'BUY' })}
              >
                Buy
              </Button>
              <Button
                variant="contained"
                color="error"
                disabled={!holding || !bar}
                onClick={() => dispatch({ type: 'SELL' })}
              >
                Sell
              </Button>
            </Stack>

            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <Card variant="outlined" sx={{ minWidth: 140 }}>
                <CardContent sx={{ py: 1 }}>
                  <Typography variant="caption" color="text.secondary" component="div">
                    {loadedSymbol} — {bar?.date}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    ${bar?.close?.toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
              <Card variant="outlined" sx={{ minWidth: 140 }}>
                <CardContent sx={{ py: 1 }}>
                  <Typography variant="caption" color="text.secondary" component="div">
                    Paper account
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 700, color: sessionReturnPct >= 0 ? 'success.main' : 'error.main' }}
                  >
                    ${equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}
                    <Typography component="span" variant="caption">
                      ({formatPct(sessionReturnPct)})
                    </Typography>
                  </Typography>
                </CardContent>
              </Card>
              <Card variant="outlined" sx={{ minWidth: 160 }}>
                <CardContent sx={{ py: 1 }}>
                  <Typography variant="caption" color="text.secondary" component="div">
                    Position
                  </Typography>
                  {holding ? (
                    <Typography variant="h6" sx={{ fontWeight: 700, color: positionPl >= 0 ? 'success.main' : 'error.main' }}>
                      In since {state.entryDate} ({formatPct(positionPl)})
                    </Typography>
                  ) : (
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Out
                    </Typography>
                  )}
                </CardContent>
              </Card>
              <Card variant="outlined" sx={{ minWidth: 130 }}>
                <CardContent sx={{ py: 1 }}>
                  <Typography variant="caption" color="text.secondary" component="div">
                    Progress
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {state.cursor}/{state.bars.length} days
                    {state.done && <Chip size="small" color="info" label="finished" sx={{ ml: 1 }} />}
                  </Typography>
                </CardContent>
              </Card>
            </Stack>

            <ReplayChart
              bars={state.bars}
              cursor={state.cursor}
              trades={state.trades}
              entryDate={holding ? state.entryDate : null}
            />

            <Slider
              size="small"
              value={state.cursor}
              min={state.initialCursor}
              max={state.bars.length}
              disabled
              sx={{ mx: 1 }}
            />

            {state.trades.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {state.trades.map((trade, index) => (
                  <Chip
                    key={`${trade.entryDate}-${index}`}
                    size="small"
                    variant="outlined"
                    color={trade.returnPct >= 0 ? 'success' : 'error'}
                    label={`${trade.entryDate} → ${trade.exitDate}: ${formatPct(trade.returnPct)}`}
                  />
                ))}
              </Stack>
            )}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

export default ReplayPanel;
