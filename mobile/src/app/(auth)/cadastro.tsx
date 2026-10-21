import { useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useUi } from '../../components/theme';
import { Icon } from '../../components/brand';
import { authApi } from '../../api/client';
import type { RegistrationInput } from '../../api/contracts';
import { AuthButton, AuthFeedback, AuthField, AuthLink, AuthShell } from '../../components/auth-ui';

/** 12345678901 → 123.456.789-01 */
function maskCpf(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
}

/** 31999998888 → (31) 99999-8888 */
function maskPhone(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

export default function RegistrationScreen() {
  const { palette, styles } = useUi();
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (password.length < 8) {
      setError(true);
      setFeedback('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (!privacyAccepted) {
      setError(true);
      setFeedback('Leia e aceite a política de privacidade para continuar.');
      return;
    }
    const input: RegistrationInput = {
      name,
      cpf,
      email,
      phone,
      password,
      privacyAccepted: true,
    };
    setBusy(true);
    setError(false);
    setFeedback('');
    try {
      const result = await authApi.register(input);
      void result;
      setFeedback(`Quase lá! Enviamos um link de confirmação para ${email}. Abra o e-mail (confira também o spam), toque no link e depois entre com sua senha.`);
    } catch (reason) {
      setError(true);
      setFeedback(reason instanceof Error ? reason.message : 'Não foi possível criar a conta.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Crie sua conta"
      description="Uma conta para suas reservas e seu histórico na pista."
    >
      <AuthField label="Nome completo" placeholder="Como no seu documento" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" />
      <AuthField label="CPF" placeholder="000.000.000-00" value={cpf} onChangeText={(v) => setCpf(maskCpf(v))} keyboardType="number-pad" autoComplete="off" maxLength={14} />
      <AuthField label="E-mail" placeholder="voce@email.com" value={email} onChangeText={(v) => setEmail(v.trim())} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <AuthField label="Celular com DDD" placeholder="(31) 99999-9999" value={phone} onChangeText={(v) => setPhone(maskPhone(v))} keyboardType="phone-pad" autoComplete="tel" maxLength={15} />
      <AuthField
        label="Senha (mínimo 8 caracteres)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="off"
        textContentType="oneTimeCode"
        autoCorrect={false}
      />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: privacyAccepted }}
        onPress={() => setPrivacyAccepted((accepted) => !accepted)}
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10 }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: palette.accent,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: privacyAccepted ? palette.accent : 'transparent',
          }}
        >
          {privacyAccepted ? <Icon name="check" color={palette.onAccent} size={16} /> : null}
        </View>
        <Text style={[styles.muted, { flex: 1 }]}>
          Li e aceito a{' '}
          <Link href="https://reservas.kartodromodebetim.com.br/privacidade" style={{ color: palette.accent, fontWeight: '700' }}>
            política de privacidade
          </Link>
          .
        </Text>
      </Pressable>
      <AuthButton label="Criar conta" busy={busy} onPress={() => void submit()} />
      <AuthFeedback message={feedback} error={error} />
      <AuthLink href="/(auth)/login">Já tenho uma conta</AuthLink>
    </AuthShell>
  );
}
