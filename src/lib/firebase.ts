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

export function captureFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): string {
  try {
    handleFirestoreError(error, operationType, path);
  } catch (wrapped) {
    return formatFriendlyFirebaseError(wrapped);
  }
}

export function extractRawFirebaseErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.startsWith('{') && raw.includes('"operationType"')) {
    try {
      const parsed = JSON.parse(raw) as { error?: string };
      if (parsed?.error) return parsed.error;
    } catch {
      // keep raw
    }
  }
  return raw;
}

export function isPermissionDeniedError(error: unknown): boolean {
  const raw = extractRawFirebaseErrorMessage(error).toLowerCase();
  return raw.includes('missing or insufficient permissions') || raw.includes('permission-denied');
}

export function isOfflineOrUnavailableError(error: unknown): boolean {
  const raw = extractRawFirebaseErrorMessage(error).toLowerCase();
  return (
    raw.includes('the client is offline') ||
    raw.includes('unavailable') ||
    raw.includes('network-request-failed') ||
    raw.includes('failed to get document because the client is offline')
  );
}

export function formatFriendlyFirebaseError(error: unknown): string {
  const raw = extractRawFirebaseErrorMessage(error);
  const lower = raw.toLowerCase();

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
  if (raw.includes('auth/invalid-email')) {
    return 'O endereço de e-mail informado não é válido.';
  }
  if (raw.includes('auth/popup-closed-by-user')) {
    return 'A janela de login com Google foi fechada antes da conclusão.';
  }
  if (raw.includes('auth/popup-blocked')) {
    return 'O navegador bloqueou a janela do login com Google. Permita pop-ups para este site e tente novamente.';
  }
  if (raw.includes('auth/cancelled-popup-request')) {
    return 'Solicitação de login cancelada. Tente novamente.';
  }
  if (raw.includes('auth/unauthorized-domain')) {
    return 'Este domínio não está autorizado no Firebase Authentication (Authentication > Settings > Authorized domains).';
  }
  if (raw.includes('auth/network-request-failed')) {
    return 'Falha de conexão com a internet durante a autenticação. Verifique sua rede e tente novamente.';
  }
  if (raw.includes('auth/too-many-requests')) {
    return 'Muitas tentativas em sequência. Aguarde alguns instantes e tente novamente.';
  }
  if (raw.includes('auth/user-disabled')) {
    return 'Esta conta foi desativada no Firebase Authentication.';
  }
  if (lower.includes('missing or insufficient permissions') || lower.includes('permission-denied')) {
    return 'Permissão insuficiente no Firestore. Verifique se seu e-mail foi confirmado e se você é membro autorizado deste grupo.';
  }
  if (isOfflineOrUnavailableError(raw)) {
    return 'Não foi possível conectar ao Firestore no momento. Verifique sua conexão com a internet e tente novamente.';
  }
  if (lower.includes('deadline-exceeded') || lower.includes('tempo limite')) {
    return 'O servidor do Firestore demorou para responder. Verifique sua conexão e clique em Tentar novamente.';
  }
  if (lower.includes('not-found')) {
    return 'O registro solicitado não foi encontrado no banco de dados.';
  }
  if (lower.includes('failed-precondition')) {
    return 'Operação bloqueada por pré-condição ou índice pendente no Firestore.';
  }
  return raw;
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Tempo limite excedido ao comunicar com o Firebase.'
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    return true;
  }
}

void testConnection();
