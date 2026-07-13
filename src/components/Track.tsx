import { ArrowLeft, Compass, Flag, Map, MessageSquare, Route, Timer } from 'lucide-react';
import AngledButton from './site-ui/AngledButton';
import BigCTA from './site-ui/BigCTA';
import SectionHeading from './site-ui/SectionHeading';

const trackNotes = [
  {
    icon: Compass,
    title: 'Leitura de pista',
    text: 'Cada variação muda frenagem, tangência e saída de curva. O piloto precisa adaptar referências e ritmo a cada configuração.',
  },
  {
    icon: Timer,
    title: 'Ritmo de bateria',
    text: 'Layouts curtos deixam a sessão mais agressiva. Traçados longos favorecem constância e ultrapassagem planejada.',
  },
  {
    icon: Route,
    title: 'Chicane ativa',
    text: 'As opções com chicane quebram velocidade de reta e deixam o kart mais técnico nas mudanças de direção.',
  },
];

const trackHighlights = [
  { label: 'Extensão', value: '1.110m', detail: 'Circuito técnico' },
  { label: 'Configurações mapeadas', value: '42', detail: 'Normal, invertido e chicane' },
  { label: 'Alterações', value: 'Campeonatos', detail: 'Conforme calendário oficial' },
];

const trackGallery = [
  { url: '/track/aerial-day.jpg', alt: 'Vista aérea do circuito completo' },
  { url: '/track/sunset.jpg', alt: 'Última curva da pista ao entardecer' },
];

const Track = () => {
  return (
    <section id="pista" className="min-h-screen overflow-hidden bg-ink-950 text-white/80">
      <div className="relative isolate border-b border-white/10 bg-ink-900">
        <img
          src={trackGallery[0].url}
          alt=""
          aria-hidden="true"
          className="absolute inset-y-0 right-0 z-[-2] hidden h-full w-[58%] object-cover object-center opacity-20 lg:block"
        />
        <div className="absolute inset-0 z-[-1] bg-[linear-gradient(90deg,#070b08_0%,rgba(7,11,8,0.94)_48%,rgba(7,11,8,0.72)_100%)]" />

        <div className="mx-auto grid min-h-[720px] max-w-7xl grid-cols-1 items-center gap-12 px-4 py-14 md:px-8 lg:grid-cols-[1fr_0.82fr]">
          <div className="max-w-3xl">
            <a href="/" className="mb-8 inline-flex items-center gap-2 font-race text-xs italic font-bold uppercase tracking-[0.18em] text-white/55 transition-colors hover:text-primary-400">
              <ArrowLeft className="h-4 w-4" />
              Voltar para a página inicial
            </a>

            <div className="mb-5 flex items-center gap-3 font-race text-xs italic font-bold uppercase tracking-[0.16em] text-primary-400">
              <span aria-hidden="true" className="h-px w-10 bg-primary-400" />
              Circuito internacional de Betim
            </div>

            <h1 className="max-w-4xl font-display text-5xl italic uppercase leading-[0.82] tracking-tight text-white md:text-7xl lg:text-8xl">
              Pista homologada de <span className="text-primary-400">1.110m</span>
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-white/70 md:text-lg">
              Conheça o circuito do Kartódromo de Betim e entenda as características de cada configuração. Alterações de traçado são realizadas exclusivamente em campeonatos, conforme o calendário oficial.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <AngledButton href="#galeria">
                <Map className="h-4 w-4" />
                Ver a pista
              </AngledButton>
              <AngledButton href="https://wa.me/553135112373?text=Ol%C3%A1!%20Quero%20saber%20qual%20tra%C3%A7ado%20estar%C3%A1%20ativo%20na%20pista." variant="outline" external>
                <Flag className="h-4 w-4" />
                Consultar pista ativa
              </AngledButton>
            </div>
          </div>

          <div className="text-right">
            <span aria-hidden="true" className="block font-display text-[22vw] italic leading-[0.7] text-transparent [-webkit-text-stroke:1px_rgba(0,230,118,0.4)] md:text-[13vw]">
              1110
            </span>
            <span className="-mt-4 block font-race text-sm italic font-bold uppercase tracking-[0.18em] text-primary-400">
              metros de desafio
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {trackHighlights.map((item) => (
            <div
              key={item.label}
              className="border border-white/10 bg-ink-900 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary-400/35"
            >
              <span className="font-race text-[11px] italic font-bold uppercase tracking-[0.18em] text-white/50">{item.label}</span>
              <strong className="mt-2 block font-display text-4xl italic tracking-tight text-primary-400">{item.value}</strong>
              <p className="mt-2 text-sm leading-6 text-white/65">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-y border-white/10 bg-ink-900">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-16 md:px-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="max-w-xl">
            <SectionHeading eyebrow="Como ler a pista" title="Cada desenho muda o jeito de pilotar" />
            <p className="mt-5 text-sm leading-7 text-white/65">
              O circuito recebe até 42 configurações mapeadas entre traçados Normal, Invertido e Chicane, usadas conforme o calendário de campeonatos.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {trackNotes.map((note) => (
              <article key={note.title} className="border border-white/10 bg-ink-950 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary-400/35">
                <div className="mb-5 flex h-11 w-11 items-center justify-center bg-primary-400 text-ink-950">
                  <note.icon className="h-5 w-5" />
                </div>
                <h3 className="font-race text-base italic font-bold uppercase tracking-tight text-white">{note.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/65">{note.text}</p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div id="galeria" className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="mb-8 flex flex-col gap-6 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-primary-400">
              <Map className="h-5 w-5" />
              <span className="font-race text-xs italic font-bold uppercase tracking-[0.18em]">Circuito de Betim</span>
            </div>
            <h2 className="font-display text-3xl italic uppercase leading-none tracking-tight text-white md:text-5xl">
              A pista por dentro
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {trackGallery.map((track) => (
            <figure key={track.url} className="group overflow-hidden border border-white/10 bg-ink-900">
              <div className="relative aspect-[4/3] overflow-hidden bg-ink-950">
                <img
                  src={track.url}
                  alt={track.alt}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
                />
              </div>
              <figcaption className="p-4 font-race text-xs italic font-bold uppercase tracking-[0.14em] text-white/60">
                {track.alt}
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-16 grid gap-6 border border-white/10 bg-ink-900 p-5 md:grid-cols-[0.86fr_1fr] md:p-8">
          <img
            src={trackGallery[0].url}
            alt={trackGallery[0].alt}
            loading="lazy"
            className="aspect-square w-full border border-white/10 bg-ink-950 object-cover"
          />
          <div className="flex flex-col justify-center">
            <span className="mb-4 font-race text-xs italic font-bold uppercase tracking-[0.18em] text-primary-400">Informação importante</span>
            <h3 className="font-display text-3xl italic uppercase leading-none tracking-tight text-white md:text-4xl">
              Alterações de traçado são exclusivas para campeonatos.
            </h3>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/65">
              Nas baterias de lazer, treinos e eventos, é utilizado o traçado definido pelo Kartódromo. Configurações diferentes, incluindo opções com chicane ou sentido invertido, são adotadas somente em campeonatos conforme o calendário oficial.
            </p>
            <div className="mt-6">
              <AngledButton href="https://wa.me/553135112373?text=Ol%C3%A1!%20Quero%20saber%20qual%20tra%C3%A7ado%20estar%C3%A1%20ativo%20na%20pista." variant="outline" external>
                <MessageSquare className="h-4 w-4" />
                Perguntar no WhatsApp
              </AngledButton>
            </div>
          </div>
        </div>

        <div className="mt-16">
          <BigCTA
            watermark="READY"
            title={<>Sua volta começa<br /><span className="text-primary-400">agora</span></>}
            text="Consulte os horários disponíveis e venha descobrir cada setor da pista."
          >
            <AngledButton href="https://tools.mylaptime.com.br/booking?uid=5729bbc1-572b-4e32-84ec-e9e93ab08ced" external>
              Reservar corrida
            </AngledButton>
            <AngledButton href="https://wa.me/5531998842898" variant="outline" external>
              Falar no WhatsApp
            </AngledButton>
          </BigCTA>
        </div>
      </div>
    </section>
  );
};

export default Track;
