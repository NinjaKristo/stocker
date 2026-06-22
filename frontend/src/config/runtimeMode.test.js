import { afterEach, describe, expect, it, vi } from 'vitest';

describe('runtimeMode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('builds static data URLs from a configured static data base URL', async () => {
    vi.stubEnv(
      'VITE_STATIC_DATA_BASE_URL',
      'https://xang1234.github.io/stock-screener/static-data/'
    );

    const { getStaticDataUrl } = await import('./runtimeMode');

    expect(getStaticDataUrl('manifest.json')).toBe(
      'https://xang1234.github.io/stock-screener/static-data/manifest.json'
    );
    expect(getStaticDataUrl('/markets/us/home.json')).toBe(
      'https://xang1234.github.io/stock-screener/static-data/markets/us/home.json'
    );
  });
});
