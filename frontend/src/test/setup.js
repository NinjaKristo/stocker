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

const installMemoryLocalStorage = (target) => {
  if (!target) {
    return;
  }

  const descriptor = Object.getOwnPropertyDescriptor(target, 'localStorage');
  if (descriptor && !descriptor.get) {
    return;
  }

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

  Object.defineProperty(target, 'localStorage', {
    configurable: true,
    value: storage,
  });
};

installMemoryLocalStorage(typeof globalThis !== 'undefined' ? globalThis : undefined);
installMemoryLocalStorage(typeof window !== 'undefined' ? window : undefined);
