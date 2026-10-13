export type TabItem = { key: string; label: string };

type TabsProps = {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
};

export const Tabs = ({ items, onChange, value }: TabsProps) => (
  <div className="inline-flex gap-1 rounded-lg border border-kib-borda bg-kib-superficie p-1">
    {items.map((item) => (
      <button
        key={item.key}
        className={[
          'h-8 rounded-md px-3 text-sm font-medium transition-colors',
          value === item.key
            ? 'bg-kib-campo text-kib-texto shadow-soft'
            : 'text-kib-texto-2 hover:text-kib-texto',
        ].join(' ')}
        onClick={() => onChange(item.key)}
        type="button"
      >
        {item.label}
      </button>
    ))}
  </div>
);
