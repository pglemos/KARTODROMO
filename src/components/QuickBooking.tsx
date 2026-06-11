import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MYLAPTIME_BOOKING_PROXY_URL } from '../config/booking';

type QuickBookingProps = {
  surface?: 'home' | 'page';
};

type OfficialDay = {
  day: number;
  weekday: string;
  selected: boolean;
  today: boolean;
};

type BookingSlot = {
  time: string;
  name: string;
  weekday: string;
  vacancies: string;
  price: string;
  available: boolean;
};

type BookingState = {
  monthLabel: string;
  monthIndex: number;
  year: number;
  selectedDay: number | null;
  days: OfficialDay[];
  slots: BookingSlot[];
  loaded: boolean;
};

type CalendarCell = {
  key: string;
  day: number | null;
  iso: string | null;
};

const monthNames = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const weekLabels = ['do', '2ª', '3ª', '4ª', '5ª', '6ª', 'sá'];

const parseMonthLabel = (label: string) => {
  const normalizedLabel = label.trim().toLowerCase();
  const monthIndex = monthNames.findIndex((month) => normalizedLabel.includes(month));
  const yearMatch = normalizedLabel.match(/\b(20\d{2})\b/);

  return {
    monthIndex: monthIndex >= 0 ? monthIndex : new Date().getMonth(),
    year: yearMatch ? Number(yearMatch[1]) : new Date().getFullYear(),
  };
};

const formatIsoDate = (year: number, monthIndex: number, day: number) =>
  `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const buildCalendarCells = (year: number, monthIndex: number): CalendarCell[] => {
  const firstWeekDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: CalendarCell[] = [];

  for (let index = 0; index < firstWeekDay; index += 1) {
    cells.push({ key: `blank-${index}`, day: null, iso: null });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      key: formatIsoDate(year, monthIndex, day),
      day,
      iso: formatIsoDate(year, monthIndex, day),
    });
  }

  return cells;
};

const emptyBookingState = (): BookingState => {
  const now = new Date();

  return {
    monthLabel: `${monthNames[now.getMonth()]} ${now.getFullYear()}`,
    monthIndex: now.getMonth(),
    year: now.getFullYear(),
    selectedDay: null,
    days: [],
    slots: [],
    loaded: false,
  };
};

const normalizeText = (value: string | null | undefined) =>
  value?.replace(/\s+/g, ' ').trim() ?? '';

const QuickBooking = ({ surface = 'home' }: QuickBookingProps) => {
  const HeadingTag = surface === 'page' ? 'h1' : 'h2';
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [bookingState, setBookingState] = useState<BookingState>(() => emptyBookingState());
  const [officialFlowOpen, setOfficialFlowOpen] = useState(false);
  const [reservingTime, setReservingTime] = useState<string | null>(null);

  const availableDays = useMemo(
    () => new Set(bookingState.days.map((day) => day.day)),
    [bookingState.days],
  );

  const calendarCells = useMemo(
    () => buildCalendarCells(bookingState.year, bookingState.monthIndex),
    [bookingState.monthIndex, bookingState.year],
  );

  const keepBookingAnchored = useCallback(() => {
    if (surface === 'home' && window.location.hash !== '#agendamento') {
      return;
    }

    const target = document.getElementById('agendamento');
    if (!target) {
      return;
    }

    const frame = iframeRef.current;
    if (frame && document.activeElement === frame) {
      frame.blur();
      window.focus();
    }

    const top = target.getBoundingClientRect().top + window.scrollY - 92;
    window.scrollTo({ top: Math.max(top, 0), behavior: 'auto' });
  }, [surface]);

  const readOfficialBookingState = useCallback(() => {
    if (officialFlowOpen) {
      return;
    }

    const frame = iframeRef.current;
    const doc = frame?.contentDocument;
    if (!doc?.body) {
      return;
    }

    const monthLabel = normalizeText(doc.querySelector('.cal-month-label')?.textContent);
    const { monthIndex, year } = parseMonthLabel(monthLabel);
    const days = Array.from(doc.querySelectorAll<HTMLElement>('.cal-strip-day'))
      .map((dayElement) => {
        const day = Number(normalizeText(dayElement.querySelector('.cal-strip-number')?.textContent));
        const weekday = normalizeText(dayElement.querySelector('.cal-strip-weekday')?.textContent);

        if (!Number.isFinite(day)) {
          return null;
        }

        return {
          day,
          weekday,
          selected: dayElement.classList.contains('cal-selected'),
          today: dayElement.classList.contains('cal-today'),
        };
      })
      .filter((day): day is OfficialDay => day !== null);

    const slots = Array.from(doc.querySelectorAll<HTMLElement>('.bk-card')).map((slotElement) => {
      const vacanciesText = normalizeText(slotElement.querySelector('.bk-badge-vacancies')?.textContent)
        .replace(/^group\s*/i, '');
      const price = normalizeText(slotElement.querySelector('.bk-badge-price')?.textContent);
      const addButton = slotElement.querySelector<HTMLButtonElement>('.bk-qty-plus');

      return {
        time: normalizeText(slotElement.querySelector('.bk-time')?.textContent),
        weekday: normalizeText(slotElement.querySelector('.bk-day')?.textContent),
        name: normalizeText(slotElement.querySelector('.bk-name-text')?.textContent),
        vacancies: vacanciesText || 'Indisponível',
        price: price || 'Consultar',
        available: Boolean(addButton && !addButton.disabled),
      };
    });

    if (!monthLabel || days.length === 0) {
      return;
    }

    setBookingState({
      monthLabel,
      monthIndex,
      year,
      selectedDay: days.find((day) => day.selected)?.day ?? days[0]?.day ?? null,
      days,
      slots,
      loaded: true,
    });
  }, [officialFlowOpen]);

  const clickOfficialDay = useCallback((day: number) => {
    const doc = iframeRef.current?.contentDocument;
    const dayElement = Array.from(doc?.querySelectorAll<HTMLElement>('.cal-strip-day') ?? [])
      .find((element) => normalizeText(element.querySelector('.cal-strip-number')?.textContent) === String(day));

    if (!dayElement) {
      return;
    }

    dayElement.click();
    window.setTimeout(readOfficialBookingState, 700);
    window.setTimeout(readOfficialBookingState, 1600);
  }, [readOfficialBookingState]);

  const navigateOfficialCalendar = useCallback((direction: 'previous' | 'next') => {
    const doc = iframeRef.current?.contentDocument;
    const buttons = Array.from(doc?.querySelectorAll<HTMLButtonElement>('.cal-nav-btn') ?? []);
    const button = direction === 'previous' ? buttons[0] : buttons[1];

    if (!button || button.disabled) {
      return;
    }

    button.click();
    window.setTimeout(readOfficialBookingState, 900);
    window.setTimeout(readOfficialBookingState, 1800);
  }, [readOfficialBookingState]);

  const reserveSlot = useCallback((slot: BookingSlot) => {
    const doc = iframeRef.current?.contentDocument;
    const slotElement = Array.from(doc?.querySelectorAll<HTMLElement>('.bk-card') ?? [])
      .find((element) => normalizeText(element.querySelector('.bk-time')?.textContent) === slot.time);
    const button = slotElement?.querySelector<HTMLButtonElement>('.bk-qty-plus');

    if (!button || button.disabled) {
      window.open(MYLAPTIME_BOOKING_PROXY_URL, '_blank', 'noopener,noreferrer');
      return;
    }

    setReservingTime(slot.time);
    button.click();

    window.setTimeout(() => {
      setOfficialFlowOpen(true);
      setReservingTime(null);
    }, 1000);
  }, []);

  useEffect(() => {
    if (surface === 'home' && window.location.hash !== '#agendamento') {
      return undefined;
    }

    const timeouts = [0, 300, 900, 1800, 3500, 7000, 11000, 16000].map((delay) =>
      window.setTimeout(keepBookingAnchored, delay),
    );
    const interval = window.setInterval(keepBookingAnchored, 400);
    const stopInterval = window.setTimeout(() => window.clearInterval(interval), 18000);

    return () => {
      timeouts.forEach(window.clearTimeout);
      window.clearInterval(interval);
      window.clearTimeout(stopInterval);
    };
  }, [keepBookingAnchored, surface]);

  useEffect(() => {
    const interval = window.setInterval(readOfficialBookingState, 900);
    const stopPolling = window.setTimeout(() => window.clearInterval(interval), 25000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(stopPolling);
    };
  }, [readOfficialBookingState]);

  useEffect(() => {
    if (!officialFlowOpen) {
      return;
    }

    window.setTimeout(keepBookingAnchored, 120);
    window.setTimeout(keepBookingAnchored, 900);
  }, [keepBookingAnchored, officialFlowOpen]);

  return (
    <section
      id="agendamento"
      className="scroll-mt-28 border-t border-zinc-200/60 bg-white py-24 md:scroll-mt-24"
    >
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-7xl text-center">
          <HeadingTag className="text-3xl font-black uppercase tracking-tight text-zinc-950 md:text-5xl">
            Consulte e <span className="text-primary-600">agende seu horário</span>
          </HeadingTag>
          <div className="mx-auto mt-4 h-1.5 w-20 rounded-full bg-primary-500" />

          <div aria-hidden="true" className="mx-auto mt-7 grid w-11 grid-cols-3 gap-1 opacity-90">
            {Array.from({ length: 6 }, (_, index) => (
              <span
                key={index}
                className={`h-3 w-3 rotate-6 rounded-[1px] ${
                  index % 2 === 0 ? 'bg-primary-500' : 'bg-yellow-500'
                }`}
              />
            ))}
          </div>

          <p className="mx-auto mt-9 max-w-5xl text-center text-lg font-light leading-relaxed text-zinc-600 md:text-xl">
            Peça seu <strong className="font-extrabold">cartão fidelidade</strong> e faça um carimbo na secretaria em toda bateria que correr, a cada 10 corridas 1 é por nossa conta, basta trocar seu cartão fidelidade com 10 carimbos por 1 corrida totalmente de graça. (O cartão fidelidade é pessoal e intransferível).
          </p>

          <p className="mt-9 text-center text-xl font-semibold leading-tight text-zinc-800 md:text-2xl">
            <span className="font-black text-primary-600">Reserve agora</span> e pague <span className="font-black text-primary-600">somente na data</span> da sua corrida!
          </p>

          <div className="relative mx-auto mt-12 max-w-[1316px] rounded-2xl border border-zinc-200 bg-zinc-50 px-4 pb-16 pt-12 shadow-sm md:min-h-[900px] md:px-24 md:pb-24 md:pt-16">
            {!officialFlowOpen && (
              <>
                <div className="mx-auto mb-8 w-full max-w-[23rem] rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
                  <div className="mb-5 flex items-center justify-between">
                    <button
                      type="button"
                      aria-label="Mês anterior"
                      onClick={() => navigateOfficialCalendar('previous')}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 text-zinc-400 transition-colors hover:border-primary-500/40 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-30"
                      disabled={!bookingState.loaded}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <strong className="text-xl font-black lowercase text-zinc-900">
                      {bookingState.monthLabel}
                    </strong>
                    <button
                      type="button"
                      aria-label="Próximo mês"
                      onClick={() => navigateOfficialCalendar('next')}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 text-zinc-400 transition-colors hover:border-primary-500/40 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-30"
                      disabled={!bookingState.loaded}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 text-xs font-bold lowercase text-zinc-400">
                    {weekLabels.map((day) => (
                      <span key={day} className="py-2">{day}</span>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 overflow-hidden border-l border-t border-zinc-100 text-center">
                    {calendarCells.map((cell) => {
                      if (!cell.day) {
                        return <span key={cell.key} className="min-h-11 border-b border-r border-zinc-100" />;
                      }

                      const isEnabled = availableDays.has(cell.day);
                      const isSelected = cell.day === bookingState.selectedDay;
                      const officialDay = bookingState.days.find((day) => day.day === cell.day);

                      return (
                        <button
                          key={cell.key}
                          type="button"
                          aria-label={`Selecionar ${cell.iso}`}
                          onClick={() => clickOfficialDay(cell.day as number)}
                          disabled={!isEnabled}
                          className={`min-h-11 border-b border-r border-zinc-100 py-3 text-base font-semibold transition-colors ${
                            isSelected
                              ? 'bg-primary-500 text-white'
                              : isEnabled
                                ? 'text-zinc-700 hover:bg-primary-50 hover:text-primary-700'
                                : 'cursor-not-allowed text-zinc-200'
                          } ${officialDay?.today && !isSelected ? 'bg-zinc-50' : ''}`}
                        >
                          {cell.day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mx-auto max-w-5xl">
                  {!bookingState.loaded && (
                    <div className="space-y-2">
                      {Array.from({ length: 6 }, (_, index) => (
                        <div
                          key={index}
                          className="h-[46px] animate-pulse rounded-xl bg-white shadow-sm"
                        />
                      ))}
                    </div>
                  )}

                  {bookingState.loaded && bookingState.slots.length === 0 && (
                    <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-8 text-center text-sm font-semibold text-zinc-500 shadow-sm">
                      Nenhum horário disponível para esta data.
                    </div>
                  )}

                  {bookingState.loaded && bookingState.slots.length > 0 && (
                    <div className="space-y-2">
                      {bookingState.slots.map((slot) => (
                        <div
                          key={`${slot.time}-${slot.name}`}
                          className={`booking-slot-row grid min-h-[52px] grid-cols-1 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary-500/30 hover:shadow-md md:gap-3 md:py-0 ${
                            slot.available ? '' : 'opacity-45'
                          }`}
                        >
                          <strong className="text-[27px] font-black leading-none text-zinc-950 md:text-[28px]">
                            {slot.time}
                          </strong>
                          <span className="text-xs font-bold uppercase tracking-wide text-zinc-600 md:text-right">
                            {slot.name || `Bateria ${slot.time}`}
                          </span>
                          <span className="text-base font-black text-primary-600">
                            {slot.vacancies}
                          </span>
                          <span className="text-base font-black text-zinc-800">
                            {slot.price}
                          </span>
                          <button
                            type="button"
                            onClick={() => reserveSlot(slot)}
                            disabled={!slot.available || reservingTime === slot.time}
                            className="home-cta h-10 rounded-xl bg-primary-500 px-6 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
                          >
                            {reservingTime === slot.time ? 'Abrindo...' : 'Reservar'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {officialFlowOpen && (
              <div className="mx-auto max-w-6xl text-left">
                <button
                  type="button"
                  onClick={() => setOfficialFlowOpen(false)}
                  className="mb-4 inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-xs font-black uppercase tracking-wider text-zinc-600 transition-colors hover:border-primary-500/40 hover:text-primary-700"
                >
                  &lt; Voltar aos horários
                </button>
              </div>
            )}

            <div
              className={
                officialFlowOpen
                  ? 'mx-auto max-w-6xl overflow-hidden bg-white shadow-[0_14px_30px_rgba(0,0,0,0.14)]'
                  : 'pointer-events-none fixed -left-[200vw] top-0 h-[900px] w-[1280px] overflow-hidden opacity-0'
              }
            >
              <iframe
                ref={iframeRef}
                title="Agendamento oficial MyLapTime do Kartódromo de Betim"
                src={MYLAPTIME_BOOKING_PROXY_URL}
                onLoad={() => {
                  keepBookingAnchored();
                  window.setTimeout(readOfficialBookingState, 1200);
                  window.setTimeout(readOfficialBookingState, 3500);
                }}
                tabIndex={officialFlowOpen ? 0 : -1}
                aria-hidden={!officialFlowOpen}
                style={officialFlowOpen ? { height: 780 } : { height: 900, width: 1280 }}
                className={officialFlowOpen ? 'block w-full border-0 bg-white' : 'block border-0 bg-white'}
              />
            </div>

            <p className="mt-6 text-right text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-300">
              Powered by MyLapTime
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default QuickBooking;
