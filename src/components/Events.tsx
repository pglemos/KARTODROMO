import {
  ArrowLeft,
  Building,
  Calendar,
  CheckCircle2,
  ChefHat,
  Flag,
  MessageSquare,
  Phone,
  Trophy,
  Users,
} from 'lucide-react';
import AngledButton from './site-ui/AngledButton';
import SectionHeading from './site-ui/SectionHeading';

const eventGallery = [
  { url: '/events/1.jpg', alt: 'Salão principal preparado para eventos', span: 'md:row-span-2' },
  { url: '/events/2.jpg', alt: 'Área de apoio gourmet' },
  { url: '/events/3.jpg', alt: 'Ambiente superior com vista' },
  { url: '/events/4.jpg', alt: 'Estrutura externa do kartódromo', span: 'md:col-span-2' },
  { url: '/events/5.jpg', alt: 'Cozinha e churrasqueira de apoio' },
  { url: '/events/6.jpg', alt: 'Espaço mobiliado para recepção' },
  { url: '/events/7.jpg', alt: 'Acesso e fachada do kartódromo', span: 'md:col-span-2' },
];

const eventStats = [
  { value: '150', label: 'convidados no espaço gourmet' },
  { value: '100', label: 'convidados no salão inferior' },
  { value: '1.110m', label: 'de pista para ativação com kart' },
];

const eventSpaces = [
  {
    icon: Building,
    title: 'Salão Inferior',
    capacity: 'Até 100 convidados',
    text: 'Ambiente no térreo para reuniões, palestras, aniversários e confraternizações com acesso fácil às áreas comuns.',
    points: ['Boa circulação', 'Layout flexível', 'Ideal para grupos corporativos'],
  },
  {
    icon: ChefHat,
    title: 'Espaço Gourmet',
    capacity: 'Até 150 convidados',
    text: 'Segundo pavimento com apoio gastronômico, vista para o circuito e estrutura para receber grupos maiores.',
    points: ['Vista panorâmica', 'Cozinha e churrasqueira', 'Área para recepção'],
  },
];

const eventFlow = [
  { icon: Calendar, title: 'Planejamento', text: 'Definição de data, perfil do público, quantidade de convidados e duração do evento.' },
  { icon: Flag, title: 'Experiência de pista', text: 'Baterias de kart, briefing, cronometragem, pódio e premiação quando contratado.' },
  { icon: Trophy, title: 'Fechamento', text: 'Momento de integração com fotos, ranking, confraternização e suporte da equipe local.' },
];

const Events = () => {
  const heroImage = eventGallery[3];

  return (
    <section id="eventos" className="min-h-screen overflow-hidden bg-ink-950 text-white/80">
      <div className="relative isolate border-b border-white/10">
        <img
          src={heroImage.url}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 z-[-2] h-full w-full object-cover opacity-20 brightness-75"
        />
        <div className="absolute inset-0 z-[-1] bg-gradient-to-r from-ink-950 via-ink-950/90 to-ink-950/50" />
        <div className="absolute inset-x-0 bottom-0 z-[-1] h-44 bg-gradient-to-t from-ink-950 to-transparent" />

        <div className="mx-auto grid min-h-[720px] max-w-7xl grid-cols-1 items-center gap-12 px-4 py-14 md:px-8 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="max-w-3xl">
            <a href="/" className="mb-8 inline-flex items-center gap-2 font-race text-xs italic font-bold uppercase tracking-[0.18em] text-white/60 transition-colors hover:text-primary-400">
              <ArrowLeft className="h-4 w-4" />
              Voltar para a página inicial
            </a>

            <div className="mb-5 flex items-center gap-3 font-race text-xs italic font-bold uppercase tracking-[0.16em] text-primary-400">
              <span aria-hidden="true" className="h-px w-10 bg-primary-400" />
              Eventos no Kartódromo de Betim
            </div>

            <h1 className="max-w-4xl font-display text-5xl italic uppercase leading-[0.82] tracking-tight text-white md:text-7xl lg:text-8xl">
              Eventos com kart, pódio e espaço para receber seu grupo
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-white/70 md:text-lg">
              Organize confraternizações, aniversários e encontros corporativos com baterias de kart, ranking, pódio, gastronomia e apoio da equipe.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <AngledButton href="https://wa.me/553135112373?text=Ol%C3%A1!%20Gostaria%20de%20saber%20valores%20e%20disponibilidade%20para%20realizar%20um%20evento%20no%20Kart%C3%B3dromo." external>
                <MessageSquare className="h-4 w-4" />
                Orçamento via WhatsApp
              </AngledButton>
              <AngledButton href="tel:+553135112373" variant="outline">
                <Phone className="h-4 w-4" />
                Ligar agora
              </AngledButton>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {eventGallery.slice(0, 5).map((image, index) => (
              <figure
                key={image.url}
                className={`group relative overflow-hidden border border-white/10 bg-ink-900 ${index === 0 ? 'col-span-2 row-span-2 md:col-span-2' : ''}`}
              >
                <img
                  src={image.url}
                  alt={image.alt}
                  className={`${index === 0 ? 'h-[360px]' : 'h-[170px]'} w-full object-cover brightness-[0.75] transition-transform duration-700 group-hover:scale-105 group-hover:brightness-100`}
                />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/90 to-transparent px-4 pb-4 pt-12 font-race text-xs italic font-bold uppercase tracking-[0.12em] text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  {image.alt}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {eventStats.map((item) => (
            <div key={item.label} className="border border-white/10 bg-ink-900 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary-400/40">
              <strong className="block font-display text-4xl italic tracking-tight text-primary-400">{item.value}</strong>
              <span className="mt-2 block font-race text-xs italic font-bold uppercase tracking-[0.16em] text-white/55">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-y border-white/10 bg-ink-900">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-16 md:px-8 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="max-w-xl">
            <SectionHeading eyebrow="Estrutura do evento" title="Escolha o espaço para o seu evento" />
            <p className="mt-5 text-sm leading-7 text-white/65">
              Compare a capacidade, o uso indicado e a estrutura de cada ambiente antes de solicitar seu orçamento.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {eventSpaces.map((space) => (
              <article key={space.title} className="border border-white/10 bg-ink-950 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary-400/40">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center border border-primary-400/30 bg-white/5 text-primary-400">
                    <space.icon className="h-6 w-6" />
                  </div>
                  <span className="border border-white/15 bg-white/5 px-3 py-1.5 font-race text-[10px] italic font-bold uppercase tracking-[0.14em] text-white/60">
                    {space.capacity}
                  </span>
                </div>
                <h3 className="font-display text-2xl italic uppercase tracking-tight text-white">{space.title}</h3>
                <p className="mt-4 text-sm leading-7 text-white/65">{space.text}</p>
                <ul className="mt-5 space-y-3">
                  {space.points.map((point) => (
                    <li key={point} className="flex items-center gap-2 text-sm font-semibold text-white/75">
                      <CheckCircle2 className="h-4 w-4 text-primary-400" />
                      {point}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="mb-8 flex items-center gap-2 text-primary-400">
          <Users className="h-5 w-5" />
          <span className="font-race text-xs italic font-bold uppercase tracking-[0.18em]">Como funciona</span>
        </div>
        <h2 className="mb-8 font-display text-3xl italic uppercase leading-none tracking-tight text-white md:text-5xl">
          Um evento com ritmo, disputa e memória
        </h2>

        <div className="grid gap-4 md:grid-cols-3">
          {eventFlow.map((step, index) => (
            <article key={step.title} className="border border-white/10 bg-ink-900 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary-400/40">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center border border-primary-400/30 bg-white/5 text-primary-400">
                  <step.icon className="h-5 w-5" />
                </div>
                <span className="font-race text-xs italic font-bold uppercase tracking-[0.18em] text-white/35">0{index + 1}</span>
              </div>
              <h3 className="font-race text-lg italic font-bold uppercase tracking-tight text-white">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-white/65">{step.text}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="border-y border-white/10 bg-ink-900">
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-8">
          <span className="font-race text-xs italic font-bold uppercase tracking-[0.16em] text-primary-400">Ambientes e estrutura</span>
          <h2 className="mt-3 mb-8 font-display text-3xl italic uppercase leading-none tracking-tight text-white md:text-5xl">
            Estrutura física do kartódromo
          </h2>

          <div className="grid auto-rows-[210px] grid-cols-1 gap-4 md:grid-cols-4">
            {eventGallery.map((image) => (
              <figure key={image.url} className={`group relative overflow-hidden border border-white/10 bg-ink-950 ${image.span ?? ''}`}>
                <img
                  src={image.url}
                  alt={image.alt}
                  loading="lazy"
                  className="h-full w-full object-cover brightness-[0.75] transition-transform duration-700 group-hover:scale-105 group-hover:brightness-100"
                />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/90 to-transparent px-4 pb-4 pt-14 font-race text-xs italic font-bold uppercase tracking-[0.12em] text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  {image.alt}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="relative overflow-hidden border border-primary-400/25 bg-ink-900 p-6 md:p-10">
          <img
            src={eventGallery[6].url}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-[0.12]"
          />
          <div className="relative z-10 grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <span className="font-race text-xs italic font-bold uppercase tracking-[0.16em] text-primary-400">Orçamento para eventos</span>
              <h2 className="mt-3 max-w-3xl font-display text-3xl italic uppercase leading-none tracking-tight text-white md:text-5xl">
                Monte seu evento com bateria de kart, pódio e estrutura de apoio.
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-white/70">
                Envie data, quantidade de pessoas e tipo de evento. A equipe retorna com formato, disponibilidade e próximos passos.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
              <AngledButton href="https://wa.me/553135112373?text=Ol%C3%A1!%20Quero%20montar%20um%20evento%20no%20Kart%C3%B3dromo%20de%20Betim." external>
                <MessageSquare className="h-4 w-4" />
                Chamar no WhatsApp
              </AngledButton>
              <AngledButton href="tel:+553135112373" variant="outline">
                <Phone className="h-4 w-4" />
                (31) 3511-2373
              </AngledButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Events;
