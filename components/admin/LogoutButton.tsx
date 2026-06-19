'use client';

import { useState } from 'react';
import { LogOut } from 'lucide-react';

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => undefined);
    window.location.assign('/login');
  }

  return (
    <button
      className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-700/80 bg-zinc-900 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-zinc-200 transition-colors hover:border-primary-400/70 hover:text-primary-300 disabled:opacity-60"
      disabled={loading}
      onClick={() => void logout()}
      type="button"
    >
      <LogOut aria-hidden="true" size={15} />
      {loading ? 'Saindo' : 'Sair'}
    </button>
  );
}
