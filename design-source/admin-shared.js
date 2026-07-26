// Shared admin-panel data: nav modules, theme tokens, storage helpers, formatters.
// Imported via dynamic import('./admin-shared.js') from each admin page's DCLogic.

export const THEME_KEY = 'kib-admin-theme';

export function getStoredTheme() {
  try {
    const t = typeof window !== 'undefined' ? window.localStorage.getItem(THEME_KEY) : null;
    return t === 'dark' || t === 'light' ? t : 'light';
  } catch (e) { return 'light'; }
}

export function setStoredTheme(theme) {
  try { window.localStorage.setItem(THEME_KEY, theme); } catch (e) {}
}

// Returns a flat token object of raw color values for the given theme.
export function getTokens(theme) {
  const dark = theme === 'dark';
  return {
    bg: dark ? '#0a0d0a' : '#f5f7f5',
    surface: dark ? '#121613' : '#ffffff',
    surface2: dark ? '#181d19' : '#eef1ee',
    surfaceHover: dark ? '#1e2420' : '#e8ebe8',
    border: dark ? '#242b25' : '#e2e6e1',
    borderStrong: dark ? '#333c34' : '#d3d9d2',
    text: dark ? '#f2f5f1' : '#14170f',
    textMuted: dark ? '#8b988c' : '#5d6660',
    textFaint: dark ? '#5a655c' : '#8a938a',
    accent: dark ? '#00e676' : '#00a856',
    accentSoft: dark ? 'rgba(0,230,118,.14)' : 'rgba(0,168,86,.1)',
    accentBorder: dark ? 'rgba(0,230,118,.4)' : 'rgba(0,168,86,.35)',
    accentContrast: dark ? '#041a0d' : '#ffffff',
    danger: dark ? '#ff6b6b' : '#d92d2d',
    dangerSoft: dark ? 'rgba(255,107,107,.14)' : 'rgba(217,45,45,.08)',
    warning: dark ? '#f2b23b' : '#b8720a',
    warningSoft: dark ? 'rgba(242,178,59,.14)' : 'rgba(184,114,10,.1)',
    info: dark ? '#5eb6ff' : '#1868c2',
    infoSoft: dark ? 'rgba(94,182,255,.14)' : 'rgba(24,104,194,.08)',
    shadow: dark ? '0 20px 60px rgba(0,0,0,.45)' : '0 12px 32px rgba(20,30,20,.08)',
    overlay: dark ? 'rgba(3,5,4,.72)' : 'rgba(10,14,10,.42)',
  };
}

export const adminNavigationGroups = ['Geral', 'Operação', 'Competição', 'Gestão'];

export const adminModules = [
  { key: 'dashboard', title: 'Dashboard', href: 'admin-dashboard.dc.html', group: 'Geral', icon: 'M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z' },
  { key: 'reservas', title: 'Reservas', href: 'admin-reservas.dc.html', group: 'Operação', icon: 'M3 5h18v16H3zM8 3v4M16 3v4M3 10h18' },
  { key: 'recepcao', title: 'Recepção', href: 'admin-recepcao.dc.html', group: 'Operação', icon: 'M4 18v-6a8 8 0 1 1 16 0v6M2 18h20M9 21h6' },
  { key: 'lanchonete', title: 'Lanchonete', href: 'admin-lanchonete.dc.html', group: 'Operação', icon: 'M5 3v6a4 4 0 0 0 4 4v9M9 3v7M13 3v7M19 3v18M17 3v7a2 2 0 0 0 2 2' },
  { key: 'cronometragem', title: 'Cronometragem', href: 'admin-cronometragem.dc.html', group: 'Competição', icon: 'M12 7v5l3 2M9 2h6M12 22a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z' },
  { key: 'campeonatos', title: 'Campeonatos', href: 'admin-campeonatos.dc.html', group: 'Competição', icon: 'M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4ZM7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4' },
  { key: 'resultados', title: 'Resultados', href: 'admin-resultados.dc.html', group: 'Competição', icon: 'M4 21V4M4 4h13l-2 4 2 4H4' },
  { key: 'telao', title: 'Telão', href: 'admin-telao.dc.html', group: 'Competição', icon: 'M3 5h18v11H3zM8 20h8M12 16v4' },
  { key: 'financeira', title: 'Financeiro', href: 'admin-financeira.dc.html', group: 'Gestão', icon: 'M3 7h18v12H3zM3 10h18M7 15h4' },
  { key: 'clientes', title: 'Clientes', href: 'admin-clientes.dc.html', group: 'Gestão', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
  { key: 'administrativa', title: 'Administrativa', href: 'admin-administrativa.dc.html', group: 'Gestão', icon: 'M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4Z' },
  { key: 'clube', title: 'Clube de Vantagens', href: 'admin-clube.dc.html', group: 'Gestão', icon: 'M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4Zm0 4.5 1.9 3.9 4.3.6-3.1 3 .7 4.3L12 16.2l-3.8 2.1.7-4.3-3.1-3 4.3-.6L12 6.5Z' },
];

export function getAdminModule(key) { return adminModules.find((m) => m.key === key); }

export function formatBRL(v) {
  return (v < 0 ? '-R$ ' : 'R$ ') + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDateBR(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTimeBR(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
