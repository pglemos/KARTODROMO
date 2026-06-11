import { CalendarDays, CreditCard, ExternalLink, MessageSquare, ShieldCheck } from 'lucide-react';
import { MYLAPTIME_BOOKING_URL, WHATSAPP_BOOKING_URL } from '../config/booking';

type QuickBookingProps = {
  surface?: 'home' | 'page';
};

const QuickBooking = ({ surface = 'home' }: QuickBookingProps) => {
  const HeadingTag = surface === 'page' ? 'h1' : 'h2';

  return (
    <section
      id="agendamento"
      className="scroll-mt-28 border-t border-zinc-200/60 bg-white py-24 md:scroll-mt-24"
    >
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl text-center">
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

          <p className="mt-7 text-center text-xl font-semibold leading-tight text-zinc-800 md:text-2xl">
            <span className="font-black text-primary-600">Reserve agora.</span> Faça o pagamento por meio de nossa <span className="font-black text-primary-600">reserva on-line.</span>
          </p>

          <div className="mx-auto mt-12 max-w-4xl rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-left shadow-sm md:p-8">
            <div className="grid gap-5 md:grid-cols-[1fr_0.86fr] md:items-stretch">
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm md:p-8">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-black uppercase leading-tight tracking-tight text-zinc-950 md:text-3xl">
                  Escolha data e horário na agenda oficial
                </h3>
                <p className="mt-4 text-sm leading-7 text-zinc-600 md:text-base">
                  A reserva abre no ambiente oficial da MyLapTime para confirmar disponibilidade, dados do piloto e pagamento on-line com Pix ou cartão de crédito.
                </p>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <a
                    href={MYLAPTIME_BOOKING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="home-cta inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary-500 px-6 py-3.5 text-center text-xs font-black uppercase tracking-[0.14em] text-zinc-950 transition-colors hover:bg-primary-400"
                  >
                    Reservar corrida online
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <a
                    href={WHATSAPP_BOOKING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-6 py-3.5 text-center text-xs font-black uppercase tracking-[0.14em] text-zinc-800 transition-colors hover:border-primary-500/45 hover:text-primary-700"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Reservar pelo WhatsApp
                  </a>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <CreditCard className="mb-4 h-6 w-6 text-primary-600" />
                  <h4 className="text-sm font-black uppercase tracking-[0.12em] text-zinc-950">Pagamento on-line</h4>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    O pagamento antecipado pode ser feito por Pix ou cartão de crédito.
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <ShieldCheck className="mb-4 h-6 w-6 text-primary-600" />
                  <h4 className="text-sm font-black uppercase tracking-[0.12em] text-zinc-950">Ambiente oficial</h4>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    A confirmação da reserva é feita diretamente na plataforma de cronometragem e agendamento.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default QuickBooking;
