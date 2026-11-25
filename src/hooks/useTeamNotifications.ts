import { useCallback, useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { captureFirestoreError, db, OperationType } from '../lib/firebase';
import {
  Match,
  SPORTS_CONFIG,
  Team,
  TeamMessage,
  UserProfile,
} from '../types/studio';

export type NotificationTargetTab = 'chat' | 'matches';

export type PushPermissionState = NotificationPermission | 'unsupported';

export interface InAppNotificationToast {
  id: string;
  title: string;
  body: string;
  targetTab: NotificationTargetTab;
  createdAtMs: number;
}

interface UseTeamNotificationsOptions {
  user: User | null;
  isVerifiedUser: boolean;
  activeTeam: Team | null;
  activeTab: string;
  onNavigateTab: (tab: NotificationTargetTab) => void;
}

const PREF_STORAGE_KEY = 'meu_time_push_prefs';

function readLocalPrefs(): { chatPushEnabled: boolean; matchPushEnabled: boolean } {
  try {
    const raw = localStorage.getItem(PREF_STORAGE_KEY);
    if (!raw) return { chatPushEnabled: true, matchPushEnabled: true };
    const parsed = JSON.parse(raw) as Partial<{
      chatPushEnabled: boolean;
      matchPushEnabled: boolean;
    }>;
    return {
      chatPushEnabled: parsed.chatPushEnabled ?? true,
      matchPushEnabled: parsed.matchPushEnabled ?? true,
    };
  } catch {
    return { chatPushEnabled: true, matchPushEnabled: true };
  }
}

export function getBrowserPermissionState(): PushPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export function useTeamNotifications({
  user,
  isVerifiedUser,
  activeTeam,
  activeTab,
  onNavigateTab,
}: UseTeamNotificationsOptions) {
  const initialLocal = readLocalPrefs();
  const [chatPushEnabled, setChatPushEnabled] = useState<boolean>(initialLocal.chatPushEnabled);
  const [matchPushEnabled, setMatchPushEnabled] = useState<boolean>(initialLocal.matchPushEnabled);
  const [permission, setPermission] = useState<PushPermissionState>(() =>
    getBrowserPermissionState()
  );
  const [savingPref, setSavingPref] = useState(false);
  const [prefError, setPrefError] = useState<string | null>(null);
  const [activeToast, setActiveToast] = useState<InAppNotificationToast | null>(null);

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const onNavigateTabRef = useRef(onNavigateTab);
  onNavigateTabRef.current = onNavigateTab;

  const permissionRef = useRef(permission);
  permissionRef.current = permission;

  // Keep permission state fresh if changed in browser settings
  useEffect(() => {
    setPermission(getBrowserPermissionState());
    const handleVisibility = () => {
      setPermission(getBrowserPermissionState());
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Handle click notification deep-link message from sw-push.js
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handleSwMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; targetTab?: string } | undefined;
      if (data?.type === 'MEU_TIME_NOTIFICATION_CLICK') {
        if (data.targetTab === 'chat' || data.targetTab === 'matches') {
          onNavigateTabRef.current(data.targetTab);
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
  }, []);

  // Load & subscribe to user push preferences from users/{uid}
  useEffect(() => {
    if (!user || !isVerifiedUser) return;
    const path = `users/${user.uid}`;
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          const nextChat = data.chatPushEnabled ?? true;
          const nextMatch = data.matchPushEnabled ?? true;
          setChatPushEnabled(nextChat);
          setMatchPushEnabled(nextMatch);
          try {
            localStorage.setItem(
              PREF_STORAGE_KEY,
              JSON.stringify({ chatPushEnabled: nextChat, matchPushEnabled: nextMatch })
            );
          } catch {
            // ignore storage errors
          }
        }
      },
      (err) => {
        captureFirestoreError(err, OperationType.GET, path);
      }
    );
    return () => unsub();
  }, [user?.uid, isVerifiedUser]);

  const dispatchNotification = useCallback(
    async (
      title: string,
      body: string,
      targetTab: NotificationTargetTab,
      tag: string,
      forceToast = false
    ) => {
      const id = `${tag}_${Date.now()}`;
      const shouldShowToast =
        forceToast || activeTabRef.current !== targetTab || document.hidden;

      if (shouldShowToast) {
        setActiveToast({
          id,
          title,
          body,
          targetTab,
          createdAtMs: Date.now(),
        });
      }

      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;

      const options: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag,
        renotify: true,
        data: { targetTab, url: `/?tab=${targetTab}` },
      };

      try {
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration && typeof registration.showNotification === 'function') {
            await registration.showNotification(title, options);
            return;
          }
        }
        const n = new Notification(title, options);
        n.onclick = () => {
          window.focus();
          onNavigateTabRef.current(targetTab);
          n.close();
        };
      } catch {
        // Browsers inside strict iframes may throw on direct Notification constructor;
        // the in-app push toast already alerts the user cleanly.
      }
    },
    []
  );

  // Auto-dismiss in-app toast after 6s
  useEffect(() => {
    if (!activeToast) return;
    const timer = window.setTimeout(() => {
      setActiveToast(null);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [activeToast]);

  const updatePushPreference = useCallback(
    async (key: 'chatPushEnabled' | 'matchPushEnabled', value: boolean) => {
      const nextChat = key === 'chatPushEnabled' ? value : chatPushEnabled;
      const nextMatch = key === 'matchPushEnabled' ? value : matchPushEnabled;

      if (key === 'chatPushEnabled') setChatPushEnabled(value);
      else setMatchPushEnabled(value);

      try {
        localStorage.setItem(
          PREF_STORAGE_KEY,
          JSON.stringify({ chatPushEnabled: nextChat, matchPushEnabled: nextMatch })
        );
      } catch {
        // ignore storage errors
      }

      if (!user || !isVerifiedUser) return;
      setSavingPref(true);
      setPrefError(null);
      const userPath = `users/${user.uid}`;
      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          await updateDoc(userRef, {
            [key]: value,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(userRef, {
            uid: user.uid,
            displayName: (user.displayName || user.email?.split('@')[0] || 'Atleta').slice(0, 80),
            email: (user.email || '').trim().slice(0, 160),
            photoUrl: (user.photoURL || '').trim().slice(0, 200000),
            ...(activeTeam?.id ? { activeTeamId: activeTeam.id } : {}),
            chatPushEnabled: nextChat,
            matchPushEnabled: nextMatch,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        setPrefError(captureFirestoreError(err, OperationType.UPDATE, userPath));
      } finally {
        setSavingPref(false);
      }
    },
    [user, isVerifiedUser, chatPushEnabled, matchPushEnabled, activeTeam?.id]
  );

  const requestPushPermission = useCallback(async (): Promise<PushPermissionState> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return 'unsupported';
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        await dispatchNotification(
          'Meu Time · Alertas Ativados',
          'Você receberá notificações de mensagens no chat e lances das partidas ao vivo.',
          'matches',
          'meutime-welcome',
          true
        );
      }
      return result;
    } catch {
      const current = getBrowserPermissionState();
      setPermission(current);
      return current;
    }
  }, [dispatchNotification]);

  const sendTestNotification = useCallback(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      await requestPushPermission();
      return;
    }
    const teamLabel = activeTeam ? activeTeam.name : 'Meu Time';
    await dispatchNotification(
      `${teamLabel} · Teste de Notificação`,
      'Push configurado! Novos recados do vestiário e gols da partida aparecerão aqui.',
      'chat',
      'meutime-test',
      true
    );
  }, [activeTeam, dispatchNotification, requestPushPermission]);

  // Listen to new chat messages on active team
  useEffect(() => {
    if (!user || !isVerifiedUser || !activeTeam?.id || !chatPushEnabled) return;

    let initialized = false;
    let lastNotifiedMsgId: string | null = null;
    const path = `teams/${activeTeam.id}/messages`;
    const q = query(
      collection(db, 'teams', activeTeam.id, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!initialized) {
          initialized = true;
          if (!snap.empty) {
            lastNotifiedMsgId = snap.docs[0].id;
          }
          return;
        }
        if (snap.empty) return;
        const msgDoc = snap.docs[0];
        if (msgDoc.id === lastNotifiedMsgId) return;
        lastNotifiedMsgId = msgDoc.id;

        const msg = msgDoc.data() as TeamMessage;
        if (msg.senderId === user.uid) return;

        const senderTag = msg.senderJersey > 0 ? `#${msg.senderJersey} ${msg.senderName}` : msg.senderName;
        void dispatchNotification(
          `Chat · ${activeTeam.name}`,
          `${senderTag}: ${msg.text}`,
          'chat',
          `chat-${activeTeam.id}`
        );
      },
      (err) => {
        captureFirestoreError(err, OperationType.LIST, path);
      }
    );

    return () => unsub();
  }, [user?.uid, isVerifiedUser, activeTeam?.id, activeTeam?.name, chatPushEnabled, dispatchNotification]);

  // Listen to live match updates & status changes on active team
  useEffect(() => {
    if (!user || !isVerifiedUser || !activeTeam?.id || !matchPushEnabled) return;

    let initialized = false;
    const snapshotCache = new Map<string, Match>();
    const path = `teams/${activeTeam.id}/matches`;
    const q = query(
      collection(db, 'teams', activeTeam.id, 'matches'),
      orderBy('updatedAt', 'desc'),
      limit(5)
    );

    const scoreWord = SPORTS_CONFIG[activeTeam.sport].scoreLabel.toLowerCase();

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!initialized) {
          initialized = true;
          snap.docs.forEach((d) => snapshotCache.set(d.id, d.data() as Match));
          return;
        }

        snap.docs.forEach((d) => {
          const next = d.data() as Match;
          const prev = snapshotCache.get(d.id);
          snapshotCache.set(d.id, next);

          if (!prev) {
            if (next.status === 'live') {
              void dispatchNotification(
                `Partida Ao Vivo · ${activeTeam.name}`,
                `${activeTeam.name} x ${next.opponent} já começou!`,
                'matches',
                `match-${d.id}`
              );
            }
            return;
          }

          if (prev.status !== 'live' && next.status === 'live') {
            void dispatchNotification(
              `Bola Rolando · ${activeTeam.name}`,
              `${activeTeam.name} x ${next.opponent} entrou ao vivo!`,
              'matches',
              `match-${d.id}`
            );
            return;
          }

          if (prev.status !== 'finished' && next.status === 'finished') {
            void dispatchNotification(
              `Fim de Jogo · ${activeTeam.name}`,
              `Placar final: ${activeTeam.name} ${next.teamScore} x ${next.opponentScore} ${next.opponent}`,
              'matches',
              `match-${d.id}`
            );
            return;
          }

          if (
            next.teamScore !== prev.teamScore ||
            next.opponentScore !== prev.opponentScore
          ) {
            const actionLabel =
              next.teamScore > prev.teamScore
                ? `Placar atualizado (${scoreWord} do seu time)!`
                : `Adversário marcou (${scoreWord})!`;
            void dispatchNotification(
              `${actionLabel} · ${activeTeam.name}`,
              `${activeTeam.name} ${next.teamScore} x ${next.opponentScore} ${next.opponent}`,
              'matches',
              `match-${d.id}`
            );
            return;
          }

          if (next.extraMinutes !== prev.extraMinutes && next.extraMinutes > 0) {
            void dispatchNotification(
              `Acréscimos · ${activeTeam.name}`,
              `+${next.extraMinutes} min extras em ${activeTeam.name} x ${next.opponent}`,
              'matches',
              `match-${d.id}`
            );
          }
        });
      },
      (err) => {
        captureFirestoreError(err, OperationType.LIST, path);
      }
    );

    return () => unsub();
  }, [
    user?.uid,
    isVerifiedUser,
    activeTeam?.id,
    activeTeam?.name,
    activeTeam?.sport,
    matchPushEnabled,
    dispatchNotification,
  ]);

  return {
    permission,
    chatPushEnabled,
    matchPushEnabled,
    savingPref,
    prefError,
    activeToast,
    dismissToast: () => setActiveToast(null),
    requestPushPermission,
    updatePushPreference,
    sendTestNotification,
  };
}
