import { useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { authApi } from '../../api/client';
import type { RegistrationInput } from '../../api/contracts';
import { AuthButton, AuthFeedback, AuthField, AuthLink, AuthShell } from '../../components/auth-ui';

export default function RegistrationScreen() {
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
      setFeedback(result.mensagem);
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
      description="Seus dados ajudam a organizar reservas, pagamentos e resultados vinculados à sua identidade."
    >
      <AuthField label="Nome completo" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" />
      <AuthField label="CPF" value={cpf} onChangeText={setCpf} keyboardType="number-pad" autoComplete="off" />
      <AuthField label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <AuthField label="Telefone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
      <AuthField
        label="Senha (mínimo 8 caracteres)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
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
            borderColor: '#c9f36a',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: privacyAccepted ? '#c9f36a' : 'transparent',
          }}
        >
          {privacyAccepted ? <Text style={{ color: '#07110f', fontWeight: '900' }}>✓</Text> : null}
        </View>
        <Text style={{ flex: 1, color: '#a5b2a8', fontSize: 13, lineHeight: 19 }}>
          Li e aceito a{' '}
          <Link href="/privacidade" style={{ color: '#c9f36a', fontWeight: '700' }}>
            política de privacidade
          </Link>
          . Entendi que o GPS só será solicitado quando eu iniciar um treino.
        </Text>
      </Pressable>
      <AuthButton label="Criar conta" busy={busy} onPress={() => void submit()} />
      <AuthFeedback message={feedback} error={error} />
      <AuthLink href="/(auth)/login">Já tenho uma conta</AuthLink>
    </AuthShell>
  );
}
