import apiClient from './client';

// Run a backtest now. payload matches BackplayRunRequest:
// { mode: 'single'|'scan_top10', symbol?, preset_key?, top_n?, start_date?,
//   end_date?, strategy: {...}, starting_cash? }
export const runBackplay = async (payload) => {
  const response = await apiClient.post('/v1/backplay/run', payload);
  return response.data;
};

export const COMPARISON_STRATEGIES = [
  { name: 'Buy & Hold', strategy: { kind: 'builtin', builtin_id: 'buy_hold', params: {} } },
  { name: 'Breakout 20 / 10', strategy: { kind: 'builtin', builtin_id: 'breakout', params: { entry_lookback: 20, exit_lookback: 10 } } },
  { name: 'Fast breakout 10 / 5', strategy: { kind: 'builtin', builtin_id: 'breakout', params: { entry_lookback: 10, exit_lookback: 5 } } },
  { name: 'MA cross 10 / 50', strategy: { kind: 'builtin', builtin_id: 'ma_cross', params: { fast: 10, slow: 50 } } },
];

export const runBackplayComparison = async (basePayload, strategies = COMPARISON_STRATEGIES) => {
  const guardrails = {
    stop_loss_pct: basePayload.strategy?.stop_loss_pct ?? null,
    take_profit_pct: basePayload.strategy?.take_profit_pct ?? null,
    max_hold_days: basePayload.strategy?.max_hold_days ?? null,
  };
  const settled = await Promise.allSettled(
    strategies.map(async ({ name, strategy }) => ({
      name,
      response: await runBackplay({
        ...basePayload,
        strategy: { ...strategy, ...guardrails },
      }),
    })),
  );

  return {
    runs: settled.filter((entry) => entry.status === 'fulfilled').map((entry) => entry.value),
    errors: settled.filter((entry) => entry.status === 'rejected').map((entry) => entry.reason),
  };
};

export const listBackplayRuns = async (limit = 25) => {
  const response = await apiClient.get('/v1/backplay/runs', { params: { limit } });
  return response.data;
};

export const getBackplayRun = async (runId) => {
  const response = await apiClient.get(`/v1/backplay/runs/${runId}`);
  return response.data;
};

export const getBackplayPresets = async () => {
  const response = await apiClient.get('/v1/backplay/presets');
  return response.data;
};

export const getSimilarStocks = async (symbol, { limit = 3, market } = {}) => {
  const response = await apiClient.get(`/v1/backplay/similar/${encodeURIComponent(symbol)}`, {
    params: { limit, ...(market ? { market } : {}) },
  });
  return response.data;
};

export const runSimilarStockBackplays = async (basePayload, perStrategy = 3) => {
  const discovery = await getSimilarStocks(basePayload.symbol, {
    limit: perStrategy,
    market: basePayload.market,
  });
  const selectedBySymbol = new Map();
  for (const scanStrategy of discovery.strategies || []) {
    for (const candidate of (scanStrategy.candidates || []).slice(0, perStrategy)) {
      const existing = selectedBySymbol.get(candidate.symbol) || {
        symbol: candidate.symbol,
        scanStrategies: [],
      };
      existing.scanStrategies.push(scanStrategy.name);
      selectedBySymbol.set(candidate.symbol, existing);
    }
  }

  const settled = await Promise.allSettled(
    [...selectedBySymbol.values()].map(async (candidate) => ({
      ...candidate,
      response: await runBackplay({ ...basePayload, symbol: candidate.symbol }),
    })),
  );
  return {
    discovery,
    runs: settled.filter((entry) => entry.status === 'fulfilled').map((entry) => entry.value),
    errors: settled.filter((entry) => entry.status === 'rejected').map((entry) => entry.reason),
  };
};

export const getBuiltinStrategies = async () => {
  const response = await apiClient.get('/v1/backplay/strategies/builtins');
  return response.data;
};

export const validateBackplayScript = async (script) => {
  const response = await apiClient.post('/v1/backplay/validate-script', { script });
  return response.data;
};

export const listBackplayStrategies = async () => {
  const response = await apiClient.get('/v1/backplay/strategies');
  return response.data;
};

export const createBackplayStrategy = async (payload) => {
  const response = await apiClient.post('/v1/backplay/strategies', payload);
  return response.data;
};

export const deleteBackplayStrategy = async (strategyId) => {
  const response = await apiClient.delete(`/v1/backplay/strategies/${strategyId}`);
  return response.data;
};
