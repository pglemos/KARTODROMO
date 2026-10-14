import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { themes } from '../src/components/theme';

function luminance(hex: string) {
  const channels = hex.slice(1).match(/../g)!.map((value) => parseInt(value, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

it.each(['light', 'dark'] as const)('mantém contraste AA no tema %s', (appearance) => {
  const theme = themes[appearance];
  const pairs = [[theme.text, theme.background], [theme.muted, theme.background],
    [theme.muted, theme.surface], [theme.accent, theme.surface], [theme.onAccent, theme.accent],
    [theme.danger, theme.dangerSurface], [theme.warning, theme.warningSurface]];
  for (const [foreground, background] of pairs) {
    const a = luminance(foreground), b = luminance(background);
    expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5);
  }
});

it('preserva os bytes da logo e fotografia oficiais no aplicativo', () => {
  const root = resolve(__dirname, '../..');
  expect(readFileSync(resolve(root, 'mobile/assets/brand-logo.png'))).toEqual(readFileSync(resolve(root, 'public/brand/kib-logo.png')));
  expect(readFileSync(resolve(root, 'mobile/assets/betim-track.jpg'))).toEqual(readFileSync(resolve(root, 'public/posters/home-karting.jpg')));
});
