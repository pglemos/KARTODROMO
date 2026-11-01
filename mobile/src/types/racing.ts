/**
 * Domain types and schemas for the Kartódromo Internacional de Betim mobile redesign.
 * High-performance sports dark/OLED telemetry and racing models.
 */

// ==========================================
// 1. Categories & Badges
// ==========================================

export type PilotCategory =
  | 'TODOS'
  | 'LENDA'
  | 'PROFISSIONAL'
  | 'SEMI-PRO'
  | 'AMADOR'
  | 'NOVATO';

export type PilotRankCategory = Exclude<PilotCategory, 'TODOS'>;

export type BadgeCategory = 'experiencia' | 'desafio' | 'especial';

export interface BadgeItem {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  icon: string; // SF Symbol, Material Symbol or custom SVG identifier
  unlocked: boolean;
  unlockedAt?: string;
  currentProgress?: number;
  totalRequired?: number;
  badgeColor?: string;
}

// ==========================================
// 2. Driver & Ranking
// ==========================================

export interface Driver {
  id: string;
  name: string;
  initials: string;
  avatarUrl?: string | null;
  category: PilotRankCategory;
  xp: number;
  points: number; // Final display rating points (e.g. 13112 PTS)
  rating: number; // Raw composite rating score (0 - 10000 scale)
  flag: string; // Country or state code (e.g. 'MG', 'SP', 'BR')
  rankPosition?: number;
  badges: BadgeItem[];
}

// ==========================================
// 3. News & Motorsport Content
// ==========================================

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  imageUrl: string;
  date: string; // Formatted date e.g. '14/OUT./2026'
  isoDate?: string;
  category: string; // e.g. 'FÓRMULA 1', 'KART BETIM', 'CAMPEONATO'
  author: string;
  readTime: string; // e.g. '3 min de leitura'
  commentsCount?: number;
  tags?: string[];
}

// ==========================================
// 4. Track & Partner Details
// ==========================================

export interface TrackPartnerSocials {
  whatsapp?: string;
  instagram?: string;
  youtube?: string;
  website?: string;
}

export interface TrackPartnerStats {
  totalEventsFinished: number;
  activeDriversCount: number;
  trackLengthMeters: number;
}

export interface TrackPartner {
  id: string;
  name: string;
  legalName?: string;
  logoUrl: string;
  bannerUrl: string;
  phone: string;
  address: string;
  socials: TrackPartnerSocials;
  isFavorite: boolean;
  stats: TrackPartnerStats;
  facilities: string[];
}

// ==========================================
// 5. Live Telemetry & Timing
// ==========================================

export type SessionFlagStatus = 'GREEN' | 'YELLOW' | 'RED' | 'CHECKERED';

export interface FastestLapInfo {
  competitorNumber: string;
  name: string;
  time: string; // e.g. '0:38.775'
  timeMs: number;
  lapNumber: number;
}

export interface LiveCompetitorDelta {
  value: string; // e.g. '+0:30.121'
  trend: 'faster' | 'slower' | 'neutral';
}

export interface LiveCompetitor {
  position: number;
  kartNumber: string;
  name: string;
  category: string; // e.g. 'RENTAL', 'GRADUADOS'
  flag: string;
  currentLap: number;
  lastLapTime: string; // e.g. '0:38.781'
  lastLapMs: number;
  bestLapTime: string; // e.g. '0:38.775'
  bestLapMs: number;
  bestLapNumber: number;
  diffLeader: string; // e.g. '0:00.000' or '+0:01.420'
  diffPrev: string; // e.g. '0:00.000' or '+0:00.315'
  isFastestLap: boolean;
  deltaRealtime: LiveCompetitorDelta;
}

export interface LiveSession {
  id: string;
  title: string; // e.g. 'BATERIAS 14/10/2026'
  subtitle: string; // e.g. 'BATERIA 09:00 - ESCOLA - RACE'
  trackName: string; // e.g. 'KART CENTER BETIM'
  /** instante do último retrato recebido da cronometragem, em ISO */
  updatedAt?: string;
  status: SessionFlagStatus;
  elapsedTime: string; // e.g. '0:17:54.548'
  elapsedMs: number;
  fastestLap?: FastestLapInfo | null;
  competitors: LiveCompetitor[];
}

// ==========================================
// 6. Cockpit HUD State (Landscape OLED Mode)
// ==========================================

export interface CockpitCompetitorAhead {
  kartNumber: string;
  name: string;
}

export interface CockpitDelta {
  value: string; // e.g. '+0:30.121'
  trend: 'faster' | 'slower';
  competitorAhead?: CockpitCompetitorAhead;
}

export interface CockpitLapInfo {
  time: string; // e.g. '0:32.878'
  trend?: 'faster' | 'slower';
}

export interface CockpitBestDelta {
  value: string; // e.g. '+3.696'
  isImprovement: boolean; // false if slower (+ red), true if faster (- green)
}

export interface CockpitDriverInfo {
  kartNumber: string; // '#07'
  name: string; // 'GERSON BARROS NETO DOS ANJOS'
}

export interface CockpitHUDState {
  sessionElapsedTime: string; // '0:16:34.544'
  currentLap: number; // 26
  currentPosition: string; // 'P1'
  currentLapTime: string; // '0:05.8'
  realtimeDelta: CockpitDelta;
  lastLap: CockpitLapInfo;
  bestLap: CockpitLapInfo;
  deltaBest: CockpitBestDelta;
  driverInfo: CockpitDriverInfo;
  displayTheme: 'neon-dark' | 'high-contrast';
}

// ==========================================
// 7. Agenda & Session Booking Slots
// ==========================================

export interface AgendaSlot {
  isBackendSlot?: boolean;
  formattedDateTime?: string;
  id: number | string;
  date: string; // '14/10/2026'
  time: string; // '11:00'
  title: string; // 'BATERIA 11:00'
  availableSlots: number; // 12
  maxSlots: number; // 20
  priceCentavos: number; // 11000 = R$ 110,00
  priceFormatted: string; // 'R$ 110,00'
  category: string; // 'LOCAÇÃO PADRÃO (SEG-SEX)'
  sportType: string; // 'KARTING'
  trackConfig: string; // 'TRAÇADO PRINCIPAL 1.110M'
  isSoldOut: boolean;
}

// ==========================================
// 8. Reactive Cart
// ==========================================

export interface CartItem {
  maxQuantity?: number;
  sessionId: number | string;
  sessionTitle: string; // 'BATERIA 11:00'
  trackName: string; // 'ACELERA KART' / 'KARTÓDROMO DE BETIM'
  date: string; // '14/OUT.'
  time: string; // '11:00'
  quantity: number; // 1
  unitPriceCentavos: number; // 11000
  totalPriceCentavos: number; // 11000
}

export interface CartState {
  items: CartItem[];
  totalQuantity: number;
  totalPriceCentavos: number;
  totalPriceFormatted: string;
  isCartOpen: boolean;
  addItem: (item: Omit<CartItem, 'totalPriceCentavos'>) => void;
  removeItem: (sessionId: number | string) => void;
  updateQuantity: (sessionId: number | string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
}

// ==========================================
// 9. Career Stats & Performance Profile
// ==========================================

export interface DriverEfficiencyStats {
  winRate: number; // e.g. 22 (22%)
  podiumRate: number; // e.g. 43 (43%)
  overallEfficiency: number; // e.g. 35 (35%)
  polesRate: number; // e.g. 0 (0%)
  bestLapsRate: number; // e.g. 25 (25%)
  validRacesRate: number; // e.g. 92 (92%)
}

export interface QualifiedRacingStats {
  completedRaces: number; // 309
  wins: number; // 70
  podiums: number; // 133
  poles: number; // 100
  bestLaps: number; // 78
  qualifyingSessions: number; // 0
}

export interface AllRacingStats {
  totalRaces: number; // 347
  completedRaces: number; // 339
  wins: number; // 81
  podiums: number; // 155
  poles: number; // 120
  bestLaps: number; // 97
  qualifyingSessions: number; // 365
  warmups: number; // 0
  freePractices: number; // 0
}

export interface CareerBadgesGroup {
  experience: BadgeItem[];
  challenge: BadgeItem[];
  special: BadgeItem[];
}

export interface ActiveGoalOrChallenge {
  id: string;
  title: string;
  progress: string;
}

export interface CareerStats {
  driverId: string;
  efficiency: DriverEfficiencyStats;
  qualifiedStats: QualifiedRacingStats;
  allStats: AllRacingStats;
  badges: CareerBadgesGroup;
  activeGoals: ActiveGoalOrChallenge[];
  activeChallenges: ActiveGoalOrChallenge[];
}
