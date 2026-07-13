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
import AngledButton from './site-ui/AngledButton';
import SectionHeading from './site-ui/SectionHeading';

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
    <main className="bg-ink-950 text-white/80">
      <section className="relative isolate overflow-hidden bg-ink-950">
        <img
          src="/posters/home-karting.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 z-[-3] h-full w-full object-cover opacity-40 brightness-75"
        />
        <div className="absolute inset-0 z-[-2] bg-gradient-to-r from-ink-950 via-ink-950/85 to-ink-950/30" />
        <div className="absolute inset-x-0 bottom-0 z-[-1] h-40 bg-gradient-to-t from-ink-950 to-transparent" />

        <div className="container mx-auto grid min-h-[72svh] gap-8 px-4 pb-7 pt-10 md:min-h-[78vh] md:grid-cols-[0.96fr_1.04fr] md:items-end md:pb-10 md:pt-14">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 border border-primary-400/30 bg-white/5 px-4 py-2 font-race text-[11px] italic font-bold uppercase tracking-[0.18em] text-primary-400 backdrop-blur-md">
              <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              Kart de locação
            </div>

            <h1 className="max-w-[10ch] font-display text-[3.4rem] italic uppercase leading-[0.82] tracking-tight text-white sm:text-7xl md:text-8xl">
              Entre no grid hoje.
            </h1>

            <p className="mt-6 max-w-[60ch] text-base leading-8 text-white/75 md:text-lg">
              Bateria de 30 minutos com kart de locação, cronometragem, equipamento incluso
              e equipe de pista em uma pista homologada de 1.110 metros.
            </p>

            <div className="mt-6 grid grid-cols-3 gap-px border border-white/15 bg-white/10 md:hidden">
              <div className="bg-ink-900 p-3">
                <strong className="block text-xl font-black leading-none text-primary-400">R$ 145</strong>
                <span className="mt-1 block text-[9px] font-black uppercase tracking-[0.12em] text-white/60">online</span>
              </div>
              <div className="bg-ink-900 p-3">
                <strong className="block text-xl font-black leading-none text-white">30 min</strong>
                <span className="mt-1 block text-[9px] font-black uppercase tracking-[0.12em] text-white/60">bateria</span>
              </div>
              <div className="bg-ink-900 p-3">
                <strong className="block text-xl font-black leading-none text-white">14+</strong>
                <span className="mt-1 block text-[9px] font-black uppercase tracking-[0.12em] text-white/60">idade</span>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <AngledButton href={SITE_BOOKING_ANCHOR}>
                <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                Reservar online
              </AngledButton>
              <AngledButton href={WHATSAPP_BOOKING_URL} variant="outline" external>
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Tirar dúvida
              </AngledButton>
            </div>
          </div>

          <div className="hidden gap-px overflow-hidden border border-white/15 bg-white/10 md:mb-3 md:grid md:max-w-xl md:justify-self-end">
            <div className="grid grid-cols-2 gap-px bg-white/10">
              <div className="bg-ink-900 p-4 md:p-5">
                <span className="font-race text-[10px] italic font-bold uppercase tracking-[0.16em] text-white/55">Online</span>
                <strong className="mt-2 block font-display text-3xl italic leading-none text-primary-400">R$ 145</strong>
                <p className="mt-2 text-xs font-semibold leading-5 text-white/65">Pix ou cartão no agendamento.</p>
              </div>
              <div className="bg-ink-900 p-4 md:p-5">
                <span className="font-race text-[10px] italic font-bold uppercase tracking-[0.16em] text-white/55">No balcão</span>
                <strong className="mt-2 block font-display text-3xl italic leading-none text-white">R$ 175</strong>
                <p className="mt-2 text-xs font-semibold leading-5 text-white/65">Crédito, débito, dinheiro ou Pix.</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-px bg-white/10">
              <div className="bg-ink-900 p-4">
                <Timer className="mb-2 h-4 w-4 text-primary-400" aria-hidden="true" />
                <strong className="block text-xl font-black text-white">30 min</strong>
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-white/55">bateria</span>
              </div>
              <div className="bg-ink-900 p-4">
                <Gauge className="mb-2 h-4 w-4 text-primary-400" aria-hidden="true" />
                <strong className="block text-xl font-black text-white">400cc</strong>
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-white/55">Honda</span>
              </div>
              <div className="bg-ink-900 p-4">
                <UserCheck className="mb-2 h-4 w-4 text-primary-400" aria-hidden="true" />
                <strong className="block text-xl font-black text-white">14+</strong>
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-white/55">idade</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-ink-950 py-14 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.74fr_1.26fr] lg:items-start">
            <div>
              <SectionHeading eyebrow="A bateria" title="Trinta minutos dentro da pista." />
              <p className="mt-5 max-w-[62ch] text-sm leading-7 text-white/65 md:text-base">
                Chegue com 1 hora de antecedência para cadastro, pesagem, retirada dos equipamentos e briefing.
                Depois, a sessão segue em três etapas simples.
              </p>
            </div>

            <div className="grid overflow-hidden border border-white/10 bg-white/10 md:grid-cols-3">
              {sessionFlow.map((step, index) => (
                <article key={step.label} className="bg-ink-900 p-6 md:min-h-64">
                  <span className="font-race text-[11px] italic font-bold uppercase tracking-[0.14em] text-white/50">
                    Etapa {index + 1}
                  </span>
                  <strong className="mt-7 block font-display text-5xl italic uppercase leading-none text-primary-400">
                    {step.time}
                  </strong>
                  <h3 className="mt-5 font-race text-lg italic font-bold text-white">{step.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/65">{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-ink-900 py-14 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_0.92fr]">
            <div className="border border-white/10 bg-ink-950 p-6 md:p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center border border-primary-400/30 bg-white/5 text-primary-400">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-race text-xs italic font-bold uppercase tracking-[0.16em] text-primary-400">
                    Para pilotar
                  </p>
                  <h2 className="mt-2 font-display text-2xl italic uppercase tracking-tight text-white md:text-3xl">
                    Requisitos rápidos
                  </h2>
                </div>
              </div>

              <div className="mt-7 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2">
                {requirements.map(([value, label]) => (
                  <div key={label} className="bg-ink-900 p-4">
                    <strong className="block text-2xl font-black text-white">{value}</strong>
                    <span className="mt-2 block text-[11px] font-black uppercase tracking-[0.12em] text-white/50">
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              <ul className="mt-7 space-y-3">
                {includedItems.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-6 text-white/70">
                    <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-400" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-8">
              <div className="border border-white/10 bg-ink-950 p-6 md:p-8">
                <p className="font-race text-xs italic font-bold uppercase tracking-[0.16em] text-primary-400">
                  Pagamento
                </p>
                <h2 className="mt-2 font-display text-2xl italic uppercase tracking-tight text-white md:text-3xl">
                  Escolha como pagar
                </h2>
                <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden border border-white/10 bg-white/10">
                  {paymentMethods.map((method) => {
                    const Icon = method.icon;

                    return (
                      <div key={method.label} className="bg-ink-900 p-4 text-center">
                        <Icon className="mx-auto h-5 w-5 text-primary-400" aria-hidden="true" />
                        <span className="mt-3 block text-xs font-black uppercase tracking-[0.1em] text-white/70">
                          {method.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border border-primary-400/25 bg-ink-950 p-6 md:p-8">
                <p className="font-race text-xs italic font-bold uppercase tracking-[0.16em] text-primary-400">
                  Reserva
                </p>
                <h2 className="mt-3 font-display text-2xl italic uppercase leading-none tracking-tight text-white md:text-4xl">
                  Veja horários disponíveis agora.
                </h2>
                <p className="mt-5 text-sm leading-7 text-white/65">
                  Reserve online para garantir a bateria. Para grupos, aniversários ou dúvidas sobre horário,
                  fale com a equipe pelo WhatsApp.
                </p>

                <div className="mt-7 grid gap-3">
                  <AngledButton href={SITE_BOOKING_ANCHOR}>
                    <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                    Abrir agenda online
                  </AngledButton>
                  <AngledButton href={WHATSAPP_BOOKING_URL} variant="outline" external>
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    Chamar no WhatsApp
                  </AngledButton>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-12 grid max-w-6xl gap-5 border-t border-white/10 pt-8 text-sm leading-7 text-white/65 md:grid-cols-3">
            <div className="flex gap-3">
              <MapPin className="mt-1 h-4 w-4 flex-shrink-0 text-primary-400" aria-hidden="true" />
              <span>Av. Adutora Várzea das Flores, 477, Betim, MG.</span>
            </div>
            <div className="flex gap-3">
              <Clock3 className="mt-1 h-4 w-4 flex-shrink-0 text-primary-400" aria-hidden="true" />
              <span>Terça a sexta das 16h às 22h. Sábado e domingo das 08h às 19h.</span>
            </div>
            <div className="flex gap-3">
              <Gauge className="mt-1 h-4 w-4 flex-shrink-0 text-primary-400" aria-hidden="true" />
              <span>Karts Honda GX390 de 13HP preparados para locação.</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default KartLocacao;
