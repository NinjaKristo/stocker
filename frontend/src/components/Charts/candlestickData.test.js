import { describe, expect, it } from 'vitest';

import { formatPriceDate, getLatestPriceDate } from './candlestickData';

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
