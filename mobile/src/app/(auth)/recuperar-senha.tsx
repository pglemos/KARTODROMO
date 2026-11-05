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
    <AuthShell title="Recupere seu acesso" description="Esqueceu a senha ou o e-mail? Informe seu CPF: mostramos para qual e-mail enviamos o link.">
      <AuthField
        label="CPF ou e-mail"
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
      />
      <AuthButton label="Enviar instruções" busy={busy} onPress={() => void submit()} />
      <AuthFeedback message={feedback} error={error} />
      <AuthLink href="/(auth)/corrigir-email">Esse não é meu e-mail / cadastrei errado</AuthLink>
      <AuthLink href="/(auth)/login">Voltar para entrar</AuthLink>
    </AuthShell>
  );
}
