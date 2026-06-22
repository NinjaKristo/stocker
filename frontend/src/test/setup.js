import '@testing-library/jest-dom';

// jsdom doesn't ship ResizeObserver, which Recharts' ResponsiveContainer
// requires on mount. Stub it so components that render charts don't throw.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof window !== 'undefined' && typeof window.localStorage === 'undefined') {
  const values = new Map();
  const storage = {
    getItem: (key) => (values.has(String(key)) ? values.get(String(key)) : null),
    setItem: (key, value) => {
      values.set(String(key), String(value));
    },
    removeItem: (key) => {
      values.delete(String(key));
    },
    clear: () => {
      values.clear();
    },
    key: (index) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size;
    },
  };

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage,
  });

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
  });
}
