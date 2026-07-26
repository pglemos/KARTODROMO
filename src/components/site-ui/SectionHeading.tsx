type SectionHeadingProps = {
  eyebrow: string;
  title: React.ReactNode;
  align?: 'left' | 'center';
};

const SectionHeading = ({ eyebrow, title, align = 'left' }: SectionHeadingProps) => {
  return (
    <div className={align === 'center' ? 'text-center' : 'text-left'}>
      <p className="mb-4 font-race text-xs italic font-bold uppercase tracking-[0.17em] text-primary-400 after:ml-3 after:content-['///']">
        {eyebrow}
      </p>
      <h2 className="font-display text-[clamp(40px,6vw,80px)] italic uppercase leading-[0.8] tracking-tight text-white">
        {title}
      </h2>
    </div>
  );
};

export default SectionHeading;
