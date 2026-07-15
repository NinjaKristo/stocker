import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listSetups: vi.fn(),
  listTrades: vi.fn(),
  stopSetup: vi.fn(),
}));

vi.mock('../../api/backplay', () => ({
  getBackplayPresets: vi.fn().mockResolvedValue({ presets: [] }),
  getBuiltinStrategies: vi.fn().mockResolvedValue({ builtins: [] }),
  validateBackplayScript: vi.fn(),
}));

vi.mock('../../api/paper', () => ({
  listPaperSetups: mocks.listSetups,
  listPaperTrades: mocks.listTrades,
  stopPaperSetup: mocks.stopSetup,
  startPaperSetup: vi.fn(),
  deletePaperSetup: vi.fn(),
  evaluatePaperNow: vi.fn(),
  createPaperSetup: vi.fn(),
}));

import { renderWithProviders } from '../../test/renderWithProviders';
import PaperTraderPanel from './PaperTraderPanel';

describe('PaperTraderPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listSetups.mockResolvedValue({
      setups: [{
        id: 1,
        name: 'NVDA breakout',
        status: 'active',
        source_kind: 'symbol',
        symbol: 'NVDA',
        open_trades: 0,
        closed_trades: 1,
        avg_return_pct: 10,
        last_evaluated_at: '2026-07-15T20:00:00Z',
      }],
    });
    mocks.listTrades.mockResolvedValue({
      trades: [{
        id: 8,
        setup_id: 1,
        symbol: 'NVDA',
        status: 'closed',
        entry_date: '2026-07-01',
        entry_price: 100,
        shares: 100,
        exit_date: '2026-07-10',
        exit_price: 110,
        return_pct: 10,
        exit_reason: 'take_profit',
        events: [{ at: '2026-07-10', kind: 'closed', detail: 'take profit at 110.00' }],
      }],
    });
    mocks.stopSetup.mockResolvedValue({ status: 'stopped' });
  });

  it('shows daily monitors, realized dollars, and expandable trade events', async () => {
    renderWithProviders(<PaperTraderPanel />);

    expect(await screen.findByText('NVDA breakout')).toBeInTheDocument();
    expect(screen.getByText('Realized P/L: +$1,000')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show events for NVDA' }));
    expect(screen.getByText(/take profit at 110.00/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Stop NVDA breakout' }));
    await waitFor(() => expect(mocks.stopSetup).toHaveBeenCalledWith(1));
  });
});
