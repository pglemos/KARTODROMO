type TickerProps = {
  items: string[];
};

const Ticker = ({ items }: TickerProps) => {
  const text = items.join(' • ');

  return (
    <div className="overflow-hidden bg-primary-400 py-5 text-ink-950" aria-hidden="true">
      <div className="flex w-max animate-[ticker_26s_linear_infinite] gap-6">
        <span className="whitespace-nowrap font-display text-[clamp(28px,4vw,60px)] italic uppercase leading-[0.75]">
          {text}
        </span>
        <span className="whitespace-nowrap font-display text-[clamp(28px,4vw,60px)] italic uppercase leading-[0.75]">
          {text}
        </span>
      </div>
    </div>
  );
};

export default Ticker;
