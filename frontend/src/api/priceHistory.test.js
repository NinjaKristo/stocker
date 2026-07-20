import { beforeEach, describe, expect, it, vi } from 'vitest';

import apiClient from './client';
import {
  fetchIntradayPriceHistory,
  INTRADAY_PRICE_STALE_TIME,
  priceHistoryKeys,
} from './priceHistory';

vi.mock('./client', () => ({ default: { get: vi.fn() } }));

describe('delayed hourly price API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requests 60-minute bars and retains the metadata contract', async () => {
    const payload = { symbol: 'AAPL', interval: '60m', is_realtime: false, bars: [] };
    apiClient.get.mockResolvedValue({ data: payload });

    await expect(fetchIntradayPriceHistory('AAPL')).resolves.toEqual(payload);
    expect(apiClient.get).toHaveBeenCalledWith('/v1/stocks/AAPL/intraday', {
      params: { interval: '60m' },
    });
    expect(priceHistoryKeys.intraday('AAPL')).toEqual([
      'priceHistory', 'intraday', 'AAPL', '60m',
    ]);
    expect(INTRADAY_PRICE_STALE_TIME).toBe(60000);
  });
});
