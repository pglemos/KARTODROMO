'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Grid2X2, Moon, Sun } from 'lucide-react';

function normalizeNextPath(nextPath: string): string {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) return '/admin';
  return nextPath;
}

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    try {
      setTheme(localStorage.getItem('kib-admin-theme') === 'dark' ? 'dark' : 'light');
    } catch {
      // Local storage may be unavailable in restricted browsing contexts.
    }
  }, []);

  const destination = useMemo(() => {
    return normalizeNextPath(nextPath);
  }, [nextPath]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, remember }),
    });

    setLoading(false);

    if (!response.ok) {
      setError(response.status === 503 ? 'Login administrativo não configurado.' : 'E-mail ou senha inválidos.');
      return;
    }

    window.location.assign(destination);
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('kib-admin-theme', next);
    } catch {
      // Theme persistence is progressive enhancement.
    }
  }

  return (
    <main className="admin-login" data-theme={theme}>
      <section className="admin-login__showcase" aria-label="Recursos do sistema">
        <div className="relative z-[2] max-w-xl">
          <div className="flex items-center gap-2.5">
            <span className="admin-login__mark"><Grid2X2 aria-hidden="true" size={20} /></span>
            <strong className="text-[15px] font-bold">Kartódromo Betim</strong>
          </div>
          <h1 className="mt-9 max-w-[13ch] text-[clamp(30px,3vw,42px)] font-bold leading-[1.1]">
            Sistema de gestão da operação
          </h1>
          <p className="mt-[18px] max-w-[46ch] text-[15px] leading-[1.6] text-white/70">
            Reservas, recepção, lanchonete, cronometragem, campeonatos, resultados, telão, financeiro, clientes e administração, tudo em um só painel.
          </p>
          <div className="mt-8 grid gap-3.5">
            {['Reservas e recepção em tempo real', 'Cronometragem e resultados ao vivo', 'Financeiro, clientes e telão integrados'].map((feature) => (
              <div className="flex items-center gap-3" key={feature}>
                <span className="h-2 w-2 flex-none rounded-full bg-[#00e676] shadow-[0_0_12px_rgba(0,230,118,.6)]" />
                <span className="text-sm text-white/80">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="admin-login__form-side">
        <button className="admin-icon-button absolute right-5 top-5" type="button" onClick={toggleTheme} aria-label="Alternar tema">
          {theme === 'dark' ? <Sun aria-hidden="true" size={17} /> : <Moon aria-hidden="true" size={17} />}
        </button>
        <form onSubmit={onSubmit} className="admin-login__card" noValidate>
          <p className="m-0 text-[11px] font-bold uppercase tracking-[.12em] text-[var(--admin-accent)]">Área restrita</p>
          <h2 className="mt-1.5 text-[22px] font-bold text-[var(--admin-text)]">Entrar no painel</h2>
          <p className="mt-2 text-sm text-[var(--admin-muted)]">Use suas credenciais de administrador.</p>

          <div className="mt-[26px] grid gap-4">
            <label className="grid gap-[7px] text-xs font-bold uppercase tracking-[.03em] text-[var(--admin-muted)]" htmlFor="login-email">
              E-mail
            <input
              id="login-email"
              className="admin-input"
              type="email"
              autoComplete="username"
              placeholder="seu.usuario@kartodromodebetim.com.br"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            </label>

            <label className="grid gap-[7px] text-xs font-bold uppercase tracking-[.03em] text-[var(--admin-muted)]" htmlFor="login-password">
              Senha
              <span className="relative block">
                <input
                  id="login-password"
                  className="admin-input pr-12"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--admin-muted)] hover:text-[var(--admin-accent)]" type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                  {showPassword ? <EyeOff aria-hidden="true" size={17} /> : <Eye aria-hidden="true" size={17} />}
                </button>
              </span>
            </label>

            <label className="flex items-center gap-2.5 text-[13.5px] font-semibold text-[var(--admin-muted)]">
              <input className="h-4 w-4 accent-[var(--admin-accent)]" type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
              Manter conectado
            </label>

            {error ? <p className="rounded-[9px] bg-[var(--admin-danger-soft)] px-3.5 py-3 text-[13px] font-semibold text-[var(--admin-danger)]" role="alert">{error}</p> : null}

            <button type="submit" disabled={loading} className="admin-submit mt-0.5 px-5 disabled:opacity-60">
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </div>
          <p className="mb-0 mt-5 text-center text-[12.5px] text-[var(--admin-faint)]">Esqueceu a senha? Fale com a administração do sistema.</p>
        </form>
        <a className="text-[13px] font-bold text-[var(--admin-muted)] no-underline hover:text-[var(--admin-accent)]" href="/">← Voltar para o site</a>
      </section>
    </main>
  );
}
