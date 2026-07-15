// Tests for the Replay (Backplay mode 1) reducer — pure trading bookkeeping.
import { describe, expect, it } from 'vitest';

import {
  createReplayState,
  replayReducer,
  currentBar,
  currentEquity,
  openPositionPl,
} from './replayEngine';

const BARS = [
  { date: '2024-01-02', open: 10, high: 10, low: 10, close: 10, volume: 100 },
  { date: '2024-01-03', open: 11, high: 11, low: 11, close: 11, volume: 100 },
  { date: '2024-01-04', open: 12, high: 12, low: 12, close: 12, volume: 100 },
  { date: '2024-01-05', open: 13, high: 13, low: 13, close: 13, volume: 100 },
];

function loaded(visibleBars = 2) {
  return replayReducer(createReplayState(), {
    type: 'LOAD',
    bars: BARS,
    visibleBars,
    startingCash: 10000,
  });
}

describe('replayEngine', () => {
  it('loads bars with an initial visible window', () => {
    const state = loaded(2);
    expect(state.cursor).toBe(2);
    expect(currentBar(state).close).toBe(11);
    expect(state.cash).toBe(10000);
  });

  it('steps forward one bar and stops at the end', () => {
    let state = loaded(2);
    state = replayReducer(state, { type: 'STEP' });
    expect(state.cursor).toBe(3);
    expect(state.done).toBe(false);
    state = replayReducer(state, { type: 'STEP' });
    expect(state.cursor).toBe(4);
    expect(state.done).toBe(true);
    // Further steps are no-ops.
    state = replayReducer(state, { type: 'STEP' });
    expect(state.cursor).toBe(4);
  });

  it('buys all-in at the current close', () => {
    let state = loaded(2);
    state = replayReducer(state, { type: 'BUY' });
    expect(state.shares).toBeCloseTo(10000 / 11);
    expect(state.cash).toBe(0);
    expect(state.entryPrice).toBe(11);
    expect(state.entryDate).toBe('2024-01-03');
  });

  it('ignores BUY while already holding', () => {
    let state = loaded(2);
    state = replayReducer(state, { type: 'BUY' });
    const again = replayReducer(state, { type: 'BUY' });
    expect(again).toBe(state);
  });

  it('sells at the current close and records the trade', () => {
    let state = loaded(2);
    state = replayReducer(state, { type: 'BUY' }); // at 11
    state = replayReducer(state, { type: 'STEP' }); // now at 12
    state = replayReducer(state, { type: 'SELL' });
    expect(state.shares).toBe(0);
    expect(state.cash).toBeCloseTo(10000 * (12 / 11));
    expect(state.trades).toHaveLength(1);
    expect(state.trades[0]).toMatchObject({
      entryPrice: 11,
      exitPrice: 12,
      entryDate: '2024-01-03',
      exitDate: '2024-01-04',
    });
    expect(state.trades[0].returnPct).toBeCloseTo((12 / 11 - 1) * 100);
  });

  it('ignores SELL with no position', () => {
    const state = loaded(2);
    expect(replayReducer(state, { type: 'SELL' })).toBe(state);
  });

  it('marks equity to market while holding', () => {
    let state = loaded(2);
    state = replayReducer(state, { type: 'BUY' }); // at 11
    state = replayReducer(state, { type: 'STEP' }); // at 12
    expect(currentEquity(state)).toBeCloseTo(10000 * (12 / 11));
    expect(openPositionPl(state)).toBeCloseTo((12 / 11 - 1) * 100);
  });

  it('resets to the initial window and cash, keeping bars', () => {
    let state = loaded(2);
    state = replayReducer(state, { type: 'BUY' });
    state = replayReducer(state, { type: 'STEP' });
    state = replayReducer(state, { type: 'RESET' });
    expect(state.cursor).toBe(2);
    expect(state.cash).toBe(10000);
    expect(state.shares).toBe(0);
    expect(state.trades).toHaveLength(0);
    expect(state.bars).toHaveLength(4);
  });

  it('play/pause and speed are tracked', () => {
    let state = loaded(2);
    state = replayReducer(state, { type: 'PLAY' });
    expect(state.playing).toBe(true);
    state = replayReducer(state, { type: 'SET_SPEED', speed: 4 });
    expect(state.speed).toBe(4);
    state = replayReducer(state, { type: 'PAUSE' });
    expect(state.playing).toBe(false);
  });

  it('stops playing when the last bar is reached', () => {
    let state = loaded(3);
    state = replayReducer(state, { type: 'PLAY' });
    state = replayReducer(state, { type: 'STEP' });
    expect(state.done).toBe(true);
    expect(state.playing).toBe(false);
  });
});
