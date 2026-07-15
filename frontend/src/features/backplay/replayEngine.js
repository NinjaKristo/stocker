/**
 * Replay engine — pure reducer for Backplay mode 1 (TradingView-style bar
 * replay). The chart shows bars[0..cursor); Buy/Sell act at the latest
 * visible bar's close with an all-in paper balance.
 */

export function createReplayState() {
  return {
    bars: [],
    initialCursor: 0,
    cursor: 0,
    startingCash: 10000,
    cash: 10000,
    shares: 0,
    entryPrice: null,
    entryDate: null,
    trades: [],
    playing: false,
    speed: 1,
    done: false,
  };
}

export function currentBar(state) {
  if (state.cursor < 1 || state.bars.length === 0) return null;
  return state.bars[Math.min(state.cursor, state.bars.length) - 1];
}

export function currentEquity(state) {
  const bar = currentBar(state);
  const marked = state.shares > 0 && bar ? state.shares * bar.close : 0;
  return state.cash + marked;
}

export function openPositionPl(state) {
  const bar = currentBar(state);
  if (state.shares <= 0 || !state.entryPrice || !bar) return null;
  return (bar.close / state.entryPrice - 1) * 100;
}

export function replayReducer(state, action) {
  switch (action.type) {
    case 'LOAD': {
      const bars = action.bars || [];
      const visible = Math.max(1, Math.min(action.visibleBars ?? 30, bars.length));
      const startingCash = action.startingCash ?? 10000;
      return {
        ...createReplayState(),
        bars,
        initialCursor: visible,
        cursor: visible,
        startingCash,
        cash: startingCash,
        done: visible >= bars.length,
      };
    }

    case 'STEP': {
      if (state.done || state.cursor >= state.bars.length) return state;
      const cursor = state.cursor + 1;
      const done = cursor >= state.bars.length;
      return { ...state, cursor, done, playing: done ? false : state.playing };
    }

    case 'BUY': {
      const bar = currentBar(state);
      if (state.shares > 0 || !bar || bar.close <= 0 || state.cash <= 0) return state;
      return {
        ...state,
        shares: state.cash / bar.close,
        cash: 0,
        entryPrice: bar.close,
        entryDate: bar.date,
      };
    }

    case 'SELL': {
      const bar = currentBar(state);
      if (state.shares <= 0 || !bar) return state;
      const proceeds = state.shares * bar.close;
      const trade = {
        entryDate: state.entryDate,
        entryPrice: state.entryPrice,
        exitDate: bar.date,
        exitPrice: bar.close,
        returnPct: state.entryPrice ? (bar.close / state.entryPrice - 1) * 100 : null,
      };
      return {
        ...state,
        cash: proceeds,
        shares: 0,
        entryPrice: null,
        entryDate: null,
        trades: [...state.trades, trade],
      };
    }

    case 'PLAY':
      return state.done ? state : { ...state, playing: true };

    case 'PAUSE':
      return { ...state, playing: false };

    case 'SET_SPEED':
      return { ...state, speed: action.speed };

    case 'RESET':
      return {
        ...state,
        cursor: state.initialCursor,
        cash: state.startingCash,
        shares: 0,
        entryPrice: null,
        entryDate: null,
        trades: [],
        playing: false,
        done: state.initialCursor >= state.bars.length,
      };

    default:
      return state;
  }
}
