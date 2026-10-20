import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { AuthButton, AuthFeedback, AuthField, AuthLink, AuthShell } from '../../components/auth-ui';
import { useSession } from '../../session/provider';

export default function LoginScreen() {
  const params = useLocalSearchParams<{ bateriaId?: string | string[] }>();
  const rawId = Array.isArray(params.bateriaId) ? params.bateriaId[0] : params.bateriaId;
  const batteryId = rawId && /^\d+$/.test(rawId) && Number.isSafeInteger(Number(rawId)) && Number(rawId) > 0 ? String(Number(rawId)) : null;
  const { login } = useSession();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!identifier.trim() || password.length < 8) {
      setError(true);
      setFeedback('Informe seu e-mail ou CPF e uma senha com pelo menos 8 caracteres.');
      return;
    }
    setBusy(true);
    setError(false);
    setFeedback('');
    try {
      await login(identifier.trim(), password);
      router.replace(batteryId ? { pathname: '/(tabs)/reservas', params: { bateriaId: batteryId } } : '/');
    } catch (reason) {
      setError(true);
      setFeedback(reason instanceof Error ? reason.message : 'Não foi possível entrar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Entre para continuar" description="Use seu e-mail ou CPF para consultar reservas e cupons.">
      <AuthField
        label="E-mail ou CPF"
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        returnKeyType="next"
      />
      <AuthField
        label="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <AuthLink href="/(auth)/recuperar-senha">Esqueci minha senha</AuthLink>
      <AuthButton label="Entrar" busy={busy} onPress={() => void submit()} />
      <AuthFeedback message={feedback} error={error} />
      <AuthLink href="/(auth)/cadastro">Criar minha conta</AuthLink>
    </AuthShell>
  );
}
