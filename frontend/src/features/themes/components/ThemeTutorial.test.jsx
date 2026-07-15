import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ThemeTutorial from './ThemeTutorial';

describe('ThemeTutorial', () => {
  it('explains themes, evidence quality, and the backtest workflow', () => {
    render(<ThemeTutorial />);

    expect(screen.getByText('What is a theme, and how do I use it?')).toBeInTheDocument();
    expect(screen.getByText(/Unlike an industry, it can span several sectors/)).toBeInTheDocument();
    expect(screen.getByText(/Avoid single-stock spikes/)).toBeInTheDocument();
    expect(screen.getByText(/A theme is context, not a buy signal/)).toBeInTheDocument();
  });
});
