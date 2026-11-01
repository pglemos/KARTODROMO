/**
 * Tela que substitui o formulário quando o cadastro termina: um kart cruza a pista até a bandeirada, o envelope
 * aparece com mola e o celular vibra de sucesso. Explica o próximo passo (abrir o e-mail) com botões grandes.
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Linking, Platform, Pressable, Text, View } from 'react-native';

import { tap } from './motion';
import { useUi } from './theme';

export function CadastroSucesso({ email }: { email: string }) {
  const { palette, styles } = useUi();
  const [largura, setLargura] = useState(300);
  const [kart] = useState(() => new Animated.Value(0));
  const [envelope] = useState(() => new Animated.Value(0));
  const [pulso] = useState(() => new Animated.Value(0));
  const nativo = Platform.OS !== 'web';

  useEffect(() => {
    if (nativo) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    // o kart corre até a bandeirada; depois fica "acelerando" parado, esperando a confirmação
    Animated.sequence([
      Animated.timing(kart, { toValue: 1, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: nativo }),
      Animated.spring(envelope, { toValue: 1, friction: 5, tension: 90, useNativeDriver: nativo }),
    ]).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulso, { toValue: 1, duration: 140, useNativeDriver: nativo }),
      Animated.timing(pulso, { toValue: 0, duration: 140, useNativeDriver: nativo }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [envelope, kart, nativo, pulso]);

  const abrirEmail = () => {
    tap();
    void Linking.openURL(Platform.OS === 'ios' ? 'message://' : 'mailto:').catch(() => undefined);
  };

  return (
    <View style={{ gap: 18 }}>
      {/* pista: faixa escura com zebras, o kart e a bandeira quadriculada no fim */}
      <View onLayout={(e) => setLargura(e.nativeEvent.layout.width)} style={{ height: 96, borderRadius: 20, backgroundColor: '#111114', overflow: 'hidden', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: 46, height: 2, flexDirection: 'row', gap: 10 }}>
          {Array.from({ length: 30 }, (_, i) => <View key={i} style={{ width: 14, height: 2, backgroundColor: 'rgba(255,255,255,0.25)' }} />)}
        </View>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 6, flexDirection: 'row' }}>
          {Array.from({ length: 40 }, (_, i) => <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? '#E4002B' : '#FFFFFF' }} />)}
        </View>
        <Text style={{ position: 'absolute', right: 14, top: 18, fontSize: 34 }}>🏁</Text>
        <Animated.Text style={{ fontSize: 44, transform: [
          { translateX: kart.interpolate({ inputRange: [0, 1], outputRange: [-60, Math.max(0, largura - 120)] }) },
          { translateY: pulso.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5] }) },
          { scaleX: -1 },
        ] }}>🏎️</Animated.Text>
      </View>

      <Animated.View style={{ alignItems: 'center', gap: 10, opacity: envelope, transform: [{ scale: envelope.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
        <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(245,158,11,0.15)', borderWidth: 2, borderColor: palette.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 36 }}>✉️</Text>
        </View>
        <Text accessibilityRole="header" style={{ color: palette.text, fontSize: 26, fontWeight: '900', textAlign: 'center' }}>Conta criada! Falta só uma volta</Text>
        <Text style={[styles.muted, { textAlign: 'center', fontSize: 15, lineHeight: 22 }]}>
          Enviamos o link de confirmação para{'\n'}<Text style={{ color: palette.text, fontWeight: '800' }}>{email}</Text>
        </Text>
      </Animated.View>

      <View style={{ gap: 10, backgroundColor: palette.surfaceElevated, borderRadius: 18, padding: 16 }}>
        {['Abra o e-mail do Kartódromo de Betim (veja também o spam)', 'Toque em “Confirmar meu e-mail”', 'Volte aqui e entre com seu e-mail ou CPF e a senha'].map((t, i) => (
          <View key={t} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#000000', fontWeight: '900' }}>{i + 1}</Text>
            </View>
            <Text style={{ color: palette.textSecondary, fontSize: 14, flex: 1 }}>{t}</Text>
          </View>
        ))}
      </View>

      <Pressable accessibilityRole="button" onPress={abrirEmail} style={({ pressed }) => [styles.action, pressed && styles.pressedAction]}>
        <Text style={styles.actionText}>Abrir meu e-mail</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => { tap(); router.replace('/(auth)/login'); }} style={{ paddingVertical: 12 }}>
        <Text style={{ color: palette.accent, fontWeight: '800', fontSize: 16, textAlign: 'center' }}>Já confirmei, quero entrar</Text>
      </Pressable>
    </View>
  );
}
