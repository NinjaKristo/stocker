import { fireEvent, render, screen } from '@testing-library/react';

import ScanResultsSection from './ScanResultsSection';

vi.mock('../../../components/Scan/ResultsTable', () => ({
  default: () => <div>results table</div>,
}));

it('hides stale rows and surfaces a retryable results error', () => {
  const onRetry = vi.fn();

  render(
    <ScanResultsSection
      resultsLoading={false}
      resultsData={{ total: 10, results: [{ symbol: 'OLD' }] }}
      resultsError={new Error('timeout of 30000ms exceeded')}
      filters={{ minerviniScore: { min: 70 } }}
      onRetry={onRetry}
    />,
  );

  expect(screen.getByText(/results could not be loaded/i)).toHaveTextContent('timeout of 30000ms exceeded');
  expect(screen.getByText(/cached rows are hidden/i)).toBeInTheDocument();
  expect(screen.queryByText(/Results: 10 stocks/)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});
