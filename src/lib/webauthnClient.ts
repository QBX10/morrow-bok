import { authFetch, saveSession, type StoredSession } from './authClient';

function bufferToBase64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBuffer(val: string): ArrayBuffer {
  const padded = val.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((val.length + 3) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes.buffer;
}

export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(
      window.PublicKeyCredential &&
        navigator.credentials &&
        typeof navigator.credentials.create === 'function' &&
        typeof navigator.credentials.get === 'function'
    )
  );
}

export async function registerPasskeyWithServer(label?: string): Promise<{
  ok: boolean;
  credentialId: string;
  label: string;
}> {
  if (!isWebAuthnSupported()) {
    throw new Error('متصفحك الحالي لا يدعم مفاتيح المرور (Passkeys / WebAuthn).');
  }

  const optRes = await authFetch('/api/auth/passkeys/register/options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  });
  const optData = await optRes.json();
  if (!optRes.ok) {
    throw new Error(optData?.error || 'تعذر بدء تسجيل مفتاح المرور.');
  }

  const options = optData.options;
  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge: base64UrlToBuffer(options.challenge),
    rp: options.rp,
    user: {
      id: base64UrlToBuffer(options.user.id),
      name: options.user.name,
      displayName: options.user.displayName,
    },
    pubKeyCredParams: options.pubKeyCredParams,
    timeout: options.timeout || 60000,
    attestation: 'none',
    authenticatorSelection: options.authenticatorSelection || {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    excludeCredentials: Array.isArray(options.excludeCredentials)
      ? options.excludeCredentials.map((c: { id: string; type: 'public-key' }) => ({
          id: base64UrlToBuffer(c.id),
          type: 'public-key' as const,
        }))
      : undefined,
  };

  const cred = (await navigator.credentials.create({
    publicKey,
  })) as PublicKeyCredential | null;

  if (!cred) {
    throw new Error('تم إلغاء إنشاء مفتاح المرور.');
  }

  const resp = cred.response as AuthenticatorAttestationResponse;
  const getPubKey = (resp as unknown as { getPublicKey?: () => ArrayBuffer | null }).getPublicKey;
  const spkiBuffer = typeof getPubKey === 'function' ? getPubKey.call(resp) : null;
  const getTransports = (resp as unknown as { getTransports?: () => string[] }).getTransports;
  const transports = typeof getTransports === 'function' ? getTransports.call(resp) : [];

  const verifyRes = await authFetch('/api/auth/passkeys/register/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeId: optData.challengeId,
      label: label?.trim() || undefined,
      credential: {
        id: cred.id,
        rawId: bufferToBase64Url(cred.rawId),
        type: cred.type,
        authenticatorAttachment: cred.authenticatorAttachment || 'platform',
        transports,
        response: {
          clientDataJSON: bufferToBase64Url(resp.clientDataJSON),
          attestationObject: bufferToBase64Url(resp.attestationObject),
          authenticatorData:
            typeof (resp as unknown as { getAuthenticatorData?: () => ArrayBuffer }).getAuthenticatorData === 'function'
              ? bufferToBase64Url((resp as unknown as { getAuthenticatorData: () => ArrayBuffer }).getAuthenticatorData())
              : undefined,
          publicKeySpki: spkiBuffer ? bufferToBase64Url(spkiBuffer) : undefined,
        },
      },
    }),
  });

  const verified = await verifyRes.json();
  if (!verifyRes.ok) {
    throw new Error(verified?.error || 'تعذر توثيق مفتاح المرور على الخادم.');
  }
  return verified;
}

export async function authenticateWithPasskey(params?: {
  identifier?: string;
  rememberMe?: boolean;
}): Promise<StoredSession> {
  if (!isWebAuthnSupported()) {
    throw new Error('المتصفح الحالي لا يدعم الدخول عبر Passkey.');
  }
  const rememberMe = params?.rememberMe ?? true;

  const optRes = await fetch('/api/auth/passkeys/login/options', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'MorrowApp',
    },
    body: JSON.stringify({ identifier: params?.identifier }),
  });
  const optData = await optRes.json();
  if (!optRes.ok) {
    throw new Error(optData?.error || 'تعذر تجهيز تحدي Passkey.');
  }

  const options = optData.options;
  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: base64UrlToBuffer(options.challenge),
    rpId: options.rpId,
    timeout: options.timeout || 60000,
    userVerification: 'preferred',
    allowCredentials: Array.isArray(options.allowCredentials)
      ? options.allowCredentials.map((c: { id: string }) => ({
          id: base64UrlToBuffer(c.id),
          type: 'public-key' as const,
        }))
      : undefined,
  };

  const assertion = (await navigator.credentials.get({
    publicKey,
  })) as PublicKeyCredential | null;

  if (!assertion) {
    throw new Error('تم إلغاء المصادقة عبر مفتاح المرور.');
  }

  const resp = assertion.response as AuthenticatorAssertionResponse;
  const verifyRes = await fetch('/api/auth/passkeys/login/verify', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'MorrowApp',
    },
    body: JSON.stringify({
      challengeId: optData.challengeId,
      rememberMe,
      assertion: {
        id: assertion.id,
        rawId: bufferToBase64Url(assertion.rawId),
        response: {
          clientDataJSON: bufferToBase64Url(resp.clientDataJSON),
          authenticatorData: bufferToBase64Url(resp.authenticatorData),
          signature: bufferToBase64Url(resp.signature),
          userHandle: resp.userHandle ? bufferToBase64Url(resp.userHandle) : undefined,
        },
      },
    }),
  });

  const data = await verifyRes.json();
  if (!verifyRes.ok) {
    throw new Error(data?.error || 'فشل التحقق من مفتاح المرور.');
  }
  saveSession(data.token, data.user, rememberMe);
  return data;
}
