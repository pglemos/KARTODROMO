import { Link, type Href } from 'expo-router';
import { useState, type PropsWithChildren } from 'react';
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

export function AuthField({ label, style, secureTextEntry, ...props }: TextInputProps & { label: string }) {
  const { palette, styles } = useUi();
  const [visivel, setVisivel] = useState(false);
  const [foco, setFoco] = useState(false);
  return <View style={{ marginBottom: 18 }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View>
      <TextInput {...props} onFocus={(e) => { setFoco(true); props.onFocus?.(e); }} onBlur={(e) => { setFoco(false); props.onBlur?.(e); }} secureTextEntry={secureTextEntry && !visivel} accessibilityLabel={label} placeholderTextColor={palette.muted} selectionColor={palette.accent}
        style={[styles.input, { borderWidth: 1.5, borderColor: foco ? palette.accent : 'transparent' }, secureTextEntry && { paddingRight: 92 }, style]} />
      {secureTextEntry ? (
        // mostrar/ocultar a senha: evita errar a digitação no celular
        <Pressable accessibilityRole="button" accessibilityLabel={visivel ? 'Ocultar senha' : 'Mostrar senha'} onPress={() => setVisivel((v) => !v)}
          style={{ position: 'absolute', right: 6, top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: 14 }}>
          <Text style={{ color: palette.accent, fontWeight: '700', fontSize: 14 }}>{visivel ? 'Ocultar' : 'Mostrar'}</Text>
        </Pressable>
      ) : null}
    </View>
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
