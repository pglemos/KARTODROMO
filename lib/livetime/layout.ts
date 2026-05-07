import type { LiveTimingDriver } from '@/lib/livetime/types';

export const GROUP_COUNT = 6;
export const ROW_COUNT = 5;
export const MAX_DRIVERS = GROUP_COUNT * ROW_COUNT;

export function getPositionForCell(rowIndex: number, groupIndex: number): number {
  return groupIndex * ROW_COUNT + rowIndex + 1;
}

export function driversByPosition(drivers: LiveTimingDriver[]): Map<number, LiveTimingDriver> {
  return new Map(drivers.slice(0, MAX_DRIVERS).map((driver) => [driver.position, driver]));
}
