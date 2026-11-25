import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  AlertTriangle,
  Clock,
  Flag,
  Pause,
  Play,
  Plus,
  Square,
  Trophy,
} from 'lucide-react';
import { motion } from 'motion/react';
import { db, formatFriendlyFirebaseError, handleFirestoreError, OperationType } from '../lib/firebase';
import { createClientId } from '../lib/imageUtils';
import {
  FIELD_LIMITS,
  Match,
  MatchEvent,
  MatchEventType,
  SPORTS_CONFIG,
  Team,
  TeamMember,
} from '../types/studio';

interface LiveMatchCenterProps {
  team: Team;
  members: TeamMember[];
  currentUserId: string;
}

export const LiveMatchCenter: React.FC<LiveMatchCenterProps> = ({
  team,
  members,
  currentUserId,
}) => {
  const sportCfg = SPORTS_CONFIG[team.sport];
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const [showNewForm, setShowNewForm] = useState(false);
  const [opponent, setOpponent] = useState('');
  const [location, setLocation] = useState('');
  const [halfDuration, setHalfDuration] = useState<number>(sportCfg.defaultHalfMinutes);
  const [startImmediately, setStartImmediately] = useState(true);

  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [eventNote, setEventNote] = useState('');
  const [confirmEndMatch, setConfirmEndMatch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const matchesPath = `teams/${team.id}/matches`;
    const q = query(collection(db, 'teams', team.id, 'matches'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Match);
        setMatches(list);
        if (list.length > 0 && (!selectedMatchId || !list.some((m) => m.id === selectedMatchId))) {
          const liveMatch = list.find((m) => m.status === 'live');
          setSelectedMatchId(liveMatch ? liveMatch.id : list[0].id);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, matchesPath);
      }
    );
    return () => unsub();
  }, [team.id, selectedMatchId]);

  const activeMatch = useMemo(
    () => matches.find((m) => m.id === selectedMatchId) || null,
    [matches, selectedMatchId]
  );

  useEffect(() => {
    if (!activeMatch) {
      setEvents([]);
      return;
    }
    const eventsPath = `teams/${team.id}/matches/${activeMatch.id}/events`;
    const q = query(
      collection(db, 'teams', team.id, 'matches', activeMatch.id, 'events'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEvents(snap.docs.map((d) => d.data() as MatchEvent));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, eventsPath);
      }
    );
    return () => unsub();
  }, [team.id, activeMatch?.id]);

  useEffect(() => {
    if (!activeMatch?.isClockRunning) return;
    setNowMs(Date.now());
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeMatch?.isClockRunning, activeMatch?.id]);

  useEffect(() => {
    if (members.length > 0 && !selectedPlayerId) {
      setSelectedPlayerId(members[0].id);
    }
  }, [members, selectedPlayerId]);

  const computeTotalElapsedSeconds = (match: Match): number => {
    if (match.isClockRunning && match.lastStartedAtMs > 0) {
      const deltaSec = Math.max(0, Math.floor((nowMs - match.lastStartedAtMs) / 1000));
      return match.elapsedSeconds + deltaSec;
    }
    return match.elapsedSeconds;
  };

  const formatClock = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const currentElapsedSec = activeMatch ? computeTotalElapsedSeconds(activeMatch) : 0;
  const currentMinute = Math.floor(currentElapsedSec / 60);
  const regularMinutesLimit = activeMatch ? activeMatch.halfDurationMinutes : sportCfg.defaultHalfMinutes;
  const isInExtraTime = activeMatch ? currentMinute >= regularMinutesLimit : false;

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedOpponent = opponent.trim();
    if (!trimmedOpponent) {
      setError('Informe o nome do time adversário.');
      return;
    }

    setBusy(true);
    const matchId = createClientId('match');
    const nowEpoch = Date.now();
    try {
      const batch = writeBatch(db);
      const now = serverTimestamp();

      batch.set(doc(db, 'teams', team.id, 'matches', matchId), {
        id: matchId,
        teamId: team.id,
        opponent: trimmedOpponent,
        location: location.trim(),
        status: startImmediately ? 'live' : 'scheduled',
        teamScore: 0,
        opponentScore: 0,
        halfDurationMinutes: Math.max(1, Math.min(120, halfDuration || sportCfg.defaultHalfMinutes)),
        extraMinutes: 0,
        elapsedSeconds: 0,
        isClockRunning: startImmediately,
        lastStartedAtMs: startImmediately ? nowEpoch : 0,
        createdBy: currentUserId,
        createdAt: now,
        updatedAt: now,
      });

      await batch.commit();
      setSelectedMatchId(matchId);
      setOpponent('');
      setLocation('');
      setShowNewForm(false);
    } catch (err) {
      setError(formatFriendlyFirebaseError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleToggleClock = async () => {
    if (!activeMatch || activeMatch.status === 'finished') return;
    setError(null);
    setBusy(true);
    try {
      const batch = writeBatch(db);
      const nowEpoch = Date.now();
      const totalSec = computeTotalElapsedSeconds(activeMatch);

      if (activeMatch.isClockRunning) {
        batch.update(doc(db, 'teams', team.id, 'matches', activeMatch.id), {
          elapsedSeconds: totalSec,
          isClockRunning: false,
          lastStartedAtMs: 0,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.update(doc(db, 'teams', team.id, 'matches', activeMatch.id), {
          status: 'live',
          isClockRunning: true,
          lastStartedAtMs: nowEpoch,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (err) {
      setError(formatFriendlyFirebaseError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateExtraMinutes = async (delta: number) => {
    if (!activeMatch || activeMatch.status === 'finished') return;
    const next = Math.max(0, Math.min(60, activeMatch.extraMinutes + delta));
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'teams', team.id, 'matches', activeMatch.id), {
        extraMinutes: next,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (err) {
      setError(formatFriendlyFirebaseError(err));
    }
  };

  const handleFinishMatch = async () => {
    if (!activeMatch || activeMatch.status === 'finished') return;
    setBusy(true);
    setError(null);
    try {
      const batch = writeBatch(db);
      const finalSec = computeTotalElapsedSeconds(activeMatch);
      batch.update(doc(db, 'teams', team.id, 'matches', activeMatch.id), {
        status: 'finished',
        elapsedSeconds: finalSec,
        isClockRunning: false,
        lastStartedAtMs: 0,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      setConfirmEndMatch(false);
    } catch (err) {
      setError(formatFriendlyFirebaseError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleLogEvent = async (type: MatchEventType) => {
    if (!activeMatch || activeMatch.status === 'finished') return;
    setError(null);

    const player = members.find((m) => m.id === selectedPlayerId) || members[0];
    if (!player && type !== 'opponent_goal') {
      setError('Selecione um jogador do elenco para registrar o evento.');
      return;
    }

    const eventId = createClientId('evt');
    const sec = computeTotalElapsedSeconds(activeMatch);
    const min = Math.floor(sec / 60);
    const extra = min > activeMatch.halfDurationMinutes ? min - activeMatch.halfDurationMinutes : 0;
    const displayMinute = min > activeMatch.halfDurationMinutes ? activeMatch.halfDurationMinutes : min;

    setBusy(true);
    try {
      const batch = writeBatch(db);
      const now = serverTimestamp();

      batch.set(doc(db, 'teams', team.id, 'matches', activeMatch.id, 'events', eventId), {
        id: eventId,
        teamId: team.id,
        matchId: activeMatch.id,
        type,
        playerId: type === 'opponent_goal' ? '' : player.id,
        playerName: type === 'opponent_goal' ? activeMatch.opponent : player.name,
        playerJersey: type === 'opponent_goal' ? 0 : player.jerseyNumber,
        minute: displayMinute,
        extraMinute: extra,
        note: eventNote.trim(),
        createdBy: currentUserId,
        createdAt: now,
      });

      if (type === 'goal') {
        batch.update(doc(db, 'teams', team.id, 'matches', activeMatch.id), {
          teamScore: activeMatch.teamScore + 1,
          updatedAt: now,
        });
      } else if (type === 'opponent_goal') {
        batch.update(doc(db, 'teams', team.id, 'matches', activeMatch.id), {
          opponentScore: activeMatch.opponentScore + 1,
          updatedAt: now,
        });
      }

      await batch.commit();
      setEventNote('');
    } catch (err) {
      setError(formatFriendlyFirebaseError(err));
    } finally {
      setBusy(false);
    }
  };

  const summaryStats = useMemo(() => {
    return {
      goals: events.filter((e) => e.type === 'goal').length,
      yellows: events.filter((e) => e.type === 'yellow_card').length,
      reds: events.filter((e) => e.type === 'red_card').length,
      fouls: events.filter((e) => e.type === 'foul').length,
    };
  }, [events]);

  const eventLabel = (type: MatchEventType) => {
    switch (type) {
      case 'goal':
        return sportCfg.id === 'basquete' || sportCfg.id === 'volei' ? 'Ponto' : 'Gol';
      case 'opponent_goal':
        return `${sportCfg.id === 'basquete' || sportCfg.id === 'volei' ? 'Ponto' : 'Gol'} Adversário`;
      case 'yellow_card':
        return 'Cartão Amarelo';
      case 'red_card':
        return 'Cartão Vermelho';
      case 'foul':
        return 'Falta';
    }
  };

  return (
    <div className="space-y-4">
      {/* Compact Header & Match Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">
            Partidas Ao Vivo · {sportCfg.label}
          </h2>
          <p className="text-xs text-slate-500">
            Cronômetro em tempo real, acréscimos, gols, faltas e cartões.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowNewForm((prev) => !prev)}
          className="btn-studio inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-500 whitespace-nowrap cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>{showNewForm ? 'Cancelar' : 'Nova Partida'}</span>
        </button>
      </div>

      {showNewForm && (
        <motion.form
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={(e) => void handleCreateMatch(e)}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="match-opponent" className="block text-xs font-semibold text-slate-700">
                Adversário
              </label>
              <input
                id="match-opponent"
                type="text"
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                maxLength={FIELD_LIMITS.MAX_OPPONENT_NAME}
                placeholder="Ex: Real Estrela"
                className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="match-location" className="block text-xs font-semibold text-slate-700">
                Local / Quadra
              </label>
              <input
                id="match-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={FIELD_LIMITS.MAX_LOCATION}
                placeholder="Ex: Arena Central"
                className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="match-duration" className="block text-xs font-semibold text-slate-700">
                Tempo Regulamentar (min)
              </label>
              <input
                id="match-duration"
                type="number"
                min={1}
                max={120}
                value={halfDuration}
                onChange={(e) =>
                  setHalfDuration(Number(e.target.value) || sportCfg.defaultHalfMinutes)
                }
                className="font-mono-tabular mt-1 min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={startImmediately}
                onChange={(e) => setStartImmediately(e.target.checked)}
                className="h-4 w-4 accent-emerald-600"
              />
              <span>Iniciar partida ao vivo agora</span>
            </label>

            <button
              type="submit"
              disabled={busy}
              className="btn-studio min-h-[42px] rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-60 cursor-pointer"
            >
              {busy ? 'Criando...' : 'Confirmar Partida'}
            </button>
          </div>
        </motion.form>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          {error}
        </div>
      )}

      {matches.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {matches.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setSelectedMatchId(m.id);
                setConfirmEndMatch(false);
              }}
              className={`min-h-[38px] shrink-0 rounded-xl border px-3.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                m.id === activeMatch?.id
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900'
              }`}
            >
              {m.status === 'live' ? 'AO VIVO · ' : m.status === 'finished' ? 'ENCERRADA · ' : ''}
              {team.name} {m.teamScore} × {m.opponentScore} {m.opponent}
            </button>
          ))}
        </div>
      )}

      {!activeMatch ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-xs">
          <Trophy className="mx-auto h-8 w-8 text-emerald-600" />
          <h3 className="font-display mt-3 text-2xl font-bold text-slate-900">
            Nenhuma partida registrada ainda
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Crie a primeira partida para acionar o cronômetro ao vivo, acréscimos, gols, faltas e cartões.
          </p>
          <button
            type="button"
            onClick={() => setShowNewForm(true)}
            className="btn-studio mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-500 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Iniciar Primeira Partida</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
          {/* Left: Scoreboard + Clock + Event Buttons (Compact so all buttons fit without scrolling) */}
          <div className="space-y-4 lg:col-span-7">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2 text-xs font-bold">
                  {activeMatch.status === 'live' && (
                    <span className="inline-flex items-center gap-2 text-red-600">
                      <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                      <span>AO VIVO</span>
                    </span>
                  )}
                  {activeMatch.status === 'scheduled' && (
                    <span className="text-slate-600">AGUARDANDO INÍCIO</span>
                  )}
                  {activeMatch.status === 'finished' && (
                    <span className="text-emerald-700">ENCERRADA</span>
                  )}
                  {activeMatch.location && (
                    <>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="text-slate-500">{activeMatch.location}</span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-600" />
                  <span className="font-mono-tabular text-2xl font-bold text-slate-900">
                    {formatClock(currentElapsedSec)}
                  </span>
                  {activeMatch.extraMinutes > 0 && (
                    <span className="font-mono-tabular text-sm font-bold text-amber-600">
                      +{activeMatch.extraMinutes}&apos;
                    </span>
                  )}
                </div>
              </div>

              {/* Scoreboard */}
              <div className="my-4 grid grid-cols-3 items-center gap-3 text-center">
                <div>
                  <p className="truncate text-xs font-bold text-emerald-700">Nosso Time</p>
                  <p className="font-display mt-0.5 truncate text-xl font-extrabold text-slate-900 sm:text-2xl">
                    {team.name}
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2.5">
                  <span className="font-display text-4xl font-extrabold text-slate-900 tabular-nums sm:text-5xl">
                    {activeMatch.teamScore}
                  </span>
                  <span className="text-lg text-slate-400">×</span>
                  <span className="font-display text-4xl font-extrabold text-slate-900 tabular-nums sm:text-5xl">
                    {activeMatch.opponentScore}
                  </span>
                </div>

                <div>
                  <p className="truncate text-xs font-semibold text-slate-500">Adversário</p>
                  <p className="font-display mt-0.5 truncate text-xl font-extrabold text-slate-900 sm:text-2xl">
                    {activeMatch.opponent}
                  </p>
                </div>
              </div>

              {/* Discipline Counters */}
              <div className="grid grid-cols-4 gap-2 border-t border-slate-100 pt-3 text-center">
                <div>
                  <p className="text-[11px] font-medium text-slate-500">{sportCfg.scoreLabel}</p>
                  <p className="font-mono-tabular text-base font-bold text-emerald-700">
                    {summaryStats.goals}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-500">Amarelos</p>
                  <p className="font-mono-tabular text-base font-bold text-amber-600">
                    {summaryStats.yellows}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-500">Vermelhos</p>
                  <p className="font-mono-tabular text-base font-bold text-red-600">
                    {summaryStats.reds}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-500">Faltas</p>
                  <p className="font-mono-tabular text-base font-bold text-slate-800">
                    {summaryStats.fouls}
                  </p>
                </div>
              </div>

              {/* All Match Controls in one tight row */}
              {activeMatch.status !== 'finished' && (
                <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleToggleClock()}
                      className={`btn-studio inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-b-[3px] px-4 text-xs font-bold cursor-pointer ${
                        activeMatch.isClockRunning
                          ? 'border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100'
                          : 'border-emerald-700 bg-emerald-600 text-white hover:bg-emerald-500'
                      }`}
                    >
                      {activeMatch.isClockRunning ? (
                        <>
                          <Pause className="h-4 w-4" />
                          <span>Pausar Tempo</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          <span>
                            {activeMatch.status === 'scheduled' ? 'Iniciar Ao Vivo' : 'Retomar'}
                          </span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-600">Acréscimos:</span>
                      <button
                        type="button"
                        onClick={() => void handleUpdateExtraMinutes(-1)}
                        className="btn-studio min-h-[38px] min-w-[38px] rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-slate-50 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        -1&apos;
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleUpdateExtraMinutes(1)}
                        className="btn-studio min-h-[38px] min-w-[38px] rounded-xl border border-amber-300 border-b-[3px] bg-amber-50 text-xs font-bold text-amber-800 hover:bg-amber-100 cursor-pointer"
                      >
                        +1&apos;
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleUpdateExtraMinutes(3)}
                        className="btn-studio min-h-[38px] rounded-xl border border-amber-300 border-b-[3px] bg-amber-50 px-3 text-xs font-bold text-amber-800 hover:bg-amber-100 cursor-pointer"
                      >
                        +3&apos;
                      </button>
                    </div>

                    {!confirmEndMatch ? (
                      <button
                        type="button"
                        onClick={() => setConfirmEndMatch(true)}
                        className="btn-studio inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-red-200 border-b-[3px] border-b-red-300 bg-red-50 px-3.5 text-xs font-bold text-red-700 hover:bg-red-100 cursor-pointer"
                      >
                        <Square className="h-3.5 w-3.5" />
                        <span>Encerrar</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setConfirmEndMatch(false)}
                          className="min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleFinishMatch()}
                          className="btn-studio min-h-[38px] rounded-xl border border-red-700 border-b-[3px] bg-red-600 px-3.5 text-xs font-bold text-white hover:bg-red-500 cursor-pointer"
                        >
                          Confirmar Fim
                        </button>
                      </div>
                    )}
                  </div>

                  {isInExtraTime && (
                    <p className="text-xs font-semibold text-amber-700">
                      Tempo regulamentar ({regularMinutesLimit}&apos;) concluído — partida nos acréscimos
                      {activeMatch.extraMinutes > 0 ? ` (+${activeMatch.extraMinutes} min)` : ''}.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Event Buttons Console */}
            {activeMatch.status !== 'finished' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="event-player" className="block text-xs font-semibold text-slate-700">
                      Jogador ({currentMinute}&apos;)
                    </label>
                    <select
                      id="event-player"
                      value={selectedPlayerId}
                      onChange={(e) => setSelectedPlayerId(e.target.value)}
                      className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                    >
                      {members
                        .slice()
                        .sort((a, b) => a.jerseyNumber - b.jerseyNumber)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.jerseyNumber > 0 ? `#${m.jerseyNumber} ` : ''}
                            {m.name} ({m.position})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="event-note" className="block text-xs font-semibold text-slate-700">
                      Observação (opcional)
                    </label>
                    <input
                      id="event-note"
                      type="text"
                      value={eventNote}
                      onChange={(e) => setEventNote(e.target.value)}
                      maxLength={FIELD_LIMITS.MAX_NOTE}
                      placeholder="Ex: Falta tática / Pênalti"
                      className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleLogEvent('goal')}
                    className="btn-studio min-h-[44px] rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-2.5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
                  >
                    + {sportCfg.id === 'basquete' || sportCfg.id === 'volei' ? 'Ponto' : 'Gol'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleLogEvent('yellow_card')}
                    className="btn-studio min-h-[44px] rounded-xl border border-amber-400 border-b-[3px] bg-amber-100 px-2.5 text-xs font-bold text-amber-900 hover:bg-amber-200 cursor-pointer"
                  >
                    Amarelo
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleLogEvent('red_card')}
                    className="btn-studio min-h-[44px] rounded-xl border border-red-300 border-b-[3px] bg-red-100 px-2.5 text-xs font-bold text-red-900 hover:bg-red-200 cursor-pointer"
                  >
                    Vermelho
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleLogEvent('foul')}
                    className="btn-studio min-h-[44px] rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-slate-100 px-2.5 text-xs font-bold text-slate-800 hover:bg-slate-200 cursor-pointer"
                  >
                    Falta
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleLogEvent('opponent_goal')}
                    className="btn-studio col-span-2 min-h-[44px] rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-white px-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 sm:col-span-1 cursor-pointer"
                  >
                    Adversário +1
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Live Timeline */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-5">
            <h3 className="font-display text-xl font-bold text-slate-900">
              Súmula em Tempo Real ({events.length})
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Gols, cartões amarelos, vermelhos e faltas registrados.
            </p>

            {events.length === 0 ? (
              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-6 text-center text-xs text-slate-500">
                Nenhum evento registrado nesta partida ainda.
              </div>
            ) : (
              <div className="mt-3 max-h-[380px] divide-y divide-slate-100 overflow-y-auto pr-1">
                {events.map((evt) => (
                  <motion.div
                    key={evt.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-3 py-2.5"
                  >
                    <span className="font-mono-tabular mt-0.5 w-11 shrink-0 text-xs font-bold text-slate-500">
                      {evt.minute}&apos;
                      {evt.extraMinute > 0 ? `+${evt.extraMinute}` : ''}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        {evt.type === 'yellow_card' && (
                          <span className="mr-1.5 inline-block h-3 w-2 rounded-[2px] border border-amber-500 bg-amber-400 align-middle" />
                        )}
                        {evt.type === 'red_card' && (
                          <span className="mr-1.5 inline-block h-3 w-2 rounded-[2px] border border-red-700 bg-red-600 align-middle" />
                        )}
                        {evt.type === 'goal' && (
                          <Trophy className="mr-1.5 inline h-3.5 w-3.5 text-emerald-600" />
                        )}
                        {evt.type === 'foul' && (
                          <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5 text-slate-500" />
                        )}
                        {evt.type === 'opponent_goal' && (
                          <Flag className="mr-1.5 inline h-3.5 w-3.5 text-slate-500" />
                        )}
                        <span>{eventLabel(evt.type)}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {evt.playerJersey > 0 ? `#${evt.playerJersey} ` : ''}
                        {evt.playerName}
                        {evt.note ? ` · ${evt.note}` : ''}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
