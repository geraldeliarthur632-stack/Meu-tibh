import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import {
  Bell,
  BellRing,
  BookOpen,
  HelpCircle,
  MessageSquare,
  Share2,
  Timer,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { AuthStudioScreen } from './components/AuthStudioScreen';
import { BrandLogo } from './components/BrandLogo';
import { FirstClickTipBanner } from './components/FirstClickTipBanner';
import { InvitePanel } from './components/InvitePanel';
import { LiveMatchCenter } from './components/LiveMatchCenter';
import { OfflineIndicator } from './components/OfflineIndicator';
import { OnboardingWizard } from './components/OnboardingWizard';
import { PositionManual } from './components/PositionManual';
import { ProfilePanel } from './components/ProfilePanel';
import { PWAInstallButton } from './components/PWAInstallButton';
import { StudioTutorialModal } from './components/StudioTutorialModal';
import { TacticalBoard } from './components/TacticalBoard';
import { TeamChat } from './components/TeamChat';
import { TeamCrest } from './components/TeamCrest';
import { useTeamNotifications } from './hooks/useTeamNotifications';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { triggerFirstClickTip } from './lib/firstClickCoach';
import {
  InviteLookup,
  SPORTS_CONFIG,
  Team,
  TeamMember,
  UserTeamMembership,
} from './types/studio';

type StudioTab = 'lineup' | 'matches' | 'manual' | 'chat' | 'invite' | 'profile';

const INVITE_STORAGE_KEY = 'meu_time_pending_invite';

function extractInviteCodeFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const queryCode = params.get('join');
  if (queryCode) {
    return queryCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
  const pathMatch = window.location.pathname.match(/^\/join\/([A-Za-z0-9]{6,10})\/?$/);
  if (pathMatch) {
    return pathMatch[1].toUpperCase();
  }
  return null;
}

function extractTeamIdFromUrl(): string | null {
  const match = window.location.pathname.match(/^\/team\/([a-zA-Z0-9_-]+)\/?$/);
  return match ? match[1] : null;
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [emailVerifiedFlag, setEmailVerifiedFlag] = useState(false);

  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(() => {
    const fromUrl = extractInviteCodeFromUrl();
    if (fromUrl) {
      sessionStorage.setItem(INVITE_STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    return sessionStorage.getItem(INVITE_STORAGE_KEY);
  });

  const [memberships, setMemberships] = useState<UserTeamMembership[]>([]);
  const [membershipsLoaded, setMembershipsLoaded] = useState(false);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(() => extractTeamIdFromUrl());
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [activeTeam, setActiveTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [activeTab, setActiveTab] = useState<StudioTab>(() => {
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    if (tabParam === 'chat' || tabParam === 'matches' || tabParam === 'manual' || tabParam === 'invite' || tabParam === 'profile') {
      return tabParam;
    }
    return 'lineup';
  });
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setEmailVerifiedFlag(!!nextUser?.emailVerified);
      setAuthReady(true);
      if (!nextUser) {
        setMemberships([]);
        setMembershipsLoaded(false);
        setActiveTeam(null);
        setTeamMembers([]);
      }
    });
    return () => unsub();
  }, []);

  const isVerifiedUser = !!user && emailVerifiedFlag;

  useEffect(() => {
    if (!authReady || !isVerifiedUser || !user) return;
    const path = `users/${user.uid}/teamMemberships`;
    const q = query(
      collection(db, 'users', user.uid, 'teamMemberships'),
      orderBy('joinedAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as UserTeamMembership);
        setMemberships(list);
        setMembershipsLoaded(true);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    );
    return () => unsub();
  }, [authReady, isVerifiedUser, user?.uid]);

  useEffect(() => {
    if (!authReady || !isVerifiedUser || !user || !pendingInviteCode || !membershipsLoaded) {
      return;
    }

    let cancelled = false;
    const resolveInvite = async () => {
      try {
        const snap = await getDoc(doc(db, 'invites', pendingInviteCode));
        if (cancelled) return;
        if (!snap.exists()) {
          setShowOnboarding(true);
          return;
        }
        const invite = snap.data() as InviteLookup;
        const alreadyMember = memberships.some((m) => m.teamId === invite.teamId);
        if (alreadyMember) {
          sessionStorage.removeItem(INVITE_STORAGE_KEY);
          setPendingInviteCode(null);
          setActiveTeamId(invite.teamId);
          setShowOnboarding(false);
          window.history.replaceState({}, '', `/team/${invite.teamId}`);
        } else {
          setShowOnboarding(true);
        }
      } catch {
        if (!cancelled) setShowOnboarding(true);
      }
    };

    void resolveInvite();
    return () => {
      cancelled = true;
    };
  }, [authReady, isVerifiedUser, user?.uid, pendingInviteCode, membershipsLoaded, memberships]);

  useEffect(() => {
    if (!membershipsLoaded || showOnboarding || pendingInviteCode) return;
    if (memberships.length === 0) {
      setActiveTeamId(null);
      return;
    }
    if (!activeTeamId || !memberships.some((m) => m.teamId === activeTeamId)) {
      const firstId = memberships[0].teamId;
      setActiveTeamId(firstId);
      window.history.replaceState({}, '', `/team/${firstId}`);
    }
  }, [membershipsLoaded, memberships, activeTeamId, showOnboarding, pendingInviteCode]);

  useEffect(() => {
    if (!authReady || !isVerifiedUser || !activeTeamId || showOnboarding) {
      setActiveTeam(null);
      setTeamMembers([]);
      return;
    }

    const teamPath = `teams/${activeTeamId}`;
    const unsubTeam = onSnapshot(
      doc(db, 'teams', activeTeamId),
      (snap) => {
        if (snap.exists()) {
          setActiveTeam(snap.data() as Team);
        } else {
          setActiveTeam(null);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, teamPath);
      }
    );

    const membersPath = `teams/${activeTeamId}/members`;
    const unsubMembers = onSnapshot(
      collection(db, 'teams', activeTeamId, 'members'),
      (snap) => {
        setTeamMembers(snap.docs.map((d) => d.data() as TeamMember));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, membersPath);
      }
    );

    return () => {
      unsubTeam();
      unsubMembers();
    };
  }, [authReady, isVerifiedUser, activeTeamId, showOnboarding]);

  const currentMember = useMemo(
    () => teamMembers.find((m) => m.userId === user?.uid) || null,
    [teamMembers, user?.uid]
  );

  const notifications = useTeamNotifications({
    user,
    isVerifiedUser,
    activeTeam,
    activeTab,
    onNavigateTab: (targetTab) => setActiveTab(targetTab),
  });

  const [showChatPushPrompt, setShowChatPushPrompt] = useState(false);
  const chatPromptTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (chatPromptTimerRef.current) {
        window.clearTimeout(chatPromptTimerRef.current);
      }
    };
  }, []);

  const handleChatMessageSent = () => {
    if (notifications.permission === 'granted') return;
    if (chatPromptTimerRef.current) {
      window.clearTimeout(chatPromptTimerRef.current);
    }
    chatPromptTimerRef.current = window.setTimeout(() => {
      setShowChatPushPrompt(true);
    }, 3000);
  };

  const handleVerifiedRefresh = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    setEmailVerifiedFlag(!!auth.currentUser.emailVerified);
  };

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8FB] text-slate-700">
        <div className="flex items-center gap-3">
          <BrandLogo sizeClass="h-10 w-10" />
          <span className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Carregando Meu Time...
          </span>
        </div>
      </div>
    );
  }

  if (!user || !emailVerifiedFlag) {
    return (
      <>
        <AuthStudioScreen
          pendingInviteCode={pendingInviteCode}
          unverifiedUser={user && !emailVerifiedFlag ? user : null}
          onVerifiedRefresh={handleVerifiedRefresh}
        />
        <OfflineIndicator />
      </>
    );
  }

  if (!membershipsLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8FB] text-slate-700">
        <div className="flex items-center gap-3">
          <BrandLogo sizeClass="h-10 w-10" />
          <span className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Sincronizando Estúdio...
          </span>
        </div>
      </div>
    );
  }

  if (showOnboarding || memberships.length === 0) {
    return (
      <>
        <OnboardingWizard
          user={user}
          initialInviteCode={pendingInviteCode}
          onTeamReady={(teamId) => {
            sessionStorage.removeItem(INVITE_STORAGE_KEY);
            setPendingInviteCode(null);
            setShowOnboarding(false);
            setActiveTeamId(teamId);
            setActiveTab('lineup');
            setShowTutorial(true);
            window.history.replaceState({}, '', `/team/${teamId}`);
          }}
          onCancel={
            memberships.length > 0
              ? () => {
                  sessionStorage.removeItem(INVITE_STORAGE_KEY);
                  setPendingInviteCode(null);
                  setShowOnboarding(false);
                }
              : undefined
          }
        />
        <OfflineIndicator />
      </>
    );
  }

  const navItems: { id: StudioTab; label: string; icon: React.ReactNode }[] = [
    { id: 'lineup', label: 'Escalação', icon: <Users className="h-5 w-5" /> },
    { id: 'matches', label: 'Partidas', icon: <Timer className="h-5 w-5" /> },
    { id: 'manual', label: 'Manual', icon: <BookOpen className="h-5 w-5" /> },
    { id: 'chat', label: 'Chat', icon: <MessageSquare className="h-5 w-5" /> },
    { id: 'invite', label: 'Convite', icon: <Share2 className="h-5 w-5" /> },
    { id: 'profile', label: 'Perfil', icon: <UserIcon className="h-5 w-5" /> },
  ];

  return (
    <div className="min-h-screen bg-[#F6F8FB] pb-20 text-slate-900 md:pb-6">
      {/* Top Bar Contract: 3 clean zones on Desktop, compact 52px bar on Mobile */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-[52px] max-w-[1440px] items-center justify-between gap-8 px-4 sm:px-8 md:h-14">
          <button
            type="button"
            onClick={() => setActiveTab('lineup')}
            className="shrink-0 cursor-pointer"
            aria-label="Meu Time · Início"
          >
            <BrandLogo sizeClass="h-9 w-9" withWordmark />
          </button>

          <nav className="hidden items-center gap-6 md:flex">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  triggerFirstClickTip(`nav_${item.id}`, user.uid);
                  setActiveTab(item.id);
                }}
                className={`border-b-2 py-1 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === item.id
                    ? 'border-emerald-600 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <PWAInstallButton variant="primary" />
          </div>
        </div>
      </header>

      {/* Compact Workspace Strip */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {activeTeam && (
              <>
                <TeamCrest
                  photoUrl={activeTeam.photoUrl}
                  teamName={activeTeam.name}
                  sizeClass="h-10 w-10"
                />
                <div className="min-w-0">
                  <select
                    aria-label="Selecionar time ativo"
                    value={activeTeam.id}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setActiveTeamId(nextId);
                      window.history.replaceState({}, '', `/team/${nextId}`);
                    }}
                    className="font-display max-w-[220px] truncate bg-transparent text-lg font-extrabold text-slate-900 focus:outline-none sm:max-w-xs cursor-pointer"
                  >
                    {memberships.map((m) => (
                      <option key={m.teamId} value={m.teamId} className="bg-white text-slate-900">
                        {m.teamName}
                      </option>
                    ))}
                  </select>
                  <p className="truncate text-xs text-slate-500">
                    <span>{SPORTS_CONFIG[activeTeam.sport].label}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="tabular-nums">{teamMembers.length} jogadores</span>
                    <span aria-hidden="true"> · </span>
                    <span className="font-mono-tabular">Código {activeTeam.inviteCode}</span>
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {notifications.permission === 'default' && (
              <button
                type="button"
                onClick={() => void notifications.requestPushPermission()}
                aria-label="Ativar notificações push"
                className="btn-studio inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-sky-300 border-b-[3px] border-b-sky-400 bg-sky-50 px-3 text-xs font-bold text-sky-800 hover:bg-sky-100 whitespace-nowrap cursor-pointer"
              >
                <Bell className="h-4 w-4 text-sky-600" />
                <span className="hidden sm:inline">Ativar Push</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowTutorial(true)}
              aria-label="Abrir tutorial dos botões"
              className="btn-studio inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap cursor-pointer"
            >
              <HelpCircle className="h-4 w-4 text-emerald-600" />
              <span className="hidden sm:inline">Tutorial</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              aria-label="Abrir meu perfil"
              className={`btn-studio inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-b-[3px] px-3.5 text-xs font-bold whitespace-nowrap cursor-pointer ${
                activeTab === 'profile'
                  ? 'border-emerald-700 bg-emerald-600 text-white'
                  : 'border-slate-200 border-b-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <UserIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Perfil</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Studio Content */}
      <main className="mx-auto max-w-[1440px] px-4 py-4 sm:px-8">
        {!activeTeam ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-xs">
            Carregando dados do time...
          </div>
        ) : (
          <motion.div
            key={activeTab + activeTeam.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          >
            {activeTab === 'lineup' && (
              <TacticalBoard
                team={activeTeam}
                members={teamMembers}
                currentUserId={user.uid}
              />
            )}

            {activeTab === 'matches' && (
              <LiveMatchCenter
                team={activeTeam}
                members={teamMembers}
                currentUserId={user.uid}
              />
            )}

            {activeTab === 'manual' && (
              <PositionManual
                team={activeTeam}
                currentMember={currentMember}
                currentUserId={user.uid}
              />
            )}

            {activeTab === 'chat' && (
              <TeamChat
                team={activeTeam}
                currentMember={currentMember}
                currentUserId={user.uid}
                onMessageSent={handleChatMessageSent}
              />
            )}

            {activeTab === 'invite' && (
              <InvitePanel team={activeTeam} memberCount={teamMembers.length} />
            )}

            {activeTab === 'profile' && (
              <ProfilePanel
                user={user}
                activeTeam={activeTeam}
                currentMember={currentMember}
                memberships={memberships}
                permission={notifications.permission}
                chatPushEnabled={notifications.chatPushEnabled}
                matchPushEnabled={notifications.matchPushEnabled}
                savingPref={notifications.savingPref}
                onRequestPermission={notifications.requestPushPermission}
                onTogglePref={notifications.updatePushPreference}
                onSendTestNotification={notifications.sendTestNotification}
                onSelectTeam={(teamId) => {
                  setActiveTeamId(teamId);
                  window.history.replaceState({}, '', `/team/${teamId}`);
                }}
                onOpenManual={() => setActiveTab('manual')}
                onOpenOnboarding={() => setShowOnboarding(true)}
                onOpenTutorial={() => setShowTutorial(true)}
              />
            )}
          </motion.div>
        )}
      </main>

      {/* Mobile Fixed Bottom Tab Bar */}
      <nav
        aria-label="Navegação principal"
        className="fixed right-0 bottom-0 left-0 z-40 grid h-14 grid-cols-6 items-center border-t border-slate-200 bg-white/95 backdrop-blur-md md:hidden"
      >
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                triggerFirstClickTip(`nav_${item.id}`, user.uid);
                setActiveTab(item.id);
              }}
              className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors cursor-pointer ${
                active ? 'text-emerald-600' : 'text-slate-500'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Live Push Notification Toast Banner */}
      {notifications.activeToast && (
        <div
          role="status"
          className="fixed right-4 bottom-20 z-50 w-[min(360px,calc(100vw-2rem))] md:top-16 md:bottom-auto"
        >
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 360, damping: 26 }}
            className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl"
          >
            <button
              type="button"
              onClick={() => {
                setActiveTab(notifications.activeToast!.targetTab);
                notifications.dismissToast();
              }}
              className="flex min-w-0 flex-1 items-start gap-3 text-left cursor-pointer"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600">
                <BellRing className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-extrabold text-slate-900">
                  {notifications.activeToast.title}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                  {notifications.activeToast.body}
                </p>
                <p className="mt-1 text-[11px] font-bold text-emerald-700">
                  Toque para abrir {notifications.activeToast.targetTab === 'chat' ? 'o Chat' : 'Partidas'} →
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={notifications.dismissToast}
              aria-label="Fechar alerta"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        </div>
      )}

      {/* Post-Chat 3-second Notification Permission Prompt Announcement */}
      {showChatPushPrompt && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="chat-push-promo-title"
          className="fixed inset-x-0 bottom-16 z-50 flex justify-center px-4 md:bottom-6"
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 360, damping: 26 }}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3 text-white">
              <div className="flex items-center gap-2.5">
                <BrandLogo sizeClass="h-9 w-9" />
                <div>
                  <p className="text-[11px] font-bold tracking-wide text-emerald-100 uppercase">
                    Aviso do Vestiário
                  </p>
                  <h3
                    id="chat-push-promo-title"
                    className="font-display text-base font-extrabold leading-tight"
                  >
                    Quer saber quando responderem?
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowChatPushPrompt(false)}
                aria-label="Fechar aviso"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-100 hover:bg-white/15 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4">
              <p className="text-xs leading-relaxed text-slate-600">
                {notifications.permission === 'denied'
                  ? 'As notificações estão bloqueadas no navegador. Toque no cadeado ao lado do endereço do site e permita notificações para receber avisos do Chat e das Partidas.'
                  : 'Permita as notificações do Meu Time para receber alertas na hora quando o time responder no chat ou acontecer gol na partida!'}
              </p>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowChatPushPrompt(false)}
                  className="min-h-[38px] rounded-xl px-3.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
                >
                  Agora não
                </button>
                {notifications.permission !== 'denied' ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await notifications.requestPushPermission();
                      setShowChatPushPrompt(false);
                    }}
                    className="btn-studio inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
                  >
                    <Bell className="h-4 w-4" />
                    <span>Permitir Notificações</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowChatPushPrompt(false)}
                    className="btn-studio inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
                  >
                    <span>Entendi</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {showTutorial && activeTeam && (
        <StudioTutorialModal
          teamName={activeTeam.name}
          sport={activeTeam.sport}
          onClose={() => setShowTutorial(false)}
        />
      )}

      <FirstClickTipBanner />
      <OfflineIndicator />
    </div>
  );
}
