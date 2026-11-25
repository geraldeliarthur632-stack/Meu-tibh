import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Compass,
  Timer,
  Users,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { SPORTS_CONFIG, SportId } from '../types/studio';

interface StudioTutorialModalProps {
  teamName: string;
  sport: SportId;
  onClose: () => void;
}

interface TutorialSlide {
  id: string;
  kicker: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  items: { buttonLabel: string; description: string }[];
}

export const StudioTutorialModal: React.FC<StudioTutorialModalProps> = ({
  teamName,
  sport,
  onClose,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const sportLabel = SPORTS_CONFIG[sport].label;

  const slides: TutorialSlide[] = [
    {
      id: 'nav',
      kicker: 'Passo 1 de 4 · Navegação Principal',
      title: `Bem-vindo ao ${teamName}`,
      subtitle: `Veja o que cada botão da barra de navegação faz no seu estúdio de ${sportLabel}:`,
      icon: <Compass className="h-6 w-6 text-emerald-600" />,
      items: [
        {
          buttonLabel: 'Escalação',
          description:
            'Abre o campo ou quadra tática para posicionar titulares, montar a escalação reserva e ver a comissão técnica.',
        },
        {
          buttonLabel: 'Partidas',
          description:
            'Controla jogos ao vivo com cronômetro sincronizado, acréscimos, gols/pontos, cartões e faltas.',
        },
        {
          buttonLabel: 'Manual',
          description:
            'Trilha estilo Duolingo com 460 lições em 20 unidades que ensinam tudo sobre o esporte do time e a sua posição automática.',
        },
        {
          buttonLabel: 'Chat & Convite',
          description:
            'Chat abre o vestiário em tempo real; Convite gera o código e o link direto para novos integrantes.',
        },
        {
          buttonLabel: 'Perfil & Instalar App',
          description:
            'Instalar App mostra o tutorial completo para PC, Android e iOS. Em Perfil ficam seus dados, notificações push do Chat e Partidas, criação/troca de time e o botão Sair.',
        },
      ],
    },
    {
      id: 'lineup',
      kicker: 'Passo 2 de 4 · Prancheta, Reservas & Jogadas',
      title: 'Escalação, Capitão e Quadro de Jogadas',
      subtitle: 'Organize titulares, escalação reserva, trocas de posição e jogadas ensaiadas:',
      icon: <Users className="h-6 w-6 text-emerald-600" />,
      items: [
        {
          buttonLabel: 'Time Titular / Time Reserva',
          description:
            'Alterna a prancheta entre os titulares e a escalação reserva, permitindo arrastar os jogadores e aplicar formações nos dois quadros.',
        },
        {
          buttonLabel: 'Capitão (Coroa) & Trocar Posição',
          description:
            'Toque na coroa para escolher o capitão (faixa C) e use Trocar Posição para permutar dois atletas entre posições ou entre titular e reserva.',
        },
        {
          buttonLabel: 'Adicionar & Editar Tudo',
          description:
            'Qualquer membro pode editar nome, camisa, posição ou comissão (Técnico, Treinador de Goleiro, Auxiliar) sem travas.',
        },
        {
          buttonLabel: 'Quadro de Jogadas (Comissão & Time)',
          description:
            'Desenhe passos, setas e movimentos no campo/quadra, salve no banco do time e exporte em Foto PNG ou Vídeo MP4/WebM.',
        },
        {
          buttonLabel: 'Teste de Over & Ficha do Atleta',
          description:
            'Envie vídeos de passes, chutes ou dribles da sua posição. A IA analisa o vídeo de verdade na hora, mostra o Over ao lado do número no campo e recomenda exercícios. Toque em qualquer atleta para ver a ficha completa!',
        },
        {
          buttonLabel: 'Escalar c/ IA & Recomendar Time por Over',
          description:
            'Use a IA para montar escalação, reservas e capitão (quando todos tiverem Over, ela recomenda a melhor formação pelos ratings reais) ou criar jogadas passo a passo.',
        },
      ],
    },
    {
      id: 'matches',
      kicker: 'Passo 3 de 4 · Súmula e Cronômetro',
      title: 'Botões das Partidas Ao Vivo',
      subtitle: 'Tudo o que você precisa durante o jogo em tempo real:',
      icon: <Timer className="h-6 w-6 text-emerald-600" />,
      items: [
        {
          buttonLabel: 'Nova Partida',
          description:
            'Define o adversário, local, tempo regulamentar e permite iniciar o jogo já ao vivo.',
        },
        {
          buttonLabel: 'Iniciar / Pausar Tempo',
          description:
            'Liga ou pausa o cronômetro compartilhado — todos os membros veem o mesmo tempo correndo.',
        },
        {
          buttonLabel: "Acréscimos (-1', +1', +3')",
          description:
            'Adiciona ou reduz minutos extras quando o tempo regulamentar está terminando.',
        },
        {
          buttonLabel: 'Encerrar',
          description:
            'Finaliza oficialmente a partida após confirmação e trava o placar e a súmula final.',
        },
        {
          buttonLabel: '+ Gol/Ponto, Amarelo, Vermelho, Falta',
          description:
            'Registra na hora os lances do jogador selecionado no minuto exato da partida.',
        },
      ],
    },
    {
      id: 'social',
      kicker: 'Passo 4 de 4 · Manual Duolingo, Perfil e Push',
      title: 'Aprenda, Receba Alertas e Convide',
      subtitle: 'Recursos extras sempre disponíveis na barra superior ou inferior:',
      icon: <BookOpen className="h-6 w-6 text-emerald-600" />,
      items: [
        {
          buttonLabel: 'Manual (460 Lições + Prova em Vídeo)',
          description:
            'Abre direto no esporte do time e na sua posição. Ao concluir a lição, envie um vídeo praticando para a IA avaliar (podendo subir seu Over) ou marque Sim, Mais ou menos ou Não.',
        },
        {
          buttonLabel: 'Perfil e Notificações Push',
          description:
            'Ative alertas push para mensagens do Chat e lances das Partidas ao vivo, acompanhe seu XP e saia da conta quando quiser.',
        },
        {
          buttonLabel: 'Copiar Código & Copiar Link',
          description:
            'Quem entra pelo link direto já cai no time, escolhe camisa ou cargo e vê se alguém já ocupa a mesma posição.',
        },
      ],
    },
  ];

  const currentSlide = slides[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === slides.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-[#F6F8FB] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50">
              {currentSlide.icon}
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-700">{currentSlide.kicker}</p>
              <h2
                id="tutorial-title"
                className="font-display text-xl font-extrabold text-slate-900 sm:text-2xl"
              >
                {currentSlide.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar tutorial"
            className="flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl text-slate-400 hover:bg-slate-200/70 hover:text-slate-900 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="text-sm text-slate-600">{currentSlide.subtitle}</p>

          <div className="mt-4 space-y-2.5">
            {currentSlide.items.map((item) => (
              <div
                key={item.buttonLabel}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5"
              >
                <p className="text-xs font-extrabold text-slate-900">
                  Botão: <span className="text-emerald-700">{item.buttonLabel}</span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-1.5">
            {slides.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Ir para passo ${idx + 1}`}
                onClick={() => setStepIndex(idx)}
                className={`h-2.5 rounded-full transition-all cursor-pointer ${
                  idx === stepIndex ? 'w-7 bg-emerald-600' : 'w-2.5 bg-slate-300 hover:bg-slate-400'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isFirst ? (
              <button
                type="button"
                onClick={() => setStepIndex((prev) => prev - 1)}
                className="btn-studio inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-200 border-b-[3px] border-b-slate-300 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Anterior</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] px-3 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Pular
              </button>
            )}

            {!isLast ? (
              <button
                type="button"
                onClick={() => setStepIndex((prev) => prev + 1)}
                className="btn-studio inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
              >
                <span>Próximo</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="btn-studio inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
              >
                <Check className="h-4 w-4" />
                <span>Começar a Usar</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
