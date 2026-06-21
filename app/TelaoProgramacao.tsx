'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type {
  TelaoPlaylistItem,
  TelaoPlaylistItemType,
} from '@/lib/telao-playlist-store';

const TYPE_OPTIONS: { value: TelaoPlaylistItemType; label: string }[] = [
  { value: 'scoreboard', label: 'Placar (cronometragem)' },
  { value: 'image', label: 'Imagem' },
  { value: 'video', label: 'Vídeo' },
  { value: 'youtube', label: 'YouTube (ao vivo/vídeo)' },
  { value: 'stream', label: 'Stream (HLS/RTSP)' },
  { value: 'web', label: 'Página web' },
];

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function newItem(): TelaoPlaylistItem {
  return {
    id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type: 'image',
    title: '',
    source: '',
    durationSec: 15,
    repeat: 1,
    enabled: true,
  };
}

const box: CSSProperties = {
  background: '#0f1115',
  border: '1px solid #262b36',
  borderRadius: 12,
  padding: 16,
  color: '#e6edf3',
};
const input: CSSProperties = {
  background: '#0b0d11',
  border: '1px solid #2a313d',
  borderRadius: 8,
  color: '#fff',
  padding: '7px 9px',
  fontSize: 13,
  width: '100%',
};
const btn: CSSProperties = {
  background: '#1f6feb',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '8px 14px',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};
const ghost: CSSProperties = { ...btn, background: '#21262d' };

export function TelaoProgramacao() {
  const [items, setItems] = useState<TelaoPlaylistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/telao-playlist', { cache: 'no-store' });
      const data = await res.json();
      setItems(Array.isArray(data?.playlist?.items) ? data.playlist.items : []);
    } catch {
      setMessage({ type: 'err', text: 'Falha ao carregar a programação.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function patch(id: string, changes: Partial<TelaoPlaylistItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...changes } : it)));
  }
  function patchSchedule(id: string, changes: Partial<NonNullable<TelaoPlaylistItem['schedule']>>) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, schedule: { ...(it.schedule || {}), ...changes } } : it)),
    );
  }
  function toggleWeekday(id: string, day: number) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const cur = it.schedule?.weekdays || [];
        const next = cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day].sort();
        return { ...it, schedule: { ...(it.schedule || {}), weekdays: next } };
      }),
    );
  }
  function move(id: string, dir: -1 | 1) {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.id === id);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[j]] = [copy[j], copy[idx]];
      return copy;
    });
  }
  function remove(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  async function uploadMedia(id: string, file: File) {
    const fd = new FormData();
    fd.append('file', file);
    setMessage(null);
    try {
      const res = await fetch('/api/telao-upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data?.url) patch(id, { source: data.url });
      else throw new Error('resposta inválida');
    } catch {
      setMessage({ type: 'err', text: 'Upload exige o agente local (.250). Use uma URL por enquanto.' });
    }
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/telao-playlist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data?.playlist?.items) ? data.playlist.items : items);
      setMessage({ type: 'ok', text: 'Programação salva.' });
    } catch {
      setMessage({ type: 'err', text: 'Falha ao salvar a programação.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={{ ...box, marginTop: 20 }} aria-label="Programação do telão">
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <span style={{ color: '#8b949e', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Conteúdo</span>
          <h2 style={{ margin: 0, fontSize: 18 }}>Programação do telão</h2>
          <p style={{ margin: '4px 0 0', color: '#8b949e', fontSize: 13 }}>
            Placar, imagens, vídeos, YouTube ao vivo e propaganda — com duração, repetição e horário.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={ghost} onClick={() => setItems((p) => [...p, newItem()])}>+ Conteúdo</button>
          <button type="button" style={btn} onClick={() => void save()} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar programação'}
          </button>
        </div>
      </header>

      {message ? (
        <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 10, fontSize: 13, background: message.type === 'ok' ? '#10391f' : '#3d1418', color: '#fff' }}>
          {message.text}
        </div>
      ) : null}

      {loading ? (
        <p style={{ color: '#8b949e' }}>Carregando...</p>
      ) : items.length === 0 ? (
        <p style={{ color: '#8b949e' }}>Nenhum conteúdo. Clique em “+ Conteúdo”.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((it, idx) => (
            <article key={it.id} style={{ ...box, padding: 12, opacity: it.enabled ? 1 : 0.55 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 90px 80px auto', gap: 8, alignItems: 'center' }}>
                <select style={input} value={it.type} onChange={(e) => patch(it.id, { type: e.target.value as TelaoPlaylistItemType })}>
                  {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input
                  style={input}
                  placeholder={it.type === 'scoreboard' ? 'Placar ao vivo (automático)' : it.type === 'youtube' ? 'URL do YouTube (live ou vídeo)' : it.type === 'image' || it.type === 'video' ? 'URL ou caminho da mídia (ou faça upload)' : 'URL'}
                  value={it.source}
                  disabled={it.type === 'scoreboard'}
                  onChange={(e) => patch(it.id, { source: e.target.value })}
                />
                <input style={input} type="number" min={1} title="Duração (s)" value={it.durationSec} onChange={(e) => patch(it.id, { durationSec: Number(e.target.value) })} />
                <input style={input} type="number" min={1} title="Repete" value={it.repeat} onChange={(e) => patch(it.id, { repeat: Number(e.target.value) })} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" style={ghost} title="Subir" onClick={() => move(it.id, -1)} disabled={idx === 0}>↑</button>
                  <button type="button" style={ghost} title="Descer" onClick={() => move(it.id, 1)} disabled={idx === items.length - 1}>↓</button>
                  <button type="button" style={{ ...ghost, background: '#3d1418' }} title="Remover" onClick={() => remove(it.id)}>✕</button>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginTop: 8 }}>
                <label style={{ fontSize: 12, color: '#8b949e', display: 'flex', gap: 5, alignItems: 'center' }}>
                  <input type="checkbox" checked={it.enabled} onChange={(e) => patch(it.id, { enabled: e.target.checked })} /> Ativo
                </label>
                {(it.type === 'image' || it.type === 'video') ? (
                  <label style={{ ...ghost, padding: '5px 10px', fontSize: 12 }}>
                    Upload
                    <input type="file" accept={it.type === 'image' ? 'image/*' : 'video/*'} style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadMedia(it.id, f); }} />
                  </label>
                ) : null}
                <span style={{ fontSize: 12, color: '#8b949e' }}>Horário:</span>
                <input style={{ ...input, width: 90 }} type="time" value={it.schedule?.startTime || ''} onChange={(e) => patchSchedule(it.id, { startTime: e.target.value })} title="Início" />
                <span style={{ color: '#8b949e' }}>—</span>
                <input style={{ ...input, width: 90 }} type="time" value={it.schedule?.endTime || ''} onChange={(e) => patchSchedule(it.id, { endTime: e.target.value })} title="Fim" />
                <div style={{ display: 'flex', gap: 3 }}>
                  {WEEKDAYS.map((w, d) => {
                    const on = it.schedule?.weekdays?.includes(d);
                    return (
                      <button key={d} type="button" onClick={() => toggleWeekday(it.id, d)} style={{ ...ghost, padding: '4px 7px', fontSize: 11, background: on ? '#1f6feb' : '#21262d' }}>{w}</button>
                    );
                  })}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <p style={{ color: '#6e7681', fontSize: 11, marginTop: 10 }}>
        Sem horário definido = toca sempre. Upload de imagem/vídeo grava no PC do telão (.250). YouTube/stream ao vivo dependem de fonte autorizada.
      </p>
    </section>
  );
}
