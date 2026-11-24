import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeftRight,
  AtSign,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Phone,
  Sparkles,
  User,
} from 'lucide-react';
import type {
  AuthUser,
  Spatial3DPrefs,
  Spatial3DThemeId,
} from '../../types/agency';
import {
  googleQuickSignInApi,
  loginWithPasswordApi,
  registerWithPasswordApi,
  requestPhoneOtpApi,
  signInWithFirebaseGoogle,
  verifyPhoneOtpApi,
} from '../../lib/authClient';
import { DotMatrixPattern, GeometricRavenCrest } from '../brand/VectorMotifs';
import { GradientMeshBackdrop } from '../spatial3d/GradientMeshBackdrop';
import { Spatial3DCanvas } from '../spatial3d/Spatial3DCanvas';
import {
  TABRIX_POPOVER_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  TABRIX_TACTILE_SPRING,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';
import {
  normalizeUsernameInput,
  validateAuthUsername,
} from '../../utils/spatial3dConfig';

interface FlipAuthGuardProps {
  onAuthenticated: (user: AuthUser) => void;
  onReplayOnboarding?: () => void;
  themeId?: Spatial3DThemeId;
  spatialPrefs?: Spatial3DPrefs;
}

type AuthInputMode = 'google' | 'username' | 'phone' | 'email';
type PhoneFlowMode = 'otp' | 'password';

const AUTH_METHOD_OPTIONS: Array<{
  id: AuthInputMode;
  label: string;
  icon: React.FC<{ size?: number }>;
}> = [
  { id: 'google', label: 'Google', icon: Sparkles },
  { id: 'username', label: 'اسم المستخدم', icon: AtSign },
  { id: 'phone', label: 'الهاتف', icon: Phone },
  { id: 'email', label: 'البريد', icon: Mail },
];

export const FlipAuthGuard: React.FC<FlipAuthGuardProps> = ({
  onAuthenticated,
  onReplayOnboarding,
  themeId = 'emerald_smoked',
  spatialPrefs,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFlippingCrest, setIsFlippingCrest] = useState(false);
  const [authMode, setAuthMode] = useState<AuthInputMode>('username');
  const [phoneFlow, setPhoneFlow] = useState<PhoneFlowMode>('otp');
  const reducedMotion = useTabrixReducedMotion();

  // Shared / Login state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);

  // Google quick email fallback state
  const [googleQuickEmail, setGoogleQuickEmail] = useState('');

  // Phone OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [demoOtpHint, setDemoOtpHint] = useState('');

  // Register state
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const triggerFlip = (toCreateAccount: boolean) => {
    setErrorMsg('');
    setOtpSent(false);
    setOtpCode('');
    setDemoOtpHint('');
    setIsFlippingCrest(true);
    setIsFlipped(toCreateAccount);
    window.setTimeout(() => {
      setIsFlippingCrest(false);
    }, 520);
  };

  const handleModeSwitch = (mode: AuthInputMode) => {
    setAuthMode(mode);
    setErrorMsg('');
    setOtpSent(false);
    setOtpCode('');
    setDemoOtpHint('');
  };

  const handleGooglePopup = async () => {
    setErrorMsg('');
    setBusy(true);
    try {
      const session = await signInWithFirebaseGoogle();
      onAuthenticated(session.user);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'تعذر إتمام تسجيل الدخول بحساب Google. يمكنك استخدام الدخول السريع ببريد Gmail أدناه.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const targetEmail = googleQuickEmail.trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setErrorMsg('يرجى إدخال بريد Gmail صحيح للمتابعة.');
      return;
    }
    setBusy(true);
    try {
      const session = await googleQuickSignInApi({
        email: targetEmail,
        displayName: regName.trim() || undefined,
      });
      onAuthenticated(session.user);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر تسجيل الدخول عبر حساب Google.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (authMode === 'google') {
      await handleGoogleQuickSubmit(e);
      return;
    }

    if (authMode === 'username') {
      const check = validateAuthUsername(loginUsername);
      if (!check.valid) {
        setErrorMsg(check.error || 'يرجى التحقق من اسم المستخدم.');
        return;
      }
      if (!loginPassword) {
        setErrorMsg('يرجى إدخال كلمة المرور.');
        return;
      }
      setBusy(true);
      try {
        const session = await loginWithPasswordApi({
          mode: 'username',
          identifier: check.normalized,
          password: loginPassword,
        });
        onAuthenticated(session.user);
      } catch (err) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'تعذر تسجيل الدخول باسم المستخدم، تحقق من البيانات.'
        );
      } finally {
        setBusy(false);
      }
      return;
    }

    if (authMode === 'phone') {
      const cleanPhone = loginPhone.trim();
      if (cleanPhone.length < 7) {
        setErrorMsg('يرجى إدخال رقم هاتف صحيح.');
        return;
      }
      setBusy(true);
      try {
        if (phoneFlow === 'password') {
          if (!loginPassword) {
            setErrorMsg('يرجى إدخال كلمة المرور.');
            setBusy(false);
            return;
          }
          const session = await loginWithPasswordApi({
            mode: 'phone',
            identifier: cleanPhone,
            password: loginPassword,
          });
          onAuthenticated(session.user);
          return;
        }

        if (!otpSent) {
          const res = await requestPhoneOtpApi(cleanPhone);
          setOtpSent(true);
          if (res.demoCode) setDemoOtpHint(res.demoCode);
        } else {
          const session = await verifyPhoneOtpApi({
            phone: cleanPhone,
            code: otpCode.trim(),
          });
          onAuthenticated(session.user);
        }
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : 'تعذر التحقق من رقم الهاتف.'
        );
      } finally {
        setBusy(false);
      }
      return;
    }

    // authMode === 'email'
    const identifier = loginEmail.trim();
    if (!identifier || !identifier.includes('@') || !loginPassword) {
      setErrorMsg('يرجى إدخال البريد الإلكتروني الصحيح وكلمة المرور.');
      return;
    }
    setBusy(true);
    try {
      const session = await loginWithPasswordApi({
        mode: 'google',
        identifier,
        password: loginPassword,
      });
      onAuthenticated(session.user);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر تسجيل الدخول، تحقق من البيانات.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanName = regName.trim();

    if (authMode === 'google') {
      await handleGoogleQuickSubmit(e);
      return;
    }

    if (authMode === 'username') {
      const check = validateAuthUsername(regUsername);
      if (!check.valid) {
        setErrorMsg(check.error || 'يرجى التحقق من اسم المستخدم.');
        return;
      }
      if (regPassword.length < 6) {
        setErrorMsg('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
        return;
      }
      setBusy(true);
      try {
        const session = await registerWithPasswordApi({
          mode: 'username',
          displayName: cleanName || check.normalized,
          username: check.normalized,
          password: regPassword,
        });
        onAuthenticated(session.user);
      } catch (err) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'تعذر إنشاء الحساب باسم المستخدم الجديد.'
        );
      } finally {
        setBusy(false);
      }
      return;
    }

    if (authMode === 'phone') {
      const cleanPhone = regPhone.trim();
      if (cleanPhone.length < 7) {
        setErrorMsg('يرجى إدخال رقم هاتف صحيح.');
        return;
      }
      setBusy(true);
      try {
        if (phoneFlow === 'password') {
          if (regPassword.length < 6) {
            setErrorMsg('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
            setBusy(false);
            return;
          }
          const session = await registerWithPasswordApi({
            mode: 'phone',
            displayName: cleanName || cleanPhone,
            phone: cleanPhone,
            password: regPassword,
          });
          onAuthenticated(session.user);
          return;
        }

        if (!otpSent) {
          const res = await requestPhoneOtpApi(cleanPhone);
          setOtpSent(true);
          if (res.demoCode) setDemoOtpHint(res.demoCode);
        } else {
          const session = await verifyPhoneOtpApi({
            phone: cleanPhone,
            code: otpCode.trim(),
            displayName: cleanName || undefined,
          });
          onAuthenticated(session.user);
        }
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : 'تعذر تسجيل رقم الهاتف.'
        );
      } finally {
        setBusy(false);
      }
      return;
    }

    // authMode === 'email'
    const cleanEmail = regEmail.trim();
    if (!cleanName) {
      setErrorMsg('يرجى إدخال الاسم الكامل لصاحب الحساب.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('يرجى إدخال بريد إلكتروني صحيح.');
      return;
    }
    if (regPassword.length < 6) {
      setErrorMsg('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
      return;
    }
    setBusy(true);
    try {
      const session = await registerWithPasswordApi({
        mode: 'google',
        displayName: cleanName,
        email: cleanEmail,
        password: regPassword,
      });
      onAuthenticated(session.user);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر إنشاء الحساب الجديد.'
      );
    } finally {
      setBusy(false);
    }
  };

  const renderModeTabs = (face: 'login' | 'register') => (
    <div
      role="tablist"
      aria-label="طرق الدخول"
      className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-2xl recessed-well border border-white/10 mb-4"
    >
      {AUTH_METHOD_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = authMode === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={`${face}-mode-${opt.id}`}
            onClick={() => handleModeSwitch(opt.id)}
            className="py-2 px-2 rounded-xl text-[11px] font-extrabold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
            style={{
              backgroundColor: active ? 'var(--accent)' : 'transparent',
              color: active ? 'var(--accent-fg)' : 'var(--text-muted)',
              boxShadow: active
                ? '0 8px 20px -6px var(--spatial-glow)'
                : 'none',
            }}
          >
            <Icon size={13} />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );

  const renderGooglePanel = (face: 'login' | 'register') => (
    <div className="space-y-3.5">
      <motion.button
        type="button"
        disabled={busy}
        data-testid={`${face}-google-popup-btn`}
        whileHover={reducedMotion || busy ? undefined : { y: -1.5, scale: 1.01 }}
        whileTap={reducedMotion || busy ? undefined : { scale: 0.98 }}
        transition={TABRIX_TACTILE_SPRING}
        onClick={() => void handleGooglePopup()}
        className="w-full py-3 px-4 rounded-xl border bg-white/[0.06] hover:bg-white/[0.11] text-xs font-extrabold text-[var(--text-primary)] flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-60"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <svg viewBox="0 0 48 48" className="w-4 h-4 shrink-0" aria-hidden="true">
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
        <span>{busy ? 'جارٍ الاتصال بـ Google...' : 'المتابعة عبر حساب Google'}</span>
      </motion.button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-[11px] text-[var(--text-muted)]">أو أدخل بريد Gmail مباشرة</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <div>
        <label
          htmlFor={`flip-${face}-gmail-quick`}
          className="block text-xs font-bold text-[var(--text-primary)]/90 mb-1.5"
        >
          حساب Gmail
        </label>
        <div className="relative">
          <Mail
            size={16}
            className="absolute right-3.5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--accent)' }}
          />
          <input
            id={`flip-${face}-gmail-quick`}
            data-testid={`${face}-google-email-input`}
            type="email"
            dir="ltr"
            value={googleQuickEmail}
            onChange={(e) => setGoogleQuickEmail(e.target.value)}
            placeholder="name@gmail.com"
            className="w-full rounded-xl border border-[var(--border-color)] bg-black/40 pr-10 pl-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/60 focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      <motion.button
        type="submit"
        disabled={busy}
        data-testid={`${face}-submit-btn`}
        whileHover={reducedMotion || busy ? undefined : { y: -2, scale: 1.01 }}
        whileTap={reducedMotion || busy ? undefined : { scale: 0.98 }}
        transition={TABRIX_TACTILE_SPRING}
        className="obsidian-gold-cta w-full py-3 rounded-xl text-sm font-black cursor-pointer disabled:opacity-60"
      >
        {busy ? 'جارٍ المتابعة...' : 'دخول سريع بحساب Google'}
      </motion.button>
    </div>
  );

  const renderPhonePanel = (face: 'login' | 'register') => {
    const phoneValue = face === 'login' ? loginPhone : regPhone;
    const setPhoneValue = face === 'login' ? setLoginPhone : setRegPhone;
    const passValue = face === 'login' ? loginPassword : regPassword;
    const setPassValue = face === 'login' ? setLoginPassword : setRegPassword;
    const showPass = face === 'login' ? showLoginPass : showRegPass;
    const setShowPass = face === 'login' ? setShowLoginPass : setShowRegPass;

    return (
      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <button
            type="button"
            data-testid={`${face}-phone-flow-otp`}
            onClick={() => {
              setPhoneFlow('otp');
              setOtpSent(false);
              setErrorMsg('');
            }}
            className="rounded-xl border py-1.5 font-extrabold transition-colors cursor-pointer"
            style={{
              borderColor:
                phoneFlow === 'otp' ? 'var(--accent)' : 'var(--border-color)',
              backgroundColor:
                phoneFlow === 'otp' ? 'var(--bg-nav-active)' : 'rgba(0,0,0,0.3)',
              color:
                phoneFlow === 'otp' ? 'var(--accent-bright)' : 'var(--text-muted)',
            }}
          >
            رمز تحقق (OTP)
          </button>
          <button
            type="button"
            data-testid={`${face}-phone-flow-password`}
            onClick={() => {
              setPhoneFlow('password');
              setErrorMsg('');
            }}
            className="rounded-xl border py-1.5 font-extrabold transition-colors cursor-pointer"
            style={{
              borderColor:
                phoneFlow === 'password' ? 'var(--accent)' : 'var(--border-color)',
              backgroundColor:
                phoneFlow === 'password' ? 'var(--bg-nav-active)' : 'rgba(0,0,0,0.3)',
              color:
                phoneFlow === 'password' ? 'var(--accent-bright)' : 'var(--text-muted)',
            }}
          >
            رقم + كلمة مرور
          </button>
        </div>

        <div>
          <label
            htmlFor={`flip-${face}-phone`}
            className="block text-xs font-bold text-[var(--text-primary)]/90 mb-1.5"
          >
            رقم الهاتف
          </label>
          <div className="relative">
            <Phone
              size={16}
              className="absolute right-3.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--accent)' }}
            />
            <input
              id={`flip-${face}-phone`}
              data-testid={`${face}-phone-input`}
              type="tel"
              dir="ltr"
              disabled={phoneFlow === 'otp' && otpSent}
              value={phoneValue}
              onChange={(e) => setPhoneValue(e.target.value)}
              placeholder="07701234567"
              className="w-full rounded-xl border border-[var(--border-color)] bg-black/40 pr-10 pl-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/60 tabular-nums focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {phoneFlow === 'otp' ? (
          <>
            {otpSent && (
              <div className="space-y-2.5">
                {demoOtpHint && (
                  <div
                    className="rounded-xl border px-3 py-2 text-xs font-bold flex items-center justify-between"
                    style={{
                      borderColor: 'var(--accent)',
                      backgroundColor: 'var(--bg-nav-active)',
                      color: 'var(--accent-bright)',
                    }}
                  >
                    <span>رمز التحقق المرسل:</span>
                    <span dir="ltr" className="font-mono-num tracking-widest text-sm">
                      {demoOtpHint}
                    </span>
                  </div>
                )}
                <div>
                  <label
                    htmlFor={`flip-${face}-otp`}
                    className="block text-xs font-bold text-[var(--text-primary)]/90 mb-1.5"
                  >
                    أدخل رمز التحقق (6 أرقام)
                  </label>
                  <input
                    id={`flip-${face}-otp`}
                    data-testid={`${face}-otp-input`}
                    type="text"
                    dir="ltr"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    className="w-full rounded-xl border border-[var(--border-color)] bg-black/40 px-3 py-2.5 text-center text-base font-black tracking-[0.25em] text-[var(--text-primary)] tabular-nums focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>
            )}
            <motion.button
              type="submit"
              disabled={busy}
              data-testid={`${face}-submit-btn`}
              whileHover={reducedMotion || busy ? undefined : { y: -2, scale: 1.01 }}
              whileTap={reducedMotion || busy ? undefined : { scale: 0.98 }}
              transition={TABRIX_TACTILE_SPRING}
              className="obsidian-gold-cta w-full py-3 rounded-xl text-sm font-black inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <KeyRound size={15} />
              <span>
                {busy
                  ? 'جارٍ المعالجة...'
                  : otpSent
                  ? 'تأكيد الرمز والدخول'
                  : 'إرسال رمز التحقق'}
              </span>
            </motion.button>
            {otpSent && (
              <button
                type="button"
                onClick={() => {
                  setOtpSent(false);
                  setOtpCode('');
                  setDemoOtpHint('');
                }}
                className="w-full text-center text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--accent-bright)] cursor-pointer"
              >
                تغيير رقم الهاتف
              </button>
            )}
          </>
        ) : (
          <>
            <div>
              <label
                htmlFor={`flip-${face}-phone-pass`}
                className="block text-xs font-bold text-[var(--text-primary)]/90 mb-1.5"
              >
                كلمة المرور
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--accent)' }}
                />
                <input
                  id={`flip-${face}-phone-pass`}
                  data-testid={`${face}-password-input`}
                  type={showPass ? 'text' : 'password'}
                  dir="ltr"
                  value={passValue}
                  onChange={(e) => setPassValue(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[var(--border-color)] bg-black/40 pr-10 pl-10 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/60 focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label="إظهار أو إخفاء كلمة المرور"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={busy}
              data-testid={`${face}-submit-btn`}
              whileHover={reducedMotion || busy ? undefined : { y: -2, scale: 1.01 }}
              whileTap={reducedMotion || busy ? undefined : { scale: 0.98 }}
              transition={TABRIX_TACTILE_SPRING}
              className="obsidian-gold-cta w-full py-3 rounded-xl text-sm font-black cursor-pointer disabled:opacity-60"
            >
              {busy
                ? 'جارٍ التحقق...'
                : face === 'register'
                ? 'تسجيل برقم الهاتف'
                : 'دخول برقم الهاتف'}
            </motion.button>
          </>
        )}
      </div>
    );
  };

  return (
    <div
      dir="rtl"
      className="ambient-obsidian-canvas fixed inset-0 z-[135] flex min-h-[100dvh] items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      <GradientMeshBackdrop
        themeId={themeId}
        spatialPrefs={spatialPrefs}
        slideIndex={isFlipped ? 1 : 0}
        intensity="medium"
        reduceMotion={reducedMotion}
      />

      <Spatial3DCanvas
        themeId={themeId}
        spatialPrefs={spatialPrefs}
        reduceMotion={reducedMotion}
      />

      <motion.div
        className="relative z-10 w-full max-w-[500px] my-auto"
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <AnimatePresence>
          {isFlippingCrest && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1.08 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.28 }}
              className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
            >
              <div className="p-4 rounded-full bg-[var(--bg-main)]/90 border border-[var(--accent)]/50 shadow-[0_0_40px_var(--marine-caustic-1)]">
                <GeometricRavenCrest size={56} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3D Flip Container */}
        <div className="flip-perspective w-full">
          <div
            className={`flip-card-inner relative w-full min-h-[630px] ${
              isFlipped ? 'is-flipped' : ''
            }`}
          >
            {/* FRONT FACE: Sign In */}
            <div className="flip-card-face w-full min-h-[630px] chamfered-glass-card smoked-glass-elevated p-6 sm:p-8 flex flex-col justify-between">
              <div className="pointer-events-none absolute top-0 left-0 w-36 h-36 opacity-20">
                <DotMatrixPattern />
              </div>

              <div className="relative z-10">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <GeometricRavenCrest size={42} />
                    <div>
                      <span
                        className="font-mono-num text-xs font-black tracking-[0.16em] block"
                        style={{ color: 'var(--accent-bright)' }}
                      >
                        Morrow
                      </span>
                      <h1 className="font-display-ar text-xl font-black text-[var(--text-primary)]">
                        تسجيل الدخول
                      </h1>
                    </div>
                  </div>
                  {onReplayOnboarding && (
                    <button
                      type="button"
                      onClick={onReplayOnboarding}
                      className="text-[11px] font-bold text-[var(--text-muted)] hover:text-[var(--accent-bright)] transition-colors cursor-pointer"
                    >
                      جولة الترحيب
                    </button>
                  )}
                </div>

                <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-4">
                  اختر طريقة الدخول المفضلة: حساب Google أو اسم المستخدم أو رقم الهاتف أو البريد الإلكتروني.
                </p>

                {renderModeTabs('login')}

                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  {authMode === 'google' && renderGooglePanel('login')}

                  {authMode === 'phone' && renderPhonePanel('login')}

                  {(authMode === 'username' || authMode === 'email') && (
                    <>
                      {authMode === 'username' ? (
                        <div>
                          <label
                            htmlFor="flip-login-username"
                            className="block text-xs font-bold text-[var(--text-primary)]/90 mb-1.5"
                          >
                            اسم المستخدم
                          </label>
                          <div className="relative">
                            <AtSign
                              size={16}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2"
                              style={{ color: 'var(--accent)' }}
                            />
                            <input
                              id="flip-login-username"
                              data-testid="login-username-input"
                              type="text"
                              dir="ltr"
                              autoComplete="username"
                              value={loginUsername}
                              onChange={(e) =>
                                setLoginUsername(normalizeUsernameInput(e.target.value))
                              }
                              placeholder="ali_agency90"
                              className="w-full rounded-xl border border-[var(--border-color)] bg-black/40 pr-10 pl-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/60 focus:outline-none focus:border-[var(--accent)]"
                            />
                          </div>
                          <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                            أحرف إنجليزية، أرقام، أو الرموز (_ . -) بدون مسافات
                          </p>
                        </div>
                      ) : (
                        <div>
                          <label
                            htmlFor="flip-login-email"
                            className="block text-xs font-bold text-[var(--text-primary)]/90 mb-1.5"
                          >
                            البريد الإلكتروني
                          </label>
                          <div className="relative">
                            <Mail
                              size={16}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2"
                              style={{ color: 'var(--accent)' }}
                            />
                            <input
                              id="flip-login-email"
                              data-testid="login-email-input"
                              type="email"
                              dir="ltr"
                              autoComplete="email"
                              value={loginEmail}
                              onChange={(e) => setLoginEmail(e.target.value)}
                              placeholder="name@example.com"
                              className="w-full rounded-xl border border-[var(--border-color)] bg-black/40 pr-10 pl-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/60 focus:outline-none focus:border-[var(--accent)]"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label
                          htmlFor="flip-login-password"
                          className="block text-xs font-bold text-[var(--text-primary)]/90 mb-1.5"
                        >
                          كلمة المرور
                        </label>
                        <div className="relative">
                          <Lock
                            size={16}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--accent)' }}
                          />
                          <input
                            id="flip-login-password"
                            data-testid="login-password-input"
                            type={showLoginPass ? 'text' : 'password'}
                            dir="ltr"
                            autoComplete="current-password"
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full rounded-xl border border-[var(--border-color)] bg-black/40 pr-10 pl-10 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/60 focus:outline-none focus:border-[var(--accent)]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowLoginPass((v) => !v)}
                            aria-label="إظهار أو إخفاء كلمة المرور"
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                          >
                            {showLoginPass ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>

                      <motion.button
                        type="submit"
                        disabled={busy}
                        data-testid="login-submit-btn"
                        whileHover={
                          reducedMotion || busy ? undefined : { y: -2, scale: 1.01 }
                        }
                        whileTap={
                          reducedMotion || busy ? undefined : { scale: 0.98 }
                        }
                        transition={TABRIX_TACTILE_SPRING}
                        className="obsidian-gold-cta w-full py-3 rounded-xl text-sm font-black cursor-pointer disabled:opacity-60"
                      >
                        {busy
                          ? 'جارٍ التحقق...'
                          : authMode === 'username'
                          ? 'دخول باسم المستخدم'
                          : 'دخول بالبريد الإلكتروني'}
                      </motion.button>
                    </>
                  )}

                  <AnimatePresence initial={false}>
                    {errorMsg && !isFlipped && (
                      <motion.div
                        key="login-error"
                        variants={
                          reducedMotion
                            ? TABRIX_REDUCED_VARIANTS
                            : TABRIX_POPOVER_VARIANTS
                        }
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        role="alert"
                        className="rounded-xl border border-red-500/35 bg-red-500/15 px-3.5 py-2.5 text-xs font-medium text-red-200"
                      >
                        {errorMsg}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </form>
              </div>

              <div className="relative z-10 mt-6 pt-4 border-t border-[var(--border-color)] flex items-center justify-between gap-2 text-xs">
                <span className="text-[var(--text-muted)]">ليس لديك حساب بعد؟</span>
                <button
                  type="button"
                  data-testid="switch-to-register-btn"
                  onClick={() => triggerFlip(true)}
                  className="inline-flex items-center gap-1.5 font-bold hover:opacity-85 transition-opacity cursor-pointer"
                  style={{ color: 'var(--accent-bright)' }}
                >
                  <ArrowLeftRight size={14} />
                  <span>إنشاء حساب جديد</span>
                </button>
              </div>
            </div>

            {/* BACK FACE: Create Account */}
            <div className="flip-card-face flip-card-face-back absolute inset-0 w-full min-h-[630px] chamfered-glass-card smoked-glass-elevated p-6 sm:p-8 flex flex-col justify-between overflow-y-auto">
              <div className="pointer-events-none absolute top-0 left-0 w-36 h-36 opacity-20">
                <DotMatrixPattern />
              </div>

              <div className="relative z-10">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <GeometricRavenCrest size={42} />
                    <div>
                      <span
                        className="font-mono-num text-xs font-black tracking-[0.16em] block"
                        style={{ color: 'var(--accent-bright)' }}
                      >
                        Morrow
                      </span>
                      <h1 className="font-display-ar text-xl font-black text-[var(--text-primary)]">
                        إنشاء حساب جديد
                      </h1>
                    </div>
                  </div>
                </div>

                {renderModeTabs('register')}

                <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                  {authMode !== 'google' && (
                    <div>
                      <label
                        htmlFor="flip-register-name"
                        className="block text-xs font-bold text-[var(--text-primary)]/90 mb-1.5"
                      >
                        الاسم الكامل {authMode === 'phone' ? '(اختياري)' : ''}
                      </label>
                      <div className="relative">
                        <User
                          size={16}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2"
                          style={{ color: 'var(--accent)' }}
                        />
                        <input
                          id="flip-register-name"
                          data-testid="register-displayname-input"
                          type="text"
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          placeholder="أحمد كريم"
                          className="w-full rounded-xl border border-[var(--border-color)] bg-black/40 pr-10 pl-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/60 focus:outline-none focus:border-[var(--accent)]"
                        />
                      </div>
                    </div>
                  )}

                  {authMode === 'google' && renderGooglePanel('register')}

                  {authMode === 'phone' && renderPhonePanel('register')}

                  {(authMode === 'username' || authMode === 'email') && (
                    <>
                      {authMode === 'username' ? (
                        <div>
                          <label
                            htmlFor="flip-register-username"
                            className="block text-xs font-bold text-[var(--text-primary)]/90 mb-1.5"
                          >
                            اسم المستخدم
                          </label>
                          <div className="relative">
                            <AtSign
                              size={16}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2"
                              style={{ color: 'var(--accent)' }}
                            />
                            <input
                              id="flip-register-username"
                              data-testid="register-username-input"
                              type="text"
                              dir="ltr"
                              autoComplete="username"
                              value={regUsername}
                              onChange={(e) =>
                                setRegUsername(normalizeUsernameInput(e.target.value))
                              }
                              placeholder="ali_agency90"
                              className="w-full rounded-xl border border-[var(--border-color)] bg-black/40 pr-10 pl-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/60 focus:outline-none focus:border-[var(--accent)]"
                            />
                          </div>
                          <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                            3–32 حرفاً إنجليزياً أو رقماً أو (_ . -)
                          </p>
                        </div>
                      ) : (
                        <div>
                          <label
                            htmlFor="flip-register-email"
                            className="block text-xs font-bold text-[var(--text-primary)]/90 mb-1.5"
                          >
                            البريد الإلكتروني
                          </label>
                          <div className="relative">
                            <Mail
                              size={16}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2"
                              style={{ color: 'var(--accent)' }}
                            />
                            <input
                              id="flip-register-email"
                              data-testid="register-email-input"
                              type="email"
                              dir="ltr"
                              value={regEmail}
                              onChange={(e) => setRegEmail(e.target.value)}
                              placeholder="user@example.com"
                              className="w-full rounded-xl border border-[var(--border-color)] bg-black/40 pr-10 pl-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/60 focus:outline-none focus:border-[var(--accent)]"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label
                          htmlFor="flip-register-password"
                          className="block text-xs font-bold text-[var(--text-primary)]/90 mb-1.5"
                        >
                          كلمة المرور
                        </label>
                        <div className="relative">
                          <Lock
                            size={16}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--accent)' }}
                          />
                          <input
                            id={`flip-register-password`}
                            data-testid="register-password-input"
                            type={showRegPass ? 'text' : 'password'}
                            dir="ltr"
                            autoComplete="new-password"
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            placeholder="6 أحرف فأكثر"
                            className="w-full rounded-xl border border-[var(--border-color)] bg-black/40 pr-10 pl-10 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/60 focus:outline-none focus:border-[var(--accent)]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegPass((v) => !v)}
                            aria-label="إظهار أو إخفاء كلمة المرور"
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                          >
                            {showRegPass ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>

                      <motion.button
                        type="submit"
                        disabled={busy}
                        data-testid="register-submit-btn"
                        whileHover={
                          reducedMotion || busy ? undefined : { y: -2, scale: 1.01 }
                        }
                        whileTap={
                          reducedMotion || busy ? undefined : { scale: 0.98 }
                        }
                        transition={TABRIX_TACTILE_SPRING}
                        className="obsidian-gold-cta w-full py-3 rounded-xl text-sm font-black cursor-pointer disabled:opacity-60"
                      >
                        {busy ? 'جارٍ إنشاء الحساب...' : 'إنشاء الحساب والدخول'}
                      </motion.button>
                    </>
                  )}

                  <AnimatePresence initial={false}>
                    {errorMsg && isFlipped && (
                      <motion.div
                        key="register-error"
                        variants={
                          reducedMotion
                            ? TABRIX_REDUCED_VARIANTS
                            : TABRIX_POPOVER_VARIANTS
                        }
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        role="alert"
                        className="rounded-xl border border-red-500/35 bg-red-500/15 px-3.5 py-2.5 text-xs font-medium text-red-200"
                      >
                        {errorMsg}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </form>
              </div>

              <div className="relative z-10 mt-6 pt-4 border-t border-[var(--border-color)] flex items-center justify-between gap-2 text-xs">
                <span className="text-[var(--text-muted)]">لديك حساب مسجل مسبقاً؟</span>
                <button
                  type="button"
                  data-testid="switch-to-login-btn"
                  onClick={() => triggerFlip(false)}
                  className="inline-flex items-center gap-1.5 font-bold hover:opacity-85 transition-opacity cursor-pointer"
                  style={{ color: 'var(--accent-bright)' }}
                >
                  <ArrowLeftRight size={14} />
                  <span>العودة لتسجيل الدخول</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
