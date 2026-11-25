import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  ArrowRight,
  BookmarkCheck,
  Camera,
  CopyPlus,
  Crown,
  Film,
  FolderOpen,
  Move,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  Users,
} from 'lucide-react';
import { db, formatFriendlyFirebaseError, handleFirestoreError, OperationType } from '../lib/firebase';
import { triggerFirstClickTip } from '../lib/firstClickCoach';
import { createClientId } from '../lib/imageUtils';
import { exportPlayPhotoPng, exportPlayVideo } from '../lib/playExporter';
import {
  isStaffPosition,
  PlayArrow,
  PlayArrowKind,
  PlayFrame,
  PlayTokenPos,
  SPORTS_CONFIG,
  Team,
  TeamMember,
  TeamPlayDoc,
} from '../types/studio';
import { SportPitchSvg } from './SportPitchSvg';

interface PlaybookStudioProps {
  team: Team;
  members: TeamMember[];
  currentMember: TeamMember | null;
  currentUserId: string;
}

type BoardTool = 'move' | 'pass' | 'run' | 'shot';

const PLAY_CATEGORIES = ['Ataque', 'Bola Parada', 'Contra-Ataque', 'Saída de Bola', 'Defesa'];

function buildInitialTokens(
  team: Team,
  members: TeamMember[]
): PlayTokenPos[] {
  const sportCfg = SPORTS_CONFIG[team.sport];
  const starters = members
    .filter((m) => !isStaffPosition(m.position) && m.isStarter)
    .sort((a, b) => a.jerseyNumber - b.jerseyNumber);
  const athletes =
    starters.length > 0
      ? starters
      : members.filter((m) => !isStaffPosition(m.position)).slice(0, sportCfg.startersCount);

  if (athletes.length > 0) {
    return athletes.map((m) => ({
      id: m.id,
      label: m.name.split(' ')[0],
      jerseyNumber: m.jerseyNumber,
      isCaptain: team.captainMemberId === m.id,
      x: m.posX,
      y: m.posY,
    }));
  }

  const slots = sportCfg.formations[team.formation] || Object.values(sportCfg.formations)[0];
  return slots.map((slot, idx) => ({
    id: `slot_${idx + 1}`,
    label: slot.label,
    jerseyNumber: idx + 1,
    isCaptain: idx === 0,
    x: slot.x,
    y: slot.y,
  }));
}

function createInitialFrame(team: Team, members: TeamMember[]): PlayFrame {
  return {
    id: createClientId('frm'),
    label: 'Passo 1: Posição Inicial',
    note: 'Posicione os jogadores, desenhe setas e adicione novos passos para animar a jogada.',
    ballX: 50,
    ballY: 54,
    tokens: buildInitialTokens(team, members),
    arrows: [],
  };
}

export const PlaybookStudio: React.FC<PlaybookStudioProps> = ({
  team,
  members,
  currentMember,
  currentUserId,
}) => {
  const sportCfg = SPORTS_CONFIG[team.sport];
  const boardRef = useRef<HTMLDivElement | null>(null);
  const isOwner = team.ownerId === currentUserId;

  const [savedPlays, setSavedPlays] = useState<TeamPlayDoc[]>([]);
  const [editingPlayId, setEditingPlayId] = useState<string | null>(null);
  const [title, setTitle] = useState('Jogada Ensaiada 1');
  const [category, setCategory] = useState<string>('Ataque');
  const [description, setDescription] = useState('');

  const [frames, setFrames] = useState<PlayFrame[]>(() => [createInitialFrame(team, members)]);
  const [activeFrameIdx, setActiveFrameIdx] = useState(0);
  const [tool, setTool] = useState<BoardTool>('move');

  const [draggingTarget, setDraggingTarget] = useState<'ball' | string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<'ball' | string | null>(null);
  const dragStartPtRef = useRef<{ x: number; y: number } | null>(null);
  const dragMovedRef = useRef(false);
  const [drawingArrow, setDrawingArrow] = useState<{
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  } | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportingType, setExportingType] = useState<'png' | 'video' | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [aiPlayGoal, setAiPlayGoal] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const hasUserEditedRef = useRef(false);

  // Sync saved plays from Firestore
  useEffect(() => {
    const path = `teams/${team.id}/plays`;
    const q = query(collection(db, 'teams', team.id, 'plays'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setSavedPlays(snap.docs.map((d) => d.data() as TeamPlayDoc));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    );
    return () => unsub();
  }, [team.id]);

  // Refresh initial frame tokens when team members load before user starts editing
  useEffect(() => {
    if (hasUserEditedRef.current || editingPlayId !== null || frames.length !== 1) return;
    const realStarters = members.filter((m) => !isStaffPosition(m.position));
    if (realStarters.length === 0) return;
    setFrames((prev) => {
      if (prev.length !== 1) return prev;
      return [{ ...prev[0], tokens: buildInitialTokens(team, members) }];
    });
  }, [members, team, editingPlayId, frames.length]);

  // Playback loop across frames
  useEffect(() => {
    if (!isPlaying) return;
    if (frames.length <= 1) {
      setIsPlaying(false);
      return;
    }
    const timer = window.setInterval(() => {
      setActiveFrameIdx((prev) => (prev + 1) % frames.length);
    }, 1450);
    return () => window.clearInterval(timer);
  }, [isPlaying, frames.length]);

  const currentFrame = frames[activeFrameIdx] || frames[0];

  const updateCurrentFrame = (updater: (prev: PlayFrame) => PlayFrame) => {
    setFrames((prev) =>
      prev.map((f, idx) => (idx === activeFrameIdx ? updater(f) : f))
    );
  };

  const getBoardCoords = (clientX: number, clientY: number) => {
    if (!boardRef.current) return { x: 50, y: 50 };
    const rect = boardRef.current.getBoundingClientRect();
    const x = Math.max(6, Math.min(94, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(6, Math.min(94, ((clientY - rect.top) / rect.height) * 100));
    return {
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
    };
  };

  // Global window pointer listeners guarantee smooth dragging even if pointer leaves token or board bounds
  useEffect(() => {
    if (!draggingTarget && !drawingArrow) return;

    const onWindowPointerMove = (e: PointerEvent) => {
      const pt = getBoardCoords(e.clientX, e.clientY);
      if (draggingTarget && tool === 'move') {
        if (dragStartPtRef.current) {
          const dist = Math.hypot(
            pt.x - dragStartPtRef.current.x,
            pt.y - dragStartPtRef.current.y
          );
          if (dist >= 1.2) {
            dragMovedRef.current = true;
          }
        }
        hasUserEditedRef.current = true;
        if (draggingTarget === 'ball') {
          updateCurrentFrame((f) => ({ ...f, ballX: pt.x, ballY: pt.y }));
        } else {
          updateCurrentFrame((f) => ({
            ...f,
            tokens: f.tokens.map((t) =>
              t.id === draggingTarget ? { ...t, x: pt.x, y: pt.y } : t
            ),
          }));
        }
        return;
      }

      if (drawingArrow && tool !== 'move') {
        setDrawingArrow((prev) => (prev ? { ...prev, toX: pt.x, toY: pt.y } : null));
      }
    };

    const finishInteraction = () => {
      if (draggingTarget) {
        if (!dragMovedRef.current) {
          // Tap without drag -> toggle selection so user can also tap destination on pitch
          setSelectedTarget((prev) => (prev === draggingTarget ? null : draggingTarget));
        } else {
          setSelectedTarget(null);
        }
        dragStartPtRef.current = null;
        dragMovedRef.current = false;
        setDraggingTarget(null);
      }

      if (drawingArrow && tool !== 'move') {
        const dist = Math.hypot(
          drawingArrow.toX - drawingArrow.fromX,
          drawingArrow.toY - drawingArrow.fromY
        );
        if (dist >= 4) {
          hasUserEditedRef.current = true;
          const newArrow: PlayArrow = {
            id: createClientId('arr'),
            fromX: drawingArrow.fromX,
            fromY: drawingArrow.fromY,
            toX: drawingArrow.toX,
            toY: drawingArrow.toY,
            kind: tool as PlayArrowKind,
          };
          updateCurrentFrame((f) => ({
            ...f,
            arrows: [...f.arrows.slice(-11), newArrow],
          }));
        }
        setDrawingArrow(null);
      }
    };

    window.addEventListener('pointermove', onWindowPointerMove, { passive: true });
    window.addEventListener('pointerup', finishInteraction);
    window.addEventListener('pointercancel', finishInteraction);

    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', finishInteraction);
      window.removeEventListener('pointercancel', finishInteraction);
    };
  }, [draggingTarget, drawingArrow, tool, activeFrameIdx]);

  const handleBoardPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPlaying) return;
    const pt = getBoardCoords(e.clientX, e.clientY);

    if (tool === 'move') {
      // Tap-to-move: if a player or ball was selected, tapping empty board moves them there!
      if (selectedTarget) {
        hasUserEditedRef.current = true;
        if (selectedTarget === 'ball') {
          updateCurrentFrame((f) => ({ ...f, ballX: pt.x, ballY: pt.y }));
        } else {
          updateCurrentFrame((f) => ({
            ...f,
            tokens: f.tokens.map((t) =>
              t.id === selectedTarget ? { ...t, x: pt.x, y: pt.y } : t
            ),
          }));
        }
        setSelectedTarget(null);
      }
      return;
    }

    e.preventDefault();
    setSelectedTarget(null);
    setDrawingArrow({ fromX: pt.x, fromY: pt.y, toX: pt.x, toY: pt.y });
  };

  const handleAddStep = () => {
    if (frames.length >= 10) {
      setErrorMsg('Limite de 10 passos por jogada atingido.');
      return;
    }
    setErrorMsg(null);
    const cloned: PlayFrame = {
      id: createClientId('frm'),
      label: `Passo ${frames.length + 1}`,
      note: '',
      ballX: currentFrame.ballX,
      ballY: currentFrame.ballY,
      tokens: currentFrame.tokens.map((t) => ({ ...t })),
      arrows: [],
    };
    const nextFrames = [...frames, cloned];
    setFrames(nextFrames);
    setActiveFrameIdx(nextFrames.length - 1);
  };

  const handleDeleteStep = () => {
    if (frames.length <= 1) return;
    const next = frames.filter((_, idx) => idx !== activeFrameIdx);
    setFrames(next);
    setActiveFrameIdx(Math.max(0, activeFrameIdx - 1));
  };

  const handleLoadLineupIntoFrame = () => {
    const tokens = buildInitialTokens(team, members);
    updateCurrentFrame((f) => ({ ...f, tokens }));
    setStatusMsg('Escalação atual carregada neste passo!');
  };

  const handleNewPlay = () => {
    setIsPlaying(false);
    setEditingPlayId(null);
    setTitle(`Jogada ${savedPlays.length + 1}`);
    setCategory('Ataque');
    setDescription('');
    setFrames([createInitialFrame(team, members)]);
    setActiveFrameIdx(0);
    setErrorMsg(null);
    setStatusMsg('Novo quadro em branco pronto.');
  };

  const handleSavePlay = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerFirstClickTip('playbook_save', currentUserId);
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMsg('Digite um título para a jogada antes de salvar.');
      return;
    }
    const serialized = JSON.stringify(frames);
    if (serialized.length > 64000) {
      setErrorMsg('Jogada muito grande para salvar. Reduza algumas setas ou passos.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setStatusMsg(null);

    const playId = editingPlayId || createClientId('play');
    const path = `teams/${team.id}/plays/${playId}`;
    const creatorName = currentMember?.name || 'Integrante';
    const creatorRole = currentMember?.position || 'Equipe';

    try {
      const existingDoc = editingPlayId
        ? savedPlays.find((p) => p.id === editingPlayId)
        : undefined;

      if (existingDoc) {
        await updateDoc(doc(db, 'teams', team.id, 'plays', playId), {
          title: cleanTitle.slice(0, 80),
          category: category.slice(0, 40),
          description: description.trim().slice(0, 500),
          frameCount: frames.length,
          framesJson: serialized,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'teams', team.id, 'plays', playId), {
          id: playId,
          teamId: team.id,
          title: cleanTitle.slice(0, 80),
          category: category.slice(0, 40),
          description: description.trim().slice(0, 500),
          sport: team.sport,
          frameCount: frames.length,
          framesJson: serialized,
          createdBy: currentUserId,
          createdByName: creatorName.slice(0, 80),
          createdByRole: creatorRole.slice(0, 40),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setEditingPlayId(playId);
      }
      setStatusMsg('Jogada salva no quadro do time!');
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.WRITE, path);
      } catch (wrapped) {
        setErrorMsg(formatFriendlyFirebaseError(wrapped));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLoadSavedPlay = (play: TeamPlayDoc) => {
    setIsPlaying(false);
    setErrorMsg(null);
    try {
      const parsed = JSON.parse(play.framesJson) as PlayFrame[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Passos inválidos nesta jogada.');
      }
      setEditingPlayId(play.id);
      setTitle(play.title);
      setCategory(play.category || 'Ataque');
      setDescription(play.description || '');
      setFrames(parsed);
      setActiveFrameIdx(0);
      setStatusMsg(`Jogada "${play.title}" carregada na prancheta.`);
    } catch {
      setErrorMsg('Não foi possível abrir esta jogada salva.');
    }
  };

  const handleDeleteSavedPlay = async (play: TeamPlayDoc) => {
    setErrorMsg(null);
    try {
      await deleteDoc(doc(db, 'teams', team.id, 'plays', play.id));
      if (editingPlayId === play.id) {
        setEditingPlayId(null);
      }
      setStatusMsg('Jogada removida.');
    } catch (err) {
      setErrorMsg(formatFriendlyFirebaseError(err));
    }
  };

  const handleGenerateAiPlay = async () => {
    triggerFirstClickTip('playbook_ai_generate', currentUserId);
    setAiLoading(true);
    setErrorMsg(null);
    setStatusMsg(null);
    setIsPlaying(false);
    try {
      const resp = await fetch('/api/ai/generate-play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName: team.name,
          sport: sportCfg.label,
          formation: team.formation,
          tokens: currentFrame.tokens,
          playGoal:
            aiPlayGoal.trim() ||
            `Crie uma jogada ensaiada ofensiva para ${sportCfg.label} aproveitando a formação ${team.formation}.`,
        }),
      });
      const data = (await resp.json()) as {
        title?: string;
        category?: string;
        description?: string;
        frames?: PlayFrame[];
        error?: string;
      };
      if (!resp.ok || data.error || !data.frames?.length) {
        throw new Error(data.error || 'Falha ao gerar jogada com a IA.');
      }
      setEditingPlayId(null);
      setTitle(data.title || 'Jogada IA');
      setCategory(data.category || 'Ataque');
      setDescription(data.description || '');
      setFrames(data.frames);
      setActiveFrameIdx(0);
      setStatusMsg('Jogada criada pela IA! Aperte ▶ Reproduzir ou Salvar.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao gerar jogada com IA.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleExportPhoto = async () => {
    setExportingType('png');
    setErrorMsg(null);
    try {
      await exportPlayPhotoPng({
        sport: team.sport,
        teamName: team.name,
        playTitle: title || 'Jogada Meu Time',
        category,
        frame: currentFrame,
      });
      setStatusMsg('Foto PNG da jogada baixada!');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao exportar PNG.');
    } finally {
      setExportingType(null);
    }
  };

  const handleExportVideo = async () => {
    setExportingType('video');
    setExportProgress(0);
    setErrorMsg(null);
    setIsPlaying(false);
    try {
      const result = await exportPlayVideo({
        sport: team.sport,
        teamName: team.name,
        playTitle: title || 'Jogada Meu Time',
        category,
        frames,
        onProgress: setExportProgress,
      });
      setStatusMsg(
        result.extension === 'mp4'
          ? 'Vídeo MP4 da jogada exportado com sucesso!'
          : 'Vídeo animado (.webm) exportado com sucesso!'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao exportar vídeo.');
    } finally {
      setExportingType(null);
      setExportProgress(0);
    }
  };

  const allArrows = useMemo(() => currentFrame.arrows, [currentFrame.arrows]);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
      {/* Left: Interactive Playbook Canvas + Animation Controls */}
      <div className="space-y-4 lg:col-span-7">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
          {/* Header & Playback/Export Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <p className="text-[11px] font-bold text-emerald-700 uppercase">
                Quadro Tático · Comissão & Jogadores
              </p>
              <h2 className="font-display text-xl font-extrabold text-slate-900 sm:text-2xl">
                {title || 'Nova Jogada'}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  triggerFirstClickTip('playbook_play', currentUserId);
                  setIsPlaying((prev) => !prev);
                }}
                disabled={frames.length < 2}
                className="btn-studio inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-3.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                <span>{isPlaying ? 'Pausar' : 'Reproduzir'}</span>
              </button>

              <button
                type="button"
                disabled={exportingType !== null}
                onClick={() => {
                  triggerFirstClickTip('playbook_export_png', currentUserId);
                  void handleExportPhoto();
                }}
                className="btn-studio inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-slate-50 px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
              >
                <Camera className="h-4 w-4 text-sky-600" />
                <span>{exportingType === 'png' ? 'Gerando...' : 'Foto PNG'}</span>
              </button>

              <button
                type="button"
                disabled={exportingType !== null}
                onClick={() => {
                  triggerFirstClickTip('playbook_export_video', currentUserId);
                  void handleExportVideo();
                }}
                className="btn-studio inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-indigo-200 border-b-[3px] border-b-indigo-300 bg-indigo-50 px-3 text-xs font-bold text-indigo-800 hover:bg-indigo-100 disabled:opacity-50 cursor-pointer"
              >
                <Film className="h-4 w-4 text-indigo-600" />
                <span>
                  {exportingType === 'video' ? `Vídeo ${exportProgress}%` : 'Vídeo MP4'}
                </span>
              </button>
            </div>
          </div>

          {/* Drawing Tools Strip */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'move', tipKey: 'playbook_move', label: 'Mover Peças', icon: <Move className="h-3.5 w-3.5" /> },
                  { id: 'pass', tipKey: 'playbook_pass', label: 'Passe', icon: <ArrowRight className="h-3.5 w-3.5" /> },
                  { id: 'run', tipKey: 'playbook_run', label: 'Corrida', icon: <ArrowRight className="h-3.5 w-3.5 text-amber-500" /> },
                  { id: 'shot', tipKey: 'playbook_shot', label: 'Chute', icon: <ArrowRight className="h-3.5 w-3.5 text-rose-500" /> },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    triggerFirstClickTip(t.tipKey, currentUserId);
                    setTool(t.id);
                    if (t.id !== 'move') setSelectedTarget(null);
                  }}
                  className={`inline-flex min-h-[36px] items-center gap-1 rounded-lg border px-2.5 text-xs font-bold transition-colors cursor-pointer ${
                    tool === t.id
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentFrame.arrows.length === 0}
                onClick={() =>
                  updateCurrentFrame((f) => ({ ...f, arrows: f.arrows.slice(0, -1) }))
                }
                title="Desfazer última seta"
                className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Desfazer</span>
              </button>
              <button
                type="button"
                disabled={currentFrame.arrows.length === 0}
                onClick={() => updateCurrentFrame((f) => ({ ...f, arrows: [] }))}
                title="Limpar setas deste passo"
                className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Limpar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerFirstClickTip('playbook_sync_lineup', currentUserId);
                  handleLoadLineupIntoFrame();
                }}
                title="Puxar posições dos titulares atuais"
                className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 cursor-pointer"
              >
                <Users className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Elenco</span>
              </button>
            </div>
          </div>

          <p className="mt-2 text-[11px] font-medium text-slate-500">
            {tool === 'move'
              ? selectedTarget
                ? 'Peça selecionada! Toque em qualquer ponto do campo para mover até lá (ou arraste direto).'
                : 'Arraste qualquer jogador ou a bola pelo campo — ou toque no jogador e toque no novo ponto.'
              : 'Arraste sobre o campo para desenhar a seta. Para mover os jogadores, volte para Mover Peças.'}
          </p>

          {/* Interactive Field/Court Play Board */}
          <div
            ref={boardRef}
            onPointerDown={handleBoardPointerDown}
            className={`relative mx-auto mt-2.5 h-[370px] w-full max-w-[540px] overflow-hidden rounded-2xl border border-slate-200 shadow-inner touch-none select-none sm:h-[420px] ${
              tool !== 'move' ? 'cursor-crosshair' : ''
            }`}
          >
            <SportPitchSvg sport={team.sport} />

            {/* Tactical Arrows Overlay SVG */}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 z-10 h-full w-full"
            >
              <defs>
                <marker id="arrowPass" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                  <path d="M0,0 L5,2.5 L0,5 Z" fill="#FFFFFF" />
                </marker>
                <marker id="arrowRun" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                  <path d="M0,0 L5,2.5 L0,5 Z" fill="#FBBF24" />
                </marker>
                <marker id="arrowShot" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                  <path d="M0,0 L5,2.5 L0,5 Z" fill="#FB7185" />
                </marker>
              </defs>

              {allArrows.map((arr) => {
                const strokeColor =
                  arr.kind === 'shot' ? '#FB7185' : arr.kind === 'run' ? '#FBBF24' : '#FFFFFF';
                const markerId =
                  arr.kind === 'shot'
                    ? 'url(#arrowShot)'
                    : arr.kind === 'run'
                      ? 'url(#arrowRun)'
                      : 'url(#arrowPass)';
                return (
                  <line
                    key={arr.id}
                    x1={arr.fromX}
                    y1={arr.fromY}
                    x2={arr.toX}
                    y2={arr.toY}
                    stroke={strokeColor}
                    strokeWidth="0.9"
                    strokeDasharray={arr.kind === 'run' ? '2 1.5' : undefined}
                    strokeLinecap="round"
                    markerEnd={markerId}
                  />
                );
              })}

              {drawingArrow && (
                <line
                  x1={drawingArrow.fromX}
                  y1={drawingArrow.fromY}
                  x2={drawingArrow.toX}
                  y2={drawingArrow.toY}
                  stroke={tool === 'shot' ? '#FB7185' : tool === 'run' ? '#FBBF24' : '#FFFFFF'}
                  strokeWidth="0.9"
                  strokeDasharray={tool === 'run' ? '2 1.5' : undefined}
                  strokeLinecap="round"
                  markerEnd={
                    tool === 'shot'
                      ? 'url(#arrowShot)'
                      : tool === 'run'
                        ? 'url(#arrowRun)'
                        : 'url(#arrowPass)'
                  }
                />
              )}
            </svg>

            {/* Draggable Player Tokens (smoothly animated between frames!) */}
            {currentFrame.tokens.map((tok) => {
              const isDragged = draggingTarget === tok.id;
              const isSelected = selectedTarget === tok.id;
              return (
                <div
                  key={tok.id}
                  draggable={false}
                  onPointerDown={(e) => {
                    if (isPlaying) return;
                    if (tool !== 'move') {
                      return;
                    }
                    e.preventDefault();
                    e.stopPropagation();
                    dragStartPtRef.current = getBoardCoords(e.clientX, e.clientY);
                    dragMovedRef.current = false;
                    setDraggingTarget(tok.id);
                  }}
                  style={{
                    left: `${tok.x}%`,
                    top: `${tok.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  className={`absolute z-20 flex flex-col items-center touch-none select-none transition-[left,top] duration-500 ease-out ${
                    isDragged
                      ? '!transition-none z-40 scale-105 cursor-grabbing'
                      : tool === 'move'
                        ? 'cursor-grab hover:scale-105'
                        : 'pointer-events-none opacity-90'
                  }`}
                >
                  <div
                    className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 shadow-md sm:h-11 sm:w-11 ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-4 ring-emerald-400/50'
                        : tok.isCaptain
                          ? 'border-amber-500 bg-amber-50 text-slate-950'
                          : 'border-slate-900 bg-white text-slate-900'
                    }`}
                  >
                    <span className="font-display text-sm font-extrabold tabular-nums">
                      {tok.jerseyNumber}
                    </span>
                    {tok.isCaptain && (
                      <span
                        title="Capitão do Time"
                        className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-amber-500 text-[9px] font-black text-slate-950 shadow-xs"
                      >
                        C
                      </span>
                    )}
                  </div>
                  <span className="mt-0.5 max-w-[74px] truncate rounded bg-slate-900/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {tok.label}
                  </span>
                </div>
              );
            })}

            {/* Draggable Ball Token */}
            <div
              draggable={false}
              onPointerDown={(e) => {
                if (tool !== 'move' || isPlaying) return;
                e.preventDefault();
                e.stopPropagation();
                dragStartPtRef.current = getBoardCoords(e.clientX, e.clientY);
                dragMovedRef.current = false;
                setDraggingTarget('ball');
              }}
              style={{
                left: `${currentFrame.ballX}%`,
                top: `${currentFrame.ballY}%`,
                transform: 'translate(-50%, -50%)',
              }}
              title="Bola (arraste ou toque para movimentar)"
              className={`absolute z-30 flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-950 bg-yellow-400 shadow-lg touch-none select-none transition-[left,top] duration-500 ease-out ${
                draggingTarget === 'ball'
                  ? '!transition-none z-40 scale-110 cursor-grabbing'
                  : selectedTarget === 'ball'
                    ? 'ring-4 ring-emerald-400/70 cursor-grab'
                    : tool === 'move'
                      ? 'cursor-grab hover:scale-110'
                      : 'pointer-events-none'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-white/90" />
            </div>
          </div>

          {/* Keyframes Timeline Strip */}
          <div className="mt-3 space-y-2.5 border-t border-slate-100 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {frames.map((frm, idx) => (
                  <button
                    key={frm.id}
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setActiveFrameIdx(idx);
                    }}
                    className={`min-h-[34px] rounded-xl border px-3 text-xs font-bold transition-colors cursor-pointer ${
                      idx === activeFrameIdx
                        ? 'border-emerald-700 bg-emerald-600 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Passo {idx + 1}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    triggerFirstClickTip('playbook_new_step', currentUserId);
                    handleAddStep();
                  }}
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-xl border border-dashed border-emerald-400 bg-emerald-50/70 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Novo Passo</span>
                </button>
              </div>

              {frames.length > 1 && (
                <button
                  type="button"
                  onClick={handleDeleteStep}
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Excluir Passo</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                type="text"
                value={currentFrame.label}
                onChange={(e) =>
                  updateCurrentFrame((f) => ({ ...f, label: e.target.value.slice(0, 40) }))
                }
                placeholder="Nome do passo (ex: Saída)"
                className="min-h-[38px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
              <input
                type="text"
                value={currentFrame.note}
                onChange={(e) =>
                  updateCurrentFrame((f) => ({ ...f, note: e.target.value.slice(0, 220) }))
                }
                placeholder="Explicação deste passo (aparece no vídeo/foto)..."
                className="min-h-[38px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none sm:col-span-2"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: AI Play Generator + Save Form + Saved Plays Library */}
      <div className="space-y-4 lg:col-span-5">
        {/* AI Play Generator */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            <h3 className="font-display text-lg font-extrabold text-slate-900">
              Criar Jogada com IA
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Descreva o tipo de jogada e a IA monta a animação com os jogadores do seu time.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={aiPlayGoal}
              onChange={(e) => setAiPlayGoal(e.target.value)}
              placeholder="Ex: Escanteio curto com cruzamento..."
              className="min-h-[42px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
            />
            <button
              type="button"
              disabled={aiLoading}
              onClick={() => void handleGenerateAiPlay()}
              className="btn-studio inline-flex min-h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>{aiLoading ? 'Criando...' : 'Gerar Jogada'}</span>
            </button>
          </div>
        </div>

        {/* Save Play Details Form */}
        <form
          onSubmit={(e) => void handleSavePlay(e)}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <h3 className="font-display text-lg font-extrabold text-slate-900">
              {editingPlayId ? 'Editar Jogada Salva' : 'Salvar Nova Jogada'}
            </h3>
            <button
              type="button"
              onClick={handleNewPlay}
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
            >
              <CopyPlus className="h-3.5 w-3.5" />
              <span>Nova em Branco</span>
            </button>
          </div>

          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Nome da Jogada
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={80}
                  placeholder="Ex: Triangulação Ala + Pivô"
                  className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                >
                  {PLAY_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Orientação Tática (opcional)
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                placeholder="Descreva os gatilhos da jogada para o elenco e comissão..."
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>

            {statusMsg && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                {statusMsg}
              </div>
            )}
            {errorMsg && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="btn-studio inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>
                {saving
                  ? 'Salvando jogada...'
                  : editingPlayId
                    ? 'Atualizar Jogada Salva'
                    : 'Salvar Jogada no Time'}
              </span>
            </button>
          </div>
        </form>

        {/* Saved Plays Library */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <BookmarkCheck className="h-5 w-5 text-emerald-600" />
              <h3 className="font-display text-lg font-extrabold text-slate-900">
                Jogadas Salvas ({savedPlays.length})
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              {currentMember && isStaffPosition(currentMember.position)
                ? currentMember.position
                : 'Comissão & Elenco'}
            </span>
          </div>

          {savedPlays.length === 0 ? (
            <div className="py-6 text-center">
              <Crown className="mx-auto h-6 w-6 text-slate-300" />
              <p className="mt-2 text-xs font-semibold text-slate-600">
                Nenhuma jogada salva ainda.
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Crie manualmente ou use a IA e clique em Salvar Jogada.
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {savedPlays.map((play) => {
                const isSelected = editingPlayId === play.id;
                const canDelete = play.createdBy === currentUserId || isOwner;
                return (
                  <div
                    key={play.id}
                    className={`flex items-center justify-between gap-2 rounded-xl border p-3 transition-colors ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/60'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleLoadSavedPlay(play)}
                      className="min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <p className="truncate text-xs font-extrabold text-slate-900">
                        {play.title}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {play.category} · {play.frameCount} passos · por {play.createdByName} (
                        {play.createdByRole})
                      </p>
                    </button>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleLoadSavedPlay(play)}
                        title="Abrir jogada na prancheta"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteSavedPlay(play)}
                          title="Excluir jogada"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
