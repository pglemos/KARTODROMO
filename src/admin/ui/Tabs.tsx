import { useRef, type KeyboardEvent } from 'react';

export type TabItem = { key: string; label: string };

type TabsProps = {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
  ariaLabel?: string;
};

export const Tabs = ({ ariaLabel = 'Seções', items, onChange, value }: TabsProps) => {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? (index - 1 + items.length) % items.length
          : (index + 1) % items.length;
    const next = items[nextIndex];
    if (!next) return;
    onChange(next.key);
    refs.current[nextIndex]?.focus();
  }

  return (
    <div aria-label={ariaLabel} className="admin-tabs inline-flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1" role="tablist">
      {items.map((item, index) => {
        const selected = value === item.key;
        const tabId = `admin-tab-${item.key}`;
        return (
          <button
            aria-selected={selected}
            className={[
              'admin-tab h-9 rounded-md px-3 text-sm font-semibold transition-colors',
              selected ? 'admin-tab-active' : 'admin-tab-inactive',
            ].join(' ')}
            id={tabId}
            key={item.key}
            onClick={() => onChange(item.key)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            ref={(element) => { refs.current[index] = element; }}
            role="tab"
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};
