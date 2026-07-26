export type TabItem = { key: string; label: string };

type TabsProps = {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
};

export const Tabs = ({ items, onChange, value }: TabsProps) => (
  <div className="inline-flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
    {items.map((item) => (
      <button
        key={item.key}
        className={[
          'h-8 rounded-md px-3 text-sm font-medium transition-colors',
          value === item.key
            ? 'bg-zinc-800 text-zinc-50 shadow-soft'
            : 'text-zinc-400 hover:text-zinc-200',
        ].join(' ')}
        onClick={() => onChange(item.key)}
        type="button"
      >
        {item.label}
      </button>
    ))}
  </div>
);
