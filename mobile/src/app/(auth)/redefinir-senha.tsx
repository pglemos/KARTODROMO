import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { authApi } from '../../api/client';
import { AuthButton, AuthFeedback, AuthField, AuthLink, AuthShell } from '../../components/auth-ui';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [feedback, setFeedback] = useState(token ? '' : 'O link está incompleto ou expirou.');
  const [error, setError] = useState(!token);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!token) {
      setError(true);
      setFeedback('Solicite um novo link de redefinição.');
      return;
    }
    if (password.length < 8) {
      setError(true);
      setFeedback('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirmation) {
      setError(true);
      setFeedback('As senhas não coincidem.');
      return;
    }
    setBusy(true);
    setError(false);
    setFeedback('');
    try {
      await authApi.resetPassword(token, password);
      setFeedback('Senha atualizada. Entre novamente com a nova senha.');
    } catch (reason) {
      setError(true);
      setFeedback(reason instanceof Error ? reason.message : 'Não foi possível redefinir a senha.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Crie uma nova senha" description="Escolha uma senha com pelo menos 8 caracteres.">
      <AuthField
        label="Nova senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <AuthField
        label="Confirme a nova senha"
        value={confirmation}
        onChangeText={setConfirmation}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={submit}
      />
      <AuthButton label="Salvar nova senha" busy={busy} onPress={() => void submit()} />
      <AuthFeedback message={feedback} error={error} />
      <AuthLink href="/(auth)/login">Ir para entrar</AuthLink>
    </AuthShell>
  );
}
