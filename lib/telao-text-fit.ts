const TB50_CONTENT_WIDTH = 2024;
const CARD_HORIZONTAL_PADDING = 16;
const CARD_TEXT_SAFETY = 10;
const FONT_MEASUREMENT_SAFETY = 1.18;

function glyphWeight(char: string): number {
  if (char === ' ') return 0.34;
  if ('.,:;|!/\\'.includes(char)) return 0.28;
  if ('1Iijl'.includes(char)) return 0.36;
  if ('MW@#%&'.includes(char)) return 0.96;
  if ('ABCDEFGHKNOPQRSTUVXYZ'.includes(char)) return 0.72;
  if ('234567890'.includes(char)) return 0.62;
  return 0.66;
}

export function estimateUppercaseTextUnits(value: string): number {
  const text = value.trim().toUpperCase();
  if (!text) return 1;
  return Array.from(text).reduce((sum, char) => sum + glyphWeight(char), 0);
}

export function fitCardNameFontSize({
  text,
  desiredFontSize,
  columns,
  cellGap,
  borderWidth,
  lineWidth = 1,
  minFontSize = 16,
}: {
  text: string;
  desiredFontSize: number;
  columns: number;
  cellGap: number;
  borderWidth: number;
  lineWidth?: number;
  minFontSize?: number;
}): number {
  const safeColumns = Math.max(1, columns);
  const totalGap = Math.max(0, safeColumns - 1) * Math.max(0, cellGap);
  const gridInnerWidth = TB50_CONTENT_WIDTH - Math.max(0, borderWidth) * 2 - totalGap;
  const cardTextWidth = Math.max(24, gridInnerWidth / safeColumns - Math.max(0, lineWidth) - CARD_HORIZONTAL_PADDING - CARD_TEXT_SAFETY);
  const fittedFontSize = Math.floor(cardTextWidth / (estimateUppercaseTextUnits(text) * FONT_MEASUREMENT_SAFETY));

  return Math.max(minFontSize, Math.min(desiredFontSize, fittedFontSize));
}
