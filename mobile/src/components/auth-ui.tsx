import { Link, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, Animated, ImageBackground, Platform, Pressable, TouchableOpacity, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Page } from '../features/reservations/components';
import { Brand } from './brand';
import { Entrada, tap } from './motion';
import { useUi } from './theme';

export function AuthShell({ title, description, children }: PropsWithChildren<{ title: string; description: string }>) {
  const { palette, styles } = useUi();
  // capa com a pista e o logo; o formulário vem num cartão que sobe por cima dela
  return <Page top={false}>
    <Entrada>
      <ImageBackground source={require('../../assets/betim-track.jpg')} resizeMode="cover" imageStyle={{ borderRadius: 28 }}
        style={{ height: 190, borderRadius: 28, overflow: 'hidden', padding: 20, justifyContent: 'space-between', marginTop: 8 }}>
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)' }} />
        <Brand width={200} />
        <Text accessibilityRole="header" style={[styles.title, { color: '#FFFFFF', marginBottom: 0 }]}>{title}</Text>
      </ImageBackground>
    </Entrada>
    <Entrada index={1}>
      <View style={{ marginTop: -20, backgroundColor: palette.surface, borderRadius: 28, padding: 20, borderWidth: 1, borderColor: palette.border }}>
        <Text style={[styles.description, { marginBottom: 20 }]}>{description}</Text>
        {children}
      </View>
    </Entrada>
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
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(disabled || busy), busy }} disabled={disabled || busy} onPress={() => { tap(); onPress(); }}
    style={({ pressed }) => [styles.action, { marginTop: 8 }, (disabled || busy) && styles.disabledAction, pressed && styles.pressedAction]}>
    {busy ? <ActivityIndicator color={palette.onAccent} /> : <Text style={styles.actionText}>{label}</Text>}
  </Pressable>;
}

export function AuthFeedback({ message, error = false }: { message: string; error?: boolean }) {
  const { palette, styles } = useUi();
  // erro: o aviso treme e o celular vibra de erro, como o iOS faz numa senha errada
  const [x] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!message || !error) return;
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    x.setValue(0);
    Animated.sequence([10, -10, 7, -7, 3, 0].map((v) => Animated.timing(x, { toValue: v, duration: 45, useNativeDriver: Platform.OS !== 'web' }))).start();
  }, [message, error, x]);
  if (!message) return null;
  return <Animated.Text accessibilityLiveRegion="polite" accessibilityRole={error ? 'alert' : 'text'} style={[styles.muted, { color: error ? palette.danger : palette.accent, marginTop: 16, transform: [{ translateX: x }] }]}>{message}</Animated.Text>;
}

export function AuthLink({ href, children }: PropsWithChildren<{ href: Href }>) {
  const { palette } = useUi();
  return <Link href={href} asChild>
    <TouchableOpacity activeOpacity={0.65} accessibilityRole="link" style={{ minHeight: 48, paddingVertical: 12, justifyContent: 'center', alignSelf: 'flex-start' }}>
      <Text style={{ color: palette.accent, fontSize: 16, fontWeight: '600' }}>{children}</Text>
    </TouchableOpacity>
  </Link>;
}
