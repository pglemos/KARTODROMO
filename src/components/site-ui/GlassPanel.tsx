const GlassPanel = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  return (
    <div
      className={`relative overflow-hidden border border-white/15 bg-gradient-to-b from-ink-700/95 to-ink-900/95 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gradient-to-r before:from-primary-400 before:to-transparent ${className}`}
    >
      {children}
    </div>
  );
};

export default GlassPanel;
