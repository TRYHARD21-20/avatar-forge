/** Multiplayer routing only. Privacy and research requests stay on the same-origin API. */
const configured = (import.meta.env.VITE_REALTIME_ORIGIN || '').trim();

function roomOrigin(): string {
  if (!configured) return window.location.origin;
  try {
    const url = new URL(configured);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (!['https:', 'http:'].includes(url.protocol) || (url.protocol === 'http:' && !local) ||
        url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
      return window.location.origin;
    }
    return url.origin;
  } catch {
    return window.location.origin;
  }
}

export function realtimeApiUrl(path: string): string {
  if (!path.startsWith('/api/')) throw new Error('Only room API paths are supported');
  return `${roomOrigin()}${path}`;
}

export function realtimeWsUrl(): string {
  const origin = new URL(roomOrigin());
  origin.protocol = origin.protocol === 'https:' ? 'wss:' : 'ws:';
  origin.pathname = '/ws';
  return origin.toString();
}
