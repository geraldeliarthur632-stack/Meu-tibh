import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { ArrowRight, CheckCircle2, Lock, Mail, RefreshCw, User as UserIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { auth, formatFriendlyFirebaseError, googleProvider } from '../lib/firebase';
import { STUDIO_IMAGES } from '../types/studio';
import { BrandLogo } from './BrandLogo';
import { PWAInstallButton } from './PWAInstallButton';

interface AuthStudioScreenProps {
  pendingInviteCode: string | null;
  unverifiedUser: User | null;
  onVerifiedRefresh: () => Promise<void>;
}

export const AuthStudioScreen: React.FC<AuthStudioScreenProps> = ({
  pendingInviteCode,
  unverifiedUser,
  onVerifiedRefresh,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(formatFriendlyFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email.trim() || !password) {
      setError('Preencha seu e-mail e sua senha.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        if (!name.trim()) {
          setError('Informe seu nome para aparecer na escalação.');
          setLoading(false);
          return;
        }
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(credential.user, { displayName: name.trim() });
        await sendEmailVerification(credential.user);
        setInfo('Conta criada! Enviamos um link de confirmação para o seu e-mail.');
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(formatFriendlyFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError('Digite seu e-mail acima para receber o link de redefinição de senha.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo('E-mail de redefinição enviado! Verifique sua caixa de entrada.');
    } catch (err) {
      setError(formatFriendlyFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedUser) return;
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await sendEmailVerification(unverifiedUser);
      setInfo('Novo e-mail de verificação enviado. Confira sua caixa de entrada ou spam.');
    } catch (err) {
      setError(formatFriendlyFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-[1440px] grid-cols-1 lg:grid-cols-12 lg:items-stretch">
        {/* Left Bright Architectural Studio Showcase */}
        <div className="relative flex flex-col justify-between overflow-hidden border-b border-slate-200 bg-white lg:col-span-7 lg:border-r lg:border-b-0">
          <img
            src={STUDIO_IMAGES.heroPitch}
            alt="Estúdio tático esportivo Meu Time"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/35 to-white/75" />

          <div className="relative z-10 flex items-center justify-between px-6 py-4 lg:px-10 lg:py-6">
            <BrandLogo sizeClass="h-10 w-10" withWordmark />
            <PWAInstallButton compact />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="relative z-10 px-6 py-8 lg:px-10 lg:py-10"
          >
            <p className="text-xs font-bold tracking-wider text-emerald-300 uppercase">
              Estúdio Tático & Tempo Real
            </p>
            <h1 className="font-display mt-2 max-w-xl text-3xl leading-[1.04] font-extrabold tracking-tight text-white text-balance sm:text-5xl">
              Escale seu time e jogue com visual de estúdio.
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-100">
              Futebol, Futsal, Basquete e Vôlei em prancheta interativa, placar ao vivo com
              acréscimos, cartões, chat do elenco e convite direto.
            </p>
          </motion.div>
        </div>

        {/* Right Compact Auth Panel (All buttons visible without scrolling) */}
        <div className="flex items-center justify-center px-5 py-6 lg:col-span-5 lg:px-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            className="w-full max-w-md"
          >
            {pendingInviteCode && (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-bold text-emerald-800">
                  Convite direto · Código <span className="font-mono-tabular">{pendingInviteCode}</span>
                </p>
                <p className="mt-0.5 text-xs text-emerald-700">
                  Entre abaixo para acessar o time automaticamente.
                </p>
              </div>
            )}

            {unverifiedUser ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 text-emerald-600">
                  <CheckCircle2 className="h-6 w-6 shrink-0" />
                  <h2 className="font-display text-2xl font-bold text-slate-900">
                    Confirme seu e-mail
                  </h2>
                </div>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                  Enviamos um link para <strong className="text-slate-900">{unverifiedUser.email}</strong>.
                  Confirme no seu e-mail e clique abaixo para entrar.
                </p>

                {error && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                    {error}
                  </div>
                )}
                {info && (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800">
                    {info}
                  </div>
                )}

                <div className="mt-5 space-y-2.5">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={async () => {
                      setLoading(true);
                      setError(null);
                      try {
                        await onVerifiedRefresh();
                        if (auth.currentUser && !auth.currentUser.emailVerified) {
                          setError('E-mail ainda não confirmado. Verifique sua caixa de entrada.');
                        }
                      } catch (err) {
                        setError(formatFriendlyFirebaseError(err));
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="btn-studio flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 cursor-pointer"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Já confirmei meu e-mail</span>
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void handleResendVerification()}
                    className="btn-studio flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-slate-50 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 cursor-pointer"
                  >
                    <Mail className="h-4 w-4" />
                    <span>Reenviar e-mail</span>
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void handleGoogleLogin()}
                    className="btn-studio flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                  >
                    <span>Entrar com Google (imediato)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void signOut(auth)}
                    className="min-h-[40px] w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
                  >
                    Usar outra conta
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900">
                  {mode === 'login' ? 'Acessar Estúdio' : 'Criar Conta'}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Login com Google ou e-mail e senha sincronizado em tempo real.
                </p>

                {/* Google Sign-In */}
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleGoogleLogin()}
                  className="btn-studio mt-4 flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
                  <span>Continuar com Google</span>
                </button>

                <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span>ou com e-mail</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                {/* Segmented Mode Switch */}
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                      setInfo(null);
                    }}
                    className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      mode === 'login'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Entrar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError(null);
                      setInfo(null);
                    }}
                    className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      mode === 'register'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Cadastrar
                  </button>
                </div>

                <form onSubmit={(e) => void handleEmailAuth(e)} className="mt-4 space-y-3">
                  {mode === 'register' && (
                    <div>
                      <label htmlFor="auth-name" className="block text-xs font-semibold text-slate-700">
                        Seu nome
                      </label>
                      <div className="relative mt-1">
                        <UserIcon className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          id="auth-name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Ex: Gabriel Costa"
                          maxLength={80}
                          className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 pr-3.5 pl-10 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-700">
                      E-mail
                    </label>
                    <div className="relative mt-1">
                      <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="auth-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="voce@exemplo.com"
                        autoComplete="email"
                        className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 pr-3.5 pl-10 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-700">
                        Senha
                      </label>
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={() => void handleForgotPassword()}
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                        >
                          Esqueci a senha
                        </button>
                      )}
                    </div>
                    <div className="relative mt-1">
                      <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="auth-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 pr-3.5 pl-10 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs leading-relaxed text-red-700"
                    >
                      {error}
                    </div>
                  )}

                  {info && (
                    <div
                      role="status"
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs leading-relaxed text-emerald-800"
                    >
                      {info}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-studio flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60 cursor-pointer"
                  >
                    <span>
                      {loading
                        ? 'Autenticando...'
                        : mode === 'login'
                          ? 'Entrar no Meu Time'
                          : 'Criar conta e continuar'}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};
