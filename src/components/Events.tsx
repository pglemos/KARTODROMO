import {
  ArrowLeft,
  Building,
  Calendar,
  CheckCircle2,
  ChefHat,
  Flag,
  MapPin,
  MessageSquare,
  Phone,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';

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
    text: 'Segundo pavimento com apoio gastronômico, vista para o circuito e estrutura para uma experiência mais completa.',
    points: ['Vista panorâmica', 'Cozinha e churrasqueira', 'Recepção mais premium'],
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
    <section id="eventos" className="min-h-screen overflow-hidden bg-[#fbfcf8] text-zinc-800">
      <div className="relative isolate border-b border-zinc-200/80">
        <img
          src={heroImage.url}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 z-[-2] h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 z-[-1] bg-[linear-gradient(90deg,#fbfcf8_0%,rgba(251,252,248,0.94)_48%,rgba(251,252,248,0.70)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 z-[-1] h-44 bg-gradient-to-t from-[#fbfcf8] to-transparent" />

        <div className="mx-auto grid min-h-[720px] max-w-7xl grid-cols-1 items-center gap-12 px-4 py-14 md:px-8 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="motion-rise max-w-3xl">
            <a href="/" className="mb-8 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-zinc-600 transition-colors hover:text-primary-700">
              <ArrowLeft className="h-4 w-4" />
              Voltar para a página inicial
            </a>

            <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-primary-500/25 bg-[#fbfcf8]/90 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-primary-700 shadow-sm">
              <Sparkles className="h-4 w-4" />
              Eventos com kart, pódio e estrutura completa
            </div>

            <h1 className="max-w-4xl text-5xl font-black uppercase leading-[0.88] tracking-tight text-zinc-950 md:text-7xl lg:text-8xl">
              Seu evento com pista, salão e adrenalina no mesmo lugar
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-zinc-600 md:text-lg">
              Confraternizações, aniversários e encontros corporativos ganham outra energia quando a experiência combina kart, ranking, pódio, gastronomia e apoio operacional.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="https://wa.me/553135112373?text=Ol%C3%A1!%20Gostaria%20de%20saber%20valores%20e%20disponibilidade%20para%20realizar%20um%20evento%20no%20Kart%C3%B3dromo."
                target="_blank"
                rel="noopener noreferrer"
                className="track-primary-action inline-flex items-center justify-center gap-2 rounded-lg bg-primary-500 px-6 py-3.5 text-xs font-black uppercase tracking-[0.16em] text-zinc-950 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary-400"
              >
                <MessageSquare className="h-4 w-4" />
                Orçamento via WhatsApp
              </a>
              <a
                href="tel:+553135112373"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-[#fbfcf8]/90 px-6 py-3.5 text-xs font-black uppercase tracking-[0.16em] text-zinc-800 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary-500/45 hover:text-primary-700"
              >
                <Phone className="h-4 w-4" />
                Ligar agora
              </a>
            </div>
          </div>

          <div className="motion-rise motion-delay-1 grid grid-cols-2 gap-3 md:grid-cols-3">
            {eventGallery.slice(0, 5).map((image, index) => (
              <figure
                key={image.url}
                className={`group relative overflow-hidden rounded-2xl border border-[#fbfcf8]/80 bg-[#f7faf4] shadow-[0_22px_54px_rgba(17,20,18,0.14)] ${index === 0 ? 'col-span-2 row-span-2 md:col-span-2' : ''}`}
              >
                <img
                  src={image.url}
                  alt={image.alt}
                  className={`${index === 0 ? 'h-[360px]' : 'h-[170px]'} w-full object-cover transition-transform duration-700 group-hover:scale-105`}
                />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-950/82 to-transparent px-4 pb-4 pt-12 text-xs font-black uppercase tracking-[0.12em] text-[#fbfcf8] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  {image.alt}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {eventStats.map((item, index) => (
            <div
              key={item.label}
              className="motion-rise rounded-xl border border-zinc-200 bg-[#fdfefb] p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary-500/35 hover:shadow-md"
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <strong className="block text-4xl font-black tracking-tight text-zinc-950">{item.value}</strong>
              <span className="mt-2 block text-xs font-black uppercase tracking-[0.16em] text-zinc-500">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-y border-zinc-200/80 bg-[#eef5ed]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-16 md:px-8 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="max-w-xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-primary-500/20 bg-[#fbfcf8] px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-primary-700">
              <MapPin className="h-4 w-4" />
              Estrutura do evento
            </div>
            <h2 className="text-4xl font-black uppercase leading-none tracking-tight text-zinc-950 md:text-5xl">
              Escolha o espaço pelo tipo de experiência
            </h2>
            <p className="mt-5 text-sm leading-7 text-zinc-600">
              A página agora separa capacidade, uso e benefícios de cada ambiente para facilitar a decisão de quem está cotando um evento.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {eventSpaces.map((space) => (
              <article key={space.title} className="rounded-2xl border border-zinc-200 bg-[#fbfcf8] p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-500 text-zinc-950">
                    <space.icon className="h-6 w-6" />
                  </div>
                  <span className="rounded-md border border-zinc-200 bg-[#fdfefb] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600">
                    {space.capacity}
                  </span>
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight text-zinc-950">{space.title}</h3>
                <p className="mt-4 text-sm leading-7 text-zinc-600">{space.text}</p>
                <ul className="mt-5 space-y-3">
                  {space.points.map((point) => (
                    <li key={point} className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
                      <CheckCircle2 className="h-4 w-4 text-primary-600" />
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
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-primary-700">
              <Users className="h-5 w-5" />
              <span className="text-xs font-black uppercase tracking-[0.18em]">Como funciona</span>
            </div>
            <h2 className="text-3xl font-black uppercase leading-none tracking-tight text-zinc-950 md:text-5xl">
              Um evento com ritmo, disputa e memória
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-zinc-600">
            A experiência fica clara para empresas, famílias e grupos: não é só alugar um salão, é montar uma programação.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {eventFlow.map((step, index) => (
            <article key={step.title} className="rounded-xl border border-zinc-200 bg-[#fdfefb] p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary-500/35 hover:shadow-md">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-950 text-[#fbfcf8]">
                  <step.icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">0{index + 1}</span>
              </div>
              <h3 className="text-lg font-black uppercase tracking-tight text-zinc-950">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-600">{step.text}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="border-y border-zinc-200/80 bg-[#f7faf4]">
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-8">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="text-xs font-black uppercase tracking-[0.18em] text-primary-700">Galeria real</span>
              <h2 className="mt-3 text-3xl font-black uppercase leading-none tracking-tight text-zinc-950 md:text-5xl">
                Estrutura física do kartódromo
              </h2>
            </div>
            <p className="max-w-lg text-sm leading-7 text-zinc-600">
              Fotos amplas, legenda no hover e proporções diferentes para parecer uma galeria real, não uma grade repetida.
            </p>
          </div>

          <div className="grid auto-rows-[210px] grid-cols-1 gap-4 md:grid-cols-4">
            {eventGallery.map((image) => (
              <figure key={image.url} className={`group relative overflow-hidden rounded-2xl border border-zinc-200 bg-[#fdfefb] shadow-sm ${image.span ?? ''}`}>
                <img
                  src={image.url}
                  alt={image.alt}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-950/85 to-transparent px-4 pb-4 pt-14 text-xs font-black uppercase tracking-[0.12em] text-[#fbfcf8] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  {image.alt}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-primary-500/25 bg-zinc-950 p-6 text-[#fbfcf8] shadow-[0_28px_80px_rgba(17,20,18,0.18)] md:p-10">
          <img
            src={eventGallery[6].url}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-[0.18]"
          />
          <div className="relative z-10 grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <span className="text-xs font-black uppercase tracking-[0.18em] text-primary-400">Pronto para cotar</span>
              <h2 className="mt-3 max-w-3xl text-3xl font-black uppercase leading-none tracking-tight md:text-5xl">
                Monte seu evento com bateria de kart, pódio e estrutura de apoio.
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-zinc-200">
                Envie data, quantidade de pessoas e tipo de evento. A equipe retorna com formato, disponibilidade e próximos passos.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
              <a
                href="https://wa.me/553135112373?text=Ol%C3%A1!%20Quero%20montar%20um%20evento%20no%20Kart%C3%B3dromo%20de%20Betim."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-500 px-6 py-3.5 text-xs font-black uppercase tracking-[0.16em] text-zinc-950 transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary-400"
              >
                <MessageSquare className="h-4 w-4" />
                Chamar no WhatsApp
              </a>
              <a
                href="tel:+553135112373"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#fbfcf8]/25 bg-[#fbfcf8]/10 px-6 py-3.5 text-xs font-black uppercase tracking-[0.16em] text-[#fbfcf8] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#fbfcf8]/16"
              >
                <Phone className="h-4 w-4" />
                (31) 3511-2373
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Events;
