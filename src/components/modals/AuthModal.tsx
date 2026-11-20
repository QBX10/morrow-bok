import React, { useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import {
  clearSession,
  googleQuickSignInApi,
  loginWithPasswordApi,
  registerWithPasswordApi,
  requestPhoneOtpApi,
  verifyPhoneOtpApi,
} from '../../lib/authClient';
import type { AuthUser } from '../../types/agency';

interface AuthModalProps {
  open: boolean;
  lockedGate?: boolean;
  currentUser: AuthUser | null;
  onClose: () => void;
  onAuthenticated: (user: AuthUser) => void;
  onLoggedOut: () => void;
}

type AuthTab = 'google' | 'username' | 'phone';

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
  const [error, setError] = useState('');

  if (!open) return null;

  const handleGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      const session = await googleQuickSignInApi({
        email: email.trim(),
        displayName: displayName.trim(),
      });
      onAuthenticated(session.user);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'تعذر تسجيل الدخول بحساب Gmail.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      const session = isRegister
        ? await registerWithPasswordApi({
            mode: 'username',
            displayName: displayName.trim() || username.trim(),
            username: username.trim(),
            password,
          })
        : await loginWithPasswordApi({
            mode: 'username',
            identifier: username.trim(),
            password,
          });
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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="تسجيل الدخول المتعدد"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border shadow-xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-3.5 text-white"
          style={{ backgroundColor: 'var(--bg-header)' }}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            <h2 className="text-sm font-bold">
              {currentUser
                ? 'إدارة الحساب وتسجيل الدخول المتعدد'
                : 'تسجيل الدخول إلى نظام الوكالات'}
            </h2>
          </div>
          {!lockedGate && (
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق نافذة تسجيل الدخول"
              className="rounded p-1 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="space-y-4 p-5">
          {currentUser && (
            <div
              className="flex items-center justify-between gap-3 rounded-lg border p-3 text-xs"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--success)',
              }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2
                  className="h-4 w-4 shrink-0"
                  style={{ color: 'var(--success)' }}
                />
                <div>
                  <div className="font-bold">{currentUser.displayName}</div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    {currentUser.provider === 'google'
                      ? `Gmail: ${currentUser.email}`
                      : currentUser.provider === 'phone'
                      ? `الهاتف: ${currentUser.phone}`
                      : `اليوزر: ${currentUser.username}`}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  clearSession();
                  onLoggedOut();
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 font-semibold whitespace-nowrap"
                style={{
                  borderColor: 'var(--danger)',
                  color: 'var(--danger)',
                }}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>تسجيل خروج</span>
              </button>
            </div>
          )}

          {/* 3 Multi-Login Tabs */}
          <div
            role="tablist"
            aria-label="طرق تسجيل الدخول"
            className="grid grid-cols-3 gap-1 rounded-lg p-1"
            style={{ backgroundColor: 'var(--bg-main)' }}
          >
            {(
              [
                ['google', 'Gmail', Mail],
                ['username', 'يوزر', User],
                ['phone', 'رقم الهاتف', Phone],
              ] as Array<[AuthTab, string, React.FC<{ className?: string }>]>
            ).map(([key, label, Icon]) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => {
                    setTab(key);
                    setError('');
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-bold whitespace-nowrap transition-colors"
                  style={{
                    backgroundColor: active
                      ? 'var(--bg-surface)'
                      : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {tab === 'google' && (
            <form onSubmit={handleGoogleSubmit} className="space-y-3">
              <div>
                <label
                  htmlFor="auth-gmail-email"
                  className="mb-1 block text-xs font-medium"
                >
                  حساب Gmail / البريد الإلكتروني
                </label>
                <input
                  id="auth-gmail-email"
                  type="email"
                  dir="ltr"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  placeholder="name@gmail.com"
                  className="w-full rounded-lg border px-3 py-2 text-left text-sm"
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
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="مثال: منذر الحلو"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg px-4 py-2.5 text-xs font-bold whitespace-nowrap disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                {loading ? 'جارٍ المتابعة...' : 'دخول بحساب Gmail'}
              </button>
            </form>
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
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="مثال: مدير الوكالة"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
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
                  اسم المستخدم (يوزر)
                </label>
                <input
                  id="auth-username-input"
                  type="text"
                  dir="ltr"
                  required
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError('');
                  }}
                  placeholder="munther_agency"
                  className="w-full rounded-lg border px-3 py-2 text-left text-sm"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
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
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    placeholder="••••••"
                    className="w-full rounded-lg border px-3 py-2 pl-9 text-sm"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label="إظهار أو إخفاء كلمة المرور"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2"
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
                className="w-full rounded-lg px-4 py-2.5 text-xs font-bold whitespace-nowrap disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                {loading
                  ? 'يرجى الانتظار...'
                  : isRegister
                  ? 'إنشاء حساب يوزر جديد'
                  : 'تسجيل الدخول باليوزر'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsRegister((v) => !v);
                  setError('');
                }}
                className="w-full text-center text-xs font-semibold underline"
                style={{ color: 'var(--accent)' }}
              >
                {isRegister
                  ? 'لديك حساب مسبقًا؟ سجّل الدخول'
                  : 'مستخدم جديد؟ أنشئ حسابًا باليوزر'}
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
                  className="rounded-lg border py-1.5 font-semibold"
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
                  className="rounded-lg border py-1.5 font-semibold"
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
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setError('');
                  }}
                  placeholder="07701234567"
                  className="w-full rounded-lg border px-3 py-2 text-left text-sm tabular-nums"
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
                          onChange={(e) => setOtpCode(e.target.value)}
                          placeholder="123456"
                          className="w-full rounded-lg border px-3 py-2 text-center text-base font-bold tracking-widest tabular-nums"
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
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-bold whitespace-nowrap disabled:opacity-50"
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
                      className="w-full text-center text-xs underline"
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
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
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
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-lg px-4 py-2.5 text-xs font-bold whitespace-nowrap disabled:opacity-50"
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
                    className="w-full text-center text-xs font-semibold underline"
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
    </div>
  );
};
