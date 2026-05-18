type MraidBridge = {
  open?: (url: string) => void;
};

type PlayableAdRuntime = typeof globalThis & {
  mraid?: MraidBridge;
  open?: (url: string, target?: string, features?: string) => Window | null;
  location?: Location;
};

export function openStoreUrl(storeUrl: string): boolean {
  const normalizedUrl = storeUrl.trim();

  if (normalizedUrl.length === 0) {
    return false;
  }

  const runtime = globalThis as PlayableAdRuntime;

  if (typeof runtime.mraid?.open === 'function') {
    runtime.mraid.open(normalizedUrl);
    return true;
  }

  if (typeof runtime.open === 'function') {
    runtime.open(normalizedUrl, '_blank', 'noopener,noreferrer');
    return true;
  }

  if (runtime.location !== undefined) {
    runtime.location.href = normalizedUrl;
    return true;
  }

  return false;
}
