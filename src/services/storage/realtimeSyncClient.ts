import { getActiveBearerToken } from '../../lib/authClient';
import { getOrCreateDeviceId } from './syncEngine';

import type { AudioNotificationSettings } from '../audio/AudioManager';

export type SyncWsEvent =
  | { type: 'connected'; uid: string; sid?: string }
  | {
      type: 'workspace:updated';
      uid: string;
      deviceId: string;
      updatedAt: string;
      version?: number;
      summary?: string;
    }
  | {
      type: 'settings:audio_updated';
      uid: string;
      deviceId: string;
      deviceLabel: string;
      settings: Partial<AudioNotificationSettings>;
      updatedAt: string;
    }
  | {
      type: 'session:revoked';
      sid: string;
      reason?: string;
    }
  | {
      type: 'security:alert';
      title: string;
      summary: string;
      kind?: string;
    }
  | {
      type: 'presence:update';
      activeDevices: number;
    }
  | {
      type: 'qr:approved';
      pairId: string;
      token: string;
      user: Record<string, unknown>;
    };

export function createRealtimeSyncSocket(options: {
  onEvent: (ev: SyncWsEvent) => void;
  onStatusChange?: (connected: boolean) => void;
}): () => void {
  if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
    return () => {};
  }

  let closed = false;
  let ws: WebSocket | null = null;
  let reconnectAttempt = 0;
  let timer: number | null = null;

  const connect = async () => {
    if (closed) return;
    const token = await getActiveBearerToken();
    const deviceId = getOrCreateDeviceId();
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/api/sync/ws${
      token ? `?token=${encodeURIComponent(token)}&deviceId=${encodeURIComponent(deviceId)}` : `?deviceId=${encodeURIComponent(deviceId)}`
    }`;

    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        reconnectAttempt = 0;
        options.onStatusChange?.(true);
      };
      ws.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(String(msg.data)) as SyncWsEvent;
          if (parsed && typeof parsed.type === 'string') {
            options.onEvent(parsed);
          }
        } catch {
          // ignore malformed WS frames
        }
      };
      ws.onclose = () => {
        options.onStatusChange?.(false);
        if (closed) return;
        reconnectAttempt = Math.min(reconnectAttempt + 1, 6);
        const delay = Math.min(30_000, 1200 * Math.pow(2, reconnectAttempt - 1));
        timer = window.setTimeout(() => void connect(), delay);
      };
      ws.onerror = () => {
        options.onStatusChange?.(false);
      };
    } catch {
      options.onStatusChange?.(false);
    }
  };

  void connect();

  return () => {
    closed = true;
    if (timer !== null) window.clearTimeout(timer);
    try {
      ws?.close();
    } catch {
      // ignore
    }
    options.onStatusChange?.(false);
  };
}

export async function triggerBrowserSecurityNotification(
  title: string,
  body: string
): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  try {
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/pwa-192x192.png' });
    }
  } catch {
    // ignore restricted frame notification permissions
  }
}
