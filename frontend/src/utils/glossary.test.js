import { describe, expect, it } from 'vitest';
import { lookupGlossary } from './glossary';

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
  });

  it('returns null for unknown or empty terms', () => {
    expect(lookupGlossary('ZZZ')).toBeNull();
    expect(lookupGlossary('')).toBeNull();
    expect(lookupGlossary(null)).toBeNull();
  });
});
