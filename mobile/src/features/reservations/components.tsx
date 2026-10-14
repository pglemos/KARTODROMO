import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useUi } from '../../components/theme';
import { Icon } from '../../components/brand';
export { useUi } from '../../components/theme';

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

export function Page({ children, top = true }: PropsWithChildren<{ top?: boolean }>) {
  const { styles } = useUi();
  return (
    <SafeAreaView edges={top ? ['top', 'left', 'right'] : ['left', 'right', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {children}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function PageHeader({ title, description }: { title: string; description?: string }) {
  const { styles } = useUi();
  return (
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

export function Panel({ children, style }: PropsWithChildren<{ style?: object }>) {
  const { styles } = useUi();
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
  const { styles } = useUi();
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
  const { styles } = useUi();
  return (
    <View accessibilityLiveRegion="polite" style={styles.error}>
      <Text accessibilityRole="alert" style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function LoadingMessage({ label = 'Carregando…' }: { label?: string }) {
  const { palette, styles } = useUi();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={styles.message}>
      <ActivityIndicator color={palette.accent} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function Field({
  label,
  children,
  hint,
}: PropsWithChildren<{ label: string; hint?: ReactNode }>) {
  const { styles } = useUi();
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {hint ? <View style={styles.fieldHint}>{hint}</View> : null}
    </View>
  );
}

export function Notice({ message }: { message: string }) {
  const { palette, styles } = useUi();
  return <View style={{ padding: 14, borderRadius: 10, backgroundColor: palette.warningSurface, flexDirection: 'row', gap: 10 }}>
    <Icon name="info" color={palette.warning} size={22} /><Text style={[styles.muted, { flex: 1, color: palette.warning }]}>{message}</Text>
  </View>;
}
