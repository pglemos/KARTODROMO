import type { LiveTimingSnapshot } from '@/lib/livetime/types';
import type { TelaoField, TelaoLayoutConfig } from '@/lib/telao-layout-config';

const ALL_FIELDS: TelaoField[] = ['position', 'kart', 'name', 'time'];

export function visibleTelaoFields(layout: TelaoLayoutConfig): TelaoField[] {
  return layout.fields.filter((field) => field !== 'name' || layout.nameMode !== 'hidden');
}

function fieldClassExists(content: string, field: TelaoField): boolean {
  return new RegExp(`class="[^"]*\\b${field}\\b`).test(content);
}

export function payloadMatchesTelaoLayout(payload: unknown, layout: TelaoLayoutConfig): boolean {
  const data = payload && typeof payload === 'object' ? (payload as { content?: unknown; css?: unknown }) : {};
  const content = typeof data.content === 'string' ? data.content : '';
  const css = typeof data.css === 'string' ? data.css : '';
  const fields = visibleTelaoFields(layout);
  const hiddenFields = ALL_FIELDS.filter((field) => !fields.includes(field));
  const variantMatches =
    layout.variant === 'cards'
      ? content.includes('class="cards"') && css.includes(`grid-template-columns:repeat(${layout.columns},minmax(0,1fr))`)
      : content.includes('<table');

  return variantMatches && fields.every((field) => fieldClassExists(content, field)) && hiddenFields.every((field) => !fieldClassExists(content, field));
}

export function hiddenRealDataFields(snapshot: LiveTimingSnapshot | null | undefined, layout: TelaoLayoutConfig): TelaoField[] {
  if (!snapshot?.drivers?.length) return [];

  const visibleFields = visibleTelaoFields(layout);
  const hiddenFields = ALL_FIELDS.filter((field) => !visibleFields.includes(field));

  return hiddenFields.filter((field) => {
    if (field === 'position') return snapshot.drivers.some((driver) => driver.position > 0);
    if (field === 'kart') return snapshot.drivers.some((driver) => driver.kart.trim().length > 0);
    if (field === 'name') return snapshot.drivers.some((driver) => driver.name.trim().length > 0);
    return snapshot.drivers.some((driver) => driver.time.trim().length > 0);
  });
}

