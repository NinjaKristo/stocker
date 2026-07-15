import { describe, expect, it } from 'vitest';

import { buildComparisonRows } from './ComparisonReport';

function response(id, finalEquity, startingCash = 10000) {
  return {
    id,
    results: {
      summary: {
        starting_cash: startingCash,
        final_equity: finalEquity,
        total_return_pct: (finalEquity / startingCash - 1) * 100,
      },
    },
  };
}

describe('comparison report rows', () => {
  it('ranks all strategies by ending account and keeps dollar profit', () => {
    const rows = buildComparisonRows(response(1, 11000), {
      runs: [
        { name: 'Winner', response: response(2, 14000) },
        { name: 'Loser', response: response(3, 9000) },
      ],
    });

    expect(rows.map((row) => row.name)).toEqual(['Winner', 'Your rule', 'Loser']);
    expect(rows.map((row) => row.dollarProfit)).toEqual([4000, 1000, -1000]);
    expect(rows.find((row) => row.isPrimary)?.name).toBe('Your rule');
  });
});
