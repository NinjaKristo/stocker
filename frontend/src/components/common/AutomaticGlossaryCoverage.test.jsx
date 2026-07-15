import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import Acronym from './Acronym';
import AutomaticGlossaryCoverage from './AutomaticGlossaryCoverage';
import { AUTO_TERMS } from '../../utils/glossary';

function DynamicLabel() {
  const [expanded, setExpanded] = useState(false);
  return (
    <button type="button" onClick={() => setExpanded(true)}>
      {expanded ? 'Export JSON through the API' : 'Export CSV'}
    </button>
  );
}

describe('AutomaticGlossaryCoverage', () => {
  it('annotates plain live and static route text with hover definitions', async () => {
    render(
      <>
        <AutomaticGlossaryCoverage />
        <div data-testid="live-label">Avg RS and EPS TTM in USD over 30d and {180}D</div>
        <svg><text data-testid="static-chart-label">RRG RS-Momentum</text></svg>
      </>,
    );

    await waitFor(() => expect(screen.getByTestId('live-label')).toHaveAttribute('data-auto-glossary'));
    expect(screen.getByTestId('live-label').title).toMatch(/RS: Relative Strength/);
    expect(screen.getByTestId('live-label').title).toMatch(/TTM: Trailing Twelve Months/);
    expect(screen.getByTestId('live-label').title).toMatch(/USD: United States Dollar/);
    expect(screen.getByTestId('live-label').title).toMatch(/30d: 30 Days/);
    expect(screen.getByTestId('live-label').title).toMatch(/180 D: 180 Days/);
    expect(screen.getByTestId('static-chart-label').getAttribute('title')).toMatch(/RRG: Relative Rotation Graph/);
  });

  it('observes dynamic labels and preserves an existing hover title', async () => {
    render(
      <>
        <AutomaticGlossaryCoverage />
        <DynamicLabel />
        <span title="Connection setting">API URL</span>
      </>,
    );

    const button = screen.getByRole('button', { name: 'Export CSV' });
    await waitFor(() => expect(button.title).toMatch(/Comma-Separated Values/));
    fireEvent.click(button);
    await waitFor(() => expect(button.title).toMatch(/JavaScript Object Notation/));
    expect(button.title).toMatch(/Application Programming Interface/);
    expect(screen.getByText('API URL').title).toMatch(/^Connection setting/);
    expect(screen.getByText('API URL').title).toMatch(/Uniform Resource Locator/);
  });

  it('leaves explicit rich acronym tooltips in control', async () => {
    render(
      <>
        <AutomaticGlossaryCoverage />
        <Acronym term="VCP" />
      </>,
    );

    const acronym = screen.getByText('VCP');
    await waitFor(() => expect(acronym).toHaveAttribute('data-glossary-term', 'VCP'));
    expect(acronym).not.toHaveAttribute('data-auto-glossary');
    expect(acronym).not.toHaveAttribute('title');
  });

  it('provides hover metadata for every audited UI acronym', async () => {
    render(
      <>
        <AutomaticGlossaryCoverage />
        {AUTO_TERMS.map((term) => <span key={term} data-testid={`term-${term}`}>{term}</span>)}
      </>,
    );

    await waitFor(() => expect(screen.getByTestId('term-P/L')).toHaveAttribute('data-auto-glossary'));
    for (const term of AUTO_TERMS) {
      const element = screen.getByTestId(`term-${term}`);
      expect(element.getAttribute('title')).not.toBeNull();
    }
  });
});
