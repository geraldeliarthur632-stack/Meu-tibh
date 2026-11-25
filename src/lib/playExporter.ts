import { PlayArrow, PlayFrame, PlayTokenPos, SportId } from '../types/studio';

const CANVAS_W = 840;
const HEADER_H = 88;
const PITCH_H = 1080;
const FOOTER_H = 84;
const CANVAS_H = HEADER_H + PITCH_H + FOOTER_H;

function drawPitchBackground(ctx: CanvasRenderingContext2D, sport: SportId) {
  const ox = 0;
  const oy = HEADER_H;
  const w = CANVAS_W;
  const h = PITCH_H;

  const px = (v: number) => ox + (v / 100) * w;
  const py = (v: number) => oy + (v / 140) * h;

  ctx.save();

  if (sport === 'futebol') {
    const stripeH = py(10) - oy;
    for (let i = 0; i < 14; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? '#15803D' : '#16A34A';
      ctx.fillRect(ox, oy + i * stripeH, w, stripeH + 1);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 4;
    ctx.strokeRect(px(5), py(5), px(90) - ox, py(130) - oy);

    // Halfway + center circle
    ctx.beginPath();
    ctx.moveTo(px(5), py(70));
    ctx.lineTo(px(95), py(70));
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(px(50), py(70), px(13) - ox, py(13) - oy, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Top penalty & goal box
    ctx.strokeRect(px(23), py(5), px(54) - ox, py(21) - oy);
    ctx.strokeRect(px(37), py(5), px(26) - ox, py(8) - oy);
    ctx.strokeRect(px(42), py(2.5), px(16) - ox, py(2.5) - oy);

    // Bottom penalty & goal box
    ctx.strokeRect(px(23), py(114), px(54) - ox, py(21) - oy);
    ctx.strokeRect(px(37), py(127), px(26) - ox, py(8) - oy);
    ctx.strokeRect(px(42), py(135), px(16) - ox, py(2.5) - oy);
  } else if (sport === 'futsal') {
    ctx.fillStyle = '#E9CBA0';
    ctx.fillRect(ox, oy, w, h);
    ctx.fillStyle = '#1D4ED8';
    ctx.fillRect(px(6), py(6), px(88) - ox, py(128) - oy);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 5;
    ctx.strokeRect(px(6), py(6), px(88) - ox, py(128) - oy);

    ctx.beginPath();
    ctx.moveTo(px(6), py(70));
    ctx.lineTo(px(94), py(70));
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(px(50), py(70), px(10.5) - ox, py(10.5) - oy, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Top D-arc
    ctx.beginPath();
    ctx.ellipse(px(50), py(6), px(23) - ox, py(19) - oy, 0, 0, Math.PI);
    ctx.fillStyle = 'rgba(15,23,42,0.16)';
    ctx.fill();
    ctx.stroke();
    ctx.strokeRect(px(43), py(3), px(14) - ox, py(3) - oy);

    // Bottom D-arc
    ctx.beginPath();
    ctx.ellipse(px(50), py(134), px(23) - ox, py(19) - oy, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeRect(px(43), py(134), px(14) - ox, py(3) - oy);
  } else if (sport === 'basquete') {
    ctx.fillStyle = '#F1D4A6';
    ctx.fillRect(ox, oy, w, h);
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 4;
    ctx.strokeRect(px(5), py(5), px(90) - ox, py(130) - oy);
    ctx.beginPath();
    ctx.moveTo(px(5), py(70));
    ctx.lineTo(px(95), py(70));
    ctx.stroke();

    ctx.fillStyle = 'rgba(15, 118, 110, 0.85)';
    ctx.fillRect(px(36), py(5), px(28) - ox, py(26) - oy);
    ctx.fillRect(px(36), py(109), px(28) - ox, py(26) - oy);
    ctx.strokeStyle = '#FFFFFF';
    ctx.strokeRect(px(36), py(5), px(28) - ox, py(26) - oy);
    ctx.strokeRect(px(36), py(109), px(28) - ox, py(26) - oy);

    ctx.strokeStyle = '#0F172A';
    ctx.beginPath();
    ctx.ellipse(px(50), py(70), px(11) - ox, py(11) - oy, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Volei
    ctx.fillStyle = '#BAE6FD';
    ctx.fillRect(ox, oy, w, h);
    ctx.fillStyle = '#FDE68A';
    ctx.fillRect(px(8), py(8), px(84) - ox, py(124) - oy);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
    ctx.fillRect(px(8), py(48), px(84) - ox, py(44) - oy);

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 5;
    ctx.strokeRect(px(8), py(8), px(84) - ox, py(124) - oy);
    ctx.beginPath();
    ctx.moveTo(px(8), py(48));
    ctx.lineTo(px(92), py(48));
    ctx.moveTo(px(8), py(92));
    ctx.lineTo(px(92), py(92));
    ctx.stroke();

    ctx.save();
    ctx.setLineDash([12, 8]);
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(px(4), py(70));
    ctx.lineTo(px(96), py(70));
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawArrows(ctx: CanvasRenderingContext2D, arrows: PlayArrow[]) {
  arrows.forEach((arrow) => {
    const x1 = (arrow.fromX / 100) * CANVAS_W;
    const y1 = HEADER_H + (arrow.fromY / 100) * PITCH_H;
    const x2 = (arrow.toX / 100) * CANVAS_W;
    const y2 = HEADER_H + (arrow.toY / 100) * PITCH_H;

    const color =
      arrow.kind === 'shot' ? '#FB7185' : arrow.kind === 'run' ? '#FBBF24' : '#FFFFFF';

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    if (arrow.kind === 'run') {
      ctx.setLineDash([14, 12]);
    }
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Arrowhead
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = 20;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
}

function drawTokensAndBall(
  ctx: CanvasRenderingContext2D,
  tokens: PlayTokenPos[],
  ballX: number,
  ballY: number
) {
  // Draw tokens
  tokens.forEach((tok) => {
    const cx = (tok.x / 100) * CANVAS_W;
    const cy = HEADER_H + (tok.y / 100) * PITCH_H;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.fillStyle = tok.isCaptain ? '#FEF3C7' : '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = tok.isCaptain ? '#D97706' : '#0F172A';
    ctx.stroke();

    // Jersey number
    ctx.fillStyle = '#0F172A';
    ctx.font = '800 22px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(tok.jerseyNumber || ''), cx, cy + 1);

    // Captain armband badge
    if (tok.isCaptain) {
      ctx.beginPath();
      ctx.arc(cx + 20, cy - 20, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#F59E0B';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
      ctx.fillStyle = '#0F172A';
      ctx.font = '800 12px system-ui, sans-serif';
      ctx.fillText('C', cx + 20, cy - 19);
    }

    // Label pill under token
    const shortName = tok.label.split(' ')[0].slice(0, 10);
    ctx.font = '700 14px system-ui, sans-serif';
    const textW = Math.max(48, ctx.measureText(shortName).width + 16);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(cx - textW / 2, cy + 30, textW, 24, 6);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(shortName, cx, cy + 43);
    ctx.restore();
  });

  // Draw ball
  const bx = (ballX / 100) * CANVAS_W;
  const by = HEADER_H + (ballY / 100) * PITCH_H;
  ctx.save();
  ctx.beginPath();
  ctx.arc(bx, by, 17, 0, Math.PI * 2);
  ctx.fillStyle = '#FACC15';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#0F172A';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(bx - 4, by - 4, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.restore();
}

function drawChrome(
  ctx: CanvasRenderingContext2D,
  teamName: string,
  playTitle: string,
  category: string,
  stepLabel: string,
  note: string
) {
  // Header bar
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, CANVAS_W, HEADER_H);
  ctx.fillStyle = '#059669';
  ctx.fillRect(28, 20, 48, 48);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('M', 52, 45);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#059669';
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillText(`${teamName.toUpperCase()} · ${category.toUpperCase()}`, 92, 31);

  ctx.fillStyle = '#0F172A';
  ctx.font = '800 24px system-ui, sans-serif';
  ctx.fillText(playTitle.slice(0, 42), 92, 60);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#334155';
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.fillText(stepLabel, CANVAS_W - 28, 45);

  // Footer bar
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, HEADER_H + PITCH_H, CANVAS_W, FOOTER_H);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#F8FAFC';
  ctx.font = '600 18px system-ui, sans-serif';
  ctx.fillText(
    note ? note.slice(0, 74) : 'Quadro de Jogadas · Meu Time Estúdio Tático',
    28,
    HEADER_H + PITCH_H + 44
  );
}

function renderPlayFrameToCanvas(
  canvas: HTMLCanvasElement,
  sport: SportId,
  teamName: string,
  playTitle: string,
  category: string,
  frame: PlayFrame
) {
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  drawPitchBackground(ctx, sport);
  drawArrows(ctx, frame.arrows);
  drawTokensAndBall(ctx, frame.tokens, frame.ballX, frame.ballY);
  drawChrome(ctx, teamName, playTitle, category, frame.label, frame.note);
}

export async function exportPlayPhotoPng(params: {
  sport: SportId;
  teamName: string;
  playTitle: string;
  category: string;
  frame: PlayFrame;
}): Promise<void> {
  const canvas = document.createElement('canvas');
  renderPlayFrameToCanvas(
    canvas,
    params.sport,
    params.teamName,
    params.playTitle,
    params.category,
    params.frame
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  );
  if (!blob) {
    throw new Error('Não foi possível gerar a imagem PNG da jogada.');
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const slug = params.playTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '') || 'jogada';
  a.href = url;
  a.download = `${slug}-meu-time.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export async function exportPlayVideo(params: {
  sport: SportId;
  teamName: string;
  playTitle: string;
  category: string;
  frames: PlayFrame[];
  onProgress?: (pct: number) => void;
}): Promise<{ extension: 'mp4' | 'webm' }> {
  if (params.frames.length === 0) {
    throw new Error('Adicione pelo menos 1 passo na jogada para exportar vídeo.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
    throw new Error('Seu navegador não suporta exportação de vídeo. Use Exportar Foto (PNG).');
  }

  const mimeCandidates: { mime: string; ext: 'mp4' | 'webm' }[] = [
    { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
    { mime: 'video/mp4', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
  ];

  const chosen =
    mimeCandidates.find((c) => MediaRecorder.isTypeSupported(c.mime)) ||
    { mime: 'video/webm', ext: 'webm' as const };

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported(chosen.mime) ? chosen.mime : undefined,
    videoBitsPerSecond: 3_500_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) {
      chunks.push(ev.data);
    }
  };

  const stopped = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: chosen.mime }));
    };
  });

  recorder.start(100);

  const framesList =
    params.frames.length === 1 ? [params.frames[0], params.frames[0]] : params.frames;
  const stepsPerTransition = 36; // 1.2s at 30fps
  const holdSteps = 18; // 0.6s hold at each keyframe
  const totalTicks = (framesList.length - 1) * (stepsPerTransition + holdSteps) + holdSteps;
  let currentTick = 0;

  const waitFrame = () => new Promise<void>((r) => window.setTimeout(r, 33));

  for (let s = 0; s < framesList.length - 1; s += 1) {
    const fA = framesList[s];
    const fB = framesList[s + 1];

    // Hold fA
    for (let h = 0; h < holdSteps; h += 1) {
      renderPlayFrameToCanvas(
        canvas,
        params.sport,
        params.teamName,
        params.playTitle,
        params.category,
        fA
      );
      currentTick += 1;
      params.onProgress?.(Math.round((currentTick / totalTicks) * 100));
      await waitFrame();
    }

    // Interpolate fA -> fB
    const bMap = new Map<string, PlayTokenPos>(fB.tokens.map((t) => [t.id, t]));
    for (let k = 1; k <= stepsPerTransition; k += 1) {
      const t = easeInOut(k / stepsPerTransition);
      const interpTokens: PlayTokenPos[] = fA.tokens.map((ta) => {
        const tb = bMap.get(ta.id) || ta;
        return {
          ...ta,
          x: ta.x + (tb.x - ta.x) * t,
          y: ta.y + (tb.y - ta.y) * t,
        };
      });
      const interpFrame: PlayFrame = {
        id: fA.id,
        label: `${fA.label} → ${fB.label}`,
        note: fB.note || fA.note,
        ballX: fA.ballX + (fB.ballX - fA.ballX) * t,
        ballY: fA.ballY + (fB.ballY - fA.ballY) * t,
        tokens: interpTokens,
        arrows: t < 0.5 ? fA.arrows : fB.arrows,
      };
      renderPlayFrameToCanvas(
        canvas,
        params.sport,
        params.teamName,
        params.playTitle,
        params.category,
        interpFrame
      );
      currentTick += 1;
      params.onProgress?.(Math.round((currentTick / totalTicks) * 100));
      await waitFrame();
    }
  }

  // Final hold on last frame
  const lastFrame = framesList[framesList.length - 1];
  for (let h = 0; h < holdSteps; h += 1) {
    renderPlayFrameToCanvas(
      canvas,
      params.sport,
      params.teamName,
      params.playTitle,
      params.category,
      lastFrame
    );
    currentTick += 1;
    params.onProgress?.(Math.min(100, Math.round((currentTick / totalTicks) * 100)));
    await waitFrame();
  }

  recorder.stop();
  const blob = await stopped;
  stream.getTracks().forEach((tr) => tr.stop());

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const slug = params.playTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '') || 'jogada';
  a.href = url;
  a.download = `${slug}-meu-time.${chosen.ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { extension: chosen.ext };
}
