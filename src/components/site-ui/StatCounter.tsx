'use client';

import { useEffect, useRef, useState } from 'react';
import { getCountUpValue } from '../../../lib/animate-count';

type StatCounterProps = {
  target: number;
  label: string;
  suffix?: string;
  durationMs?: number;
};

const StatCounter = ({ target, label, suffix = '', durationMs = 1400 }: StatCounterProps) => {
  const [value, setValue] = useState(target);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setValue(target);
      return;
    }

    setValue(0);
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      setValue(getCountUpValue(elapsed, durationMs, target));

      if (elapsed < durationMs) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [target, durationMs]);

  return (
    <div className="border-r border-white/10 p-7 last:border-r-0">
      <strong className="block font-display text-[clamp(48px,5vw,78px)] italic leading-[0.8] text-primary-400">
        {value}
        {suffix}
      </strong>
      <span className="mt-2 block font-race text-xs italic uppercase tracking-wider text-white/60">{label}</span>
    </div>
  );
};

export default StatCounter;
