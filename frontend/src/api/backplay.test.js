import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockApiClient } = vi.hoisted(() => ({
  mockApiClient: { post: vi.fn(), get: vi.fn(), delete: vi.fn() },
}));

vi.mock('./client', () => ({ default: mockApiClient }));

import { COMPARISON_STRATEGIES, runBackplayComparison } from './backplay';

describe('Backplay comparison API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs every alternative with identical context and guardrails', async () => {
    mockApiClient.post.mockImplementation(async (_url, payload) => ({
      data: { id: payload.strategy.builtin_id, results: { summary: {} } },
    }));
    const basePayload = {
      mode: 'single',
      symbol: 'NVDA',
      start_date: '2024-01-01',
      end_date: '2024-12-31',
      starting_cash: 25000,
      strategy: {
        kind: 'script',
        entry_script: 'close > SMA(close, 20)',
        stop_loss_pct: 7,
        take_profit_pct: 18,
        max_hold_days: 30,
      },
    };

    const result = await runBackplayComparison(basePayload);

    expect(result.runs).toHaveLength(COMPARISON_STRATEGIES.length);
    expect(result.errors).toEqual([]);
    expect(mockApiClient.post).toHaveBeenCalledTimes(COMPARISON_STRATEGIES.length);
    for (const [, payload] of mockApiClient.post.mock.calls) {
      expect(payload).toMatchObject({
        mode: 'single',
        symbol: 'NVDA',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        starting_cash: 25000,
        strategy: {
          kind: 'builtin',
          stop_loss_pct: 7,
          take_profit_pct: 18,
          max_hold_days: 30,
        },
      });
    }
  });

  it('keeps successful reports when one alternative fails', async () => {
    mockApiClient.post
      .mockRejectedValueOnce(new Error('missing history'))
      .mockResolvedValue({ data: { id: 2, results: { summary: {} } } });

    const result = await runBackplayComparison({
      mode: 'single',
      symbol: 'NVDA',
      starting_cash: 10000,
      strategy: {},
    });

    expect(result.runs).toHaveLength(COMPARISON_STRATEGIES.length - 1);
    expect(result.errors).toHaveLength(1);
  });
});
