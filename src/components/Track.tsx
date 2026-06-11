import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Compass, Flag, Map, Route, RotateCcw, Timer } from 'lucide-react';
import trackImages from '../data/trackImages.json';

type TrackFilter = 'all' | 'normal' | 'invertido' | 'chicane';

const filterLabels: Record<TrackFilter, string> = {
  all: 'Todos',
  normal: 'Normal',
  invertido: 'Invertido',
  chicane: 'Chicane',
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

const getTrackType = (label: string) => {
  const normalized = label.toLowerCase();
  if (normalized.includes('invertido')) return 'Invertido';
  if (normalized.includes('chicane')) return 'Chicane';
  return 'Normal';
};

const getTrackAccent = (type: string) => {
  if (type === 'Invertido') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (type === 'Chicane') return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-zinc-100 text-zinc-800 border-zinc-200';
};

const Track = () => {
  const [activeTab, setActiveTab] = useState<TrackFilter>('all');
  const [showAllTracks, setShowAllTracks] = useState(false);

  const trackLayouts = useMemo(
    () =>
      trackImages.allTracks.map((track, index) => {
        const type = getTrackType(track.label);
        return {
          id: `${track.label}-${index}`,
          url: track.url,
          label: track.label,
          alt: track.alt,
          type,
          number: track.label.match(/\d+/)?.[0] ?? String(index + 1),
        };
      }),
    [],
  );

  const filteredTracks = trackLayouts.filter((track) => {
    if (activeTab === 'all') return true;
    return track.type.toLowerCase() === activeTab;
  });

  const visibleTracks = showAllTracks ? filteredTracks : filteredTracks.slice(0, 12);
  const featuredTrack = trackLayouts[0];
  const alternateTrack = trackLayouts.find((track) => track.label === '8 Normal') ?? trackLayouts[7] ?? featuredTrack;
  const trackHighlights = [
    { label: 'Extensão', value: '1.110m', detail: 'Circuito técnico' },
    { label: 'Traçados oficiais', value: String(trackLayouts.length), detail: 'Normal, invertido e chicane' },
    { label: 'Alterações', value: 'Campeonatos', detail: 'Conforme calendário oficial' },
  ];

  useEffect(() => {
    setShowAllTracks(false);
  }, [activeTab]);

  return (
    <section id="pista" className="min-h-screen overflow-hidden bg-[#fbfcf8] text-zinc-800">
      <div className="relative isolate border-b border-zinc-200/80 bg-[#f7faf4]">
        <img
          src={featuredTrack.url}
          alt=""
          aria-hidden="true"
          className="absolute inset-y-0 right-0 z-[-2] hidden h-full w-[58%] object-contain object-center opacity-[0.18] lg:block"
        />
        <div className="absolute inset-0 z-[-1] bg-[linear-gradient(90deg,#fbfcf8_0%,rgba(251,252,248,0.94)_48%,rgba(251,252,248,0.72)_100%)]" />
        <div className="pointer-events-none absolute inset-0 z-[-1] opacity-70 [background-image:linear-gradient(rgba(5,112,49,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(5,112,49,0.07)_1px,transparent_1px)] [background-size:56px_56px]" />

        <div className="mx-auto grid min-h-[720px] max-w-7xl grid-cols-1 items-center gap-12 px-4 py-14 md:px-8 lg:grid-cols-[1fr_0.82fr]">
          <div className="motion-rise max-w-3xl">
            <a href="/" className="mb-8 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-zinc-500 transition-colors hover:text-primary-700">
              <ArrowLeft className="h-4 w-4" />
              Voltar para a página inicial
            </a>

            <div className="mb-5 flex items-center gap-3 text-xs font-black uppercase tracking-[0.16em] text-primary-700">
              <span aria-hidden="true" className="h-px w-10 bg-primary-600" />
              Circuito internacional de Betim
            </div>

            <h1 className="max-w-4xl text-5xl font-black uppercase leading-[0.88] tracking-tight text-zinc-950 md:text-7xl lg:text-8xl">
              Pista homologada de <span className="text-primary-600">1.110m</span>
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-zinc-600 md:text-lg">
              Conheça os mapas oficiais do Kartódromo de Betim e entenda as características de cada configuração. Alterações de traçado são realizadas exclusivamente em campeonatos, conforme o calendário oficial.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#tracados"
                className="track-primary-action inline-flex items-center justify-center gap-2 rounded-lg bg-primary-500 px-6 py-3.5 text-xs font-black uppercase tracking-[0.16em] text-zinc-950 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary-400"
              >
                <Map className="h-4 w-4" />
                Ver traçados oficiais
              </a>
              <a
                href="https://wa.me/553135112373?text=Ol%C3%A1!%20Quero%20saber%20qual%20tra%C3%A7ado%20estar%C3%A1%20ativo%20na%20pista."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-[#fbfcf8] px-6 py-3.5 text-xs font-black uppercase tracking-[0.16em] text-zinc-800 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary-500/45 hover:text-primary-700"
              >
                <Flag className="h-4 w-4" />
                Consultar pista ativa
              </a>
            </div>
          </div>

          <div className="motion-rise motion-delay-1">
            <figure className="track-showcase relative mx-auto max-w-[560px] rounded-2xl border border-zinc-200 bg-[#fdfefb] p-3 shadow-[0_28px_90px_rgba(17,20,18,0.12)]">
              <img
                src={featuredTrack.url}
                alt={featuredTrack.alt}
                className="aspect-square w-full rounded-xl object-contain"
              />
              <figcaption className="mt-3 flex items-center justify-between gap-3 px-2 pb-1 text-xs font-black uppercase tracking-[0.14em] text-zinc-600">
                <span>Traçado 1 Normal</span>
                <span className="rounded-md bg-zinc-950 px-2.5 py-1 text-[#fbfcf8]">1.110m</span>
              </figcaption>
            </figure>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {trackHighlights.map((item, index) => (
            <div
              key={item.label}
              className="motion-rise rounded-xl border border-zinc-200 bg-[#fdfefb] p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary-500/35 hover:shadow-md"
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">{item.label}</span>
              <strong className="mt-2 block text-4xl font-black tracking-tight text-zinc-950">{item.value}</strong>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-y border-zinc-200/80 bg-[#eef5ed]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-16 md:px-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="max-w-xl">
            <div className="mb-4 flex items-center gap-3 text-xs font-black uppercase tracking-[0.16em] text-primary-700">
              <span aria-hidden="true" className="h-px w-10 bg-primary-600" />
              Como ler a pista
            </div>
            <h2 className="text-4xl font-black uppercase leading-none tracking-tight text-zinc-950 md:text-5xl">
              Cada desenho muda o jeito de pilotar
            </h2>
            <p className="mt-5 text-sm leading-7 text-zinc-600">
              Os mapas abaixo apresentam o sentido da volta e as diferenças entre as configurações Normal, Invertido e Chicane.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {trackNotes.map((note) => (
              <article key={note.title} className="rounded-xl border border-zinc-200 bg-[#fbfcf8] p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-primary-500 text-zinc-950">
                  <note.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-black uppercase tracking-tight text-zinc-950">{note.title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600">{note.text}</p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div id="tracados" className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="mb-8 flex flex-col gap-6 border-b border-zinc-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-primary-700">
              <Map className="h-5 w-5" />
              <span className="text-xs font-black uppercase tracking-[0.18em]">Catálogo oficial</span>
            </div>
            <h2 className="text-3xl font-black uppercase leading-none tracking-tight text-zinc-950 md:text-5xl">
              Traçados oficiais do circuito
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {(Object.keys(filterLabels) as TrackFilter[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] transition-all duration-300 ${
                  activeTab === tab
                    ? 'bg-zinc-950 text-[#fbfcf8] shadow-sm'
                    : 'border border-zinc-200 bg-[#fdfefb] text-zinc-600 hover:-translate-y-0.5 hover:border-primary-500/40 hover:text-primary-700'
                }`}
              >
                {filterLabels[tab]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleTracks.map((track, index) => (
            <article
              key={track.id}
              className="group rounded-2xl border border-zinc-200 bg-[#fdfefb] p-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary-500/40 hover:shadow-[0_22px_48px_rgba(17,20,18,0.10)]"
              style={{ animationDelay: `${Math.min(index, 11) * 35}ms` }}
            >
              <div className="relative aspect-square overflow-hidden rounded-xl bg-[#f4f8f1]">
                <img
                  src={track.url}
                  alt={track.alt}
                  loading="lazy"
                  className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.035]"
                />
                <span className="absolute left-3 top-3 rounded-md bg-[#fbfcf8]/95 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-800 shadow-sm">
                  #{track.number}
                </span>
              </div>

              <div className="px-1 pb-1 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight text-zinc-950">{track.label}</h3>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">{track.alt}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${getTrackAccent(track.type)}`}>
                    {track.type === 'Invertido' ? <RotateCcw className="h-3 w-3" /> : <Route className="h-3 w-3" />}
                    {track.type}
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
              onClick={() => setShowAllTracks(true)}
              className="rounded-lg border border-zinc-300 bg-[#fdfefb] px-6 py-3.5 text-xs font-black uppercase tracking-[0.16em] text-zinc-800 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary-500/45 hover:text-primary-700"
            >
              Mostrar todos os {filteredTracks.length} traçados
            </button>
          </div>
        )}

        <div className="mt-16 grid gap-6 rounded-2xl border border-zinc-200 bg-[#f7faf4] p-5 md:grid-cols-[0.86fr_1fr] md:p-8">
          <img
            src={alternateTrack.url}
            alt={alternateTrack.alt}
            loading="lazy"
            className="aspect-square w-full rounded-xl border border-zinc-200 bg-[#fdfefb] object-contain"
          />
          <div className="flex flex-col justify-center">
            <span className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-primary-700">Informação importante</span>
            <h3 className="text-3xl font-black uppercase leading-none tracking-tight text-zinc-950 md:text-4xl">
              Alterações de traçado são exclusivas para campeonatos.
            </h3>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-zinc-600">
              Nas baterias de lazer, treinos e eventos, é utilizado o traçado definido pelo Kartódromo. Configurações diferentes, incluindo opções com chicane ou sentido invertido, são adotadas somente em campeonatos conforme o calendário oficial.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Track;
