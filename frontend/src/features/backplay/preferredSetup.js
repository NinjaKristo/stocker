const MA_CROSS_SETUP_PATTERN = /pullback|defensive|risk-defined|quality/i;

export function preferredSetupBuiltinId(setup) {
  return MA_CROSS_SETUP_PATTERN.test(String(setup || '')) ? 'ma_cross' : 'breakout';
}

export function preferredSetupBacktestUrl(symbol, setup) {
  const params = new URLSearchParams({
    section: 'backplay',
    mode: 'strategy',
    symbol: String(symbol || '').trim().toUpperCase(),
    strategy: preferredSetupBuiltinId(setup),
    setup: String(setup || '').trim(),
  });
  return `/validation?${params.toString()}`;
}
