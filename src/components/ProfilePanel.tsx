import React, { useEffect, useMemo, useState } from 'react';
import { signOut, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  ArrowRightLeft,
  Bell,
  BellOff,
  BellRing,
  BookOpen,
  CheckCircle2,
  Flame,
  HelpCircle,
  LogOut,
  Mail,
  MessageSquare,
  Plus,
  Shield,
  Sparkles,
  Star,
  Timer,
  User as UserIcon,
} from 'lucide-react';
import {
  buildTrackId,
  TOTAL_MANUAL_LESSONS,
} from '../data/duolingoCurriculum';
import { PushPermissionState } from '../hooks/useTeamNotifications';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  isStaffPosition,
  ManualProgress,
  SPORTS_CONFIG,
  Team,
  TeamMember,
  UserTeamMembership,
} from '../types/studio';
import { PWAInstallButton } from './PWAInstallButton';
import { TeamCrest } from './TeamCrest';

interface ProfilePanelProps {
  user: User;
  activeTeam: Team;
  currentMember: TeamMember | null;
  memberships: UserTeamMembership[];
  permission: PushPermissionState;
  chatPushEnabled: boolean;
  matchPushEnabled: boolean;
  savingPref: boolean;
  onRequestPermission: () => Promise<PushPermissionState>;
  onTogglePref: (key: 'chatPushEnabled' | 'matchPushEnabled', value: boolean) => Promise<void>;
  onSendTestNotification: () => Promise<void>;
  onSelectTeam: (teamId: string) => void;
  onOpenManual: () => void;
  onOpenOnboarding: () => void;
  onOpenTutorial: () => void;
}

export const ProfilePanel: React.FC<ProfilePanelProps> = ({
  user,
  activeTeam,
  currentMember,
  memberships,
  permission,
  chatPushEnabled,
  matchPushEnabled,
  savingPref,
  onRequestPermission,
  onTogglePref,
  onSendTestNotification,
  onSelectTeam,
  onOpenManual,
  onOpenOnboarding,
  onOpenTutorial,
}) => {
  const [avatarError, setAvatarError] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [manualProgress, setManualProgress] = useState<ManualProgress | null>(null);

  const sportCfg = SPORTS_CONFIG[activeTeam.sport];
  const userPosition = currentMember?.position || sportCfg.positions[0];
  const isStaff = isStaffPosition(userPosition);
  const trackId = useMemo(
    () => buildTrackId(activeTeam.sport, userPosition),
    [activeTeam.sport, userPosition]
  );

  useEffect(() => {
    const path = `users/${user.uid}/manualProgress/${trackId}`;
    const unsub = onSnapshot(
      doc(db, 'users', user.uid, 'manualProgress', trackId),
      (snap) => {
        if (snap.exists()) {
          setManualProgress(snap.data() as ManualProgress);
        } else {
          setManualProgress(null);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, path);
      }
    );
    return () => unsub();
  }, [user.uid, trackId]);

  const displayName =
    currentMember?.name || user.displayName || user.email?.split('@')[0] || 'Atleta';

  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  const completedCount = manualProgress?.completedCount ?? 0;
  const xpTotal = manualProgress?.xp ?? 0;
  const streakTotal = manualProgress?.streak ?? 0;
  const pct = Math.min(100, Math.round((completedCount / TOTAL_MANUAL_LESSONS) * 100));

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut(auth);
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Main Profile Hero Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {user.photoURL && !avatarError ? (
              <img
                src={user.photoURL}
                alt={displayName}
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="h-16 w-16 shrink-0 rounded-2xl border-2 border-emerald-500 object-cover shadow-xs"
              />
            ) : (
              <div className="font-display flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-emerald-700 border-b-[3px] bg-emerald-600 text-2xl font-extrabold text-white shadow-xs">
                {initials || <UserIcon className="h-7 w-7" />}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display truncate text-2xl font-extrabold text-slate-900">
                  {displayName}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Conta verificada
                </span>
              </div>

              {user.email && (
                <p className="mt-1 flex items-center gap-1.5 truncate text-xs font-medium text-slate-500">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{user.email}</span>
                </p>
              )}

              <p className="mt-1.5 text-xs font-semibold text-slate-700">
                {activeTeam.name}
                <span aria-hidden="true"> · </span>
                <span className="text-emerald-700">{sportCfg.label}</span>
                <span aria-hidden="true"> · </span>
                <span>{userPosition}</span>
                {!isStaff && currentMember && currentMember.jerseyNumber > 0 && (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span className="font-mono-tabular">Camisa #{currentMember.jerseyNumber}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
            <button
              type="button"
              onClick={onOpenTutorial}
              className="btn-studio inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-slate-50 px-4 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <HelpCircle className="h-4 w-4 text-emerald-600" />
              <span>Tutorial</span>
            </button>

            <PWAInstallButton />

            <button
              type="button"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
              className="btn-studio inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-rose-700 border-b-[3px] bg-rose-600 px-5 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-60 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>{signingOut ? 'Saindo...' : 'Sair da Conta'}</span>
            </button>
          </div>
        </div>

        {/* Role & Active Team Stats Row */}
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-[11px] font-semibold text-slate-500">Função no Elenco</p>
            <p className="mt-1 truncate text-sm font-extrabold text-slate-900">{userPosition}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-[11px] font-semibold text-slate-500">Status</p>
            <p className="mt-1 text-sm font-extrabold text-slate-900">
              {isStaff ? 'Comissão Técnica' : currentMember?.isStarter ? 'Titular' : 'Reserva'}
              {currentMember && activeTeam.captainMemberId === currentMember.id && (
                <span className="ml-1.5 inline-block rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-800">
                  Capitão (C)
                </span>
              )}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-[11px] font-semibold text-slate-500">Camisa</p>
            <p className="font-mono-tabular mt-1 text-sm font-extrabold text-slate-900">
              {isStaff || !currentMember || currentMember.jerseyNumber === 0
                ? 'Sem camisa'
                : `#${currentMember.jerseyNumber}`}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-[11px] font-semibold text-slate-500">Over (IA)</p>
            <p className="font-mono-tabular mt-1 text-sm font-extrabold text-slate-900">
              {isStaff
                ? 'Comissão'
                : currentMember?.ovrStatus === 'analyzing'
                  ? 'Analisando...'
                  : currentMember?.ovrRating && currentMember.ovrRating > 0
                    ? `${currentMember.ovrRating} OVR`
                    : 'Não avaliado'}
            </p>
          </div>
          <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:col-span-1">
            <p className="text-[11px] font-semibold text-slate-500">Permissão no Time</p>
            <p className="mt-1 text-sm font-extrabold text-slate-900">
              {activeTeam.ownerId === user.uid ? 'Dono do Time' : 'Integrante'}
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Push Notifications Controls (Chat & Matches) */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-7 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-600">
                <BellRing className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-xl font-extrabold text-slate-900">
                  Notificações Push
                </h2>
                <p className="text-xs text-slate-500">
                  Receba avisos instantâneos do Chat do time e das Partidas ao vivo.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void onSendTestNotification()}
              className="btn-studio inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-slate-50 px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Testar Push</span>
            </button>
          </div>

          {/* Browser Permission Banner */}
          <div
            className={`mt-4 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
              permission === 'granted'
                ? 'border-emerald-200 bg-emerald-50/70'
                : permission === 'denied'
                  ? 'border-amber-200 bg-amber-50/70'
                  : 'border-sky-200 bg-sky-50/70'
            }`}
          >
            <div className="flex items-start gap-3">
              {permission === 'granted' ? (
                <Bell className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <BellOff className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
              )}
              <div>
                <p className="text-xs font-extrabold text-slate-900">
                  {permission === 'granted'
                    ? 'Notificações do navegador ativadas'
                    : permission === 'denied'
                      ? 'Permissão bloqueada no navegador'
                      : permission === 'unsupported'
                        ? 'Alertas em tempo real ativos no aplicativo'
                        : 'Ative as notificações do dispositivo'}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  {permission === 'granted'
                    ? 'Alertas de sistema (PWA) e avisos na tela funcionando juntos.'
                    : permission === 'denied'
                      ? 'Os avisos dentro da tela continuam ativos; para push no celular, libere nas configurações do site.'
                      : permission === 'unsupported'
                        ? 'Os alertas visuais dentro do Meu Time continuam funcionando automaticamente.'
                        : 'Clique ao lado para permitir notificações no celular ou computador.'}
                </p>
              </div>
            </div>

            {permission === 'default' && (
              <button
                type="button"
                onClick={() => void onRequestPermission()}
                className="btn-studio inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-sky-700 border-b-[3px] bg-sky-600 px-4 text-xs font-bold text-white hover:bg-sky-500 cursor-pointer"
              >
                <Bell className="h-4 w-4" />
                <span>Ativar Push</span>
              </button>
            )}
          </div>

          {/* Toggle Rows */}
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-white text-emerald-600">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Notificações do Chat</p>
                  <p className="text-xs text-slate-500">
                    Alerta quando alguém enviar mensagem no vestiário do time.
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={chatPushEnabled}
                disabled={savingPref}
                onClick={() => void onTogglePref('chatPushEnabled', !chatPushEnabled)}
                className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors cursor-pointer ${
                  chatPushEnabled
                    ? 'border-emerald-700 bg-emerald-600'
                    : 'border-slate-300 bg-slate-200'
                }`}
              >
                <span className="sr-only">Alternar notificações do chat</span>
                <span
                  className={`inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
                    chatPushEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-white text-amber-600">
                  <Timer className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Notificações das Partidas</p>
                  <p className="text-xs text-slate-500">
                    Alerta quando o jogo entra ao vivo, sai gol/ponto, acréscimos ou fim de partida.
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={matchPushEnabled}
                disabled={savingPref}
                onClick={() => void onTogglePref('matchPushEnabled', !matchPushEnabled)}
                className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors cursor-pointer ${
                  matchPushEnabled
                    ? 'border-emerald-700 bg-emerald-600'
                    : 'border-slate-300 bg-slate-200'
                }`}
              >
                <span className="sr-only">Alternar notificações das partidas</span>
                <span
                  className={`inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
                    matchPushEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Right Column: Manual Duolingo Progress + Team Switcher */}
        <div className="space-y-5 lg:col-span-5">
          {/* Manual 460 Progress Card */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-extrabold text-slate-900">
                    Trilha no Manual
                  </h2>
                  <p className="text-xs text-slate-500">
                    {sportCfg.label} · {userPosition}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenManual}
                className="btn-studio inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-3.5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
              >
                <span>Continuar</span>
              </button>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Lições concluídas</span>
                <span className="font-mono-tabular">
                  {completedCount} / {TOTAL_MANUAL_LESSONS} ({pct}%)
                </span>
              </div>
              <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5">
                  <Star className="h-4 w-4 shrink-0 text-amber-500" />
                  <div>
                    <p className="text-[11px] font-semibold text-amber-800">Total XP</p>
                    <p className="font-mono-tabular text-sm font-extrabold text-slate-900">
                      {xpTotal} XP
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-orange-200 bg-orange-50/70 px-3 py-2.5">
                  <Flame className="h-4 w-4 shrink-0 text-orange-500" />
                  <div>
                    <p className="text-[11px] font-semibold text-orange-800">Ofensiva</p>
                    <p className="font-mono-tabular text-sm font-extrabold text-slate-900">
                      {streakTotal} lições
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* My Teams Switcher */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-600" />
                <h2 className="font-display text-lg font-extrabold text-slate-900">Meus Times</h2>
              </div>

              <button
                type="button"
                onClick={onOpenOnboarding}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-600 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Novo / Entrar</span>
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {memberships.map((m) => {
                const isCurrent = m.teamId === activeTeam.id;
                return (
                  <button
                    key={m.teamId}
                    type="button"
                    onClick={() => onSelectTeam(m.teamId)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                      isCurrent
                        ? 'border-emerald-500 bg-emerald-50/60'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <TeamCrest
                        photoUrl={m.photoUrl}
                        teamName={m.teamName}
                        sizeClass="h-9 w-9"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">{m.teamName}</p>
                        <p className="text-[11px] text-slate-500">
                          {SPORTS_CONFIG[m.sport].label} · Código {m.inviteCode}
                        </p>
                      </div>
                    </div>

                    {isCurrent ? (
                      <span className="shrink-0 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                        Ativo
                      </span>
                    ) : (
                      <ArrowRightLeft className="h-4 w-4 shrink-0 text-slate-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
