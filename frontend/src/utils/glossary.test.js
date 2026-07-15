import { describe, expect, it } from 'vitest';
import { findGlossaryMatches, lookupGlossary } from './glossary';

describe('glossary', () => {
  it('returns definitions for known acronyms', () => {
    expect(lookupGlossary('RS')).toMatch(/Relative Strength/);
    expect(lookupGlossary('MCap')).toMatch(/Market Cap/i);
    expect(lookupGlossary('EPS')).toMatch(/Earnings Per Share/);
    expect(lookupGlossary('ADV ($)')).toMatch(/Average Daily/);
  });

  it('is case-insensitive', () => {
    expect(lookupGlossary('vcp')).toMatch(/Volatility Contraction/);
    expect(lookupGlossary('canslim')).toMatch(/CANSLIM/);
    expect(lookupGlossary('30d')).toMatch(/30 Days/);
  });

  it('returns null for unknown or empty terms', () => {
    expect(lookupGlossary('ZZZ')).toBeNull();
    expect(lookupGlossary('')).toBeNull();
    expect(lookupGlossary(null)).toBeNull();
  });

  it('finds safe whole-token matches including punctuation and app terms', () => {
    expect(findGlossaryMatches('ADV ($), EPS Q/Q, JSON API URL').map((match) => match.term)).toEqual([
      'ADV ($)', 'EPS', 'Q/Q', 'JSON', 'API', 'URL',
    ]);
    expect(findGlossaryMatches('FORMAT MASSIVE')).toEqual([]);
  });
});
