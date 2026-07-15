import { describe, expect, it } from 'vitest';
import { preferredSetupBacktestUrl, preferredSetupBuiltinId } from './preferredSetup';

describe('preferred setup backtest routing', () => {
  it('maps breakout-style setups to the breakout rule', () => {
    expect(preferredSetupBuiltinId('Stage 2 breakouts')).toBe('breakout');
  });

  it('maps pullback-style setups to the moving-average rule', () => {
    expect(preferredSetupBuiltinId('Tight risk-defined pullbacks')).toBe('ma_cross');
  });

  it('builds a prefilled validation URL', () => {
    const url = new URL(preferredSetupBacktestUrl('nvda', 'Stage 2 breakouts'), 'http://local');
    expect(url.pathname).toBe('/validation');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      section: 'backplay',
      mode: 'strategy',
      symbol: 'NVDA',
      strategy: 'breakout',
      setup: 'Stage 2 breakouts',
    });
  });
});
