import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import {
  AlertTriangle,
  Bell,
  BellRing,
  BookOpen,
  HelpCircle,
  LogOut,
  MessageSquare,
  Plus,
  RotateCcw,
  Share2,
  Timer,
  Trash2,
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
import { appPath, stripBasePath } from './lib/apiUrl';
import {
  auth,
  captureFirestoreError,
  db,
  formatFriendlyFirebaseError,
  OperationType,
  testConnection,
} from './lib/firebase';
import { triggerFirstClickTip } from './lib/firstClickCoach';
import { ensureUserProfile, toAuthUserSummary } from './lib/userProfile';
import {
  InviteLookup,
  SPORTS_CONFIG,
  Team,
  TeamMember,
  UserProfile,
  UserTeamMembership,
} from './types/studio';

type StudioTab = 'lineup' | 'matches' | 'manual' | 'chat' | 'invite' | 'profile';
type TeamLoadStatus = 'idle' | 'loading' | 'ready' | 'not_found' | 'error';

const INVITE_STORAGE_KEY = 'meu_time_pending_invite';
const SYNC_TIMEOUT_MS = 15000;

function extractInviteCodeFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const queryCode = params.get('join');
  if (queryCode) {
    const clean = queryCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return /^[A-Z0-9]{6,10}$/.test(clean) ? clean : null;
  }
  const cleanPath = stripBasePath(window.location.pathname);
  const pathMatch = cleanPath.match(/^\/join\/([A-Za-z0-9]{6,10})\/?$/);
  if (pathMatch) {
    return pathMatch[1].toUpperCase();
  }
  return null;
}

function extractTeamIdFromUrl(): string | null {
  const cleanPath = stripBasePath(window.location.pathname);
  const match = cleanPath.match(/^\/team\/([a-zA-Z0-9_-]+)\/?$/);
  return match ? match[1] : null;
}

function toTimestampMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (
    value &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof (value as { toMillis: unknown }).toMillis === 'function'
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [emailVerifiedFlag, setEmailVerifiedFlag] = useState(false);

  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(() => {
    const fromUrl = extractInviteCodeFromUrl();
    if (fromUrl) {
      sessionStorage.setItem(INVITE_STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    const stored = sessionStorage.getItem(INVITE_STORAGE_KEY);
    return stored && /^[A-Z0-9]{6,10}$/.test(stored) ? stored : null;
  });

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileRetryNonce, setProfileRetryNonce] = useState(0);

  const [memberships, setMemberships] = useState<UserTeamMembership[]>([]);
  const [membershipsLoaded, setMembershipsLoaded] = useState(false);
  const [membershipsError, setMembershipsError] = useState<string | null>(null);
  const [membershipsRetryNonce, setMembershipsRetryNonce] = useState(0);

  const [activeTeamId, setActiveTeamId] = useState<string | null>(() => extractTeamIdFromUrl());
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [activeTeam, setActiveTeam] = useState<Team | null>(null);
  const [teamStatus, setTeamStatus] = useState<TeamLoadStatus>('idle');
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [teamRetryNonce, setTeamRetryNonce] = useState(0);
  const [removingStaleMembership, setRemovingStaleMembership] = useState(false);

  const [activeTab, setActiveTab] = useState<StudioTab>(() => {
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    if (
      tabParam === 'chat' ||
      tabParam === 'matches' ||
      tabParam === 'manual' ||
      tabParam === 'invite' ||
      tabParam === 'profile'
    ) {
      return tabParam;
    }
    return 'lineup';
  });
  const [showTutorial, setShowTutorial] = useState(false);

  const prevUidRef = useRef<string | null>(null);

  const resetUserWorkspaceState = () => {
    setUserProfile(null);
    setProfileReady(false);
    setProfileError(null);
    setMemberships([]);
    setMembershipsLoaded(false);
    setMembershipsError(null);
    setActiveTeamId(extractTeamIdFromUrl());
    setActiveTeam(null);
    setTeamStatus('idle');
    setTeamError(null);
    setTeamMembers([]);
    setMembersError(null);
    setShowOnboarding(false);
    setShowTutorial(false);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(
      auth,
      (nextUser) => {
        const nextUid = nextUser?.uid ?? null;
        if (prevUidRef.current !== nextUid) {
          prevUidRef.current = nextUid;
          resetUserWorkspaceState();
        }
        setUser(nextUser);
        setEmailVerifiedFlag(!!nextUser?.emailVerified);
        setAuthError(null);
        setAuthReady(true);
      },
      (err) => {
        setAuthError(formatFriendlyFirebaseError(err));
        setAuthReady(true);
      }
    );
    return () => unsub();
  }, []);

  const isVerifiedUser = !!user && emailVerifiedFlag;

  // Step 1 after login: automatically verify/initialize users/{uid} in Firestore without overwriting existing profiles
  useEffect(() => {
    if (!authReady || !isVerifiedUser || !user) return;
    let cancelled = false;

    const runInit = async () => {
      setProfileError(null);
      try {
        try {
          await user.getIdToken();
        } catch {
          // Proceed to Firestore read/offline cache fallback; if token truly invalid, Firestore error handler catches it
        }
        const profile = await ensureUserProfile(toAuthUserSummary(user));
        if (cancelled) return;
        setUserProfile(profile);
        setProfileError(null);
        setProfileReady(true);
      } catch (err) {
        if (cancelled) return;
        setProfileError(formatFriendlyFirebaseError(err));
        setProfileReady(false);
      }
    };

    void runInit();
    return () => {
      cancelled = true;
    };
  }, [authReady, isVerifiedUser, user?.uid, profileRetryNonce]);

  // Step 2 after profile initialization: subscribe to user's team memberships with timeout & error recovery
  useEffect(() => {
    if (!authReady || !isVerifiedUser || !user || !profileReady) return;

    const path = `users/${user.uid}/teamMemberships`;
    let receivedFirstSnapshot = false;
    setMembershipsError(null);

    const timeoutId = window.setTimeout(() => {
      if (!receivedFirstSnapshot) {
        setMembershipsError(
          'A sincronização dos seus grupos demorou mais que o esperado. Verifique sua internet ou tente novamente.'
        );
        setMembershipsLoaded(true);
      }
    }, SYNC_TIMEOUT_MS);

    const unsub = onSnapshot(
      collection(db, 'users', user.uid, 'teamMemberships'),
      (snap) => {
        receivedFirstSnapshot = true;
        window.clearTimeout(timeoutId);
        const list = snap.docs
          .map((d) => d.data() as UserTeamMembership)
          .sort((a, b) => toTimestampMillis(b.joinedAt) - toTimestampMillis(a.joinedAt));
        setMemberships(list);
        setMembershipsError(null);
        setMembershipsLoaded(true);
      },
      (err) => {
        receivedFirstSnapshot = true;
        window.clearTimeout(timeoutId);
        const friendly = captureFirestoreError(err, OperationType.LIST, path);
        setMembershipsError(friendly);
        setMembershipsLoaded(true);
      }
    );

    return () => {
      window.clearTimeout(timeoutId);
      unsub();
    };
  }, [authReady, isVerifiedUser, user?.uid, profileReady, membershipsRetryNonce]);

  // Step 3: Resolve pending invite code safely without adding user automatically to private groups
  useEffect(() => {
    if (
      !authReady ||
      !isVerifiedUser ||
      !user ||
      !profileReady ||
      !pendingInviteCode ||
      !membershipsLoaded ||
      membershipsError
    ) {
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
          window.history.replaceState({}, '', appPath(`/team/${invite.teamId}`));
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
  }, [
    authReady,
    isVerifiedUser,
    user?.uid,
    profileReady,
    pendingInviteCode,
    membershipsLoaded,
    membershipsError,
    memberships,
  ]);

  // Step 4: Select valid active team from URL, saved profile preference, or newest membership
  useEffect(() => {
    if (!membershipsLoaded || membershipsError || showOnboarding || pendingInviteCode) return;
    if (memberships.length === 0) {
      setActiveTeamId(null);
      return;
    }
    if (!activeTeamId || !memberships.some((m) => m.teamId === activeTeamId)) {
      const preferredFromProfile =
        userProfile?.activeTeamId &&
        memberships.some((m) => m.teamId === userProfile.activeTeamId)
          ? userProfile.activeTeamId
          : memberships[0].teamId;
      setActiveTeamId(preferredFromProfile);
      window.history.replaceState({}, '', appPath(`/team/${preferredFromProfile}`));
    }
  }, [
    membershipsLoaded,
    membershipsError,
    memberships,
    activeTeamId,
    userProfile?.activeTeamId,
    showOnboarding,
    pendingInviteCode,
  ]);

  // Step 5: Subscribe to active team & roster with real loading/error/not-found recovery
  useEffect(() => {
    if (!authReady || !isVerifiedUser || !profileReady || !activeTeamId || showOnboarding) {
      setActiveTeam(null);
      setTeamStatus('idle');
      setTeamError(null);
      setTeamMembers([]);
      setMembersError(null);
      return;
    }

    setTeamStatus('loading');
    setTeamError(null);
    setMembersError(null);

    let teamSettled = false;
    const timeoutId = window.setTimeout(() => {
      if (!teamSettled) {
        setTeamStatus('error');
        setTeamError(
          'O carregamento dos dados do grupo demorou mais que o esperado. Verifique sua conexão e tente novamente.'
        );
      }
    }, SYNC_TIMEOUT_MS);

    const teamPath = `teams/${activeTeamId}`;
    const unsubTeam = onSnapshot(
      doc(db, 'teams', activeTeamId),
      (snap) => {
        teamSettled = true;
        window.clearTimeout(timeoutId);
        if (snap.exists()) {
          setActiveTeam(snap.data() as Team);
          setTeamStatus('ready');
          setTeamError(null);
        } else {
          setActiveTeam(null);
          setTeamStatus('not_found');
          setTeamError('Este time não existe mais ou foi removido pelo administrador.');
        }
      },
      (err) => {
        teamSettled = true;
        window.clearTimeout(timeoutId);
        const friendly = captureFirestoreError(err, OperationType.GET, teamPath);
        setActiveTeam(null);
        setTeamStatus('error');
        setTeamError(friendly);
      }
    );

    const membersPath = `teams/${activeTeamId}/members`;
    const unsubMembers = onSnapshot(
      collection(db, 'teams', activeTeamId, 'members'),
      (snap) => {
        setTeamMembers(snap.docs.map((d) => d.data() as TeamMember));
        setMembersError(null);
      },
      (err) => {
        setMembersError(captureFirestoreError(err, OperationType.LIST, membersPath));
      }
    );

    return () => {
      window.clearTimeout(timeoutId);
      unsubTeam();
      unsubMembers();
    };
  }, [authReady, isVerifiedUser, profileReady, activeTeamId, showOnboarding, teamRetryNonce]);

  const currentMember = useMemo(
    () => teamMembers.find((m) => m.userId === user?.uid) || null,
    [teamMembers, user?.uid]
  );

  const notifications = useTeamNotifications({
    user,
    isVerifiedUser: isVerifiedUser && profileReady,
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
    setProfileError(null);
    setMembershipsError(null);
  };

  const handleRetryProfileInit = () => {
    void testConnection();
    setProfileError(null);
    setProfileRetryNonce((n) => n + 1);
  };

  const handleRetryMemberships = () => {
    void testConnection();
    setMembershipsError(null);
    setMembershipsLoaded(false);
    setMembershipsRetryNonce((n) => n + 1);
  };

  const handleRetryActiveTeam = () => {
    void testConnection();
    setTeamError(null);
    setMembersError(null);
    setTeamRetryNonce((n) => n + 1);
  };

  const handleRemoveStaleMembership = async () => {
    if (!user || !activeTeamId) return;
    setRemovingStaleMembership(true);
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'teamMemberships', activeTeamId));
      setActiveTeamId(null);
      setTeamError(null);
      setTeamStatus('idle');
    } catch (err) {
      setTeamError(formatFriendlyFirebaseError(err));
    } finally {
      setRemovingStaleMembership(false);
    }
  };

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8FB] p-6 text-slate-700">
        <div className="flex items-center gap-3">
          <BrandLogo sizeClass="h-10 w-10" />
          <span className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Carregando Meu Time...
          </span>
        </div>
      </div>
    );
  }

  if (authError && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8FB] p-6 text-slate-900">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle className="h-6 w-6 shrink-0" />
            <h2 className="font-display text-2xl font-bold text-slate-900">
              Erro na Autenticação
            </h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{authError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-studio mt-5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-500 cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Tentar novamente</span>
          </button>
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

  // Profile initialization loading or error recovery screen
  if (!profileReady) {
    if (profileError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F6F8FB] p-6 text-slate-900">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h2 className="font-display text-2xl font-bold text-slate-900">
                Falha ao Inicializar Perfil
              </h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{profileError}</p>
            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              <button
                type="button"
                onClick={handleRetryProfileInit}
                className="btn-studio inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-500 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Tentar novamente</span>
              </button>
              <button
                type="button"
                onClick={() => void signOut(auth)}
                className="btn-studio inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>Sair</span>
              </button>
            </div>
          </div>
          <OfflineIndicator />
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8FB] p-6 text-slate-700">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-3">
            <BrandLogo sizeClass="h-10 w-10" />
            <span className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Preparando seu perfil...
            </span>
          </div>
          <button
            type="button"
            onClick={() => void signOut(auth)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            Trocar de conta
          </button>
        </div>
        <OfflineIndicator />
      </div>
    );
  }

  // Memberships sync loading or error recovery screen
  if (!membershipsLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8FB] p-6 text-slate-700">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-3">
            <BrandLogo sizeClass="h-10 w-10" />
            <span className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Sincronizando Estúdio...
            </span>
          </div>
          <button
            type="button"
            onClick={() => void signOut(auth)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            Trocar de conta
          </button>
        </div>
        <OfflineIndicator />
      </div>
    );
  }

  if (membershipsError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8FB] p-6 text-slate-900">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle className="h-6 w-6 shrink-0" />
            <h2 className="font-display text-2xl font-bold text-slate-900">
              Erro ao Carregar Grupos
            </h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{membershipsError}</p>
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={handleRetryMemberships}
              className="btn-studio inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-500 cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Tentar novamente</span>
            </button>
            <button
              type="button"
              onClick={() => void signOut(auth)}
              className="btn-studio inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </button>
          </div>
        </div>
        <OfflineIndicator />
      </div>
    );
  }

  if (showOnboarding || memberships.length === 0) {
    return (
      <>
        <OnboardingWizard
          user={user}
          initialInviteCode={pendingInviteCode}
          existingTeamIds={memberships.map((m) => m.teamId)}
          onTeamReady={(teamId) => {
            sessionStorage.removeItem(INVITE_STORAGE_KEY);
            setPendingInviteCode(null);
            setShowOnboarding(false);
            setActiveTeamId(teamId);
            setActiveTab('lineup');
            setShowTutorial(true);
            window.history.replaceState({}, '', appPath(`/team/${teamId}`));
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

  const activeMembershipFallback =
    memberships.find((m) => m.teamId === activeTeamId) || memberships[0];

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
            {(activeTeam || activeMembershipFallback) && (
              <>
                <TeamCrest
                  photoUrl={(activeTeam || activeMembershipFallback).photoUrl}
                  teamName={
                    activeTeam ? activeTeam.name : activeMembershipFallback.teamName
                  }
                  sizeClass="h-10 w-10"
                />
                <div className="min-w-0">
                  <select
                    aria-label="Selecionar time ativo"
                    value={activeTeam?.id || activeTeamId || activeMembershipFallback.teamId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setActiveTeamId(nextId);
                      window.history.replaceState({}, '', appPath(`/team/${nextId}`));
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
                    <span>
                      {SPORTS_CONFIG[(activeTeam || activeMembershipFallback).sport].label}
                    </span>
                    <span aria-hidden="true"> · </span>
                    <span className="tabular-nums">{teamMembers.length} jogadores</span>
                    <span aria-hidden="true"> · </span>
                    <span className="font-mono-tabular">
                      Código {(activeTeam || activeMembershipFallback).inviteCode}
                    </span>
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
        {teamStatus === 'error' || teamStatus === 'not_found' || (!activeTeam && teamError) ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h2 className="font-display text-xl font-extrabold text-slate-900">
                {teamStatus === 'not_found'
                  ? 'Grupo não encontrado'
                  : 'Não foi possível carregar o grupo'}
              </h2>
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
              {teamError ||
                'Ocorreu uma falha de permissão ou conexão ao acessar os dados deste grupo.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleRetryActiveTeam}
                className="btn-studio inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Tentar novamente</span>
              </button>
              {activeTeamId && memberships.some((m) => m.teamId === activeTeamId) && (
                <button
                  type="button"
                  disabled={removingStaleMembership}
                  onClick={() => void handleRemoveStaleMembership()}
                  className="btn-studio inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-rose-200 border-b-[3px] border-b-rose-300 bg-rose-50 px-4 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>
                    {removingStaleMembership ? 'Removendo...' : 'Remover atalho deste time'}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowOnboarding(true)}
                className="btn-studio inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Criar / Entrar em Time</span>
              </button>
            </div>
          </div>
        ) : !activeTeam ? (
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
            {membersError && (
              <div
                role="alert"
                className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"
              >
                <span>Falha ao sincronizar lista de membros: {membersError}</span>
                <button
                  type="button"
                  onClick={handleRetryActiveTeam}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-bold text-amber-900 hover:bg-amber-100 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Tentar novamente</span>
                </button>
              </div>
            )}

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
                currentUserName={userProfile?.displayName || user.displayName || undefined}
                onMessageSent={handleChatMessageSent}
              />
            )}

            {activeTab === 'invite' && (
              <InvitePanel team={activeTeam} memberCount={teamMembers.length} />
            )}

            {activeTab === 'profile' && (
              <ProfilePanel
                user={user}
                userProfile={userProfile}
                activeTeam={activeTeam}
                currentMember={currentMember}
                memberships={memberships}
                permission={notifications.permission}
                chatPushEnabled={notifications.chatPushEnabled}
                matchPushEnabled={notifications.matchPushEnabled}
                savingPref={notifications.savingPref}
                prefError={notifications.prefError}
                onRequestPermission={notifications.requestPushPermission}
                onTogglePref={notifications.updatePushPreference}
                onSendTestNotification={notifications.sendTestNotification}
                onSelectTeam={(teamId) => {
                  setActiveTeamId(teamId);
                  window.history.replaceState({}, '', appPath(`/team/${teamId}`));
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
