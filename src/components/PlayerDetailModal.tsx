import React, { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowUpDown,
  Clock,
  Crown,
  Dumbbell,
  Edit3,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Video,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { getOvrTierInfo } from '../data/ovrDrills';
import { formatCountdownMs } from '../lib/videoUpload';
import { isStaffPosition, SPORTS_CONFIG, SportId, TeamMember } from '../types/studio';

interface PlayerDetailModalProps {
  member: TeamMember;
  sport: SportId;
  isCaptain: boolean;
  isCurrentUser: boolean;
  onClose: () => void;
  onOpenEdit: () => void;
  onOpenOvrTest: () => void;
  onToggleCaptain: () => void;
  onStartSwap: () => void;
  onToggleStarter: () => void;
  onResetOvrAnalysis?: () => void;
}

export const PlayerDetailModal: React.FC<PlayerDetailModalProps> = ({
  member,
  sport,
  isCaptain,
  isCurrentUser,
  onClose,
  onOpenEdit,
  onOpenOvrTest,
  onToggleCaptain,
  onStartSwap,
  onToggleStarter,
  onResetOvrAnalysis,
}) => {
  const sportLabel = SPORTS_CONFIG[sport].label;
  const isStaff = isStaffPosition(member.position);
  const hasOvr = !isStaff && typeof member.ovrRating === 'number' && member.ovrRating > 0;
  const isAnalyzing = !isStaff && member.ovrStatus === 'analyzing';

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!isAnalyzing) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isAnalyzing]);

  const elapsedMs = Math.max(0, nowMs - (member.ovrReadyAtMs || nowMs));
  const tier = hasOvr ? getOvrTierInfo(member.ovrRating!) : null;
  const statEntries = Object.entries(member.ovrStats || {});
  const exercises = member.ovrExercises || [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-detail-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
      >
        {/* Top Athlete Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-[#F6F8FB] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3.5">
            {!isStaff ? (
              <div className="relative flex items-center gap-1.5">
                <div className="font-display flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-700 border-b-[4px] bg-emerald-600 text-2xl font-extrabold text-white tabular-nums shadow-sm">
                  {member.jerseyNumber}
                </div>
                {hasOvr && tier ? (
                  <div
                    className={`flex flex-col items-center justify-center rounded-xl border px-2.5 py-1 shadow-xs ${tier.badgeClass}`}
                  >
                    <span className="text-[9px] font-extrabold uppercase tracking-wider opacity-80">
                      OVR
                    </span>
                    <span className="font-display text-xl font-black leading-none tabular-nums">
                      {member.ovrRating}
                    </span>
                  </div>
                ) : isAnalyzing ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1 text-amber-900">
                    <span className="text-[9px] font-extrabold uppercase">IA</span>
                    <span className="font-mono-tabular text-xs font-extrabold">
                      {formatCountdownMs(elapsedMs)}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="font-display flex h-12 items-center justify-center rounded-xl border border-sky-300 bg-sky-50 px-3 text-sm font-extrabold text-sky-900">
                Comissão
              </div>
            )}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3
                  id="player-detail-title"
                  className="font-display truncate text-xl font-extrabold text-slate-900 sm:text-2xl"
                >
                  {member.name}
                </h3>
                {isCurrentUser && (
                  <span className="text-xs font-bold text-emerald-700">(Você)</span>
                )}
              </div>
              <p className="mt-0.5 text-xs font-semibold text-slate-600">
                <span>{sportLabel}</span>
                <span aria-hidden="true"> · </span>
                <span>{member.position}</span>
                {!isStaff && (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span className={member.isStarter ? 'text-emerald-700' : 'text-indigo-700'}>
                      {member.isStarter ? 'Titular' : 'Reserva'}
                    </span>
                    <span aria-hidden="true"> · </span>
                    <span className="font-mono-tabular">Camisa #{member.jerseyNumber}</span>
                  </>
                )}
                {isCaptain && (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span className="font-extrabold text-amber-700">Capitão (C)</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar ficha do jogador"
            className="flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl text-slate-400 hover:bg-slate-200/70 hover:text-slate-900 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
          {/* OVR & AI Evaluation Section for Athletes */}
          {!isStaff && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              {isAnalyzing ? (
                <div className="space-y-2.5 text-center py-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 text-amber-600">
                    <Sparkles className="h-6 w-6 animate-pulse" />
                  </div>
                  <p className="font-display text-lg font-extrabold text-slate-900">
                    IA analisando vídeos do Teste de Over
                  </p>
                  <p className="text-xs leading-relaxed text-slate-600">
                    A comissão técnica de IA está avaliando técnica, precisão, controle e postura
                    em tempo real.
                  </p>
                  <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 font-mono-tabular text-sm font-extrabold text-amber-900">
                    <Clock className="h-4 w-4" />
                    <span>Analisando há {formatCountdownMs(elapsedMs)}</span>
                  </div>
                  {onResetOvrAnalysis && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={onResetOvrAnalysis}
                        className="btn-studio inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Cancelar / Refazer Teste</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : hasOvr && tier ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase">
                        Avaliação Oficial em Vídeo
                      </p>
                      <p className="font-display text-lg font-extrabold text-slate-900">
                        OVR {member.ovrRating} · {tier.label}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenOvrTest}
                      className="btn-studio inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-3.5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
                    >
                      <Video className="h-3.5 w-3.5" />
                      <span>Refazer Teste de Over</span>
                    </button>
                  </div>

                  {statEntries.length > 0 && (
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {statEntries.map(([attr, val]) => {
                        const score = Math.max(1, Math.min(99, Number(val) || 50));
                        const attrTier = getOvrTierInfo(score);
                        return (
                          <div key={attr} className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                              <span className="truncate">{attr}</span>
                              <span className="font-mono-tabular">{score}</span>
                            </div>
                            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                              <div
                                className={`h-full rounded-full ${attrTier.barClass}`}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {member.ovrSummary && (
                    <div className="rounded-xl border border-slate-200 bg-[#F6F8FB] p-3.5">
                      <p className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        <span>Parecer Sincero da IA</span>
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-700">
                        {member.ovrSummary}
                      </p>
                    </div>
                  )}

                  {exercises.length > 0 && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
                      <p className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-900">
                        <Dumbbell className="h-4 w-4 text-emerald-700" />
                        <span>Exercícios Recomendados para Subir o Over</span>
                      </p>
                      <ul className="mt-2 space-y-1.5 text-xs text-emerald-950">
                        {exercises.map((ex, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="font-mono-tabular font-extrabold text-emerald-700">
                              {i + 1}.
                            </span>
                            <span className="leading-relaxed">{ex}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 text-center py-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-display text-lg font-extrabold text-slate-900">
                      Atleta ainda sem Over oficial
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Envie vídeos de fundamentos específicos de <strong>{member.position}</strong>{' '}
                      para a IA avaliar sinceramente, calcular o OVR e recomendar exercícios.
                    </p>
                  </div>
                  {member.ovrStatus === 'error' && member.ovrSummary && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      Última tentativa: {member.ovrSummary}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={onOpenOvrTest}
                    className="btn-studio inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
                  >
                    <Video className="h-4 w-4" />
                    <span>Fazer Teste de Over (Enviar Vídeos)</span>
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onOpenEdit}
              className="btn-studio flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-white px-3 text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              <Edit3 className="h-4 w-4 text-emerald-600" />
              <span>Editar Dados</span>
            </button>

            {!isStaff && (
              <>
                <button
                  type="button"
                  onClick={onToggleCaptain}
                  className={`btn-studio flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-b-[3px] px-3 text-xs font-bold cursor-pointer ${
                    isCaptain
                      ? 'border-amber-500 bg-amber-100 text-amber-950'
                      : 'border-slate-200 border-b-slate-300 bg-white text-slate-800 hover:bg-amber-50'
                  }`}
                >
                  <Crown className="h-4 w-4 text-amber-600" />
                  <span>{isCaptain ? 'Remover Capitão' : 'Tornar Capitão'}</span>
                </button>

                <button
                  type="button"
                  onClick={onStartSwap}
                  className="btn-studio flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-white px-3 text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer"
                >
                  <ArrowLeftRight className="h-4 w-4 text-indigo-600" />
                  <span>Trocar Posição</span>
                </button>

                <button
                  type="button"
                  onClick={onToggleStarter}
                  className="btn-studio flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-white px-3 text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer"
                >
                  <ArrowUpDown className="h-4 w-4 text-emerald-600" />
                  <span>{member.isStarter ? 'Mover p/ Reserva' : 'Promover Titular'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
