import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const CLIP_DIR = path.join(os.tmpdir(), 'meu-time-clips');
interface ClipEntry {
  filePath: string;
  mimeType: string;
  size: number;
  createdAt: number;
}
const clipRegistry = new Map<string, ClipEntry>();

function cleanupExpiredClips() {
  const cutoff = Date.now() - 20 * 60 * 1000;
  for (const [id, entry] of clipRegistry.entries()) {
    if (entry.createdAt < cutoff) {
      clipRegistry.delete(id);
      fs.unlink(entry.filePath, () => undefined);
    }
  }
}

function removeClip(clipId: string) {
  const entry = clipRegistry.get(clipId);
  if (entry) {
    clipRegistry.delete(clipId);
    fs.unlink(entry.filePath, () => undefined);
  }
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no ambiente do servidor.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isTransientAiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  return /\b(429|500|502|503|504)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded|ETIMEDOUT|ECONNRESET|fetch failed/i.test(
    msg
  );
}

function formatFriendlyAiError(err: unknown, fallbackMsg: string): string {
  const raw = err instanceof Error ? err.message : String(err || '');
  console.error('[AI Error]', raw);
  if (/GEMINI_API_KEY/i.test(raw)) {
    return 'Chave da IA não configurada no painel Settings > Secrets do servidor.';
  }
  if (/PERMISSION_DENIED|API_KEY_INVALID|API key not valid|403|401/i.test(raw)) {
    return 'Chave da API Gemini inválida ou sem permissão. Verifique sua chave no painel Settings > Secrets.';
  }
  if (/503|UNAVAILABLE|high demand|overloaded/i.test(raw)) {
    return 'Os servidores da IA estão com alta demanda agora. Aguarde alguns segundos e tente novamente.';
  }
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(raw)) {
    return 'Limite temporário de requisições da IA atingido. Tente novamente em instantes.';
  }
  if (/INVALID_ARGUMENT|400/i.test(raw) && /mime|video|file|size|unsupported/i.test(raw)) {
    return 'Formato ou tamanho de vídeo não suportado pela IA. Envie um MP4/MOV curto (10–30s).';
  }
  if (raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } };
      if (parsed?.error?.message) return parsed.error.message;
    } catch {
      // ignore JSON parse failure
    }
  }
  return raw || fallbackMsg;
}

function parseJsonSafely<T>(rawText: string | undefined): T {
  const cleaned = String(rawText || '')
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  if (!cleaned) return {} as T;
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new Error('A IA retornou uma resposta inválida. Tente novamente.');
  }
}

async function generateContentWithResilience(
  ai: GoogleGenAI,
  options: {
    primaryModel: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';
    fallbackModel?: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';
    contents: unknown;
    config?: Record<string, unknown>;
    validate?: (text: string | undefined) => boolean;
  }
) {
  const modelsToTry: Array<'gemini-4-hydrogen' | 'gemini-3.1-flash-lite'> = [
    options.primaryModel,
    ...(options.fallbackModel && options.fallbackModel !== options.primaryModel
      ? [options.fallbackModel]
      : []),
  ];

  let lastError: unknown;
  for (const model of modelsToTry) {
    const modelConfig = { ...(options.config || {}) };
    if (model === 'gemini-3.1-flash-lite' && 'thinkingConfig' in modelConfig) {
      delete modelConfig.thinkingConfig;
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: options.contents as Parameters<typeof ai.models.generateContent>[0]['contents'],
          config: modelConfig as Parameters<typeof ai.models.generateContent>[0]['config'],
        });
        if (options.validate && !options.validate(res.text)) {
          throw new Error('Resposta incompleta da IA.');
        }
        return res;
      } catch (err) {
        lastError = err;
        const retryable = isTransientAiError(err) || (err instanceof Error && err.message === 'Resposta incompleta da IA.');
        if (!retryable) {
          throw err;
        }
        if (attempt < 1) {
          const waitMs = 500 + Math.floor(Math.random() * 250);
          await new Promise((r) => setTimeout(r, waitMs));
        }
      }
    }
  }
  throw lastError;
}

function clampCoord(val: unknown, fallback = 50): number {
  const num = typeof val === 'number' && Number.isFinite(val) ? val : fallback;
  return Math.round(Math.max(8, Math.min(92, num)) * 10) / 10;
}

async function buildVideoPartsForGemini(
  ai: GoogleGenAI,
  clips: { entry: ClipEntry; label: string }[]
): Promise<{
  parts: Array<Record<string, unknown>>;
  uploadedFileNames: string[];
}> {
  const totalBytes = clips.reduce((acc, c) => acc + c.entry.size, 0);
  // Base64 expands payload by ~33%, so keep inlineData strictly <= 12 MB raw (~16 MB JSON)
  const useInline = totalBytes <= 12 * 1024 * 1024;
  const parts: Array<Record<string, unknown>> = [];
  const uploadedFileNames: string[] = [];

  for (const { entry, label } of clips) {
    parts.push({ text: `Vídeo enviado para: ${label}` });
    if (useInline) {
      const buf = await fs.promises.readFile(entry.filePath);
      parts.push({
        inlineData: {
          mimeType: entry.mimeType,
          data: buf.toString('base64'),
        },
      });
    } else {
      const uploaded = await ai.files.upload({
        file: entry.filePath,
        config: { mimeType: entry.mimeType },
      });
      if (uploaded.name) {
        uploadedFileNames.push(uploaded.name);
      }
      let currentFile = uploaded;
      let attempts = 0;
      while (currentFile.state === 'PROCESSING' && attempts < 25 && currentFile.name) {
        await new Promise((r) => setTimeout(r, 1500));
        currentFile = await ai.files.get({ name: currentFile.name });
        attempts += 1;
      }
      if (currentFile.state === 'FAILED' || !currentFile.uri) {
        throw new Error(`Não foi possível processar o vídeo "${label}". Envie um clipe menor ou em MP4.`);
      }
      parts.push({
        fileData: {
          fileUri: currentFile.uri,
          mimeType: currentFile.mimeType || entry.mimeType,
        },
      });
    }
  }

  return { parts, uploadedFileNames };
}

function isAllowedCorsOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    if (parsed.protocol === 'https:' && parsed.hostname.endsWith('.github.io')) {
      return true;
    }
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return true;
    }
    if (process.env.APP_URL) {
      const appUrlOrigin = new URL(process.env.APP_URL).origin;
      if (origin === appUrlOrigin) return true;
    }
    const extra = (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return extra.includes(origin);
  } catch {
    return false;
  }
}

async function startServer() {
  await fs.promises.mkdir(CLIP_DIR, { recursive: true });
  const app = express();
  const httpServer = http.createServer(app);

  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (typeof origin === 'string' && isAllowedCorsOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Clip-Mime');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Raw binary video clip upload (avoids JSON base64 overhead and payload limits)
  app.post(
    '/api/ai/upload-clip',
    express.raw({ type: '*/*', limit: '38mb' }),
    async (req, res) => {
      try {
        cleanupExpiredClips();
        const rawBody = req.body;
        if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
          res.status(400).json({ error: 'Arquivo de vídeo vazio ou inválido.' });
          return;
        }
        const headerMime = String(req.headers['x-clip-mime'] || 'video/mp4')
          .split(';')[0]
          .trim()
          .toLowerCase();
        const mimeType = headerMime.startsWith('video/') ? headerMime : 'video/mp4';

        const clipId = `clip_${crypto.randomBytes(10).toString('hex')}`;
        const filePath = path.join(CLIP_DIR, clipId);
        await fs.promises.writeFile(filePath, rawBody);

        clipRegistry.set(clipId, {
          filePath,
          mimeType,
          size: rawBody.length,
          createdAt: Date.now(),
        });

        res.json({ clipId, mimeType, size: rawBody.length });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao enviar vídeo.';
        res.status(500).json({ error: message });
      }
    }
  );

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'meu-time' });
  });

  // Low-latency tactical suggestions using gemini-3.1-flash-lite
  app.post('/api/ai/quick-tip', async (req, res) => {
    try {
      const { teamName, sport, formation, rosterSummary, question } = req.body ?? {};
      const ai = getGeminiClient();

      const prompt = [
        `Time: ${String(teamName || 'Meu Time')}`,
        `Esporte: ${String(sport || 'futebol')}`,
        `Formação: ${String(formation || 'padrão')}`,
        `Elenco atual: ${String(rosterSummary || 'Sem jogadores detalhados')}`,
        `Solicitação do técnico/jogador: ${String(question || 'Dê uma dica rápida e objetiva de posicionamento para o próximo jogo.')}`,
      ].join('\n');

      const response = await generateContentWithResilience(ai, {
        primaryModel: 'gemini-3.1-flash-lite',
        fallbackModel: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'Você é um assistente técnico esportivo objetivo no estúdio Meu Time. Responda em português do Brasil, em no máximo 3 frases curtas e diretas, sem markdown excessivo.',
        },
      });

      res.json({ text: response.text ?? 'Sem resposta gerada no momento.' });
    } catch (error) {
      res.status(500).json({ error: formatFriendlyAiError(error, 'Erro ao consultar assistente rápido.') });
    }
  });

  // Deep tactical analysis using gemini-4-hydrogen with ThinkingLevel.HIGH (fallback gemini-3.1-flash-lite)
  app.post('/api/ai/tactical-analysis', async (req, res) => {
    try {
      const { teamName, sport, formation, rosterSummary, matchContext, question } = req.body ?? {};
      const ai = getGeminiClient();

      const prompt = [
        `Time: ${String(teamName || 'Meu Time')}`,
        `Esporte: ${String(sport || 'futebol')}`,
        `Formação tática: ${String(formation || 'padrão')}`,
        `Jogadores e posições: ${String(rosterSummary || 'Não informado')}`,
        `Contexto da partida: ${String(matchContext || 'Treino / Preparação geral')}`,
        `Questão tática: ${String(question || 'Faça uma análise tática completa: pontos fortes da escalação, ajustes defensivos/ofensivos, gestão de cartões/faltas e recomendações de substituição.')}`,
      ].join('\n');

      const response = await generateContentWithResilience(ai, {
        primaryModel: 'gemini-4-hydrogen',
        fallbackModel: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
          systemInstruction:
            'Você é um diretor técnico e analista de desempenho esportivo no estúdio Meu Time. Responda em português do Brasil com clareza, estrutura tática prática (Organização Defensiva, Transição, Bola Parada/Ataque e Ajustes Imediatos) e baseie-se estritamente nos jogadores, números de camisa, OVRs e dados informados.',
        },
      });

      res.json({ text: response.text ?? 'Análise concluída sem conteúdo textual.' });
    } catch (error) {
      res.status(500).json({ error: formatFriendlyAiError(error, 'Erro ao executar análise tática profunda.') });
    }
  });

  // Sincere Multimodal OVR Video Evaluation
  app.post('/api/ai/evaluate-over', async (req, res) => {
    const { sport, position, playerName, drills } = req.body ?? {};
    const drillList = Array.isArray(drills) ? drills : [];
    if (drillList.length === 0) {
      res.status(400).json({ error: 'Envie pelo menos 1 vídeo de fundamento para avaliar o Over.' });
      return;
    }

    const resolvedClips: { entry: ClipEntry; label: string }[] = [];
    const clipIdsToCleanup: string[] = [];

    for (const d of drillList) {
      const clipId = String(d?.clipId || '');
      const entry = clipRegistry.get(clipId);
      if (!entry) {
        res.status(400).json({ error: 'Um dos vídeos enviados expirou ou não foi encontrado. Envie novamente.' });
        return;
      }
      clipIdsToCleanup.push(clipId);
      resolvedClips.push({
        entry,
        label: `${String(d?.title || 'Fundamento')} (Foco: ${String(d?.focusAttribute || 'Técnica geral')})`,
      });
    }

    let uploadedFileNames: string[] = [];
    let ai: GoogleGenAI | null = null;

    try {
      ai = getGeminiClient();
      const built = await buildVideoPartsForGemini(ai, resolvedClips);
      uploadedFileNames = built.uploadedFileNames;

      const rubricText = [
        `Atleta avaliado: ${String(playerName || 'Jogador')}`,
        `Esporte: ${String(sport || 'futebol')}`,
        `Posição específica: ${String(position || 'Geral')}`,
        'Avalie os vídeos anexados com TOTAL SINCERIDADE de um olheiro/treinador profissional. Nunca infle a nota por gentileza!',
        'Escala sincera de OVR (35 a 99):',
        '- 35–52: Vídeo sem execução esportiva real da posição, muito curto/escuro/sem bola ou com erros técnicos graves de controle/postura.',
        '- 53–64: Nível iniciante/em desenvolvimento, pouca firmeza no contato, ritmo lento ou baixa precisão.',
        '- 65–74: Bom nível amador/competitivo, executa os fundamentos corretos mas ainda pode ganhar velocidade e refino.',
        '- 75–83: Muito bom nível técnico, execução limpa, bom equilíbrio corporal, ritmo forte e precisão.',
        '- 84–92: Excelente / destaque técnico de alto rendimento nos fundamentos filmados.',
        '- 93–99: Excepcional em todos os ângulos (raríssimo).',
        'Retorne:',
        '1) ovr (inteiro entre 35 e 99, fiel à média ponderada dos atributos e à posição);',
        '2) attributes: exatamente 5 atributos relevantes para essa posição/esporte (ex: Passe, Chute, Drible, Visão, Físico; ou Reflexo, Reposição, Jogo com Pés, Posicionamento, Elasticidade para Goleiro) cada um com score inteiro de 35 a 99;',
        '3) sincereFeedback: avaliação sincera, direta e construtiva explicando pontos fortes reais e falhas observadas nos vídeos (máx 450 caracteres);',
        '4) recommendedExercises: 3 ou 4 exercícios práticos específicos para corrigir as deficiências vistas e subir o Over (máx 180 caracteres cada).',
      ].join('\n');

      const response = await generateContentWithResilience(ai, {
        primaryModel: 'gemini-4-hydrogen',
        fallbackModel: 'gemini-3.1-flash-lite',
        contents: {
          parts: [...built.parts, { text: rubricText }],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          systemInstruction:
            'Você é um avaliador técnico esportivo rigoroso e sincero no Meu Time. Analise o vídeo quadro a quadro e dê notas verdadeiras em português do Brasil.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            required: ['ovr', 'attributes', 'sincereFeedback', 'recommendedExercises'],
            properties: {
              ovr: { type: Type.INTEGER, description: 'Nota OVR sincera entre 35 e 99' },
              attributes: {
                type: Type.ARRAY,
                description: 'Lista com 5 atributos técnicos avaliados',
                items: {
                  type: Type.OBJECT,
                  required: ['name', 'score'],
                  properties: {
                    name: { type: Type.STRING },
                    score: { type: Type.INTEGER },
                  },
                },
              },
              sincereFeedback: { type: Type.STRING },
              recommendedExercises: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
        },
        validate: (txt) => {
          try {
            const p = parseJsonSafely<{ ovr?: number; attributes?: unknown[] }>(txt);
            return typeof p.ovr === 'number' && Array.isArray(p.attributes) && p.attributes.length > 0;
          } catch {
            return false;
          }
        },
      });

      const parsed = parseJsonSafely<{
        ovr?: number;
        attributes?: Array<{ name?: string; score?: number }>;
        sincereFeedback?: string;
        recommendedExercises?: string[];
      }>(response.text);

      const rawOvr = Number(parsed.ovr);
      const ovr = Number.isFinite(rawOvr) ? Math.max(35, Math.min(99, Math.round(rawOvr))) : 60;

      const attrMap: Record<string, number> = {};
      (Array.isArray(parsed.attributes) ? parsed.attributes : []).slice(0, 6).forEach((item) => {
        const key = String(item?.name || '').trim().slice(0, 28);
        const val = Number(item?.score);
        if (key && Number.isFinite(val)) {
          attrMap[key] = Math.max(35, Math.min(99, Math.round(val)));
        }
      });

      const exercises = (Array.isArray(parsed.recommendedExercises) ? parsed.recommendedExercises : [])
        .map((s) => String(s || '').trim().slice(0, 200))
        .filter(Boolean)
        .slice(0, 5);

      res.json({
        ovr,
        attributes: attrMap,
        sincereFeedback: String(
          parsed.sincereFeedback || 'Avaliação técnica concluída com base nos vídeos enviados.'
        ).slice(0, 580),
        recommendedExercises:
          exercises.length > 0
            ? exercises
            : ['Pratique 15 min diários de controle e passe direcionado com os dois lados para consolidar base.'],
      });
    } catch (error) {
      res.status(500).json({ error: formatFriendlyAiError(error, 'Erro ao analisar vídeo para o Over.') });
    } finally {
      clipIdsToCleanup.forEach(removeClip);
      if (ai) {
        for (const name of uploadedFileNames) {
          ai.files.delete({ name }).catch(() => undefined);
        }
      }
    }
  });

  // Manual Lesson Practical Video Proof (can improve existing OVR if genuinely earned)
  app.post('/api/ai/evaluate-manual-video', async (req, res) => {
    const { sport, position, lessonTitle, teachingBody, tacticalCue, currentOvr, clipId } = req.body ?? {};
    const entry = clipRegistry.get(String(clipId || ''));
    if (!entry) {
      res.status(400).json({ error: 'Vídeo não encontrado ou expirado. Selecione o vídeo novamente.' });
      return;
    }

    let uploadedFileNames: string[] = [];
    let ai: GoogleGenAI | null = null;

    try {
      ai = getGeminiClient();
      const built = await buildVideoPartsForGemini(ai, [
        { entry, label: `Prova prática da lição: ${String(lessonTitle || 'Treino')}` },
      ]);
      uploadedFileNames = built.uploadedFileNames;

      const numericOvr = typeof currentOvr === 'number' && currentOvr > 0 ? Math.round(currentOvr) : 0;

      const promptText = [
        `Esporte: ${String(sport || 'futebol')} · Posição: ${String(position || 'Geral')}`,
        `Lição do Manual: ${String(lessonTitle || '')}`,
        `Conteúdo ensinado: ${String(teachingBody || '')}`,
        `Foco técnico (Dica Prática): ${String(tacticalCue || '')}`,
        `OVR atual do jogador: ${numericOvr > 0 ? numericOvr : 'Ainda não fez o Teste de Over'}`,
        'Avalie com SINCERIDADE se o vídeo realmente prova que o atleta sabe executar o que a lição ensinou:',
        '- passed: true apenas se o vídeo mostrar o atleta executando o movimento/conceito com clareza razoável; false se não corresponder ao treino, estiver sem ação ou com erro técnico evidente.',
        '- techniqueScore: nota sincera de 0 a 100 da execução.',
        '- sincereFeedback: explicação sincera e objetiva do que acertou e do que falta ajustar (máx 450 caracteres).',
        '- recommendedExercises: 2 ou 3 exercícios práticos para aperfeiçoar o fundamento (máx 180 caracteres cada).',
        '- shouldIncreaseOvr e ovrDelta (0, 1 ou 2): se o atleta já tem OVR (> 0) e demonstrou execução realmente sólida (techniqueScore >= 72), decida sinceramente se sobe +1 (ou +2 se excepcional) ou 0 se precisa consolidar mais. Se ainda não tem OVR, retorne shouldIncreaseOvr=false e ovrDelta=0.',
      ].join('\n');

      const response = await generateContentWithResilience(ai, {
        primaryModel: 'gemini-4-hydrogen',
        fallbackModel: 'gemini-3.1-flash-lite',
        contents: {
          parts: [...built.parts, { text: promptText }],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          systemInstruction:
            'Você é um instrutor técnico rigoroso do Manual Meu Time. Seja sincero, nunca aprove vídeo sem relação com o treino ou sem execução real.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            required: ['passed', 'techniqueScore', 'sincereFeedback', 'recommendedExercises', 'shouldIncreaseOvr', 'ovrDelta'],
            properties: {
              passed: { type: Type.BOOLEAN },
              techniqueScore: { type: Type.INTEGER },
              sincereFeedback: { type: Type.STRING },
              recommendedExercises: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              shouldIncreaseOvr: { type: Type.BOOLEAN },
              ovrDelta: { type: Type.INTEGER },
            },
          },
        },
      });

      const parsed = parseJsonSafely<{
        passed?: boolean;
        techniqueScore?: number;
        sincereFeedback?: string;
        recommendedExercises?: string[];
        shouldIncreaseOvr?: boolean;
        ovrDelta?: number;
      }>(response.text);

      const passed = Boolean(parsed.passed);
      const techniqueScore = Math.max(0, Math.min(100, Math.round(Number(parsed.techniqueScore) || 0)));
      const rawDelta = Math.max(0, Math.min(2, Math.round(Number(parsed.ovrDelta) || 0)));

      const canBump = numericOvr > 0 && numericOvr < 99 && passed && techniqueScore >= 72 && Boolean(parsed.shouldIncreaseOvr) && rawDelta > 0;
      const finalDelta = canBump ? Math.min(rawDelta, 99 - numericOvr) : 0;

      const exercises = (Array.isArray(parsed.recommendedExercises) ? parsed.recommendedExercises : [])
        .map((s) => String(s || '').trim().slice(0, 200))
        .filter(Boolean)
        .slice(0, 4);

      res.json({
        passed,
        techniqueScore,
        sincereFeedback: String(
          parsed.sincereFeedback || 'Vídeo analisado pela comissão técnica de IA.'
        ).slice(0, 500),
        recommendedExercises:
          exercises.length > 0
            ? exercises
            : ['Repita o fundamento em câmera lenta focando postura e controle antes de acelerar.'],
        shouldIncreaseOvr: canBump,
        ovrDelta: finalDelta,
      });
    } catch (error) {
      res.status(500).json({ error: formatFriendlyAiError(error, 'Erro ao analisar vídeo do treino no Manual.') });
    } finally {
      removeClip(String(clipId || ''));
      if (ai) {
        for (const name of uploadedFileNames) {
          ai.files.delete({ name }).catch(() => undefined);
        }
      }
    }
  });

  // AI Lineup & Reserve & Captain Generator (supports full-squad OVR recommendation)
  app.post('/api/ai/generate-lineup', async (req, res) => {
    try {
      const {
        teamName,
        sport,
        formation,
        availableFormations,
        availablePositions,
        startersCount,
        athletes,
        stylePrompt,
        useOvrRecommendation,
      } = req.body ?? {};

      const athleteList = Array.isArray(athletes) ? athletes : [];
      if (athleteList.length === 0) {
        res.status(400).json({ error: 'Adicione pelo menos 1 atleta antes de gerar escalação com IA.' });
        return;
      }

      const ai = getGeminiClient();
      const targetStarters = Math.min(
        athleteList.length,
        Math.max(1, Number(startersCount) || 5)
      );

      const prompt = [
        `Time: ${String(teamName || 'Meu Time')}`,
        `Esporte: ${String(sport || 'futebol')}`,
        `Formação atual: ${String(formation || '')}`,
        `Formações válidas para escolher: ${(Array.isArray(availableFormations) ? availableFormations : []).join(', ')}`,
        `Posições oficiais válidas: ${(Array.isArray(availablePositions) ? availablePositions : []).join(', ')}`,
        `Número máximo de titulares em quadra/campo: ${targetStarters}`,
        `Modo de seleção: ${useOvrRecommendation ? 'RECOMENDAÇÃO OFICIAL BASEADA EM OVR — Todos os atletas já possuem OVR avaliado por vídeo. Escale o melhor time titular possível priorizando os maiores OVRs e equilíbrio tático por setor, colocando os demais como reservas estratégicos e explicando claramente no resumo por que cada setor foi montado assim.' : 'Escalação tática geral.'}`,
        `Objetivo do técnico/jogador: ${String(stylePrompt || 'Equilibrar defesa, meio/criação e ataque usando titulares e reservas ideais, escolhendo também o Capitão do time.')}`,
        `Atletas disponíveis (JSON com id, name, jerseyNumber, position, ovrRating, ovrStats): ${JSON.stringify(athleteList)}`,
        'Retorne TODOS os atletas em assignments: defina exatamente até targetStarters como isStarter=true e os restantes como isStarter=false (escalação reserva). Coordenadas X (esquerda->direita 12..88) e Y (ataque topo 15..35, meio 40..62, goleiro/defesa fundo 68..89). Escolha um captainMemberId dentre os IDs disponíveis.',
      ].join('\n');

      const response = await generateContentWithResilience(ai, {
        primaryModel: 'gemini-4-hydrogen',
        fallbackModel: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          systemInstruction:
            'Você é um técnico esportivo de alto nível. Gere uma escalação tática completa em português do Brasil usando exclusivamente os memberId, formações e posições fornecidas.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            required: ['formation', 'captainMemberId', 'summary', 'assignments'],
            properties: {
              formation: { type: Type.STRING },
              captainMemberId: { type: Type.STRING },
              summary: { type: Type.STRING },
              assignments: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  required: ['memberId', 'isStarter', 'position', 'posX', 'posY'],
                  properties: {
                    memberId: { type: Type.STRING },
                    isStarter: { type: Type.BOOLEAN },
                    position: { type: Type.STRING },
                    posX: { type: Type.NUMBER },
                    posY: { type: Type.NUMBER },
                  },
                },
              },
            },
          },
        },
        validate: (txt) => {
          try {
            const p = parseJsonSafely<{ assignments?: unknown[] }>(txt);
            return Array.isArray(p.assignments) && p.assignments.length > 0;
          } catch {
            return false;
          }
        },
      });

      const parsed = parseJsonSafely<{
        formation?: string;
        captainMemberId?: string;
        summary?: string;
        assignments?: Array<{
          memberId?: string;
          isStarter?: boolean;
          position?: string;
          posX?: number;
          posY?: number;
        }>;
      }>(response.text);

      const validFormations: string[] = Array.isArray(availableFormations) ? availableFormations : [];
      const validPositions: string[] = Array.isArray(availablePositions) ? availablePositions : [];
      const chosenFormation =
        parsed.formation && validFormations.includes(parsed.formation)
          ? parsed.formation
          : validFormations[0] || String(formation || '4-3-3');

      const rawAssignments = Array.isArray(parsed.assignments) ? parsed.assignments : [];
      const byId = new Map<string, (typeof rawAssignments)[number]>();
      rawAssignments.forEach((a) => {
        if (a?.memberId) byId.set(String(a.memberId), a);
      });

      let starterCounter = 0;
      const sanitizedAssignments = athleteList.map(
        (ath: { id: string; position: string; isStarter?: boolean; posX?: number; posY?: number }) => {
          const item = byId.get(String(ath.id));
          let wantsStarter = item?.isStarter ?? Boolean(ath.isStarter);
          if (wantsStarter && starterCounter >= targetStarters) {
            wantsStarter = false;
          }
          if (wantsStarter) starterCounter += 1;

          const pos =
            item?.position && validPositions.includes(item.position)
              ? item.position
              : ath.position;

          return {
            memberId: String(ath.id),
            isStarter: wantsStarter,
            position: pos,
            posX: clampCoord(item?.posX, ath.posX ?? 50),
            posY: clampCoord(item?.posY, ath.posY ?? 50),
          };
        }
      );

      const validAthleteIds = new Set(athleteList.map((a: { id: string }) => String(a.id)));
      const captainMemberId =
        parsed.captainMemberId && validAthleteIds.has(String(parsed.captainMemberId))
          ? String(parsed.captainMemberId)
          : sanitizedAssignments.find((a) => a.isStarter)?.memberId ||
            sanitizedAssignments[0]?.memberId ||
            '';

      res.json({
        formation: chosenFormation,
        captainMemberId,
        summary: parsed.summary || 'Escalação tática otimizada pela IA.',
        assignments: sanitizedAssignments,
      });
    } catch (error) {
      res.status(500).json({ error: formatFriendlyAiError(error, 'Erro ao gerar escalação com IA.') });
    }
  });

  // AI Animated Playbook Generator
  app.post('/api/ai/generate-play', async (req, res) => {
    try {
      const { teamName, sport, formation, tokens, playGoal } = req.body ?? {};
      const inputTokens = Array.isArray(tokens) ? tokens : [];
      if (inputTokens.length === 0) {
        res.status(400).json({ error: 'Escale pelo menos 1 jogador na prancheta para gerar a jogada com IA.' });
        return;
      }

      const ai = getGeminiClient();

      const prompt = [
        `Time: ${String(teamName || 'Meu Time')}`,
        `Esporte: ${String(sport || 'futebol')}`,
        `Formação: ${String(formation || 'padrão')}`,
        `Jogadores na prancheta (id, label, jerseyNumber, x, y atual): ${JSON.stringify(inputTokens)}`,
        `Pedido de jogada: ${String(playGoal || 'Crie uma jogada ensaiada ofensiva eficiente com triangulação, infiltração e finalização.')}`,
        'Crie exatamente 4 cenas (frames) sequenciais mostrando movimentação REAL dos jogadores e da bola:',
        '- O campo/quadra tem X de 8 (esquerda) a 92 (direita) e Y de 10 (gol/cesta/rede adversária em cima) até 90 (defesa própria embaixo).',
        '- IMPORTANTE: De um frame para o outro, movimente de verdade os jogadores participantes (deslocamentos de 12 a 28 pontos em X/Y para abrir espaço, ultrapassar ou finalizar) e avance a bola (ballX, ballY) conforme os passes.',
        '- Em cada frame inclua: label curto ("Passo 1: Saída"), note explicativa curta, ballX, ballY, a posição (x, y) de TODOS os tokens por id, e 1 a 4 setas arrows ({ fromX, fromY, toX, toY, kind }) onde kind é "pass", "run" ou "shot".',
      ].join('\n');

      const response = await generateContentWithResilience(ai, {
        primaryModel: 'gemini-4-hydrogen',
        fallbackModel: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          systemInstruction:
            'Você é um treinador tático especialista em jogadas ensaiadas. Crie animações claras, realistas, com deslocamentos evidentes dos jogadores e fáceis de entender em português do Brasil usando exclusivamente os IDs dos tokens fornecidos.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            required: ['title', 'category', 'description', 'frames'],
            properties: {
              title: { type: Type.STRING },
              category: { type: Type.STRING },
              description: { type: Type.STRING },
              frames: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  required: ['label', 'note', 'ballX', 'ballY', 'tokens', 'arrows'],
                  properties: {
                    label: { type: Type.STRING },
                    note: { type: Type.STRING },
                    ballX: { type: Type.NUMBER },
                    ballY: { type: Type.NUMBER },
                    tokens: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        required: ['id', 'x', 'y'],
                        properties: {
                          id: { type: Type.STRING },
                          x: { type: Type.NUMBER },
                          y: { type: Type.NUMBER },
                        },
                      },
                    },
                    arrows: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        required: ['fromX', 'fromY', 'toX', 'toY', 'kind'],
                        properties: {
                          fromX: { type: Type.NUMBER },
                          fromY: { type: Type.NUMBER },
                          toX: { type: Type.NUMBER },
                          toY: { type: Type.NUMBER },
                          kind: { type: Type.STRING },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        validate: (txt) => {
          try {
            const p = parseJsonSafely<{ frames?: unknown[] }>(txt);
            return Array.isArray(p.frames) && p.frames.length > 0;
          } catch {
            return false;
          }
        },
      });

      const parsed = parseJsonSafely<{
        title?: string;
        category?: string;
        description?: string;
        frames?: Array<{
          label?: string;
          note?: string;
          ballX?: number;
          ballY?: number;
          tokens?: Array<{ id?: string; x?: number; y?: number }>;
          arrows?: Array<{
            fromX?: number;
            fromY?: number;
            toX?: number;
            toY?: number;
            kind?: string;
          }>;
        }>;
      }>(response.text);

      const rawFrames = Array.isArray(parsed.frames) ? parsed.frames.slice(0, 6) : [];
      if (rawFrames.length === 0) {
        throw new Error('A IA não retornou passos válidos para a jogada.');
      }

      const validCategories = ['Ataque', 'Bola Parada', 'Contra-Ataque', 'Saída de Bola', 'Defesa'];
      const chosenCategory =
        parsed.category && validCategories.includes(parsed.category) ? parsed.category : 'Ataque';

      const frames = rawFrames.map((f, idx) => {
        const tokenMap = new Map<string, { x?: number; y?: number }>();
        (f.tokens || []).forEach((t) => {
          if (t?.id) tokenMap.set(String(t.id), t);
        });

        const mergedTokens = inputTokens.map(
          (orig: { id: string; label: string; jerseyNumber: number; isCaptain?: boolean; x: number; y: number }) => {
            const moved = tokenMap.get(String(orig.id));
            return {
              id: String(orig.id),
              label: String(orig.label),
              jerseyNumber: Number(orig.jerseyNumber) || 0,
              isCaptain: Boolean(orig.isCaptain),
              x: clampCoord(moved?.x, orig.x ?? 50),
              y: clampCoord(moved?.y, orig.y ?? 50),
            };
          }
        );

        const arrows = (Array.isArray(f.arrows) ? f.arrows : []).slice(0, 6).map((a, aIdx) => ({
          id: `arr_ai_${idx}_${aIdx}`,
          fromX: clampCoord(a.fromX, 40),
          fromY: clampCoord(a.fromY, 55),
          toX: clampCoord(a.toX, 60),
          toY: clampCoord(a.toY, 30),
          kind: a.kind === 'run' || a.kind === 'shot' ? a.kind : ('pass' as const),
        }));

        return {
          id: `frame_ai_${idx + 1}`,
          label: String(f.label || `Passo ${idx + 1}`).slice(0, 40),
          note: String(f.note || '').slice(0, 220),
          ballX: clampCoord(f.ballX, 50),
          ballY: clampCoord(f.ballY, 50),
          tokens: mergedTokens,
          arrows,
        };
      });

      res.json({
        title: String(parsed.title || 'Jogada Ensaiada IA').slice(0, 80),
        category: chosenCategory,
        description: String(parsed.description || '').slice(0, 450),
        frames,
      });
    } catch (error) {
      res.status(500).json({ error: formatFriendlyAiError(error, 'Erro ao gerar jogada com IA.') });
    }
  });

  if (!isProduction) {
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : { server: httpServer },
        ws: hmrDisabled ? false : undefined,
      },
      appType: 'spa',
    });

    if (hmrDisabled) {
      app.get('/@vite/client', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.send(`
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url) {
  return url;
}
export class ErrorOverlay extends HTMLElement {}
`);
      });
    }

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Meu Time server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
