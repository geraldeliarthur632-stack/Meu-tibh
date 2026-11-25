import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function formatFriendlyFirebaseError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('Quota exceeded')) {
    return 'Cota diária gratuita do Firestore atingida. A cota será renovada amanhã.';
  }
  if (raw.includes('auth/operation-not-allowed')) {
    return 'O login por E-mail e Senha ainda não está ativado no Console do Firebase. Ative em Authentication > Sign-in method > E-mail/senha ou entre com Google.';
  }
  if (raw.includes('auth/invalid-credential') || raw.includes('auth/wrong-password')) {
    return 'E-mail ou senha incorretos.';
  }
  if (raw.includes('auth/user-not-found')) {
    return 'Nenhuma conta encontrada com este e-mail.';
  }
  if (raw.includes('auth/email-already-in-use')) {
    return 'Este e-mail já está cadastrado. Faça login na aba Entrar.';
  }
  if (raw.includes('auth/weak-password')) {
    return 'A senha precisa ter pelo menos 6 caracteres.';
  }
  if (raw.includes('auth/popup-closed-by-user')) {
    return 'A janela de login com Google foi fechada antes da conclusão.';
  }
  if (raw.includes('Missing or insufficient permissions')) {
    return 'Permissão insuficiente para esta operação. Verifique se seu e-mail está verificado e se você é membro do time.';
  }
  return raw;
}

export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
