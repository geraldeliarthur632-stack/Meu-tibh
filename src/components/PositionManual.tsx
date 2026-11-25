import React, { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  AlertCircle,
  Award,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  Heart,
  HelpCircle,
  Play,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  buildTrackId,
  DuolingoLesson,
  generateCurriculumForPosition,
  LESSONS_PER_UNIT,
  TOTAL_MANUAL_LESSONS,
  TOTAL_UNITS,
  UNIT_METADATA,
} from '../data/duolingoCurriculum';
import { apiUrl, parseAiJsonResponse } from '../lib/apiUrl';
import { captureFirestoreError, db, OperationType } from '../lib/firebase';
import { MAX_VIDEO_CLIP_BYTES, uploadVideoClip } from '../lib/videoUpload';
import {
  AiManualVideoResponse,
  isStaffPosition,
  ManualAssessmentValue,
  ManualProgress,
  SPORTS_CONFIG,
  Team,
  TeamMember,
} from '../types/studio';

interface PositionManualProps {
  team: Team;
  currentMember: TeamMember | null;
  currentUserId: string;
}

const S_CURVE_OFFSETS = [0, -38, -58, -38, 0, 38, 58, 38];

const ACCENT_STYLES: Record<
  'emerald' | 'sky' | 'amber' | 'indigo' | 'rose',
  { banner: string; nodeBg: string; nodeBorder: string; badge: string }
> = {
  emerald: {
    banner: 'bg-emerald-600 border-emerald-700 text-white',
    nodeBg: 'bg-emerald-500 hover:bg-emerald-400 text-white',
    nodeBorder: 'border-emerald-700',
    badge: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  },
  sky: {
    banner: 'bg-sky-600 border-sky-700 text-white',
    nodeBg: 'bg-sky-500 hover:bg-sky-400 text-white',
    nodeBorder: 'border-sky-700',
    badge: 'text-sky-700 bg-sky-50 border-sky-200',
  },
  amber: {
    banner: 'bg-amber-500 border-amber-600 text-slate-950',
    nodeBg: 'bg-amber-400 hover:bg-amber-300 text-slate-950',
    nodeBorder: 'border-amber-600',
    badge: 'text-amber-800 bg-amber-50 border-amber-200',
  },
  indigo: {
    banner: 'bg-indigo-600 border-indigo-700 text-white',
    nodeBg: 'bg-indigo-500 hover:bg-indigo-400 text-white',
    nodeBorder: 'border-indigo-700',
    badge: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  },
  rose: {
    banner: 'bg-rose-600 border-rose-700 text-white',
    nodeBg: 'bg-rose-500 hover:bg-rose-400 text-white',
    nodeBorder: 'border-rose-700',
    badge: 'text-rose-700 bg-rose-50 border-rose-200',
  },
};

export const PositionManual: React.FC<PositionManualProps> = ({
  team,
  currentMember,
  currentUserId,
}) => {
  const sportCfg = SPORTS_CONFIG[team.sport];
  const userPosition = currentMember?.position || sportCfg.positions[0];
  const trackId = useMemo(
    () => buildTrackId(team.sport, userPosition),
    [team.sport, userPosition]
  );

  const lessons = useMemo(
    () => generateCurriculumForPosition(team.sport, userPosition),
    [team.sport, userPosition]
  );

  const [progress, setProgress] = useState<ManualProgress>({
    trackId,
    sport: team.sport,
    position: userPosition,
    xp: 0,
    streak: 1,
    completedCount: 0,
    highestLesson: 0,
    completedLessons: {},
    updatedAt: null,
  });

  const [selectedUnitIndex, setSelectedUnitIndex] = useState<number>(1);
  const [activeLesson, setActiveLesson] = useState<DuolingoLesson | null>(null);
  // 0 = teaching card, 1..N = quiz challenges, N+1 = practical video/self-check step, N+2 = complete
  const [runnerStep, setRunnerStep] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [checkedState, setCheckedState] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [hearts, setHearts] = useState<number>(5);
  const [savingProgress, setSavingProgress] = useState<boolean>(false);

  // Practical Video Proof & Self-Assessment State
  const [practiceFile, setPracticeFile] = useState<File | null>(null);
  const [videoAnalyzing, setVideoAnalyzing] = useState<boolean>(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoResult, setVideoResult] = useState<AiManualVideoResponse | null>(null);
  const [ovrBumpInfo, setOvrBumpInfo] = useState<{ from: number; to: number } | null>(null);
  const [selfChoice, setSelfChoice] = useState<ManualAssessmentValue | null>(null);
  const [showNoVideoOptions, setShowNoVideoOptions] = useState<boolean>(false);

  const [progressError, setProgressError] = useState<string | null>(null);

  // Sync Duolingo progress from Firestore
  useEffect(() => {
    const path = `users/${currentUserId}/manualProgress/${trackId}`;
    const unsub = onSnapshot(
      doc(db, 'users', currentUserId, 'manualProgress', trackId),
      (snap) => {
        setProgressError(null);
        if (snap.exists()) {
          const data = snap.data() as ManualProgress;
          setProgress(data);
          const nextLesson = Math.min(TOTAL_MANUAL_LESSONS, (data.highestLesson || 0) + 1);
          const nextUnit = Math.ceil(nextLesson / LESSONS_PER_UNIT);
          setSelectedUnitIndex((prev) => (prev === 1 && nextUnit > 1 ? nextUnit : prev));
        } else {
          setProgress({
            trackId,
            sport: team.sport,
            position: userPosition,
            xp: 0,
            streak: 1,
            completedCount: 0,
            highestLesson: 0,
            completedLessons: {},
            updatedAt: null,
          });
          setSelectedUnitIndex(1);
        }
      },
      (err) => {
        setProgressError(captureFirestoreError(err, OperationType.GET, path));
      }
    );
    return () => unsub();
  }, [currentUserId, trackId, team.sport, userPosition]);

  const nextRecommendedLesson = Math.min(
    TOTAL_MANUAL_LESSONS,
    (progress.highestLesson || 0) + 1
  );
  const recommendedUnit = Math.ceil(nextRecommendedLesson / LESSONS_PER_UNIT);

  const currentUnitMeta = UNIT_METADATA[selectedUnitIndex - 1] || UNIT_METADATA[0];
  const accent = ACCENT_STYLES[currentUnitMeta.accent];

  const unitLessons = useMemo(
    () => lessons.filter((l) => l.unitIndex === selectedUnitIndex),
    [lessons, selectedUnitIndex]
  );

  const unitCompletedCount = useMemo(
    () =>
      unitLessons.filter((l) => Boolean(progress.completedLessons[String(l.lessonNumber)])).length,
    [unitLessons, progress.completedLessons]
  );

  const openLesson = (lesson: DuolingoLesson) => {
    setActiveLesson(lesson);
    setRunnerStep(0);
    setSelectedOption(null);
    setCheckedState('idle');
    setHearts(5);
    setPracticeFile(null);
    setVideoAnalyzing(false);
    setVideoError(null);
    setVideoResult(null);
    setOvrBumpInfo(null);
    setSelfChoice(null);
    setShowNoVideoOptions(false);
  };

  const completeActiveLesson = async (
    lesson: DuolingoLesson,
    assessmentValue: ManualAssessmentValue,
    newDrills?: string[]
  ) => {
    const lessonKey = String(lesson.lessonNumber);
    const alreadyDone = Boolean(progress.completedLessons[lessonKey]);
    const nextCompletedMap: Record<string, boolean> = {
      ...progress.completedLessons,
      [lessonKey]: true,
    };
    const nextAssessments: Record<string, ManualAssessmentValue> = {
      ...(progress.lessonAssessments || {}),
      [lessonKey]: assessmentValue,
    };
    const mergedDrills = (newDrills && newDrills.length > 0
      ? newDrills
      : progress.recommendedDrills || []
    ).slice(0, 6);

    const nextCompletedCount = Object.keys(nextCompletedMap).length;
    const nextXp = progress.xp + (alreadyDone ? 5 : lesson.xp);
    const nextStreak = progress.streak + (alreadyDone ? 0 : 1);
    const nextHighest = Math.max(progress.highestLesson || 0, lesson.lessonNumber);

    const updated: ManualProgress = {
      trackId,
      sport: team.sport,
      position: userPosition,
      xp: nextXp,
      streak: nextStreak,
      completedCount: nextCompletedCount,
      highestLesson: nextHighest,
      completedLessons: nextCompletedMap,
      lessonAssessments: nextAssessments,
      recommendedDrills: mergedDrills,
      updatedAt: serverTimestamp(),
    };

    setProgress(updated);
    setSavingProgress(true);
    setProgressError(null);
    try {
      await setDoc(doc(db, 'users', currentUserId, 'manualProgress', trackId), updated);
    } catch (err) {
      setProgressError(
        captureFirestoreError(
          err,
          OperationType.WRITE,
          `users/${currentUserId}/manualProgress/${trackId}`
        )
      );
    } finally {
      setSavingProgress(false);
    }
  };

  const handleAnalyzeManualVideo = async () => {
    if (!activeLesson || !practiceFile) return;
    setVideoError(null);
    setVideoAnalyzing(true);
    setOvrBumpInfo(null);

    try {
      const clip = await uploadVideoClip(practiceFile);
      const currentOvr =
        currentMember && !isStaffPosition(currentMember.position) && currentMember.ovrRating
          ? currentMember.ovrRating
          : 0;

      const res = await fetch(apiUrl('/api/ai/evaluate-manual-video'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sport: sportCfg.label,
          position: userPosition,
          lessonTitle: activeLesson.title,
          teachingBody: activeLesson.teachingBody,
          tacticalCue: activeLesson.tacticalCue,
          currentOvr,
          clipId: clip.clipId,
        }),
      });

      const data = await parseAiJsonResponse<AiManualVideoResponse>(
        res,
        'Falha ao analisar vídeo da lição.'
      );
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Falha ao analisar vídeo da lição.');
      }

      setVideoResult(data);
      setSelfChoice(data.passed ? 'video_pass' : 'video_retry');

      if (
        currentMember &&
        !isStaffPosition(currentMember.position) &&
        currentOvr > 0 &&
        data.shouldIncreaseOvr &&
        data.ovrDelta > 0
      ) {
        const nextOvr = Math.min(99, currentOvr + data.ovrDelta);
        const updatedExercises = [
          ...(data.recommendedExercises || []),
          ...(currentMember.ovrExercises || []),
        ].slice(0, 5);

        await updateDoc(doc(db, 'teams', team.id, 'members', currentMember.id), {
          ovrRating: nextOvr,
          ovrExercises: updatedExercises,
          ovrUpdatedAtMs: Date.now(),
          updatedAt: serverTimestamp(),
        });
        setOvrBumpInfo({ from: currentOvr, to: nextOvr });
      }
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'Erro ao validar vídeo.');
    } finally {
      setVideoAnalyzing(false);
    }
  };

  const handlePickSelfAssessment = (choice: 'sim' | 'mais_ou_menos' | 'nao') => {
    if (!activeLesson) return;
    setSelfChoice(choice);
    const fallbackDrills =
      choice === 'sim'
        ? []
        : [
            `Pratique 10 min focando nesta dica de ${userPosition}: ${activeLesson.tacticalCue}`,
            `Revise "${activeLesson.teachingTitle}" e tente gravar um vídeo curto da execução.`,
          ];
    setRunnerStep(activeLesson.challenges.length + 2);
    void completeActiveLesson(activeLesson, choice, fallbackDrills);
  };

  const handleCheckAnswer = () => {
    if (!activeLesson || selectedOption === null) return;
    const challenge = activeLesson.challenges[runnerStep - 1];
    if (!challenge) return;
    if (selectedOption === challenge.correctIndex) {
      setCheckedState('correct');
    } else {
      setCheckedState('wrong');
      setHearts((prev) => Math.max(1, prev - 1));
    }
  };

  const handleContinueRunner = () => {
    if (!activeLesson) return;
    const totalChallenges = activeLesson.challenges.length;

    if (runnerStep === 0) {
      setRunnerStep(1);
      setSelectedOption(null);
      setCheckedState('idle');
      return;
    }

    if (checkedState === 'wrong') {
      // Let user retry the same question after reading explanation
      setSelectedOption(null);
      setCheckedState('idle');
      return;
    }

    if (runnerStep < totalChallenges) {
      setRunnerStep((prev) => prev + 1);
      setSelectedOption(null);
      setCheckedState('idle');
      return;
    }

    if (runnerStep === totalChallenges) {
      // Advance to the Practical Video / Self-Assessment step
      setRunnerStep(totalChallenges + 1);
      return;
    }

    if (runnerStep === totalChallenges + 1 && videoResult) {
      setRunnerStep(totalChallenges + 2);
      void completeActiveLesson(
        activeLesson,
        videoResult.passed ? 'video_pass' : 'video_retry',
        videoResult.recommendedExercises
      );
    }
  };

  const completionPct = Math.round((progress.completedCount / TOTAL_MANUAL_LESSONS) * 100);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Locked Duolingo Header Bar (Automatically uses team.sport + user's position) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-emerald-700">
              Academia do Time · {sportCfg.label} · {userPosition}
            </p>
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">
              Trilha de {userPosition} ({TOTAL_MANUAL_LESSONS} Lições)
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5">
              <Flame className="h-4 w-4 text-amber-500" />
              <span className="font-mono-tabular text-xs font-extrabold text-amber-900">
                {progress.streak}
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5">
              <Sparkles className="h-4 w-4 text-sky-600" />
              <span className="font-mono-tabular text-xs font-extrabold text-sky-900">
                {progress.xp} XP
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5">
              <Trophy className="h-4 w-4 text-emerald-600" />
              <span className="font-mono-tabular text-xs font-extrabold text-emerald-900">
                {progress.completedCount}/{TOTAL_MANUAL_LESSONS}
              </span>
            </div>
          </div>
        </div>

        {/* Overall 460-Lesson Progress Bar */}
        <div className="mt-3.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Progresso total na posição</span>
            <span className="font-mono-tabular font-bold text-emerald-700">{completionPct}%</span>
          </div>
          <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${Math.max(2, completionPct)}%` }}
            />
          </div>
        </div>

        {/* Recommended Drills From Video & Self Checks */}
        {((progress.recommendedDrills && progress.recommendedDrills.length > 0) ||
          (currentMember?.ovrExercises && currentMember.ovrExercises.length > 0)) && (
          <div className="mt-3.5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-900">
              <Dumbbell className="h-4 w-4 text-emerald-700" />
              <span>Exercícios Recomendados para Você Melhorar</span>
            </p>
            <ul className="mt-1.5 space-y-1 text-xs text-emerald-950">
              {(progress.recommendedDrills && progress.recommendedDrills.length > 0
                ? progress.recommendedDrills
                : currentMember?.ovrExercises || []
              )
                .slice(0, 3)
                .map((drill, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="font-mono-tabular font-extrabold text-emerald-700">
                      {i + 1}.
                    </span>
                    <span>{drill}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {/* 20 Units Quick Jump Ribbon (U1 .. U20 = 460 lessons) */}
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-700">
              20 Unidades · {TOTAL_MANUAL_LESSONS} lições completas
            </span>
            {selectedUnitIndex !== recommendedUnit && (
              <button
                type="button"
                onClick={() => setSelectedUnitIndex(recommendedUnit)}
                className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
              >
                Ir para Unidade Atual (U{recommendedUnit})
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {UNIT_METADATA.map((u) => {
              const startNum = (u.unitIndex - 1) * LESSONS_PER_UNIT + 1;
              const endNum = u.unitIndex * LESSONS_PER_UNIT;
              let doneInUnit = 0;
              for (let n = startNum; n <= endNum; n += 1) {
                if (progress.completedLessons[String(n)]) doneInUnit += 1;
              }
              const active = selectedUnitIndex === u.unitIndex;
              const finished = doneInUnit === LESSONS_PER_UNIT;
              return (
                <button
                  key={u.unitIndex}
                  type="button"
                  onClick={() => setSelectedUnitIndex(u.unitIndex)}
                  className={`btn-studio shrink-0 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    active
                      ? 'border-emerald-700 border-b-[3px] bg-emerald-600 text-white'
                      : finished
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  U{u.unitIndex}{' '}
                  <span className="font-mono-tabular opacity-80">
                    ({doneInUnit}/{LESSONS_PER_UNIT})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Duolingo Unit Banner + S-Curve Winding Path */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-6">
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-b-[4px] p-4 sm:p-5 ${accent.banner}`}
        >
          <div>
            <p className="text-xs font-bold opacity-90">
              UNIDADE {currentUnitMeta.unitIndex} DE {TOTAL_UNITS} · LIÇÕES{' '}
              {(currentUnitMeta.unitIndex - 1) * LESSONS_PER_UNIT + 1} A{' '}
              {currentUnitMeta.unitIndex * LESSONS_PER_UNIT}
            </p>
            <h3 className="font-display mt-0.5 text-xl font-extrabold sm:text-2xl">
              {currentUnitMeta.title}
            </h3>
            <p className="mt-0.5 text-xs opacity-90">{currentUnitMeta.subtitle}</p>
          </div>
          <div className="font-mono-tabular rounded-xl bg-black/15 px-3.5 py-2 text-xs font-extrabold">
            {unitCompletedCount} / {LESSONS_PER_UNIT} feitas
          </div>
        </div>

        {progressError && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900"
          >
            Erro ao sincronizar progresso: {progressError}
          </div>
        )}

        {/* S-Curve Stepping Stone Path */}
        <div className="relative mx-auto mt-8 flex max-w-md flex-col items-center gap-6 pb-6">
          {unitLessons.map((lesson, idx) => {
            const isCompleted = Boolean(progress.completedLessons[String(lesson.lessonNumber)]);
            const isCurrent = lesson.lessonNumber === nextRecommendedLesson;
            const offsetX = S_CURVE_OFFSETS[idx % S_CURVE_OFFSETS.length];

            return (
              <div
                key={lesson.lessonNumber}
                style={{ transform: `translateX(${offsetX}px)` }}
                className="relative flex flex-col items-center"
              >
                {isCurrent && (
                  <motion.div
                    initial={{ y: 2 }}
                    animate={{ y: [-3, 1, -3] }}
                    transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                    className="mb-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-1 text-[11px] font-extrabold tracking-wide text-emerald-700 shadow-sm"
                  >
                    COMEÇAR #{lesson.lessonNumber}
                  </motion.div>
                )}

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.07 }}
                  whileTap={{ scale: 0.94, y: 2 }}
                  onClick={() => openLesson(lesson)}
                  aria-label={`Lição ${lesson.lessonNumber}: ${lesson.title}`}
                  className={`flex h-16 w-16 items-center justify-center rounded-full border-2 border-b-[5px] shadow-md transition-colors cursor-pointer sm:h-[70px] sm:w-[70px] ${
                    isCompleted
                      ? 'border-amber-600 bg-amber-400 text-amber-950'
                      : isCurrent
                        ? `${accent.nodeBg} ${accent.nodeBorder} ring-4 ring-emerald-500/25`
                        : 'border-slate-300 bg-slate-100 text-slate-700 hover:border-emerald-500 hover:bg-emerald-50'
                  }`}
                >
                  {isCompleted ? (
                    lesson.isMilestone ? (
                      <Trophy className="h-7 w-7" />
                    ) : (
                      <Check className="h-7 w-7 stroke-[3]" />
                    )
                  ) : lesson.isMilestone ? (
                    <Award className="h-7 w-7" />
                  ) : isCurrent ? (
                    <Star className="h-7 w-7 fill-current" />
                  ) : (
                    <span className="font-display text-lg font-extrabold tabular-nums">
                      {lesson.lessonNumber}
                    </span>
                  )}
                </motion.button>

                <span className="mt-1.5 max-w-[140px] truncate text-center text-[11px] font-bold text-slate-700">
                  {lesson.isMilestone ? `Checkpoint U${lesson.unitIndex}` : `Lição ${lesson.lessonNumber}`}
                </span>
              </div>
            );
          })}
        </div>

        {/* Unit Prev / Next Navigation */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
          <button
            type="button"
            disabled={selectedUnitIndex <= 1}
            onClick={() => setSelectedUnitIndex((u) => Math.max(1, u - 1))}
            className="btn-studio inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Unidade Anterior</span>
          </button>

          <span className="font-mono-tabular text-xs font-bold text-slate-500">
            Unidade {selectedUnitIndex} / {TOTAL_UNITS}
          </span>

          <button
            type="button"
            disabled={selectedUnitIndex >= TOTAL_UNITS}
            onClick={() => setSelectedUnitIndex((u) => Math.min(TOTAL_UNITS, u + 1))}
            className="btn-studio inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-40 cursor-pointer"
          >
            <span>Próxima Unidade</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Duolingo Interactive Lesson Modal */}
      {activeLesson && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
          >
            {/* Lesson Progress Top Bar */}
            <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setActiveLesson(null)}
                aria-label="Sair da lição"
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((runnerStep / (activeLesson.challenges.length + 2)) * 100)
                    )}%`,
                  }}
                />
              </div>

              <div className="flex items-center gap-1 text-rose-600">
                <Heart className="h-4 w-4 fill-current" />
                <span className="font-mono-tabular text-xs font-extrabold">{hearts}</span>
              </div>
            </div>

            {/* Lesson Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {runnerStep === 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                    <BookOpen className="h-4 w-4" />
                    <span>
                      Lição {activeLesson.lessonNumber} de {TOTAL_MANUAL_LESSONS} ·{' '}
                      {activeLesson.unitTitle}
                    </span>
                  </div>
                  <h3 className="font-display text-2xl font-extrabold text-slate-900">
                    {activeLesson.teachingTitle}
                  </h3>
                  <div className="rounded-2xl border border-slate-200 bg-[#F6F8FB] p-4 text-sm leading-relaxed text-slate-700">
                    {activeLesson.teachingBody}
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs font-extrabold text-emerald-800">
                      Dica Prática ({userPosition})
                    </p>
                    <p className="mt-1 text-sm font-semibold text-emerald-950">
                      {activeLesson.tacticalCue}
                    </p>
                  </div>
                </div>
              )}

              {runnerStep >= 1 && runnerStep <= activeLesson.challenges.length && (
                <div className="space-y-4">
                  {(() => {
                    const challenge = activeLesson.challenges[runnerStep - 1];
                    return (
                      <>
                        <p className="text-xs font-bold text-emerald-700">
                          Desafio {runnerStep} de {activeLesson.challenges.length} · +{activeLesson.xp} XP
                        </p>
                        <h3 className="font-display text-xl font-extrabold leading-snug text-slate-900">
                          {challenge.question}
                        </h3>
                        <div className="space-y-2.5 pt-1">
                          {challenge.options.map((opt, idx) => {
                            const isPicked = selectedOption === idx;
                            const isCorrectOpt =
                              checkedState !== 'idle' && idx === challenge.correctIndex;
                            const isWrongPicked =
                              checkedState === 'wrong' && isPicked && idx !== challenge.correctIndex;

                            return (
                              <button
                                key={opt}
                                type="button"
                                disabled={checkedState !== 'idle'}
                                onClick={() => setSelectedOption(idx)}
                                className={`btn-studio flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-b-[3px] px-4 py-3 text-left text-xs font-semibold transition-colors cursor-pointer sm:text-sm ${
                                  isCorrectOpt
                                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                                    : isWrongPicked
                                      ? 'border-rose-500 bg-rose-50 text-rose-900'
                                      : isPicked
                                        ? 'border-sky-500 bg-sky-50 text-sky-950'
                                        : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                                }`}
                              >
                                <span className="font-mono-tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-extrabold text-slate-700">
                                  {idx + 1}
                                </span>
                                <span className="leading-snug">{opt}</span>
                              </button>
                            );
                          })}
                        </div>

                        {checkedState !== 'idle' && (
                          <div
                            className={`rounded-xl border p-3.5 text-xs leading-relaxed ${
                              checkedState === 'correct'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                : 'border-amber-200 bg-amber-50 text-amber-900'
                            }`}
                          >
                            <p className="font-extrabold">
                              {checkedState === 'correct'
                                ? 'Excelente leitura de jogo!'
                                : 'Quase lá! Tente novamente após ler a dica:'}
                            </p>
                            <p className="mt-1">{challenge.explanation}</p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {runnerStep === activeLesson.challenges.length + 1 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                    <Video className="h-4 w-4" />
                    <span>Prova Prática em Vídeo · {userPosition}</span>
                  </div>
                  <h3 className="font-display text-2xl font-extrabold text-slate-900">
                    Mostre como faz na prática!
                  </h3>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-950">
                    <p className="font-extrabold">O que demonstrar no vídeo:</p>
                    <p className="mt-1 leading-relaxed">{activeLesson.tacticalCue}</p>
                    {currentMember && !isStaffPosition(currentMember.position) && (
                      <p className="mt-1.5 font-semibold text-emerald-800">
                        {currentMember.ovrRating && currentMember.ovrRating > 0
                          ? `Seu OVR atual é ${currentMember.ovrRating}. Se a IA comprovar boa execução neste vídeo, seu OVR pode subir!`
                          : 'Se você já tiver feito o Teste de Over na Escalação, provas em vídeo podem aumentar seu OVR.'}
                      </p>
                    )}
                  </div>

                  {/* Video Picker / Recorder */}
                  {!videoResult && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                      {practiceFile ? (
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-white px-3.5 py-2.5">
                          <div className="flex min-w-0 items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            <span className="truncate text-xs font-bold text-slate-800">
                              {practiceFile.name}
                            </span>
                            <span className="font-mono-tabular shrink-0 text-[11px] text-slate-500">
                              ({(practiceFile.size / (1024 * 1024)).toFixed(1)} MB)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPracticeFile(null)}
                            className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                          >
                            Trocar
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <label className="btn-studio inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer">
                            <Upload className="h-4 w-4" />
                            <span>Enviar Vídeo</span>
                            <input
                              type="file"
                              accept="video/*"
                              className="sr-only"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                setVideoError(null);
                                if (file && file.size > MAX_VIDEO_CLIP_BYTES) {
                                  setVideoError('Vídeo muito grande (máx 35 MB). Envie um clipe mais curto.');
                                  return;
                                }
                                setPracticeFile(file);
                              }}
                            />
                          </label>
                          <label className="btn-studio inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer">
                            <Camera className="h-4 w-4 text-emerald-600" />
                            <span>Gravar Agora</span>
                            <input
                              type="file"
                              accept="video/*"
                              capture="environment"
                              className="sr-only"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                setVideoError(null);
                                if (file && file.size > MAX_VIDEO_CLIP_BYTES) {
                                  setVideoError('Vídeo muito grande (máx 35 MB). Envie um clipe mais curto.');
                                  return;
                                }
                                setPracticeFile(file);
                              }}
                            />
                          </label>
                        </div>
                      )}

                      {practiceFile && (
                        <button
                          type="button"
                          disabled={videoAnalyzing}
                          onClick={() => void handleAnalyzeManualVideo()}
                          className="btn-studio inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-indigo-700 border-b-[3px] bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
                        >
                          <Sparkles className="h-4 w-4" />
                          <span>
                            {videoAnalyzing
                              ? 'IA analisando sua execução...'
                              : 'Analisar Vídeo com IA'}
                          </span>
                        </button>
                      )}

                      {videoError && (
                        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{videoError}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI Video Analysis Result */}
                  {videoResult && (
                    <div
                      className={`space-y-3 rounded-2xl border p-4 ${
                        videoResult.passed
                          ? 'border-emerald-300 bg-emerald-50/70'
                          : 'border-amber-300 bg-amber-50/70'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-extrabold text-slate-900">
                          {videoResult.passed
                            ? 'Execução comprovada no vídeo!'
                            : 'Precisa ajustar a técnica'}
                        </p>
                        <span className="font-mono-tabular rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-black text-slate-900">
                          Técnica: {videoResult.techniqueScore}/100
                        </span>
                      </div>

                      <p className="text-xs leading-relaxed text-slate-700">
                        {videoResult.sincereFeedback}
                      </p>

                      {ovrBumpInfo ? (
                        <div className="flex items-center gap-2 rounded-xl border border-amber-400 bg-amber-100 px-3.5 py-2.5 text-xs font-extrabold text-amber-950">
                          <TrendingUp className="h-4 w-4 text-amber-700" />
                          <span>
                            OVR atualizado! Subiu de {ovrBumpInfo.from} para {ovrBumpInfo.to}!
                          </span>
                        </div>
                      ) : (
                        <p className="text-[11px] font-semibold text-slate-600">
                          {currentMember && !isStaffPosition(currentMember.position) && currentMember.ovrRating
                            ? `OVR mantido em ${currentMember.ovrRating} (a IA só aumenta quando o ganho técnico é consistente).`
                            : 'Complete o Teste de Over na aba Escalação para liberar evolução de OVR nos treinos.'}
                        </p>
                      )}

                      {videoResult.recommendedExercises.length > 0 && (
                        <div className="rounded-xl border border-white/80 bg-white/85 p-3">
                          <p className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                            <Dumbbell className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Exercícios Recomendados</span>
                          </p>
                          <ul className="mt-1.5 space-y-1 text-xs text-slate-700">
                            {videoResult.recommendedExercises.map((ex, i) => (
                              <li key={i}>
                                {i + 1}. {ex}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {!videoResult.passed && (
                        <button
                          type="button"
                          onClick={() => {
                            setVideoResult(null);
                            setPracticeFile(null);
                          }}
                          className="text-xs font-bold text-indigo-700 hover:underline cursor-pointer"
                        >
                          Enviar outro vídeo corrigido
                        </button>
                      )}
                    </div>
                  )}

                  {/* Fallback if user cannot upload a video right now */}
                  {!videoResult && (
                    <div className="border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => setShowNoVideoOptions((prev) => !prev)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        <HelpCircle className="h-4 w-4 text-slate-400" />
                        <span>Não consigo mandar vídeo agora — responder sem vídeo</span>
                      </button>

                      {showNoVideoOptions && (
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3.5 space-y-2.5">
                          <p className="text-xs font-bold text-slate-800">
                            Com sinceridade, você aprendeu a executar este fundamento?
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => handlePickSelfAssessment('sim')}
                              className="btn-studio min-h-[42px] rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-2 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
                            >
                              Sim
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePickSelfAssessment('mais_ou_menos')}
                              className="btn-studio min-h-[42px] rounded-xl border border-amber-500 border-b-[3px] bg-amber-400 px-2 text-xs font-bold text-slate-950 hover:bg-amber-300 cursor-pointer"
                            >
                              Mais ou menos
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePickSelfAssessment('nao')}
                              className="btn-studio min-h-[42px] rounded-xl border border-rose-700 border-b-[3px] bg-rose-600 px-2 text-xs font-bold text-white hover:bg-rose-500 cursor-pointer"
                            >
                              Não
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {runnerStep > activeLesson.challenges.length + 1 && (
                <div className="py-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-300 bg-amber-100 text-amber-700">
                    <Trophy className="h-9 w-9" />
                  </div>
                  <h3 className="font-display mt-4 text-3xl font-extrabold text-slate-900">
                    Lição {activeLesson.lessonNumber} Concluída!
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {selfChoice === 'nao' || selfChoice === 'mais_ou_menos'
                      ? 'Registramos sua resposta e separamos exercícios extras abaixo para você dominar este fundamento.'
                      : `Você dominou mais um ponto essencial de ${userPosition} no ${sportCfg.label}.`}
                  </p>
                  {ovrBumpInfo && (
                    <div className="mx-auto mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-extrabold text-amber-950">
                      <TrendingUp className="h-4 w-4 text-amber-600" />
                      <span>
                        OVR subiu: {ovrBumpInfo.from} → {ovrBumpInfo.to}
                      </span>
                    </div>
                  )}
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                      <p className="text-xs font-semibold text-sky-700">XP Ganho</p>
                      <p className="font-mono-tabular text-2xl font-extrabold text-sky-900">
                        +{activeLesson.xp}
                      </p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-xs font-semibold text-emerald-700">Trilha</p>
                      <p className="font-mono-tabular text-2xl font-extrabold text-emerald-900">
                        {progress.completedCount}/{TOTAL_MANUAL_LESSONS}
                      </p>
                    </div>
                  </div>
                  {(selfChoice === 'mais_ou_menos' || selfChoice === 'nao') && (
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-left">
                      <p className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-900">
                        <Dumbbell className="h-4 w-4 text-emerald-700" />
                        <span>Treino Recomendado para Fixar</span>
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-emerald-950">
                        Pratique 10 minutos desta ação específica: {activeLesson.tacticalCue}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Action */}
            <div className="border-t border-slate-200 bg-white px-6 py-4">
              {runnerStep === 0 && (
                <button
                  type="button"
                  onClick={handleContinueRunner}
                  className="btn-studio inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-500 cursor-pointer"
                >
                  <Play className="h-4 w-4" />
                  <span>Ir para os Desafios</span>
                </button>
              )}

              {runnerStep >= 1 && runnerStep <= activeLesson.challenges.length && (
                <>
                  {checkedState === 'idle' ? (
                    <button
                      type="button"
                      disabled={selectedOption === null}
                      onClick={handleCheckAnswer}
                      className="btn-studio min-h-[46px] w-full rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-45 cursor-pointer"
                    >
                      Verificar Resposta
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleContinueRunner}
                      className={`btn-studio min-h-[46px] w-full rounded-xl border border-b-[3px] text-sm font-bold text-white cursor-pointer ${
                        checkedState === 'correct'
                          ? 'border-emerald-700 bg-emerald-600 hover:bg-emerald-500'
                          : 'border-amber-600 bg-amber-500 hover:bg-amber-400'
                      }`}
                    >
                      {checkedState === 'correct' ? 'Continuar' : 'Tentar Novamente'}
                    </button>
                  )}
                </>
              )}

              {runnerStep === activeLesson.challenges.length + 1 && videoResult && (
                <button
                  type="button"
                  onClick={handleContinueRunner}
                  className="btn-studio min-h-[46px] w-full rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-500 cursor-pointer"
                >
                  Concluir Lição
                </button>
              )}

              {runnerStep > activeLesson.challenges.length + 1 && (
                <button
                  type="button"
                  disabled={savingProgress}
                  onClick={() => {
                    const nextNum = Math.min(TOTAL_MANUAL_LESSONS, activeLesson.lessonNumber + 1);
                    setSelectedUnitIndex(Math.ceil(nextNum / LESSONS_PER_UNIT));
                    setActiveLesson(null);
                  }}
                  className="btn-studio min-h-[46px] w-full rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-500 cursor-pointer"
                >
                  {savingProgress ? 'Salvando progresso...' : 'Voltar à Trilha'}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
