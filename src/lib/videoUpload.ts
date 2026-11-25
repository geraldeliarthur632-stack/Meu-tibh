export const MAX_VIDEO_CLIP_BYTES = 35 * 1024 * 1024; // 35 MB per clip

export interface UploadedClipMeta {
  clipId: string;
  mimeType: string;
  size: number;
}

export async function uploadVideoClip(file: Blob, explicitMime?: string): Promise<UploadedClipMeta> {
  if (!file || file.size === 0) {
    throw new Error('O arquivo de vídeo está vazio.');
  }
  if (file.size > MAX_VIDEO_CLIP_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `O vídeo tem ${mb} MB. Envie um clipe de até 35 MB (10 a 30 segundos em 720p).`
    );
  }

  const mimeType =
    (explicitMime || (file as File).type || 'video/mp4').split(';')[0].trim() || 'video/mp4';

  const res = await fetch('/api/ai/upload-clip', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Clip-Mime': mimeType,
    },
    body: file,
  });

  const data = (await res.json().catch(() => ({}))) as Partial<UploadedClipMeta> & {
    error?: string;
  };
  if (!res.ok || !data.clipId) {
    throw new Error(data.error || 'Falha ao enviar o vídeo para análise.');
  }

  return {
    clipId: data.clipId,
    mimeType: data.mimeType || mimeType,
    size: data.size || file.size,
  };
}

export function formatCountdownMs(msRemaining: number): string {
  const totalSec = Math.max(0, Math.ceil(msRemaining / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
