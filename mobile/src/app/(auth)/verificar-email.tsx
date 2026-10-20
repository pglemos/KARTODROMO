import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { authApi } from '../../api/client';
import { AuthFeedback, AuthLink, AuthShell } from '../../components/auth-ui';

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const requested = useRef<string | null>(null);
  const [result, setResult] = useState<{ token: string; message: string; error: boolean } | null>(null);

  useEffect(() => {
    if (!token || requested.current === token) return;
    requested.current = token;
    let active = true;
    void authApi
      .verifyEmail(token)
      .then(() => {
        if (active) setResult({ token, message: 'E-mail confirmado. Agora você pode entrar na sua conta.', error: false });
      })
      .catch(() => {
        if (active) setResult({ token, message: 'Não foi possível confirmar. O link pode ter expirado ou já ter sido usado.', error: true });
      });
    return () => {
      active = false;
    };
  }, [token]);

  const currentResult = result?.token === token ? result : null;
  const feedback = !token
    ? 'O link está incompleto ou expirou. Solicite outro e-mail de confirmação.'
    : currentResult?.message ?? 'Confirmando seu e-mail…';
  const error = !token || Boolean(currentResult?.error);

  return (
    <AuthShell title="Confirme seu e-mail" description="A confirmação protege o acesso à sua conta e permite recuperar sua senha.">
      <AuthFeedback message={feedback} error={error} />
      <AuthLink href="/(auth)/login">Ir para entrar</AuthLink>
    </AuthShell>
  );
}
