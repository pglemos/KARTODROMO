/**
 * Domain contracts, formulas and theme specifications for Kartódromo de Betim Mobile Redesign.
 * Derived from ORIGINAL_REQUEST.md, PROJECT.md and survey_flows.md.
 */

import { Platform, TextStyle } from 'react-native';

// ==========================================
// 1. Sports Dark/OLED Design System Palette
// ==========================================
export const SPORTS_PALETTE = {
  // OLED & Surface Backgrounds
  background: '#000000',
  surface: '#161A1D',
  surfaceElevated: '#1E2228',
  border: '#2A2E35',

  // Sports Semantic Accents
  accent: '#F59E0B', // Sports Gold / Trophy P1
  gold: '#F59E0B',
  goldSecondary: '#E5A93C',
  neonGreen: '#00E676', // Positive Delta / Green Flag / High Efficiency
  neonRed: '#EF4444', // Negative Delta / Alertas / Esgotado
  purple: '#6F4B89', // Fastest Lap Banner / Melhor Volta
  purpleNeon: '#A855F7',
  blue: '#3B82F6', // Qualified Stats Card
  text: '#FFFFFF',
  textMuted: '#9CA3AF',
} as const;

// ==========================================
// 2. Tabular Numbers & Typography
// ==========================================
export const TABULAR_NUMS_STYLE: TextStyle = {
  fontVariant: ['tabular-nums'],
  fontFamily: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  }),
};

// ==========================================
// 3. Mathematical Ranking Formulas
// ==========================================

/**
 * Checks whether a race session is eligible for qualified ranking statistics and XP.
 * Rule: Grid size must be 10 or more competitors.
 */
export function isQualifiedSession(gridSize: number): boolean {
  return gridSize >= 10;
}

/**
 * Computes the grid multiplier for XP gains.
 * Multiplier ranges from 1.0x (10 drivers) to 2.0x (20+ drivers).
 * For grids < 10, multiplier is 0 (unqualified).
 */
export function calculateGridMultiplier(gridSize: number): number {
  if (gridSize < 10) return 0;
  const clamped = Math.min(20, Math.max(10, gridSize));
  return 1.0 + (clamped - 10) / 10;
}

/**
 * Computes XP gained in a race session.
 * Base XP:
 * - Complete: +50
 * - Podium (P2/P3): +50
 * - Win (P1): +100
 * - Pole: +50
 * - Fastest Lap: +50
 */
export interface SessionAchievements {
  completed: boolean;
  position: number; // 1 = Win, 2 or 3 = Podium, >3 = Other
  polePosition?: boolean;
  fastestLap?: boolean;
}

export function calculateSessionXP(
  achievements: SessionAchievements,
  gridSize: number
): number {
  const multiplier = calculateGridMultiplier(gridSize);
  if (multiplier === 0 || !achievements.completed) {
    return 0;
  }

  let base = 50; // Completion base
  if (achievements.position === 1) {
    base += 100; // Win replaces podium
  } else if (achievements.position === 2 || achievements.position === 3) {
    base += 50; // Podium
  }

  if (achievements.polePosition) {
    base += 50;
  }

  if (achievements.fastestLap) {
    base += 50;
  }

  return Math.round(base * multiplier);
}

/**
 * Computes the pilot rating (0 to 10,000 scale) and final points (e.g., 13.112 PTS).
 * Rating = 0.50 * Efficiency + 0.20 * Wins + 0.20 * XP + 0.10 * Races
 *
 * References:
 * - V_ref = 100 wins for 10,000 pts
 * - XP_ref = 60,000 XP for 10,000 pts
 * - C_ref = 300 races for 10,000 pts
 */
export function calculateRating(
  efficiencyRatio: number, // 0 to 1 (e.g. 0.35)
  qualifiedWins: number,
  xp: number,
  qualifiedCompletedRaces: number
): {
  rating: number;
  points: number;
  efficiencyPoints: number;
  winsPoints: number;
  xpPoints: number;
  racesPoints: number;
} {
  const safeEff = Math.max(0, Math.min(1, efficiencyRatio));
  const efficiencyPoints = Math.min(10000, safeEff * 10000);

  const winsPoints = Math.min(10000, (Math.max(0, qualifiedWins) / 100) * 10000);
  const xpPoints = Math.min(10000, (Math.max(0, xp) / 60000) * 10000);
  const racesPoints = Math.min(
    10000,
    (Math.max(0, qualifiedCompletedRaces) / 300) * 10000
  );

  const rating =
    0.5 * efficiencyPoints +
    0.2 * winsPoints +
    0.2 * xpPoints +
    0.1 * racesPoints;

  return {
    rating: Math.round(rating),
    points: Math.round(rating),
    efficiencyPoints: Math.round(efficiencyPoints),
    winsPoints: Math.round(winsPoints),
    xpPoints: Math.round(xpPoints),
    racesPoints: Math.round(racesPoints),
  };
}

/**
 * Currency and timing formatters
 */
export function formatCentavosToReais(centavos: number): string {
  const reais = Math.max(0, centavos) / 100;
  return `R$ ${reais.toFixed(2).replace('.', ',')}`;
}

export function formatPoints(points: number): string {
  return `${points.toLocaleString('pt-BR')} PTS`;
}

export function formatXP(xp: number): string {
  return `${xp.toLocaleString('pt-BR')} XP`;
}
