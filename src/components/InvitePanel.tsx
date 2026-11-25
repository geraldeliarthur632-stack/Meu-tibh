import React, { useState } from 'react';
import { Check, Copy, Link2, Share2, Users } from 'lucide-react';
import { getAppBaseUrl } from '../lib/apiUrl';
import { SPORTS_CONFIG, Team } from '../types/studio';
import { TeamCrest } from './TeamCrest';

interface InvitePanelProps {
  team: Team;
  memberCount: number;
}

export const InvitePanel: React.FC<InvitePanelProps> = ({ team, memberCount }) => {
  const [copiedType, setCopiedType] = useState<'code' | 'link' | null>(null);
  const directJoinUrl = `${window.location.origin}${getAppBaseUrl()}?join=${team.inviteCode}`;

  const copyValue = async (value: string, type: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedType(type);
      window.setTimeout(() => setCopiedType(null), 2200);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share) {
      await copyValue(directJoinUrl, 'link');
      return;
    }
    try {
      await navigator.share({
        title: `Convite para ${team.name} — Meu Time`,
        text: `Entre direto no meu time ${team.name} (${SPORTS_CONFIG[team.sport].label}) usando o código ${team.inviteCode}:`,
        url: directJoinUrl,
      });
    } catch {
      // User dismissed share sheet
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 pb-5">
          <TeamCrest photoUrl={team.photoUrl} teamName={team.name} sizeClass="h-14 w-14" />
          <div>
            <p className="text-xs font-bold text-emerald-700">
              {SPORTS_CONFIG[team.sport].label} · {memberCount} jogadores no elenco
            </p>
            <h2 className="font-display text-2xl font-extrabold text-slate-900 sm:text-3xl">
              Convidar para {team.name}
            </h2>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Compartilhe o <strong>código de entrada</strong> ou o <strong>link direto</strong>. Quem
          abrir o link entra direto no fluxo do <strong>{team.name}</strong>, escolhe a camisa
          (com aviso se o número já estiver ocupado) e cai na escalação.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-500">Código do Time</p>
            <p className="font-mono-tabular mt-1.5 text-3xl font-bold tracking-widest text-emerald-700">
              {team.inviteCode}
            </p>
            <button
              type="button"
              onClick={() => void copyValue(team.inviteCode, 'code')}
              className="btn-studio mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-white px-4 text-xs font-bold text-slate-800 hover:bg-slate-100 cursor-pointer"
            >
              {copiedType === 'code' ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>Código copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copiar Código</span>
                </>
              )}
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-500">Link Direto de Entrada</p>
            <p className="font-mono-tabular mt-2 truncate rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
              {directJoinUrl}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void copyValue(directJoinUrl, 'link')}
                className="btn-studio inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
              >
                {copiedType === 'link' ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Link copiado!</span>
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4" />
                    <span>Copiar Link</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => void handleNativeShare()}
                aria-label="Compartilhar link de convite"
                className="btn-studio inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-white px-3 text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
          <Users className="h-5 w-5 shrink-0 text-emerald-600" />
          <span>
            Proteção ativa contra duplicidade: novos integrantes veem imediatamente quem já tem cada
            número de camisa antes de confirmar.
          </span>
        </div>
      </div>
    </div>
  );
};
