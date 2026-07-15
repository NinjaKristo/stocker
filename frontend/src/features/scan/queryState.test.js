import { keepPreviousScanResults } from './queryState';

const data = { total: 1, results: [{ symbol: 'AAPL' }] };

describe('keepPreviousScanResults', () => {
  it('keeps rows for pagination and sorting within the same filter', () => {
    const previousQuery = {
      queryKey: ['scanResults', 'scan-1', 1, 50, 'symbol', 'asc', 'same-filter'],
    };

    expect(keepPreviousScanResults(data, previousQuery, 'scan-1', 'same-filter')).toBe(data);
  });

  it('hides rows produced by a different filter', () => {
    const previousQuery = {
      queryKey: ['scanResults', 'scan-1', 1, 50, 'symbol', 'asc', 'old-filter'],
    };

    expect(keepPreviousScanResults(data, previousQuery, 'scan-1', 'new-filter')).toBeUndefined();
  });

  it('hides rows produced by a different scan', () => {
    const previousQuery = {
      queryKey: ['scanResults', 'scan-1', 1, 50, 'symbol', 'asc', 'same-filter'],
    };

    expect(keepPreviousScanResults(data, previousQuery, 'scan-2', 'same-filter')).toBeUndefined();
  });
});
