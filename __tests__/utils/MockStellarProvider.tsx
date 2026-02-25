import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { beforeEach, afterEach } from 'vitest';

interface FreighterMockOptions {
  isConnected?: boolean;
  publicKey?: string;
}

const defaultOptions: FreighterMockOptions = {
  isConnected: false,
  publicKey: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
};

export function setupFreighterMock(options: FreighterMockOptions = {}) {
  const config = { ...defaultOptions, ...options };

  beforeEach(() => {
    Object.defineProperty(window, 'freighter', {
      value: {
        isConnected: async () => ({ isConnected: config.isConnected }),
        getPublicKey: async () => config.publicKey,
        requestAccess: async () => undefined,
        signTransaction: async (tx: string) => tx,
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // @ts-expect-error -- cleaning up the mock
    delete window.freighter;
  });
}

export function renderWithStellar(
  ui: React.ReactElement,
  freighterOptions?: FreighterMockOptions,
  renderOptions?: Omit<RenderOptions, 'wrapper'>
) {
  const config = { ...defaultOptions, ...freighterOptions };

  Object.defineProperty(window, 'freighter', {
    value: {
      isConnected: async () => ({ isConnected: config.isConnected }),
      getPublicKey: async () => config.publicKey,
      requestAccess: async () => undefined,
      signTransaction: async (tx: string) => tx,
    },
    writable: true,
    configurable: true,
  });

  return render(ui, renderOptions);
}
