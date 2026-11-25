import { getActiveBearerToken } from '../lib/authClient';

export type AmbiencePeriod = 'morning' | 'afternoon' | 'night';

export interface IntelligentAmbience {
  period: AmbiencePeriod;
  greeting: string;
  sub: string;
  glowPrimary: string;
  glowSecondary: string;
  chord: number[];
}

export interface SpaceContextPayload {
  sound_enabled: boolean;
  volume: number;
  ambience: IntelligentAmbience;
}

export function getLocalIntelligentAmbience(date = new Date()): IntelligentAmbience {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) {
    return {
      period: 'morning',
      greeting: 'صباح الإشراق والتركيز',
      sub: 'سجّل الدخول للمتابعة إلى مساحتك الخاصة',
      glowPrimary: '#f5d061',
      glowSecondary: 'rgba(245, 208, 97, 0.28)',
      chord: [261.63, 329.63, 392.0, 493.88],
    };
  }
  if (hour >= 12 && hour < 18) {
    return {
      period: 'afternoon',
      greeting: 'أهلاً بك في مساحتك',
      sub: 'سجّل الدخول للمتابعة إلى حسابك',
      glowPrimary: '#e5b842',
      glowSecondary: 'rgba(229, 184, 66, 0.25)',
      chord: [293.66, 349.23, 440.0, 523.25],
    };
  }
  return {
    period: 'night',
    greeting: 'مساء الهدوء والإنجاز',
    sub: 'اسحب الخيط لإنارة مساحتك والمتابعة',
    glowPrimary: '#d4af37',
    glowSecondary: 'rgba(212, 175, 55, 0.32)',
    chord: [220.0, 261.63, 329.63, 392.0],
  };
}

export async function fetchServerSpaceContext(): Promise<SpaceContextPayload> {
  const fallbackAmbience = getLocalIntelligentAmbience();
  try {
    const res = await fetch('/api/context');
    if (!res.ok) {
      return {
        sound_enabled: true,
        volume: 0.34,
        ambience: fallbackAmbience,
      };
    }
    const json = (await res.json()) as {
      sound_enabled?: boolean;
      volume?: number;
      ambience?: Partial<IntelligentAmbience> & {
        glow_primary?: string;
        glow_secondary?: string;
      };
    };
    const amb = json.ambience;
    return {
      sound_enabled:
        typeof json.sound_enabled === 'boolean' ? json.sound_enabled : true,
      volume:
        typeof json.volume === 'number' && Number.isFinite(json.volume)
          ? Math.max(0, Math.min(1, json.volume))
          : 0.34,
      ambience: {
        period:
          amb?.period === 'morning' ||
          amb?.period === 'afternoon' ||
          amb?.period === 'night'
            ? amb.period
            : fallbackAmbience.period,
        greeting: amb?.greeting || fallbackAmbience.greeting,
        sub: amb?.sub || fallbackAmbience.sub,
        glowPrimary:
          amb?.glowPrimary || amb?.glow_primary || fallbackAmbience.glowPrimary,
        glowSecondary:
          amb?.glowSecondary ||
          amb?.glow_secondary ||
          fallbackAmbience.glowSecondary,
        chord:
          Array.isArray(amb?.chord) && amb.chord.length > 0
            ? amb.chord
            : fallbackAmbience.chord,
      },
    };
  } catch {
    return {
      sound_enabled: true,
      volume: 0.34,
      ambience: fallbackAmbience,
    };
  }
}

export async function updateServerSoundSetting(
  soundEnabled: boolean,
  volume?: number
): Promise<{ ok: boolean; sound_enabled?: boolean; volume?: number }> {
  try {
    const token = await getActiveBearerToken();
    if (!token) return { ok: false };
    const res = await fetch('/api/settings/sound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        sound_enabled: soundEnabled,
        ...(typeof volume === 'number' ? { volume } : {}),
      }),
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as {
      sound_enabled?: boolean;
      volume?: number;
    };
    return {
      ok: true,
      sound_enabled: data.sound_enabled,
      volume: data.volume,
    };
  } catch {
    return { ok: false };
  }
}
