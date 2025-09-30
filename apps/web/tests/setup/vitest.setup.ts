import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.clearAllTimers();
});

if (!global.ResizeObserver) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  // @ts-expect-error - assign stub for tests
  global.ResizeObserver = ResizeObserverStub;
}
