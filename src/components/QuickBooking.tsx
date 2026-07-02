import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getOfficialDayTime, readOfficialDays } from '@/lib/booking/official-days';
import { MYLAPTIME_BOOKING_PROXY_URL } from '../config/booking';

type QuickBookingProps = {
  surface?: 'home' | 'page';
};

type BookingSlot = {
  time: string;
  name: string;
  vacancies: string;
  price: string;
  available: boolean;
};

type BookingState = {
  monthLabel: string;
  monthIndex: number;
  year: number;
  selectedDay: number | null;
  slots: BookingSlot[];
  loaded: boolean;
  emptyMessage: string;
};

type CalendarCell = {
  key: string;
  day: number | null;
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

const SELECT_DATE_MESSAGE = 'Selecione uma data no calendário para ver os horários disponíveis.';

const capitalize = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

const monthLabelFor = (monthIndex: number, year: number) => `${capitalize(monthNames[monthIndex])} ${year}`;

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const emptyBookingState = (): BookingState => {
  const now = new Date();

  return {
    monthLabel: monthLabelFor(now.getMonth(), now.getFullYear()),
    monthIndex: now.getMonth(),
    year: now.getFullYear(),
    selectedDay: null,
    slots: [],
    loaded: false,
    emptyMessage: '',
  };
};

const normalizeText = (value: string | null | undefined) =>
  value?.replace(/\s+/g, ' ').trim() ?? '';

const isPastDate = (year: number, monthIndex: number, day: number) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return new Date(year, monthIndex, day).getTime() < startOfToday;
};

const buildCalendarCells = (year: number, monthIndex: number): CalendarCell[] => {
  const firstWeekDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: CalendarCell[] = [];

  for (let index = 0; index < firstWeekDay; index += 1) {
    cells.push({ key: `blank-${index}`, day: null });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ key: `${year}-${monthIndex}-${day}`, day });
  }

  return cells;
};

const QuickBooking = ({ surface = 'home' }: QuickBookingProps) => {
  const HeadingTag = surface === 'page' ? 'h1' : 'h2';
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // Enquanto true, o estado local espelha o que o widget oficial mostra (usado pelo polling de
  // "tempo real"). Vira false quando o cliente só navega o calendário localmente (sem pedir uma
  // data ainda) — assim o polling em segundo plano não sobrescreve o mês que ele escolheu ver.
  const trackWidgetRef = useRef(true);
  const isSeekingRef = useRef(false);
  const [bookingState, setBookingState] = useState<BookingState>(() => emptyBookingState());
  const [officialCheckoutOpen, setOfficialCheckoutOpen] = useState(false);
  const [bookingActionMessage, setBookingActionMessage] = useState('');
  const [reservingTime, setReservingTime] = useState<string | null>(null);

  const calendarCells = useMemo(
    () => buildCalendarCells(bookingState.year, bookingState.monthIndex),
    [bookingState.monthIndex, bookingState.year],
  );

  const cleanOfficialBookingFrame = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) {
      return;
    }

    doc.querySelectorAll('.adc-footer').forEach((element) => element.remove());

    if (!doc.getElementById('kib-booking-cleanup')) {
      const style = doc.createElement('style');
      style.id = 'kib-booking-cleanup';
      style.textContent = '.adc-footer{display:none!important}';
      doc.head?.appendChild(style);
    }
  }, []);

  const readOfficialBookingState = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) {
      return;
    }

    cleanOfficialBookingFrame();
    const days = readOfficialDays(doc);

    if (days.length === 0) {
      return;
    }

    const selected = days.find((day) => day.selected) ?? days[0];
    const monthIndex = selected.monthIndex;
    const year = selected.year;

    const slotCards = Array.from(doc.querySelectorAll<HTMLElement>('.bk-card'));
    const slots = slotCards.map((slotElement) => {
      const vacanciesText = normalizeText(slotElement.querySelector('.bk-badge-vacancies')?.textContent)
        .replace(/^group\s*/i, '');
      const price = normalizeText(slotElement.querySelector('.bk-badge-price')?.textContent);
      const addButton = slotElement.querySelector<HTMLButtonElement>('.bk-qty-plus, button:not([disabled])');

      return {
        time: normalizeText(slotElement.querySelector('.bk-time')?.textContent),
        name: normalizeText(slotElement.querySelector('.bk-name-text')?.textContent) || 'Kart Rental 25 min',
        vacancies: vacanciesText || 'Indisponível',
        price: price || 'Consultar',
        available: Boolean(addButton && !addButton.disabled),
      };
    }).filter((slot) => slot.time);

    setBookingState({
      monthLabel: monthLabelFor(monthIndex, year),
      monthIndex,
      year,
      selectedDay: selected?.day ?? null,
      slots,
      loaded: true,
      emptyMessage: normalizeText(doc.querySelector('.no-bookings')?.textContent) || 'Nenhum horário disponível para esta data.',
    });
  }, [cleanOfficialBookingFrame]);

  // O calendario desta pagina deve deixar o cliente navegar por qualquer mes e escolher qualquer
  // data futura, mesmo sem saber de antemao se tem bateria/vaga — o widget oficial e' quem decide
  // isso ao carregar aquela data. Por isso a navegacao de mes e' puramente local (nao mexe no
  // iframe ainda), e so quando uma data e' clicada e' que buscamos ("seek") aquele dia no widget.
  const navigateMonth = useCallback((direction: 'previous' | 'next') => {
    trackWidgetRef.current = false;

    setBookingState((current) => {
      const base = new Date(current.year, current.monthIndex + (direction === 'next' ? 1 : -1), 1);
      const monthIndex = base.getMonth();
      const year = base.getFullYear();

      return {
        monthLabel: monthLabelFor(monthIndex, year),
        monthIndex,
        year,
        selectedDay: null,
        slots: [],
        loaded: true,
        emptyMessage: SELECT_DATE_MESSAGE,
      };
    });
  }, []);

  // Avanca/retrocede a janela deslizante de ~20 dias do widget oficial ate encontrar a data
  // pedida (mesmo que seja em outro mes), depois clica nela. Necessario porque o widget so
  // conhece "hoje" quando carrega e nao tem um jeito direto de "ir pro dia X do mes Y".
  const seekToOfficialDay = useCallback(async (targetMonthIndex: number, targetYear: number, targetDay: number) => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) {
      return false;
    }

    const targetTime = new Date(targetYear, targetMonthIndex, targetDay).getTime();
    const maxSteps = 30;

    for (let step = 0; step < maxSteps; step += 1) {
      const visibleDays = readOfficialDays(doc);
      const matchIndex = visibleDays.findIndex((visibleDay) => getOfficialDayTime(visibleDay) === targetTime);

      if (matchIndex !== -1) {
        const target = Array.from(doc.querySelectorAll<HTMLElement>('.cal-strip-day'))[matchIndex];
        if (!target) {
          return false;
        }

        target.click();
        await sleep(500);
        return true;
      }

      const firstVisible = visibleDays[0];
      const lastVisible = visibleDays[visibleDays.length - 1];
      if (!firstVisible || !lastVisible) {
        return false;
      }

      const direction = targetTime < getOfficialDayTime(firstVisible)
        ? 'previous'
        : targetTime > getOfficialDayTime(lastVisible)
          ? 'next'
          : null;

      if (!direction) {
        return false;
      }

      const buttons = Array.from(doc.querySelectorAll<HTMLButtonElement>('.cal-nav-btn'));
      const button = direction === 'previous' ? buttons[0] : buttons[1];

      if (!button || button.disabled) {
        return false;
      }

      button.click();
      await sleep(600);
    }

    return false;
  }, []);

  const clickOfficialDay = useCallback(async (day: number) => {
    if (isSeekingRef.current || !bookingState.loaded) {
      return;
    }

    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) {
      return;
    }

    isSeekingRef.current = true;
    setOfficialCheckoutOpen(false);

    // A maioria dos cliques cai dentro da janela de ~20 dias que o widget ja tem carregada — nesse
    // caso o clique e' instantaneo e nao precisa do esqueleto de carregamento. So mostramos o
    // esqueleto quando de fato precisamos avancar/retroceder a janela do widget (o que leva
    // alguns segundos), pra evitar o "pisca-pisca" em toda troca de data.
    const targetTime = new Date(bookingState.year, bookingState.monthIndex, day).getTime();
    const alreadyVisible = readOfficialDays(doc).some((visibleDay) => getOfficialDayTime(visibleDay) === targetTime);

    setBookingState((current) => ({ ...current, selectedDay: day, loaded: alreadyVisible ? current.loaded : false }));

    const found = await seekToOfficialDay(bookingState.monthIndex, bookingState.year, day);

    if (found) {
      trackWidgetRef.current = true;
      readOfficialBookingState();
      window.setTimeout(readOfficialBookingState, 700);
    } else {
      setBookingState((current) => ({
        ...current,
        loaded: true,
        slots: [],
        emptyMessage: 'Não foi possível carregar esta data agora. Tente novamente em instantes.',
      }));
    }

    isSeekingRef.current = false;
  }, [bookingState.loaded, bookingState.monthIndex, bookingState.year, readOfficialBookingState, seekToOfficialDay]);

  const reserveSlot = useCallback((slot: BookingSlot) => {
    const doc = iframeRef.current?.contentDocument;
    const slotElement = Array.from(doc?.querySelectorAll<HTMLElement>('.bk-card') ?? [])
      .find((element) => normalizeText(element.querySelector('.bk-time')?.textContent) === slot.time);
    const button = slotElement?.querySelector<HTMLButtonElement>('.bk-qty-plus, button:not([disabled])');

    if (!button || button.disabled) {
      setBookingActionMessage('Não foi possível acionar este horário agora. Selecione a data novamente e tente reservar sem sair desta página.');
      return;
    }

    setBookingActionMessage('');
    setReservingTime(slot.time);
    button.click();
    setOfficialCheckoutOpen(true);
    window.setTimeout(() => {
      setReservingTime(null);
      iframeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 800);
  }, []);

  useEffect(() => {
    const pollIfTrackingWidget = () => {
      if (!isSeekingRef.current && trackWidgetRef.current) {
        readOfficialBookingState();
      }
    };

    // Rajada inicial rapida pra pegar o primeiro render do widget (SignalR demora a conectar).
    const fastInterval = window.setInterval(pollIfTrackingWidget, 900);
    const stopFastInterval = window.setTimeout(() => window.clearInterval(fastInterval), 20000);

    // Polling continuo e mais espacado pra manter vagas/horarios atualizados "em tempo real"
    // enquanto o cliente olha uma data (o backend do LapTime pode liberar/fechar vagas a qualquer
    // momento).
    const liveInterval = window.setInterval(pollIfTrackingWidget, 20000);

    return () => {
      window.clearInterval(fastInterval);
      window.clearTimeout(stopFastInterval);
      window.clearInterval(liveInterval);
    };
  }, [readOfficialBookingState]);

  useEffect(() => {
    if (surface !== 'home' || window.location.hash !== '#agendamento') {
      return undefined;
    }

    const anchorSection = () => {
      const target = document.getElementById('agendamento');

      if (!target) {
        return;
      }

      const top = target.getBoundingClientRect().top + window.scrollY - 84;
      window.scrollTo({ top: Math.max(top, 0), behavior: 'auto' });
    };

    const timeouts = [80, 400, 1000, 2000, 3500].map((delay) => window.setTimeout(anchorSection, delay));

    return () => {
      timeouts.forEach(window.clearTimeout);
    };
  }, [surface]);

  return (
    <section
      id="agendamento"
      className="scroll-mt-28 border-t border-zinc-200 bg-[#efefef] py-16 md:scroll-mt-24 md:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 text-center">
        <HeadingTag className="font-sans text-[34px] font-normal tracking-tight text-zinc-900 md:text-[44px]">
          Consulte e <span className="font-extrabold text-primary-700">agende seu horário</span>
        </HeadingTag>

        <div aria-hidden="true" className="mx-auto mt-8 grid w-10 grid-cols-2 gap-1 opacity-80">
          <span className="h-2.5 w-2.5 skew-x-[-12deg] bg-zinc-300" />
          <span className="h-2.5 w-2.5 skew-x-[-12deg] bg-primary-600" />
          <span className="h-2.5 w-2.5 skew-x-[-12deg] bg-primary-600" />
          <span className="h-2.5 w-2.5 skew-x-[-12deg] bg-zinc-300" />
        </div>

        <p className="mx-auto mt-8 max-w-5xl text-center text-xl leading-8 text-zinc-800 md:text-2xl md:leading-9">
          Após 10 corridas, você conquista a <strong className="font-black">CARTEIRA de PILOTO</strong> e pode correr no Super Kart.
        </p>

        <p className="mx-auto mt-8 max-w-4xl text-center text-xl font-medium leading-tight text-zinc-900 md:text-2xl">
          Preço normal <span className="font-black text-primary-700">R$ 175,00</span>, mas reserve agora e pague antecipado com
          super desconto, saindo por apenas <span className="font-black text-primary-700">R$ 145,00</span>. (Promoção por tempo
          limitado) <span className="font-black text-primary-700">APROVEITE!!</span>
        </p>

        <div className="relative mx-auto mt-12 max-w-[1316px] bg-white px-4 pb-16 pt-12 md:min-h-[900px] md:px-24 md:pb-24 md:pt-16">
          <div className="mx-auto mb-8 w-full max-w-[23rem] rounded-md border border-zinc-200 bg-white p-6 text-center shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <button
                type="button"
                aria-label="Mês anterior"
                onClick={() => navigateMonth('previous')}
                className="flex h-10 w-10 items-center justify-center rounded border border-zinc-200 text-zinc-400 transition-colors hover:border-primary-600/50 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-30"
                disabled={!bookingState.loaded}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <strong className="text-xl font-black text-zinc-800">
                {bookingState.monthLabel}
              </strong>
              <button
                type="button"
                aria-label="Próximo mês"
                onClick={() => navigateMonth('next')}
                className="flex h-10 w-10 items-center justify-center rounded border border-zinc-200 text-zinc-400 transition-colors hover:border-primary-600/50 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-30"
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

                const isEnabled = bookingState.loaded && !isPastDate(bookingState.year, bookingState.monthIndex, cell.day);
                const isSelected = cell.day === bookingState.selectedDay;

                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => clickOfficialDay(cell.day as number)}
                    disabled={!isEnabled}
                    className={`min-h-11 border-b border-r border-zinc-100 py-3 text-base font-semibold transition-colors ${
                      isSelected
                        ? 'bg-primary-600 text-white'
                        : isEnabled
                          ? 'text-zinc-700 hover:bg-primary-50 hover:text-primary-700'
                          : 'cursor-not-allowed text-zinc-200'
                    }`}
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
                {Array.from({ length: 7 }, (_, index) => (
                  <div key={index} className="h-[46px] animate-pulse rounded bg-zinc-100 shadow-sm" />
                ))}
              </div>
            )}

            {bookingState.loaded && bookingState.slots.length === 0 && (
              <div className="rounded border border-zinc-200 bg-white px-6 py-8 text-center text-sm font-semibold text-zinc-500 shadow-sm">
                {bookingState.emptyMessage}
              </div>
            )}

            {bookingState.loaded && bookingState.slots.length > 0 && (
              <div className="space-y-2">
                {bookingState.slots.map((slot) => (
                  <div
                    key={`${slot.time}-${slot.name}`}
                    className={`booking-slot-row grid min-h-[46px] grid-cols-1 items-center gap-2 rounded border border-zinc-100 bg-white px-4 py-3 text-left shadow-[0_2px_9px_rgba(0,0,0,0.12)] md:gap-3 md:py-0 ${
                      slot.available ? '' : 'opacity-45'
                    }`}
                  >
                    <strong className="text-[27px] font-black leading-none text-zinc-800">
                      {slot.time}
                    </strong>
                    <span className="text-sm font-medium text-zinc-700 md:text-right">
                      {slot.name}
                    </span>
                    <span className="text-base font-black text-primary-700">
                      {slot.vacancies}
                    </span>
                    <span className="text-base font-medium text-zinc-800">
                      {slot.price}
                    </span>
                    <button
                      type="button"
                      onClick={() => reserveSlot(slot)}
                      disabled={!slot.available || reservingTime === slot.time}
                      className="h-9 rounded bg-primary-600 px-6 text-base font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
                    >
                      {reservingTime === slot.time ? 'Abrindo...' : 'Reservar'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {bookingActionMessage && (
              <div className="mt-4 rounded border border-primary-600/30 bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">
                {bookingActionMessage}
              </div>
            )}
          </div>

          <div
            className={
              officialCheckoutOpen
                ? 'mx-auto mt-10 max-w-6xl overflow-hidden bg-white text-left shadow-[0_14px_30px_rgba(0,0,0,0.14)]'
                : 'pointer-events-none fixed -left-[200vw] top-0 h-[1060px] w-[1320px] overflow-hidden opacity-0'
            }
          >
            {officialCheckoutOpen && (
              <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 md:px-6">
                <strong className="text-sm font-black uppercase tracking-[0.12em] text-zinc-800">
                  Finalizar reserva
                </strong>
                <button
                  type="button"
                  onClick={() => setOfficialCheckoutOpen(false)}
                  className="rounded border border-zinc-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-zinc-600 transition-colors hover:border-primary-600 hover:text-primary-700"
                >
                  Voltar aos horários
                </button>
              </div>
            )}

            <iframe
              ref={iframeRef}
              title="Agendamento oficial MyLapTime do Kartódromo de Betim"
              src={MYLAPTIME_BOOKING_PROXY_URL}
              onLoad={() => {
                cleanOfficialBookingFrame();
                window.setTimeout(readOfficialBookingState, 900);
                window.setTimeout(readOfficialBookingState, 2200);
              }}
              tabIndex={officialCheckoutOpen ? 0 : -1}
              aria-hidden={!officialCheckoutOpen}
              sandbox="allow-scripts allow-forms allow-same-origin"
              className={
                officialCheckoutOpen
                  ? 'block h-[820px] w-full border-0 bg-white'
                  : 'block h-[1060px] w-[1320px] border-0 bg-white'
              }
            />
        </div>
      </div>

      {surface === 'page' && (
        <div className="mx-auto mt-10 max-w-5xl rounded border border-zinc-200 bg-white px-5 py-6 text-left shadow-sm md:px-8">
          <h2 className="text-lg font-black uppercase tracking-[0.08em] text-zinc-900">
            Política de Cancelamento e Extorno
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-700 md:text-base">
            <p>
              O cancelamento de reservas deve ser solicitado com antecedência mínima de 24 horas em relação ao horário
              agendado.
            </p>
            <p>
              Solicitações realizadas dentro desse prazo poderão ser reagendadas conforme disponibilidade da agenda. Em
              caso de solicitação de extorno, a devolução será processada pelo mesmo meio de pagamento utilizado na
              compra, respeitando os prazos da operadora ou instituição financeira.
            </p>
            <p>
              Em caso de não comparecimento ou solicitação fora do prazo, o valor pago não será reembolsado.
            </p>
          </div>
        </div>
      )}
    </div>
  </section>
);
};

export default QuickBooking;
