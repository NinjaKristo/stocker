import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRunBackplay, mockRunBackplayComparison, mockRunSimilarStockBackplays, mockGetBuiltinStrategies } = vi.hoisted(() => ({
  mockRunBackplay: vi.fn(),
  mockRunBackplayComparison: vi.fn(),
  mockRunSimilarStockBackplays: vi.fn(),
  mockGetBuiltinStrategies: vi.fn(),
}));

vi.mock('../../api/backplay', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    runBackplay: mockRunBackplay,
    runBackplayComparison: mockRunBackplayComparison,
    runSimilarStockBackplays: mockRunSimilarStockBackplays,
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
    mockRunSimilarStockBackplays.mockResolvedValue({
      discovery: {
        symbol: 'NVDA',
        feature_run: { as_of_date: '2026-07-15' },
        strategies: [{
          id: 'technical_twins', name: 'Technical Twins', description: 'Similar charts',
          candidates: [{ symbol: 'AMD', company_name: 'AMD', similarity: 92, evidence: ['RS: 90 vs 91'] }],
        }],
      },
      runs: [],
      errors: [],
    });
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

    fireEvent.click(screen.getByRole('button', { name: 'Find similar stocks and backtest them' }));
    await waitFor(() => expect(mockRunSimilarStockBackplays).toHaveBeenCalled());
    expect(mockRunSimilarStockBackplays.mock.calls[0][0]).toEqual(expect.objectContaining({
      symbol: 'NVDA',
      starting_cash: 25000,
    }));
    expect(await screen.findByText('Similar-stock strategy report')).toBeInTheDocument();
    expect(screen.getAllByText('AMD')).toHaveLength(2);
    expect(screen.getByText('RS').closest('.MuiChip-label')).toHaveTextContent('RS: 90 vs 91');
  });
});
