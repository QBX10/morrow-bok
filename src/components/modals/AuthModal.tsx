import React, { useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import {
  clearSession,
  googleQuickSignInApi,
  loginWithPasswordApi,
  registerWithPasswordApi,
  requestPhoneOtpApi,
  signInWithFirebaseGoogle,
  updateUserProfileApi,
  verifyPhoneOtpApi,
} from '../../lib/authClient';
import { compressImageFileToDataUrl } from '../../lib/imageUpload';
import type { AuthUser } from '../../types/agency';
import { FullScreenPushPage } from '../ui/FullScreenPushPage';
import {
  normalizeUsernameInput,
  validateAuthUsername,
} from '../../utils/spatial3dConfig';
import {
  playTactileFeedback,
  shouldFireTactileEvent,
} from '../../utils/tactileFeedback';

interface AuthModalProps {
  open: boolean;
  lockedGate?: boolean;
  currentUser: AuthUser | null;
  onClose: () => void;
  onAuthenticated: (user: AuthUser) => void;
  onLoggedOut: () => void;
}

type AuthTab = 'google' | 'username' | 'phone' | 'email';

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  lockedGate = false,
  currentUser,
  onClose,
  onAuthenticated,
  onLoggedOut,
}) => {
  const [tab, setTab] = useState<AuthTab>('google');
  const [isRegister, setIsRegister] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const [phoneSubMode, setPhoneSubMode] = useState<'otp' | 'password'>('otp');
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [demoOtpHint, setDemoOtpHint] = useState('');

  const [loading, setLoading] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarNotice, setAvatarNotice] = useState('');
  const [error, setError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const lastTactileRef = useRef(0);

  const triggerInputTactile = () => {
    const now = performance.now();
    if (!shouldFireTactileEvent(now, lastTactileRef.current, 85)) return;
    lastTactileRef.current = now;
    playTactileFeedback('tap', { sound: true, haptic: true });
  };

  const triggerSuccessTactile = () => {
    playTactileFeedback('success', { sound: true, haptic: true });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !currentUser) return;
    try {
      setAvatarBusy(true);
      setError('');
      setAvatarNotice('');
      const compressed = await compressImageFileToDataUrl(file, {
        maxDim: 240,
        maxChars: 220000,
        quality: 0.82,
      });
      const updated = await updateUserProfileApi({ avatarUrl: compressed });
      onAuthenticated(updated);
      setAvatarNotice('تم تحديث الصورة الشخصية وحفظها بنجاح.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'تعذر رفع الصورة الشخصية.'
      );
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleFirebaseGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      const session = await signInWithFirebaseGoogle();
      triggerSuccessTactile();
      onAuthenticated(session.user);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'تعذر إتمام تسجيل الدخول بحساب Google.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      const session = await googleQuickSignInApi({
        email: email.trim(),
        displayName: displayName.trim(),
      });
      triggerSuccessTactile();
      onAuthenticated(session.user);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'تعذر تسجيل الدخول بحساب Google.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('يرجى إدخال بريد إلكتروني صحيح.');
      return;
    }
    if (isRegister && password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const session = isRegister
        ? await registerWithPasswordApi({
            mode: 'google',
            displayName: displayName.trim() || cleanEmail.split('@')[0],
            email: cleanEmail,
            password,
          })
        : await loginWithPasswordApi({
            mode: 'google',
            identifier: cleanEmail,
            password,
          });
      triggerSuccessTactile();
      onAuthenticated(session.user);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'تعذر تسجيل الدخول بالبريد الإلكتروني.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateAuthUsername(username);
    if (!check.valid) {
      setError(check.error || 'يرجى التحقق من اسم المستخدم.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const session = isRegister
        ? await registerWithPasswordApi({
            mode: 'username',
            displayName: displayName.trim() || check.normalized,
            username: check.normalized,
            password,
          })
        : await loginWithPasswordApi({
            mode: 'username',
            identifier: check.normalized,
            password,
          });
      triggerSuccessTactile();
      onAuthenticated(session.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تسجيل الدخول.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      if (phoneSubMode === 'password') {
        const session = isRegister
          ? await registerWithPasswordApi({
              mode: 'phone',
              displayName: displayName.trim() || phone.trim(),
              phone: phone.trim(),
              password,
            })
          : await loginWithPasswordApi({
              mode: 'phone',
              identifier: phone.trim(),
              password,
            });
        triggerSuccessTactile();
        onAuthenticated(session.user);
        onClose();
        return;
      }

      if (!otpSent) {
        const res = await requestPhoneOtpApi(phone.trim());
        setOtpSent(true);
        if (res.demoCode) setDemoOtpHint(res.demoCode);
      } else {
        const session = await verifyPhoneOtpApi({
          phone: phone.trim(),
          code: otpCode.trim(),
          displayName: displayName.trim(),
        });
        triggerSuccessTactile();
        onAuthenticated(session.user);
        onClose();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'تعذر التحقق من رقم الهاتف.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <FullScreenPushPage
      open={open}
      onBack={onClose}
      hideBack={lockedGate}
      title={
        currentUser
          ? 'إدارة الحساب وتبديل تسجيل الدخول — Morrow'
          : 'تسجيل الدخول إلى Morrow'
      }
      subtitle="حساب Google، اسم المستخدم، رقم الهاتف، أو البريد الإلكتروني"
      icon={<ShieldCheck className="h-4 w-4" />}
      ariaLabel="تسجيل الدخول المتعدد"
      maxWidthClass="max-w-lg"
    >
      <div className="nexus-squircle overflow-hidden">
        <div className="space-y-4 p-5 sm:p-6">
          {currentUser && (
            <div
              className="space-y-2.5 rounded-lg border p-3 text-xs"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--success)',
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.displayName}
                      referrerPolicy="no-referrer"
                      className="h-10 w-10 shrink-0 rounded-full border object-cover"
                      style={{ borderColor: 'var(--accent)' }}
                    />
                  ) : (
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <User className="h-5 w-5" style={{ color: 'var(--accent)' }} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-bold truncate">
                      <span>{currentUser.displayName}</span>
                      <CheckCircle2
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ color: 'var(--success)' }}
                      />
                    </div>
                    <div className="truncate" style={{ color: 'var(--text-muted)' }}>
                      {currentUser.provider === 'google'
                        ? `البريد: ${currentUser.email}`
                        : currentUser.provider === 'phone'
                        ? `الهاتف: ${currentUser.phone}`
                        : `اسم المستخدم: ${currentUser.username}`}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    clearSession();
                    onLoggedOut();
                  }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 font-semibold whitespace-nowrap cursor-pointer"
                  style={{
                    borderColor: 'var(--danger)',
                    color: 'var(--danger)',
                  }}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>تسجيل خروج</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={avatarBusy}
                  onClick={() => avatarInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold hover:opacity-85 disabled:opacity-50 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <Camera className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                  <span>{avatarBusy ? 'جارٍ رفع الصورة...' : 'رفع صورة شخصية'}</span>
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                {avatarNotice && (
                  <span className="text-[11px] font-bold" style={{ color: 'var(--success)' }}>
                    {avatarNotice}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 4 Multi-Login Tabs */}
          <div
            role="tablist"
            aria-label="طرق تسجيل الدخول"
            className="grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-xl p-1"
            style={{ backgroundColor: 'var(--bg-main)' }}
          >
            {(
              [
                ['google', 'Google', Sparkles],
                ['username', 'اسم المستخدم', User],
                ['phone', 'رقم الهاتف', Phone],
                ['email', 'البريد', Mail],
              ] as Array<[AuthTab, string, React.FC<{ className?: string }>]>
            ).map(([key, label, Icon]) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  data-testid={`modal-auth-tab-${key}`}
                  onClick={() => {
                    triggerInputTactile();
                    setTab(key);
                    setError('');
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer"
                  style={{
                    backgroundColor: active ? 'var(--accent)' : 'transparent',
                    color: active ? 'var(--accent-fg)' : 'var(--text-muted)',
                  }}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {tab === 'google' && (
            <div className="space-y-3.5">
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleFirebaseGoogleLogin()}
                className="gsi-material-button w-full"
              >
                <span className="gsi-material-button-content-wrapper">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    className="gsi-material-button-icon"
                    aria-hidden="true"
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span>
                    {loading
                      ? 'جارٍ الاتصال بـ Google...'
                      : 'تسجيل الدخول بحساب Google'}
                  </span>
                </span>
              </button>

              <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                <span className="h-px flex-1" style={{ backgroundColor: 'var(--border-color)' }} />
                <span>أو الدخول السريع ببريد Gmail</span>
                <span className="h-px flex-1" style={{ backgroundColor: 'var(--border-color)' }} />
              </div>

              <form onSubmit={handleGoogleSubmit} className="space-y-3">
                <div>
                  <label
                    htmlFor="auth-gmail-email"
                    className="mb-1 block text-xs font-medium"
                  >
                    حساب Gmail
                  </label>
                  <input
                    id="auth-gmail-email"
                    type="email"
                    dir="ltr"
                    required
                    value={email}
                    onPointerDown={triggerInputTactile}
                    onFocus={triggerInputTactile}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError('');
                    }}
                    placeholder="name@gmail.com"
                    className="w-full rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors focus:border-[var(--accent)]"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="auth-gmail-name"
                    className="mb-1 block text-xs font-medium"
                  >
                    الاسم الظاهر (اختياري)
                  </label>
                  <input
                    id="auth-gmail-name"
                    type="text"
                    value={displayName}
                    onPointerDown={triggerInputTactile}
                    onFocus={triggerInputTactile}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="اكتب اسمك هنا"
                    className="w-full rounded-xl border px-3.5 py-2.5 text-sm transition-colors focus:border-[var(--accent)]"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg px-4 py-2.5 text-xs font-bold whitespace-nowrap disabled:opacity-50 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  {loading ? 'جارٍ المتابعة...' : 'دخول بحساب Google'}
                </button>
              </form>
            </div>
          )}

          {tab === 'username' && (
            <form onSubmit={handleUsernameSubmit} className="space-y-3">
              {isRegister && (
                <div>
                  <label
                    htmlFor="auth-user-display"
                    className="mb-1 block text-xs font-medium"
                  >
                    الاسم الكامل
                  </label>
                  <input
                    id="auth-user-display"
                    type="text"
                    value={displayName}
                    onPointerDown={triggerInputTactile}
                    onFocus={triggerInputTactile}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="اكتب اسمك هنا"
                    className="w-full rounded-xl border px-3.5 py-2.5 text-sm transition-colors focus:border-[var(--accent)]"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="auth-username-input"
                  className="mb-1 block text-xs font-medium"
                >
                  اسم المستخدم
                </label>
                <input
                  id="auth-username-input"
                  type="text"
                  dir="ltr"
                  required
                  value={username}
                  onPointerDown={triggerInputTactile}
                  onFocus={triggerInputTactile}
                  onChange={(e) => {
                    setUsername(normalizeUsernameInput(e.target.value));
                    setError('');
                  }}
                  placeholder="ali_agency90"
                  className="w-full rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors focus:border-[var(--accent)]"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
                <p className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  أحرف إنجليزية، أرقام، أو الرموز (_ . -) بدون مسافات
                </p>
              </div>

              <div>
                <label
                  htmlFor="auth-username-pass"
                  className="mb-1 block text-xs font-medium"
                >
                  كلمة المرور
                </label>
                <div className="relative">
                  <input
                    id="auth-username-pass"
                    type={showPass ? 'text' : 'password'}
                    required
                    value={password}
                    onPointerDown={triggerInputTactile}
                    onFocus={triggerInputTactile}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    placeholder="••••••"
                    className="w-full rounded-xl border px-3.5 py-2.5 pl-9 text-sm transition-colors focus:border-[var(--accent)]"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label="إظهار أو إخفاء كلمة المرور"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {showPass ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg px-4 py-2.5 text-xs font-bold whitespace-nowrap disabled:opacity-50 cursor-pointer"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                {loading
                  ? 'يرجى الانتظار...'
                  : isRegister
                  ? 'إنشاء حساب جديد'
                  : 'تسجيل الدخول باسم المستخدم'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsRegister((v) => !v);
                  setError('');
                }}
                className="w-full text-center text-xs font-semibold underline cursor-pointer"
                style={{ color: 'var(--accent)' }}
              >
                {isRegister
                  ? 'لديك حساب مسبقًا؟ سجّل الدخول'
                  : 'مستخدم جديد؟ أنشئ حسابًا باسم المستخدم'}
              </button>
            </form>
          )}

          {tab === 'phone' && (
            <form onSubmit={handlePhoneSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setPhoneSubMode('otp');
                    setOtpSent(false);
                    setError('');
                  }}
                  className="rounded-lg border py-1.5 font-semibold cursor-pointer"
                  style={{
                    borderColor:
                      phoneSubMode === 'otp'
                        ? 'var(--accent)'
                        : 'var(--border-color)',
                    backgroundColor:
                      phoneSubMode === 'otp'
                        ? 'var(--bg-nav-active)'
                        : 'var(--bg-main)',
                  }}
                >
                  رمز تحقق (OTP)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPhoneSubMode('password');
                    setError('');
                  }}
                  className="rounded-lg border py-1.5 font-semibold cursor-pointer"
                  style={{
                    borderColor:
                      phoneSubMode === 'password'
                        ? 'var(--accent)'
                        : 'var(--border-color)',
                    backgroundColor:
                      phoneSubMode === 'password'
                        ? 'var(--bg-nav-active)'
                        : 'var(--bg-main)',
                  }}
                >
                  رقم + كلمة مرور
                </button>
              </div>

              <div>
                <label
                  htmlFor="auth-phone-input"
                  className="mb-1 block text-xs font-medium"
                >
                  رقم الهاتف
                </label>
                <input
                  id="auth-phone-input"
                  type="tel"
                  dir="ltr"
                  required
                  disabled={phoneSubMode === 'otp' && otpSent}
                  value={phone}
                  onPointerDown={triggerInputTactile}
                  onFocus={triggerInputTactile}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setError('');
                  }}
                  placeholder="07701234567"
                  className="w-full rounded-xl border px-3.5 py-2.5 text-left text-sm tabular-nums transition-colors focus:border-[var(--accent)]"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>

              {phoneSubMode === 'otp' ? (
                <>
                  {otpSent && (
                    <>
                      {demoOtpHint && (
                        <div
                          className="rounded-lg border px-3 py-2 text-xs font-semibold"
                          style={{
                            borderColor: 'var(--accent)',
                            backgroundColor: 'var(--bg-nav-active)',
                            color: 'var(--accent)',
                          }}
                        >
                          رمز التحقق المرسل:{' '}
                          <span className="font-data">{demoOtpHint}</span>
                        </div>
                      )}
                      <div>
                        <label
                          htmlFor="auth-otp-input"
                          className="mb-1 block text-xs font-medium"
                        >
                          رمز التحقق (6 أرقام)
                        </label>
                        <input
                          id="auth-otp-input"
                          type="text"
                          dir="ltr"
                          required
                          value={otpCode}
                          onPointerDown={triggerInputTactile}
                          onFocus={triggerInputTactile}
                          onChange={(e) => setOtpCode(e.target.value)}
                          placeholder="123456"
                          className="w-full rounded-xl border px-3.5 py-2.5 text-center text-base font-bold tracking-widest tabular-nums transition-colors focus:border-[var(--accent)]"
                          style={{
                            backgroundColor: 'var(--bg-main)',
                            borderColor: 'var(--border-color)',
                          }}
                        />
                      </div>
                    </>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-bold whitespace-nowrap disabled:opacity-50 cursor-pointer"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-fg)',
                    }}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>
                      {loading
                        ? 'يرجى الانتظار...'
                        : otpSent
                        ? 'تأكيد الرمز والدخول'
                        : 'إرسال رمز التحقق'}
                    </span>
                  </button>
                  {otpSent && (
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpCode('');
                        setDemoOtpHint('');
                      }}
                      className="w-full text-center text-xs underline cursor-pointer"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      تغيير رقم الهاتف
                    </button>
                  )}
                </>
              ) : (
                <>
                  {isRegister && (
                    <div>
                      <label
                        htmlFor="auth-phone-name"
                        className="mb-1 block text-xs font-medium"
                      >
                        الاسم الكامل
                      </label>
                      <input
                        id="auth-phone-name"
                        type="text"
                        value={displayName}
                        onPointerDown={triggerInputTactile}
                        onFocus={triggerInputTactile}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="اكتب اسمك هنا"
                        className="w-full rounded-xl border px-3.5 py-2.5 text-sm transition-colors focus:border-[var(--accent)]"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      />
                    </div>
                  )}
                  <div>
                    <label
                      htmlFor="auth-phone-pass"
                      className="mb-1 block text-xs font-medium"
                    >
                      كلمة المرور
                    </label>
                    <input
                      id="auth-phone-pass"
                      type="password"
                      required
                      value={password}
                      onPointerDown={triggerInputTactile}
                      onFocus={triggerInputTactile}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border px-3.5 py-2.5 text-sm transition-colors focus:border-[var(--accent)]"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-lg px-4 py-2.5 text-xs font-bold whitespace-nowrap disabled:opacity-50 cursor-pointer"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-fg)',
                    }}
                  >
                    {isRegister ? 'تسجيل رقم جديد' : 'دخول برقم الهاتف'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRegister((v) => !v)}
                    className="w-full text-center text-xs font-semibold underline cursor-pointer"
                    style={{ color: 'var(--accent)' }}
                  >
                    {isRegister
                      ? 'لديك حساب؟ سجّل الدخول'
                      : 'تسجيل رقم جديد بكلمة مرور'}
                  </button>
                </>
              )}
            </form>
          )}

          {tab === 'email' && (
            <form onSubmit={handleEmailPasswordSubmit} className="space-y-3">
              {isRegister && (
                <div>
                  <label
                    htmlFor="auth-email-display"
                    className="mb-1 block text-xs font-medium"
                  >
                    الاسم الكامل
                  </label>
                  <input
                    id="auth-email-display"
                    type="text"
                    value={displayName}
                    onPointerDown={triggerInputTactile}
                    onFocus={triggerInputTactile}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="اكتب اسمك هنا"
                    className="w-full rounded-xl border px-3.5 py-2.5 text-sm transition-colors focus:border-[var(--accent)]"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="auth-email-input"
                  className="mb-1 block text-xs font-medium"
                >
                  البريد الإلكتروني
                </label>
                <input
                  id="auth-email-input"
                  type="email"
                  dir="ltr"
                  required
                  value={email}
                  onPointerDown={triggerInputTactile}
                  onFocus={triggerInputTactile}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors focus:border-[var(--accent)]"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="auth-email-pass"
                  className="mb-1 block text-xs font-medium"
                >
                  كلمة المرور
                </label>
                <div className="relative">
                  <input
                    id="auth-email-pass"
                    type={showPass ? 'text' : 'password'}
                    required
                    value={password}
                    onPointerDown={triggerInputTactile}
                    onFocus={triggerInputTactile}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    placeholder="••••••"
                    className="w-full rounded-xl border px-3.5 py-2.5 pl-9 text-sm transition-colors focus:border-[var(--accent)]"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label="إظهار أو إخفاء كلمة المرور"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {showPass ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg px-4 py-2.5 text-xs font-bold whitespace-nowrap disabled:opacity-50 cursor-pointer"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                {loading
                  ? 'يرجى الانتظار...'
                  : isRegister
                  ? 'إنشاء حساب بالبريد'
                  : 'تسجيل الدخول بالبريد الإلكتروني'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsRegister((v) => !v);
                  setError('');
                }}
                className="w-full text-center text-xs font-semibold underline cursor-pointer"
                style={{ color: 'var(--accent)' }}
              >
                {isRegister
                  ? 'لديك حساب مسبقًا؟ سجّل الدخول'
                  : 'مستخدم جديد؟ أنشئ حسابًا بالبريد الإلكتروني'}
              </button>
            </form>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-lg border px-3 py-2 text-xs font-semibold"
              style={{
                borderColor: 'var(--danger)',
                backgroundColor: 'var(--danger-bg)',
                color: 'var(--danger)',
              }}
            >
              {error}
            </div>
          )}
        </div>
      </div>
    </FullScreenPushPage>
  );
};
