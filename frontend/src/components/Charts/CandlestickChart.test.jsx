import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/renderWithProviders';
import CandlestickChart from './CandlestickChart';

const mocks = vi.hoisted(() => {
  const priceScale = { applyOptions: vi.fn() };
  const makeSeries = () => ({ setData: vi.fn(), priceScale: () => priceScale });
  const timeScale = {
    fitContent: vi.fn(),
    getVisibleRange: vi.fn(() => null),
    setVisibleRange: vi.fn(),
    subscribeVisibleTimeRangeChange: vi.fn(),
    unsubscribeVisibleTimeRangeChange: vi.fn(),
  };
  return {
    fetchPriceHistory: vi.fn(),
    fetchIntradayPriceHistory: vi.fn(),
    fetchRSLine: vi.fn(),
    candlestickSeries: makeSeries(),
    bundle: {
      chart: {
        applyOptions: vi.fn(),
        remove: vi.fn(),
        resize: vi.fn(),
        subscribeCrosshairMove: vi.fn(),
        timeScale: () => timeScale,
      },
      volumeSeries: makeSeries(),
      candlestickSeries: null,
      ema10Series: makeSeries(),
      ema20Series: makeSeries(),
      ema50Series: makeSeries(),
      rsLineSeries: makeSeries(),
      rsMarkers: { setMarkers: vi.fn() },
    },
  };
});
mocks.bundle.candlestickSeries = mocks.candlestickSeries;

vi.mock('../../api/priceHistory', () => ({
  fetchPriceHistory: (...args) => mocks.fetchPriceHistory(...args),
  fetchIntradayPriceHistory: (...args) => mocks.fetchIntradayPriceHistory(...args),
  fetchRSLine: (...args) => mocks.fetchRSLine(...args),
  INTRADAY_PRICE_STALE_TIME: 60000,
  PRICE_HISTORY_STALE_TIME: 300000,
  priceHistoryKeys: {
    symbol: (symbol, period) => ['priceHistory', symbol, period],
    intraday: (symbol, interval) => ['priceHistory', 'intraday', symbol, interval],
    rsLine: (symbol, period) => ['priceHistory', 'rsLine', symbol, period],
  },
}));

vi.mock('./createPriceChartSeries', () => ({ createPriceChartSeries: () => mocks.bundle }));

describe('CandlestickChart hourly mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchPriceHistory.mockResolvedValue([
      { date: '2026-07-16', open: 100, high: 102, low: 99, close: 101, volume: 1000 },
    ]);
    mocks.fetchRSLine.mockResolvedValue({ rs_line: [], blue_dots: [] });
    mocks.fetchIntradayPriceHistory.mockResolvedValue({
      symbol: 'AAPL',
      interval: '60m',
      source: 'Yahoo Finance via yfinance',
      is_realtime: false,
      disclosure: 'Delayed market data. Do not use for order execution.',
      latest_bar_at: '2026-07-17T15:30:00-04:00',
      bars: [{
        timestamp: '2026-07-17T15:30:00-04:00',
        open: 210,
        high: 211,
        low: 209.5,
        close: 210.5,
        volume: 1234,
      }],
    });
  });

  it('loads hourly bars and labels them as delayed with the actual bar time', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CandlestickChart symbol="AAPL" height={400} />);

    await screen.findByText(/Data through Jul 16, 2026/);
    await user.click(screen.getByRole('button', { name: 'Hourly' }));

    expect(await screen.findByText(/Hourly delayed.*Yahoo Finance.*bar Jul 17/)).toBeInTheDocument();
    expect(mocks.fetchIntradayPriceHistory).toHaveBeenCalledWith('AAPL', '60m');
    expect(screen.getByRole('button', { name: 'RS' })).toBeDisabled();

    await waitFor(() => {
      const latestSet = mocks.candlestickSeries.setData.mock.calls.at(-1)?.[0];
      expect(latestSet).toHaveLength(1);
      expect(latestSet[0].time).toBe(
        Math.floor(Date.parse('2026-07-17T15:30:00-04:00') / 1000),
      );
    });
  });
});
