import React, { useEffect, useState } from 'react';
import { ArrowLeft, Trophy, Calendar, Users, ChevronRight, X, Plus, Minus, Loader2, CheckCircle, AlertCircle, MessageSquare, Flag, ClipboardCheck, Award } from 'lucide-react';
import AngledButton from './site-ui/AngledButton';
import BigCTA from './site-ui/BigCTA';
import SectionHeading from './site-ui/SectionHeading';

interface Pilot {
  nome: string;
  peso_kg: number;
}

interface Championship {
  id: string;
  evento: string;
  description: string;
  date: string;
  status: 'open' | 'past' | 'soon';
  statusLabel: string;
  logo: string;
  requiresTeamForm: boolean;
}

const championships: Championship[] = [
  {
    id: '500-milhas',
    evento: '500 Milhas de Betim',
    description: 'O maior desafio do calendário, com alto nível de competitividade e emoção. Uma corrida com 12 horas de duração que exige preparo físico, mental e estratégia apurada das equipes.',
    date: '22/08/2026',
    status: 'open',
    statusLabel: 'INSCRIÇÕES ABERTAS',
    logo: '/championships/1.png',
    requiresTeamForm: true,
  },
  {
    id: 'desafio-2h',
    evento: 'Desafio 2 Horas de Betim',
    description: 'Prova dinâmica e estratégica, com duas horas de corrida intensa. Ideal para quem busca adrenalina, constância e trabalho em equipe em um formato competitivo e equilibrado.',
    date: '08/08/2026',
    status: 'soon',
    statusLabel: 'INSCRIÇÕES SERÃO ABERTAS EM BREVE',
    logo: '/championships/3.png',
    requiresTeamForm: true,
  },
  {
    id: '200-milhas',
    evento: '200 Milhas de Betim',
    description: 'Prova com duração de 5 horas que desafia estratégia, resistência e trabalho em equipe. Uma das corridas mais tradicionais do kartismo regional, reunindo pilotos em uma disputa intensa do início ao fim.',
    date: '07/02/2026',
    status: 'past',
    statusLabel: 'JÁ ACONTECEU',
    logo: '/championships/2.png',
    requiresTeamForm: true,
  },
  {
    id: 'kac-super-kart',
    evento: 'KAC SUPER KART',
    description: 'Um campeonato anual disputado na categoria super Kart com 9 etapas, sendo uma corrida por mês, para pilotos experientes.',
    date: 'MENSAL',
    status: 'open',
    statusLabel: 'INSCRIÇÕES ABERTAS',
    logo: '/championships/4.png',
    requiresTeamForm: false,
  },
  {
    id: 'kac-iniciantes',
    evento: 'KAC INICIANTES',
    description: 'Um campeonato mensal disputado na categoria kart light para pilotos iniciantes com 8 corridas no mês. As 4 melhores corridas entram no ranking, com regulamento, calendário, pontuação e premiação oficiais.',
    date: 'MENSAL',
    status: 'open',
    statusLabel: 'INSCRIÇÕES ABERTAS',
    logo: '/championships/5.png',
    requiresTeamForm: false,
  },
];

const Championships = () => {
  const [selectedEvent, setSelectedEvent] = useState<Championship | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<'success' | 'error' | null>(null);

  // Form state
  const [nomeEquipe, setNomeEquipe] = useState('');
  const [nomeChefe, setNomeChefe] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
const [pilotos, setPilotos] = useState<Pilot[]>([{ nome: '', peso_kg: 0 }]);
const [quantidadeKarts, setQuantidadeKarts] = useState(1);
const [fullName, setFullName] = useState('');
const [cpf, setCpf] = useState('');
const [birthDate, setBirthDate] = useState('');
const [city, setCity] = useState('');
const [age, setAge] = useState('');
const [weight, setWeight] = useState('');
const [experience, setExperience] = useState('Já andei algumas vezes');
const [currentLevel, setCurrentLevel] = useState('A definir pela organização');
const [availability, setAvailability] = useState('');
const [intendedHeats, setIntendedHeats] = useState('Quero participar quando houver vaga');
const [rankingInterest, setRankingInterest] = useState('Quero entrar no ranking geral');
const [preferredRaceWindows, setPreferredRaceWindows] = useState('Sem preferência definida');
const [equipment, setEquipment] = useState('Tenho capacete próprio');
const [emergencyContactName, setEmergencyContactName] = useState('');
const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
const [medicalRestrictions, setMedicalRestrictions] = useState('');
const [goals, setGoals] = useState('');
const [notes, setNotes] = useState('');
const [acceptedContact, setAcceptedContact] = useState(false);
const [acceptedRules, setAcceptedRules] = useState(false);
const [acceptedResponsibility, setAcceptedResponsibility] = useState(false);
const [acceptedImage, setAcceptedImage] = useState(false);

  const openModal = (championship: Championship) => {
    setSelectedEvent(championship);
    setIsModalOpen(true);
    setSubmitResult(null);
    setNomeEquipe('');
    setNomeChefe('');
    setEmail('');
setTelefone('');
setPilotos([{ nome: '', peso_kg: 0 }]);
setQuantidadeKarts(1);
setFullName('');
setCpf('');
setBirthDate('');
setCity('');
setAge('');
setWeight('');
setExperience('Já andei algumas vezes');
setCurrentLevel('A definir pela organização');
setAvailability('');
setIntendedHeats('Quero participar quando houver vaga');
setRankingInterest('Quero entrar no ranking geral');
setPreferredRaceWindows('Sem preferência definida');
setEquipment('Tenho capacete próprio');
setEmergencyContactName('');
setEmergencyContactPhone('');
setMedicalRestrictions('');
setGoals('');
setNotes('');
setAcceptedContact(false);
setAcceptedRules(false);
setAcceptedResponsibility(false);
setAcceptedImage(false);
const targetHash = `#inscricao-${championship.id}`;
if (window.location.hash !== targetHash) {
window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${targetHash}`);
}
};

useEffect(() => {
const hash = window.location.hash;
if (!hash.startsWith('#inscricao')) return;

const requestedId = hash.startsWith('#inscricao-') ? hash.slice('#inscricao-'.length) : null;
const requested = requestedId ? championships.find((championship) => championship.id === requestedId) : null;
const target = requested ?? championships.find((championship) => championship.status === 'open');
if (target) openModal(target);
}, []);

const closeModal = () => {
setIsModalOpen(false);
setSelectedEvent(null);
setSubmitResult(null);
if (window.location.hash.startsWith('#inscricao')) {
window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
}
};

  const addPiloto = () => {
    setPilotos([...pilotos, { nome: '', peso_kg: 0 }]);
  };

  const removePiloto = (index: number) => {
    if (pilotos.length > 1) {
      setPilotos(pilotos.filter((_, i) => i !== index));
    }
  };

  const updatePiloto = (index: number, field: keyof Pilot, value: string | number) => {
    const updated = [...pilotos];
    if (field === 'peso_kg') {
      updated[index][field] = Number(value);
    } else {
      updated[index][field] = value as string;
    }
    setPilotos(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    setIsSubmitting(true);
    setSubmitResult(null);

const payload = selectedEvent.requiresTeamForm
? {
evento: selectedEvent.evento,
modalidade: 'equipe',
nome_da_equipe: nomeEquipe.trim(),
nome_do_chefe_da_equipe: nomeChefe.trim(),
email: email.trim(),
telefone: telefone.trim(),
pilotos: pilotos.filter((p) => p.nome.trim() !== ''),
quantidade_karts_no_campeonato: quantidadeKarts,
pagamento: 'PENDENTE',
}
: {
evento: selectedEvent.evento,
modalidade: 'individual',
fullName: fullName.trim(),
cpf: cpf.trim(),
birthDate: birthDate.trim(),
whatsapp: telefone.trim(),
email: email.trim(),
city: city.trim(),
age: age.trim(),
weight: weight.trim(),
experience,
currentLevel,
availability: availability.trim(),
intendedHeats,
rankingInterest,
preferredRaceWindows,
equipment,
emergencyContactName: emergencyContactName.trim(),
emergencyContactPhone: emergencyContactPhone.trim(),
medicalRestrictions: medicalRestrictions.trim(),
goals: goals.trim(),
notes: notes.trim(),
acceptedContact,
acceptedRules,
acceptedResponsibility,
acceptedImage,
pagamento: 'PENDENTE',
};

    try {
      const response = await fetch('/api/inscricao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setSubmitResult('success');
      } else {
        setSubmitResult('error');
      }
    } catch {
      setSubmitResult('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string, label: string) => {
    const styles: Record<string, string> = {
      open: 'bg-primary-400/10 text-primary-400 border border-primary-400/30',
      past: 'bg-white/5 text-white/40 border border-white/10',
      soon: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/25',
    };
    return (
      <span className={`inline-flex items-center whitespace-nowrap px-3 py-1 font-race text-[11px] italic font-bold uppercase tracking-wider ${styles[status] || styles.soon}`}>
        {label}
      </span>
    );
  };

  return (
    <section className="min-h-screen bg-ink-950 text-white/80">
      <div className="relative isolate overflow-hidden border-b border-white/10 bg-ink-900 pt-10">
        <div className="container relative mx-auto grid gap-10 px-4 py-14 md:grid-cols-[1fr_auto] md:items-center md:px-8">
          <div className="max-w-3xl">
            <a href="/" className="mb-8 inline-flex min-h-[44px] items-center gap-2 font-race text-xs italic font-bold uppercase tracking-[0.18em] text-white/55 transition-colors hover:text-primary-400">
              <ArrowLeft className="h-4 w-4" />
              Voltar para a página inicial
            </a>

            <div className="mb-5 flex items-center gap-3 font-race text-xs italic font-bold uppercase tracking-[0.16em] text-primary-400">
              <span aria-hidden="true" className="h-px w-10 bg-primary-400" />
              Calendário competitivo
            </div>

            <h1 className="max-w-2xl font-display text-5xl italic uppercase leading-[0.82] tracking-tight text-white md:text-7xl">
              A temporada <span className="text-primary-400">começa aqui</span>
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-white/70 md:text-lg">
              Faça parte da história do automobilismo mineiro. Inscreva sua equipe e acelere nas competições mais disputadas da região.
            </p>
          </div>

          <div className="text-right">
            <span aria-hidden="true" className="block font-display text-[16vw] italic leading-[0.7] text-transparent [-webkit-text-stroke:1px_rgba(0,230,118,0.4)] md:text-[7vw]">
              2026
            </span>
            <span className="-mt-2 block font-race text-sm italic font-bold uppercase tracking-[0.18em] text-primary-400">
              temporada oficial
            </span>
          </div>
        </div>

        <div className="border-t border-white/10 bg-ink-950/60">
          <div className="container mx-auto grid grid-cols-2 divide-x divide-white/10 px-4 md:grid-cols-4 md:px-8">
            {[
              { icon: Calendar, title: 'Temporada 2026', text: 'Etapas ao longo do ano' },
              { icon: Users, title: 'Pilotos e equipes', text: 'Categorias para diferentes níveis' },
              { icon: Trophy, title: 'Premiação oficial', text: 'Troféus e classificação acumulada' },
              { icon: Flag, title: 'Regras publicadas', text: 'Regulamentos para download' },
            ].map((item) => (
              <div key={item.title} className="flex items-center gap-3 p-5">
                <item.icon className="h-6 w-6 flex-shrink-0 text-primary-400" />
                <div>
                  <strong className="block font-race text-sm italic font-bold uppercase text-white">{item.title}</strong>
                  <span className="text-xs text-white/50">{item.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-20 md:px-8">
        {/* Championship Cards */}
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2">
          {championships.map((champ) => (
            <div
              key={champ.id}
              className={`flex flex-col justify-between border border-white/10 bg-ink-900 p-7 transition-all duration-300 hover:-translate-y-1 hover:border-primary-400/40 ${
                champ.status === 'past' ? 'opacity-[0.55]' : ''
              }`}
            >
              <div>
                <div className="mb-5 flex items-start justify-between gap-4">
                  <img
                    src={champ.logo}
                    alt={`Logo ${champ.evento}`}
                    className="h-20 w-20 object-contain"
                  />
                  {getStatusBadge(champ.status, champ.statusLabel)}
                </div>

                <h2 className="font-display text-2xl italic uppercase leading-[0.9] tracking-tight text-white">{champ.evento}</h2>

                <p className="mt-4 text-sm font-light leading-relaxed text-white/65">{champ.description}</p>

                <div className="mb-6 mt-5 flex items-center font-race text-xs italic font-bold uppercase tracking-wider text-white/50">
                  <Calendar className="mr-2 h-4 w-4 text-primary-400" />
                  <span>Calendário / Data: {champ.date}</span>
                </div>

                {/* Requirements Box */}
                <div className="mb-6 border border-white/10 bg-ink-950 p-5">
                  <h4 className="mb-3 font-race text-xs italic font-bold uppercase tracking-widest text-white">
                    Dados de Inscrição Necessários
                  </h4>
                  {champ.requiresTeamForm ? (
                    <ul className="space-y-2 text-xs font-light text-white/60">
                      <li className="flex items-center"><ChevronRight className="w-3.5 h-3.5 mr-1.5 text-primary-400" /> Nome oficial da equipe</li>
                      <li className="flex items-center"><ChevronRight className="w-3.5 h-3.5 mr-1.5 text-primary-400" /> Nome do chefe de equipe</li>
                      <li className="flex items-center"><ChevronRight className="w-3.5 h-3.5 mr-1.5 text-primary-400" /> Nome dos pilotos e peso individual em kg</li>
                      <li className="flex items-center"><ChevronRight className="w-3.5 h-3.5 mr-1.5 text-primary-400" /> Quantidade de karts participantes no campeonato</li>
                    </ul>
                  ) : (
                    <ul className="space-y-2 text-xs font-light text-white/60">
                      <li className="flex items-center"><ChevronRight className="w-3.5 h-3.5 mr-1.5 text-primary-400" /> Taxa de inscrição única do campeonato</li>
                      <li className="flex items-center"><ChevronRight className="w-3.5 h-3.5 mr-1.5 text-primary-400" /> Pagamento individual de cada etapa corrida</li>
                    </ul>
                  )}
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-3 border-t border-white/10 pt-6">
                {champ.status === 'open' && champ.requiresTeamForm && (
                  <button
                    type="button"
                    onClick={() => openModal(champ)}
                    className="flex items-center justify-center gap-2 bg-gradient-to-br from-primary-400 to-primary-600 px-6 py-3.5 font-race text-xs italic font-bold uppercase tracking-wider text-ink-950 [clip-path:polygon(7%_0,100%_0,93%_100%,0_100%)]"
                  >
                    <Users className="h-4 w-4" />
                    Formulário de Inscrição
                  </button>
                )}
                {champ.status === 'open' && !champ.requiresTeamForm && (
                  <button
                    type="button"
                    onClick={() => openModal(champ)}
                    className="flex items-center justify-center gap-2 bg-gradient-to-br from-primary-400 to-primary-600 px-6 py-3.5 font-race text-xs italic font-bold uppercase tracking-wider text-ink-950 [clip-path:polygon(7%_0,100%_0,93%_100%,0_100%)]"
                  >
                    <Users className="h-4 w-4" />
                    Inscrição do Piloto
                  </button>
                )}
                {champ.id === 'kac-iniciantes' && (
                  <a
                    href="/campeonatos/kac"
                    className="flex items-center justify-center gap-2 border border-white/15 bg-white/5 px-6 py-3.5 font-race text-xs italic font-bold uppercase tracking-wider text-white transition-colors hover:border-primary-400/40"
                  >
                    <Trophy className="h-4 w-4 text-primary-400" />
                    Acesse a Página do KAC
                  </a>
                )}
                {champ.id === 'kac-super-kart' && (
                  <a
                    href="/campeonatos/kac-super"
                    className="flex items-center justify-center gap-2 border border-white/15 bg-white/5 px-6 py-3.5 font-race text-xs italic font-bold uppercase tracking-wider text-white transition-colors hover:border-primary-400/40"
                  >
                    <Trophy className="h-4 w-4 text-primary-400" />
                    Página Oficial
                  </a>
                )}
                {champ.id === '200-milhas' && (
                  <a
                    href="/campeonatos/200-milhas"
                    className="flex items-center justify-center gap-2 border border-white/15 bg-white/5 px-6 py-3.5 font-race text-xs italic font-bold uppercase tracking-wider text-white transition-colors hover:border-primary-400/40"
                  >
                    <Trophy className="h-4 w-4 text-primary-400" />
                    Página Oficial
                  </a>
                )}
                {champ.id === '500-milhas' && (
                  <a
                    href="/campeonatos/500-milhas"
                    className="flex items-center justify-center gap-2 border border-white/15 bg-white/5 px-6 py-3.5 font-race text-xs italic font-bold uppercase tracking-wider text-white transition-colors hover:border-primary-400/40"
                  >
                    <Trophy className="h-4 w-4 text-primary-400" />
                    Página Oficial
                  </a>
                )}
                {champ.status === 'open' && (
                  <a
                    href={`https://wa.me/5531998842898?text=Ol%C3%A1!%20Gostaria%20de%20saber%20valores%20e%20regulamento%20para%20o%20campeonato%20${encodeURIComponent(champ.evento)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 border border-white/15 bg-white/5 px-6 py-3.5 font-race text-xs italic font-bold uppercase tracking-wider text-white transition-colors hover:border-primary-400/40"
                  >
                    <MessageSquare className="h-4 w-4 text-primary-400" />
                    Valores via WhatsApp
                  </a>
                )}
                {champ.status === 'past' && (
                  <span className="border border-white/10 bg-white/5 px-6 py-3.5 font-race text-xs italic font-bold uppercase tracking-wider text-white/35">
                    Inscrições Encerradas
                  </span>
                )}
                {champ.status === 'soon' && (
                  <span className="border border-yellow-500/25 bg-yellow-500/10 px-6 py-3.5 font-race text-xs italic font-bold uppercase tracking-wider text-yellow-400">
                    Em Breve / Pré-Inscrições
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Evolução competitiva */}
        <div className="mx-auto mt-20 max-w-6xl">
          <SectionHeading eyebrow="Evolução competitiva" title={<>Do primeiro grid<br /><span className="text-primary-400">à longa duração</span></>} />
          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/65">
            Comece no KAC Iniciantes, evolua para o Super Kart e descubra o trabalho de equipe nas provas de endurance.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-px border border-white/10 bg-white/10 md:grid-cols-3">
            {[
              { icon: Flag, title: 'KAC Iniciantes', text: 'Aprenda a competir com formato mensal e ambiente de evolução.' },
              { icon: ClipboardCheck, title: 'KAC Super Kart', text: 'Dispute uma temporada anual com pilotos mais experientes.' },
              { icon: Award, title: 'Endurance', text: 'Divida estratégia, ritmo e responsabilidade com sua equipe.' },
            ].map((step, index) => (
              <div key={step.title} className="bg-ink-900 p-7">
                <span className="font-display text-3xl italic text-primary-400">0{index + 1}</span>
                <h3 className="mt-4 font-race text-base italic font-bold uppercase text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/65">{step.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* WhatsApp Banner */}
        <div className="mx-auto mt-16 max-w-6xl">
          <BigCTA
            watermark="GRID"
            title={<>Escolha sua categoria<br /><span className="text-primary-400">e entre no grid</span></>}
            text="A organização orienta sobre inscrições, pesos, regras e vagas disponíveis."
          >
            <AngledButton href="https://wa.me/5531998842898?text=Ol%C3%A1!%20Gostaria%20de%20receber%20regulamentos%20e%20valores%20dos%20campeonatos%20do%20Kart%C3%B3dromo." external>
              <MessageSquare className="h-4 w-4" />
              Falar com a organização
            </AngledButton>
            <AngledButton href="https://wa.me/5531998842898" variant="outline" external>
              Falar no WhatsApp
            </AngledButton>
          </BigCTA>
        </div>
      </div>

      {/* Registration Modal */}
      {isModalOpen && selectedEvent && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="registration-modal-title"
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto border border-white/10 bg-ink-900 text-white/80"
          >
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-ink-900/95 px-6 py-5 backdrop-blur-sm">
              <div>
                <h3 id="registration-modal-title" className="font-race text-lg italic font-bold uppercase tracking-wider text-white">Formulário de Inscrição</h3>
                <p className="text-xs font-bold text-primary-400">{selectedEvent.evento}</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Fechar formulário de inscrição"
                className="flex h-8 w-8 items-center justify-center border border-white/15 bg-white/5 text-white/60 transition-all hover:border-red-500/50 hover:text-red-500 focus:outline-none"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Success State */}
            {submitResult === 'success' && (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-primary-400/10 border border-primary-400/30 rounded-full flex items-center justify-center mx-auto mb-4 text-primary-400">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h4 className="font-display text-xl italic uppercase mb-2 text-white">Inscrição Enviada!</h4>
                <p className="text-white/65 text-sm mb-8 font-light leading-relaxed">
                  Os dados da sua equipe foram cadastrados com sucesso. Entre em contato pelo WhatsApp para concluir o pagamento e confirmar o grid.
                </p>
                <a
                  href={`https://wa.me/5531998842898?text=Ol%C3%A1!%20Acabei%20de%20enviar%20o%20formul%C3%A1rio%20de%20inscri%C3%A7%C3%A3o%20para%20o%20campeonato%20${encodeURIComponent(selectedEvent.evento)}.%20Gostaria%20do%20link%20de%20pagamento.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-gradient-to-br from-primary-400 to-primary-600 px-6 py-3.5 font-race text-xs italic font-bold uppercase tracking-wider text-ink-950 [clip-path:polygon(7%_0,100%_0,93%_100%,0_100%)]"
                >
                  <MessageSquare className="w-4 h-4" />
                  Concluir no WhatsApp
                </a>
              </div>
            )}

            {/* Error State */}
            {submitResult === 'error' && (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-500/10 border border-red-500/25 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h4 className="font-display text-xl italic uppercase mb-2 text-white">Erro ao Enviar</h4>
                <p className="text-white/65 text-sm mb-8 font-light leading-relaxed">
                  Não foi possível processar o formulário. Você pode preencher os dados diretamente via chat do WhatsApp se o problema persistir.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    type="button"
                    onClick={() => setSubmitResult(null)}
                    className="px-5 py-3 border border-white/15 bg-white/5 hover:border-white/25 text-white font-race text-xs italic font-bold uppercase tracking-wider transition-colors"
                  >
                    Tentar Novamente
                  </button>
                  <a
                    href="https://wa.me/5531998842898"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 bg-gradient-to-br from-primary-400 to-primary-600 px-5 py-3 font-race text-xs italic font-bold uppercase tracking-wider text-ink-950 [clip-path:polygon(7%_0,100%_0,93%_100%,0_100%)]"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Enviar pelo Whats
                  </a>
                </div>
              </div>
            )}

            {/* Form Fields */}
{!submitResult && (
<form onSubmit={handleSubmit} className="p-6 space-y-5">
{selectedEvent.requiresTeamForm ? (
<>
{/* Nome da Equipe */}
<div>
                  <label htmlFor="team-name" className="block text-xs font-race italic font-bold text-white/50 uppercase tracking-wider mb-1.5">
                    Nome da Equipe *
                  </label>
                  <input
                    id="team-name"
                    type="text"
                    required
                    value={nomeEquipe}
                    onChange={(e) => setNomeEquipe(e.target.value)}
                    className="w-full px-4 py-3 bg-ink-900 border border-white/15 focus:border-primary-400 outline-none text-white text-sm transition-all focus:ring-1 focus:ring-primary-400"
                    placeholder="Ex: Minas Racing Team"
                  />
                </div>

                {/* Nome do Chefe */}
                <div>
                  <label htmlFor="team-leader" className="block text-xs font-race italic font-bold text-white/50 uppercase tracking-wider mb-1.5">
                    Nome do Chefe de Equipe *
                  </label>
                  <input
                    id="team-leader"
                    type="text"
                    required
                    value={nomeChefe}
                    onChange={(e) => setNomeChefe(e.target.value)}
                    className="w-full px-4 py-3 bg-ink-900 border border-white/15 focus:border-primary-400 outline-none text-white text-sm transition-all focus:ring-1 focus:ring-primary-400"
                    placeholder="Nome completo do responsável"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="team-phone" className="block text-xs font-race italic font-bold text-white/50 uppercase tracking-wider mb-1.5">
                      WhatsApp do Responsável
                    </label>
                    <input
                      id="team-phone"
                      type="tel"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      className="w-full px-4 py-3 bg-ink-900 border border-white/15 focus:border-primary-400 outline-none text-white text-sm transition-all focus:ring-1 focus:ring-primary-400"
                      placeholder="(31) 99999-9999"
                    />
                  </div>
                  <div>
                    <label htmlFor="team-email" className="block text-xs font-race italic font-bold text-white/50 uppercase tracking-wider mb-1.5">
                      E-mail
                    </label>
                    <input
                      id="team-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-ink-900 border border-white/15 focus:border-primary-400 outline-none text-white text-sm transition-all focus:ring-1 focus:ring-primary-400"
                      placeholder="equipe@email.com"
                    />
                  </div>
                </div>

                {/* Pilotos List */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-race italic font-bold text-white/50 uppercase tracking-wider">
                      Pilotos e Pesos *
                    </label>
                    <button
                      type="button"
                      onClick={addPiloto}
                      className="inline-flex items-center text-xs text-primary-700 hover:text-primary-800 font-bold uppercase tracking-wider"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Adicionar Piloto
                    </button>
                  </div>
                  <div className="space-y-3">
                    {pilotos.map((piloto, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <div className="flex-1">
                          <input
                            id={`pilot-name-${index}`}
                            type="text"
                            required
                            value={piloto.nome}
                            onChange={(e) => updatePiloto(index, 'nome', e.target.value)}
                            aria-label={`Nome do piloto ${index + 1}`}
                            className="w-full px-3 py-2.5 bg-ink-900 border border-white/15 focus:border-primary-400 outline-none text-white text-xs transition-all"
                            placeholder={`Piloto ${index + 1}`}
                          />
                        </div>
                        <div className="w-28">
                          <input
                            id={`pilot-weight-${index}`}
                            type="number"
                            required
                            min={30}
                            max={200}
                            value={piloto.peso_kg || ''}
                            onChange={(e) => updatePiloto(index, 'peso_kg', e.target.value)}
                            aria-label={`Peso do piloto ${index + 1} em kg`}
                            className="w-full px-3 py-2.5 bg-ink-900 border border-white/15 focus:border-primary-400 outline-none text-white text-xs text-center transition-all"
                            placeholder="Peso (kg)"
                          />
                        </div>
                        {pilotos.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePiloto(index)}
                            aria-label={`Remover piloto ${index + 1}`}
                            className="w-9 h-9 flex items-center justify-center bg-white/5 border border-white/15 hover:border-red-500/50 text-red-400 hover:text-red-400 transition-colors flex-shrink-0"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quantidade de Karts */}
                <div>
                  <label htmlFor="kart-count" className="block text-xs font-race italic font-bold text-white/50 uppercase tracking-wider mb-1.5">
                    Quantidade de Karts no Campeonato *
                  </label>
<input
id="kart-count"
                    type="number"
                    required
                    min={1}
                    max={50}
                    value={quantidadeKarts}
                    onChange={(e) => setQuantidadeKarts(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-ink-900 border border-white/15 focus:border-primary-400 outline-none text-white text-sm transition-all focus:ring-1 focus:ring-primary-400"
/>
</div>
</>
) : (
<>
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
<div className="sm:col-span-2">
<label htmlFor="driver-name" className="block text-xs font-race italic font-bold text-white/50 uppercase tracking-wider mb-1.5">
Nome completo *
</label>
<input id="driver-name" type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-4 py-3 bg-ink-900 border border-white/15 focus:border-primary-400 outline-none text-white text-sm transition-all focus:ring-1 focus:ring-primary-400" placeholder="Nome e sobrenome" />
</div>
<div>
<label htmlFor="driver-phone" className="block text-xs font-race italic font-bold text-white/50 uppercase tracking-wider mb-1.5">WhatsApp *</label>
<input id="driver-phone" type="tel" required value={telefone} onChange={(e) => setTelefone(e.target.value)} className="w-full px-4 py-3 bg-ink-900 border border-white/15 focus:border-primary-400 outline-none text-white text-sm transition-all focus:ring-1 focus:ring-primary-400" placeholder="(31) 99999-9999" />
</div>
<div>
<label htmlFor="driver-email" className="block text-xs font-race italic font-bold text-white/50 uppercase tracking-wider mb-1.5">E-mail *</label>
<input id="driver-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 bg-ink-900 border border-white/15 focus:border-primary-400 outline-none text-white text-sm transition-all focus:ring-1 focus:ring-primary-400" placeholder="piloto@email.com" />
</div>
<div>
<label htmlFor="driver-cpf" className="block text-xs font-race italic font-bold text-white/50 uppercase tracking-wider mb-1.5">CPF</label>
<input id="driver-cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} className="w-full px-4 py-3 bg-ink-900 border border-white/15 focus:border-primary-400 outline-none text-white text-sm transition-all focus:ring-1 focus:ring-primary-400" placeholder="000.000.000-00" />
</div>
<div>
<label htmlFor="driver-birth" className="block text-xs font-race italic font-bold text-white/50 uppercase tracking-wider mb-1.5">Nascimento</label>
<input id="driver-birth" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="w-full px-4 py-3 bg-ink-900 border border-white/15 focus:border-primary-400 outline-none text-white text-sm transition-all focus:ring-1 focus:ring-primary-400" placeholder="dd/mm/aaaa" />
</div>
<div>
<label htmlFor="driver-city" className="block text-xs font-race italic font-bold text-white/50 uppercase tracking-wider mb-1.5">Cidade</label>
<input id="driver-city" value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-4 py-3 bg-ink-900 border border-white/15 focus:border-primary-400 outline-none text-white text-sm transition-all focus:ring-1 focus:ring-primary-400" placeholder="Betim / MG" />
</div>
<div className="grid grid-cols-2 gap-3">
<div>
<label htmlFor="driver-age" className="block text-xs font-race italic font-bold text-white/50 uppercase tracking-wider mb-1.5">Idade</label>
<input id="driver-age" type="number" min={8} max={90} value={age} onChange={(e) => setAge(e.target.value)} className="w-full px-4 py-3 bg-ink-900 border border-white/15 focus:border-primary-400 outline-none text-white text-sm transition-all focus:ring-1 focus:ring-primary-400" />
</div>
<div>
<label htmlFor="driver-weight" className="block text-xs font-race italic font-bold text-white/50 uppercase tracking-wider mb-1.5">Peso kg</label>
<input id="driver-weight" type="number" min={30} max={180} value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full px-4 py-3 bg-ink-900 border border-white/15 focus:border-primary-400 outline-none text-white text-sm transition-all focus:ring-1 focus:ring-primary-400" />
</div>
</div>
</div>

<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
<div>
<label htmlFor="driver-experience" className="block text-xs font-race italic font-bold text-white/50 uppercase tracking-wider mb-1.5">Experiência</label>
<select id="driver-experience" value={experience} onChange={(e) => setExperience(e.target.value)} className="w-full px-4 py-3 bg-ink-900 border border-white/15 focus:border-primary-400 outline-none text-white text-sm transition-all focus:ring-1 focus:ring-primary-400">
<option>Nunca corri campeonato</option>
<option>Já andei algumas vezes</option>
<option>Corro mensalmente</option>
<option>Tenho experiência em campeonatos</option>
</select>
</div>
<div>
<label htmlFor="driver-level" className="block text-xs font-race italic font-bold text-white/50 uppercase tracking-wider mb-1.5">Nível atual</label>
<select id="driver-level" value={currentLevel} onChange={(e) => setCurrentLevel(e.target.value)} className="w-full px-4 py-3 bg-ink-900 border border-white/15 focus:border-primary-400 outline-none text-white text-sm transition-all focus:ring-1 focus:ring-primary-400">
<option>A definir pela organização</option>
<option>Estreante</option>
<option>Intermediário</option>
<option>Competitivo</option>
</select>
</div>
<div>
<label htmlFor="driver-heats" className="block text-xs font-race italic font-bold text-white/50 uppercase tracking-wider mb-1.5">Participação desejada</label>
<select id="driver-heats" value={intendedHeats} onChange={(e) => setIntendedHeats(e.target.value)} className="w-full px-4 py-3 bg-ink-900 border border-white/15 focus:border-primary-400 outline-none text-white text-sm transition-all focus:ring-1 focus:ring-primary-400">
<option>Quero participar quando houver vaga</option>
<option>Quero correr o máximo de etapas possível</option>
<option>Quero baterias avulsas</option>
</select>
</div>
<div>
<label htmlFor="driver-ranking" className="block text-xs font-race italic font-bold text-white/50 uppercase tracking-wider mb-1.5">Ranking</label>
<select id="driver-ranking" value={rankingInterest} onChange={(e) => setRankingInterest(e.target.value)} className="w-full px-4 py-3 bg-ink-900 border border-white/15 focus:border-primary-400 outline-none text-white text-sm transition-all focus:ring-1 focus:ring-primary-400">
<option>Quero entrar no ranking geral</option>
<option>Quero entender regras antes de decidir</option>
<option>Quero apenas experiência avulsa</option>
</select>
</div>
<div>
<label htmlFor="driver-window" className="block text-xs font-race italic font-bold text-white/50 uppercase tracking-wider mb-1.5">Janelas preferidas</label>
<input id="driver-window" value={preferredRaceWindows} onChange={(e) => setPreferredRaceWindows(e.target.value)} className="w-full px-4 py-3 bg-ink-900 border border-white/15 focus:border-primary-400 outline-none text-white text-sm transition-all focus:ring-1 focus:ring-primary-400" />
</div>
<div>
<label htmlFor="driver-equipment" className="block text-xs font-race italic font-bold text-white/50 uppercase tracking-wider mb-1.5">Equipamento</label>
<select id="driver-equipment" value={equipment} onChange={(e) => setEquipment(e.target.value)} className="w-full px-4 py-3 bg-ink-900 border border-white/15 focus:border-primary-400 outline-none text-white text-sm transition-all focus:ring-1 focus:ring-primary-400">
<option>Tenho capacete próprio</option>
<option>Preciso de capacete do kartódromo</option>
<option>Tenho equipamento completo</option>
</select>
</div>
</div>

<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
<div>
<label htmlFor="emergency-name" className="block text-xs font-race italic font-bold text-white/50 uppercase tracking-wider mb-1.5">Contato de emergência</label>
<input id="emergency-name" value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} className="w-full px-4 py-3 bg-ink-900 border border-white/15 focus:border-primary-400 outline-none text-white text-sm transition-all focus:ring-1 focus:ring-primary-400" placeholder="Nome" />
</div>
<div>
<label htmlFor="emergency-phone" className="block text-xs font-race italic font-bold text-white/50 uppercase tracking-wider mb-1.5">Telefone emergência</label>
<input id="emergency-phone" value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} className="w-full px-4 py-3 bg-ink-900 border border-white/15 focus:border-primary-400 outline-none text-white text-sm transition-all focus:ring-1 focus:ring-primary-400" placeholder="(31) 99999-9999" />
</div>
</div>

<textarea value={goals} onChange={(e) => setGoals(e.target.value)} className="w-full min-h-24 px-4 py-3 bg-ink-900 border border-white/15 focus:border-primary-400 outline-none text-white text-sm transition-all focus:ring-1 focus:ring-primary-400" placeholder="Objetivo no campeonato" />
<textarea value={medicalRestrictions} onChange={(e) => setMedicalRestrictions(e.target.value)} className="w-full min-h-20 px-4 py-3 bg-ink-900 border border-white/15 focus:border-primary-400 outline-none text-white text-sm transition-all focus:ring-1 focus:ring-primary-400" placeholder="Restrições médicas, alergias ou medicamentos" />
<textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full min-h-20 px-4 py-3 bg-ink-900 border border-white/15 focus:border-primary-400 outline-none text-white text-sm transition-all focus:ring-1 focus:ring-primary-400" placeholder="Observações operacionais" />

<div className="space-y-3 border border-white/15 bg-ink-900 p-4 text-xs text-white/70">
{[
['contact', acceptedContact, setAcceptedContact, 'Autorizo contato por WhatsApp ou e-mail para confirmação de vaga.'],
['rules', acceptedRules, setAcceptedRules, 'Declaro ciência de que devo seguir regulamento, briefing e decisões da organização.'],
['responsibility', acceptedResponsibility, setAcceptedResponsibility, 'Declaro estar apto a participar e assumo responsabilidade pelas informações enviadas.'],
['image', acceptedImage, setAcceptedImage, 'Autorizo uso de imagem em registros e divulgação do campeonato.'],
].map(([key, checked, setter, label]) => (
<label key={String(key)} className="flex gap-3">
<input type="checkbox" checked={Boolean(checked)} onChange={(e) => (setter as React.Dispatch<React.SetStateAction<boolean>>)(e.target.checked)} className="mt-0.5" required />
<span>{String(label)}</span>
</label>
))}
</div>
</>
)}

{/* Info Text */}
                <div className="bg-primary-400/10 border border-primary-400/25 p-4 text-xs text-primary-300 leading-relaxed font-light">
                  <strong>Nota sobre pagamento:</strong> Após a submissão do formulário, as inscrições ficam no status pendente até a validação do Pix ou boleto de cobrança com o chefe de equipe via WhatsApp.
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 bg-gradient-to-br from-primary-400 to-primary-600 py-3.5 font-race text-xs italic font-bold uppercase tracking-wider text-ink-950 [clip-path:polygon(3%_0,100%_0,97%_100%,0_100%)] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processando inscrição...
                    </>
                  ) : (
                    'Confirmar e Enviar Inscrição'
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default Championships;
