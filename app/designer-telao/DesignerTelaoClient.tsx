'use client';

import { useEffect, useMemo, useState } from 'react';
import { createDemoSnapshot } from '@/lib/livetime/demo-data';
import { DEFAULT_TELAO_LAYOUT, normalizeTelaoLayoutConfig, TELAO_LAYOUT_PRESETS, type TelaoField, type TelaoLayoutConfig } from '@/lib/telao-layout-config';
import { LiveTimingTable } from '@/components/telao/LiveTimingTable';
import '@/components/telao/telao.css';
import './designer.css';

const FIELDS: Array<{ id: TelaoField; label: string }> = [
  { id: 'position', label: 'Posicao' },
  { id: 'kart', label: 'Kart' },
  { id: 'name', label: 'Nome' },
  { id: 'time', label: 'Tempo' },
];

const demoSnapshot = createDemoSnapshot('Preview do designer');

function updateLayout(layout: TelaoLayoutConfig, patch: Partial<TelaoLayoutConfig>): TelaoLayoutConfig {
  return normalizeTelaoLayoutConfig({ ...layout, ...patch });
}

function numberInput(label: string, value: number, min: number, max: number, onChange: (value: number) => void) {
  return (
    <label className="designer-field">
      <span>{label}</span>
      <input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

export function DesignerTelaoClient() {
  const [layout, setLayout] = useState<TelaoLayoutConfig>(DEFAULT_TELAO_LAYOUT);
  const [message, setMessage] = useState('Carregando configuracao...');
  const previewRows = useMemo(() => demoSnapshot.drivers.slice(0, layout.columns * layout.rows), [layout.columns, layout.rows]);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/telao-layout?_ts=${Date.now()}`, { cache: 'no-store' });
        const data = await response.json();
        setLayout(normalizeTelaoLayoutConfig(data.layout));
        setMessage('Configuracao atual carregada');
      } catch {
        setMessage('Usando configuracao padrao');
      }
    }

    void load();
  }, []);

  async function save() {
    setMessage('Salvando...');
    const response = await fetch('/api/telao-layout', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(layout),
    });
    const data = await response.json();
    setLayout(normalizeTelaoLayoutConfig(data.layout));
    setMessage('Configuracao enviada para o servidor');
  }

  function toggleField(field: TelaoField) {
    const fields = layout.fields.includes(field) ? layout.fields.filter((item) => item !== field) : [...layout.fields, field];
    setLayout(updateLayout(layout, { fields }));
  }

  return (
    <main className="designer-page">
      <section className="designer-sidebar">
        <div>
          <h1>Designer do Telao</h1>
          <p>Resolucao fixa: 2048 x 512</p>
        </div>

        <div className="designer-section">
          <h2>Presets</h2>
          <div className="designer-preset-grid">
            {Object.values(TELAO_LAYOUT_PRESETS).map((preset) => (
              <button key={preset.id} type="button" onClick={() => setLayout(preset)}>
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="designer-section">
          <h2>Layout</h2>
          <label className="designer-field">
            <span>Tipo</span>
            <select value={layout.variant} onChange={(event) => setLayout(updateLayout(layout, { variant: event.target.value as TelaoLayoutConfig['variant'] }))}>
              <option value="table">Tabela com grupos</option>
              <option value="cards">Cards grandes</option>
            </select>
          </label>
          {numberInput('Colunas', layout.columns, 1, 10, (columns) => setLayout(updateLayout(layout, { columns })))}
          {numberInput('Linhas', layout.rows, 1, 10, (rows) => setLayout(updateLayout(layout, { rows })))}
          {numberInput('Espaco', layout.cellGap, 0, 18, (cellGap) => setLayout(updateLayout(layout, { cellGap })))}
          {numberInput('Borda', layout.borderWidth, 0, 6, (borderWidth) => setLayout(updateLayout(layout, { borderWidth })))}
          <label className="designer-check">
            <input type="checkbox" checked={layout.showHeader} onChange={(event) => setLayout(updateLayout(layout, { showHeader: event.target.checked }))} />
            Mostrar cabecalho com logo
          </label>
        </div>

        <div className="designer-section">
          <h2>Campos</h2>
          <div className="designer-check-grid">
            {FIELDS.map((field) => (
              <label key={field.id} className="designer-check">
                <input type="checkbox" checked={layout.fields.includes(field.id)} onChange={() => toggleField(field.id)} />
                {field.label}
              </label>
            ))}
          </div>
          <label className="designer-field">
            <span>Nome</span>
            <select value={layout.nameMode} onChange={(event) => setLayout(updateLayout(layout, { nameMode: event.target.value as TelaoLayoutConfig['nameMode'] }))}>
              <option value="hidden">Nao mostrar</option>
              <option value="first">Primeiro nome</option>
              <option value="full">Nome completo</option>
            </select>
          </label>
        </div>

        <div className="designer-section">
          <h2>Letras</h2>
          {numberInput('Posicao', layout.positionFontSize, 10, 80, (positionFontSize) => setLayout(updateLayout(layout, { positionFontSize })))}
          {numberInput('Kart', layout.kartFontSize, 10, 90, (kartFontSize) => setLayout(updateLayout(layout, { kartFontSize })))}
          {numberInput('Nome', layout.nameFontSize, 10, 80, (nameFontSize) => setLayout(updateLayout(layout, { nameFontSize })))}
          {numberInput('Tempo', layout.timeFontSize, 10, 80, (timeFontSize) => setLayout(updateLayout(layout, { timeFontSize })))}
          {numberInput('Cabecalho', layout.headerFontSize, 10, 48, (headerFontSize) => setLayout(updateLayout(layout, { headerFontSize })))}
        </div>

        <button className="designer-save" type="button" onClick={save}>
          Enviar para o servidor
        </button>
        <p className="designer-message">{message}</p>
      </section>

      <section className="designer-preview-area">
        <div className="designer-preview-label">
          <strong>{layout.label}</strong>
          <span>
            {layout.columns} x {layout.rows} / {layout.columns * layout.rows} pilotos
          </span>
        </div>
        <div className={`designer-preview-shell ${layout.showHeader ? '' : 'designer-preview-no-header'}`}>
          <div className="designer-preview-scale">
            <div className={`telao-page telao-theme-dark ${layout.showHeader ? '' : 'telao-no-header'}`}>
              {layout.showHeader ? (
                <header className="telao-status">
                  <div className="telao-brand" aria-label="Kartodromo de Betim">
                    <img className="telao-logo" src="/brand/kartodromo-betim-logo.png" alt="Kartodromo Internacional de Betim" />
                  </div>
                  <div className="telao-track">
                    <span>PREVIEW DO DESIGNER</span>
                    <strong>TELAO LED 2048X512</strong>
                  </div>
                  <div className="telao-race-state">
                    <div className="telao-badge telao-badge-demo">DEMO</div>
                    <div className="telao-updated">00:00:00</div>
                  </div>
                </header>
              ) : null}
              <section className="telao-table-wrap">
                <LiveTimingTable drivers={previewRows} layout={layout} />
              </section>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
