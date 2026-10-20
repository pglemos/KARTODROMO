/**
 * Central mock database and racing domain fixtures for Kartódromo de Betim mobile redesign.
 * High-performance dark/OLED datasets matching reference images and official track details.
 */

import {
  AgendaSlot,
  BadgeItem,
  CareerStats,
  CockpitHUDState,
  Driver,
  LiveSession,
  NewsArticle,
  PilotCategory,
  TrackPartner,
} from '../types/racing';

// ==========================================
// 1. Badges Catalog (12 Official Badges)
// ==========================================

export const ALL_BADGES_CATALOG: BadgeItem[] = [
  // Badges de Experiência
  {
    id: 'badge-exp-1',
    name: 'Estreante',
    description: 'Complete sua primeira corrida oficial no circuito.',
    category: 'experiencia',
    icon: 'star',
    unlocked: true,
    unlockedAt: '2025-01-15T14:30:00Z',
    currentProgress: 1,
    totalRequired: 1,
    badgeColor: '#ACACAC', // Prata
  },
  {
    id: 'badge-exp-2',
    name: 'Experiente',
    description: 'Alcance o nível Amador acumulando mais de 10.000 XP.',
    category: 'experiencia',
    icon: 'star-half',
    unlocked: true,
    unlockedAt: '2025-05-20T18:00:00Z',
    currentProgress: 2,
    totalRequired: 2,
    badgeColor: '#EC4899', // Rosa
  },
  {
    id: 'badge-exp-3',
    name: 'Veterano',
    description: 'Alcance o nível Semi-Pro acumulando mais de 25.000 XP.',
    category: 'experiencia',
    icon: 'crown',
    unlocked: true,
    unlockedAt: '2025-11-10T20:15:00Z',
    currentProgress: 3,
    totalRequired: 3,
    badgeColor: '#8B5CF6', // Roxo
  },
  {
    id: 'badge-exp-4',
    name: 'Lenda',
    description: 'Alcance o nível máximo Lenda acumulando mais de 50.000 XP.',
    category: 'experiencia',
    icon: 'crown-fill',
    unlocked: true,
    unlockedAt: '2026-03-01T12:00:00Z',
    currentProgress: 5,
    totalRequired: 5,
    badgeColor: '#F59E0B', // Ouro
  },

  // Badges de Desafio
  {
    id: 'badge-desafio-1',
    name: 'Vitória de Corrida',
    description: 'Vença uma bateria com pelo menos 10 pilotos no grid.',
    category: 'desafio',
    icon: 'trophy',
    unlocked: true,
    unlockedAt: '2025-02-10T16:00:00Z',
    currentProgress: 1,
    totalRequired: 1,
    badgeColor: '#F59E0B', // Ouro
  },
  {
    id: 'badge-desafio-2',
    name: 'Pole Position',
    description: 'Conquiste a pole position em tomada de tempo oficial.',
    category: 'desafio',
    icon: 'crosshair',
    unlocked: true,
    unlockedAt: '2025-03-12T17:30:00Z',
    currentProgress: 1,
    totalRequired: 1,
    badgeColor: '#00E676', // Verde Neon
  },
  {
    id: 'badge-desafio-3',
    name: 'Final de Semana Perfeito',
    description: 'Conquiste pole position e vitória na mesma bateria.',
    category: 'desafio',
    icon: 'sparkles',
    unlocked: false,
    currentProgress: 0,
    totalRequired: 1,
    badgeColor: '#6F4B89',
  },
  {
    id: 'badge-desafio-4',
    name: 'Rei do Comeback',
    description: 'Vença uma corrida largando das últimas posições do grid.',
    category: 'desafio',
    icon: 'arrow-up-circle',
    unlocked: false,
    currentProgress: 0,
    totalRequired: 1,
    badgeColor: '#F97316', // Laranja
  },
  {
    id: 'badge-desafio-5',
    name: 'Hot Streak',
    description: 'Suba ao pódio em 3 baterias consecutivas no mesmo mês.',
    category: 'desafio',
    icon: 'flame',
    unlocked: true,
    unlockedAt: '2026-02-18T19:00:00Z',
    currentProgress: 3,
    totalRequired: 3,
    badgeColor: '#EF4444', // Vermelho Neon
  },
  {
    id: 'badge-desafio-6',
    name: 'Volta Voadora',
    description: 'Marque a volta mais rápida da sessão (Purple Lap).',
    category: 'desafio',
    icon: 'timer',
    unlocked: true,
    unlockedAt: '2026-04-05T15:20:00Z',
    currentProgress: 1,
    totalRequired: 1,
    badgeColor: '#8B5CF6', // Roxo
  },

  // Badges Especiais
  {
    id: 'badge-esp-1',
    name: 'Mestre do Clima',
    description: 'Dispute e vença uma prova com pista molhada sob chuva.',
    category: 'especial',
    icon: 'cloud-rain',
    unlocked: true,
    unlockedAt: '2026-01-22T21:00:00Z',
    currentProgress: 1,
    totalRequired: 1,
    badgeColor: '#3B82F6', // Azul Elétrico
  },
  {
    id: 'badge-esp-2',
    name: 'Corredor Noturno',
    description: 'Complete 10 ou mais baterias no horário noturno com iluminação artificial.',
    category: 'especial',
    icon: 'moon-stars',
    unlocked: true,
    unlockedAt: '2026-02-28T22:30:00Z',
    currentProgress: 10,
    totalRequired: 10,
    badgeColor: '#6366F1', // Indigo
  },
];

// Helper to pick badges for drivers
const getBadgesSubset = (ids: string[]): BadgeItem[] => {
  return ALL_BADGES_CATALOG.filter((b) => ids.includes(b.id));
};

// ==========================================
// 2. Drivers Database
// ==========================================

export const MOCK_DRIVERS: Driver[] = [
  // --- LENDA (Top 5) ---
  {
    id: 'driver-nelson-castro',
    name: 'NELSON CASTRO',
    initials: 'NC',
    avatarUrl: null,
    category: 'LENDA',
    xp: 61251,
    points: 13112,
    rating: 9840,
    flag: 'MG',
    rankPosition: 1,
    badges: getBadgesSubset([
      'badge-exp-4',
      'badge-desafio-1',
      'badge-desafio-2',
      'badge-desafio-5',
      'badge-desafio-6',
      'badge-esp-1',
    ]),
  },
  {
    id: 'driver-toni-siqueira',
    name: 'TONI SIQUEIRA',
    initials: 'TS',
    avatarUrl: null,
    category: 'LENDA',
    xp: 54320,
    points: 11980,
    rating: 9120,
    flag: 'MG',
    rankPosition: 2,
    badges: getBadgesSubset([
      'badge-exp-4',
      'badge-desafio-1',
      'badge-desafio-2',
      'badge-desafio-5',
    ]),
  },
  {
    id: 'driver-murilo-perly',
    name: 'MURILO PERLY',
    initials: 'MP',
    avatarUrl: null,
    category: 'LENDA',
    xp: 48910,
    points: 10840,
    rating: 8650,
    flag: 'SP',
    rankPosition: 3,
    badges: getBadgesSubset([
      'badge-exp-4',
      'badge-desafio-1',
      'badge-desafio-6',
      'badge-esp-2',
    ]),
  },
  {
    id: 'driver-yago-brandao',
    name: 'YAGO BRANDÃO',
    initials: 'YB',
    avatarUrl: null,
    category: 'LENDA',
    xp: 43150,
    points: 9720,
    rating: 8150,
    flag: 'MG',
    rankPosition: 4,
    badges: getBadgesSubset([
      'badge-exp-4',
      'badge-desafio-2',
      'badge-desafio-5',
    ]),
  },
  {
    id: 'driver-leonardo-bruno',
    name: 'LEONARDO BRUNO MARTINS',
    initials: 'LM',
    avatarUrl: null,
    category: 'LENDA',
    xp: 39800,
    points: 8950,
    rating: 7780,
    flag: 'RJ',
    rankPosition: 5,
    badges: getBadgesSubset([
      'badge-exp-3',
      'badge-desafio-1',
      'badge-desafio-6',
    ]),
  },

  // --- PROFISSIONAL ---
  {
    id: 'driver-agenor-junior',
    name: 'AGENOR JÚNIOR',
    initials: 'AJ',
    avatarUrl: null,
    category: 'PROFISSIONAL',
    xp: 32400,
    points: 7840,
    rating: 7100,
    flag: 'MG',
    rankPosition: 6,
    badges: getBadgesSubset(['badge-exp-3', 'badge-desafio-1', 'badge-desafio-2']),
  },
  {
    id: 'driver-andre-felisberto',
    name: 'ANDRÉ FELISBERTO',
    initials: 'AF',
    avatarUrl: null,
    category: 'PROFISSIONAL',
    xp: 29150,
    points: 7120,
    rating: 6650,
    flag: 'MG',
    rankPosition: 7,
    badges: getBadgesSubset(['badge-exp-3', 'badge-desafio-1', 'badge-esp-2']),
  },
  {
    id: 'driver-flavio-camara',
    name: 'FLAVIO VICTOR CÂMARA',
    initials: 'FC',
    avatarUrl: null,
    category: 'PROFISSIONAL',
    xp: 27800,
    points: 6790,
    rating: 6400,
    flag: 'MG',
    rankPosition: 8,
    badges: getBadgesSubset(['badge-exp-3', 'badge-desafio-2']),
  },

  // --- SEMI-PRO ---
  {
    id: 'driver-luiz-eloi',
    name: 'LUIZ CARLOS RODRIGUES ELOI',
    initials: 'LE',
    avatarUrl: null,
    category: 'SEMI-PRO',
    xp: 22400,
    points: 5890,
    rating: 5600,
    flag: 'MG',
    rankPosition: 9,
    badges: getBadgesSubset(['badge-exp-2', 'badge-desafio-1']),
  },
  {
    id: 'driver-gegela',
    name: 'GEGELA',
    initials: 'GG',
    avatarUrl: null,
    category: 'SEMI-PRO',
    xp: 19850,
    points: 5240,
    rating: 5120,
    flag: 'MG',
    rankPosition: 10,
    badges: getBadgesSubset(['badge-exp-2', 'badge-desafio-6']),
  },
  {
    id: 'driver-gerson-barros',
    name: 'GERSON BARROS NETO',
    initials: 'GB',
    avatarUrl: null,
    category: 'SEMI-PRO',
    xp: 18200,
    points: 4950,
    rating: 4890,
    flag: 'MG',
    rankPosition: 11,
    badges: getBadgesSubset(['badge-exp-2', 'badge-esp-2']),
  },

  // --- AMADOR ---
  {
    id: 'driver-guilherme-barros',
    name: 'GUILHERME BARROS',
    initials: 'GB',
    avatarUrl: null,
    category: 'AMADOR',
    xp: 14100,
    points: 3820,
    rating: 3950,
    flag: 'MG',
    rankPosition: 12,
    badges: getBadgesSubset(['badge-exp-2', 'badge-desafio-5']),
  },
  {
    id: 'driver-lucas-albuquerque',
    name: 'LUCAS ALBUQUERQUE',
    initials: 'LA',
    avatarUrl: null,
    category: 'AMADOR',
    xp: 12300,
    points: 3410,
    rating: 3560,
    flag: 'SP',
    rankPosition: 13,
    badges: getBadgesSubset(['badge-exp-2']),
  },
  {
    id: 'driver-rodrigo-menezes',
    name: 'RODRIGO MENEZES',
    initials: 'RM',
    avatarUrl: null,
    category: 'AMADOR',
    xp: 10950,
    points: 3020,
    rating: 3200,
    flag: 'MG',
    rankPosition: 14,
    badges: getBadgesSubset(['badge-exp-2']),
  },

  // --- NOVATO ---
  {
    id: 'driver-felipe-morais',
    name: 'FELIPE MORAIS',
    initials: 'FM',
    avatarUrl: null,
    category: 'NOVATO',
    xp: 6500,
    points: 1950,
    rating: 2100,
    flag: 'MG',
    rankPosition: 15,
    badges: getBadgesSubset(['badge-exp-1']),
  },
  {
    id: 'driver-thiago-santoro',
    name: 'THIAGO SANTORO',
    initials: 'TS',
    avatarUrl: null,
    category: 'NOVATO',
    xp: 4800,
    points: 1420,
    rating: 1650,
    flag: 'MG',
    rankPosition: 16,
    badges: getBadgesSubset(['badge-exp-1']),
  },
  {
    id: 'driver-bruno-silveira',
    name: 'BRUNO SILVEIRA',
    initials: 'BS',
    avatarUrl: null,
    category: 'NOVATO',
    xp: 2900,
    points: 950,
    rating: 1100,
    flag: 'MG',
    rankPosition: 17,
    badges: getBadgesSubset(['badge-exp-1']),
  },
  {
    id: 'driver-carlos-eduardo',
    name: 'CARLOS EDUARDO',
    initials: 'CE',
    avatarUrl: null,
    category: 'NOVATO',
    xp: 1200,
    points: 420,
    rating: 500,
    flag: 'MG',
    rankPosition: 18,
    badges: getBadgesSubset(['badge-exp-1']),
  },
];

// Top 5 local Betim drivers matching reference screen IMG_3790
export const BETIM_LOCAL_TOP_DRIVERS: Driver[] = [
  MOCK_DRIVERS[8], // Luiz Carlos Rodrigues Eloi
  MOCK_DRIVERS[5], // Agenor Júnior
  MOCK_DRIVERS[6], // André Felisberto
  MOCK_DRIVERS[7], // Flavio Victor Câmara
  MOCK_DRIVERS[9], // Gegela
];

// ==========================================
// 3. News Articles (High Quality Motorsport Feed)
// ==========================================

export const MOCK_NEWS_ARTICLES: NewsArticle[] = [
  {
    id: 'news-f1-russell-engine-penalty',
    title: "F1: RUSSELL DEFINE POSSÍVEL 'PALCO' PARA SEGUNDA PUNIÇÃO POR TROCA DE MOTOR",
    summary:
      'Piloto britânico da Mercedes projeta estratégia de penalidades no grid para as próximas etapas americanas da temporada 2026.',
    content: `George Russell e a equipe Mercedes AMG Petronas já trabalham com a hipótese quase certa de introduzir uma nova unidade de potência ainda nesta perna do campeonato mundial de Fórmula 1. 

Com o desgaste acumulado e a exigência de circuitos de alta altitude e longas retas, como o Circuito das Américas em Austin e o Autódromo Hermanos Rodríguez na Cidade do México, a equipe avalia onde o prejuízo na largada será minimizado pelo ritmo de ultrapassagem do monoposto.

"Sabemos que teremos de tomar uma penalidade em algum ponto antes do final da temporada. O segredo é escolher um circuito onde o DRS seja realmente potente e onde possamos escalar o pelotão sem danificar os pneus nas primeiras voltas", explicou Russell em coletiva técnica.

A decisão final será tomada após a análise de telemetria dos treinos livres da próxima sexta-feira.`,
    imageUrl:
      'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=1200&q=80',
    date: '14/OUT./2026',
    isoDate: '2026-10-14T16:13:00Z',
    category: 'FÓRMULA 1',
    author: 'Giacomo Rauli',
    readTime: '3 min de leitura',
    commentsCount: 2,
    tags: ['FÓRMULA 1', 'MERCEDES', 'MOTOR', 'TELEMETRIA'],
  },
  {
    id: 'news-betim-copa-centro-oeste',
    title: 'KART BETIM: GRANDE FINAL DA COPA CENTRO-OESTE REÚNE MAIS DE 120 PILOTOS',
    summary:
      'O Kartódromo Internacional de Betim sedia a etapa decisiva com disputas acirradas nas categorias Rental, Graduados e Super Sênior.',
    content: `Com o traçado internacional de 1.110 metros preparado em sua configuração mais técnica, o Kartódromo Internacional de Betim recebeu neste fim de semana a grande final da Copa Centro-Oeste de Kart.

Foram mais de 120 pilotos inscritos divididos entre os karts de aluguel Honda 13HP e as categorias com motores de competição de 2 tempos. Na categoria Rental Lenda, a disputa pelo título foi decidida na última volta da bateria final, com Nelson Castro e Toni Siqueira separados por apenas 0.045s na linha de chegada.

A infraestrutura de iluminação em LED permitiu a realização de baterias noturnas sem intercorrências, com cronometragem em tempo real operando via transponder digital de precisão milimétrica.`,
    imageUrl:
      'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1200&q=80',
    date: '13/OUT./2026',
    isoDate: '2026-10-13T20:30:00Z',
    category: 'KART BETIM',
    author: 'Redação Kartódromo de Betim',
    readTime: '4 min de leitura',
    commentsCount: 8,
    tags: ['KART BETIM', 'CAMPEONATO', 'RENTAL', 'PÓDIO'],
  },
  {
    id: 'news-super-kart-noturno',
    title: 'SUPER KART BRASIL ANUNCIA ETAPA NOTURNA EXCLUSIVA NO TRAÇADO INTERNACIONAL',
    summary:
      'Nova rodada dupla sob holofotes promete alta velocidade e novos recordes de volta no asfalto mineiro.',
    content: `A organização da Super Kart Brasil confirmou a realização de uma etapa noturna inédita em Betim para o próximo mês. 

As corridas sob os holofotes do circuito mineiro contarão com transmissão ao vivo pela telemetria do aplicativo mobile, permitindo que os torcedores acompanhem parciais de setor, deltas de volta e comunicação de bandeiras em tempo real direto do smartphone.

As vagas para a categoria aberta já estão disponíveis na aba Agenda do aplicativo com valor promocional de pré-venda.`,
    imageUrl:
      'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1200&q=80',
    date: '11/OUT./2026',
    isoDate: '2026-10-11T14:00:00Z',
    category: 'CAMPEONATO',
    author: 'Assessoria SKB',
    readTime: '2 min de leitura',
    commentsCount: 5,
    tags: ['NOTURNO', 'BETIM', 'AGENDA', 'SUPER KART'],
  },
];

// ==========================================
// 4. Track Partner Details (Kartódromo de Betim)
// ==========================================

export const BETIM_TRACK_PARTNER: TrackPartner = {
  id: 'kartodromo-betim',
  name: 'KARTÓDROMO INTERNACIONAL DE BETIM',
  legalName: 'Kartódromo Internacional de Betim Ltda.',
  logoUrl: 'assets/brand-logo.png',
  bannerUrl: 'assets/betim-track.jpg',
  phone: '(31)99884-2898',
  address: 'R. Prof. José Horácio, 100 - Fazenda das Flores, Betim - MG',
  socials: {
    whatsapp: 'https://wa.me/5531998842898',
    instagram: '@kartbetim',
    youtube: 'https://youtube.com/@kartbetim',
    website: 'https://www.kartodromodebetim.com.br',
  },
  isFavorite: true,
  stats: {
    totalEventsFinished: 148,
    activeDriversCount: 3840,
    trackLengthMeters: 1110,
  },
  facilities: [
    'Traçado Oficial 1.110m',
    'Cronometragem Transponder AMB / Mylaps',
    'Frota de Karts Honda 13HP',
    'Iluminação Noturna em LED Full HD',
    'Restaurante Panorâmico & Lounge Bar',
    'Estacionamento Privativo com Segurança',
    'Sala de Briefing Climatizada',
    'Vestiários com Chuveiros Quentes',
  ],
};

// ==========================================
// 5. Live Telemetry & Timing (LiveSession Mock)
// ==========================================

export const MOCK_LIVE_SESSION: LiveSession = {
  id: 'session-live-0900-race',
  title: 'BATERIAS 14/10/2026',
  subtitle: 'BATERIA 09:00 - ESCOLA - RACE',
  trackName: 'KART CENTER BETIM',
  status: 'GREEN',
  elapsedTime: '0:17:54.548',
  elapsedMs: 1074548,
  fastestLap: {
    competitorNumber: '#16',
    name: 'COMPETIDOR 16',
    time: '0:38.775',
    timeMs: 38775,
    lapNumber: 5,
  },
  competitors: [
    {
      position: 1,
      kartNumber: '#16',
      name: 'COMPETIDOR 16',
      category: 'RENTAL',
      flag: 'SP',
      currentLap: 6,
      lastLapTime: '0:38.781',
      lastLapMs: 38781,
      bestLapTime: '0:38.775',
      bestLapMs: 38775,
      bestLapNumber: 5,
      diffLeader: '0:00.000',
      diffPrev: '0:00.000',
      isFastestLap: true,
      deltaRealtime: { value: '+0:30.121', trend: 'faster' },
    },
    {
      position: 2,
      kartNumber: '#09',
      name: 'GUILHERME BARROS',
      category: 'RENTAL',
      flag: 'MG',
      currentLap: 6,
      lastLapTime: '0:39.120',
      lastLapMs: 39120,
      bestLapTime: '0:38.940',
      bestLapMs: 38940,
      bestLapNumber: 4,
      diffLeader: '+0:00.315',
      diffPrev: '+0:00.315',
      isFastestLap: false,
      deltaRealtime: { value: '-0:00.315', trend: 'slower' },
    },
    {
      position: 3,
      kartNumber: '#07',
      name: 'GERSON BARROS NETO',
      category: 'RENTAL',
      flag: 'MG',
      currentLap: 6,
      lastLapTime: '0:39.450',
      lastLapMs: 39450,
      bestLapTime: '0:39.012',
      bestLapMs: 39012,
      bestLapNumber: 5,
      diffLeader: '+0:00.750',
      diffPrev: '+0:00.435',
      isFastestLap: false,
      deltaRealtime: { value: '+0:00.120', trend: 'faster' },
    },
    {
      position: 4,
      kartNumber: '#11',
      name: 'AGENOR JÚNIOR',
      category: 'RENTAL',
      flag: 'MG',
      currentLap: 6,
      lastLapTime: '0:39.620',
      lastLapMs: 39620,
      bestLapTime: '0:39.190',
      bestLapMs: 39190,
      bestLapNumber: 3,
      diffLeader: '+0:01.120',
      diffPrev: '+0:00.370',
      isFastestLap: false,
      deltaRealtime: { value: '-0:00.080', trend: 'slower' },
    },
    {
      position: 5,
      kartNumber: '#22',
      name: 'ANDRÉ FELISBERTO',
      category: 'RENTAL',
      flag: 'MG',
      currentLap: 6,
      lastLapTime: '0:39.810',
      lastLapMs: 39810,
      bestLapTime: '0:39.310',
      bestLapMs: 39310,
      bestLapNumber: 4,
      diffLeader: '+0:01.480',
      diffPrev: '+0:00.360',
      isFastestLap: false,
      deltaRealtime: { value: '+0:00.050', trend: 'faster' },
    },
    {
      position: 6,
      kartNumber: '#05',
      name: 'LUIZ CARLOS ELOI',
      category: 'RENTAL',
      flag: 'MG',
      currentLap: 6,
      lastLapTime: '0:40.010',
      lastLapMs: 40010,
      bestLapTime: '0:39.520',
      bestLapMs: 39520,
      bestLapNumber: 5,
      diffLeader: '+0:01.890',
      diffPrev: '+0:00.410',
      isFastestLap: false,
      deltaRealtime: { value: '+0:00.200', trend: 'faster' },
    },
    {
      position: 7,
      kartNumber: '#18',
      name: 'FLAVIO CÂMARA',
      category: 'RENTAL',
      flag: 'MG',
      currentLap: 6,
      lastLapTime: '0:40.240',
      lastLapMs: 40240,
      bestLapTime: '0:39.750',
      bestLapMs: 39750,
      bestLapNumber: 4,
      diffLeader: '+0:02.340',
      diffPrev: '+0:00.450',
      isFastestLap: false,
      deltaRealtime: { value: '-0:00.150', trend: 'slower' },
    },
    {
      position: 8,
      kartNumber: '#14',
      name: 'GEGELA',
      category: 'RENTAL',
      flag: 'MG',
      currentLap: 6,
      lastLapTime: '0:40.450',
      lastLapMs: 40450,
      bestLapTime: '0:39.990',
      bestLapMs: 39990,
      bestLapNumber: 3,
      diffLeader: '+0:02.780',
      diffPrev: '+0:00.440',
      isFastestLap: false,
      deltaRealtime: { value: '+0:00.030', trend: 'faster' },
    },
    {
      position: 9,
      kartNumber: '#03',
      name: 'LUCAS ALBUQUERQUE',
      category: 'RENTAL',
      flag: 'SP',
      currentLap: 5,
      lastLapTime: '0:40.890',
      lastLapMs: 40890,
      bestLapTime: '0:40.120',
      bestLapMs: 40120,
      bestLapNumber: 4,
      diffLeader: '+1 Volta',
      diffPrev: '+0:01.150',
      isFastestLap: false,
      deltaRealtime: { value: '-0:00.500', trend: 'slower' },
    },
    {
      position: 10,
      kartNumber: '#27',
      name: 'FELIPE MORAIS',
      category: 'RENTAL',
      flag: 'MG',
      currentLap: 5,
      lastLapTime: '0:41.200',
      lastLapMs: 41200,
      bestLapTime: '0:40.650',
      bestLapMs: 40650,
      bestLapNumber: 3,
      diffLeader: '+1 Volta',
      diffPrev: '+0:00.530',
      isFastestLap: false,
      deltaRealtime: { value: '+0:00.100', trend: 'faster' },
    },
  ],
};

// ==========================================
// 6. Cockpit HUD Initial State (Landscape OLED)
// ==========================================

export const MOCK_COCKPIT_HUD_STATE: CockpitHUDState = {
  sessionElapsedTime: '0:16:34.544',
  currentLap: 26,
  currentPosition: 'P1',
  currentLapTime: '0:05.8',
  realtimeDelta: {
    value: '+0:30.121',
    trend: 'faster',
    competitorAhead: {
      kartNumber: '#09',
      name: 'GUILHERME BARRO...',
    },
  },
  lastLap: {
    time: '0:32.878',
    trend: 'slower',
  },
  bestLap: {
    time: '0:29.182',
  },
  deltaBest: {
    value: '+3.696',
    isImprovement: false, // Perda de tempo em relação à melhor volta (vermelho neon)
  },
  driverInfo: {
    kartNumber: '#07',
    name: 'GERSON BARROS NETO DOS ANJOS',
  },
  displayTheme: 'neon-dark',
};

// ==========================================
// 7. Agenda & Session Booking Slots
// ==========================================

export const MOCK_AGENDA_SLOTS: AgendaSlot[] = [
  {
    id: 'agenda-slot-1100',
    date: '14/10/2026',
    time: '11:00',
    title: 'BATERIA 11:00',
    availableSlots: 12,
    maxSlots: 20,
    priceCentavos: 11000,
    priceFormatted: 'R$ 110,00',
    category: 'LOCAÇÃO PADRÃO (SEG-SEX)',
    sportType: 'KARTING',
    trackConfig: 'TRAÇADO PRINCIPAL 1.110M',
    isSoldOut: false,
  },
  {
    id: 'agenda-slot-1130',
    date: '14/10/2026',
    time: '11:30',
    title: 'BATERIA 11:30',
    availableSlots: 8,
    maxSlots: 20,
    priceCentavos: 11000,
    priceFormatted: 'R$ 110,00',
    category: 'LOCAÇÃO PADRÃO (SEG-SEX)',
    sportType: 'KARTING',
    trackConfig: 'TRAÇADO PRINCIPAL 1.110M',
    isSoldOut: false,
  },
  {
    id: 'agenda-slot-1200',
    date: '14/10/2026',
    time: '12:00',
    title: 'BATERIA 12:00',
    availableSlots: 0,
    maxSlots: 20,
    priceCentavos: 11000,
    priceFormatted: 'R$ 110,00',
    category: 'LOCAÇÃO PADRÃO (SEG-SEX)',
    sportType: 'KARTING',
    trackConfig: 'TRAÇADO PRINCIPAL 1.110M',
    isSoldOut: true,
  },
  {
    id: 'agenda-slot-1230',
    date: '14/10/2026',
    time: '12:30',
    title: 'BATERIA 12:30',
    availableSlots: 5,
    maxSlots: 20,
    priceCentavos: 11000,
    priceFormatted: 'R$ 110,00',
    category: 'LOCAÇÃO PADRÃO (SEG-SEX)',
    sportType: 'KARTING',
    trackConfig: 'TRAÇADO PRINCIPAL 1.110M',
    isSoldOut: false,
  },
  {
    id: 'agenda-slot-1300',
    date: '14/10/2026',
    time: '13:00',
    title: 'BATERIA 13:00',
    availableSlots: 14,
    maxSlots: 20,
    priceCentavos: 11000,
    priceFormatted: 'R$ 110,00',
    category: 'LOCAÇÃO PADRÃO (SEG-SEX)',
    sportType: 'KARTING',
    trackConfig: 'TRAÇADO PRINCIPAL 1.110M',
    isSoldOut: false,
  },
  {
    id: 'agenda-slot-1330',
    date: '14/10/2026',
    time: '13:30',
    title: 'BATERIA 13:30',
    availableSlots: 9,
    maxSlots: 20,
    priceCentavos: 11000,
    priceFormatted: 'R$ 110,00',
    category: 'LOCAÇÃO PADRÃO (SEG-SEX)',
    sportType: 'KARTING',
    trackConfig: 'TRAÇADO PRINCIPAL 1.110M',
    isSoldOut: false,
  },
  {
    id: 'agenda-slot-1400',
    date: '14/10/2026',
    time: '14:00',
    title: 'BATERIA 14:00',
    availableSlots: 16,
    maxSlots: 20,
    priceCentavos: 11000,
    priceFormatted: 'R$ 110,00',
    category: 'LOCAÇÃO PADRÃO (SEG-SEX)',
    sportType: 'KARTING',
    trackConfig: 'TRAÇADO PRINCIPAL 1.110M',
    isSoldOut: false,
  },
  {
    id: 'agenda-slot-1430',
    date: '14/10/2026',
    time: '14:30',
    title: 'BATERIA 14:30',
    availableSlots: 11,
    maxSlots: 20,
    priceCentavos: 11000,
    priceFormatted: 'R$ 110,00',
    category: 'LOCAÇÃO PADRÃO (SEG-SEX)',
    sportType: 'KARTING',
    trackConfig: 'TRAÇADO PRINCIPAL 1.110M',
    isSoldOut: false,
  },
];

// ==========================================
// 8. Career Stats (Nelson Castro - Official Match)
// ==========================================

export const NELSON_CASTRO_CAREER_STATS: CareerStats = {
  driverId: 'driver-nelson-castro',
  efficiency: {
    winRate: 22, // 22%
    podiumRate: 43, // 43%
    overallEfficiency: 35, // 35%
    polesRate: 0, // 0%
    bestLapsRate: 25, // 25%
    validRacesRate: 92, // 92%
  },
  qualifiedStats: {
    completedRaces: 309,
    wins: 70,
    podiums: 133,
    poles: 100,
    bestLaps: 78,
    qualifyingSessions: 0,
  },
  allStats: {
    totalRaces: 347,
    completedRaces: 339,
    wins: 81,
    podiums: 155,
    poles: 120,
    bestLaps: 97,
    qualifyingSessions: 365,
    warmups: 0,
    freePractices: 0,
  },
  badges: {
    experience: ALL_BADGES_CATALOG.filter((b) => b.category === 'experiencia'),
    challenge: ALL_BADGES_CATALOG.filter((b) => b.category === 'desafio'),
    special: ALL_BADGES_CATALOG.filter((b) => b.category === 'especial'),
  },
  activeGoals: [],
  activeChallenges: [],
};

export const MOCK_CAREER_STATS = NELSON_CASTRO_CAREER_STATS;

// ==========================================
// 9. Mathematics & Ranking Utilities
// ==========================================

/**
 * Checks if a session has the minimum required drivers (10+) to qualify for
 * XP accumulation, qualified wins, and podium ratings.
 */
export function isQualifiedSession(gridSize: number): boolean {
  return gridSize >= 10;
}

/**
 * Computes the grid multiplier for XP gains.
 * Multiplier ranges from 1.0x (10 drivers) to 2.0x (20+ drivers).
 * For grids < 10, multiplier is 0 (unqualified session).
 */
export function calculateGridMultiplier(gridSize: number): number {
  if (!isQualifiedSession(gridSize)) {
    return 0;
  }
  const clampedGrid = Math.min(20, Math.max(10, gridSize));
  return 1.0 + (clampedGrid - 10) / 10;
}

/**
 * Calculates rating points (PTS) following the official formula:
 * Rating = 50% Efficiency + 20% Wins + 20% XP + 10% Races
 * Normalized on a 0-10,000 scale, returning an integer score.
 *
 * Robust defensive invariants:
 * - Accepts both decimal ratios (e.g. 0.35) and percentage values (e.g. 35).
 * - Clamps all inputs to non-negative numbers (lower bound 0).
 * - Clamps all component points and composite rating to [0, 10000].
 * - Sanitizes NaN, Infinity, -Infinity, and undefined inputs to 0.
 */
export function calculateRating(
  efficiencyRatio: number, // 0.0 to 1.0 (e.g. 0.35) or 0 to 100 (e.g. 35)
  qualifiedWins: number, // e.g. 70 (reference: 100)
  accumulatedXp: number, // e.g. 61251 (reference: 60,000)
  completedRaces: number // e.g. 309 (reference: 300)
): number {
  const sanitize = (val: unknown): number =>
    typeof val === 'number' && Number.isFinite(val) ? val : 0;

  // 1. Efficiency Pillar (50% weight):
  // Auto-detect percentage integer (> 1) vs decimal ratio (0.0 to 1.0)
  const rawEff = sanitize(efficiencyRatio);
  const normalizedEff = rawEff > 1 ? rawEff / 100 : rawEff;
  const safeEff = Math.max(0, Math.min(1, normalizedEff));
  const effPoints = Math.max(0, Math.min(10000, safeEff * 10000));

  // 2. Qualified Wins Pillar (20% weight, ref: 100 wins = 10,000 pts)
  const safeWins = Math.max(0, sanitize(qualifiedWins));
  const winPoints = Math.max(0, Math.min(10000, (safeWins / 100) * 10000));

  // 3. Accumulated XP Pillar (20% weight, ref: 60,000 XP = 10,000 pts)
  const safeXp = Math.max(0, sanitize(accumulatedXp));
  const xpPoints = Math.max(0, Math.min(10000, (safeXp / 60000) * 10000));

  // 4. Completed Races Pillar (10% weight, ref: 300 races = 10,000 pts)
  const safeRaces = Math.max(0, sanitize(completedRaces));
  const racePoints = Math.max(0, Math.min(10000, (safeRaces / 300) * 10000));

  // 5. Composite Weighted Score
  const rawRating =
    0.5 * effPoints + 0.2 * winPoints + 0.2 * xpPoints + 0.1 * racePoints;

  const clampedRating = Math.max(0, Math.min(10000, rawRating));
  return Math.round(clampedRating);
}

/**
 * Calculates XP earned in a race session considering finishing positions,
 * bonus achievements, and the grid size multiplier (10 to 20+ pilots).
 * Unqualified sessions (< 10 drivers) or DNF (completed = false) award 0 XP.
 */
export function calculateSessionXP(
  completed: boolean,
  isPodium: boolean,
  isWin: boolean,
  isPole: boolean,
  isBestLap: boolean,
  gridSize: number
): number {
  if (!isQualifiedSession(gridSize) || !completed) {
    return 0; // Sessions under 10 pilots or DNF (did not finish) do NOT award XP per official rule
  }

  let baseXP = 50; // Completed qualified session base XP
  if (isWin) {
    baseXP += 100;
  } else if (isPodium) {
    baseXP += 50;
  }
  if (isPole) baseXP += 50;
  if (isBestLap) baseXP += 50;

  const multiplier = calculateGridMultiplier(gridSize);

  return Math.round(baseXP * multiplier);
}

/**
 * Returns the brand accent color for each pilot category.
 */
export function getCategoryColor(category: PilotCategory): string {
  switch (category) {
    case 'LENDA':
      return '#F59E0B'; // Dourado
    case 'PROFISSIONAL':
      return '#8B5CF6'; // Roxo
    case 'SEMI-PRO':
      return '#3B82F6'; // Azul
    case 'AMADOR':
      return '#22C55E'; // Verde
    case 'NOVATO':
      return '#9CA3AF'; // Cinza
    case 'TODOS':
    default:
      return '#4D80EE'; // Azul elétrico de destaque
  }
}

/**
 * Filters drivers by category. If 'TODOS' is passed, returns all drivers.
 */
export function getDriversByCategory(category: PilotCategory): Driver[] {
  if (category === 'TODOS') {
    return MOCK_DRIVERS;
  }
  return MOCK_DRIVERS.filter((d) => d.category === category);
}

/**
 * Finds a driver by their ID.
 */
export function getDriverById(id: string): Driver | undefined {
  return MOCK_DRIVERS.find((d) => d.id === id);
}

/**
 * Searches drivers by substring on name, optionally filtering by category.
 */
export function searchDrivers(
  query: string,
  category: PilotCategory = 'TODOS'
): Driver[] {
  const normalizedQuery = query.trim().toLowerCase();
  const baseList = getDriversByCategory(category);

  if (!normalizedQuery) {
    return baseList;
  }

  return baseList.filter((d) =>
    d.name.toLowerCase().includes(normalizedQuery)
  );
}

/**
 * Formats centavos to Brazilian Real string (e.g. 11000 -> "R$ 110,00").
 */
export function formatCurrencyCentavos(centavos: number): string {
  const reais = centavos / 100;
  return `R$ ${reais.toFixed(2).replace('.', ',')}`;
}

// ==========================================
// 8. News Helper Functions & Aliases
// ==========================================

const NEWS_ID_ALIASES: Record<string, string> = {
  '1': 'news-betim-copa-centro-oeste',
  '2': 'news-f1-russell-engine-penalty',
  '3': 'news-super-kart-noturno',
  'news-1': 'news-betim-copa-centro-oeste',
  'news-2': 'news-f1-russell-engine-penalty',
  'news-3': 'news-super-kart-noturno',
};

/**
 * Recupera um artigo de notícia pelo ID, número ou alias ('news-1', 1, etc.)
 */
export function getNewsArticleById(id: string | number): NewsArticle | undefined {
  if (id === undefined || id === null) return undefined;
  const strId = String(id).trim();
  if (!strId) return undefined;

  // 1. Busca direta por ID
  const directMatch = MOCK_NEWS_ARTICLES.find((a) => a.id === strId);
  if (directMatch) return directMatch;

  // 2. Busca por alias mapeado
  const mappedId = NEWS_ID_ALIASES[strId] || NEWS_ID_ALIASES[strId.toLowerCase()];
  if (mappedId) {
    const aliasMatch = MOCK_NEWS_ARTICLES.find((a) => a.id === mappedId);
    if (aliasMatch) return { ...aliasMatch, id: strId };
  }

  // 3. Suporte a padrão numérico ("news-1", "1", etc.)
  const numericMatch = strId.match(/^(?:news-)?([0-9]+)$/i);
  if (numericMatch) {
    const num = parseInt(numericMatch[1], 10);
    if (num >= 1 && num <= MOCK_NEWS_ARTICLES.length) {
      return { ...MOCK_NEWS_ARTICLES[num - 1], id: strId };
    }
  }

  // 4. Fallback procurando por substring
  const subMatch = MOCK_NEWS_ARTICLES.find(
    (a) => a.id.toLowerCase().includes(strId.toLowerCase()) || strId.toLowerCase().includes(a.id.toLowerCase())
  );
  if (subMatch) return { ...subMatch, id: strId };

  return undefined;
}

/**
 * Recupera matérias relacionadas excluindo o artigo atual
 */
export function getRelatedNewsArticles(
  currentId: string | number,
  limit: number = 2
): NewsArticle[] {
  if (currentId === undefined || currentId === null) {
    return MOCK_NEWS_ARTICLES.slice(0, limit);
  }
  const strId = String(currentId).trim();
  const currentArticle = getNewsArticleById(strId);
  const targetId = currentArticle ? currentArticle.id : strId;

  return MOCK_NEWS_ARTICLES
    .filter((a) => a.id !== targetId && a.id !== strId)
    .slice(0, limit);
}

/**
 * Retorna as cores de fundo e texto para a pílula de categoria da notícia
 */
export function getNewsCategoryPillStyle(category: string): {
  backgroundColor: string;
  textColor: string;
} {
  const normalized = (category || '').trim().toUpperCase();
  switch (normalized) {
    case 'CAMPEONATO':
      return { backgroundColor: '#F59E0B', textColor: '#000000' };
    case 'FÓRMULA 1':
    case 'FORMULA 1':
      return { backgroundColor: '#3B82F6', textColor: '#000000' };
    case 'KART BETIM':
    case 'KART':
      return { backgroundColor: '#8B5CF6', textColor: '#FFFFFF' };
    case 'DICAS':
      return { backgroundColor: '#00E676', textColor: '#000000' };
    default:
      return { backgroundColor: '#2A2E35', textColor: '#FFFFFF' };
  }
}

// ==========================================
// 8. Milestone 3: Betim Track Sessions & Standings
// ==========================================

export type BetimSessionCategory = 'Super Kart' | 'Rental' | 'Rental Graduados';

export interface BetimTrackSession {
  id: string;
  date: string;
  isoDate?: string;
  timeSlot: string;
  title: string;
  category: BetimSessionCategory | string;
  totalSlots: number;
  availableSlots: number;
  priceCentavos: number;
  priceFormatted: string;
  trackConfig: string;
  isSoldOut: boolean;
}

export const BETIM_TRACK_SESSIONS: BetimTrackSession[] = [
  {
    id: 'betim-session-1430',
    date: '14/10/2026',
    isoDate: '2026-10-14T14:30:00Z',
    timeSlot: '14:30',
    title: 'BATERIA 14:30 - SUPER KART',
    category: 'Super Kart',
    totalSlots: 20,
    availableSlots: 12,
    priceCentavos: 13990,
    priceFormatted: 'R$ 139,90',
    trackConfig: 'Traçado 1.110m Diurno Principal',
    isSoldOut: false,
  },
  {
    id: 'betim-session-1600',
    date: '14/10/2026',
    isoDate: '2026-10-14T16:00:00Z',
    timeSlot: '16:00',
    title: 'BATERIA 16:00 - RENTAL',
    category: 'Rental',
    totalSlots: 20,
    availableSlots: 8,
    priceCentavos: 13990,
    priceFormatted: 'R$ 139,90',
    trackConfig: 'Traçado 1.110m Diurno Principal',
    isSoldOut: false,
  },
  {
    id: 'betim-session-1800',
    date: '14/10/2026',
    isoDate: '2026-10-14T18:00:00Z',
    timeSlot: '18:00',
    title: 'BATERIA 18:00 - RENTAL GRADUADOS',
    category: 'Rental Graduados',
    totalSlots: 20,
    availableSlots: 3,
    priceCentavos: 13990,
    priceFormatted: 'R$ 139,90',
    trackConfig: 'Traçado 1.110m Misto Noturno',
    isSoldOut: false,
  },
  {
    id: 'betim-session-1930',
    date: '14/10/2026',
    isoDate: '2026-10-14T19:30:00Z',
    timeSlot: '19:30',
    title: 'BATERIA 19:30 - SUPER KART NOTURNO',
    category: 'Super Kart',
    totalSlots: 20,
    availableSlots: 1,
    priceCentavos: 13990,
    priceFormatted: 'R$ 139,90',
    trackConfig: 'Traçado 1.110m Noturno Iluminado',
    isSoldOut: false,
  },
  {
    id: 'betim-session-2100',
    date: '14/10/2026',
    isoDate: '2026-10-14T21:00:00Z',
    timeSlot: '21:00',
    title: 'BATERIA 21:00 - SUPER KART NOTURNO',
    category: 'Super Kart',
    totalSlots: 20,
    availableSlots: 0,
    priceCentavos: 13990,
    priceFormatted: 'R$ 139,90',
    trackConfig: 'Traçado 1.110m Noturno Iluminado',
    isSoldOut: true,
  },
];

export const MOCK_BETIM_OPEN_SESSIONS: BetimTrackSession[] = BETIM_TRACK_SESSIONS;

export interface TrackRecordInfo {
  driverName: string;
  driverId: string;
  driverInitials: string;
  lapTime: string;
  lapTimeMs: number;
  trackLengthMeters: number;
  kartFleet: string;
  category: string;
  dateRecorded: string;
}

export const BETIM_TRACK_RECORD: TrackRecordInfo = {
  driverName: 'NELSON CASTRO',
  driverId: 'driver-nelson-castro',
  driverInitials: 'NC',
  lapTime: '0:38.775',
  lapTimeMs: 38775,
  trackLengthMeters: 1110,
  kartFleet: 'GX390 Honda 18HP',
  category: 'RENTAL ESPECIAL',
  dateRecorded: '12/MAR./2026',
};

export interface LocalTrackDriverStanding extends Driver {
  bestLap: string;
  bestLapMs: number;
  trackPoints: number;
  completedTrackRaces: number;
}

export const BETIM_LOCAL_STANDINGS_DATA: LocalTrackDriverStanding[] = [
  {
    ...MOCK_DRIVERS[0], // Nelson Castro
    bestLap: '0:38.775',
    bestLapMs: 38775,
    trackPoints: 13112,
    completedTrackRaces: 89,
  },
  {
    ...MOCK_DRIVERS[1], // Thiago Soares
    bestLap: '0:38.990',
    bestLapMs: 38990,
    trackPoints: 11840,
    completedTrackRaces: 74,
  },
  {
    ...MOCK_DRIVERS[2], // Lucas Medeiros
    bestLap: '0:39.120',
    bestLapMs: 39120,
    trackPoints: 9450,
    completedTrackRaces: 62,
  },
  {
    ...MOCK_DRIVERS[5], // Agenor Júnior
    bestLap: '0:39.190',
    bestLapMs: 39190,
    trackPoints: 7840,
    completedTrackRaces: 58,
  },
  {
    ...MOCK_DRIVERS[6], // André Felisberto
    bestLap: '0:39.310',
    bestLapMs: 39310,
    trackPoints: 7120,
    completedTrackRaces: 51,
  },
  {
    ...MOCK_DRIVERS[7], // Flavio Victor Câmara
    bestLap: '0:39.750',
    bestLapMs: 39750,
    trackPoints: 6790,
    completedTrackRaces: 48,
  },
  {
    ...MOCK_DRIVERS[8], // Luiz Carlos Rodrigues Eloi
    bestLap: '0:39.520',
    bestLapMs: 39520,
    trackPoints: 5890,
    completedTrackRaces: 42,
  },
  {
    ...MOCK_DRIVERS[9], // Gegela
    bestLap: '0:39.990',
    bestLapMs: 39990,
    trackPoints: 5240,
    completedTrackRaces: 37,
  },
];

export function getBetimTrackPartner(): TrackPartner {
  return BETIM_TRACK_PARTNER;
}

export function getBetimTrackSessions(): BetimTrackSession[] {
  return BETIM_TRACK_SESSIONS;
}

export function getBetimLocalStandings(): LocalTrackDriverStanding[] {
  return BETIM_LOCAL_STANDINGS_DATA;
}

export const MOCK_TRACK_PARTNER: TrackPartner = BETIM_TRACK_PARTNER;


