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
      className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--admin-border)] bg-transparent px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-[var(--admin-danger)] transition-colors hover:border-[var(--admin-danger)] disabled:opacity-60"
      disabled={loading}
      onClick={() => void logout()}
      type="button"
    >
      <LogOut aria-hidden="true" size={15} />
      {loading ? 'Saindo' : 'Sair'}
    </button>
  );
}
