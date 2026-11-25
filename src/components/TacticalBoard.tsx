import React, { useEffect, useMemo, useRef, useState } from 'react';
import { doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import {
  AlertCircle,
  ArrowLeftRight,
  ArrowUpDown,
  Award,
  Brain,
  Check,
  ClipboardList,
  Clock,
  Crown,
  Edit3,
  Plus,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  Video,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { motion } from 'motion/react';
import { getOvrTierInfo, OvrDrillSpec } from '../data/ovrDrills';
import { db, formatFriendlyFirebaseError, handleFirestoreError, OperationType } from '../lib/firebase';
import { triggerFirstClickTip } from '../lib/firstClickCoach';
import { createClientId } from '../lib/imageUtils';
import { formatCountdownMs, uploadVideoClip } from '../lib/videoUpload';
import {
  AiLineupResponse,
  AiOvrEvalResponse,
  FIELD_LIMITS,
  isStaffPosition,
  SPORTS_CONFIG,
  STAFF_ABBR,
  STAFF_POSITIONS,
  Team,
  TeamMember,
} from '../types/studio';
import { OvrTestModal } from './OvrTestModal';
import { PlaybookStudio } from './PlaybookStudio';
import { PlayerDetailModal } from './PlayerDetailModal';
import { SportPitchSvg } from './SportPitchSvg';

interface TacticalBoardProps {
  team: Team;
  members: TeamMember[];
  currentUserId: string;
}

type TacticalSection = 'lineup' | 'playbook';
type SquadBoardView = 'starters' | 'reserves';

export const TacticalBoard: React.FC<TacticalBoardProps> = ({
  team,
  members,
  currentUserId,
}) => {
  const sportCfg = SPORTS_CONFIG[team.sport];
  const formationNames = Object.keys(sportCfg.formations);
  const pitchRef = useRef<HTMLDivElement | null>(null);

  const [section, setSection] = useState<TacticalSection>('lineup');
  const [boardView, setBoardView] = useState<SquadBoardView>('starters');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [localCoords, setLocalCoords] = useState<Record<string, { x: number; y: number }>>({});
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null);
  const [ovrTestMemberId, setOvrTestMemberId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Live clock for active 1-5 min OVR analyses
  const [clockNowMs, setClockNowMs] = useState(() => Date.now());

  // Position swap mode (swap any two athletes — Starter<->Reserve or Starter<->Starter)
  const [swapMode, setSwapMode] = useState(false);
  const [swapSourceId, setSwapSourceId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formJersey, setFormJersey] = useState<number>(1);
  const [formPosition, setFormPosition] = useState<string>(sportCfg.positions[0]);
  const [formIsStarter, setFormIsStarter] = useState<boolean>(true);
  const [formIsCaptain, setFormIsCaptain] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const [aiQuestion, setAiQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiModeUsed, setAiModeUsed] = useState<'quick' | 'deep' | 'lineup' | 'ovr_lineup' | null>(null);
  const [aiLineupPreview, setAiLineupPreview] = useState<AiLineupResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const formIsStaff = isStaffPosition(formPosition);

  const currentMember = useMemo(
    () => members.find((m) => m.userId === currentUserId) || null,
    [members, currentUserId]
  );

  const athletes = useMemo(
    () => members.filter((m) => !isStaffPosition(m.position)),
    [members]
  );

  const starters = useMemo(
    () => athletes.filter((m) => m.isStarter).sort((a, b) => a.jerseyNumber - b.jerseyNumber),
    [athletes]
  );

  const reserves = useMemo(
    () => athletes.filter((m) => !m.isStarter).sort((a, b) => a.jerseyNumber - b.jerseyNumber),
    [athletes]
  );

  const staffMembers = useMemo(
    () => members.filter((m) => isStaffPosition(m.position)).sort((a, b) => a.name.localeCompare(b.name)),
    [members]
  );

  const captainMember = useMemo(
    () => athletes.find((m) => m.id === team.captainMemberId) || null,
    [athletes, team.captainMemberId]
  );

  const swapSourceMember = useMemo(
    () => athletes.find((m) => m.id === swapSourceId) || null,
    [athletes, swapSourceId]
  );

  const activePitchPlayers = boardView === 'starters' ? starters : reserves;

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId) || null,
    [members, selectedMemberId]
  );

  const detailMember = useMemo(
    () => members.find((m) => m.id === detailMemberId) || null,
    [members, detailMemberId]
  );

  const ovrTestMember = useMemo(
    () => members.find((m) => m.id === ovrTestMemberId) || null,
    [members, ovrTestMemberId]
  );

  const ovrEvaluatedCount = useMemo(
    () => athletes.filter((a) => typeof a.ovrRating === 'number' && a.ovrRating > 0).length,
    [athletes]
  );
  const allAthletesHaveOvr = athletes.length > 0 && ovrEvaluatedCount === athletes.length;
  const anyAnalyzingOvr = useMemo(
    () => athletes.some((a) => a.ovrStatus === 'analyzing'),
    [athletes]
  );
  const promotedIdsRef = useRef<Set<string>>(new Set());

  const ovrTestMemberIdRef = useRef<string | null>(null);
  useEffect(() => {
    ovrTestMemberIdRef.current = ovrTestMemberId;
  }, [ovrTestMemberId]);

  useEffect(() => {
    if (!anyAnalyzingOvr) return;
    const intervalId = window.setInterval(() => {
      const now = Date.now();
      setClockNowMs(now);

      for (const m of athletes) {
        if (
          m.ovrStatus === 'analyzing' &&
          typeof m.ovrPendingRating === 'number' &&
          m.ovrPendingRating > 0 &&
          !promotedIdsRef.current.has(m.id)
        ) {
          promotedIdsRef.current.add(m.id);
          void updateDoc(doc(db, 'teams', team.id, 'members', m.id), {
            ovrStatus: 'ready',
            ovrRating: m.ovrPendingRating,
            ovrUpdatedAtMs: now,
            updatedAt: serverTimestamp(),
          })
            .then(() => {
              setStatusNotice(
                `Teste de Over concluído: ${m.name} (#${m.jerseyNumber}) recebeu OVR ${m.ovrPendingRating}!`
              );
            })
            .catch(() => {
              promotedIdsRef.current.delete(m.id);
            });
        }
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [anyAnalyzingOvr, athletes, team.id]);

  const buildTakenJerseysMap = (updatedMembers: TeamMember[]) => {
    const map: Record<string, string> = {};
    for (const m of updatedMembers) {
      if (!isStaffPosition(m.position) && m.jerseyNumber > 0) {
        map[String(m.jerseyNumber)] = `${m.name} · ${m.position}`;
      }
    }
    return map;
  };

  const getJerseyConflict = (jerseyNum: number, ignoreMemberId?: string): TeamMember | null => {
    if (formIsStaff || jerseyNum <= 0) return null;
    return (
      members.find(
        (m) =>
          !isStaffPosition(m.position) &&
          m.jerseyNumber === jerseyNum &&
          m.id !== ignoreMemberId
      ) || null
    );
  };

  const freeJerseys = useMemo(() => {
    const used = new Set(
      members.filter((m) => !isStaffPosition(m.position) && m.jerseyNumber > 0).map((m) => m.jerseyNumber)
    );
    const list: number[] = [];
    for (let n = 1; n <= 99 && list.length < 6; n += 1) {
      if (!used.has(n)) list.push(n);
    }
    return list;
  }, [members]);

  const activeAddConflict = showAddModal ? getJerseyConflict(formJersey) : null;
  const activeEditConflict =
    selectedMember && !showAddModal ? getJerseyConflict(formJersey, selectedMember.id) : null;

  const samePositionStarterConflict = useMemo(() => {
    if (formIsStaff) return null;
    const ignoreId = !showAddModal && selectedMember ? selectedMember.id : undefined;
    return (
      starters.find((m) => m.position === formPosition && m.id !== ignoreId) || null
    );
  }, [formIsStaff, formPosition, showAddModal, selectedMember, starters]);

  const handleSelectPositionInModal = (nextPos: string) => {
    setFormPosition(nextPos);
    if (isStaffPosition(nextPos)) {
      setFormIsStarter(false);
      setFormIsCaptain(false);
      return;
    }
    if (formJersey <= 0) {
      setFormJersey(freeJerseys[0] || 1);
    }
    const ignoreId = !showAddModal && selectedMember ? selectedMember.id : undefined;
    const hasStarterInPos = starters.some((m) => m.position === nextPos && m.id !== ignoreId);
    if (hasStarterInPos) {
      setFormIsStarter(false);
    }
  };

  const openEditor = (member: TeamMember) => {
    setShowAddModal(false);
    setSelectedMemberId(member.id);
    setFormName(member.name);
    setFormJersey(member.jerseyNumber > 0 ? member.jerseyNumber : freeJerseys[0] || 1);
    setFormPosition(member.position);
    setFormIsStarter(isStaffPosition(member.position) ? false : member.isStarter);
    setFormIsCaptain(!isStaffPosition(member.position) && team.captainMemberId === member.id);
    setFeedbackError(null);
  };

  const openAddPlayer = (defaultAsReserve = false) => {
    setSelectedMemberId(null);
    setFormName('');
    setFormJersey(freeJerseys[0] || 1);
    const defaultPos = sportCfg.positions[0];
    setFormPosition(defaultPos);
    const starterTaken = starters.some((m) => m.position === defaultPos);
    setFormIsStarter(
      defaultAsReserve ? false : !starterTaken && starters.length < sportCfg.startersCount
    );
    setFormIsCaptain(false);
    setFeedbackError(null);
    setShowAddModal(true);
  };

  const handleSetCaptain = async (member: TeamMember) => {
    if (isStaffPosition(member.position)) return;
    setFeedbackError(null);
    const nextCaptainId = team.captainMemberId === member.id ? '' : member.id;
    try {
      await updateDoc(doc(db, 'teams', team.id), {
        captainMemberId: nextCaptainId,
        updatedAt: serverTimestamp(),
      });
      setStatusNotice(
        nextCaptainId
          ? `${member.name} (#${member.jerseyNumber}) definido como Capitão do Time!`
          : 'Faixa de capitão removida.'
      );
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `teams/${team.id}`);
      } catch (wrapped) {
        setFeedbackError(formatFriendlyFirebaseError(wrapped));
      }
    }
  };

  const handleSwapAthletes = async (first: TeamMember, second: TeamMember) => {
    if (first.id === second.id) {
      setSwapSourceId(null);
      return;
    }
    setFeedbackError(null);
    try {
      const batch = writeBatch(db);
      const now = serverTimestamp();

      batch.update(doc(db, 'teams', team.id, 'members', first.id), {
        isStarter: second.isStarter,
        position: second.position,
        posX: second.posX,
        posY: second.posY,
        updatedAt: now,
      });

      batch.update(doc(db, 'teams', team.id, 'members', second.id), {
        isStarter: first.isStarter,
        position: first.position,
        posX: first.posX,
        posY: first.posY,
        updatedAt: now,
      });

      const updatedMembers = members.map((m) => {
        if (m.id === first.id) return { ...m, position: second.position };
        if (m.id === second.id) return { ...m, position: first.position };
        return m;
      });

      batch.update(doc(db, 'invites', team.inviteCode), {
        takenJerseys: buildTakenJerseysMap(updatedMembers),
        updatedAt: now,
      });

      await batch.commit();
      setSwapSourceId(null);
      setSwapMode(false);
      setStatusNotice(
        `Posições trocadas: ${first.name} (${second.position}) ↔ ${second.name} (${first.position})`
      );
    } catch (err) {
      setFeedbackError(formatFriendlyFirebaseError(err));
    }
  };

  const handlePickForSwap = (member: TeamMember) => {
    if (isStaffPosition(member.position)) return;
    if (!swapSourceMember) {
      setSwapMode(true);
      setSwapSourceId(member.id);
      setStatusNotice(
        `Selecionado #${member.jerseyNumber} ${member.name}. Toque em outro jogador para trocar de posição.`
      );
      return;
    }
    if (swapSourceMember.id === member.id) {
      setSwapSourceId(null);
      setSwapMode(false);
      setStatusNotice(null);
      return;
    }
    void handleSwapAthletes(swapSourceMember, member);
  };

  const handleApplyFormation = async (formationKey: string) => {
    const slots = sportCfg.formations[formationKey];
    if (!slots) return;
    setFeedbackError(null);
    try {
      const batch = writeBatch(db);
      const now = serverTimestamp();

      if (boardView === 'starters') {
        batch.update(doc(db, 'teams', team.id), {
          formation: formationKey,
          updatedAt: now,
        });
      }

      activePitchPlayers.forEach((player, idx) => {
        const slot = slots[idx % slots.length];
        batch.update(doc(db, 'teams', team.id, 'members', player.id), {
          posX: slot.x,
          posY: slot.y,
          updatedAt: now,
        });
      });

      await batch.commit();
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `teams/${team.id}`);
      } catch (wrapped) {
        setFeedbackError(formatFriendlyFirebaseError(wrapped));
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent, member: TeamMember) => {
    if (swapMode) {
      e.stopPropagation();
      handlePickForSwap(member);
      return;
    }
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingId(member.id);
    setLocalCoords((prev) => ({
      ...prev,
      [member.id]: { x: member.posX, y: member.posY },
    }));
  };

  const handlePointerMove = (e: React.PointerEvent, member: TeamMember) => {
    if (swapMode || draggingId !== member.id || !pitchRef.current) return;
    const rect = pitchRef.current.getBoundingClientRect();
    const x = Math.max(8, Math.min(92, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(8, Math.min(92, ((e.clientY - rect.top) / rect.height) * 100));
    setLocalCoords((prev) => ({
      ...prev,
      [member.id]: { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 },
    }));
  };

  const handlePointerUp = async (e: React.PointerEvent, member: TeamMember) => {
    if (swapMode || draggingId !== member.id) return;
    e.stopPropagation();
    setDraggingId(null);

    const moved = localCoords[member.id];
    if (!moved) return;

    const delta = Math.abs(moved.x - member.posX) + Math.abs(moved.y - member.posY);
    if (delta < 1.2) {
      triggerFirstClickTip('board_player_card', currentUserId);
      setDetailMemberId(member.id);
      return;
    }

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'teams', team.id, 'members', member.id), {
        posX: moved.x,
        posY: moved.y,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (err) {
      setFeedbackError(formatFriendlyFirebaseError(err));
    }
  };

  const handleSaveMemberEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setFeedbackError(null);

    const effectiveJersey = formIsStaff ? 0 : formJersey;
    const effectiveStarter = formIsStaff ? false : formIsStarter;

    const conflict = getJerseyConflict(effectiveJersey, selectedMember.id);
    if (conflict) {
      setFeedbackError(
        `A camisa #${effectiveJersey} já pertence a ${conflict.name} (${conflict.position}). Escolha outro número.`
      );
      return;
    }

    setSaving(true);
    try {
      const batch = writeBatch(db);
      const now = serverTimestamp();
      const nextName = formName.trim() || selectedMember.name;

      batch.update(doc(db, 'teams', team.id, 'members', selectedMember.id), {
        name: nextName,
        jerseyNumber: effectiveJersey,
        position: formPosition,
        isStarter: effectiveStarter,
        updatedAt: now,
      });

      if (!formIsStaff && formIsCaptain) {
        batch.update(doc(db, 'teams', team.id), {
          captainMemberId: selectedMember.id,
          updatedAt: now,
        });
      } else if (team.captainMemberId === selectedMember.id && (!formIsCaptain || formIsStaff)) {
        batch.update(doc(db, 'teams', team.id), {
          captainMemberId: '',
          updatedAt: now,
        });
      }

      const updatedMembers = members.map((m) =>
        m.id === selectedMember.id
          ? {
              ...m,
              name: nextName,
              jerseyNumber: effectiveJersey,
              position: formPosition,
            }
          : m
      );

      batch.update(doc(db, 'invites', team.inviteCode), {
        takenJerseys: buildTakenJerseysMap(updatedMembers),
        updatedAt: now,
      });

      await batch.commit();
      setSelectedMemberId(null);
    } catch (err) {
      setFeedbackError(formatFriendlyFirebaseError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddGuestPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackError(null);
    const trimmed = formName.trim();
    if (!trimmed) {
      setFeedbackError('Digite o nome do integrante.');
      return;
    }

    const effectiveJersey = formIsStaff ? 0 : formJersey;
    const effectiveStarter = formIsStaff ? false : formIsStarter;

    const conflict = getJerseyConflict(effectiveJersey);
    if (conflict) {
      setFeedbackError(
        `A camisa #${effectiveJersey} já está ocupada por ${conflict.name} (${conflict.position}). Escolha outro número.`
      );
      return;
    }

    setSaving(true);
    const guestId = createClientId('guest');
    const slots = sportCfg.formations[team.formation] || Object.values(sportCfg.formations)[0];
    const slotIndex = effectiveStarter ? starters.length : reserves.length;
    const slot = slots[slotIndex % slots.length] || { x: 50, y: 50 };

    try {
      const batch = writeBatch(db);
      const now = serverTimestamp();

      const newMember: TeamMember = {
        id: guestId,
        teamId: team.id,
        userId: '',
        name: trimmed,
        jerseyNumber: effectiveJersey,
        position: formPosition,
        role: 'guest',
        isStarter: effectiveStarter,
        posX: slot.x,
        posY: slot.y,
        createdAt: now,
        updatedAt: now,
      };

      batch.set(doc(db, 'teams', team.id, 'members', guestId), newMember);
      if (!formIsStaff && formIsCaptain) {
        batch.update(doc(db, 'teams', team.id), {
          captainMemberId: guestId,
          updatedAt: now,
        });
      }
      batch.update(doc(db, 'invites', team.inviteCode), {
        takenJerseys: buildTakenJerseysMap([...members, newMember]),
        updatedAt: now,
      });

      await batch.commit();
      setShowAddModal(false);
      if (!formIsStaff) {
        setBoardView(effectiveStarter ? 'starters' : 'reserves');
      }
    } catch (err) {
      setFeedbackError(formatFriendlyFirebaseError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStarter = async (member: TeamMember) => {
    if (isStaffPosition(member.position)) return;
    setFeedbackError(null);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'teams', team.id, 'members', member.id), {
        isStarter: !member.isStarter,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (err) {
      setFeedbackError(formatFriendlyFirebaseError(err));
    }
  };

  const handleDeleteGuest = async (member: TeamMember) => {
    if (member.role !== 'guest' && member.userId !== currentUserId) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'teams', team.id, 'members', member.id));
      if (team.captainMemberId === member.id) {
        batch.update(doc(db, 'teams', team.id), {
          captainMemberId: '',
          updatedAt: serverTimestamp(),
        });
      }
      const remaining = members.filter((m) => m.id !== member.id);
      batch.update(doc(db, 'invites', team.inviteCode), {
        takenJerseys: buildTakenJerseysMap(remaining),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      setSelectedMemberId(null);
    } catch (err) {
      setFeedbackError(formatFriendlyFirebaseError(err));
    } finally {
      setSaving(false);
    }
  };

  const runAiAssistant = async (mode: 'quick' | 'deep') => {
    setAiLoading(true);
    setAiError(null);
    setAiModeUsed(mode);
    const rosterSummary = members
      .map((m) =>
        isStaffPosition(m.position)
          ? `${m.name} (${m.position})`
          : `#${m.jerseyNumber} ${m.name} (${m.position} - ${m.isStarter ? 'Titular' : 'Reserva'}${team.captainMemberId === m.id ? ' - Capitão' : ''})`
      )
      .join('; ');

    try {
      const endpoint = mode === 'quick' ? '/api/ai/quick-tip' : '/api/ai/tactical-analysis';
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName: team.name,
          sport: sportCfg.label,
          formation: team.formation,
          rosterSummary,
          question:
            aiQuestion.trim() ||
            (mode === 'quick'
              ? 'Dê uma dica rápida de posicionamento para titulares e reservas.'
              : 'Analise em profundidade os pontos fortes, vulnerabilidades, reservas e ajustes ideais para esta escalação.'),
        }),
      });
      const data = (await resp.json()) as { text?: string; error?: string };
      if (!resp.ok || data.error) {
        throw new Error(data.error || 'Falha ao consultar assistente tático.');
      }
      setAiResponse(data.text || '');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Erro ao gerar análise.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleResetOvrAnalysis = async (member: TeamMember) => {
    promotedIdsRef.current.delete(member.id);
    const hasPreviousOvr = typeof member.ovrRating === 'number' && member.ovrRating > 0;
    await updateDoc(doc(db, 'teams', team.id, 'members', member.id), {
      ovrStatus: hasPreviousOvr ? 'ready' : 'none',
      ovrPendingRating: 0,
      ...(hasPreviousOvr ? {} : { ovrSummary: '' }),
      updatedAt: serverTimestamp(),
    });
  };

  const handleSubmitOvrVideos = async (
    member: TeamMember,
    selections: { drill: OvrDrillSpec; file: File }[],
    onStageChange?: (stage: 'uploading' | 'analyzing') => void
  ) => {
    onStageChange?.('uploading');
    const uploadedDrills: { clipId: string; title: string; focusAttribute: string }[] = [];
    for (const sel of selections) {
      const meta = await uploadVideoClip(sel.file);
      uploadedDrills.push({
        clipId: meta.clipId,
        title: sel.drill.title,
        focusAttribute: sel.drill.focusAttribute,
      });
    }

    const startedAtMs = Date.now();
    promotedIdsRef.current.delete(member.id);
    onStageChange?.('analyzing');

    await updateDoc(doc(db, 'teams', team.id, 'members', member.id), {
      ovrStatus: 'analyzing',
      ovrReadyAtMs: startedAtMs,
      ovrPendingRating: 0,
      ovrSummary: 'Vídeos enviados. A IA está analisando seus fundamentos ao vivo...',
      updatedAt: serverTimestamp(),
    });

    setStatusNotice(
      `Vídeos de ${member.name} enviados! A IA está analisando sua técnica em tempo real...`
    );

    try {
      const res = await fetch('/api/ai/evaluate-over', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sport: sportCfg.label,
          position: member.position,
          playerName: member.name,
          drills: uploadedDrills,
        }),
      });

      const rawText = await res.text();
      let data: Partial<AiOvrEvalResponse> & { error?: string } = {};
      try {
        data = JSON.parse(rawText) as Partial<AiOvrEvalResponse> & { error?: string };
      } catch {
        throw new Error(
          res.ok
            ? 'Resposta inesperada do servidor de IA. Tente novamente.'
            : `Falha no servidor de IA (HTTP ${res.status}). Tente novamente em instantes.`
        );
      }

      if (!res.ok || data.error || typeof data.ovr !== 'number') {
        throw new Error(data.error || 'Não foi possível concluir a avaliação em vídeo.');
      }

      const now = Date.now();
      promotedIdsRef.current.add(member.id);
      await updateDoc(doc(db, 'teams', team.id, 'members', member.id), {
        ovrStatus: 'ready',
        ovrRating: data.ovr,
        ovrPendingRating: data.ovr,
        ovrUpdatedAtMs: now,
        ovrSummary: data.sincereFeedback || 'Avaliação técnica concluída pela IA.',
        ovrStats: data.attributes || {},
        ovrExercises: data.recommendedExercises || [],
        updatedAt: serverTimestamp(),
      });

      setStatusNotice(
        `Teste de Over concluído pela IA: ${member.name} (#${member.jerseyNumber}) recebeu OVR ${data.ovr}!`
      );

      if (ovrTestMemberIdRef.current === member.id) {
        setOvrTestMemberId(null);
        setDetailMemberId(member.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha na análise de vídeo da IA.';
      await updateDoc(doc(db, 'teams', team.id, 'members', member.id), {
        ovrStatus: 'error',
        ovrSummary: msg.slice(0, 580),
        updatedAt: serverTimestamp(),
      }).catch(() => undefined);
      setStatusNotice(`Erro no Teste de Over de ${member.name}: ${msg}`);
      throw new Error(msg);
    }
  };

  const handleGenerateAiLineup = async (useOvrRecommendation = false) => {
    if (athletes.length === 0) {
      setAiError('Adicione pelo menos 1 atleta no elenco antes de gerar uma escalação com IA.');
      return;
    }
    if (useOvrRecommendation && !allAthletesHaveOvr) {
      setAiError(
        `Faltam ${athletes.length - ovrEvaluatedCount} atleta(s) fazerem o Teste de Over para liberar a recomendação oficial por OVR.`
      );
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiModeUsed(useOvrRecommendation ? 'ovr_lineup' : 'lineup');
    setAiLineupPreview(null);
    try {
      const resp = await fetch('/api/ai/generate-lineup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName: team.name,
          sport: sportCfg.label,
          formation: team.formation,
          availableFormations: formationNames,
          availablePositions: sportCfg.positions,
          startersCount: sportCfg.startersCount,
          useOvrRecommendation,
          athletes: athletes.map((a) => ({
            id: a.id,
            name: a.name,
            jerseyNumber: a.jerseyNumber,
            position: a.position,
            isStarter: a.isStarter,
            posX: a.posX,
            posY: a.posY,
            ovrRating: a.ovrRating || 0,
            ovrStats: a.ovrStats || {},
          })),
          stylePrompt: aiQuestion.trim(),
        }),
      });
      const data = (await resp.json()) as AiLineupResponse & { error?: string };
      if (!resp.ok || data.error || !Array.isArray(data.assignments)) {
        throw new Error(data.error || 'Falha ao gerar escalação com IA.');
      }
      setAiLineupPreview(data);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Erro ao gerar escalação com IA.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyAiLineup = async () => {
    if (!aiLineupPreview) return;
    setSaving(true);
    setFeedbackError(null);
    try {
      const batch = writeBatch(db);
      const now = serverTimestamp();

      batch.update(doc(db, 'teams', team.id), {
        formation: aiLineupPreview.formation,
        captainMemberId: aiLineupPreview.captainMemberId || '',
        updatedAt: now,
      });

      const assignmentMap = new Map(
        aiLineupPreview.assignments.map((a) => [a.memberId, a])
      );

      aiLineupPreview.assignments.forEach((a) => {
        batch.update(doc(db, 'teams', team.id, 'members', a.memberId), {
          isStarter: a.isStarter,
          position: a.position,
          posX: a.posX,
          posY: a.posY,
          updatedAt: now,
        });
      });

      const updatedMembers = members.map((m) => {
        const a = assignmentMap.get(m.id);
        return a ? { ...m, position: a.position } : m;
      });

      batch.update(doc(db, 'invites', team.inviteCode), {
        takenJerseys: buildTakenJerseysMap(updatedMembers),
        updatedAt: now,
      });

      await batch.commit();
      setStatusNotice('Escalação, reservas e capitão sugeridos pela IA aplicados!');
      setAiLineupPreview(null);
    } catch (err) {
      setFeedbackError(formatFriendlyFirebaseError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Studio Sub-Navigation: Prancheta & Elenco vs Quadro de Jogadas (Comissão & Jogadores) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              triggerFirstClickTip('board_tab_lineup', currentUserId);
              setSection('lineup');
            }}
            className={`btn-studio inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-b-[3px] px-4 text-xs font-bold transition-colors cursor-pointer ${
              section === 'lineup'
                ? 'border-emerald-700 bg-emerald-600 text-white'
                : 'border-slate-200 border-b-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Prancheta & Escalação</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerFirstClickTip('board_tab_playbook', currentUserId);
              setSection('playbook');
            }}
            className={`btn-studio inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-b-[3px] px-4 text-xs font-bold transition-colors cursor-pointer ${
              section === 'playbook'
                ? 'border-emerald-700 bg-emerald-600 text-white'
                : 'border-slate-200 border-b-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            <span>Quadro de Jogadas (Comissão & Time)</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {currentMember && !isStaffPosition(currentMember.position) && (
            <button
              type="button"
              onClick={() => {
                triggerFirstClickTip('board_ovr_test', currentUserId);
                setOvrTestMemberId(currentMember.id);
              }}
              className="btn-studio inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-amber-500 border-b-[3px] bg-amber-400 px-3 text-xs font-extrabold text-slate-950 hover:bg-amber-300 cursor-pointer"
            >
              <Video className="h-3.5 w-3.5" />
              <span>
                {currentMember.ovrStatus === 'analyzing'
                  ? `IA Analisando (${formatCountdownMs(Math.max(0, clockNowMs - (currentMember.ovrReadyAtMs || clockNowMs)))})`
                  : currentMember.ovrRating
                    ? `Meu Over: ${currentMember.ovrRating}`
                    : 'Fazer Teste de Over'}
              </span>
            </button>
          )}
          {captainMember ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 font-bold text-amber-900">
              <Crown className="h-3.5 w-3.5 text-amber-600" />
              <span>
                Capitão: #{captainMember.jerseyNumber} {captainMember.name}
              </span>
            </span>
          ) : (
            <span className="text-slate-500">
              Defina o <strong>Capitão (C)</strong> na coroa
            </span>
          )}
        </div>
      </div>

      {section === 'playbook' ? (
        <PlaybookStudio
          team={team}
          members={members}
          currentMember={currentMember}
          currentUserId={currentUserId}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
          {/* Left: Tactical Pitch/Court with Titulares / Reservas Toggle & Position Swap */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <h2 className="font-display text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                    {team.sport === 'futebol'
                      ? 'Campo de Futebol'
                      : team.sport === 'futsal'
                        ? 'Quadra de Futsal'
                        : `Quadra de ${sportCfg.label}`}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Arraste para posicionar · Toque para editar ·{' '}
                    <span className="font-semibold tabular-nums text-emerald-700">
                      {starters.length}/{sportCfg.startersCount} titulares
                    </span>
                    {' · '}
                    <span className="font-semibold tabular-nums text-indigo-700">
                      {reserves.length} reservas
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Lineup View Toggle: Time Titular vs Escalação Reserva */}
                  <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        triggerFirstClickTip('board_view_starters', currentUserId);
                        setBoardView('starters');
                      }}
                      className={`min-h-[34px] rounded-lg px-3 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                        boardView === 'starters'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Titulares ({starters.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerFirstClickTip('board_view_reserves', currentUserId);
                        setBoardView('reserves');
                      }}
                      className={`min-h-[34px] rounded-lg px-3 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                        boardView === 'reserves'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Escalação Reserva ({reserves.length})
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      triggerFirstClickTip('board_swap_mode', currentUserId);
                      const next = !swapMode;
                      setSwapMode(next);
                      setSwapSourceId(null);
                      setStatusNotice(
                        next
                          ? 'Modo Troca ativo: toque no 1º jogador e depois no 2º para trocar de posição.'
                          : null
                      );
                    }}
                    className={`btn-studio inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-b-[3px] px-3 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      swapMode
                        ? 'border-amber-600 bg-amber-400 text-slate-950'
                        : 'border-slate-200 border-b-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    <span>{swapMode ? 'Cancelar Troca' : 'Trocar Posição'}</span>
                  </button>
                </div>
              </div>

              {statusNotice && (
                <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900">
                  <span>{statusNotice}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusNotice(null);
                      setSwapMode(false);
                      setSwapSourceId(null);
                    }}
                    className="text-amber-700 hover:text-amber-950 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Formation Picker Bar */}
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-600">
                  {boardView === 'starters'
                    ? 'Formação dos Titulares:'
                    : 'Organizar Escalação Reserva:'}
                </span>
                <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
                  {formationNames.map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => void handleApplyFormation(fmt)}
                      className={`min-h-[32px] rounded-lg px-2.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                        team.formation === fmt
                          ? boardView === 'starters'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pitch / Court Viewport Container */}
              <div
                ref={pitchRef}
                className="relative mx-auto mt-3 h-[370px] w-full max-w-[540px] overflow-hidden rounded-2xl border border-slate-200 shadow-inner select-none sm:h-[420px] lg:h-[calc(100vh-295px)] lg:min-h-[350px] lg:max-h-[470px]"
              >
                <SportPitchSvg sport={team.sport} />

                {activePitchPlayers.length === 0 && (
                  <div className="relative z-10 flex h-full flex-col items-center justify-center bg-slate-900/30 p-6 text-center backdrop-blur-[1px]">
                    <p className="rounded-xl bg-white/95 px-4 py-3 text-xs font-semibold text-slate-800 shadow-md">
                      {boardView === 'reserves'
                        ? 'Nenhum jogador na escalação reserva ainda.'
                        : 'Nenhum titular escalado no momento.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => openAddPlayer(boardView === 'reserves')}
                      className="btn-studio mt-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-indigo-700 border-b-[3px] bg-indigo-600 px-4 text-xs font-bold text-white hover:bg-indigo-500 cursor-pointer"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span>
                        {boardView === 'reserves' ? 'Adicionar Reserva' : 'Adicionar Titular'}
                      </span>
                    </button>
                  </div>
                )}

                {activePitchPlayers.map((player) => {
                  const coords = localCoords[player.id] || { x: player.posX, y: player.posY };
                  const isSelected =
                    selectedMemberId === player.id ||
                    detailMemberId === player.id ||
                    swapSourceId === player.id;
                  const isMine = player.userId === currentUserId;
                  const isReserveBoard = boardView === 'reserves';
                  const isCaptain = team.captainMemberId === player.id;
                  const hasOvr = typeof player.ovrRating === 'number' && player.ovrRating > 0;
                  const isAnalyzing = player.ovrStatus === 'analyzing';
                  const ovrTier = hasOvr ? getOvrTierInfo(player.ovrRating!) : null;
                  return (
                    <motion.div
                      key={player.id}
                      role="button"
                      tabIndex={0}
                      initial={{ scale: 0.82, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.94 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                      onPointerDown={(e) => handlePointerDown(e, player)}
                      onPointerMove={(e) => handlePointerMove(e, player)}
                      onPointerUp={(e) => void handlePointerUp(e, player)}
                      onPointerCancel={() => setDraggingId(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          if (swapMode) handlePickForSwap(player);
                          else setDetailMemberId(player.id);
                        }
                      }}
                      style={{
                        left: `${coords.x}%`,
                        top: `${coords.y}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      className="group absolute z-10 flex cursor-grab flex-col items-center touch-none active:cursor-grabbing focus:outline-none"
                    >
                      <div className="relative flex items-center">
                        <div
                          className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-b-[3px] shadow-md transition-colors sm:h-11 sm:w-11 ${
                            isSelected
                              ? 'border-slate-900 bg-amber-400 text-slate-950'
                              : isMine
                                ? isReserveBoard
                                  ? 'border-white bg-indigo-600 text-white'
                                  : 'border-white bg-emerald-600 text-white'
                                : isReserveBoard
                                  ? 'border-indigo-700 bg-indigo-50 text-indigo-900'
                                  : 'border-slate-900/85 bg-white text-slate-900 group-hover:border-emerald-600'
                          }`}
                        >
                          <span className="font-display text-lg font-extrabold tabular-nums">
                            {player.jerseyNumber}
                          </span>
                          {isCaptain && (
                            <span
                              title="Capitão do Time"
                              className="absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-amber-400 text-[10px] font-black text-slate-950 shadow-xs"
                            >
                              C
                            </span>
                          )}
                        </div>

                        {/* OVR & Jersey Number side tag next to the circle */}
                        {isAnalyzing ? (
                          <div className="ml-1 flex flex-col items-center rounded-lg border border-amber-400 bg-amber-50 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-900 shadow-sm">
                            <Clock className="h-2.5 w-2.5 animate-pulse" />
                            <span className="font-mono-tabular leading-tight">
                              #{player.jerseyNumber}
                            </span>
                          </div>
                        ) : hasOvr && ovrTier ? (
                          <div
                            className={`ml-1 flex flex-col items-center rounded-lg border px-1.5 py-0.5 shadow-sm ${ovrTier.pitchBadgeClass}`}
                          >
                            <span className="font-display text-xs font-black leading-none tabular-nums">
                              {player.ovrRating}
                            </span>
                            <span className="font-mono-tabular text-[8px] font-bold leading-tight opacity-90">
                              OVR·#{player.jerseyNumber}
                            </span>
                          </div>
                        ) : (
                          <div className="ml-1 flex flex-col items-center rounded-lg border border-slate-300 bg-white/95 px-1.5 py-0.5 text-slate-700 shadow-sm">
                            <span className="text-[9px] font-extrabold leading-none">OVR</span>
                            <span className="font-mono-tabular text-[9px] font-bold leading-tight text-slate-500">
                              #{player.jerseyNumber}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-0.5 max-w-[92px] truncate rounded-md bg-slate-900/90 px-1.5 py-0.5 text-center text-[10px] font-bold text-white shadow-xs">
                        {player.name.split(' ')[0]}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Coaching Staff Strip */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Comissão Técnica:</span>
                  {staffMembers.length === 0 ? (
                    <span className="text-xs text-slate-400">
                      Nenhum técnico, treinador de goleiro ou auxiliar definido ainda
                    </span>
                  ) : (
                    staffMembers.map((staff) => (
                      <button
                        key={staff.id}
                        type="button"
                        onClick={() => openEditor(staff)}
                        className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 text-xs font-semibold text-sky-900 hover:bg-sky-100 cursor-pointer"
                      >
                        <span className="font-mono-tabular font-extrabold text-sky-700">
                          {STAFF_ABBR[staff.position] || 'COM'}
                        </span>
                        <span>{staff.name}</span>
                      </button>
                    ))
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSection('playbook')}
                  className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  <span>Abrir Quadro de Jogadas</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right: Roster Lists (Fully Editable + Captain + Swapper) & AI Studio Actions */}
          <div className="space-y-4 lg:col-span-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <h3 className="font-display text-xl font-bold text-slate-900">
                    Elenco Completo ({members.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tudo editável · Capitão · Titulares e Reservas
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerFirstClickTip('board_add_member', currentUserId);
                    openAddPlayer(boardView === 'reserves');
                  }}
                  className="btn-studio inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-3.5 text-xs font-bold text-white hover:bg-emerald-500 whitespace-nowrap cursor-pointer"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Adicionar Jogador</span>
                </button>
              </div>

              {feedbackError && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs text-red-700">
                  {feedbackError}
                </div>
              )}

              <div className="mt-3 space-y-4">
                {/* Starters */}
                <div>
                  <p className="text-[11px] font-bold text-emerald-700 uppercase">
                    Titulares ({starters.length})
                  </p>
                  {starters.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-400">Nenhum titular escalado.</p>
                  ) : (
                    <div className="mt-1 divide-y divide-slate-100">
                      {starters.map((member) => {
                        const isCap = team.captainMemberId === member.id;
                        const isSwapSource = swapSourceId === member.id;
                        return (
                          <div
                            key={member.id}
                            className={`flex min-h-[46px] items-center justify-between gap-2 rounded-lg px-1 py-1.5 ${
                              isSwapSource ? 'bg-amber-50' : ''
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                swapMode ? handlePickForSwap(member) : setDetailMemberId(member.id)
                              }
                              className="flex min-w-0 flex-1 items-center gap-2.5 text-left cursor-pointer"
                            >
                              <span className="font-display relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-base font-extrabold text-emerald-700 tabular-nums">
                                {member.jerseyNumber}
                              </span>
                              <div className="min-w-0">
                                <p className="flex items-center gap-1 truncate text-xs font-bold text-slate-900">
                                  <span className="truncate">
                                    {member.name}
                                    {member.userId === currentUserId ? ' (Você)' : ''}
                                  </span>
                                  {isCap && (
                                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-black text-slate-950">
                                      C
                                    </span>
                                  )}
                                  {member.ovrStatus === 'analyzing' ? (
                                    <span className="font-mono-tabular shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                                      IA {formatCountdownMs(Math.max(0, clockNowMs - (member.ovrReadyAtMs || clockNowMs)))}
                                    </span>
                                  ) : member.ovrRating && member.ovrRating > 0 ? (
                                    <span
                                      className={`font-mono-tabular shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-black ${
                                        getOvrTierInfo(member.ovrRating).badgeClass
                                      }`}
                                    >
                                      OVR {member.ovrRating}
                                    </span>
                                  ) : null}
                                </p>
                                <p className="truncate text-[11px] text-slate-500">
                                  {member.position}
                                </p>
                              </div>
                            </button>
                            <div className="flex shrink-0 items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => void handleSetCaptain(member)}
                                title={isCap ? 'Remover Capitão' : 'Definir como Capitão'}
                                aria-label={`Definir ${member.name} como Capitão`}
                                className={`flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg cursor-pointer ${
                                  isCap
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'text-slate-400 hover:bg-amber-50 hover:text-amber-600'
                                }`}
                              >
                                <Crown className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePickForSwap(member)}
                                title="Trocar de posição com outro jogador"
                                aria-label={`Trocar posição de ${member.name}`}
                                className={`flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg cursor-pointer ${
                                  isSwapSource
                                    ? 'bg-amber-400 text-slate-950'
                                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-900'
                                }`}
                              >
                                <ArrowLeftRight className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleToggleStarter(member)}
                                title="Mover para Escalação Reserva"
                                aria-label={`Mover ${member.name} para Escalação Reserva`}
                                className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer"
                              >
                                <ArrowUpDown className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditor(member)}
                                aria-label={`Editar ${member.name}`}
                                className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Reserves */}
                <div className="border-t border-slate-100 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-indigo-700 uppercase">
                      Escalação Reserva ({reserves.length})
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openAddPlayer(true)}
                        className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                      >
                        + Reserva
                      </button>
                      <button
                        type="button"
                        onClick={() => setBoardView('reserves')}
                        className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        Ver na prancheta
                      </button>
                    </div>
                  </div>
                  {reserves.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-400">
                      Nenhum jogador reserva ainda. Use as setas ou adicione reservas.
                    </p>
                  ) : (
                    <div className="mt-1 divide-y divide-slate-100">
                      {reserves.map((member) => {
                        const isCap = team.captainMemberId === member.id;
                        const isSwapSource = swapSourceId === member.id;
                        return (
                          <div
                            key={member.id}
                            className={`flex min-h-[46px] items-center justify-between gap-2 rounded-lg px-1 py-1.5 ${
                              isSwapSource ? 'bg-amber-50' : ''
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                swapMode ? handlePickForSwap(member) : setDetailMemberId(member.id)
                              }
                              className="flex min-w-0 flex-1 items-center gap-2.5 text-left cursor-pointer"
                            >
                              <span className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-base font-extrabold text-indigo-700 tabular-nums">
                                {member.jerseyNumber}
                              </span>
                              <div className="min-w-0">
                                <p className="flex items-center gap-1 truncate text-xs font-bold text-slate-800">
                                  <span className="truncate">
                                    {member.name}
                                    {member.userId === currentUserId ? ' (Você)' : ''}
                                  </span>
                                  {isCap && (
                                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-black text-slate-950">
                                      C
                                    </span>
                                  )}
                                  {member.ovrStatus === 'analyzing' ? (
                                    <span className="font-mono-tabular shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                                      IA {formatCountdownMs(Math.max(0, clockNowMs - (member.ovrReadyAtMs || clockNowMs)))}
                                    </span>
                                  ) : member.ovrRating && member.ovrRating > 0 ? (
                                    <span
                                      className={`font-mono-tabular shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-black ${
                                        getOvrTierInfo(member.ovrRating).badgeClass
                                      }`}
                                    >
                                      OVR {member.ovrRating}
                                    </span>
                                  ) : null}
                                </p>
                                <p className="truncate text-[11px] text-slate-500">
                                  {member.position}
                                </p>
                              </div>
                            </button>
                            <div className="flex shrink-0 items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => void handleSetCaptain(member)}
                                title={isCap ? 'Remover Capitão' : 'Definir como Capitão'}
                                aria-label={`Definir ${member.name} como Capitão`}
                                className={`flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg cursor-pointer ${
                                  isCap
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'text-slate-400 hover:bg-amber-50 hover:text-amber-600'
                                }`}
                              >
                                <Crown className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePickForSwap(member)}
                                title="Trocar de posição com outro jogador"
                                aria-label={`Trocar posição de ${member.name}`}
                                className={`flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg cursor-pointer ${
                                  isSwapSource
                                    ? 'bg-amber-400 text-slate-950'
                                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-900'
                                }`}
                              >
                                <ArrowLeftRight className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleToggleStarter(member)}
                                title="Promover para Titular"
                                aria-label={`Promover ${member.name} para Titular`}
                                className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                              >
                                <ArrowUpDown className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditor(member)}
                                aria-label={`Editar ${member.name}`}
                                className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Staff */}
                {staffMembers.length > 0 && (
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-[11px] font-bold text-sky-700 uppercase">
                      Comissão Técnica ({staffMembers.length})
                    </p>
                    <div className="mt-1 divide-y divide-slate-100">
                      {staffMembers.map((staff) => (
                        <div
                          key={staff.id}
                          className="flex min-h-[44px] items-center justify-between gap-2 py-1.5"
                        >
                          <button
                            type="button"
                            onClick={() => openEditor(staff)}
                            className="flex min-w-0 flex-1 items-center gap-2.5 text-left cursor-pointer"
                          >
                            <span className="font-mono-tabular flex h-8 shrink-0 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 px-2 text-[11px] font-extrabold text-sky-800">
                              {STAFF_ABBR[staff.position] || 'COM'}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-slate-800">
                                {staff.name}
                                {staff.userId === currentUserId ? ' (Você)' : ''}
                              </p>
                              <p className="truncate text-[11px] text-slate-500">
                                {staff.position}
                              </p>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditor(staff)}
                            aria-label={`Editar ${staff.name}`}
                            className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* AI Tactical Studio (Lineup Generator + Quick Tip + Deep Analysis) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-lg font-bold text-slate-900">
                  Assistente & IA Tática
                </h3>
                <button
                  type="button"
                  onClick={() => setSection('playbook')}
                  className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  IA de Jogadas →
                </button>
              </div>
              <div className="mt-2.5 flex gap-2">
                <input
                  type="text"
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  placeholder="Ex: Time ofensivo, foco em contra-ataque..."
                  className="min-h-[42px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => {
                    triggerFirstClickTip('board_ai_lineup', currentUserId);
                    void handleGenerateAiLineup(false);
                  }}
                  className="btn-studio inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-indigo-700 border-b-[3px] bg-indigo-600 px-3 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
                >
                  <Wand2 className="h-4 w-4 shrink-0" />
                  <span>Escalar c/ IA</span>
                </button>

                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => void runAiAssistant('quick')}
                  className="btn-studio inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-slate-50 px-3 text-xs font-bold text-slate-800 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                >
                  <Zap className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>Dica Rápida</span>
                </button>

                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => void runAiAssistant('deep')}
                  className="btn-studio inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                >
                  <Brain className="h-4 w-4 shrink-0" />
                  <span>Análise Tática</span>
                </button>
              </div>

              {/* Official OVR-based Team Recommendation Strip */}
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-1.5 text-xs font-extrabold text-amber-950">
                      <Award className="h-4 w-4 text-amber-600" />
                      <span>Recomendação de Time por Over (IA)</span>
                    </p>
                    <p className="font-mono-tabular mt-0.5 text-[11px] text-amber-800">
                      {allAthletesHaveOvr
                        ? `Todos os ${athletes.length} atletas têm Over — pronto para escalar o time ideal!`
                        : `${ovrEvaluatedCount}/${athletes.length} atletas com Over avaliado. Complete todos para recomendar o time ideal.`}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={aiLoading || !allAthletesHaveOvr}
                    onClick={() => {
                      triggerFirstClickTip('board_ovr_recommend', currentUserId);
                      void handleGenerateAiLineup(true);
                    }}
                    className="btn-studio inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-amber-600 border-b-[3px] bg-amber-400 px-3.5 text-xs font-extrabold text-slate-950 hover:bg-amber-300 disabled:opacity-45 cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Recomendar Time Ideal</span>
                  </button>
                </div>
              </div>

              {aiLoading && (
                <p className="mt-2.5 text-xs text-slate-500">
                  {aiModeUsed === 'ovr_lineup'
                    ? 'Comparando os OVRs de todos os atletas para montar o melhor time...'
                    : aiModeUsed === 'lineup'
                      ? 'Montando titulares, reservas, capitão e posições com IA...'
                      : aiModeUsed === 'deep'
                        ? 'Processando análise tática avançada...'
                        : 'Gerando dica rápida...'}
                </p>
              )}

              {aiError && (
                <div className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  {aiError}
                </div>
              )}

              {aiLineupPreview && !aiLoading && (
                <div className="mt-3 space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="inline-flex items-center gap-1 text-[11px] font-extrabold text-indigo-800 uppercase">
                        <Sparkles className="h-3.5 w-3.5" />
                        Sugestão de Escalação ({aiLineupPreview.formation})
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-700">
                        {aiLineupPreview.summary}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleApplyAiLineup()}
                      className="btn-studio inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-3.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                    >
                      <Check className="h-4 w-4" />
                      <span>Aplicar no Campo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiLineupPreview(null)}
                      className="min-h-[38px] rounded-xl px-3 text-xs font-semibold text-slate-600 hover:bg-white cursor-pointer"
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              )}

              {aiResponse && !aiLoading && (
                <div className="mt-3 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-bold text-emerald-700">
                    {aiModeUsed === 'deep'
                      ? 'Análise Tática Profunda (IA)'
                      : 'Dica Rápida (IA)'}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-700">
                    {aiResponse}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Player or Coaching Staff Modal */}
      {(showAddModal || selectedMember) && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl font-bold text-slate-900">
                  {showAddModal
                    ? 'Adicionar ao Time'
                    : selectedMember && isStaffPosition(selectedMember.position)
                      ? `Editar ${selectedMember.position}`
                      : `Editar #${selectedMember?.jerseyNumber}`}
                </h3>
                <p className="text-xs text-slate-500">
                  {showAddModal
                    ? 'Adicione jogador titular, reserva ou membro da comissão técnica.'
                    : 'Tudo editável: nome, camisa, posição, titularidade e capitão.'}
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedMemberId(null);
                  setFeedbackError(null);
                }}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) =>
                void (showAddModal ? handleAddGuestPlayer(e) : handleSaveMemberEdit(e))
              }
              className="mt-4 space-y-4"
            >
              <div>
                <label htmlFor="modal-player-name" className="block text-xs font-semibold text-slate-700">
                  Nome
                </label>
                <input
                  id="modal-player-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  maxLength={FIELD_LIMITS.MAX_PLAYER_NAME}
                  placeholder="Ex: Matheus Silva"
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className={formIsStaff ? 'sm:col-span-2' : ''}>
                  <label htmlFor="modal-player-pos" className="block text-xs font-semibold text-slate-700">
                    Posição ou Comissão Técnica
                  </label>
                  <select
                    id="modal-player-pos"
                    value={formPosition}
                    onChange={(e) => handleSelectPositionInModal(e.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                  >
                    <optgroup label={`Posições de ${sportCfg.label}`}>
                      {sportCfg.positions.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Comissão Técnica">
                      {STAFF_POSITIONS.map((staffRole) => (
                        <option key={staffRole} value={staffRole}>
                          {staffRole}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {!formIsStaff && (
                  <div>
                    <label htmlFor="modal-player-jersey" className="block text-xs font-semibold text-slate-700">
                      Camisa (1–99)
                    </label>
                    <input
                      id="modal-player-jersey"
                      type="number"
                      min={1}
                      max={99}
                      value={formJersey}
                      onChange={(e) =>
                        setFormJersey(Math.max(1, Math.min(99, Number(e.target.value) || 1)))
                      }
                      className={`font-mono-tabular mt-1 min-h-[44px] w-full rounded-xl border bg-slate-50 px-3.5 text-sm font-bold focus:bg-white focus:outline-none ${
                        activeAddConflict || activeEditConflict
                          ? 'border-red-500 text-red-700'
                          : 'border-slate-200 text-slate-900 focus:border-emerald-500'
                      }`}
                    />
                  </div>
                )}
              </div>

              {!formIsStaff && (activeAddConflict || activeEditConflict) && (
                <div
                  role="alert"
                  className="rounded-xl border border-amber-300 bg-amber-50 p-3.5"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <div className="text-xs">
                      <p className="font-bold text-amber-900">
                        Número #{formJersey} já está em uso!
                      </p>
                      <p className="mt-0.5 text-amber-800">
                        Pertence a{' '}
                        <strong>
                          {(activeAddConflict || activeEditConflict)?.name} (
                          {(activeAddConflict || activeEditConflict)?.position})
                        </strong>
                        .
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {freeJerseys.map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setFormJersey(n)}
                            className="font-mono-tabular rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:border-emerald-500 cursor-pointer"
                          >
                            #{n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Same-position reserve prompt inside Add/Edit Modal */}
              {!formIsStaff && samePositionStarterConflict && (
                <div
                  role="status"
                  className="rounded-xl border border-indigo-200 bg-indigo-50 p-3.5"
                >
                  <p className="text-xs font-bold text-indigo-950">
                    Já existe titular como {formPosition}: {samePositionStarterConflict.name} (#
                    {samePositionStarterConflict.jerseyNumber}).
                  </p>
                  <p className="mt-0.5 text-xs text-indigo-800">
                    Deseja colocar este jogador na <strong>Escalação Reserva</strong>?
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormIsStarter(false)}
                      className={`btn-studio min-h-[38px] rounded-xl border text-xs font-bold cursor-pointer ${
                        !formIsStarter
                          ? 'border-indigo-700 border-b-[3px] bg-indigo-600 text-white'
                          : 'border-indigo-200 bg-white text-indigo-900'
                      }`}
                    >
                      Sim, é Reserva
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormIsStarter(true)}
                      className={`btn-studio min-h-[38px] rounded-xl border text-xs font-bold cursor-pointer ${
                        formIsStarter
                          ? 'border-emerald-700 border-b-[3px] bg-emerald-600 text-white'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      Não, Titular
                    </button>
                  </div>
                </div>
              )}

              {!formIsStaff && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormIsStarter(true)}
                    className={`btn-studio min-h-[42px] rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                      formIsStarter
                        ? 'border-emerald-600 border-b-[3px] bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-slate-50 text-slate-500'
                    }`}
                  >
                    Titular
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormIsStarter(false)}
                    className={`btn-studio min-h-[42px] rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                      !formIsStarter
                        ? 'border-indigo-600 border-b-[3px] bg-indigo-50 text-indigo-800'
                        : 'border-slate-200 bg-slate-50 text-slate-500'
                    }`}
                  >
                    Reserva
                  </button>
                </div>
              )}

              {!formIsStaff && (
                <button
                  type="button"
                  onClick={() => setFormIsCaptain((prev) => !prev)}
                  className={`flex min-h-[42px] w-full items-center justify-between rounded-xl border px-3.5 text-xs font-bold transition-colors cursor-pointer ${
                    formIsCaptain
                      ? 'border-amber-400 bg-amber-50 text-amber-950'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-amber-600" />
                    <span>Capitão do Time (Faixa C)</span>
                  </span>
                  <span>{formIsCaptain ? 'Ativo ✓' : 'Selecionar'}</span>
                </button>
              )}

              {formIsStaff && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-xs text-sky-900">
                  Membro da <strong>Comissão Técnica ({formPosition})</strong> — exibido na barra
                  técnica, com acesso ao Quadro de Jogadas.
                </div>
              )}

              {feedbackError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                  {feedbackError}
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-1">
                {!showAddModal &&
                  selectedMember &&
                  (selectedMember.role === 'guest' || selectedMember.userId === currentUserId) && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleDeleteGuest(selectedMember)}
                      className="btn-studio inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-red-200 border-b-[3px] bg-red-50 px-3.5 text-xs font-bold text-red-700 hover:bg-red-100 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Remover</span>
                    </button>
                  )}
                <button
                  type="submit"
                  disabled={saving || !!(!formIsStaff && (activeAddConflict || activeEditConflict))}
                  className="btn-studio ml-auto inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                >
                  {showAddModal ? <Plus className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                  <span>{saving ? 'Salvando...' : showAddModal ? 'Adicionar' : 'Salvar'}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* Player Details, OVR & Exercises Modal */}
      {detailMember && (
        <PlayerDetailModal
          member={detailMember}
          sport={team.sport}
          isCaptain={team.captainMemberId === detailMember.id}
          isCurrentUser={detailMember.userId === currentUserId}
          onClose={() => setDetailMemberId(null)}
          onOpenEdit={() => {
            const target = detailMember;
            setDetailMemberId(null);
            openEditor(target);
          }}
          onOpenOvrTest={() => {
            const target = detailMember;
            setDetailMemberId(null);
            setOvrTestMemberId(target.id);
          }}
          onToggleCaptain={() => void handleSetCaptain(detailMember)}
          onStartSwap={() => {
            const target = detailMember;
            setDetailMemberId(null);
            handlePickForSwap(target);
          }}
          onToggleStarter={() => void handleToggleStarter(detailMember)}
          onResetOvrAnalysis={() => void handleResetOvrAnalysis(detailMember)}
        />
      )}

      {/* OVR Video Evaluation Modal */}
      {ovrTestMember && (
        <OvrTestModal
          member={ovrTestMember}
          sport={team.sport}
          onClose={() => setOvrTestMemberId(null)}
          onSubmitVideos={handleSubmitOvrVideos}
          onResetAnalysis={handleResetOvrAnalysis}
        />
      )}
    </div>
  );
};
