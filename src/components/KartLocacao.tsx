import {
  CalendarCheck,
  CheckCircle,
  Clock3,
  Coins,
  CreditCard,
  Gauge,
  MapPin,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Timer,
  UserCheck,
  Zap,
} from 'lucide-react';
import { SITE_BOOKING_ANCHOR, WHATSAPP_BOOKING_URL } from '../config/booking';

const sessionFlow = [
  {
    time: '5 min',
    label: 'Tomada',
    text: 'Voltas de classificação para montar o grid.',
  },
  {
    time: '5 min',
    label: 'Grid',
    text: 'Organização da largada com orientação da equipe.',
  },
  {
    time: '20 min',
    label: 'Corrida',
    text: 'Disputa cronometrada na pista de 1.110 metros.',
  },
];

const requirements = [
  ['14 anos', 'idade mínima'],
  ['1,50 m', 'altura mínima'],
  ['50 kg', 'peso mínimo'],
  ['Tênis', 'calçado fechado'],
];

const includedItems = [
  'Capacete com viseira e macacão emprestados pelo kartódromo.',
  'Briefing de segurança antes da entrada na pista.',
  'Fiscais de pista, mecânicos e ambulatório com socorrista.',
];

const paymentMethods = [
  { icon: QrCode, label: 'Pix' },
  { icon: CreditCard, label: 'Cartão' },
  { icon: Coins, label: 'Dinheiro' },
];

const KartLocacao = () => {
  return (
    <main className="bg-[#fbfcf8] text-zinc-800">
      <section className="relative isolate overflow-hidden bg-zinc-950 text-[#fbfcf8]">
        <img
          src="/posters/home-karting.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 z-[-3] h-full w-full object-cover opacity-72"
        />
        <div className="absolute inset-0 z-[-2] bg-[linear-gradient(90deg,rgba(9,9,11,0.95)_0%,rgba(9,9,11,0.78)_42%,rgba(9,9,11,0.28)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 z-[-1] h-40 bg-[linear-gradient(180deg,transparent,rgba(9,9,11,0.92))]" />

        <div className="container mx-auto grid min-h-[72svh] gap-8 px-4 pb-7 pt-10 md:min-h-[78vh] md:grid-cols-[0.96fr_1.04fr] md:items-end md:pb-10 md:pt-14">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#fbfcf8]/20 bg-zinc-950/45 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-primary-300">
              <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              Kart de locação
            </div>

            <h1 className="max-w-[10ch] text-[3.4rem] font-black uppercase leading-[0.82] tracking-tight text-[#fbfcf8] sm:text-7xl md:text-8xl">
              Entre no grid hoje.
            </h1>

            <p className="mt-6 max-w-[60ch] text-base leading-8 text-zinc-200 md:text-lg">
              Bateria de 30 minutos com kart de locação, cronometragem, equipamento incluso
              e equipe de pista em uma pista homologada de 1.110 metros.
            </p>

            <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-[#fbfcf8]/18 bg-[#fbfcf8]/18 md:hidden">
              <div className="bg-zinc-950/90 p-3">
                <strong className="block text-xl font-black leading-none text-primary-300">R$ 145</strong>
                <span className="mt-1 block text-[9px] font-black uppercase tracking-[0.12em] text-zinc-400">online</span>
              </div>
              <div className="bg-zinc-950/90 p-3">
                <strong className="block text-xl font-black leading-none text-[#fbfcf8]">30 min</strong>
                <span className="mt-1 block text-[9px] font-black uppercase tracking-[0.12em] text-zinc-400">bateria</span>
              </div>
              <div className="bg-zinc-950/90 p-3">
                <strong className="block text-xl font-black leading-none text-[#fbfcf8]">14+</strong>
                <span className="mt-1 block text-[9px] font-black uppercase tracking-[0.12em] text-zinc-400">idade</span>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={SITE_BOOKING_ANCHOR}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary-500 px-6 py-3.5 text-xs font-black uppercase tracking-[0.14em] text-zinc-950 shadow-[0_18px_42px_rgba(0,200,83,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary-400"
              >
                <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                Reservar online
              </a>
              <a
                href={WHATSAPP_BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#fbfcf8]/24 bg-[#fbfcf8]/8 px-6 py-3.5 text-xs font-black uppercase tracking-[0.14em] text-[#fbfcf8] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary-300 hover:text-primary-200"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Tirar dúvida
              </a>
            </div>
          </div>

          <div className="hidden gap-px overflow-hidden rounded-lg border border-[#fbfcf8]/18 bg-[#fbfcf8]/18 md:mb-3 md:grid md:max-w-xl md:justify-self-end">
            <div className="grid grid-cols-2 gap-px bg-[#fbfcf8]/18">
              <div className="bg-zinc-950/82 p-4 md:p-5">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Online</span>
                <strong className="mt-2 block text-3xl font-black leading-none text-primary-300">R$ 145</strong>
                <p className="mt-2 text-xs font-semibold leading-5 text-zinc-300">Pix ou cartão no agendamento.</p>
              </div>
              <div className="bg-zinc-950/82 p-4 md:p-5">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">No balcão</span>
                <strong className="mt-2 block text-3xl font-black leading-none text-[#fbfcf8]">R$ 175</strong>
                <p className="mt-2 text-xs font-semibold leading-5 text-zinc-300">Crédito, débito, dinheiro ou Pix.</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-px bg-[#fbfcf8]/18">
              <div className="bg-zinc-950/82 p-4">
                <Timer className="mb-2 h-4 w-4 text-primary-300" aria-hidden="true" />
                <strong className="block text-xl font-black">30 min</strong>
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">bateria</span>
              </div>
              <div className="bg-zinc-950/82 p-4">
                <Gauge className="mb-2 h-4 w-4 text-primary-300" aria-hidden="true" />
                <strong className="block text-xl font-black">400cc</strong>
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">Honda</span>
              </div>
              <div className="bg-zinc-950/82 p-4">
                <UserCheck className="mb-2 h-4 w-4 text-primary-300" aria-hidden="true" />
                <strong className="block text-xl font-black">14+</strong>
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">idade</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-[#fbfcf8] py-14 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.74fr_1.26fr] lg:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-700">
                A bateria
              </p>
              <h2 className="mt-4 max-w-xl text-3xl font-black uppercase leading-none tracking-tight text-zinc-950 md:text-5xl">
                Trinta minutos dentro da pista.
              </h2>
              <p className="mt-5 max-w-[62ch] text-sm leading-7 text-zinc-600 md:text-base">
                Chegue com 1 hora de antecedência para cadastro, pesagem, retirada dos equipamentos e briefing.
                Depois, a sessão segue em três etapas simples.
              </p>
            </div>

            <div className="grid overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 md:grid-cols-3">
              {sessionFlow.map((step, index) => (
                <article key={step.label} className="bg-[#fffffb] p-6 md:min-h-64">
                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">
                    Etapa {index + 1}
                  </span>
                  <strong className="mt-7 block text-5xl font-black uppercase leading-none text-primary-700">
                    {step.time}
                  </strong>
                  <h3 className="mt-5 text-lg font-black text-zinc-950">{step.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#eef5ed] py-14 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_0.92fr]">
            <div className="rounded-lg border border-zinc-200 bg-[#fbfcf8] p-6 shadow-sm md:p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-zinc-950 text-[#fbfcf8]">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-700">
                    Para pilotar
                  </p>
                  <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-zinc-950 md:text-3xl">
                    Requisitos rápidos
                  </h2>
                </div>
              </div>

              <div className="mt-7 grid gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 sm:grid-cols-2">
                {requirements.map(([value, label]) => (
                  <div key={label} className="bg-[#fffffb] p-4">
                    <strong className="block text-2xl font-black text-zinc-950">{value}</strong>
                    <span className="mt-2 block text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              <ul className="mt-7 space-y-3">
                {includedItems.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-6 text-zinc-700">
                    <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-700" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-8">
              <div className="rounded-lg border border-zinc-200 bg-[#fbfcf8] p-6 shadow-sm md:p-8">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-700">
                  Pagamento
                </p>
                <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-zinc-950 md:text-3xl">
                  Escolha como pagar
                </h2>
                <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200">
                  {paymentMethods.map((method) => {
                    const Icon = method.icon;

                    return (
                      <div key={method.label} className="bg-[#fffffb] p-4 text-center">
                        <Icon className="mx-auto h-5 w-5 text-primary-700" aria-hidden="true" />
                        <span className="mt-3 block text-xs font-black uppercase tracking-[0.1em] text-zinc-700">
                          {method.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-zinc-950 p-6 text-[#fbfcf8] shadow-[0_24px_70px_rgba(17,20,18,0.16)] md:p-8">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-300">
                  Reserva
                </p>
                <h2 className="mt-3 text-2xl font-black uppercase leading-none tracking-tight md:text-4xl">
                  Veja horários disponíveis agora.
                </h2>
                <p className="mt-5 text-sm leading-7 text-zinc-300">
                  Reserve online para garantir a bateria. Para grupos, aniversários ou dúvidas sobre horário,
                  fale com a equipe pelo WhatsApp.
                </p>

                <div className="mt-7 grid gap-3">
                  <a
                    href={SITE_BOOKING_ANCHOR}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary-500 px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-zinc-950 transition-colors hover:bg-primary-400"
                  >
                    <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                    Abrir agenda online
                  </a>
                  <a
                    href={WHATSAPP_BOOKING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#fbfcf8]/20 px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-[#fbfcf8] transition-colors hover:border-primary-400 hover:text-primary-200"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    Chamar no WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-12 grid max-w-6xl gap-5 border-t border-zinc-200 pt-8 text-sm leading-7 text-zinc-600 md:grid-cols-3">
            <div className="flex gap-3">
              <MapPin className="mt-1 h-4 w-4 flex-shrink-0 text-primary-700" aria-hidden="true" />
              <span>Av. Adutora Várzea das Flores, 477, Betim, MG.</span>
            </div>
            <div className="flex gap-3">
              <Clock3 className="mt-1 h-4 w-4 flex-shrink-0 text-primary-700" aria-hidden="true" />
              <span>Terça a sexta das 16h às 22h. Sábado e domingo das 08h às 19h.</span>
            </div>
            <div className="flex gap-3">
              <Gauge className="mt-1 h-4 w-4 flex-shrink-0 text-primary-700" aria-hidden="true" />
              <span>Karts Honda GX390 de 13HP preparados para locação.</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default KartLocacao;
