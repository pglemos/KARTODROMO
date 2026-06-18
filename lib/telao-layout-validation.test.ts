import { describe, expect, it } from 'vitest';
import type { LiveTimingSnapshot } from '@/lib/livetime/types';
import { DEFAULT_TELAO_LAYOUT, TELAO_LAYOUT_PRESETS } from '@/lib/telao-layout-config';
import { hiddenRealDataFields, payloadMatchesTelaoLayout } from '@/lib/telao-layout-validation';

const snapshot: LiveTimingSnapshot = {
  status: 'live',
  source: 'dom-scraper',
  updatedAt: '2026-05-12T18:00:00.000Z',
  drivers: [
    { position: 1, kart: '109', name: 'COMPETIDOR 109', time: '01:05.661' },
    { position: 2, kart: '111', name: 'COMPETIDOR 111', time: '+01:05.604' },
  ],
};

describe('telao layout validation', () => {
  it('reports real data hidden by the saved layout', () => {
    expect(hiddenRealDataFields(snapshot, DEFAULT_TELAO_LAYOUT)).toEqual(['name', 'time']);
  });

  it('does not report hidden data when the layout shows all live fields', () => {
    expect(hiddenRealDataFields(snapshot, TELAO_LAYOUT_PRESETS['tb50-live-21'])).toEqual([]);
  });

  it('matches a rendered payload against the visible designer layout fields', () => {
    const layout = DEFAULT_TELAO_LAYOUT;
    const payload = {
      css: 'grid-template-columns:repeat(10,minmax(0,1fr))',
      content: '<div class="cards"><span class="position">1</span><span class="kart">109</span></div>',
    };

    expect(payloadMatchesTelaoLayout(payload, layout)).toBe(true);
  });

  it('rejects payloads that render fields hidden by the designer layout', () => {
    const layout = DEFAULT_TELAO_LAYOUT;
    const payload = {
      css: 'grid-template-columns:repeat(10,minmax(0,1fr))',
      content: '<div class="cards"><span class="position">1</span><span class="kart">109</span><span class="time">01:05.661</span></div>',
    };

    expect(payloadMatchesTelaoLayout(payload, layout)).toBe(false);
  });
});

