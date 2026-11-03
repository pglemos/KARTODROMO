export function Selo({ classe, children }: { classe: string; children: string }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold ${classe}`}>{children}</span>;
}
