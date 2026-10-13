import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const palette = {
  background: '#07110f',
  surface: '#111e1a',
  border: '#273b32',
  text: '#f2f5ed',
  muted: '#a5b2a8',
  accent: '#c9f36a',
  danger: '#ff9a8d',
};

export function formatBrl(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Horário em confirmação';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!match) return value;
  const [, year, month, day, hour, minute] = match;
  return `${day}/${month}/${year} · ${hour}:${minute}`;
}

export function Page({ children }: PropsWithChildren) {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

export function Panel({ children, style }: PropsWithChildren<{ style?: object }>) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function ActionButton({
  label,
  onPress,
  disabled = false,
  secondary = false,
  accessibilityRole = 'button',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  accessibilityRole?: 'button' | 'radio' | 'checkbox';
}) {
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        secondary && styles.secondaryAction,
        disabled && styles.disabledAction,
        pressed && !disabled && styles.pressedAction,
      ]}
    >
      <Text style={[styles.actionText, secondary && styles.secondaryActionText]}>{label}</Text>
    </Pressable>
  );
}

export function InlineError({ message }: { message: string }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.error}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function LoadingMessage({ label = 'Carregando…' }: { label?: string }) {
  return (
    <View accessibilityRole="progressbar" style={styles.message}>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function Field({
  label,
  children,
  hint,
}: PropsWithChildren<{ label: string; hint?: ReactNode }>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {hint ? <View style={styles.fieldHint}>{hint}</View> : null}
    </View>
  );
}

export const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 36 },
  header: { marginBottom: 22 },
  eyebrow: { color: palette.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { color: palette.text, fontSize: 29, lineHeight: 35, fontWeight: '800', letterSpacing: -0.5, marginTop: 7 },
  description: { color: palette.muted, fontSize: 14, lineHeight: 21, marginTop: 8 },
  panel: { borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, padding: 17 },
  action: { minHeight: 48, borderRadius: 14, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.accent },
  actionText: { color: palette.background, fontSize: 14, fontWeight: '800' },
  secondaryAction: { borderWidth: 1, borderColor: palette.border, backgroundColor: '#0d1915' },
  secondaryActionText: { color: palette.text },
  disabledAction: { opacity: 0.45 },
  pressedAction: { opacity: 0.78 },
  error: { borderRadius: 13, borderWidth: 1, borderColor: '#724239', backgroundColor: '#2a1b18', padding: 13 },
  errorText: { color: palette.danger, fontSize: 13, lineHeight: 19 },
  message: { paddingVertical: 22 },
  muted: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  field: { marginTop: 17 },
  fieldLabel: { color: palette.text, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  fieldHint: { marginTop: 6 },
});
