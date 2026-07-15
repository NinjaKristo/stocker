import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRunBackplay, mockRunBackplayComparison, mockGetBuiltinStrategies } = vi.hoisted(() => ({
  mockRunBackplay: vi.fn(),
  mockRunBackplayComparison: vi.fn(),
  mockGetBuiltinStrategies: vi.fn(),
}));

vi.mock('../../api/backplay', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    runBackplay: mockRunBackplay,
    runBackplayComparison: mockRunBackplayComparison,
    getBuiltinStrategies: mockGetBuiltinStrategies,
  };
});

import { renderWithProviders } from '../../test/renderWithProviders';
import StrategyTestPanel from './StrategyTestPanel';

const PRIMARY_RESULT = {
  id: 11,
  symbol: 'NVDA',
  results: {
    summary: {
      starting_cash: 25000,
      final_equity: 27500,
      total_return_pct: 10,
      buy_hold_return_pct: 8,
      num_trades: 2,
      win_rate: 0.5,
      max_drawdown_pct: -4,
    },
    equity_curve: [],
    trades: [],
  },
};

describe('StrategyTestPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBuiltinStrategies.mockResolvedValue({ builtins: [] });
    mockRunBackplay.mockResolvedValue(PRIMARY_RESULT);
    mockRunBackplayComparison.mockResolvedValue({ runs: [], errors: [] });
  });

  it('uses the selected budget and compares against the original run inputs', async () => {
    renderWithProviders(<StrategyTestPanel prefillSymbol="NVDA" />);

    const budget = screen.getByLabelText('Starting budget');
    fireEvent.change(budget, { target: { value: '25000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run backtest' }));

    await waitFor(() => expect(mockRunBackplay).toHaveBeenCalled());
    expect(mockRunBackplay.mock.calls[0][0]).toEqual(expect.objectContaining({
      symbol: 'NVDA',
      starting_cash: 25000,
    }));
    expect(await screen.findByText('+$2,500')).toBeInTheDocument();

    fireEvent.change(budget, { target: { value: '99999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Compare 4 alternative strategies' }));

    await waitFor(() => expect(mockRunBackplayComparison).toHaveBeenCalled());
    expect(mockRunBackplayComparison.mock.calls[0][0]).toEqual(expect.objectContaining({
      symbol: 'NVDA',
      starting_cash: 25000,
    }));
    expect(await screen.findByText('Strategy comparison report')).toBeInTheDocument();
  });
});
