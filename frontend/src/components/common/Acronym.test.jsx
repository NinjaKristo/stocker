import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Acronym from './Acronym';

describe('Acronym', () => {
  it('shows full name and one-sentence summary on hover for a known term', async () => {
    render(<Acronym term="RS" />);
    fireEvent.mouseOver(screen.getByText('RS'));
    expect(await screen.findByText('Relative Strength')).toBeInTheDocument();
    expect(screen.getByText(/Excess return vs the market benchmark/)).toBeInTheDocument();
  });

  it('uses the term lookup even when display text differs', async () => {
    render(<Acronym term="MCap">Market Cap</Acronym>);
    fireEvent.mouseOver(screen.getByText('Market Cap'));
    expect(await screen.findByText('Market Capitalization')).toBeInTheDocument();
  });

  it('renders plain text for an unknown term (no tooltip)', () => {
    render(<Acronym term="ZZZ" />);
    expect(screen.getByText('ZZZ')).toBeInTheDocument();
  });
});
