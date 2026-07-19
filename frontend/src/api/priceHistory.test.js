import { beforeEach, describe, expect, it, vi } from 'vitest';

import apiClient from './client';
import {
  fetchIntradayPriceHistory,
  INTRADAY_PRICE_STALE_TIME,
  priceHistoryKeys,
} from './priceHistory';

vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('delayed intraday price API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests the explicit intraday endpoint and retains its metadata contract', async () => {
    const payload = {
      symbol: 'AAPL',
      interval: '5m',
      is_realtime: false,
      latest_bar_at: '2026-07-17T15:55:00-04:00',
      bars: [],
    };
    apiClient.get.mockResolvedValue({ data: payload });

    await expect(fetchIntradayPriceHistory('AAPL')).resolves.toEqual(payload);

    expect(apiClient.get).toHaveBeenCalledWith('/v1/stocks/AAPL/intraday', {
      params: { interval: '5m' },
    });
    expect(priceHistoryKeys.intraday('AAPL')).toEqual([
      'priceHistory',
      'intraday',
      'AAPL',
      '5m',
    ]);
    expect(INTRADAY_PRICE_STALE_TIME).toBe(60000);
  });
});
