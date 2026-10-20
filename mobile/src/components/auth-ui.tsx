import { Link, type Href } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, TouchableOpacity, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Page } from '../features/reservations/components';
import { Brand } from './brand';
import { useUi } from './theme';

export function AuthShell({ title, description, children }: PropsWithChildren<{ title: string; description: string }>) {
  const { styles } = useUi();
  return <Page top={false}>
    <View style={{ marginBottom: 28 }}><Brand /></View>
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    <Text style={[styles.description, { marginBottom: 24 }]}>{description}</Text>
    {children}
  </Page>;
}

export function AuthField({ label, style, ...props }: TextInputProps & { label: string }) {
  const { palette, styles } = useUi();
  return <View style={{ marginBottom: 18 }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput {...props} accessibilityLabel={label} placeholderTextColor={palette.muted} selectionColor={palette.accent} style={[styles.input, style]} />
  </View>;
}

export function AuthButton({ label, busy, disabled, onPress }: { label: string; busy?: boolean; disabled?: boolean; onPress(): void }) {
  const { palette, styles } = useUi();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(disabled || busy), busy }} disabled={disabled || busy} onPress={onPress}
    style={({ pressed }) => [styles.action, { marginTop: 8 }, (disabled || busy) && styles.disabledAction, pressed && styles.pressedAction]}>
    {busy ? <ActivityIndicator color={palette.onAccent} /> : <Text style={styles.actionText}>{label}</Text>}
  </Pressable>;
}

export function AuthFeedback({ message, error = false }: { message: string; error?: boolean }) {
  const { palette, styles } = useUi();
  if (!message) return null;
  return <Text accessibilityLiveRegion="polite" accessibilityRole={error ? 'alert' : 'text'} style={[styles.muted, { color: error ? palette.danger : palette.accent, marginTop: 16 }]}>{message}</Text>;
}

export function AuthLink({ href, children }: PropsWithChildren<{ href: Href }>) {
  const { palette } = useUi();
  return <Link href={href} asChild>
    <TouchableOpacity activeOpacity={0.65} accessibilityRole="link" style={{ minHeight: 48, paddingVertical: 12, justifyContent: 'center', alignSelf: 'flex-start' }}>
      <Text style={{ color: palette.accent, fontSize: 16, fontWeight: '600' }}>{children}</Text>
    </TouchableOpacity>
  </Link>;
}
