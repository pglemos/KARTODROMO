'use client';

import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Globe2,
  ImagePlus,
  LayoutList,
  Plus,
  Radio,
  Save,
  Trash2,
  Video,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/src/admin/ui/Badge';
import { Button } from '@/src/admin/ui/Button';
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
const fieldClass = 'h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 text-sm text-zinc-100 outline-none transition-colors focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:opacity-60';
const compactFieldClass = `${fieldClass} w-auto min-w-[92px]`;

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

function typeIcon(type: TelaoPlaylistItemType) {
  if (type === 'scoreboard') return LayoutList;
  if (type === 'image') return ImagePlus;
  if (type === 'video' || type === 'youtube') return Video;
  if (type === 'stream') return Radio;
  return Globe2;
}

export function TelaoProgramacao() {
  const [items, setItems] = useState<TelaoPlaylistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [autoMode, setAutoMode] = useState<boolean | null>(null);

  const loadAuto = useCallback(async () => {
    try {
      const res = await fetch('/api/tb50-display-mode', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (typeof data?.auto !== 'boolean') throw new Error('Resposta inválida');
      setAutoMode(data.auto);
    } catch {
      setAutoMode(null);
    }
  }, []);

  async function toggleAuto(next: boolean) {
    setAutoMode(next);
    try {
      const res = await fetch('/api/tb50-display-mode', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMessage({ type: 'ok', text: next ? 'Modo automático ligado.' : 'Modo automático desligado (controle manual).' });
    } catch {
      setMessage({ type: 'err', text: 'Falha ao alterar o modo automático.' });
      void loadAuto();
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/telao-playlist', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data?.playlist?.items)) throw new Error('Resposta inválida');
      setItems(data.playlist.items);
    } catch {
      setMessage({ type: 'err', text: 'Falha ao carregar a programação.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadAuto();
  }, [load, loadAuto]);

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
        const current = it.schedule?.weekdays || [];
        const next = current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort();
        return { ...it, schedule: { ...(it.schedule || {}), weekdays: next } };
      }),
    );
  }

  function move(id: string, direction: -1 | 1) {
    setItems((prev) => {
      const index = prev.findIndex((it) => it.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  async function uploadMedia(id: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    setMessage(null);
    try {
      const res = await fetch('/api/telao-upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data?.url) patch(id, { source: data.url });
      else throw new Error('Resposta inválida');
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
    <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-card" aria-label="Programação do telão">
      <div className={`border-b p-4 md:p-5 ${autoMode === false ? 'border-amber-500/30 bg-amber-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-start gap-3">
            <span className={`grid h-10 w-10 flex-none place-items-center rounded-lg ${autoMode === false ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
              <CalendarClock aria-hidden="true" size={20} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500">Automação</p>
                <Badge variant={autoMode === false ? 'amber' : 'emerald'}>{autoMode === null ? 'Verificando' : autoMode ? 'Ligado' : 'Desligado'}</Badge>
              </div>
              <h2 className="mt-1 text-base font-semibold text-zinc-50">Modo automático do telão</h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-400">
                Alterna entre placar durante a sessão e pódio quando a cronometragem encerra a corrida.
              </p>
            </div>
          </div>
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 text-sm font-medium text-zinc-300">
            <input
              aria-label="Ativar modo automático"
              className="h-4 w-4 accent-brand-500"
              type="checkbox"
              checked={autoMode === true}
              disabled={autoMode === null}
              onChange={(event) => void toggleAuto(event.target.checked)}
            />
            Ativo
          </label>
        </div>
      </div>

      <header className="telao-programacao-header flex items-center justify-between gap-4 border-b border-zinc-800 p-4 md:p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <LayoutList aria-hidden="true" className="flex-none text-brand-400" size={18} />
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500">Conteúdo</p>
          </div>
          <h2 className="mt-1 text-lg font-semibold text-zinc-50">Programação do telão</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-400">Placar, mídia, transmissão e página web com duração, repetição e janela de exibição.</p>
        </div>
        <div className="telao-programacao-header-actions flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setItems((previous) => [...previous, newItem()])}>
            <Plus aria-hidden="true" size={15} />
            Conteúdo
          </Button>
          <Button loading={saving} onClick={() => void save()}>
            <Save aria-hidden="true" size={15} />
            {saving ? 'Salvando...' : 'Salvar programação'}
          </Button>
        </div>
      </header>

      {message ? (
        <div className={`mx-4 mt-4 flex items-start gap-2 rounded-lg border p-3 text-sm md:mx-5 ${message.type === 'ok' ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200' : 'border-red-500/30 bg-red-500/5 text-red-200'}`} role="status">
          {message.type === 'ok' ? <CheckCircle2 aria-hidden="true" className="mt-0.5 flex-none text-emerald-400" size={16} /> : <AlertTriangle aria-hidden="true" className="mt-0.5 flex-none text-red-400" size={16} />}
          <span>{message.text}</span>
        </div>
      ) : null}

      <div className="p-4 md:p-5">
        {loading ? (
          <div className="flex min-h-20 items-center justify-center text-sm text-zinc-400">Carregando programação...</div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800 p-8 text-center">
            <LayoutList aria-hidden="true" className="mx-auto text-zinc-500" size={24} />
            <p className="mt-2 text-sm font-medium text-zinc-300">Nenhum conteúdo configurado.</p>
            <p className="mt-1 text-xs text-zinc-500">Adicione um item para montar a sequência exibida na TB50.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {items.map((item, index) => {
              const Icon = typeIcon(item.type);
              const sourcePlaceholder = item.type === 'scoreboard'
                ? 'Placar ao vivo (automático)'
                : item.type === 'youtube'
                  ? 'URL do YouTube (live ou vídeo)'
                  : item.type === 'image' || item.type === 'video'
                    ? 'URL ou caminho da mídia'
                    : 'URL da fonte';

              return (
                <article className={`rounded-lg border p-3 transition-colors md:p-4 ${item.enabled ? 'border-zinc-800 bg-zinc-950/20' : 'border-zinc-800/70 bg-zinc-950/10 opacity-65'}`} key={item.id}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-zinc-800/70 text-brand-400"><Icon aria-hidden="true" size={16} /></span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500">Item {index + 1}</p>
                        <p className="truncate text-sm font-medium text-zinc-200">{item.title || TYPE_OPTIONS.find((option) => option.value === item.type)?.label}</p>
                      </div>
                    </div>
                    <div className="telao-programacao-row-actions flex flex-none gap-1">
                      <Button aria-label="Subir item" className="h-8 w-8 px-0" disabled={index === 0} title="Subir" variant="ghost" onClick={() => move(item.id, -1)}>
                        <ChevronUp aria-hidden="true" size={15} />
                      </Button>
                      <Button aria-label="Descer item" className="h-8 w-8 px-0" disabled={index === items.length - 1} title="Descer" variant="ghost" onClick={() => move(item.id, 1)}>
                        <ChevronDown aria-hidden="true" size={15} />
                      </Button>
                      <Button aria-label="Remover item" className="h-8 w-8 px-0" title="Remover" variant="danger" onClick={() => remove(item.id)}>
                        <Trash2 aria-hidden="true" size={15} />
                      </Button>
                    </div>
                  </div>

                  <div className="telao-programacao-grid grid items-end gap-3 lg:grid-cols-[180px_minmax(150px,1fr)_minmax(220px,1.5fr)_88px_78px]">
                    <label className="grid gap-1.5 text-xs font-medium text-zinc-400">
                      Tipo
                      <select aria-label="Tipo de conteúdo" className={fieldClass} value={item.type} onChange={(event) => patch(item.id, { type: event.target.value as TelaoPlaylistItemType })}>
                        {TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <label className="grid gap-1.5 text-xs font-medium text-zinc-400">
                      Título
                      <input aria-label="Título do conteúdo" className={fieldClass} placeholder="Identificação" value={item.title || ''} onChange={(event) => patch(item.id, { title: event.target.value })} />
                    </label>
                    <label className="grid gap-1.5 text-xs font-medium text-zinc-400 lg:min-w-0">
                      Fonte
                      <input aria-label="Fonte do conteúdo" className={fieldClass} disabled={item.type === 'scoreboard'} placeholder={sourcePlaceholder} value={item.source} onChange={(event) => patch(item.id, { source: event.target.value })} />
                    </label>
                    <label className="grid gap-1.5 text-xs font-medium text-zinc-400">
                      Duração (s)
                      <input aria-label="Duração em segundos" className={fieldClass} type="number" min={1} value={item.durationSec} onChange={(event) => patch(item.id, { durationSec: Number(event.target.value) })} />
                    </label>
                    <label className="grid gap-1.5 text-xs font-medium text-zinc-400">
                      Repetições
                      <input aria-label="Quantidade de repetições" className={fieldClass} type="number" min={1} value={item.repeat} onChange={(event) => patch(item.id, { repeat: Number(event.target.value) })} />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 border-t border-zinc-800 pt-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 px-3 text-xs font-medium text-zinc-300">
                        <input aria-label="Ativar conteúdo" className="h-4 w-4 accent-brand-500" type="checkbox" checked={item.enabled} onChange={(event) => patch(item.id, { enabled: event.target.checked })} />
                        Ativo
                      </label>
                      {(item.type === 'image' || item.type === 'video') ? (
                        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 px-3 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800/70 hover:text-zinc-100">
                          <ImagePlus aria-hidden="true" size={15} />
                          Upload
                          <input className="sr-only" type="file" accept={item.type === 'image' ? 'image/*' : 'video/*'} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMedia(item.id, file); }} />
                        </label>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Clock3 aria-hidden="true" className="text-zinc-500" size={15} />
                      <span className="text-xs font-medium text-zinc-500">Janela</span>
                      <input aria-label="Início da janela" className={compactFieldClass} type="time" value={item.schedule?.startTime || ''} onChange={(event) => patchSchedule(item.id, { startTime: event.target.value })} />
                      <span className="text-zinc-500">até</span>
                      <input aria-label="Fim da janela" className={compactFieldClass} type="time" value={item.schedule?.endTime || ''} onChange={(event) => patchSchedule(item.id, { endTime: event.target.value })} />
                      <div className="flex flex-wrap gap-1" aria-label="Dias da semana">
                        {WEEKDAYS.map((day, dayIndex) => {
                          const active = item.schedule?.weekdays?.includes(dayIndex) === true;
                          return (
                            <button
                              aria-pressed={active}
                              className={`h-8 min-w-8 rounded-md border px-1.5 text-[11px] font-semibold transition-colors ${active ? 'border-brand-500/50 bg-brand-500/15 text-brand-300' : 'border-zinc-800 text-zinc-500 hover:bg-zinc-800/70 hover:text-zinc-300'}`}
                              key={dayIndex}
                              type="button"
                              onClick={() => toggleWeekday(item.id, dayIndex)}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-zinc-500">
          <Clock3 aria-hidden="true" className="mt-0.5 flex-none" size={14} />
          Sem horário definido, o conteúdo toca sempre. Upload de mídia usa o agente local (.250); fontes externas dependem de autorização e conexão.
        </p>
      </div>
    </section>
  );
}
