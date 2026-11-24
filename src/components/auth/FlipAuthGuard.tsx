import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Lock, Mail, User, ArrowLeftRight, Sparkles } from 'lucide-react';
import type { AuthUser } from '../../types/agency';
import {
  googleQuickSignInApi,
  loginWithPasswordApi,
  registerWithPasswordApi,
} from '../../lib/authClient';
import { DotMatrixPattern, GeometricRavenCrest } from '../brand/VectorMotifs';

interface FlipAuthGuardProps {
  onAuthenticated: (user: AuthUser) => void;
  onReplayOnboarding?: () => void;
}

export const FlipAuthGuard: React.FC<FlipAuthGuardProps> = ({
  onAuthenticated,
  onReplayOnboarding,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFlippingCrest, setIsFlippingCrest] = useState(false);

  // Sign-In state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Sign-Up state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const triggerFlip = (toCreateAccount: boolean) => {
    setErrorMsg('');
    setIsFlippingCrest(true);
    setIsFlipped(toCreateAccount);
    window.setTimeout(() => {
      setIsFlippingCrest(false);
    }, 520);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const identifier = loginEmail.trim();
    if (!identifier || !loginPassword) {
      setErrorMsg('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
      return;
    }
    setBusy(true);
    try {
      const mode = identifier.includes('@') ? 'google' : 'username';
      const session = await loginWithPasswordApi({
        mode,
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

  const handleQuickGoogle = async () => {
    setErrorMsg('');
    const targetEmail = (isFlipped ? regEmail : loginEmail).trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setErrorMsg('أدخل بريد Gmail أعلاه أولاً للدخول الفوري بحساب Google.');
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
        err instanceof Error ? err.message : 'تعذر الدخول بحساب Google.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="ambient-obsidian-canvas fixed inset-0 z-[135] flex min-h-[100dvh] items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      <div className="ambient-orb-gold ambient-orb-gold-1" />
      <div className="ambient-orb-gold ambient-orb-gold-2" />

      <div className="relative z-10 w-full max-w-[460px] my-auto">
        {/* Glowing Crest badge during flip */}
        <AnimatePresence>
          {isFlippingCrest && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1.08 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.28 }}
              className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
            >
              <div className="p-4 rounded-full bg-[#09090B]/90 border border-[#D4AF37]/50 shadow-[0_0_40px_rgba(212,175,55,0.45)]">
                <GeometricRavenCrest size={56} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3D Flip Container */}
        <div className="flip-perspective w-full">
          <div
            className={`flip-card-inner relative w-full min-h-[560px] ${
              isFlipped ? 'is-flipped' : ''
            }`}
          >
            {/* FRONT FACE: Sign In */}
            <div className="flip-card-face w-full min-h-[560px] chamfered-glass-card smoked-glass-elevated p-6 sm:p-8 flex flex-col justify-between">
              <div className="pointer-events-none absolute top-0 left-0 w-36 h-36 opacity-20">
                <DotMatrixPattern />
              </div>

              <div className="relative z-10">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div className="flex items-center gap-3">
                    <GeometricRavenCrest size={42} />
                    <div>
                      <span className="font-mono-num text-[10px] tracking-[0.22em] uppercase text-[#D4AF37] block">
                        MORROW VAULT
                      </span>
                      <h1 className="font-display-ar text-xl font-bold text-[#F4F4F6]">
                        تسجيل الدخول
                      </h1>
                    </div>
                  </div>
                  {onReplayOnboarding && (
                    <button
                      type="button"
                      onClick={onReplayOnboarding}
                      className="text-[11px] font-semibold text-[#9898AA] hover:text-[#F3E5AB] transition-colors cursor-pointer"
                    >
                      عرض المقدمة
                    </button>
                  )}
                </div>

                <p className="text-xs text-[#9898AA] leading-relaxed mb-5">
                  ادخل إلى مساحتك المعزولة لإدارة الوكالات والحصص بضغط وتشفير فوري.
                </p>

                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="flip-login-email"
                      className="block text-xs font-semibold text-[#D4D4D8] mb-1.5"
                    >
                      البريد الإلكتروني
                    </label>
                    <div className="relative">
                      <Mail
                        size={16}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#D4AF37]/80"
                      />
                      <input
                        id="flip-login-email"
                        type="text"
                        dir="ltr"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full rounded-xl border border-[#D4AF37]/25 bg-black/45 pr-10 pl-3.5 py-2.5 text-sm text-[#F4F4F6] placeholder-[#71717A] focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="flip-login-password"
                      className="block text-xs font-semibold text-[#D4D4D8] mb-1.5"
                    >
                      كلمة المرور
                    </label>
                    <div className="relative">
                      <Lock
                        size={16}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#D4AF37]/80"
                      />
                      <input
                        id="flip-login-password"
                        type="password"
                        dir="ltr"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-[#D4AF37]/25 bg-black/45 pr-10 pl-3.5 py-2.5 text-sm text-[#F4F4F6] placeholder-[#71717A] focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>

                  {errorMsg && !isFlipped && (
                    <div
                      role="alert"
                      className="rounded-xl border border-red-500/35 bg-red-500/15 px-3.5 py-2.5 text-xs font-medium text-red-200"
                    >
                      {errorMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={busy}
                    className="obsidian-gold-cta w-full py-3 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-60"
                  >
                    {busy ? 'جارٍ التحقق...' : 'دخول إلى مساحة العمل'}
                  </button>
                </form>

                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-[11px] text-[#9898AA]">أو</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={handleQuickGoogle}
                  className="w-full py-2.5 px-4 rounded-xl border border-[#D4AF37]/25 bg-white/[0.04] hover:bg-[#D4AF37]/12 text-xs font-semibold text-[#F4F4F6] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
                >
                  <Sparkles size={14} className="text-[#F3E5AB]" />
                  <span>الدخول السريع عبر Google / Gmail</span>
                </button>
              </div>

              <div className="relative z-10 mt-6 pt-4 border-t border-[#D4AF37]/15 flex items-center justify-between gap-2 text-xs">
                <span className="text-[#9898AA]">ليس لديك حساب بعد؟</span>
                <button
                  type="button"
                  onClick={() => triggerFlip(true)}
                  className="inline-flex items-center gap-1.5 font-bold text-[#F3E5AB] hover:text-[#D4AF37] transition-colors cursor-pointer"
                >
                  <ArrowLeftRight size={14} />
                  <span>إنشاء حساب جديد</span>
                </button>
              </div>
            </div>

            {/* BACK FACE: Create Account */}
            <div className="flip-card-face flip-card-face-back absolute inset-0 w-full min-h-[560px] chamfered-glass-card smoked-glass-elevated p-6 sm:p-8 flex flex-col justify-between">
              <div className="pointer-events-none absolute top-0 left-0 w-36 h-36 opacity-20">
                <DotMatrixPattern />
              </div>

              <div className="relative z-10">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div className="flex items-center gap-3">
                    <GeometricRavenCrest size={42} />
                    <div>
                      <span className="font-mono-num text-[10px] tracking-[0.22em] uppercase text-[#D4AF37] block">
                        NEW WORKSPACE
                      </span>
                      <h1 className="font-display-ar text-xl font-bold text-[#F4F4F6]">
                        إنشاء حساب جديد
                      </h1>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-[#9898AA] leading-relaxed mb-5">
                  يُنشئ النظام مساحة معزولة تماماً لحسابك الجديد مع ضغط فوري لبياناتك.
                </p>

                <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                  <div>
                    <label
                      htmlFor="flip-register-name"
                      className="block text-xs font-semibold text-[#D4D4D8] mb-1.5"
                    >
                      الاسم الكامل
                    </label>
                    <div className="relative">
                      <User
                        size={16}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#D4AF37]/80"
                      />
                      <input
                        id="flip-register-name"
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="أحمد كريم"
                        className="w-full rounded-xl border border-[#D4AF37]/25 bg-black/45 pr-10 pl-3.5 py-2.5 text-sm text-[#F4F4F6] placeholder-[#71717A] focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="flip-register-email"
                      className="block text-xs font-semibold text-[#D4D4D8] mb-1.5"
                    >
                      البريد الإلكتروني
                    </label>
                    <div className="relative">
                      <Mail
                        size={16}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#D4AF37]/80"
                      />
                      <input
                        id="flip-register-email"
                        type="email"
                        dir="ltr"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="user@example.com"
                        className="w-full rounded-xl border border-[#D4AF37]/25 bg-black/45 pr-10 pl-3.5 py-2.5 text-sm text-[#F4F4F6] placeholder-[#71717A] focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="flip-register-password"
                      className="block text-xs font-semibold text-[#D4D4D8] mb-1.5"
                    >
                      كلمة المرور
                    </label>
                    <div className="relative">
                      <Lock
                        size={16}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#D4AF37]/80"
                      />
                      <input
                        id="flip-register-password"
                        type="password"
                        dir="ltr"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="6 أحرف فأكثر"
                        className="w-full rounded-xl border border-[#D4AF37]/25 bg-black/45 pr-10 pl-3.5 py-2.5 text-sm text-[#F4F4F6] placeholder-[#71717A] focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>

                  {errorMsg && isFlipped && (
                    <div
                      role="alert"
                      className="rounded-xl border border-red-500/35 bg-red-500/15 px-3.5 py-2.5 text-xs font-medium text-red-200"
                    >
                      {errorMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={busy}
                    className="obsidian-gold-cta w-full py-3 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-60"
                  >
                    {busy ? 'جارٍ إنشاء المساحة...' : 'إنشاء الحساب والدخول'}
                  </button>
                </form>
              </div>

              <div className="relative z-10 mt-6 pt-4 border-t border-[#D4AF37]/15 flex items-center justify-between gap-2 text-xs">
                <span className="text-[#9898AA]">لديك حساب مسجل مسبقاً؟</span>
                <button
                  type="button"
                  onClick={() => triggerFlip(false)}
                  className="inline-flex items-center gap-1.5 font-bold text-[#F3E5AB] hover:text-[#D4AF37] transition-colors cursor-pointer"
                >
                  <ArrowLeftRight size={14} />
                  <span>العودة لتسجيل الدخول</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
