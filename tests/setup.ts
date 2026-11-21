import '@testing-library/jest-dom';

// Mock ResizeObserver for React Flow / JSDOM environment
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window !== 'undefined') {
  window.ResizeObserver = window.ResizeObserver || ResizeObserverMock;
}
global.ResizeObserver = global.ResizeObserver || ResizeObserverMock;
