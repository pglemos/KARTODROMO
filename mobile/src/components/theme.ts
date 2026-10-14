import { StyleSheet, useColorScheme } from 'react-native';

export const themes = {
  light: {
    background: '#F8F9F9', surface: '#FFFFFF', border: '#D8E1DD',
    text: '#202725', muted: '#596761', accent: '#23624F', onAccent: '#FFFFFF',
    subtle: '#ECF3EF', danger: '#AB322B', dangerSurface: '#FFF0ED',
    warning: '#805B18', warningSurface: '#FFF4D9',
  },
  dark: {
    background: '#151B18', surface: '#202824', border: '#42504A',
    text: '#F3F6F4', muted: '#B1BEB6', accent: '#94D4B7', onAccent: '#10271D',
    subtle: '#293B31', danger: '#FFB4A9', dangerSurface: '#412622',
    warning: '#F0CE89', warningSurface: '#3D3321',
  },
} as const;

function createStyles(palette: typeof themes.light | typeof themes.dark) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: palette.background },
    content: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
    header: { marginBottom: 24 },
    title: { color: palette.text, fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.6 },
    sectionTitle: { color: palette.text, fontSize: 20, lineHeight: 26, fontWeight: '700' },
    description: { color: palette.muted, fontSize: 16, lineHeight: 23, marginTop: 8 },
    panel: { borderRadius: 12, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, padding: 16 },
    action: { minHeight: 50, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.accent },
    actionText: { color: palette.onAccent, fontSize: 16, fontWeight: '600', textAlign: 'center' },
    secondaryAction: { borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
    secondaryActionText: { color: palette.accent },
    disabledAction: { opacity: 0.45 },
    pressedAction: { opacity: 0.7 },
    error: { borderRadius: 10, backgroundColor: palette.dangerSurface, padding: 14 },
    errorText: { color: palette.danger, fontSize: 15, lineHeight: 22 },
    message: { paddingVertical: 24, gap: 12 },
    muted: { color: palette.muted, fontSize: 15, lineHeight: 22 },
    field: { gap: 0 },
    fieldLabel: { color: palette.text, fontSize: 15, fontWeight: '600', marginBottom: 8 },
    fieldHint: { marginTop: 6 },
    input: { minHeight: 50, borderRadius: 10, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, color: palette.text, fontSize: 17, paddingHorizontal: 14, paddingVertical: 12 },
    row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
    rowTitle: { color: palette.text, fontSize: 17, fontWeight: '600', lineHeight: 23 },
    rowDetail: { color: palette.muted, fontSize: 14, lineHeight: 21, marginTop: 3 },
  });
}

const lightStyles = createStyles(themes.light);
const darkStyles = createStyles(themes.dark);

export function useUi() {
  const dark = useColorScheme() === 'dark';
  return { dark, palette: dark ? themes.dark : themes.light, styles: dark ? darkStyles : lightStyles };
}
