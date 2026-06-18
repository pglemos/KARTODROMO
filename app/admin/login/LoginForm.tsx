'use client';

import { FormEvent, useMemo, useState } from 'react';
import { LockKeyhole } from 'lucide-react';

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const destination = useMemo(() => {
    if (!nextPath || !nextPath.startsWith('/')) return '/admin/telao';
    return nextPath;
  }, [nextPath]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);

    if (!response.ok) {
      setError(response.status === 503 ? 'Login administrativo não configurado.' : 'E-mail ou senha inválidos.');
      return;
    }

    window.location.assign(destination);
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-500 text-zinc-950">
            <LockKeyhole size={22} aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-300">Admin</p>
            <h1 className="text-2xl font-black uppercase tracking-tight">Kartódromo de Betim</h1>
          </div>
        </div>

        <form onSubmit={onSubmit} className="grid gap-4">
          <label className="grid gap-2 text-sm font-bold text-zinc-200">
            E-mail
            <input
              className="h-12 rounded-lg border border-white/15 bg-white px-4 text-zinc-950 outline-none focus:border-primary-400"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="grid gap-2 text-sm font-bold text-zinc-200">
            Senha
            <input
              className="h-12 rounded-lg border border-white/15 bg-white px-4 text-zinc-950 outline-none focus:border-primary-400"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error ? <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 h-12 rounded-lg bg-primary-500 px-5 text-sm font-black uppercase tracking-[0.16em] text-zinc-950 transition-colors hover:bg-primary-400 disabled:opacity-60"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}
