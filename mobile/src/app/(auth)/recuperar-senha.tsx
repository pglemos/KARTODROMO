import { useState } from 'react';

import { authApi } from '../../api/client';
import { AuthButton, AuthFeedback, AuthField, AuthLink, AuthShell } from '../../components/auth-ui';

export default function RecoverPasswordScreen() {
  const [identifier, setIdentifier] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!identifier.trim()) {
      setError(true);
      setFeedback('Informe seu e-mail ou CPF.');
      return;
    }
    setBusy(true);
    setError(false);
    setFeedback('');
    try {
      const result = await authApi.requestPasswordReset(identifier.trim());
      setFeedback(result.mensagem);
    } catch (reason) {
      setError(true);
      setFeedback(reason instanceof Error ? reason.message : 'Não foi possível enviar as instruções.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Recupere sua senha" description="Se os dados puderem ser processados, enviaremos as instruções ao e-mail informado.">
      <AuthField
        label="E-mail ou CPF"
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
      />
      <AuthButton label="Enviar instruções" busy={busy} onPress={() => void submit()} />
      <AuthFeedback message={feedback} error={error} />
      <AuthLink href="/(auth)/login">Voltar para entrar</AuthLink>
    </AuthShell>
  );
}
