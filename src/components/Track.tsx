import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Compass, Flag, Map, MessageSquare, Route, RotateCcw, Timer } from 'lucide-react';
import { trackLayouts, type TrackVariantKey } from '../data/trackLayouts';
import AngledButton from './site-ui/AngledButton';
import BigCTA from './site-ui/BigCTA';
import SectionHeading from './site-ui/SectionHeading';

type TrackFilter = 'all' | TrackVariantKey;

const filterLabels: Record<TrackFilter, string> = {
  all: 'Todos',
  normal: 'Normal',
  invertido: 'Invertido',
  'invertido-chicane': 'Invertido + Chicane',
};

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
  { label: 'Configurações mapeadas', value: String(trackLayouts.length), detail: 'Normal, invertido e chicane' },
  { label: 'Alterações', value: 'Campeonatos', detail: 'Conforme calendário oficial' },
];

const getVariantAccent = (variant: TrackVariantKey) => {
  if (variant === 'invertido') return 'bg-primary-400/10 text-primary-300 border-primary-400/30';
  if (variant === 'invertido-chicane') return 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30';
  return 'bg-white/5 text-white/60 border-white/15';
};

const Track = () => {
  const [activeTab, setActiveTab] = useState<TrackFilter>('all');
  const [showAll, setShowAll] = useState(false);

  const filteredTracks = useMemo(
    () => (activeTab === 'all' ? trackLayouts : trackLayouts.filter((track) => track.variant === activeTab)),
    [activeTab],
  );

  const visibleTracks = showAll ? filteredTracks : filteredTracks.slice(0, 12);
  const featuredTrack = trackLayouts[0];

  useEffect(() => {
    setShowAll(false);
  }, [activeTab]);

  return (
    <section id="pista" className="min-h-screen overflow-hidden bg-ink-950 text-white/80">
      <div className="relative isolate border-b border-white/10 bg-ink-900">
        <img
          src="/track/aerial-day.jpg"
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
              Conheça os mapas oficiais do Kartódromo de Betim e entenda as características de cada configuração. Alterações de traçado são realizadas exclusivamente em campeonatos, conforme o calendário oficial.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <AngledButton href="#tracados">
                <Map className="h-4 w-4" />
                Ver traçados oficiais
              </AngledButton>
              <AngledButton href="https://wa.me/5531998842898?text=Ol%C3%A1!%20Quero%20saber%20qual%20tra%C3%A7ado%20estar%C3%A1%20ativo%20na%20pista." variant="outline" external>
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
              Os mapas abaixo apresentam o sentido da volta e as diferenças entre as configurações Normal, Invertido e Invertido com chicane.
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

      <div id="tracados" className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="mb-8 flex flex-col gap-6 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-primary-400">
              <Map className="h-5 w-5" />
              <span className="font-race text-xs italic font-bold uppercase tracking-[0.18em]">Catálogo oficial</span>
            </div>
            <h2 className="font-display text-3xl italic uppercase leading-none tracking-tight text-white md:text-5xl">
              Traçados oficiais do circuito
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {(Object.keys(filterLabels) as TrackFilter[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 font-race text-xs italic font-bold uppercase tracking-[0.14em] transition-all duration-300 ${
                  activeTab === tab
                    ? 'bg-primary-400 text-ink-950'
                    : 'border border-white/15 bg-white/5 text-white/60 hover:-translate-y-0.5 hover:border-primary-400/40 hover:text-primary-400'
                }`}
              >
                {filterLabels[tab]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleTracks.map((track) => (
            <article
              key={track.id}
              className="group border border-white/10 bg-ink-900 p-3 transition-all duration-300 hover:-translate-y-1 hover:border-primary-400/40"
            >
              <div className="relative aspect-square overflow-hidden bg-white">
                <img
                  src={track.url}
                  alt={track.label}
                  loading="lazy"
                  className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.035]"
                />
                <span className="absolute left-3 top-3 bg-ink-950 px-2.5 py-1 font-race text-[10px] italic font-bold uppercase tracking-[0.16em] text-white">
                  #{track.number}
                </span>
              </div>

              <div className="px-1 pb-1 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-race text-sm italic font-bold uppercase tracking-tight text-white">Traçado {track.number}</h3>
                  <span className={`inline-flex items-center gap-1 border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${getVariantAccent(track.variant)}`}>
                    {track.variant === 'invertido' ? <RotateCcw className="h-3 w-3" /> : <Route className="h-3 w-3" />}
                    {track.variantLabel}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>

        {filteredTracks.length > visibleTracks.length && (
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="border border-white/15 bg-white/5 px-6 py-3.5 font-race text-xs italic font-bold uppercase tracking-[0.16em] text-white/70 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary-400/40 hover:text-primary-400"
            >
              Mostrar todos os {filteredTracks.length} traçados
            </button>
          </div>
        )}

        <div className="mt-16 grid gap-6 border border-white/10 bg-ink-900 p-5 md:grid-cols-[0.86fr_1fr] md:p-8">
          <img
            src={featuredTrack.url}
            alt={featuredTrack.label}
            loading="lazy"
            className="aspect-square w-full border border-white/10 bg-white object-contain"
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
              <AngledButton href="https://wa.me/5531998842898?text=Ol%C3%A1!%20Quero%20saber%20qual%20tra%C3%A7ado%20estar%C3%A1%20ativo%20na%20pista." variant="outline" external>
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
