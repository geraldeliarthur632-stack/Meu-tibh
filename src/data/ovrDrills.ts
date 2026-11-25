import { SportId } from '../types/studio';

export interface OvrDrillSpec {
  id: string;
  title: string;
  instruction: string;
  focusAttribute: string;
  required: boolean;
}

export function getOvrTierInfo(ovr: number): {
  label: string;
  badgeClass: string;
  pitchBadgeClass: string;
  barClass: string;
} {
  if (ovr >= 85) {
    return {
      label: 'Destaque / Elite',
      badgeClass: 'border-amber-400 bg-amber-100 text-amber-950',
      pitchBadgeClass: 'border-amber-600 bg-amber-400 text-slate-950',
      barClass: 'bg-amber-500',
    };
  }
  if (ovr >= 75) {
    return {
      label: 'Muito Bom',
      badgeClass: 'border-emerald-300 bg-emerald-50 text-emerald-900',
      pitchBadgeClass: 'border-emerald-700 bg-emerald-600 text-white',
      barClass: 'bg-emerald-500',
    };
  }
  if (ovr >= 65) {
    return {
      label: 'Competitivo',
      badgeClass: 'border-sky-300 bg-sky-50 text-sky-900',
      pitchBadgeClass: 'border-sky-700 bg-sky-600 text-white',
      barClass: 'bg-sky-500',
    };
  }
  return {
    label: 'Em Evolução',
    badgeClass: 'border-slate-300 bg-slate-100 text-slate-800',
    pitchBadgeClass: 'border-slate-700 bg-slate-700 text-white',
    barClass: 'bg-slate-500',
  };
}

export function getDrillsForPosition(sport: SportId, position: string): OvrDrillSpec[] {
  const posLower = position.toLowerCase();

  if (sport === 'futebol') {
    if (posLower.includes('goleiro')) {
      return [
        {
          id: 'gk_save',
          title: 'Defesas & Reflexo no Gol',
          instruction: 'Grave 10–25s mostrando encaixe firme, queda lateral e reposicionamento rápido.',
          focusAttribute: 'Defesa / Reflexo',
          required: true,
        },
        {
          id: 'gk_dist',
          title: 'Reposição & Passe com os Pés',
          instruction: 'Mostre lançamento com as mãos ou passe longo/tiro de meta direcionado.',
          focusAttribute: 'Reposição',
          required: false,
        },
        {
          id: 'gk_foot',
          title: 'Domínio sob Pressão',
          instruction: 'Controle de bola recuada e giro rápido para limpar a jogada.',
          focusAttribute: 'Jogo com Pés',
          required: false,
        },
      ];
    }
    if (posLower.includes('zagueiro')) {
      return [
        {
          id: 'def_pass',
          title: 'Passe Curto & Lançamento',
          instruction: 'Grave passes firmes quebrando linha e bola longa para o ataque.',
          focusAttribute: 'Passe',
          required: true,
        },
        {
          id: 'def_tackle',
          title: 'Bote, Corte & Tempo de Bola',
          instruction: 'Mostre abordagem defensiva lateral, proteção de espaço ou corte limpo.',
          focusAttribute: 'Marcação',
          required: false,
        },
        {
          id: 'def_header',
          title: 'Jogo Aéreo & Impulsão',
          instruction: 'Cabeceio defensivo buscando altura e direção para longe da área.',
          focusAttribute: 'Físico / Aéreo',
          required: false,
        },
      ];
    }
    if (posLower.includes('lateral')) {
      return [
        {
          id: 'lat_cross',
          title: 'Condução & Cruzamento',
          instruction: 'Arrancada pelo corredor com passe/cruzamento na área em movimento.',
          focusAttribute: 'Cruzamento / Passe',
          required: true,
        },
        {
          id: 'lat_drib',
          title: 'Drible 1x1 & Retomada',
          instruction: 'Finta curta pela faixa lateral e recuperação defensiva rápida.',
          focusAttribute: 'Drible / Ritmo',
          required: false,
        },
      ];
    }
    if (posLower.includes('volante') || posLower.includes('meia')) {
      return [
        {
          id: 'mid_pass',
          title: 'Passes Curtos & Enfiadas',
          instruction: 'Grave sequência de recepção orientada e passes precisos (com os dois pés se possível).',
          focusAttribute: 'Passe / Visão',
          required: true,
        },
        {
          id: 'mid_drib',
          title: 'Condução & Giro em Espaço Curto',
          instruction: 'Dribles curtos entre cones/marcadores com mudança de ritmo.',
          focusAttribute: 'Drible / Controle',
          required: false,
        },
        {
          id: 'mid_shot',
          title: 'Finalização de Média Distância',
          instruction: 'Batida colocada ou forte buscando o canto.',
          focusAttribute: 'Chute',
          required: false,
        },
      ];
    }
    return [
      {
        id: 'att_shot',
        title: 'Finalização / Chute ao Gol',
        instruction: 'Grave 2–4 finalizações (chapado, peito de pé ou de primeira) mostrando precisão e força.',
        focusAttribute: 'Chute',
        required: true,
      },
      {
        id: 'att_drib',
        title: 'Drible & 1 contra 1',
        instruction: 'Mostre corte rápido, mudança de direção ou arrancada com controle próximo.',
        focusAttribute: 'Drible',
        required: false,
      },
      {
        id: 'att_pass',
        title: 'Tabela / Passe de Apoio',
        instruction: 'Domínio protegido e devolução rápida em 1 ou 2 toques.',
        focusAttribute: 'Passe',
        required: false,
      },
    ];
  }

  if (sport === 'futsal') {
    if (posLower.includes('goleiro')) {
      return [
        {
          id: 'fs_gk_save',
          title: 'Bloqueio em X / Espacate & Reflexo',
          instruction: 'Grave defesas rasteiras e fechamento de ângulo na área de 6m.',
          focusAttribute: 'Defesa',
          required: true,
        },
        {
          id: 'fs_gk_throw',
          title: 'Lançamento Rápido com a Mão',
          instruction: 'Reposição rápida de contra-ataque para o pivô ou ala.',
          focusAttribute: 'Reposição',
          required: false,
        },
      ];
    }
    if (posLower.includes('fixo')) {
      return [
        {
          id: 'fs_fix_pass',
          title: 'Pisada & Passe de Quebra de Linha',
          instruction: 'Domínio na sola e passe firme paralelo ou diagonal.',
          focusAttribute: 'Passe / Controle',
          required: true,
        },
        {
          id: 'fs_fix_shot',
          title: 'Chute de Média Distância & Marcação',
          instruction: 'Bate forte de fora ou fechamento defensivo no corredor central.',
          focusAttribute: 'Chute / Marcação',
          required: false,
        },
      ];
    }
    if (posLower.includes('pivô')) {
      return [
        {
          id: 'fs_piv_turn',
          title: 'Domínio de Costas & Giro Rápido',
          instruction: 'Receba de costas com a sola, proteja e gire finalizando rápido.',
          focusAttribute: 'Giro / Chute',
          required: true,
        },
        {
          id: 'fs_piv_wall',
          title: 'Passe de Parede (Tabela)',
          instruction: 'Paredão limpo de primeira ou em dois toques para quem chega de trás.',
          focusAttribute: 'Passe / Apoio',
          required: false,
        },
      ];
    }
    return [
      {
        id: 'fs_ala_drib',
        title: 'Drible na Sola & 1x1 na Ala',
        instruction: 'Puxada de sola, corte para dentro e velocidade em espaço curto.',
        focusAttribute: 'Drible',
        required: true,
      },
      {
        id: 'fs_ala_shot',
        title: 'Chute de Bico / Chapa em Movimento',
        instruction: 'Finalização rápida após condução pela lateral.',
        focusAttribute: 'Chute / Passe',
        required: false,
      },
    ];
  }

  if (sport === 'basquete') {
    if (posLower.includes('pivô')) {
      return [
        {
          id: 'bk_post',
          title: 'Finalização no Garrafão / Gancho',
          instruction: 'Trabalho de pés no garrafão com gancho ou bandeja protegida.',
          focusAttribute: 'Garrafão',
          required: true,
        },
        {
          id: 'bk_reb',
          title: 'Rebote & Passe de Saída',
          instruction: 'Salto para o rebote com proteção da bola e passe rápido.',
          focusAttribute: 'Rebote / Físico',
          required: false,
        },
      ];
    }
    return [
      {
        id: 'bk_handle',
        title: 'Controle de Bola (Drible) & Infiltração',
        instruction: 'Trocas de mão (crossover/entre as pernas) e bandeja ou ataque ao aro.',
        focusAttribute: 'Drible / Ritmo',
        required: true,
      },
      {
        id: 'bk_shoot',
        title: 'Arremesso de Perímetro / Lance Livre',
        instruction: 'Sequência de 3–5 arremessos mostrando mecânica, elevação e follow-through.',
        focusAttribute: 'Arremesso',
        required: false,
      },
      {
        id: 'bk_pass',
        title: 'Passe Picado & Leitura',
        instruction: 'Passes rápidos após drible mantendo cabeça erguida.',
        focusAttribute: 'Passe / Visão',
        required: false,
      },
    ];
  }

  // Vôlei
  if (posLower.includes('levantador')) {
    return [
      {
        id: 'vb_set',
        title: 'Toque de Levantamento (Frente & Costas)',
        instruction: 'Levantamentos precisos para ponta e saída de rede com bom punho.',
        focusAttribute: 'Levantamento',
        required: true,
      },
      {
        id: 'vb_serve',
        title: 'Saque Tático Direcionado',
        instruction: 'Execução de saque flutuante ou direcionado buscando zona específica.',
        focusAttribute: 'Saque',
        required: false,
      },
    ];
  }
  if (posLower.includes('líbero')) {
    return [
      {
        id: 'vb_lib_pass',
        title: 'Manchete de Recepção (Passe A)',
        instruction: 'Base baixa, plataforma firme dos braços e direcionamento ao levantador.',
        focusAttribute: 'Recepção / Defesa',
        required: true,
      },
      {
        id: 'vb_lib_dig',
        title: 'Defesa Baixa & Cobertura',
        instruction: 'Deslocamento lateral rápido e defesa de ataque forte.',
        focusAttribute: 'Agilidade',
        required: false,
      },
    ];
  }
  return [
    {
      id: 'vb_spike',
      title: 'Passada & Cortada (Ataque)',
      instruction: 'Passada de ataque (3 passos), salto e braçada rápida acima da cabeça.',
      focusAttribute: 'Ataque / Impulsão',
      required: true,
    },
    {
      id: 'vb_pass_serve',
      title: 'Manchete & Saque',
      instruction: 'Recepção controlada e execução limpa do saque.',
      focusAttribute: 'Passe / Saque',
      required: false,
    },
  ];
}
