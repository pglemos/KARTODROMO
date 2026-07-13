export function getCountUpValue(elapsedMs: number, durationMs: number, target: number): number {
  if (durationMs <= 0) {
    return target;
  }

  const progress = Math.min(Math.max(elapsedMs / durationMs, 0), 1);
  const eased = 1 - Math.pow(1 - progress, 3);

  return Math.round(target * eased);
}
