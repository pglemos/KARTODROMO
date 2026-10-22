import { Platform, StyleSheet, useColorScheme } from 'react-native';

export const sportsPalette = {
  // Root & Surfaces (OLED True Black & Elevated Cards)
  background: '#050807',
  surface: '#0D1411',
  surfaceElevated: '#111815',
  border: '#1C2621',
  borderSubtle: '#16201B',

  // Typography
  text: '#FFFFFF',
  textSecondary: '#C1C1C1',
  muted: '#A1A1AA',
  textMuted: '#9CA3AF',

  // Sports Semantics
  accent: '#2BF27A',        // verde da marca (ações principais)
  onAccent: '#04170B',      // texto sobre o verde
  gold: '#F59E0B',
  neonGreen: '#2BF27A',     // Positive delta, green flag, high efficiency
  neonRed: '#EF4444',       // Negative delta, loss of time, alerts
  purple: '#7B4DFF',        // Fastest lap banner, best lap pill
  purpleNeon: '#8B5CF6',    // Vibrant purple accent
  blue: '#3B82F6',          // Semi-Pro, active pills, telemetry
  onBlue: '#000000',        // High contrast text over electric blue (WCAG AA 5.71:1)
  blueCard: '#1E3A5F',      // Qualified stats card background
  blueBorder: '#2D598E',    // Qualified stats card border
  silver: '#ACACAC',        // Primary action pill button background
  onSilver: '#000000',      // Action text over silver

  // UI Structure & Navigation
  navBar: '#0D1310',        // Floating bottom tab bar capsule
  navActivePill: '#12361F', // Active tab pill
  input: '#0D1411',         // Search / form input background
  pillInactive: '#2A2A2A',  // Category filter pill inactive

  // Semantics & Status (WCAG AA Contrast Compliant >= 4.5)
  subtle: '#111815',
  danger: '#EF4444',
  dangerSurface: '#2A0808', // Contrast ratio 4.91 vs #EF4444
  warning: '#F59E0B',
  warningSurface: '#281802',// Contrast ratio 8.00 vs #F59E0B

  // Additional Sports Accents
  cyan: '#06B6D4',
  pink: '#EC4899',
  cardAlert: '#450A0A',
  borderCardAlert: '#652525',
} as const;

export const SPORTS_PALETTE = sportsPalette;

export const themes = {
  light: sportsPalette,
  dark: sportsPalette,
} as const;

export type ThemePalette = typeof sportsPalette;

function createStyles(palette: ThemePalette) {
  const monospaceFont = Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  });

  return StyleSheet.create({
    // Standard Layout & Containers (Preserved for backwards compatibility)
    safeArea: { flex: 1, backgroundColor: palette.background },
    content: {
      width: '100%',
      maxWidth: 600,
      alignSelf: 'center',
      paddingHorizontal: 20,
      paddingTop: 16,
      // espaço para a barra de abas flutuante não cobrir o último botão
      paddingBottom: 140,
    },
    // Floating Nav aware containers (Avoids bottom tab bar clipping)
    contentScroll: {
      width: '100%',
      maxWidth: 600,
      alignSelf: 'center',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 120,
    },
    contentScrollWithCart: {
      width: '100%',
      maxWidth: 600,
      alignSelf: 'center',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 160,
    },
    header: { marginBottom: 24 },
    title: {
      color: palette.text,
      fontSize: 34,
      lineHeight: 40,
      fontWeight: '800',
      letterSpacing: -0.6,
    },
    sectionTitle: {
      color: palette.text,
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    description: {
      color: palette.muted,
      fontSize: 15,
      lineHeight: 22,
      marginTop: 8,
    },

    // Card Panels
    panel: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      padding: 18,
    },
    panelElevated: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.borderSubtle,
      backgroundColor: palette.surfaceElevated,
      padding: 16,
    },

    // Action Buttons (Silver pill primary style from reference mockups)
    action: {
      minHeight: 48,
      borderRadius: 9999,
      paddingHorizontal: 20,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.accent,
    },
    actionText: {
      color: palette.onAccent,
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    actionGold: {
      minHeight: 48,
      borderRadius: 9999,
      paddingHorizontal: 20,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.accent,
    },
    actionGoldText: {
      color: '#000000',
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    secondaryAction: {
      minHeight: 48,
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      paddingHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryActionText: {
      color: palette.text,
      fontSize: 14,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    disabledAction: { opacity: 0.45 },
    pressedAction: { opacity: 0.85, transform: [{ scale: 0.97 }] },

    // Alerts & Feedback
    error: {
      borderRadius: 14,
      backgroundColor: palette.dangerSurface,
      borderWidth: 1,
      borderColor: palette.borderCardAlert,
      padding: 14,
    },
    errorText: {
      color: palette.danger,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
    },
    message: { paddingVertical: 24, gap: 12 },
    muted: { color: palette.muted, fontSize: 14, lineHeight: 21 },

    // Inputs & Forms
    field: { gap: 0 },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '600',
      marginBottom: 8,
      color: palette.textSecondary,
      letterSpacing: 0.1,
    },
    fieldHint: { marginTop: 6 },
    input: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.input,
      color: palette.text,
      fontSize: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    inputPill: {
      minHeight: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.input,
      color: palette.text,
      fontSize: 15,
      paddingHorizontal: 18,
      paddingVertical: 10,
    },

    // List Rows
    row: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: palette.borderSubtle,
    },
    rowTitle: {
      color: palette.text,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 22,
      textTransform: 'uppercase',
    },
    rowDetail: {
      color: palette.muted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 3,
    },

    // Typography & Monospace Numbers (F02 Tabular Numbers)
    tabularNums: {
      fontVariant: ['tabular-nums'],
      fontFamily: monospaceFont,
    },
    timerHero: {
      fontVariant: ['tabular-nums'],
      fontFamily: monospaceFont,
      fontSize: 60,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 1,
    },
    timerMedium: {
      fontVariant: ['tabular-nums'],
      fontFamily: monospaceFont,
      fontSize: 22,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    telemetryLap: {
      fontVariant: ['tabular-nums'],
      fontFamily: monospaceFont,
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    deltaPositive: {
      fontVariant: ['tabular-nums'],
      fontFamily: monospaceFont,
      fontSize: 15,
      fontWeight: '700',
      color: palette.neonGreen,
    },
    deltaNegative: {
      fontVariant: ['tabular-nums'],
      fontFamily: monospaceFont,
      fontSize: 15,
      fontWeight: '700',
      color: palette.neonRed,
    },

    // Special Racing Cards & Badges
    badgeFastestLap: {
      backgroundColor: palette.purple,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    badgeFastestLapText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    cardQualified: {
      backgroundColor: palette.blueCard,
      borderColor: palette.blueBorder,
      borderWidth: 1,
      borderRadius: 20,
      padding: 18,
    },
    cardAlert: {
      backgroundColor: palette.cardAlert,
      borderColor: palette.borderCardAlert,
      borderWidth: 1,
      borderRadius: 20,
      padding: 18,
    },

    // Filter Pills
    pill: {
      height: 36,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.pillInactive,
      gap: 6,
    },
    pillText: {
      color: palette.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    pillActive: {
      backgroundColor: palette.accent,
    },
    pillActiveText: {
      color: '#000000',
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    pillActiveBlue: {
      backgroundColor: palette.blue,
    },
    pillActiveBlueText: {
      color: '#000000',
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
    },

    // Floating Bars
    floatingNavBar: {
      position: 'absolute',
      bottom: 20,
      left: 20,
      right: 20,
      height: 64,
      borderRadius: 32,
      backgroundColor: palette.navBar,
      borderWidth: 1,
      borderColor: '#2B2B2B',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingHorizontal: 8,
    },
    floatingCartBar: {
      position: 'absolute',
      bottom: 96,
      left: 20,
      right: 20,
      height: 48,
      borderRadius: 24,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
    },
  });
}

export type ThemeStyles = ReturnType<typeof createStyles>;

const darkStyles = createStyles(themes.dark);

export function useUi() {
  useColorScheme();
  const dark = true;
  return {
    dark,
    palette: themes.dark,
    styles: darkStyles,
  };
}
