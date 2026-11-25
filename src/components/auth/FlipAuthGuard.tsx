import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeftRight,
  AtSign,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Phone,
  RotateCcw,
  Sparkles,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import type {
  AppShapeId,
  AuthUser,
  Surface2DPrefs,
  Surface2DThemeId,
} from '../../types/agency';
import {
  confirmPasswordResetApi,
  getRememberedAccounts,
  googleQuickSignInApi,
  loginWithPasswordApi,
  registerWithPasswordApi,
  removeRememberedAccount,
  requestPasswordResetApi,
  requestPhoneOtpApi,
  signInWithFirebaseGoogle,
  verifyPhoneOtpApi,
  type RememberedAccountSummary,
} from '../../lib/authClient';
import { getTenantLocalFallbackKey } from '../../services/storage/tenantStorage';
import { GeometricRavenCrest } from '../brand/VectorMotifs';
import { Backdrop2DCanvas } from '../motion2d/Backdrop2DCanvas';
import { InteractiveLamp } from './InteractiveLamp';
import {
  LampRaymarchShader,
  type LampShaderPhysicsState,
} from './LampRaymarchShader';
import {
  TABRIX_POPOVER_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  TABRIX_TACTILE_SPRING,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';
import {
  normalizeUsernameInput,
  triggerGlobalMotionPulse,
  validateAuthUsername,
} from '../../utils/surface2dConfig';
import {
  playLampHumAndChord,
  playTactileFeedback,
  setGlobalAppSoundEnabled,
  shouldFireTactileEvent,
  stopLampAmbiencePad,
} from '../../utils/tactileFeedback';
import {
  fetchServerSpaceContext,
  getLocalIntelligentAmbience,
  type IntelligentAmbience,
} from '../../utils/intelligentAmbience';
import { setBackgroundMusicVolume } from '../../utils/backgroundMusicEngine';
import { useDelayedLoading } from '../../utils/delayedLoader';

interface FlipAuthGuardProps {
  onAuthenticated: (user: AuthUser) => void;
  themeId?: Surface2DThemeId;
  surfacePrefs?: Surface2DPrefs;
  appShape?: AppShapeId;
}

type AuthInputMode = 'google' | 'username' | 'phone' | 'email';
type PhoneFlowMode = 'otp' | 'password';
type ConsoleActionMode = 'login' | 'register' | 'reset';

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

function readAccountAgencyHint(uid: string): number | null {
  try {
    const raw = localStorage.getItem(getTenantLocalFallbackKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { payloadText?: string };
    if (typeof parsed?.payloadText === 'string') {
      const state = JSON.parse(parsed.payloadText) as { agencies?: unknown[] };
      if (Array.isArray(state?.agencies) && state.agencies.length > 0) {
        return state.agencies.length;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export const FlipAuthGuard: React.FC<FlipAuthGuardProps> = ({
  onAuthenticated,
  themeId = 'obsidian_gold',
  surfacePrefs,
  appShape,
}) => {
  const [isLampOn, setIsLampOn] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const [isFormFocused, setIsFormFocused] = useState(false);

  const [actionMode, setActionMode] = useState<ConsoleActionMode>('login');
  const [authMode, setAuthMode] = useState<AuthInputMode>('username');
  const [phoneFlow, setPhoneFlow] = useState<PhoneFlowMode>('otp');
  const [rememberMe, setRememberMe] = useState(true);
  const reducedMotion = useTabrixReducedMotion();

  const [rememberedAccounts, setRememberedAccounts] = useState<RememberedAccountSummary[]>(
    () => getRememberedAccounts()
  );

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

  // Password Recovery state
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [resetDemoHint, setResetDemoHint] = useState('');
  const [resetTargetLabel, setResetTargetLabel] = useState('');
  const [resetNewPass, setResetNewPass] = useState('');
  const [resetConfirmPass, setResetConfirmPass] = useState('');
  const [showResetPass, setShowResetPass] = useState(false);

  const [busy, setBusy] = useState(false);
  useDelayedLoading(busy, 'جاري التحقق وتسجيل الدخول...');
  const [errorMsg, setErrorMsg] = useState('');
  const [statusNotice, setStatusNotice] = useState('');
  const lastTactileRef = useRef(0);
  const lampApertureRef = useRef<HTMLSpanElement | null>(null);
  const loginPanelRef = useRef<HTMLDivElement | null>(null);
  const panelInteractiveRef = useRef<HTMLDivElement | null>(null);
  const lampPhysicsRef = useRef<LampShaderPhysicsState>({
    cordSwayNorm: 0,
    cordPullNorm: 0,
    headAngleDeg: -14,
  });

  const isFlipped = actionMode === 'register';
  const turningOn = isLampOn;

  const accountAgencyCounts = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const acc of rememberedAccounts) {
      map.set(acc.uid, readAccountAgencyHint(acc.uid));
    }
    return map;
  }, [rememberedAccounts]);

  useEffect(() => {
    setRememberedAccounts(getRememberedAccounts());
  }, []);

  useEffect(() => {
    const el = panelInteractiveRef.current as (HTMLDivElement & { inert?: boolean }) | null;
    if (el) {
      el.inert = !isLampOn;
    }
  }, [isLampOn]);

  const triggerFieldTactile = () => {
    const now = performance.now();
    if (!shouldFireTactileEvent(now, lastTactileRef.current, 85)) return;
    lastTactileRef.current = now;
    playTactileFeedback('tap', { sound: true, haptic: true });
  };

  const [ambience, setAmbience] = useState<IntelligentAmbience>(() =>
    getLocalIntelligentAmbience()
  );
  const serverSoundEnabledRef = useRef(true);

  useEffect(() => {
    let active = true;
    void fetchServerSpaceContext().then((ctx) => {
      if (!active) return;
      serverSoundEnabledRef.current = ctx.sound_enabled;
      setGlobalAppSoundEnabled(ctx.sound_enabled);
      setBackgroundMusicVolume(ctx.volume);
      setAmbience(ctx.ambience);
    });
    return () => {
      active = false;
      stopLampAmbiencePad();
    };
  }, []);

  const handleToggleLamp = useCallback(
    (nextOn: boolean) => {
      setIsLampOn(nextOn);
      setPullProgress(0);
      if (nextOn) {
        // Auto-open directly on the Sign In section (قسم تسجيل الدخول)
        setActionMode('login');
        setErrorMsg('');
        setStatusNotice('');
        setOtpSent(false);
        setResetCodeSent(false);
        if (serverSoundEnabledRef.current) {
          playLampHumAndChord(ambience.chord);
        }
      } else {
        setIsFormFocused(false);
        stopLampAmbiencePad();
      }
      triggerGlobalMotionPulse(nextOn ? 1.25 : 0.95);
    },
    [ambience.chord]
  );

  const switchActionMode = (nextMode: ConsoleActionMode) => {
    playTactileFeedback('tap', { sound: true, haptic: true });
    setErrorMsg('');
    setStatusNotice('');
    setOtpSent(false);
    setOtpCode('');
    setDemoOtpHint('');
    setResetCodeSent(false);
    setResetCode('');
    setResetDemoHint('');
    if (nextMode === 'reset') {
      if (authMode === 'google') {
        setAuthMode('email');
      }
      const prefill =
        authMode === 'username'
          ? loginUsername
          : authMode === 'phone'
          ? loginPhone
          : loginEmail || googleQuickEmail;
      if (prefill && !resetIdentifier) {
        setResetIdentifier(prefill);
      }
    }
    setActionMode(nextMode);
    triggerGlobalMotionPulse(1.15);
  };

  const handleModeSwitch = (mode: AuthInputMode) => {
    setAuthMode(mode);
    setErrorMsg('');
    setStatusNotice('');
    setOtpSent(false);
    setOtpCode('');
    setDemoOtpHint('');
    setResetCodeSent(false);
    setResetCode('');
    setResetDemoHint('');
  };

  const handleSelectRememberedAccount = async (acc: RememberedAccountSummary) => {
    playTactileFeedback('tap', { sound: true, haptic: true });
    setErrorMsg('');
    setStatusNotice('');
    setActionMode('login');

    if (acc.provider === 'google') {
      if (acc.email) {
        setAuthMode('google');
        setGoogleQuickEmail(acc.email);
        setLoginEmail(acc.email);
        setStatusNotice(
          `تم اختيار حساب ${acc.displayName}. يمكنك المتابعة عبر Google أو Gmail السريع.`
        );
      }
      return;
    }

    if (acc.provider === 'username') {
      setAuthMode('username');
      setLoginUsername(acc.username || '');
      setStatusNotice(`تم تعبئة اسم المستخدم (${acc.username}). أدخل كلمة المرور للدخول.`);
      return;
    }

    if (acc.provider === 'phone') {
      setAuthMode('phone');
      setLoginPhone(acc.phone || '');
      setStatusNotice(
        `تم تعبئة رقم الهاتف (${acc.phone}). اختر رمز التحقق أو كلمة المرور.`
      );
    }
  };

  const handleRemoveRememberedAccount = (uid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRememberedAccounts(removeRememberedAccount(uid));
  };

  const handleGooglePopup = async () => {
    setErrorMsg('');
    setStatusNotice('');
    setBusy(true);
    try {
      const session = await signInWithFirebaseGoogle({
        rememberMe,
        loginHint: googleQuickEmail.trim() || undefined,
      });
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
    setStatusNotice('');
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
        rememberMe,
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
    setStatusNotice('');

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
          rememberMe,
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
            rememberMe,
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
            rememberMe,
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
        rememberMe,
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
    setStatusNotice('');
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
          rememberMe,
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
            rememberMe,
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
            rememberMe,
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
        rememberMe,
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

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusNotice('');
    const resetMode: 'google' | 'username' | 'phone' =
      authMode === 'phone'
        ? 'phone'
        : authMode === 'email' || authMode === 'google'
        ? 'google'
        : 'username';
    const identifier = resetIdentifier.trim();

    if (!identifier) {
      setErrorMsg('يرجى إدخال اسم المستخدم أو البريد أو رقم الهاتف.');
      return;
    }

    setBusy(true);
    try {
      if (!resetCodeSent) {
        const res = await requestPasswordResetApi({
          mode: resetMode,
          identifier:
            resetMode === 'username'
              ? normalizeUsernameInput(identifier)
              : identifier,
        });
        setResetCodeSent(true);
        setResetTargetLabel(res.maskedTarget || identifier);
        if (res.demoCode) setResetDemoHint(res.demoCode);
        setStatusNotice('تم إنشاء رمز الاستعادة. أدخل الرمز وكلمة المرور الجديدة.');
      } else {
        if (!resetCode.trim()) {
          setErrorMsg('يرجى إدخال رمز التحقق المرسل.');
          setBusy(false);
          return;
        }
        if (resetNewPass.length < 6) {
          setErrorMsg('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.');
          setBusy(false);
          return;
        }
        if (resetNewPass !== resetConfirmPass) {
          setErrorMsg('كلمتا المرور غير متطابقتين.');
          setBusy(false);
          return;
        }
        const session = await confirmPasswordResetApi({
          mode: resetMode,
          identifier:
            resetMode === 'username'
              ? normalizeUsernameInput(identifier)
              : identifier,
          code: resetCode.trim(),
          newPassword: resetNewPass,
          rememberMe,
        });
        playTactileFeedback('success', { sound: true, haptic: true });
        onAuthenticated(session.user);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر إتمام استعادة كلمة المرور.'
      );
    } finally {
      setBusy(false);
    }
  };

  const renderRememberMeRow = (showForgotLink: boolean) => (
    <div className="flex items-center justify-between gap-3 pt-0.5">
      <label className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]/85 cursor-pointer select-none">
        <span className="relative flex h-4 w-4 items-center justify-center">
          <input
            type="checkbox"
            checked={rememberMe}
            data-testid="remember-me-checkbox"
            onChange={(e) => setRememberMe(e.target.checked)}
            className="peer sr-only"
          />
          <span
            className="flex h-4 w-4 items-center justify-center rounded border transition-colors"
            style={{
              borderColor: rememberMe ? 'var(--accent)' : 'var(--border-color)',
              backgroundColor: rememberMe ? 'var(--accent)' : 'var(--surface-well)',
              color: 'var(--accent-fg)',
            }}
          >
            {rememberMe && <Check size={11} strokeWidth={3} />}
          </span>
        </span>
        <span>تذكرني على هذا الجهاز</span>
      </label>

      {showForgotLink && (
        <button
          type="button"
          data-testid="forgot-password-link"
          onClick={() => switchActionMode('reset')}
          className="text-xs font-bold hover:underline cursor-pointer whitespace-nowrap"
          style={{ color: 'var(--accent-bright)' }}
        >
          نسيت كلمة المرور؟
        </button>
      )}
    </div>
  );

  const renderModeTabs = (face: 'login' | 'register') => (
    <div
      role="tablist"
      aria-label="طرق الدخول"
      className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-2xl recessed-well border border-[var(--border-color)] mb-4"
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
            className="py-2 px-2 rounded-xl text-[11px] font-extrabold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap min-h-[38px]"
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
        className="w-full py-3 px-4 rounded-xl border bg-[var(--surface-pill)] hover:bg-[var(--bg-nav-active)] text-xs font-extrabold text-[var(--text-primary)] flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-60 min-h-[44px]"
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
        <div className="h-px flex-1 bg-[var(--border-color)]" />
        <span className="text-[11px] text-[var(--text-muted)]">أو الدخول السريع ببريد Gmail</span>
        <div className="h-px flex-1 bg-[var(--border-color)]" />
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
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-well)] pr-10 pl-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/60 focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      {renderRememberMeRow(false)}

      <motion.button
        type="submit"
        disabled={busy}
        data-testid={`${face}-submit-btn`}
        whileHover={reducedMotion || busy ? undefined : { y: -2, scale: 1.01 }}
        whileTap={reducedMotion || busy ? undefined : { scale: 0.98 }}
        transition={TABRIX_TACTILE_SPRING}
        className="obsidian-gold-cta w-full py-3 rounded-xl text-sm font-black cursor-pointer disabled:opacity-60 min-h-[44px]"
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
            className="rounded-xl border py-2 font-extrabold transition-colors cursor-pointer"
            style={{
              borderColor:
                phoneFlow === 'otp' ? 'var(--accent)' : 'var(--border-color)',
              backgroundColor:
                phoneFlow === 'otp' ? 'var(--bg-nav-active)' : 'var(--surface-well)',
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
            className="rounded-xl border py-2 font-extrabold transition-colors cursor-pointer"
            style={{
              borderColor:
                phoneFlow === 'password' ? 'var(--accent)' : 'var(--border-color)',
              backgroundColor:
                phoneFlow === 'password' ? 'var(--bg-nav-active)' : 'var(--surface-well)',
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
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-well)] pr-10 pl-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/60 tabular-nums focus:outline-none focus:border-[var(--accent)]"
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
                    className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-well)] px-3 py-2.5 text-center text-base font-black tracking-[0.25em] text-[var(--text-primary)] tabular-nums focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>
            )}

            {renderRememberMeRow(false)}

            <motion.button
              type="submit"
              disabled={busy}
              data-testid={`${face}-submit-btn`}
              whileHover={reducedMotion || busy ? undefined : { y: -2, scale: 1.01 }}
              whileTap={reducedMotion || busy ? undefined : { scale: 0.98 }}
              transition={TABRIX_TACTILE_SPRING}
              className="obsidian-gold-cta w-full py-3 rounded-xl text-sm font-black inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 min-h-[44px]"
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
                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-well)] pr-10 pl-10 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/60 focus:outline-none focus:border-[var(--accent)]"
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

            {renderRememberMeRow(face === 'login')}

            <motion.button
              type="submit"
              disabled={busy}
              data-testid={`${face}-submit-btn`}
              whileHover={reducedMotion || busy ? undefined : { y: -2, scale: 1.01 }}
              whileTap={reducedMotion || busy ? undefined : { scale: 0.98 }}
              transition={TABRIX_TACTILE_SPRING}
              className="obsidian-gold-cta w-full py-3 rounded-xl text-sm font-black cursor-pointer disabled:opacity-60 min-h-[44px]"
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
      className="ambient-obsidian-canvas fixed inset-0 z-[135] flex min-h-[100dvh] flex-col p-4 sm:p-6 overflow-y-auto"
    >
      <Backdrop2DCanvas
        themeId={themeId}
        surfacePrefs={surfacePrefs}
        appShape={appShape}
        reduceMotion={reducedMotion}
      />

      {/* WebGL Raymarching Volumetric Lamp Shader with live cord-angle shadows & city-glass wash */}
      <LampRaymarchShader
        isOn={isLampOn}
        isFocused={isFormFocused}
        pullProgress={pullProgress}
        reducedMotion={reducedMotion}
        apertureRef={lampApertureRef}
        panelRef={loginPanelRef}
        physicsRef={lampPhysicsRef}
      />

      {/* Subtle Warm Ambient Room Base Fill complementing the WebGL Raymarch Shader */}
      <motion.div
        aria-hidden="true"
        data-testid="auth-lamp-bg-glow"
        className="pointer-events-none fixed inset-0 z-[1]"
        initial={false}
        animate={{
          opacity: turningOn ? (isFormFocused ? 0.72 : 0.62) : pullProgress * 0.22,
          scale: turningOn ? 1 : 0.88 + pullProgress * 0.08,
        }}
        transition={{
          duration: reducedMotion ? 0.12 : 0.6,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{
          background:
            'radial-gradient(ellipse 68% 56% at 32% 38%, rgba(255, 232, 162, 0.14) 0%, rgba(212, 175, 55, 0.07) 36%, rgba(168, 128, 42, 0.025) 62%, transparent 84%)',
        }}
      />

      <div className="relative z-10 my-auto flex w-full flex-col items-center justify-center">
        {/* Clean Architectural Brand Header */}
        <div className="mb-4 lg:mb-6 flex flex-col items-center text-center gap-1.5">
          <div className="flex items-center gap-2.5">
            <GeometricRavenCrest size={30} />
            <span
              className="font-mono-num text-base font-black tracking-[0.22em]"
              style={{ color: 'var(--accent-bright)' }}
            >
              Morrow
            </span>
          </div>
          <p className="text-[11px] font-medium text-[var(--text-muted)]">
            منصة إدارة الوكالات والعمليات الذكية
          </p>
        </div>

        {/* Main Precision Stage (LTR row places Lamp strictly on LEFT, Login Panel neatly on RIGHT) */}
        <div
          dir="ltr"
          className="relative w-full max-w-[930px] flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 lg:gap-9"
        >
          {/* Desktop Ground Desk Horizon Pool beneath Left Lamp Base & Lower Panel Edge */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none hidden lg:block absolute -bottom-7 left-[8%] right-[14%] h-12 z-[1] rounded-full blur-2xl"
            initial={false}
            animate={{
              opacity: turningOn ? (isFormFocused ? 0.68 : 0.56) : pullProgress * 0.16,
              scaleX: turningOn ? 1 : 0.56,
            }}
            transition={{
              duration: reducedMotion ? 0.12 : 0.64,
              delay: turningOn && !reducedMotion ? 0.08 : 0,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{
              background:
                'radial-gradient(ellipse 76% 85% at 36% 50%, rgba(244, 214, 118, 0.14) 0%, rgba(212, 175, 55, 0.05) 48%, rgba(0, 0, 0, 0.72) 78%, transparent 100%)',
            }}
          />

          {/* Left-Mounted Cantilever Pull-Cord Lamp Stage */}
          <div className="relative z-20 shrink-0 lg:pt-1 flex flex-col items-center justify-center">
            <InteractiveLamp
              isOn={isLampOn}
              onToggleLamp={handleToggleLamp}
              onPullProgress={setPullProgress}
              focusBoost={isFormFocused}
              reducedMotion={reducedMotion}
              apertureRef={lampApertureRef}
              physicsRef={lampPhysicsRef}
            />
          </div>

          {/* Right-Mounted Glassmorphic Login Panel: sits darkened in shadow until Lamp Beam sweeps across to reveal it */}
          <div
            ref={panelInteractiveRef}
            dir="rtl"
            aria-hidden={!isLampOn}
            className={`relative z-10 w-full max-w-[536px] lg:w-[536px] lg:mt-6 shrink-0 transition-[opacity,transform,filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isLampOn
                ? `opacity-100 translate-y-0 scale-100 pointer-events-auto brightness-100 ${
                    reducedMotion
                      ? ''
                      : 'max-lg:animate-[tabrixFadeSlideIn_380ms_cubic-bezier(0.22,1,0.36,1)]'
                  }`
                : 'max-lg:hidden opacity-100 translate-y-0 scale-[0.992] pointer-events-none select-none brightness-[0.34]'
            }`}
            onPointerDownCapture={(e) => {
              if ((e.target as HTMLElement)?.tagName === 'INPUT') {
                triggerFieldTactile();
              }
            }}
            onFocusCapture={(e) => {
              setIsFormFocused(true);
              if ((e.target as HTMLElement)?.tagName === 'INPUT') {
                triggerFieldTactile();
              }
            }}
            onBlurCapture={(e) => {
              const related = e.relatedTarget as Node | null;
              if (!e.currentTarget.contains(related)) {
                setIsFormFocused(false);
              }
            }}
          >
            {/* Dynamic Angle-Based Architectural Cast Shadows matching Left-to-Right Beam (Down-Right on Desktop, Down on Mobile) */}
            <motion.div
              aria-hidden="true"
              className="pointer-events-none hidden lg:block absolute inset-1 -z-10 rounded-[30px] blur-2xl"
              initial={false}
              animate={{
                opacity: turningOn ? (isFormFocused ? 0.94 : 0.82) : 0.25,
                x: turningOn ? 26 : 6,
                y: turningOn ? 28 : 10,
                scale: turningOn ? 1.03 : 0.96,
              }}
              transition={{
                duration: reducedMotion ? 0.12 : 0.62,
                delay: turningOn && !reducedMotion ? 0.08 : 0,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                background:
                  'radial-gradient(92% 88% at 58% 54%, rgba(0, 0, 0, 0.92) 0%, rgba(2, 2, 4, 0.78) 54%, transparent 100%)',
              }}
            />
            <motion.div
              aria-hidden="true"
              className="pointer-events-none lg:hidden absolute inset-1 -z-10 rounded-[30px] blur-2xl"
              initial={false}
              animate={{
                opacity: turningOn ? (isFormFocused ? 0.9 : 0.78) : 0,
                y: turningOn ? 22 : 8,
                scale: turningOn ? 1.02 : 0.94,
              }}
              transition={{
                duration: reducedMotion ? 0.12 : 0.56,
                delay: turningOn && !reducedMotion ? 0.06 : 0,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                background:
                  'radial-gradient(90% 86% at 50% 56%, rgba(0, 0, 0, 0.90) 0%, rgba(2, 2, 4, 0.74) 54%, transparent 100%)',
              }}
            />

          <div
            ref={loginPanelRef}
            className="relative w-full overflow-hidden rounded-[26px] border p-5 sm:p-7 backdrop-blur-2xl"
            style={{
              borderColor: turningOn
                ? isFormFocused
                  ? 'rgba(249, 232, 168, 0.54)'
                  : 'rgba(238, 210, 120, 0.38)'
                : pullProgress > 0.08
                ? 'rgba(212, 175, 55, 0.22)'
                : 'rgba(212, 175, 55, 0.09)',
              background: turningOn
                ? 'linear-gradient(114deg, rgba(46, 36, 19, 0.92) 0%, rgba(20, 17, 13, 0.94) 38%, rgba(10, 10, 13, 0.97) 74%, rgba(6, 6, 8, 0.99) 100%)'
                : 'linear-gradient(125deg, rgba(10, 10, 12, 0.92) 0%, rgba(5, 5, 7, 0.98) 100%)',
              boxShadow: turningOn
                ? 'inset 0 1px 0 rgba(255, 240, 192, 0.32), inset 1px 0 0 rgba(249, 232, 168, 0.42), inset -2px -2px 14px rgba(0, 0, 0, 0.42), -18px -4px 44px -18px rgba(244, 214, 118, 0.24), 26px 32px 72px -14px rgba(0, 0, 0, 0.96)'
                : '0 24px 56px -22px rgba(0, 0, 0, 0.96)',
            }}
          >
            {/* Directional Obsidian Darkness Veil that parts from Left-to-Right as Lamp Light sweeps the panel */}
            <motion.div
              aria-hidden="true"
              className="pointer-events-none hidden lg:block absolute inset-0 z-30 rounded-[26px]"
              initial={false}
              animate={{
                opacity: turningOn ? 0 : Math.max(0.72, 0.96 - pullProgress * 0.16),
                scaleX: turningOn ? 0 : 1,
              }}
              transition={{
                duration: reducedMotion ? 0.14 : 0.62,
                delay: turningOn && !reducedMotion ? 0.04 : 0,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                transformOrigin: 'right center',
                background:
                  'linear-gradient(90deg, rgba(5, 5, 7, 0.86) 0%, rgba(5, 5, 7, 0.96) 24%, rgba(4, 4, 6, 0.99) 100%)',
              }}
            />

            {/* Grazing Specular Rim on the Lamp-Facing Edge (Left Edge on Desktop / Top Edge on Mobile) */}
            <motion.div
              aria-hidden="true"
              className="pointer-events-none hidden lg:block absolute top-3 bottom-3 left-0 w-[2px] z-20 rounded-full"
              initial={false}
              animate={{
                opacity: turningOn ? (isFormFocused ? 0.98 : 0.86) : pullProgress * 0.48,
                scaleY: turningOn ? 1 : 0.32 + pullProgress * 0.42,
              }}
              transition={{
                duration: reducedMotion ? 0.1 : 0.48,
                delay: turningOn && !reducedMotion ? 0.06 : 0,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                transformOrigin: 'center 26%',
                background:
                  'linear-gradient(180deg, rgba(255, 248, 220, 0.12) 0%, rgba(255, 244, 196, 0.96) 26%, rgba(212, 175, 55, 0.48) 64%, transparent 94%)',
              }}
            />
            <motion.div
              aria-hidden="true"
              className="pointer-events-none hidden lg:block absolute top-0 left-3 right-12 h-[1.5px] z-20 rounded-full"
              initial={false}
              animate={{
                opacity: turningOn ? (isFormFocused ? 0.92 : 0.78) : pullProgress * 0.25,
                scaleX: turningOn ? 1 : 0.2 + pullProgress * 0.2,
              }}
              transition={{
                duration: reducedMotion ? 0.1 : 0.56,
                delay: turningOn && !reducedMotion ? 0.08 : 0,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                transformOrigin: 'left center',
                background:
                  'linear-gradient(90deg, rgba(255, 246, 206, 0.88) 0%, rgba(238, 210, 120, 0.38) 48%, transparent 100%)',
              }}
            />
            <motion.div
              aria-hidden="true"
              className="pointer-events-none lg:hidden absolute inset-x-4 top-0 h-[2px] z-20 rounded-full"
              initial={false}
              animate={{
                opacity: turningOn ? (isFormFocused ? 1 : 0.9) : 0,
                scaleX: turningOn ? 1 : 0.35,
              }}
              transition={{
                duration: reducedMotion ? 0.1 : 0.44,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(255, 242, 190, 0.95) 50%, transparent 100%)',
              }}
            />

            {/* Smooth Cohesive Golden Spill Reflection Washing Progressively Left-to-Right Across Form Interior */}
            <motion.div
              aria-hidden="true"
              data-testid="auth-lamp-form-glow"
              className="pointer-events-none absolute inset-0 z-0"
              initial={false}
              animate={{
                opacity: turningOn ? (isFormFocused ? 1 : 0.9) : 0,
                scaleX: turningOn ? 1 : 0.65,
              }}
              transition={{
                duration: reducedMotion ? 0.12 : 0.56,
                delay: turningOn && !reducedMotion ? 0.06 : 0,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                transformOrigin: 'left 26%',
                background:
                  'radial-gradient(100% 85% at 4% 24%, rgba(255, 242, 190, 0.22) 0%, rgba(238, 206, 108, 0.10) 36%, rgba(200, 155, 60, 0.03) 64%, transparent 88%)',
              }}
            />

            {/* Gentle Far-Right Low-Light Falloff (kept subtle behind controls so UI legibility stays razor sharp) */}
            <motion.div
              aria-hidden="true"
              data-testid="auth-lamp-penumbra-mask"
              className="pointer-events-none absolute inset-0 z-[1] hidden lg:block"
              initial={false}
              animate={{
                opacity: turningOn ? 1 : 0,
              }}
              transition={{
                duration: reducedMotion ? 0.12 : 0.54,
                delay: turningOn && !reducedMotion ? 0.08 : 0,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                background:
                  'radial-gradient(115% 98% at 14% 26%, transparent 52%, rgba(4, 4, 6, 0.22) 80%, rgba(2, 2, 4, 0.40) 100%)',
              }}
            />
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-[1] lg:hidden"
              initial={false}
              animate={{
                opacity: turningOn ? 1 : 0,
              }}
              transition={{
                duration: reducedMotion ? 0.12 : 0.5,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                background:
                  'radial-gradient(108% 90% at 50% 14%, transparent 52%, rgba(4, 4, 6, 0.20) 80%, rgba(2, 2, 4, 0.36) 100%)',
              }}
            />


            {/* Unified Header + Action Mode Bar */}
            <div className="relative z-10 mb-4 space-y-3.5">
              <div>
                {actionMode === 'login' && (
                  <div
                    className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide"
                    style={{ color: ambience.glowPrimary }}
                  >
                    <Sparkles size={12} />
                    <span>{ambience.greeting}</span>
                  </div>
                )}
                <h1 className="font-display-ar text-xl sm:text-2xl font-black text-[var(--text-primary)]">
                  {actionMode === 'register'
                    ? 'إنشاء حساب جديد'
                    : actionMode === 'reset'
                    ? 'استعادة كلمة المرور'
                    : 'تسجيل الدخول'}
                </h1>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {actionMode === 'register'
                    ? 'أنشئ حسابك الكامل عبر أي طريقة مع حفظ مستقل لبيانات وكالاتك.'
                    : actionMode === 'reset'
                    ? 'تحقق من هويتك عبر الرمز وأعد تعيين كلمة المرور بأمان.'
                    : `${ambience.sub} · Google · اسم المستخدم · الهاتف · البريد`}
                </p>
              </div>

              {/* Unified Action Switcher: Sign In / Sign Up / Reset */}
              <div
                role="tablist"
                aria-label="وضع البوابة"
                className="grid grid-cols-3 gap-1.5 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-well)] p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={actionMode === 'login'}
                  data-testid="switch-to-login-btn"
                  onClick={() => switchActionMode('login')}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-[11px] sm:text-xs font-extrabold whitespace-nowrap transition-colors cursor-pointer"
                  style={{
                    backgroundColor:
                      actionMode === 'login' ? 'var(--accent)' : 'transparent',
                    color:
                      actionMode === 'login'
                        ? 'var(--accent-fg)'
                        : 'var(--text-muted)',
                  }}
                >
                  <ArrowLeftRight size={13} />
                  <span>تسجيل الدخول</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={actionMode === 'register'}
                  data-testid="switch-to-register-btn"
                  onClick={() => switchActionMode('register')}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-[11px] sm:text-xs font-extrabold whitespace-nowrap transition-colors cursor-pointer"
                  style={{
                    backgroundColor:
                      actionMode === 'register' ? 'var(--accent)' : 'transparent',
                    color:
                      actionMode === 'register'
                        ? 'var(--accent-fg)'
                        : 'var(--text-muted)',
                  }}
                >
                  <UserPlus size={13} />
                  <span>إنشاء حساب</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={actionMode === 'reset'}
                  data-testid="switch-to-reset-btn"
                  onClick={() => switchActionMode('reset')}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-[11px] sm:text-xs font-extrabold whitespace-nowrap transition-colors cursor-pointer"
                  style={{
                    backgroundColor:
                      actionMode === 'reset' ? 'var(--accent)' : 'transparent',
                    color:
                      actionMode === 'reset'
                        ? 'var(--accent-fg)'
                        : 'var(--text-muted)',
                  }}
                >
                  <RotateCcw size={13} />
                  <span>استعادة المرور</span>
                </button>
              </div>
            </div>

            {/* Remembered / Connected Accounts Quick Switch Strip */}
            {rememberedAccounts.length > 0 && actionMode === 'login' && (
              <div className="relative z-10 mb-4 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-well)]/75 p-3">
                <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)]">
                  <span>الحسابات والوكالات المتصلة سابقاً</span>
                  <span className="font-mono-num tabular-nums">
                    {rememberedAccounts.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {rememberedAccounts.map((acc) => {
                    const agencyCount = accountAgencyCounts.get(acc.uid);
                    const handleLabel =
                      acc.username || acc.email || acc.phone || acc.provider;
                    return (
                      <div
                        key={acc.uid}
                        className="group inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)]/85 pr-2.5 pl-1.5 py-1.5 text-xs transition-colors hover:border-[var(--accent)]"
                      >
                        <button
                          type="button"
                          onClick={() => void handleSelectRememberedAccount(acc)}
                          className="flex items-center gap-2 text-right cursor-pointer min-w-0"
                        >
                          {acc.avatarUrl ? (
                            <img
                              src={acc.avatarUrl}
                              alt={acc.displayName}
                              referrerPolicy="no-referrer"
                              className="h-6 w-6 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <span
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black"
                              style={{
                                backgroundColor: 'var(--bg-nav-active)',
                                color: 'var(--accent-bright)',
                              }}
                            >
                              {acc.displayName.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <span className="truncate max-w-[140px] font-bold text-[var(--text-primary)]">
                            {acc.displayName}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[110px]">
                            · {handleLabel}
                            {agencyCount ? ` · ${agencyCount} وكالة` : ''}
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label={`إزالة ${acc.displayName} من القائمة السريعة`}
                          onClick={(e) => handleRemoveRememberedAccount(acc.uid, e)}
                          className="rounded-lg p-1 text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Animated Mode Content (transform + opacity only) */}
            <div className="relative z-10">
              <AnimatePresence mode="wait" initial={false}>
                {actionMode === 'login' && (
                  <motion.div
                    key="auth-panel-login"
                    initial={
                      reducedMotion
                        ? { opacity: 0 }
                        : { opacity: 0, y: 8, scale: 0.99 }
                    }
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={
                      reducedMotion
                        ? { opacity: 0 }
                        : { opacity: 0, y: -8, scale: 0.99 }
                    }
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {renderModeTabs('login')}

                    <form onSubmit={handleLoginSubmit} className="space-y-3.5">
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
                                    setLoginUsername(
                                      normalizeUsernameInput(e.target.value)
                                    )
                                  }
                                  placeholder="ali_agency90"
                                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-well)] pr-10 pl-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/60 focus:outline-none focus:border-[var(--accent)]"
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
                                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-well)] pr-10 pl-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/60 focus:outline-none focus:border-[var(--accent)]"
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
                                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-well)] pr-10 pl-10 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/60 focus:outline-none focus:border-[var(--accent)]"
                              />
                              <button
                                type="button"
                                onClick={() => setShowLoginPass((v) => !v)}
                                aria-label="إظهار أو إخفاء كلمة المرور"
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                              >
                                {showLoginPass ? (
                                  <EyeOff size={15} />
                                ) : (
                                  <Eye size={15} />
                                )}
                              </button>
                            </div>
                          </div>

                          {renderRememberMeRow(true)}

                          <motion.button
                            type="submit"
                            disabled={busy}
                            data-testid="login-submit-btn"
                            whileHover={
                              reducedMotion || busy
                                ? undefined
                                : { y: -2, scale: 1.01 }
                            }
                            whileTap={
                              reducedMotion || busy ? undefined : { scale: 0.98 }
                            }
                            transition={TABRIX_TACTILE_SPRING}
                            className="obsidian-gold-cta w-full py-3 rounded-xl text-sm font-black cursor-pointer disabled:opacity-60 min-h-[44px]"
                          >
                            {busy
                              ? 'جارٍ التحقق...'
                              : authMode === 'username'
                              ? 'دخول باسم المستخدم'
                              : 'دخول بالبريد الإلكتروني'}
                          </motion.button>
                        </>
                      )}
                    </form>
                  </motion.div>
                )}

                {actionMode === 'register' && (
                  <motion.div
                    key="auth-panel-register"
                    initial={
                      reducedMotion
                        ? { opacity: 0 }
                        : { opacity: 0, y: 8, scale: 0.99 }
                    }
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={
                      reducedMotion
                        ? { opacity: 0 }
                        : { opacity: 0, y: -8, scale: 0.99 }
                    }
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  >
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
                              placeholder="اكتب اسمك هنا"
                              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-well)] pr-10 pl-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/60 focus:outline-none focus:border-[var(--accent)]"
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
                                    setRegUsername(
                                      normalizeUsernameInput(e.target.value)
                                    )
                                  }
                                  placeholder="ali_agency90"
                                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-well)] pr-10 pl-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/60 focus:outline-none focus:border-[var(--accent)]"
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
                                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-well)] pr-10 pl-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/60 focus:outline-none focus:border-[var(--accent)]"
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
                                id="flip-register-password"
                                data-testid="register-password-input"
                                type={showRegPass ? 'text' : 'password'}
                                dir="ltr"
                                autoComplete="new-password"
                                value={regPassword}
                                onChange={(e) => setRegPassword(e.target.value)}
                                placeholder="6 أحرف فأكثر"
                                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-well)] pr-10 pl-10 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/60 focus:outline-none focus:border-[var(--accent)]"
                              />
                              <button
                                type="button"
                                onClick={() => setShowRegPass((v) => !v)}
                                aria-label="إظهار أو إخفاء كلمة المرور"
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                              >
                                {showRegPass ? (
                                  <EyeOff size={15} />
                                ) : (
                                  <Eye size={15} />
                                )}
                              </button>
                            </div>
                          </div>

                          {renderRememberMeRow(false)}

                          <motion.button
                            type="submit"
                            disabled={busy}
                            data-testid="register-submit-btn"
                            whileHover={
                              reducedMotion || busy
                                ? undefined
                                : { y: -2, scale: 1.01 }
                            }
                            whileTap={
                              reducedMotion || busy ? undefined : { scale: 0.98 }
                            }
                            transition={TABRIX_TACTILE_SPRING}
                            className="obsidian-gold-cta w-full py-3 rounded-xl text-sm font-black cursor-pointer disabled:opacity-60 min-h-[44px]"
                          >
                            {busy ? 'جارٍ إنشاء الحساب...' : 'إنشاء الحساب والدخول'}
                          </motion.button>
                        </>
                      )}
                    </form>
                  </motion.div>
                )}

                {actionMode === 'reset' && (
                  <motion.div
                    key="auth-panel-reset"
                    initial={
                      reducedMotion
                        ? { opacity: 0 }
                        : { opacity: 0, y: 8, scale: 0.99 }
                    }
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={
                      reducedMotion
                        ? { opacity: 0 }
                        : { opacity: 0, y: -8, scale: 0.99 }
                    }
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="mb-4 grid grid-cols-3 gap-1.5 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-well)] p-1">
                      {(
                        [
                          ['username', 'اسم المستخدم', AtSign],
                          ['email', 'البريد', Mail],
                          ['phone', 'الهاتف', Phone],
                        ] as Array<[AuthInputMode, string, React.FC<{ size?: number }>]>
                      ).map(([id, label, Icon]) => {
                        const active =
                          authMode === id || (authMode === 'google' && id === 'email');
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => handleModeSwitch(id)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-[11px] font-extrabold whitespace-nowrap transition-colors cursor-pointer"
                            style={{
                              backgroundColor: active ? 'var(--accent)' : 'transparent',
                              color: active ? 'var(--accent-fg)' : 'var(--text-muted)',
                            }}
                          >
                            <Icon size={13} />
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <form onSubmit={handlePasswordResetSubmit} className="space-y-3.5">
                      <div>
                        <label
                          htmlFor="flip-reset-identifier"
                          className="block text-xs font-bold text-[var(--text-primary)]/90 mb-1.5"
                        >
                          {authMode === 'phone'
                            ? 'رقم الهاتف المسجل'
                            : authMode === 'email' || authMode === 'google'
                            ? 'البريد الإلكتروني المسجل'
                            : 'اسم المستخدم المسجل'}
                        </label>
                        <input
                          id="flip-reset-identifier"
                          data-testid="reset-identifier-input"
                          type={
                            authMode === 'phone'
                              ? 'tel'
                              : authMode === 'email' || authMode === 'google'
                              ? 'email'
                              : 'text'
                          }
                          dir="ltr"
                          disabled={resetCodeSent}
                          value={resetIdentifier}
                          onChange={(e) => setResetIdentifier(e.target.value)}
                          placeholder={
                            authMode === 'phone'
                              ? '07701234567'
                              : authMode === 'email' || authMode === 'google'
                              ? 'name@example.com'
                              : 'ali_agency90'
                          }
                          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-well)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/60 focus:outline-none focus:border-[var(--accent)]"
                        />
                      </div>

                      {resetCodeSent && (
                        <>
                          {resetDemoHint && (
                            <div
                              className="rounded-xl border px-3 py-2 text-xs font-bold flex items-center justify-between"
                              style={{
                                borderColor: 'var(--accent)',
                                backgroundColor: 'var(--bg-nav-active)',
                                color: 'var(--accent-bright)',
                              }}
                            >
                              <span>رمز الاستعادة ({resetTargetLabel}):</span>
                              <span dir="ltr" className="font-mono-num tracking-widest text-sm">
                                {resetDemoHint}
                              </span>
                            </div>
                          )}

                          <div>
                            <label
                              htmlFor="flip-reset-code"
                              className="block text-xs font-bold text-[var(--text-primary)]/90 mb-1.5"
                            >
                              رمز التحقق (6 أرقام)
                            </label>
                            <input
                              id="flip-reset-code"
                              data-testid="reset-code-input"
                              type="text"
                              dir="ltr"
                              value={resetCode}
                              onChange={(e) => setResetCode(e.target.value)}
                              placeholder="123456"
                              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-well)] px-3 py-2.5 text-center text-base font-black tracking-[0.25em] text-[var(--text-primary)] tabular-nums focus:outline-none focus:border-[var(--accent)]"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label
                                htmlFor="flip-reset-pass"
                                className="block text-xs font-bold text-[var(--text-primary)]/90 mb-1.5"
                              >
                                كلمة المرور الجديدة
                              </label>
                              <div className="relative">
                                <input
                                  id="flip-reset-pass"
                                  data-testid="reset-new-password-input"
                                  type={showResetPass ? 'text' : 'password'}
                                  dir="ltr"
                                  value={resetNewPass}
                                  onChange={(e) => setResetNewPass(e.target.value)}
                                  placeholder="6 أحرف فأكثر"
                                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-well)] pl-9 pr-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowResetPass((v) => !v)}
                                  aria-label="إظهار أو إخفاء كلمة المرور"
                                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                                >
                                  {showResetPass ? (
                                    <EyeOff size={15} />
                                  ) : (
                                    <Eye size={15} />
                                  )}
                                </button>
                              </div>
                            </div>
                            <div>
                              <label
                                htmlFor="flip-reset-confirm"
                                className="block text-xs font-bold text-[var(--text-primary)]/90 mb-1.5"
                              >
                                تأكيد كلمة المرور
                              </label>
                              <input
                                id="flip-reset-confirm"
                                data-testid="reset-confirm-password-input"
                                type={showResetPass ? 'text' : 'password'}
                                dir="ltr"
                                value={resetConfirmPass}
                                onChange={(e) => setResetConfirmPass(e.target.value)}
                                placeholder="أعد كتابتها"
                                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-well)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                              />
                            </div>
                          </div>

                          {renderRememberMeRow(false)}
                        </>
                      )}

                      <motion.button
                        type="submit"
                        disabled={busy}
                        data-testid="reset-submit-btn"
                        whileHover={
                          reducedMotion || busy ? undefined : { y: -2, scale: 1.01 }
                        }
                        whileTap={
                          reducedMotion || busy ? undefined : { scale: 0.98 }
                        }
                        transition={TABRIX_TACTILE_SPRING}
                        className="obsidian-gold-cta w-full py-3 rounded-xl text-sm font-black cursor-pointer disabled:opacity-60 min-h-[44px]"
                      >
                        {busy
                          ? 'جارٍ المعالجة...'
                          : resetCodeSent
                          ? 'تحديث كلمة المرور والدخول'
                          : 'إرسال رمز استعادة كلمة المرور'}
                      </motion.button>

                      {resetCodeSent && (
                        <button
                          type="button"
                          onClick={() => {
                            setResetCodeSent(false);
                            setResetCode('');
                            setResetDemoHint('');
                          }}
                          className="w-full text-center text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--accent-bright)] cursor-pointer"
                        >
                          تغيير الحساب المستهدف
                        </button>
                      )}
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Status Notice & Error Banner */}
              <AnimatePresence initial={false}>
                {statusNotice && !errorMsg && (
                  <motion.div
                    key={`auth-notice-${actionMode}`}
                    variants={
                      reducedMotion
                        ? TABRIX_REDUCED_VARIANTS
                        : TABRIX_POPOVER_VARIANTS
                    }
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="mt-3 rounded-xl border px-3.5 py-2.5 text-xs font-semibold"
                    style={{
                      borderColor: 'rgba(212, 175, 55, 0.4)',
                      backgroundColor: 'rgba(212, 175, 55, 0.1)',
                      color: 'var(--accent-bright)',
                    }}
                  >
                    {statusNotice}
                  </motion.div>
                )}

                {errorMsg && (
                  <motion.div
                    key={`auth-error-${isFlipped ? 'reg' : 'login'}`}
                    variants={
                      reducedMotion
                        ? TABRIX_REDUCED_VARIANTS
                        : TABRIX_POPOVER_VARIANTS
                    }
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    role="alert"
                    className="mt-3 rounded-xl border px-3.5 py-2.5 text-xs font-semibold"
                    style={{
                      borderColor:
                        'color-mix(in srgb, var(--danger) 40%, transparent)',
                      backgroundColor: 'var(--danger-bg)',
                      color: 'var(--danger)',
                    }}
                  >
                    {errorMsg}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
