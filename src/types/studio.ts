export type SportId = 'futebol' | 'futsal' | 'basquete' | 'volei';

export type MemberRole = 'owner' | 'member' | 'guest';

export type MatchStatus = 'scheduled' | 'live' | 'finished';

export type MatchEventType = 'goal' | 'opponent_goal' | 'yellow_card' | 'red_card' | 'foul';

export interface UserProfile {
  uid: string;
  displayName: string;
  photoUrl?: string;
  activeTeamId?: string;
  chatPushEnabled?: boolean;
  matchPushEnabled?: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

export type OvrStatus = 'none' | 'analyzing' | 'ready' | 'error';

export type ManualAssessmentValue =
  | 'video_pass'
  | 'video_retry'
  | 'sim'
  | 'mais_ou_menos'
  | 'nao';

export interface ManualProgress {
  trackId: string;
  sport: SportId;
  position: string;
  xp: number;
  streak: number;
  completedCount: number;
  highestLesson: number;
  completedLessons: Record<string, boolean>;
  lessonAssessments?: Record<string, ManualAssessmentValue>;
  recommendedDrills?: string[];
  updatedAt: unknown;
}

export interface UserTeamMembership {
  teamId: string;
  teamName: string;
  sport: SportId;
  photoUrl?: string;
  role: 'owner' | 'member';
  inviteCode: string;
  joinedAt: unknown;
  updatedAt: unknown;
}

export interface Team {
  id: string;
  name: string;
  sport: SportId;
  photoUrl?: string;
  ownerId: string;
  inviteCode: string;
  formation: string;
  captainMemberId?: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  name: string;
  jerseyNumber: number;
  position: string;
  role: MemberRole;
  isStarter: boolean;
  posX: number;
  posY: number;
  inviteCode?: string;
  ovrRating?: number;
  ovrStatus?: OvrStatus;
  ovrReadyAtMs?: number;
  ovrPendingRating?: number;
  ovrSummary?: string;
  ovrStats?: Record<string, number>;
  ovrExercises?: string[];
  ovrUpdatedAtMs?: number;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface AiOvrEvalResponse {
  ovr: number;
  attributes: Record<string, number>;
  sincereFeedback: string;
  recommendedExercises: string[];
}

export interface AiManualVideoResponse {
  passed: boolean;
  techniqueScore: number;
  sincereFeedback: string;
  recommendedExercises: string[];
  shouldIncreaseOvr: boolean;
  ovrDelta: number;
}

export interface TeamMessage {
  id: string;
  teamId: string;
  senderId: string;
  senderName: string;
  senderJersey: number;
  senderPosition?: string;
  text: string;
  createdAt: unknown;
}

export interface Match {
  id: string;
  teamId: string;
  opponent: string;
  location?: string;
  status: MatchStatus;
  teamScore: number;
  opponentScore: number;
  halfDurationMinutes: number;
  extraMinutes: number;
  elapsedSeconds: number;
  isClockRunning: boolean;
  lastStartedAtMs: number;
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface MatchEvent {
  id: string;
  teamId: string;
  matchId: string;
  type: MatchEventType;
  playerId?: string;
  playerName: string;
  playerJersey: number;
  minute: number;
  extraMinute: number;
  note?: string;
  createdBy: string;
  createdAt: unknown;
}

export interface InviteLookup {
  code: string;
  teamId: string;
  teamName: string;
  sport: SportId;
  photoUrl?: string;
  ownerId: string;
  takenJerseys: Record<string, string>;
  createdAt: unknown;
  updatedAt: unknown;
}

export type PlayArrowKind = 'pass' | 'run' | 'shot';

export interface PlayArrow {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  kind: PlayArrowKind;
}

export interface PlayTokenPos {
  id: string;
  label: string;
  jerseyNumber: number;
  isCaptain?: boolean;
  x: number;
  y: number;
}

export interface PlayFrame {
  id: string;
  label: string;
  note: string;
  ballX: number;
  ballY: number;
  tokens: PlayTokenPos[];
  arrows: PlayArrow[];
}

export interface TeamPlayDoc {
  id: string;
  teamId: string;
  title: string;
  category: string;
  description?: string;
  sport: SportId;
  frameCount: number;
  framesJson: string;
  createdBy: string;
  createdByName: string;
  createdByRole: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface AiLineupAssignment {
  memberId: string;
  isStarter: boolean;
  position: string;
  posX: number;
  posY: number;
}

export interface AiLineupResponse {
  formation: string;
  captainMemberId: string;
  summary: string;
  assignments: AiLineupAssignment[];
}

export interface FormationSlot {
  label: string;
  x: number;
  y: number;
}

export interface SportConfig {
  id: SportId;
  label: string;
  subtitle: string;
  startersCount: number;
  defaultHalfMinutes: number;
  scoreLabel: string;
  positions: string[];
  formations: Record<string, FormationSlot[]>;
  imageUrl: string;
}

export const STAFF_POSITIONS = [
  'Técnico',
  'Treinador de Goleiro',
  'Auxiliar',
] as const;

export type StaffPosition = (typeof STAFF_POSITIONS)[number];

export const STAFF_ABBR: Record<string, string> = {
  Técnico: 'TEC',
  'Treinador de Goleiro': 'T.GOL',
  Auxiliar: 'AUX',
};

export function isStaffPosition(position: string): boolean {
  return (STAFF_POSITIONS as readonly string[]).includes(position);
}

export const FIELD_LIMITS = {
  MIN_TEAM_NAME: 2,
  MAX_TEAM_NAME: 60,
  MAX_PLAYER_NAME: 80,
  MAX_OPPONENT_NAME: 80,
  MAX_LOCATION: 100,
  MAX_MESSAGE: 1000,
  MAX_NOTE: 160,
  MAX_PHOTO_LEN: 200000,
  MIN_JERSEY: 0,
  MAX_JERSEY: 99,
};

export const STUDIO_IMAGES = {
  heroPitch: '/src/assets/images/light_studio_hero_1795628381131.jpg',
  defaultCrest: '/src/assets/images/crest_badge_default_1795623937950.jpg',
  futebol: '/src/assets/images/light_sport_futebol_1795628381143.jpg',
  futsal: '/src/assets/images/light_sport_futsal_1795628381389.jpg',
  court: '/src/assets/images/light_sport_court_1795628382204.jpg',
};

export const SPORTS_CONFIG: Record<SportId, SportConfig> = {
  futebol: {
    id: 'futebol',
    label: 'Futebol',
    subtitle: 'Campo gramado · 11 titulares · 45 min',
    startersCount: 11,
    defaultHalfMinutes: 45,
    scoreLabel: 'Gols',
    imageUrl: STUDIO_IMAGES.futebol,
    positions: [
      'Goleiro',
      'Zagueiro',
      'Lateral Direito',
      'Lateral Esquerdo',
      'Volante',
      'Meia',
      'Ponta',
      'Atacante',
    ],
    formations: {
      '4-3-3': [
        { label: 'GOL', x: 50, y: 90 },
        { label: 'LE', x: 16, y: 72 },
        { label: 'ZAG', x: 38, y: 74 },
        { label: 'ZAG', x: 62, y: 74 },
        { label: 'LD', x: 84, y: 72 },
        { label: 'VOL', x: 50, y: 56 },
        { label: 'MEI', x: 30, y: 46 },
        { label: 'MEI', x: 70, y: 46 },
        { label: 'PE', x: 20, y: 24 },
        { label: 'ATA', x: 50, y: 18 },
        { label: 'PD', x: 80, y: 24 },
      ],
      '4-4-2': [
        { label: 'GOL', x: 50, y: 90 },
        { label: 'LE', x: 16, y: 72 },
        { label: 'ZAG', x: 38, y: 74 },
        { label: 'ZAG', x: 62, y: 74 },
        { label: 'LD', x: 84, y: 72 },
        { label: 'ME', x: 18, y: 48 },
        { label: 'MC', x: 40, y: 52 },
        { label: 'MC', x: 60, y: 52 },
        { label: 'MD', x: 82, y: 48 },
        { label: 'ATA', x: 37, y: 21 },
        { label: 'ATA', x: 63, y: 21 },
      ],
      '3-5-2': [
        { label: 'GOL', x: 50, y: 90 },
        { label: 'ZAG', x: 26, y: 74 },
        { label: 'ZAG', x: 50, y: 76 },
        { label: 'ZAG', x: 74, y: 74 },
        { label: 'ALA E', x: 14, y: 50 },
        { label: 'VOL', x: 38, y: 56 },
        { label: 'VOL', x: 62, y: 56 },
        { label: 'MEI', x: 50, y: 40 },
        { label: 'ALA D', x: 86, y: 50 },
        { label: 'ATA', x: 38, y: 20 },
        { label: 'ATA', x: 62, y: 20 },
      ],
      '4-2-3-1': [
        { label: 'GOL', x: 50, y: 90 },
        { label: 'LE', x: 16, y: 72 },
        { label: 'ZAG', x: 38, y: 74 },
        { label: 'ZAG', x: 62, y: 74 },
        { label: 'LD', x: 84, y: 72 },
        { label: 'VOL', x: 38, y: 56 },
        { label: 'VOL', x: 62, y: 56 },
        { label: 'PE', x: 22, y: 36 },
        { label: 'MEI', x: 50, y: 36 },
        { label: 'PD', x: 78, y: 36 },
        { label: 'ATA', x: 50, y: 17 },
      ],
    },
  },
  futsal: {
    id: 'futsal',
    label: 'Futsal',
    subtitle: 'Quadra coberta · 5 titulares · 20 min',
    startersCount: 5,
    defaultHalfMinutes: 20,
    scoreLabel: 'Gols',
    imageUrl: STUDIO_IMAGES.futsal,
    positions: ['Goleiro', 'Fixo', 'Ala Direito', 'Ala Esquerdo', 'Pivô'],
    formations: {
      '1-2-1': [
        { label: 'GOL', x: 50, y: 88 },
        { label: 'FIXO', x: 50, y: 66 },
        { label: 'ALA E', x: 20, y: 45 },
        { label: 'ALA D', x: 80, y: 45 },
        { label: 'PIVÔ', x: 50, y: 20 },
      ],
      '2-2': [
        { label: 'GOL', x: 50, y: 88 },
        { label: 'FIXO', x: 32, y: 64 },
        { label: 'ALA', x: 68, y: 64 },
        { label: 'ALA', x: 28, y: 28 },
        { label: 'PIVÔ', x: 72, y: 28 },
      ],
      '3-1': [
        { label: 'GOL', x: 50, y: 88 },
        { label: 'ALA E', x: 20, y: 58 },
        { label: 'FIXO', x: 50, y: 62 },
        { label: 'ALA D', x: 80, y: 58 },
        { label: 'PIVÔ', x: 50, y: 22 },
      ],
      '4-0': [
        { label: 'GOL', x: 50, y: 88 },
        { label: 'ALA E', x: 18, y: 46 },
        { label: 'FIXO', x: 39, y: 52 },
        { label: 'FIXO', x: 61, y: 52 },
        { label: 'ALA D', x: 82, y: 46 },
      ],
    },
  },
  basquete: {
    id: 'basquete',
    label: 'Basquete',
    subtitle: 'Quadra · 5 titulares · 10 min por quarto',
    startersCount: 5,
    defaultHalfMinutes: 10,
    scoreLabel: 'Pontos',
    imageUrl: STUDIO_IMAGES.court,
    positions: [
      'Armador (PG)',
      'Ala-Armador (SG)',
      'Ala (SF)',
      'Ala-Pivô (PF)',
      'Pivô (C)',
    ],
    formations: {
      '2-3 Zona': [
        { label: 'PG', x: 34, y: 34 },
        { label: 'SG', x: 66, y: 34 },
        { label: 'SF', x: 20, y: 70 },
        { label: 'PF', x: 80, y: 70 },
        { label: 'C', x: 50, y: 76 },
      ],
      '1-3-1': [
        { label: 'PG', x: 50, y: 26 },
        { label: 'SG', x: 20, y: 52 },
        { label: 'SF', x: 80, y: 52 },
        { label: 'PF', x: 50, y: 54 },
        { label: 'C', x: 50, y: 80 },
      ],
      '3-2': [
        { label: 'PG', x: 50, y: 28 },
        { label: 'SG', x: 22, y: 38 },
        { label: 'SF', x: 78, y: 38 },
        { label: 'PF', x: 34, y: 72 },
        { label: 'C', x: 66, y: 72 },
      ],
    },
  },
  volei: {
    id: 'volei',
    label: 'Vôlei',
    subtitle: 'Quadra · 6 titulares · 25 pontos por set',
    startersCount: 6,
    defaultHalfMinutes: 25,
    scoreLabel: 'Pontos',
    imageUrl: STUDIO_IMAGES.court,
    positions: ['Levantador', 'Oposto', 'Ponteiro', 'Central', 'Líbero'],
    formations: {
      '5-1': [
        { label: 'P4', x: 22, y: 30 },
        { label: 'CEN', x: 50, y: 26 },
        { label: 'OPO', x: 78, y: 30 },
        { label: 'P5', x: 22, y: 70 },
        { label: 'LIB', x: 50, y: 74 },
        { label: 'LEV', x: 78, y: 70 },
      ],
      '4-2': [
        { label: 'PON', x: 22, y: 30 },
        { label: 'CEN', x: 50, y: 26 },
        { label: 'LEV', x: 78, y: 30 },
        { label: 'LEV', x: 22, y: 70 },
        { label: 'LIB', x: 50, y: 74 },
        { label: 'PON', x: 78, y: 70 },
      ],
      '6-0': [
        { label: 'E-F', x: 22, y: 30 },
        { label: 'C-F', x: 50, y: 26 },
        { label: 'D-F', x: 78, y: 30 },
        { label: 'E-T', x: 22, y: 70 },
        { label: 'C-T', x: 50, y: 74 },
        { label: 'D-T', x: 78, y: 70 },
      ],
    },
  },
};
