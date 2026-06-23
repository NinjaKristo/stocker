import { describe, expect, it } from 'vitest';

describe('test setup', () => {
  it('installs localStorage as a data property to avoid Node accessor warnings', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

    expect(descriptor?.configurable).toBe(true);
    expect(descriptor?.get).toBeUndefined();
    expect(typeof descriptor?.value?.getItem).toBe('function');
    expect(globalThis.localStorage.getItem('missing')).toBeNull();
  });
});
