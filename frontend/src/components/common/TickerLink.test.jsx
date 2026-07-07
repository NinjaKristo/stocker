import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import TickerLink from './TickerLink';

const renderInRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('TickerLink', () => {
  it('links to the stock detail page', () => {
    renderInRouter(<TickerLink symbol="NVDA" />);
    expect(screen.getByRole('link', { name: 'NVDA' })).toHaveAttribute('href', '/stocks/NVDA');
  });

  it('encodes symbols with special characters', () => {
    renderInRouter(<TickerLink symbol="0700.HK" />);
    expect(screen.getByRole('link', { name: '0700.HK' })).toHaveAttribute('href', '/stocks/0700.HK');
  });

  it('stops click propagation so a parent row handler does not also fire', () => {
    const rowClick = vi.fn();
    renderInRouter(
      <div onClick={rowClick}>
        <TickerLink symbol="AAPL" />
      </div>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'AAPL' }));
    expect(rowClick).not.toHaveBeenCalled();
  });

  it('renders nothing for an empty symbol', () => {
    const { container } = renderInRouter(<TickerLink symbol="" />);
    expect(container.querySelector('a')).toBeNull();
  });

  it('shows a delayed hover bubble with company and market context', async () => {
    const user = userEvent.setup();
    renderInRouter(<TickerLink symbol="NVDA" companyName="NVIDIA Corp" market="US" />);

    await user.hover(screen.getByRole('link', { name: 'NVDA' }));

    expect(await screen.findByText('NVIDIA Corp')).toBeInTheDocument();
    expect(screen.getByText(/US ticker/)).toBeInTheDocument();
  });
});
