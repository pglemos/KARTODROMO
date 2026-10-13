import { Link, type Href } from 'expo-router';
import type { PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const colors = {
  background: '#07110f',
  surface: '#111e1a',
  border: '#273b32',
  text: '#f2f5ed',
  muted: '#a5b2a8',
  accent: '#c9f36a',
  danger: '#ffb4a9',
};

export function AuthShell({ title, description, children }: PropsWithChildren<{ title: string; description: string }>) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>K</Text>
          </View>
          <View>
            <Text style={styles.brandName}>KARTÓDROMO</Text>
            <Text style={styles.brandLocation}>INTERNACIONAL DE BETIM</Text>
          </View>
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function AuthField({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

export function AuthButton({
  label,
  busy,
  disabled,
  onPress,
}: {
  label: string;
  busy?: boolean;
  disabled?: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || busy) }}
      disabled={disabled || busy}
      onPress={onPress}
      style={[styles.button, (disabled || busy) && styles.buttonDisabled]}
    >
      {busy ? <ActivityIndicator color={colors.background} /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );
}

export function AuthFeedback({ message, error = false }: { message: string; error?: boolean }) {
  if (!message) return null;
  return (
    <Text accessibilityRole={error ? 'alert' : 'text'} style={[styles.feedback, error && styles.error]}>
      {message}
    </Text>
  );
}

export function AuthLink({ href, children }: PropsWithChildren<{ href: Href }>) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" style={styles.link}>
        <Text style={styles.linkText}>{children}</Text>
      </Pressable>
    </Link>
  );
}

export const authColors = colors;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: 24, paddingTop: 18, paddingBottom: 40 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 34 },
  brandMark: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  brandMarkText: { color: colors.background, fontSize: 25, fontWeight: '900' },
  brandName: { color: colors.text, fontSize: 13, fontWeight: '900', letterSpacing: 1.8 },
  brandLocation: { color: colors.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1.25, marginTop: 3 },
  card: { padding: 22, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.6 },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 22 },
  field: { marginBottom: 15 },
  label: { color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, color: colors.text, backgroundColor: colors.background, fontSize: 15 },
  button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingHorizontal: 18, marginTop: 6, backgroundColor: colors.accent },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: colors.background, fontSize: 15, fontWeight: '800' },
  feedback: { color: colors.accent, fontSize: 13, lineHeight: 19, marginTop: 14 },
  error: { color: colors.danger },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  linkText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
});
