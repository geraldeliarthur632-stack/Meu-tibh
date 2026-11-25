export interface FirstClickOptionTip {
  key: string;
  title: string;
  summary: string;
}

export const FIRST_CLICK_OPTION_TIPS: Record<string, Omit<FirstClickOptionTip, 'key'>> = {
  // Navegação principal
  nav_lineup: {
    title: 'Escalação & Campo Tático',
    summary:
      'Aqui você posiciona titulares e reservas no campo, troca jogadores de posição, escolhe o capitão e mede o Over com vídeos.',
  },
  nav_matches: {
    title: 'Partidas Ao Vivo',
    summary:
      'Controle o cronômetro da partida em tempo real, adicione acréscimos e registre gols/pontos, cartões e faltas do elenco.',
  },
  nav_manual: {
    title: 'Manual da Sua Posição',
    summary:
      'Lições práticas no estilo Duolingo adaptadas ao esporte do time e à sua posição, com prova em vídeo para evoluir no jogo.',
  },
  nav_chat: {
    title: 'Chat do Vestiário',
    summary:
      'Converse em tempo real com todo o elenco e comissão técnica do time e receba avisos de novas mensagens.',
  },
  nav_invite: {
    title: 'Convidar Jogadores',
    summary:
      'Copie o código ou o link de entrada direta para outros atletas entrarem no time escolhendo camisa e posição.',
  },
  nav_profile: {
    title: 'Meu Perfil & Notificações',
    summary:
      'Veja seu status, Over, progresso no Manual, troque ou crie outro time, configure notificações push ou saia da conta.',
  },

  // Quadro de Escalação (TacticalBoard)
  board_tab_lineup: {
    title: 'Prancheta de Escalação',
    summary:
      'Arraste os círculos dos atletas no campo para ajustar o posicionamento tático em tempo real.',
  },
  board_tab_playbook: {
    title: 'Quadro de Jogadas Ensaiadas',
    summary:
      'Crie jogadas passo a passo movimentando jogadores e a bola, desenhando setas e exportando foto ou vídeo.',
  },
  board_view_starters: {
    title: 'Time Titular',
    summary:
      'Mostra no campo ou quadra apenas os jogadores escalados como titulares no momento.',
  },
  board_view_reserves: {
    title: 'Time Reserva',
    summary:
      'Mostra na prancheta os atletas do banco de reservas para organizar substitutos por setor.',
  },
  board_swap_mode: {
    title: 'Trocar Posição',
    summary:
      'Toque em um jogador e depois em outro (titular ou reserva) para trocar as posições e lugares entre os dois.',
  },
  board_ovr_test: {
    title: 'Teste de Over (Vídeos)',
    summary:
      'Envie vídeos curtos executando fundamentos da sua posição. A IA analisa sua técnica de verdade em tempo real e gera seu Over e treinos.',
  },
  board_ovr_recommend: {
    title: 'Recomendar Time por Over (IA)',
    summary:
      'Com todos os atletas avaliados, a IA analisa os Overs e atributos reais para sugerir titulares, reservas e capitão ideais.',
  },
  board_ai_lineup: {
    title: 'Escalar com IA',
    summary:
      'A IA analisa seu elenco, formação e objetivos para sugerir o melhor encaixe de titulares, reservas e faixa de capitão.',
  },
  board_add_member: {
    title: 'Novo Integrante',
    summary:
      'Adicione atletas titulares, reservas ou membros da comissão técnica escolhendo posição e número da camisa.',
  },
  board_player_card: {
    title: 'Ficha do Jogador',
    summary:
      'Toque em qualquer atleta para ver seu Over, atributos, críticas sinceras da IA, exercícios recomendados e ações rápidas.',
  },

  // Quadro de Jogadas Ensaiadas (PlaybookStudio)
  playbook_move: {
    title: 'Mover Peças (Jogadores & Bola)',
    summary:
      'Arraste qualquer jogador ou a bola pelo campo — ou toque no jogador e depois toque no lugar onde ele deve ir neste passo.',
  },
  playbook_pass: {
    title: 'Seta de Passe',
    summary:
      'Clique e arraste do ponto de saída até o destino no campo para desenhar uma seta branca indicando um passe.',
  },
  playbook_run: {
    title: 'Seta de Corrida / Deslocamento',
    summary:
      'Arraste no campo para traçar uma linha amarela pontilhada mostrando a corrida ou infiltração sem bola do atleta.',
  },
  playbook_shot: {
    title: 'Seta de Chute / Finalização',
    summary:
      'Arraste em direção ao gol, cesta ou quadra adversária para marcar uma finalização em vermelho.',
  },
  playbook_play: {
    title: 'Reproduzir Jogada',
    summary:
      'Anima a sequência completa do Passo 1 até o último passo para visualizar toda a movimentação da jogada.',
  },
  playbook_new_step: {
    title: 'Novo Passo da Jogada',
    summary:
      'Cria o próximo quadro copiando as posições atuais para você mover os jogadores até a próxima etapa da jogada.',
  },
  playbook_sync_lineup: {
    title: 'Carregar Elenco Atual',
    summary:
      'Puxa os jogadores titulares e suas posições atuais da prancheta de Escalação para dentro deste passo.',
  },
  playbook_export_png: {
    title: 'Exportar Foto PNG',
    summary:
      'Gera e baixa uma imagem em alta qualidade do passo atual com jogadores, setas e orientação tática.',
  },
  playbook_export_video: {
    title: 'Exportar Vídeo Animado',
    summary:
      'Renderiza todos os passos em sequência como um vídeo para baixar e compartilhar no grupo do time.',
  },
  playbook_ai_generate: {
    title: 'Criar Jogada com IA',
    summary:
      'Descreva o objetivo (ex: saída de pressão ou escanteio) e a IA cria automaticamente os passos, posições e setas reais.',
  },
  playbook_save: {
    title: 'Salvar Jogada no Time',
    summary:
      'Grava a jogada na biblioteca compartilhada do time para comissão técnica e jogadores abrirem quando quiserem.',
  },
};

const STORAGE_KEY_PREFIX = 'meu_time_first_click_tips_v1_';
const FIRST_CLICK_EVENT = 'meu-time-first-click-tip';

function getStorageKey(userId?: string | null): string {
  return `${STORAGE_KEY_PREFIX}${userId || 'guest'}`;
}

function readSeenSet(userId?: string | null): Set<string> {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function writeSeenSet(userId: string | null | undefined, seen: Set<string>) {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(Array.from(seen)));
  } catch {
    // ignore storage quota errors
  }
}

export function triggerFirstClickTip(
  optionKey: keyof typeof FIRST_CLICK_OPTION_TIPS | string,
  userId?: string | null
): boolean {
  const def = FIRST_CLICK_OPTION_TIPS[optionKey];
  if (!def) return false;

  const seen = readSeenSet(userId);
  if (seen.has(optionKey)) {
    return false;
  }

  seen.add(optionKey);
  writeSeenSet(userId, seen);

  const payload: FirstClickOptionTip = {
    key: optionKey,
    title: def.title,
    summary: def.summary,
  };

  window.dispatchEvent(new CustomEvent<FirstClickOptionTip>(FIRST_CLICK_EVENT, { detail: payload }));
  return true;
}

export function subscribeFirstClickTips(
  callback: (tip: FirstClickOptionTip) => void
): () => void {
  const handler = (event: Event) => {
    const custom = event as CustomEvent<FirstClickOptionTip>;
    if (custom.detail) {
      callback(custom.detail);
    }
  };
  window.addEventListener(FIRST_CLICK_EVENT, handler);
  return () => window.removeEventListener(FIRST_CLICK_EVENT, handler);
}
