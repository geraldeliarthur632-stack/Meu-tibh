const rawApiBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return rawApiBase ? `${rawApiBase}${cleanPath}` : cleanPath;
}

export function getAppBaseUrl(): string {
  const raw = import.meta.env.BASE_URL || '/';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

export function appPath(subpath: string): string {
  const base = getAppBaseUrl();
  const clean = subpath.replace(/^\/+/, '');
  return `${base}${clean}`;
}

export function stripBasePath(pathname: string): string {
  const base = getAppBaseUrl();
  if (base !== '/' && pathname.startsWith(base.slice(0, -1))) {
    const rest = pathname.slice(base.length - 1);
    return rest.startsWith('/') ? rest : `/${rest}`;
  }
  return pathname;
}

export async function parseAiJsonResponse<T>(
  res: Response,
  fallbackError: string
): Promise<T & { error?: string }> {
  const rawText = await res.text();
  try {
    return JSON.parse(rawText) as T & { error?: string };
  } catch {
    if (res.status === 404 || res.status === 405) {
      throw new Error(
        'Servidor de IA (/api/ai) não encontrado neste domínio estático (GitHub Pages). Configure VITE_API_BASE_URL apontando para o servidor backend Node/Express.'
      );
    }
    throw new Error(
      res.ok
        ? 'Resposta inesperada do servidor de IA. Tente novamente.'
        : `${fallbackError} (HTTP ${res.status})`
    );
  }
}
