import { describe, expect, it } from 'vitest';

import {
  chartTimeForPoint,
  formatPriceDate,
  formatPriceTimestamp,
  getLatestPriceDate,
  transformToCandlestickData,
} from './candlestickData';

describe('candlestick data freshness label', () => {
  it('uses the newest market-session date instead of response time', () => {
    const data = [
      { date: '2026-07-14', close: 100 },
      { date: '2026-07-16', close: 102 },
      { date: '2026-07-15', close: 101 },
    ];

    expect(getLatestPriceDate(data)).toBe('2026-07-16');
    expect(formatPriceDate(getLatestPriceDate(data))).toBe('Jul 16, 2026');
  });

  it('ignores malformed and missing dates', () => {
    expect(getLatestPriceDate([{ date: 'yesterday' }, {}, null])).toBeNull();
    expect(formatPriceDate(null)).toBeNull();
  });
});

describe('intraday candlestick data', () => {
  it('converts offset timestamps to Lightweight Charts UTC seconds', () => {
    const timestamp = '2026-07-17T15:55:00-04:00';
    const expected = Math.floor(Date.parse(timestamp) / 1000);

    expect(chartTimeForPoint({ timestamp })).toBe(expected);
    expect(transformToCandlestickData([
      { timestamp, open: 100, high: 102, low: 99, close: 101, volume: 1200 },
    ]).candlesticks[0].time).toBe(expected);
  });

  it('formats the actual latest bar time instead of the request time', () => {
    expect(formatPriceTimestamp('not-a-time')).toBeNull();
    expect(formatPriceTimestamp('2026-07-17T15:55:00-04:00')).toContain('Jul 17');
  });
});
