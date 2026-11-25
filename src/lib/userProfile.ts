import type { User } from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromCache,
  getDocFromServer,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { FIELD_LIMITS, UserProfile } from '../types/studio';
import {
  db,
  handleFirestoreError,
  isOfflineOrUnavailableError,
  OperationType,
  withTimeout,
} from './firebase';

export interface AuthUserSummary {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
}

export interface UserProfileStoreAdapter {
  readFromServer: (uid: string) => Promise<{ exists: boolean; data?: UserProfile }>;
  readFromCache?: (uid: string) => Promise<{ exists: boolean; data?: UserProfile }>;
  createProfile: (uid: string, payload: Record<string, unknown>) => Promise<void>;
  nowTimestamp: () => unknown;
}

const inFlightProfileInits = new Map<string, Promise<UserProfile>>();

export function buildNewUserProfilePayload(
  user: AuthUserSummary,
  nowTimestamp: unknown
): Record<string, unknown> {
  const fallbackName = user.email?.split('@')[0] || 'Atleta';
  const displayName = (user.displayName || fallbackName).trim().slice(0, 80) || 'Atleta';
  const email = (user.email || '').trim().slice(0, 160);
  const photoUrl = (user.photoURL || '').trim().slice(0, FIELD_LIMITS.MAX_PHOTO_LEN);

  return {
    uid: user.uid,
    displayName,
    email,
    photoUrl,
    chatPushEnabled: true,
    matchPushEnabled: true,
    createdAt: nowTimestamp,
    updatedAt: nowTimestamp,
  };
}

const defaultFirestoreAdapter: UserProfileStoreAdapter = {
  readFromServer: async (uid: string) => {
    const userRef = doc(db, 'users', uid);
    const snap = await withTimeout(
      getDocFromServer(userRef),
      12000,
      'Tempo limite excedido ao verificar seu perfil no Firestore.'
    );
    return {
      exists: snap.exists(),
      data: snap.exists() ? (snap.data() as UserProfile) : undefined,
    };
  },
  readFromCache: async (uid: string) => {
    const userRef = doc(db, 'users', uid);
    const snap = await getDocFromCache(userRef);
    return {
      exists: snap.exists(),
      data: snap.exists() ? (snap.data() as UserProfile) : undefined,
    };
  },
  createProfile: async (uid: string, payload: Record<string, unknown>) => {
    const userRef = doc(db, 'users', uid);
    await withTimeout(
      setDoc(userRef, payload),
      12000,
      'Tempo limite excedido ao criar seu perfil no Firestore.'
    );
    // Read back once if available so server timestamps resolve cleanly
    try {
      await getDoc(userRef);
    } catch {
      // Non-fatal; setDoc already succeeded
    }
  },
  nowTimestamp: () => serverTimestamp(),
};

export async function ensureUserProfile(
  user: AuthUserSummary,
  adapter: UserProfileStoreAdapter = defaultFirestoreAdapter,
  inFlightMap: Map<string, Promise<UserProfile>> = inFlightProfileInits
): Promise<UserProfile> {
  if (!user?.uid) {
    throw new Error('Usuário autenticado sem UID válido.');
  }

  const existingPromise = inFlightMap.get(user.uid);
  if (existingPromise) {
    return existingPromise;
  }

  const run = (async (): Promise<UserProfile> => {
    const path = `users/${user.uid}`;
    let readResult: { exists: boolean; data?: UserProfile } | null = null;

    try {
      readResult = await adapter.readFromServer(user.uid);
    } catch (err) {
      if (isOfflineOrUnavailableError(err) && adapter.readFromCache) {
        try {
          const cached = await adapter.readFromCache(user.uid);
          if (cached.exists && cached.data) {
            return cached.data;
          }
        } catch {
          // Cache miss while offline — fall through to report connection error
        }
      }
      handleFirestoreError(err, OperationType.GET, path);
    }

    // Returning user: never overwrite existing profile fields
    if (readResult?.exists && readResult.data) {
      return readResult.data;
    }

    const payload = buildNewUserProfilePayload(user, adapter.nowTimestamp());
    try {
      await adapter.createProfile(user.uid, payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }

    return {
      uid: payload.uid as string,
      displayName: payload.displayName as string,
      email: payload.email as string,
      photoUrl: payload.photoUrl as string,
      chatPushEnabled: true,
      matchPushEnabled: true,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
    };
  })();

  inFlightMap.set(user.uid, run);
  try {
    return await run;
  } finally {
    inFlightMap.delete(user.uid);
  }
}

export function toAuthUserSummary(user: User): AuthUserSummary {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
  };
}
