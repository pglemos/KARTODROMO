export type OfficialDay = {
  day: number;
  weekday: string;
  monthIndex: number;
  year: number;
  selected: boolean;
};

const monthAbbreviations: Record<string, number> = {
  jan: 0,
  fev: 1,
  mar: 2,
  abr: 3,
  mai: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  set: 8,
  out: 9,
  nov: 10,
  dez: 11,
};

const normalizeText = (value: string | null | undefined) =>
  value?.replace(/\s+/g, ' ').trim() ?? '';

const parseMonthRange = (label: string) => {
  const normalized = label.toLowerCase();
  const firstMonth = Object.entries(monthAbbreviations).find(([name]) => normalized.includes(name));
  const yearMatch = normalized.match(/\b(20\d{2})\b/);
  const now = new Date();

  return {
    monthIndex: firstMonth ? firstMonth[1] : now.getMonth(),
    year: yearMatch ? Number(yearMatch[1]) : now.getFullYear(),
  };
};

const officialDayKey = (day: OfficialDay) => `${day.year}-${day.monthIndex}-${day.day}`;

export const mergeOfficialDays = (currentDays: OfficialDay[], incomingDays: OfficialDay[]): OfficialDay[] => {
  const mergedDays = new Map(currentDays.map((day) => [officialDayKey(day), day]));

  incomingDays.forEach((day) => {
    mergedDays.set(officialDayKey(day), day);
  });

  return Array.from(mergedDays.values()).sort((first, second) => (
    new Date(first.year, first.monthIndex, first.day).getTime()
    - new Date(second.year, second.monthIndex, second.day).getTime()
  ));
};

export const getOfficialDayTime = (day: Pick<OfficialDay, 'day' | 'monthIndex' | 'year'>) => (
  new Date(day.year, day.monthIndex, day.day).getTime()
);

export const readOfficialDays = (doc: Document): OfficialDay[] => {
  const rangeLabel = normalizeText(doc.querySelector('.cal-month-label')?.textContent);
  const { monthIndex: rangeMonthIndex, year: rangeYear } = parseMonthRange(rangeLabel);
  const stripDays = Array.from(doc.querySelectorAll<HTMLElement>('.cal-strip-day'));
  let currentMonthIndex = rangeMonthIndex;
  let currentYear = rangeYear;
  let previousDay = 0;

  return stripDays
    .map((dayElement) => {
      const day = Number(normalizeText(dayElement.querySelector('.cal-strip-number')?.textContent));
      const weekday = normalizeText(dayElement.querySelector('.cal-strip-weekday')?.textContent);

      if (!Number.isFinite(day) || day <= 0) {
        return null;
      }

      if (previousDay > 0 && day < previousDay) {
        currentMonthIndex += 1;
        if (currentMonthIndex > 11) {
          currentMonthIndex = 0;
          currentYear += 1;
        }
      }
      previousDay = day;

      return {
        day,
        weekday,
        monthIndex: currentMonthIndex,
        year: currentYear,
        selected: dayElement.classList.contains('cal-selected'),
      };
    })
    .filter((day): day is OfficialDay => day !== null);
};
