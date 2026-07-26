export type TrackVariantKey = 'normal' | 'invertido' | 'invertido-chicane';

export interface TrackLayout {
  id: string;
  number: number;
  variant: TrackVariantKey;
  variantLabel: string;
  label: string;
  url: string;
}

const trackNumbers = [1, 2, 3, 4, 5, 6, 9, 10, 11, 12];

const variants: Array<{ key: TrackVariantKey; suffix: string; label: string }> = [
  { key: 'normal', suffix: 'normal', label: 'Normal' },
  { key: 'invertido', suffix: 'invertido', label: 'Invertido' },
  { key: 'invertido-chicane', suffix: 'invertido-chicane', label: 'Invertido + Chicane' },
];

export const trackLayouts: TrackLayout[] = trackNumbers.flatMap((number) =>
  variants.map((variant) => ({
    id: `${number}-${variant.key}`,
    number,
    variant: variant.key,
    variantLabel: variant.label,
    label: `Traçado ${number} ${variant.label}`,
    url: `/track/tracados/tracado-${String(number).padStart(2, '0')}-${variant.suffix}.jpg`,
  })),
);
