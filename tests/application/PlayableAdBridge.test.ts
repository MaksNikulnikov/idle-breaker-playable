import { afterEach, describe, expect, it, vi } from 'vitest';

import { openStoreUrl } from '../../assets/scripts/application';

type TestRuntime = typeof globalThis & {
  mraid?: {
    open?: (url: string) => void;
  };
  open?: (url: string, target?: string, features?: string) => Window | null;
};

const runtime = globalThis as TestRuntime;

function clearRuntimeBridge(): void {
  Reflect.deleteProperty(runtime, 'mraid');
  Reflect.deleteProperty(runtime, 'open');
}

describe('PlayableAdBridge', () => {
  afterEach(() => {
    clearRuntimeBridge();
    vi.restoreAllMocks();
  });

  it('does not open empty store URLs', () => {
    expect(openStoreUrl('   ')).toBe(false);
  });

  it('prefers mraid.open when the playable runtime provides it', () => {
    const open = vi.fn();
    runtime.mraid = { open };

    expect(openStoreUrl(' https://store.example/game ')).toBe(true);
    expect(open).toHaveBeenCalledWith('https://store.example/game');
  });

  it('falls back to window.open with noopener settings', () => {
    const calls: Array<[string | URL | undefined, string | undefined, string | undefined]> = [];
    const open: NonNullable<TestRuntime['open']> = (url, target, features) => {
      calls.push([url, target, features]);
      return null;
    };
    runtime.open = open;

    expect(openStoreUrl('https://store.example/game')).toBe(true);
    expect(calls).toEqual([['https://store.example/game', '_blank', 'noopener,noreferrer']]);
  });
});
