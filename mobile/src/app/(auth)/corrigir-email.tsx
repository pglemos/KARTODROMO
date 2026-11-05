import { useState } from 'react';

import { authApi } from '../../api/client';
import { AuthButton, AuthFeedback, AuthField, AuthLink, AuthShell } from '../../components/auth-ui';

function maskCpf(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
}

/**
 * "Errei meu e-mail": a conta foi criada com um e-mail errado e o link de confirmação nunca chegou.
 * CPF + a senha escolhida no cadastro provam que a conta é sua; o link de confirmação vai para o e-mail certo.
 */
export default function CorrectEmailScreen() {
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11 || password.length < 8 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError(true);
      setFeedback('Informe o CPF da conta, a senha que você criou e o e-mail certo.');
      return;
    }
    setBusy(true);
    setError(false);
    setFeedback('');
    try {
      const result = await authApi.correctEmail(digits, password, email.trim());
      setFeedback(result.mensagem);
    } catch (reason) {
      setError(true);
      setFeedback(reason instanceof Error ? reason.message : 'Não foi possível corrigir o e-mail agora.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Errei meu e-mail"
      description="Se você criou a conta com o e-mail errado e a confirmação não chegou, informe seu CPF, a senha que você criou e o e-mail certo. Enviamos um novo link de confirmação."
    >
      <AuthField
        label="CPF"
        placeholder="000.000.000-00"
        value={cpf}
        onChangeText={(v) => setCpf(maskCpf(v))}
        keyboardType="number-pad"
        autoComplete="off"
        maxLength={14}
      />
      <AuthField
        label="Senha que você criou"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
      />
      <AuthField
        label="E-mail certo"
        placeholder="voce@email.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
      />
      <AuthButton label="Enviar novo link" busy={busy} onPress={() => void submit()} />
      <AuthFeedback message={feedback} error={error} />
      <AuthLink href="/(auth)/recuperar-senha">Esqueci a senha também</AuthLink>
      <AuthLink href="/(auth)/login">Voltar para entrar</AuthLink>
    </AuthShell>
  );
}
