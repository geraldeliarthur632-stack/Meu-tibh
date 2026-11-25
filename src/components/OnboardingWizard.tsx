import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  KeyRound,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';
import { db, formatFriendlyFirebaseError, handleFirestoreError, OperationType } from '../lib/firebase';
import { compressImageToDataUrl, createClientId, generateInviteCode } from '../lib/imageUtils';
import {
  FIELD_LIMITS,
  InviteLookup,
  isStaffPosition,
  SPORTS_CONFIG,
  SportId,
  STAFF_POSITIONS,
} from '../types/studio';
import { BrandLogo } from './BrandLogo';
import { TeamCrest } from './TeamCrest';

interface OnboardingWizardProps {
  user: User;
  initialInviteCode: string | null;
  onTeamReady: (teamId: string) => void;
  onCancel?: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  user,
  initialInviteCode,
  onTeamReady,
  onCancel,
}) => {
  const [flowMode, setFlowMode] = useState<'create' | 'join'>(initialInviteCode ? 'join' : 'create');

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sport, setSport] = useState<SportId>('futebol');
  const [teamName, setTeamName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [playerName, setPlayerName] = useState(user.displayName || user.email?.split('@')[0] || 'Atleta');
  const [jerseyNumber, setJerseyNumber] = useState<number>(10);
  const [position, setPosition] = useState<string>(SPORTS_CONFIG.futebol.positions[0]);
  const [joinIsStarter, setJoinIsStarter] = useState<boolean>(true);

  const [inviteInput, setInviteInput] = useState((initialInviteCode || '').toUpperCase());
  const [inviteData, setInviteData] = useState<InviteLookup | null>(null);
  const [lookingUpInvite, setLookingUpInvite] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSportConfig = SPORTS_CONFIG[sport];
  const isStaffSelected = isStaffPosition(position);

  useEffect(() => {
    setPosition(SPORTS_CONFIG[sport].positions[0]);
  }, [sport]);

  useEffect(() => {
    if (initialInviteCode) {
      setFlowMode('join');
      setInviteInput(initialInviteCode.toUpperCase());
      void lookupInviteCode(initialInviteCode.toUpperCase());
    }
  }, [initialInviteCode]);

  const samePositionOwnersInInvite = useMemo(() => {
    if (!inviteData?.takenJerseys || isStaffPosition(position)) return [];
    const matches: string[] = [];
    Object.entries(inviteData.takenJerseys).forEach(([num, label]) => {
      const parts = String(label).split(' · ');
      const ownerPos = parts[parts.length - 1]?.trim();
      const ownerName = parts.slice(0, -1).join(' · ').trim() || String(label);
      if (ownerPos === position) {
        matches.push(`${ownerName} (#${num})`);
      }
    });
    return matches;
  }, [inviteData, position]);

  useEffect(() => {
    if (!inviteData) return;
    if (isStaffPosition(position)) {
      setJoinIsStarter(false);
      return;
    }
    const sportCfg = SPORTS_CONFIG[inviteData.sport];
    const athletesCount = Object.keys(inviteData.takenJerseys || {}).length;
    if (samePositionOwnersInInvite.length > 0 || athletesCount >= sportCfg.startersCount) {
      setJoinIsStarter(false);
    } else {
      setJoinIsStarter(true);
    }
  }, [inviteData, position, samePositionOwnersInInvite.length]);

  const lookupInviteCode = async (rawCode: string) => {
    const clean = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length < 6) {
      setError('Digite um código de convite válido com pelo menos 6 caracteres.');
      return;
    }
    setLookingUpInvite(true);
    setError(null);
    try {
      const snap = await getDoc(doc(db, 'invites', clean));
      if (!snap.exists()) {
        setInviteData(null);
        setError(`Nenhum time encontrado para o código ${clean}.`);
        return;
      }
      const data = snap.data() as InviteLookup;
      setInviteData(data);
      setSport(data.sport);
      setPosition(SPORTS_CONFIG[data.sport].positions[0]);

      const taken = data.takenJerseys || {};
      if (taken[String(jerseyNumber)]) {
        for (let n = 1; n <= 99; n += 1) {
          if (!taken[String(n)]) {
            setJerseyNumber(n);
            break;
          }
        }
      }
    } catch (err) {
      setError(formatFriendlyFirebaseError(err));
    } finally {
      setLookingUpInvite(false);
    }
  };

  const takenOwnerInInvite = useMemo(() => {
    if (isStaffSelected || !inviteData?.takenJerseys) return null;
    return inviteData.takenJerseys[String(jerseyNumber)] || null;
  }, [inviteData, jerseyNumber, isStaffSelected]);

  const suggestedFreeJerseys = useMemo(() => {
    if (!inviteData?.takenJerseys) return [1, 7, 9, 10, 11];
    const free: number[] = [];
    for (let n = 1; n <= 99 && free.length < 6; n += 1) {
      if (!inviteData.takenJerseys[String(n)]) {
        free.push(n);
      }
    }
    return free;
  }, [inviteData]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const compressed = await compressImageToDataUrl(file, 256);
      if (compressed.length > FIELD_LIMITS.MAX_PHOTO_LEN) {
        setError('A foto ficou muito grande mesmo após compressão. Escolha outra imagem.');
        return;
      }
      setPhotoUrl(compressed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar foto.');
    }
  };

  const syncUserDocInBatch = async (
    batch: ReturnType<typeof writeBatch>,
    teamId: string,
    trimmedPlayer: string,
    now: ReturnType<typeof serverTimestamp>
  ) => {
    const userRef = doc(db, 'users', user.uid);
    const existingUser = await getDoc(userRef);
    if (existingUser.exists()) {
      batch.update(userRef, {
        displayName: trimmedPlayer,
        activeTeamId: teamId,
        updatedAt: now,
      });
    } else {
      batch.set(userRef, {
        uid: user.uid,
        displayName: trimmedPlayer,
        photoUrl: user.photoURL || '',
        activeTeamId: teamId,
        createdAt: now,
        updatedAt: now,
      });
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTeam = teamName.trim();
    const trimmedPlayer = playerName.trim();
    const effectiveJersey = isStaffSelected ? 0 : jerseyNumber;

    if (trimmedTeam.length < FIELD_LIMITS.MIN_TEAM_NAME || trimmedTeam.length > FIELD_LIMITS.MAX_TEAM_NAME) {
      setError(`O nome do time deve ter entre ${FIELD_LIMITS.MIN_TEAM_NAME} e ${FIELD_LIMITS.MAX_TEAM_NAME} caracteres.`);
      return;
    }
    if (!trimmedPlayer) {
      setError('Informe o seu nome no elenco.');
      return;
    }
    if (!isStaffSelected && (!Number.isInteger(effectiveJersey) || effectiveJersey < 1 || effectiveJersey > 99)) {
      setError('Escolha um número de camisa entre 1 e 99.');
      return;
    }

    setSubmitting(true);
    const teamId = createClientId('team');
    const inviteCode = generateInviteCode();
    const formations = Object.keys(selectedSportConfig.formations);
    const defaultFormation = formations[0];
    const firstSlot = selectedSportConfig.formations[defaultFormation][0] || { x: 50, y: 50 };

    try {
      const batch = writeBatch(db);
      const now = serverTimestamp();

      batch.set(doc(db, 'teams', teamId), {
        id: teamId,
        name: trimmedTeam,
        sport,
        photoUrl: photoUrl || '',
        ownerId: user.uid,
        inviteCode,
        formation: defaultFormation,
        createdAt: now,
        updatedAt: now,
      });

      batch.set(doc(db, 'teams', teamId, 'members', user.uid), {
        id: user.uid,
        teamId,
        userId: user.uid,
        name: trimmedPlayer,
        jerseyNumber: effectiveJersey,
        position,
        role: 'owner',
        isStarter: !isStaffSelected,
        posX: firstSlot.x,
        posY: firstSlot.y,
        createdAt: now,
        updatedAt: now,
      });

      batch.set(doc(db, 'users', user.uid, 'teamMemberships', teamId), {
        teamId,
        teamName: trimmedTeam,
        sport,
        photoUrl: photoUrl || '',
        role: 'owner',
        inviteCode,
        joinedAt: now,
        updatedAt: now,
      });

      batch.set(doc(db, 'invites', inviteCode), {
        code: inviteCode,
        teamId,
        teamName: trimmedTeam,
        sport,
        photoUrl: photoUrl || '',
        ownerId: user.uid,
        takenJerseys: isStaffSelected
          ? {}
          : {
              [String(effectiveJersey)]: `${trimmedPlayer} · ${position}`,
            },
        createdAt: now,
        updatedAt: now,
      });

      await syncUserDocInBatch(batch, teamId, trimmedPlayer, now);

      await batch.commit();
      onTeamReady(teamId);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.WRITE, `teams/${teamId}`);
      } catch (wrapped) {
        setError(formatFriendlyFirebaseError(wrapped));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteData) return;
    setError(null);

    const trimmedPlayer = playerName.trim();
    const effectiveJersey = isStaffSelected ? 0 : jerseyNumber;

    if (!trimmedPlayer) {
      setError('Informe seu nome para aparecer na escalação.');
      return;
    }
    if (!isStaffSelected && (!Number.isInteger(effectiveJersey) || effectiveJersey < 1 || effectiveJersey > 99)) {
      setError('Escolha um número de camisa entre 1 e 99.');
      return;
    }
    if (!isStaffSelected && takenOwnerInInvite) {
      setError(`Camisa #${effectiveJersey} já pertence a ${takenOwnerInInvite}. Escolha outro número.`);
      return;
    }

    setSubmitting(true);
    try {
      const freshInviteSnap = await getDoc(doc(db, 'invites', inviteData.code));
      if (!freshInviteSnap.exists()) {
        setError('Este convite não está mais ativo.');
        setSubmitting(false);
        return;
      }
      const freshInvite = freshInviteSnap.data() as InviteLookup;
      const freshTaken = freshInvite.takenJerseys || {};
      if (!isStaffSelected && freshTaken[String(effectiveJersey)]) {
        setInviteData(freshInvite);
        setError(
          `Camisa #${effectiveJersey} acabou de ser escolhida por ${freshTaken[String(effectiveJersey)]}. Selecione outro número.`
        );
        setSubmitting(false);
        return;
      }

      const sportCfg = SPORTS_CONFIG[freshInvite.sport];
      const formationKeys = Object.keys(sportCfg.formations);
      const slots = sportCfg.formations[formationKeys[0]];
      const existingCount = Object.keys(freshTaken).length;
      const slot = slots[existingCount % slots.length] || { x: 50, y: 50 };
      const isStarter = isStaffSelected ? false : joinIsStarter;

      const batch = writeBatch(db);
      const now = serverTimestamp();

      batch.set(doc(db, 'teams', freshInvite.teamId, 'members', user.uid), {
        id: user.uid,
        teamId: freshInvite.teamId,
        userId: user.uid,
        name: trimmedPlayer,
        jerseyNumber: effectiveJersey,
        position,
        role: 'member',
        isStarter,
        posX: slot.x,
        posY: slot.y,
        inviteCode: freshInvite.code,
        createdAt: now,
        updatedAt: now,
      });

      batch.set(doc(db, 'users', user.uid, 'teamMemberships', freshInvite.teamId), {
        teamId: freshInvite.teamId,
        teamName: freshInvite.teamName,
        sport: freshInvite.sport,
        photoUrl: freshInvite.photoUrl || '',
        role: 'member',
        inviteCode: freshInvite.code,
        joinedAt: now,
        updatedAt: now,
      });

      batch.update(doc(db, 'invites', freshInvite.code), {
        takenJerseys: isStaffSelected
          ? freshTaken
          : {
              ...freshTaken,
              [String(effectiveJersey)]: `${trimmedPlayer} · ${position}`,
            },
        updatedAt: now,
      });

      await syncUserDocInBatch(batch, freshInvite.teamId, trimmedPlayer, now);

      await batch.commit();

      window.history.replaceState({}, '', `/team/${freshInvite.teamId}`);
      onTeamReady(freshInvite.teamId);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.WRITE, `teams/${inviteData.teamId}/members/${user.uid}`);
      } catch (wrapped) {
        setError(formatFriendlyFirebaseError(wrapped));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB] px-4 py-5 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Compact Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <BrandLogo sizeClass="h-10 w-10" />
            <div>
              <p className="text-xs font-bold text-emerald-700">Estúdio Meu Time</p>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                {flowMode === 'create' ? 'Monte seu novo time' : 'Entrar em um time'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="btn-studio inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Voltar</span>
              </button>
            )}
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => {
                  setFlowMode('create');
                  setError(null);
                }}
                className={`min-h-[38px] rounded-lg px-3.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  flowMode === 'create'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Criar Time
              </button>
              <button
                type="button"
                onClick={() => {
                  setFlowMode('join');
                  setError(null);
                }}
                className={`min-h-[38px] rounded-lg px-3.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  flowMode === 'join'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Usar Código
              </button>
            </div>
          </div>
        </div>

        {flowMode === 'create' ? (
          <div className="mt-5">
            {/* Step Progress + Action Bar together so no scrolling needed */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-slate-500">
                <span className={step === 1 ? 'font-bold text-emerald-700' : ''}>01. Esporte</span>
                <span aria-hidden="true">·</span>
                <span className={step === 2 ? 'font-bold text-emerald-700' : ''}>02. Nome e Foto</span>
                <span aria-hidden="true">·</span>
                <span className={step === 3 ? 'font-bold text-emerald-700' : ''}>03. Camisa e Posição</span>
              </div>

              {step === 1 && (
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn-studio inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-500 cursor-pointer"
                >
                  <span>Continuar com {selectedSportConfig.label}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>

            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                {(Object.keys(SPORTS_CONFIG) as SportId[]).map((sportKey) => {
                  const cfg = SPORTS_CONFIG[sportKey];
                  const active = sport === sportKey;
                  return (
                    <motion.button
                      key={sportKey}
                      type="button"
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSport(sportKey)}
                      className={`group relative overflow-hidden rounded-2xl border bg-white text-left transition-all cursor-pointer ${
                        active
                          ? 'border-emerald-600 border-b-[4px] ring-2 ring-emerald-500/20'
                          : 'border-slate-200 border-b-[3px] border-b-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <div className="relative h-36 w-full overflow-hidden bg-slate-100">
                        <img
                          src={cfg.imageUrl}
                          alt={cfg.label}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        {active && (
                          <span className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md">
                            <Check className="h-4 w-4" />
                          </span>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-display text-2xl font-bold text-slate-900">{cfg.label}</h3>
                        <p className="mt-1 text-xs text-slate-500">{cfg.subtitle}</p>
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl font-bold text-slate-900">
                      Nome e Escudo do Time
                    </h2>
                    <p className="text-xs text-slate-500">
                      A foto é opcional — se quiser pular, usamos o escudo padrão do estúdio.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-12 md:items-center">
                  <div className="flex flex-col items-center gap-3 md:col-span-4">
                    <TeamCrest
                      photoUrl={photoUrl}
                      teamName={teamName || 'Meu Time'}
                      sizeClass="h-28 w-28"
                    />
                    <div className="flex flex-wrap justify-center gap-2">
                      <label className="btn-studio inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-slate-50 px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                        <Camera className="h-4 w-4 text-emerald-600" />
                        <span>{photoUrl ? 'Trocar foto' : 'Foto (opcional)'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => void handlePhotoUpload(e)}
                          className="sr-only"
                        />
                      </label>
                      {photoUrl && (
                        <button
                          type="button"
                          onClick={() => setPhotoUrl('')}
                          aria-label="Remover foto do time"
                          className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-600 hover:bg-red-100 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 md:col-span-8">
                    <div>
                      <label htmlFor="team-name-input" className="block text-xs font-semibold text-slate-700">
                        Nome do Time
                      </label>
                      <input
                        id="team-name-input"
                        type="text"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        maxLength={FIELD_LIMITS.MAX_TEAM_NAME}
                        placeholder={`Ex: Atlântico ${selectedSportConfig.label}`}
                        className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      Esporte: <strong className="text-slate-800">{selectedSportConfig.label}</strong>
                      {' · '}
                      {photoUrl ? 'Escudo personalizado pronto' : 'Sem foto (escudo padrão)'}
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
                    {error}
                  </div>
                )}

                <div className="mt-6 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setStep(1);
                    }}
                    className="btn-studio inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Voltar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (teamName.trim().length < 2) {
                        setError('Digite um nome para o seu time (mínimo 2 caracteres).');
                        return;
                      }
                      setError(null);
                      setStep(3);
                    }}
                    className="btn-studio inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-6 text-sm font-bold text-white hover:bg-emerald-500 cursor-pointer"
                  >
                    <span>Escolher Camisa e Posição</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.form
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                onSubmit={(e) => void handleCreateTeam(e)}
                className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
              >
                <h2 className="font-display text-2xl font-bold text-slate-900">
                  Sua Camisa e Posição
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Defina como você entra na escalação de <strong className="text-slate-900">{teamName}</strong>.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className={isStaffSelected ? 'sm:col-span-3' : 'sm:col-span-2'}>
                    <label htmlFor="creator-name" className="block text-xs font-semibold text-slate-700">
                      Seu nome na escalação
                    </label>
                    <input
                      id="creator-name"
                      type="text"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      maxLength={FIELD_LIMITS.MAX_PLAYER_NAME}
                      className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                    />
                  </div>

                  {!isStaffSelected && (
                    <div>
                      <label htmlFor="creator-jersey" className="block text-xs font-semibold text-slate-700">
                        Camisa (1–99)
                      </label>
                      <input
                        id="creator-jersey"
                        type="number"
                        min={1}
                        max={99}
                        value={jerseyNumber}
                        onChange={(e) =>
                          setJerseyNumber(Math.max(1, Math.min(99, Number(e.target.value) || 1)))
                        }
                        className="font-mono-tabular mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <span className="block text-xs font-semibold text-slate-700">
                    Posição ({selectedSportConfig.label})
                  </span>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {selectedSportConfig.positions.map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => setPosition(pos)}
                        className={`btn-studio min-h-[42px] rounded-xl border px-3 text-xs font-semibold transition-colors cursor-pointer ${
                          position === pos
                            ? 'border-emerald-600 border-b-[3px] bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <span className="block text-xs font-semibold text-slate-700">
                    Ou Comissão Técnica (sem camisa)
                  </span>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {STAFF_POSITIONS.map((staffRole) => (
                      <button
                        key={staffRole}
                        type="button"
                        onClick={() => setPosition(staffRole)}
                        className={`btn-studio min-h-[42px] rounded-xl border px-3 text-xs font-semibold transition-colors cursor-pointer ${
                          position === staffRole
                            ? 'border-sky-600 border-b-[3px] bg-sky-50 text-sky-900'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {staffRole}
                      </button>
                    ))}
                  </div>
                  {isStaffSelected && (
                    <p className="mt-2 text-xs text-sky-700">
                      Você entrará como <strong>{position}</strong> na comissão técnica, sem numeração de camisa.
                    </p>
                  )}
                </div>

                {error && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
                    {error}
                  </div>
                )}

                <div className="mt-6 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setStep(2);
                    }}
                    className="btn-studio inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Voltar</span>
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-studio inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-6 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{submitting ? 'Criando Estúdio...' : 'Finalizar e Entrar no Time'}</span>
                  </button>
                </div>
              </motion.form>
            )}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
          >
            <h2 className="font-display text-2xl font-bold text-slate-900">
              Entrar com Código ou Link Direto
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Cole o código de convite compartilhado pelo capitão do time.
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <KeyRound className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value.toUpperCase())}
                  placeholder="Ex: MT8K2P9A"
                  maxLength={10}
                  className="font-mono-tabular min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 pr-4 pl-10 text-sm font-bold tracking-wider text-slate-900 uppercase placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
                />
              </div>
              <button
                type="button"
                disabled={lookingUpInvite}
                onClick={() => void lookupInviteCode(inviteInput)}
                className="btn-studio min-h-[44px] rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-6 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60 whitespace-nowrap cursor-pointer"
              >
                {lookingUpInvite ? 'Buscando...' : 'Localizar Time'}
              </button>
            </div>

            {inviteData && (
              <form onSubmit={(e) => void handleJoinTeam(e)} className="mt-6 border-t border-slate-200 pt-5">
                <div className="flex items-center gap-4">
                  <TeamCrest
                    photoUrl={inviteData.photoUrl}
                    teamName={inviteData.teamName}
                    sizeClass="h-14 w-14"
                  />
                  <div>
                    <p className="text-xs font-bold text-emerald-700">
                      {SPORTS_CONFIG[inviteData.sport].label} · Time Localizado
                    </p>
                    <h3 className="font-display text-2xl font-bold text-slate-900">
                      {inviteData.teamName}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {Object.keys(inviteData.takenJerseys || {}).length} jogadores com camisa já escalados
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className={isStaffSelected ? 'sm:col-span-3' : 'sm:col-span-2'}>
                    <label htmlFor="join-player-name" className="block text-xs font-semibold text-slate-700">
                      Seu nome na escalação
                    </label>
                    <input
                      id="join-player-name"
                      type="text"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      maxLength={FIELD_LIMITS.MAX_PLAYER_NAME}
                      className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                    />
                  </div>

                  {!isStaffSelected && (
                    <div>
                      <label htmlFor="join-jersey" className="block text-xs font-semibold text-slate-700">
                        Número da Camisa
                      </label>
                      <input
                        id="join-jersey"
                        type="number"
                        min={1}
                        max={99}
                        value={jerseyNumber}
                        onChange={(e) =>
                          setJerseyNumber(Math.max(1, Math.min(99, Number(e.target.value) || 1)))
                        }
                        className={`font-mono-tabular mt-1 min-h-[44px] w-full rounded-xl border bg-slate-50 px-4 text-base font-bold focus:bg-white focus:outline-none ${
                          takenOwnerInInvite
                            ? 'border-red-500 text-red-700'
                            : 'border-slate-200 text-slate-900 focus:border-emerald-500'
                        }`}
                      />
                    </div>
                  )}
                </div>

                {!isStaffSelected && takenOwnerInInvite && (
                  <div
                    role="alert"
                    className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3.5"
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                      <div>
                        <p className="text-xs font-bold text-amber-900">
                          Camisa #{jerseyNumber} já está em uso!
                        </p>
                        <p className="mt-0.5 text-xs text-amber-800">
                          Quem tem este número no time é: <strong>{takenOwnerInInvite}</strong>.
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-amber-800">Livres:</span>
                          {suggestedFreeJerseys.map((freeNum) => (
                            <button
                              key={freeNum}
                              type="button"
                              onClick={() => setJerseyNumber(freeNum)}
                              className="font-mono-tabular min-h-[34px] rounded-lg border border-amber-300 bg-white px-2.5 text-xs font-bold text-emerald-700 hover:border-emerald-500 cursor-pointer"
                            >
                              #{freeNum}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <span className="block text-xs font-semibold text-slate-700">
                    Sua Posição ({SPORTS_CONFIG[inviteData.sport].label})
                  </span>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {SPORTS_CONFIG[inviteData.sport].positions.map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => setPosition(pos)}
                        className={`btn-studio min-h-[42px] rounded-xl border px-3 text-xs font-semibold transition-colors cursor-pointer ${
                          position === pos
                            ? 'border-emerald-600 border-b-[3px] bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <span className="block text-xs font-semibold text-slate-700">
                    Ou Comissão Técnica (sem camisa)
                  </span>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {STAFF_POSITIONS.map((staffRole) => (
                      <button
                        key={staffRole}
                        type="button"
                        onClick={() => setPosition(staffRole)}
                        className={`btn-studio min-h-[42px] rounded-xl border px-3 text-xs font-semibold transition-colors cursor-pointer ${
                          position === staffRole
                            ? 'border-sky-600 border-b-[3px] bg-sky-50 text-sky-900'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {staffRole}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Same-position reserve prompt & starter/reserve selector */}
                {!isStaffSelected && samePositionOwnersInInvite.length > 0 && (
                  <div
                    role="status"
                    className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3.5"
                  >
                    <p className="text-xs font-bold text-amber-900">
                      Já existe jogador na posição {position}: {samePositionOwnersInInvite.join(', ')}.
                    </p>
                    <p className="mt-0.5 text-xs text-amber-800">
                      Você vai entrar como <strong>Reserva</strong> nessa posição?
                    </p>
                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setJoinIsStarter(false)}
                        className={`btn-studio min-h-[40px] rounded-xl border text-xs font-bold cursor-pointer ${
                          !joinIsStarter
                            ? 'border-amber-600 border-b-[3px] bg-amber-500 text-white'
                            : 'border-amber-300 bg-white text-amber-900'
                        }`}
                      >
                        Sim, entrar como Reserva
                      </button>
                      <button
                        type="button"
                        onClick={() => setJoinIsStarter(true)}
                        className={`btn-studio min-h-[40px] rounded-xl border text-xs font-bold cursor-pointer ${
                          joinIsStarter
                            ? 'border-emerald-700 border-b-[3px] bg-emerald-600 text-white'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        Não, entrar como Titular
                      </button>
                    </div>
                  </div>
                )}

                {!isStaffSelected && samePositionOwnersInInvite.length === 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setJoinIsStarter(true)}
                      className={`btn-studio min-h-[40px] rounded-xl border text-xs font-bold cursor-pointer ${
                        joinIsStarter
                          ? 'border-emerald-600 border-b-[3px] bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      Entrar como Titular
                    </button>
                    <button
                      type="button"
                      onClick={() => setJoinIsStarter(false)}
                      className={`btn-studio min-h-[40px] rounded-xl border text-xs font-bold cursor-pointer ${
                        !joinIsStarter
                          ? 'border-indigo-600 border-b-[3px] bg-indigo-50 text-indigo-800'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      Entrar na Escalação Reserva
                    </button>
                  </div>
                )}

                <div className="mt-6 flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting || (!isStaffSelected && !!takenOwnerInInvite)}
                    className="btn-studio inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-6 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                  >
                    <Users className="h-4 w-4" />
                    <span>{submitting ? 'Entrando no time...' : 'Confirmar e Entrar no Time'}</span>
                  </button>
                </div>
              </form>
            )}

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700"
              >
                {error}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};
