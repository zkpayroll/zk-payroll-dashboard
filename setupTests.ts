import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import { vi } from 'vitest';

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder;
}

if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
}

const storageState: Record<string, string> = {};

const localStorageMock = {
  getItem: vi.fn((key: string) => storageState[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { storageState[key] = value; }),
  removeItem: vi.fn((key: string) => { delete storageState[key]; }),
  clear: vi.fn(() => { Object.keys(storageState).forEach((k) => delete storageState[k]); }),
  get length() { return Object.keys(storageState).length; },
  key: vi.fn((index: number) => Object.keys(storageState)[index] ?? null),
};

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// jsdom does not implement matchMedia, which responsive components rely on.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// jsdom does not implement ResizeObserver, which Radix ScrollArea relies on.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

// Standardize host machine locale variation to en-US in testing environment
const originalToLocaleDateString = Date.prototype.toLocaleDateString;
Date.prototype.toLocaleDateString = function (
  locales?: string | string[],
  options?: Intl.DateTimeFormatOptions
) {
  return originalToLocaleDateString.call(this, locales === undefined ? 'en-US' : locales, options);
};

const originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
Date.prototype.toLocaleTimeString = function (
  locales?: string | string[],
  options?: Intl.DateTimeFormatOptions
) {
  return originalToLocaleTimeString.call(this, locales === undefined ? 'en-US' : locales, options);
};

const originalToLocaleString = Date.prototype.toLocaleString;
Date.prototype.toLocaleString = function (
  locales?: string | string[],
  options?: Intl.DateTimeFormatOptions
) {
  return originalToLocaleString.call(this, locales === undefined ? 'en-US' : locales, options);
};
