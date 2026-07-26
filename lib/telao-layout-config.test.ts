import { describe, expect, it } from 'vitest';
import { DEFAULT_TELAO_LAYOUT, TELAO_LAYOUT_PRESETS, normalizeTelaoLayoutConfig } from '@/lib/telao-layout-config';

describe('telao layout config', () => {
  it('uses the 20-driver position and kart card layout as the default', () => {
    expect(DEFAULT_TELAO_LAYOUT).toMatchObject({
      id: 'cards-padrao-time',
      label: 'Modelo 20 Pilotos - posição e kart',
      variant: 'cards',
      columns: 10,
      rows: 2,
      fields: ['position', 'kart'],
      nameMode: 'hidden',
      showHeader: false,
      positionFontSize: 80,
      kartFontSize: 90,
      nameFontSize: 0,
      timeFontSize: 0,
      borderWidth: 3,
      lineWidth: 8,
    });
  });

  it('keeps the standard preset and zero-sized hidden fields during normalization', () => {
    const layout = normalizeTelaoLayoutConfig(TELAO_LAYOUT_PRESETS['cards-padrao-time']);

    expect(layout.id).toBe('cards-padrao-time');
    expect(layout.nameFontSize).toBe(0);
    expect(layout.timeFontSize).toBe(0);
    expect(layout.colors.bottomCell).toBe('#101010');
  });

  it('allows position and kart font sizes up to 250px during normalization', () => {
    const layout = normalizeTelaoLayoutConfig({
      ...DEFAULT_TELAO_LAYOUT,
      positionFontSize: 250,
      kartFontSize: 250,
    });

    expect(layout.positionFontSize).toBe(250);
    expect(layout.kartFontSize).toBe(250);
  });

  it('clamps position and kart font sizes above 250px', () => {
    const layout = normalizeTelaoLayoutConfig({
      ...DEFAULT_TELAO_LAYOUT,
      positionFontSize: 300,
      kartFontSize: 999,
    });

    expect(layout.positionFontSize).toBe(250);
    expect(layout.kartFontSize).toBe(250);
  });
});
