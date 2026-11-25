import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Clock,
  FileVideo,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { getDrillsForPosition, OvrDrillSpec } from '../data/ovrDrills';
import { formatCountdownMs, MAX_VIDEO_CLIP_BYTES } from '../lib/videoUpload';
import { SPORTS_CONFIG, SportId, TeamMember } from '../types/studio';

interface OvrTestModalProps {
  member: TeamMember;
  sport: SportId;
  onClose: () => void;
  onSubmitVideos: (
    member: TeamMember,
    selections: { drill: OvrDrillSpec; file: File }[],
    onStageChange?: (stage: 'uploading' | 'analyzing') => void
  ) => Promise<void>;
  onResetAnalysis?: (member: TeamMember) => Promise<void>;
}

export const OvrTestModal: React.FC<OvrTestModalProps> = ({
  member,
  sport,
  onClose,
  onSubmitVideos,
  onResetAnalysis,
}) => {
  const drills = useMemo(
    () => getDrillsForPosition(sport, member.position),
    [sport, member.position]
  );
  const sportLabel = SPORTS_CONFIG[sport].label;

  const [selectedFiles, setSelectedFiles] = useState<Record<string, File>>({});
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<'idle' | 'uploading' | 'analyzing'>('idle');
  const [resetting, setResetting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const isAnalyzing = member.ovrStatus === 'analyzing';

  useEffect(() => {
    if (!isAnalyzing && !submitting) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isAnalyzing, submitting]);

  const elapsedMs = Math.max(0, nowMs - (member.ovrReadyAtMs || nowMs));
  const pickedCount = Object.keys(selectedFiles).length;

  const handleFileChange = (drillId: string, file: File | null) => {
    setErrorMsg(null);
    if (!file) return;
    if (file.size > MAX_VIDEO_CLIP_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setErrorMsg(
        `O vídeo selecionado tem ${mb} MB. Envie um clipe de até 35 MB (10–30 segundos).`
      );
      return;
    }
    setSelectedFiles((prev) => ({ ...prev, [drillId]: file }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const selections = drills
      .filter((d) => Boolean(selectedFiles[d.id]))
      .map((d) => ({ drill: d, file: selectedFiles[d.id] }));

    if (selections.length === 0) {
      setErrorMsg('Envie pelo menos 1 vídeo executando os fundamentos da sua posição.');
      return;
    }

    setSubmitting(true);
    setStage('uploading');
    try {
      await onSubmitVideos(member, selections, (nextStage) => setStage(nextStage));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao enviar vídeos para avaliação.');
    } finally {
      setSubmitting(false);
      setStage('idle');
    }
  };

  const handleReset = async () => {
    if (!onResetAnalysis) return;
    setResetting(true);
    setErrorMsg(null);
    try {
      await onResetAnalysis(member);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível reiniciar o teste.');
    } finally {
      setResetting(false);
    }
  };

  const displayError =
    errorMsg || (member.ovrStatus === 'error' && member.ovrSummary ? member.ovrSummary : null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ovr-test-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-[#F6F8FB] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700">
              <Video className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-700">
                Teste de Over · {sportLabel} · {member.position}
              </p>
              <h2
                id="ovr-test-title"
                className="font-display text-xl font-extrabold text-slate-900 sm:text-2xl"
              >
                Avaliação Técnica de {member.name}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar Teste de Over"
            className="flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl text-slate-400 hover:bg-slate-200/70 hover:text-slate-900 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
          {isAnalyzing ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300 bg-white text-amber-600 shadow-xs">
                <Sparkles className="h-7 w-7 animate-pulse" />
              </div>
              <h3 className="font-display mt-3 text-2xl font-extrabold text-slate-900">
                IA Analisando Vídeos ao Vivo
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
                A IA está assistindo cada fundamento enviado para calcular seu OVR{' '}
                <strong>100% sincero</strong>, os 5 atributos da posição e os exercícios
                recomendados. Isso costuma levar de <strong>10 a 35 segundos</strong>.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-white px-5 py-2.5 font-mono-tabular text-base font-black text-amber-900 shadow-xs">
                <Clock className="h-4 w-4 text-amber-600" />
                <span>Tempo de análise: {formatCountdownMs(elapsedMs)}</span>
              </div>
              <p className="mt-3 text-[11px] text-slate-500">
                Você pode manter esta janela aberta para ver sua ficha assim que terminar, ou
                fechar e acompanhar pela prancheta.
              </p>
              {!submitting && onResetAnalysis && (
                <div className="mt-4">
                  <button
                    type="button"
                    disabled={resetting}
                    onClick={() => void handleReset()}
                    className="btn-studio inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{resetting ? 'Reiniciando...' : 'Cancelar / Enviar Novos Vídeos'}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <form id="ovr-test-form" onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-3.5 text-xs leading-relaxed text-sky-950">
                <p className="font-extrabold">Como funciona o Teste de Over com IA:</p>
                <p className="mt-1">
                  Envie vídeos curtos (10–30s) executando os fundamentos abaixo para{' '}
                  <strong>{member.position}</strong>. A IA analisa o vídeo de verdade quadro a
                  quadro, entrega seu OVR imediatamente ao concluir e recomenda exercícios reais
                  para você evoluir.
                </p>
              </div>

              <div className="space-y-3">
                {drills.map((drill, idx) => {
                  const chosen = selectedFiles[drill.id];
                  return (
                    <div
                      key={drill.id}
                      className={`rounded-2xl border p-4 transition-colors ${
                        chosen
                          ? 'border-emerald-300 bg-emerald-50/50'
                          : 'border-slate-200 bg-slate-50/60'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-extrabold text-slate-900">
                            {idx + 1}. {drill.title}{' '}
                            <span className="font-semibold text-emerald-700">
                              ({drill.focusAttribute})
                            </span>
                          </p>
                          <p className="mt-0.5 text-xs text-slate-600">{drill.instruction}</p>
                        </div>
                        <span className="text-[11px] font-bold text-slate-500">
                          {drill.required ? 'Recomendado' : 'Opcional'}
                        </span>
                      </div>

                      {chosen ? (
                        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            <span className="truncate text-xs font-bold text-slate-800">
                              {chosen.name}
                            </span>
                            <span className="font-mono-tabular shrink-0 text-[11px] text-slate-500">
                              ({(chosen.size / (1024 * 1024)).toFixed(1)} MB)
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() =>
                              setSelectedFiles((prev) => {
                                const copy = { ...prev };
                                delete copy[drill.id];
                                return copy;
                              })
                            }
                            aria-label="Remover vídeo"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <label className="btn-studio inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-3.5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer">
                            <Upload className="h-3.5 w-3.5" />
                            <span>Escolher Vídeo</span>
                            <input
                              type="file"
                              accept="video/*"
                              disabled={submitting}
                              className="sr-only"
                              onChange={(e) =>
                                handleFileChange(drill.id, e.target.files?.[0] || null)
                              }
                            />
                          </label>
                          <label className="btn-studio inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-white px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer">
                            <Camera className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Gravar Agora</span>
                            <input
                              type="file"
                              accept="video/*"
                              capture="environment"
                              disabled={submitting}
                              className="sr-only"
                              onChange={(e) =>
                                handleFileChange(drill.id, e.target.files?.[0] || null)
                              }
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {displayError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{displayError}</span>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
          {isAnalyzing ? (
            <button
              type="button"
              onClick={onClose}
              className="btn-studio ml-auto min-h-[42px] rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
            >
              Acompanhar na Prancheta
            </button>
          ) : (
            <>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <FileVideo className="h-4 w-4 text-slate-400" />
                <span>
                  {pickedCount}/{drills.length} vídeos prontos
                </span>
              </span>
              <button
                type="submit"
                form="ovr-test-form"
                disabled={submitting || pickedCount === 0}
                className="btn-studio inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
                <span>
                  {submitting
                    ? stage === 'analyzing'
                      ? 'IA analisando vídeo...'
                      : 'Enviando vídeos...'
                    : 'Enviar para Análise da IA'}
                </span>
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
