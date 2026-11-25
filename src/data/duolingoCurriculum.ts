import { isStaffPosition, SPORTS_CONFIG, SportId } from '../types/studio';
import { findPositionManual } from './positionManuals';

export interface LessonChallenge {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface DuolingoLesson {
  lessonNumber: number; // 1..460
  unitIndex: number; // 1..20
  lessonInUnit: number; // 1..23
  unitTitle: string;
  title: string;
  xp: number;
  isMilestone: boolean;
  teachingTitle: string;
  teachingBody: string;
  tacticalCue: string;
  challenges: LessonChallenge[];
}

export interface UnitMeta {
  unitIndex: number;
  title: string;
  subtitle: string;
  accent: 'emerald' | 'sky' | 'amber' | 'indigo' | 'rose';
}

export const TOTAL_MANUAL_LESSONS = 460; // 20 units * 23 lessons = 460 lessons (>= 450)
export const LESSONS_PER_UNIT = 23;
export const TOTAL_UNITS = 20;

export const UNIT_METADATA: UnitMeta[] = [
  { unitIndex: 1, title: 'Regras e Estrutura do Esporte', subtitle: 'Tempos, linhas, faltas e dinâmica oficial', accent: 'emerald' },
  { unitIndex: 2, title: 'Identidade da Sua Função', subtitle: 'O que o time espera de você em todo jogo', accent: 'sky' },
  { unitIndex: 3, title: 'Posicionamento e Zonas Ideais', subtitle: 'Onde estar antes da jogada acontecer', accent: 'indigo' },
  { unitIndex: 4, title: 'Primeiro Controle e Postura', subtitle: 'Orientação corporal e leitura antes do toque', accent: 'amber' },
  { unitIndex: 5, title: 'Ações com Posse e Construção', subtitle: 'Passes, condução e progressão segura', accent: 'emerald' },
  { unitIndex: 6, title: 'Movimento Sem Bola e Desmarques', subtitle: 'Criar linhas de passe e abrir espaços', accent: 'sky' },
  { unitIndex: 7, title: 'Marcação e Fechamento de Linha', subtitle: 'Tempo de bote, distância e proteção do centro', accent: 'rose' },
  { unitIndex: 8, title: 'Cobertura e Compactação Coletiva', subtitle: 'Proteger costas dos companheiros', accent: 'indigo' },
  { unitIndex: 9, title: 'Transição Ofensiva Rápida', subtitle: 'Acelerar nos primeiros 5 segundos após recuperar', accent: 'emerald' },
  { unitIndex: 10, title: 'Transição Defensiva Imediata', subtitle: 'Recomposição e pressão pós-perda', accent: 'amber' },
  { unitIndex: 11, title: 'Bolas Paradas e Reinícios', subtitle: 'Escanteios, faltas, laterais e reposições', accent: 'sky' },
  { unitIndex: 12, title: 'Comunicação Tática em Jogo', subtitle: 'Comandos curtos para organizar o elenco', accent: 'indigo' },
  { unitIndex: 13, title: 'Decisões Sob Pressão', subtitle: 'Escolher a jogada certa com pouco tempo', accent: 'rose' },
  { unitIndex: 14, title: 'Disciplina, Faltas e Cartões', subtitle: 'Evitar cartões bobos e faltas acumuladas', accent: 'amber' },
  { unitIndex: 15, title: 'Duelos 1 contra 1 no Setor', subtitle: 'Superar ou neutralizar seu oponente direto', accent: 'emerald' },
  { unitIndex: 16, title: 'Conexões e Tabelas por Setor', subtitle: 'Triangulações com o bloco mais próximo', accent: 'sky' },
  { unitIndex: 17, title: 'Gestão de Tempo e Acréscimos', subtitle: 'Controlar vantagem ou buscar empate no fim', accent: 'indigo' },
  { unitIndex: 18, title: 'Formações e Mudanças Táticas', subtitle: 'Adaptar sua função a cada esquema', accent: 'amber' },
  { unitIndex: 19, title: 'Pré-Jogo, Aquecimento e Foco', subtitle: 'Rotina mental e física antes do apito', accent: 'emerald' },
  { unitIndex: 20, title: 'Maestria Completa e Liderança', subtitle: 'Domínio absoluto do esporte e da posição', accent: 'rose' },
];

interface SportFactBank {
  sportLabel: string;
  arenaName: string;
  halfRule: string;
  foulRule: string;
  restartRule: string;
  keyArea: string;
  formationList: string[];
  startersDesc: string;
}

const SPORT_FACTS: Record<SportId, SportFactBank> = {
  futebol: {
    sportLabel: 'Futebol',
    arenaName: 'campo gramado',
    halfRule: '2 tempos de 45 minutos mais os acréscimos definidos pela arbitragem',
    foulRule: '2 cartões amarelos geram expulsão (vermelho); falta dentro da área resulta em pênalti',
    restartRule: 'laterais são cobrados com as mãos e tiros de meta recomeçam na pequena área',
    keyArea: 'grande área e meia-lua defensiva',
    formationList: ['4-3-3', '4-4-2', '3-5-2', '4-2-3-1'],
    startersDesc: '11 titulares em campo (10 de linha e 1 goleiro)',
  },
  futsal: {
    sportLabel: 'Futsal',
    arenaName: 'quadra coberta',
    halfRule: '2 tempos de 20 minutos cronometrados com pausa quando a bola sai',
    foulRule: 'após 5 faltas coletivas no tempo, toda falta seguinte gera tiro livre direto sem barreira dos 10m',
    restartRule: 'laterais e escanteios são cobrados com os pés em até 4 segundos',
    keyArea: 'área semicircular de 6 metros e marca dos 10 metros',
    formationList: ['1-2-1', '2-2', '3-1', '4-0'],
    startersDesc: '5 titulares em quadra (4 na linha e 1 goleiro)',
  },
  basquete: {
    sportLabel: 'Basquete',
    arenaName: 'quadra de madeira',
    halfRule: '4 quartos de 10 minutos (FIBA) com relógio de posse de 24 segundos por ataque',
    foulRule: 'com 5 faltas pessoais o jogador sai da partida; acima de 4 faltas coletivas no quarto há lances livres',
    restartRule: 'reposição lateral ou de fundo em até 5 segundos; 8 segundos para cruzar a meia quadra',
    keyArea: 'garrafão, linha de lance livre e arco de 3 pontos',
    formationList: ['2-3 Zona', '1-3-1', '3-2'],
    startersDesc: '5 titulares em quadra divididos entre perímetro e garrafão',
  },
  volei: {
    sportLabel: 'Vôlei',
    arenaName: 'quadra dividida pela rede',
    halfRule: 'sets até 25 pontos (com 2 de diferença) e tie-break até 15 pontos',
    foulRule: 'máximo de 3 toques por equipe antes de passar a bola; invasão ou toque na rede dá ponto ao rival',
    restartRule: 'rodízio horário obrigatório a cada vez que o time recupera o direito de sacar',
    keyArea: 'zona de ataque (3 metros) e zonas de defesa no fundo (1, 6 e 5)',
    formationList: ['5-1', '4-2', '6-0'],
    startersDesc: '6 titulares em quadra em sistema de rodízio mais o líbero especialista',
  },
};

const LESSON_ANGLES = [
  'Conceito Essencial',
  'Posicionamento Inicial',
  'Leitura Antes da Jogada',
  'Orientação Corporal',
  'Execução com Bola / Posse',
  'Apoio e Linha de Passe',
  'Ação Sem Bola',
  'Marcação e Contenção',
  'Cobertura do Companheiro',
  'Troca Rápida de Direção',
  'Comunicação Efetiva',
  'Decisão em 2 Segundos',
  'Gestão de Energia',
  'Bola Parada Ofensiva',
  'Bola Parada Defensiva',
  'Contra-Ataque / Transição',
  'Recomposição Pós-Perda',
  'Erro Comum para Eliminar',
  'Controle Emocional e Faltas',
  'Leitura do Adversário',
  'Ajuste de Formação',
  'Situação de Reta Final',
  'Desafio Mestre da Unidade',
];

function rotateOptions(correct: string, distractors: string[], seed: number): { options: string[]; correctIndex: number } {
  const all = [correct, ...distractors];
  const shift = seed % all.length;
  const options = all.map((_, idx) => all[(idx + shift) % all.length]);
  const correctIndex = options.indexOf(correct);
  return { options, correctIndex };
}

export function buildTrackId(sport: SportId, position: string): string {
  const raw = `${sport}_${position}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return raw.slice(0, 80) || `${sport}_geral`;
}

export function generateCurriculumForPosition(
  sport: SportId,
  rawPosition: string
): DuolingoLesson[] {
  const sportCfg = SPORTS_CONFIG[sport];
  const position = rawPosition || sportCfg.positions[0];
  const manual = findPositionManual(position, sport);
  const facts = SPORT_FACTS[sport];
  const isStaff = isStaffPosition(position);

  const lessons: DuolingoLesson[] = [];

  for (let u = 0; u < TOTAL_UNITS; u += 1) {
    const unit = UNIT_METADATA[u];

    for (let l = 0; l < LESSONS_PER_UNIT; l += 1) {
      const lessonNumber = u * LESSONS_PER_UNIT + l + 1;
      const lessonInUnit = l + 1;
      const isMilestone = lessonInUnit === LESSONS_PER_UNIT;
      const angle = LESSON_ANGLES[l];

      const withBallTip = manual.withBall[(u + l) % manual.withBall.length];
      const withoutBallTip = manual.withoutBall[(u + l + 1) % manual.withoutBall.length];
      const avoidTip = manual.avoid[(u + l) % manual.avoid.length];
      const formationName = facts.formationList[(u + l) % facts.formationList.length];

      const title = isMilestone
        ? `Checkpoint ${unit.unitIndex}: ${unit.title}`
        : `${angle} — ${position}`;

      let teachingTitle = `${unit.title} · ${angle}`;
      let teachingBody = '';
      let tacticalCue = manual.goldenRule;

      const phase = (u + l) % 5;
      if (phase === 0) {
        teachingBody = `No ${facts.sportLabel} (${facts.startersDesc}), quem atua como ${position} precisa dominar este pilar de "${unit.title}": ${manual.summary} Na prática de ${facts.arenaName}, observe sempre ${facts.keyArea} antes de agir.`;
        tacticalCue = manual.zoneTip;
      } else if (phase === 1) {
        teachingBody = `Quando a equipe está em posse ou organizando o ataque na formação ${formationName}, o foco do ${position} nesta etapa é: ${withBallTip} Lembre também da regra central do ${facts.sportLabel}: ${facts.halfRule}.`;
        tacticalCue = withBallTip;
      } else if (phase === 2) {
        teachingBody = `Na fase defensiva dentro da ${facts.arenaName}, o ${position} equilibra o sistema aplicando: ${withoutBallTip} Fique atento às normas disciplinares: ${facts.foulRule}.`;
        tacticalCue = withoutBallTip;
      } else if (phase === 3) {
        teachingBody = `Para evitar erros custosos como ${position}, elimine este hábito: "${avoidTip}". Nos reinícios de jogo, lembre-se que ${facts.restartRule}.`;
        tacticalCue = `Evite: ${avoidTip}`;
      } else {
        teachingBody = `Em cenários decisivos de ${facts.sportLabel} (como ${unit.subtitle.toLowerCase()}), o ${position} de alto nível combina ${manual.zoneTip} com a regra de ouro: ${manual.goldenRule}`;
        tacticalCue = manual.goldenRule;
      }

      if (isStaff) {
        teachingBody = `Como ${position} da comissão técnica no ${facts.sportLabel}, você comanda o ajuste coletivo fora das quatro linhas. ${
          phase % 2 === 0 ? withBallTip : withoutBallTip
        } Regra essencial do esporte: ${facts.foulRule}.`;
      }

      // Challenge 1: Position tactical decision
      const c1Correct =
        phase % 2 === 0 ? withBallTip : withoutBallTip;
      const c1Distractors = [
        avoidTip,
        `Ignorar a formação ${formationName} e ficar parado longe da ${facts.keyArea}.`,
        `Esperar o apito final sem comunicar trocas nem ajustar a marcação.`,
      ];
      const q1 = rotateOptions(c1Correct, c1Distractors, lessonNumber);

      // Challenge 2: Sport rules & situational awareness
      const sportRuleVariant = lessonNumber % 3;
      let q2Question = '';
      let q2Correct = '';
      let q2Distractors: string[] = [];
      let q2Explanation = '';

      if (sportRuleVariant === 0) {
        q2Question = `Sobre a estrutura e o tempo oficial do ${facts.sportLabel}, qual afirmação está correta para ${position}?`;
        q2Correct = `O jogo segue ${facts.halfRule}, exigindo leitura de ritmo do ${position}.`;
        q2Distractors = [
          `Não existe limite de tempo nem controle de acréscimos ou sets no ${facts.sportLabel}.`,
          `Cada equipe joga com número ilimitado de titulares em quadra ou campo.`,
          `Apenas o capitão pode se movimentar pela ${facts.keyArea}.`,
        ];
        q2Explanation = `No ${facts.sportLabel}: ${facts.halfRule}. ${manual.goldenRule}`;
      } else if (sportRuleVariant === 1) {
        q2Question = `Em relação a faltas, cartões e disciplina no ${facts.sportLabel}, o que você deve considerar?`;
        q2Correct = `${facts.foulRule[0].toUpperCase()}${facts.foulRule.slice(1)}.`;
        q2Distractors = [
          `Faltas repetidas e cartões nunca alteram a contagem coletiva ou permanência em jogo.`,
          `Cartão vermelho permite continuar jogando normalmente sem punição.`,
          `Não há nenhuma regra de reinício após uma infração.`,
        ];
        q2Explanation = `Atenção disciplinar: ${facts.foulRule}.`;
      } else {
        q2Question = `Qual postura resume melhor a Regra de Ouro do ${position} durante uma partida na formação ${formationName}?`;
        q2Correct = manual.goldenRule;
        q2Distractors = [
          avoidTip,
          `Desconsiderar ${facts.restartRule.split(';')[0]} durante toda a partida.`,
          `Fazer jogadas isoladas sem observar o posicionamento dos companheiros.`,
        ];
        q2Explanation = `Regra de Ouro do ${position}: ${manual.goldenRule}`;
      }

      const q2 = rotateOptions(q2Correct, q2Distractors, lessonNumber + 1);

      lessons.push({
        lessonNumber,
        unitIndex: unit.unitIndex,
        lessonInUnit,
        unitTitle: unit.title,
        title,
        xp: isMilestone ? 30 : 15,
        isMilestone,
        teachingTitle,
        teachingBody,
        tacticalCue,
        challenges: [
          {
            question: `[Lição ${lessonNumber}/${TOTAL_MANUAL_LESSONS}] Em uma situação real de ${facts.sportLabel} como ${position} (${unit.title}), qual atitude é a mais recomendada?`,
            options: q1.options,
            correctIndex: q1.correctIndex,
            explanation: `Correto! ${c1Correct} (${manual.zoneTip})`,
          },
          {
            question: q2Question,
            options: q2.options,
            correctIndex: q2.correctIndex,
            explanation: q2Explanation,
          },
        ],
      });
    }
  }

  return lessons;
}
