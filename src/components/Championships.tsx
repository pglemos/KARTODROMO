import React, { useEffect, useState } from 'react';
import { ArrowLeft, Trophy, Calendar, Users, ChevronRight, X, Plus, Minus, Loader2, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react';

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
if (window.location.hash !== '#inscricao') {
window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#inscricao`);
}
};

useEffect(() => {
if (window.location.hash === '#inscricao') {
const firstOpenChampionship = championships.find((championship) => championship.status === 'open');
if (firstOpenChampionship) openModal(firstOpenChampionship);
}
}, []);

const closeModal = () => {
setIsModalOpen(false);
setSelectedEvent(null);
setSubmitResult(null);
if (window.location.hash === '#inscricao') {
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
      open: 'bg-primary-50 text-primary-700 border border-primary-500/20',
      past: 'bg-zinc-100 text-zinc-500 border border-zinc-200',
      soon: 'bg-yellow-50 text-yellow-700 border border-yellow-500/20',
    };
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[status] || styles.soon}`}>
        {label}
      </span>
    );
  };

  return (
    <section className="py-24 bg-white min-h-screen text-zinc-700">
      <div className="container mx-auto px-4">
        {/* Back button */}
        <div className="mb-8 max-w-5xl mx-auto">
          <a href="/" className="inline-flex items-center text-zinc-500 hover:text-primary-600 font-semibold transition-colors">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Voltar para a página inicial
          </a>
        </div>

        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-50 border border-primary-500/20 rounded-2xl mb-6 text-primary-600">
            <Trophy className="w-8 h-8" />
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-zinc-950 mb-4 uppercase tracking-tight">
            Nossos <span className="text-primary-600">Campeonatos</span>
          </h1>
          <div className="w-20 h-1.5 bg-primary-500 mx-auto rounded-full mb-6"></div>
          <p className="text-lg text-zinc-600 max-w-3xl mx-auto font-light leading-relaxed">
            Faça parte da história do automobilismo mineiro. Inscreva sua equipe e acelere nas competições mais disputadas da região.
          </p>
        </div>

        {/* Championship Cards */}
        <div className="max-w-5xl mx-auto space-y-8">
          {championships.map((champ) => (
            <div
              key={champ.id}
              className={`bg-zinc-50 border border-zinc-200 rounded-3xl overflow-hidden hover:border-primary-500/30 hover:shadow-sm transition-all duration-300 ${
                champ.status === 'past' ? 'opacity-[0.65]' : ''
              }`}
            >
              <div className="flex flex-col md:flex-row">
                {/* Logo Section */}
                <div className="md:w-72 flex-shrink-0 bg-white flex items-center justify-center p-8 border-b md:border-b-0 md:border-r border-zinc-200">
                  <img
                    src={champ.logo}
                    alt={`Logo ${champ.evento}`}
                    className="w-44 h-44 object-contain transform hover:scale-105 transition-transform duration-300"
                  />
                </div>

                {/* Content Section */}
                <div className="flex-1 p-8 flex flex-col justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">{champ.evento}</h2>
                      {getStatusBadge(champ.status, champ.statusLabel)}
                    </div>

                    <p className="text-zinc-600 text-sm leading-relaxed mb-6 font-light">{champ.description}</p>

                    <div className="flex items-center text-zinc-500 mb-6 text-xs font-bold uppercase tracking-wider">
                      <Calendar className="w-4 h-4 mr-2 text-primary-600" />
                      <span>Calendário / Data: {champ.date}</span>
                    </div>

                    {/* Requirements Box */}
                    <div className="bg-white border border-zinc-200 rounded-2xl p-5 mb-6">
                      <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-widest mb-3">
                        Dados de Inscrição Necessários
                      </h4>
                      {champ.requiresTeamForm ? (
                        <ul className="text-xs text-zinc-600 space-y-2 font-light">
                          <li className="flex items-center"><ChevronRight className="w-3.5 h-3.5 mr-1.5 text-primary-500" /> Nome oficial da equipe</li>
                          <li className="flex items-center"><ChevronRight className="w-3.5 h-3.5 mr-1.5 text-primary-500" /> Nome do chefe de equipe</li>
                          <li className="flex items-center"><ChevronRight className="w-3.5 h-3.5 mr-1.5 text-primary-500" /> Nome dos pilotos e peso individual em kg</li>
                          <li className="flex items-center"><ChevronRight className="w-3.5 h-3.5 mr-1.5 text-primary-500" /> Quantidade de karts participantes no campeonato</li>
                        </ul>
                      ) : (
                        <ul className="text-xs text-zinc-600 space-y-2 font-light">
                          <li className="flex items-center"><ChevronRight className="w-3.5 h-3.5 mr-1.5 text-primary-500" /> Taxa de inscrição única do campeonato</li>
                          <li className="flex items-center"><ChevronRight className="w-3.5 h-3.5 mr-1.5 text-primary-500" /> Pagamento individual de cada etapa corrida</li>
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* CTA Buttons */}
                  <div className="flex flex-wrap gap-4 border-t border-zinc-200 pt-6">
{champ.status === 'open' && champ.requiresTeamForm && (
<button
onClick={() => openModal(champ)}
                        className="px-6 py-3.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 text-zinc-950 font-bold uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-sm"
                      >
                        <Users className="w-4 h-4" />
Formulário de Inscrição
</button>
)}
{champ.status === 'open' && !champ.requiresTeamForm && (
<button
onClick={() => openModal(champ)}
className="px-6 py-3.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 text-zinc-950 font-bold uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-sm"
>
<Users className="w-4 h-4" />
Inscrição do Piloto
</button>
)}
                    {champ.id === 'kac-iniciantes' && (
                      <a
                        href="/campeonatos/kac"
                        className="px-6 py-3.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 text-zinc-950 font-bold uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-sm"
                      >
                        <Trophy className="w-4 h-4" />
                        Acesse a Página do KAC
                      </a>
                    )}
                    {champ.status === 'open' && (
                      <a
                        href={`https://wa.me/553135112373?text=Ol%C3%A1!%20Gostaria%20de%20saber%20valores%20e%20regulamento%20para%20o%20campeonato%20${encodeURIComponent(champ.evento)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-3.5 bg-white border border-zinc-200 hover:border-primary-500/30 text-zinc-700 font-bold uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-sm"
                      >
                        <MessageSquare className="w-4 h-4 text-primary-600" />
                        Valores via WhatsApp
                      </a>
                    )}
                    {champ.status === 'past' && (
                      <span className="px-6 py-3.5 bg-zinc-100 border border-zinc-200 text-zinc-400 font-bold uppercase tracking-wider text-xs rounded-xl cursor-not-allowed">
                        Inscrições Encerradas
                      </span>
                    )}
                    {champ.status === 'soon' && (
                      <span className="px-6 py-3.5 bg-yellow-50 border border-yellow-500/20 text-yellow-700 font-bold uppercase tracking-wider text-xs rounded-xl cursor-not-allowed">
                        Em Breve / Pré-Inscrições
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* WhatsApp Banner */}
        <div className="max-w-5xl mx-auto mt-16">
          <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-8 md:p-12 text-center relative overflow-hidden shadow-sm">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-primary-600" />
            <h3 className="text-2xl md:text-3xl font-black text-zinc-950 mb-2 uppercase tracking-tight">Regulamentos e Valores</h3>
            <p className="text-zinc-600 text-sm max-w-2xl mx-auto mb-8 font-light">
              Ficou com alguma dúvida sobre pesos mínimos, karts disponíveis ou deseja conferir as datas das etapas detalhadas? Chame nossa equipe.
            </p>
            <a
              href="https://wa.me/553135112373?text=Ol%C3%A1!%20Gostaria%20de%20receber%20regulamentos%20e%20valores%20dos%20campeonatos%20do%20Kart%C3%B3dromo."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 text-zinc-950 font-bold uppercase tracking-wider text-xs rounded-xl transition-all duration-300 shadow-md"
            >
              <MessageSquare className="w-5 h-5 mr-2" />
              Solicitar Regulamentos por WhatsApp
            </a>
          </div>
        </div>
      </div>

      {/* Registration Modal */}
      {isModalOpen && selectedEvent && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="registration-modal-title"
            className="bg-white border border-zinc-200 rounded-3xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto relative animate-scaleUp text-zinc-700"
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-zinc-200 px-6 py-5 flex items-center justify-between z-10">
              <div>
                <h3 id="registration-modal-title" className="text-lg font-bold text-zinc-950 uppercase tracking-wider">Formulário de Inscrição</h3>
                <p className="text-xs text-primary-600 font-bold">{selectedEvent.evento}</p>
              </div>
              <button
                onClick={closeModal}
                aria-label="Fechar formulário de inscrição"
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-50 border border-zinc-200 hover:border-red-500/50 hover:text-red-500 text-zinc-500 transition-all focus:outline-none"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Success State */}
            {submitResult === 'success' && (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-primary-50 border border-primary-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-primary-600">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-bold text-zinc-950 mb-2 uppercase">Inscrição Enviada!</h4>
                <p className="text-zinc-600 text-sm mb-8 font-light leading-relaxed">
                  Os dados da sua equipe foram cadastrados com sucesso. Entre em contato pelo WhatsApp para concluir o pagamento e confirmar o grid.
                </p>
                <a
                  href={`https://wa.me/553135112373?text=Ol%C3%A1!%20Acabei%20de%20enviar%20o%20formul%C3%A1rio%20de%20inscri%C3%A7%C3%A3o%20para%20o%20campeonato%20${encodeURIComponent(selectedEvent.evento)}.%20Gostaria%20do%20link%20de%20pagamento.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 text-zinc-950 font-bold uppercase tracking-wider text-xs rounded-xl transition-all duration-300 shadow-md"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Concluir no WhatsApp
                </a>
              </div>
            )}

            {/* Error State */}
            {submitResult === 'error' && (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-50 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-bold text-zinc-950 mb-2 uppercase">Erro ao Enviar</h4>
                <p className="text-zinc-600 text-sm mb-8 font-light leading-relaxed">
                  Não foi possível processar o formulário. Você pode preencher os dados diretamente via chat do WhatsApp se o problema persistir.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => setSubmitResult(null)}
                    className="px-5 py-3 bg-white border border-zinc-200 hover:border-zinc-300 text-zinc-800 font-bold uppercase tracking-wider text-xs rounded-xl transition-colors shadow-sm"
                  >
                    Tentar Novamente
                  </button>
                  <a
                    href="https://wa.me/553135112373"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-5 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 text-zinc-950 font-bold uppercase tracking-wider text-xs rounded-xl transition-all shadow-md"
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
                  <label htmlFor="team-name" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Nome da Equipe *
                  </label>
                  <input
                    id="team-name"
                    type="text"
                    required
                    value={nomeEquipe}
                    onChange={(e) => setNomeEquipe(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-zinc-800 text-sm transition-all focus:ring-1 focus:ring-primary-500"
                    placeholder="Ex: Minas Racing Team"
                  />
                </div>

                {/* Nome do Chefe */}
                <div>
                  <label htmlFor="team-leader" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Nome do Chefe de Equipe *
                  </label>
                  <input
                    id="team-leader"
                    type="text"
                    required
                    value={nomeChefe}
                    onChange={(e) => setNomeChefe(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-zinc-800 text-sm transition-all focus:ring-1 focus:ring-primary-500"
                    placeholder="Nome completo do responsável"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="team-phone" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                      WhatsApp do Responsável
                    </label>
                    <input
                      id="team-phone"
                      type="tel"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-zinc-800 text-sm transition-all focus:ring-1 focus:ring-primary-500"
                      placeholder="(31) 99999-9999"
                    />
                  </div>
                  <div>
                    <label htmlFor="team-email" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                      E-mail
                    </label>
                    <input
                      id="team-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-zinc-800 text-sm transition-all focus:ring-1 focus:ring-primary-500"
                      placeholder="equipe@email.com"
                    />
                  </div>
                </div>

                {/* Pilotos List */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
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
                            className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-300 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-zinc-800 text-xs transition-all"
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
                            className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-300 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-zinc-800 text-xs text-center transition-all"
                            placeholder="Peso (kg)"
                          />
                        </div>
                        {pilotos.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePiloto(index)}
                            aria-label={`Remover piloto ${index + 1}`}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-50 border border-zinc-200 hover:border-red-500/50 text-red-600 hover:text-red-500 transition-colors flex-shrink-0"
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
                  <label htmlFor="kart-count" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
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
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-zinc-800 text-sm transition-all focus:ring-1 focus:ring-primary-500"
/>
</div>
</>
) : (
<>
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
<div className="sm:col-span-2">
<label htmlFor="driver-name" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
Nome completo *
</label>
<input id="driver-name" type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-zinc-800 text-sm transition-all focus:ring-1 focus:ring-primary-500" placeholder="Nome e sobrenome" />
</div>
<div>
<label htmlFor="driver-phone" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">WhatsApp *</label>
<input id="driver-phone" type="tel" required value={telefone} onChange={(e) => setTelefone(e.target.value)} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-zinc-800 text-sm transition-all focus:ring-1 focus:ring-primary-500" placeholder="(31) 99999-9999" />
</div>
<div>
<label htmlFor="driver-email" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">E-mail *</label>
<input id="driver-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-zinc-800 text-sm transition-all focus:ring-1 focus:ring-primary-500" placeholder="piloto@email.com" />
</div>
<div>
<label htmlFor="driver-cpf" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">CPF</label>
<input id="driver-cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-zinc-800 text-sm transition-all focus:ring-1 focus:ring-primary-500" placeholder="000.000.000-00" />
</div>
<div>
<label htmlFor="driver-birth" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Nascimento</label>
<input id="driver-birth" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-zinc-800 text-sm transition-all focus:ring-1 focus:ring-primary-500" placeholder="dd/mm/aaaa" />
</div>
<div>
<label htmlFor="driver-city" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Cidade</label>
<input id="driver-city" value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-zinc-800 text-sm transition-all focus:ring-1 focus:ring-primary-500" placeholder="Betim / MG" />
</div>
<div className="grid grid-cols-2 gap-3">
<div>
<label htmlFor="driver-age" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Idade</label>
<input id="driver-age" type="number" min={8} max={90} value={age} onChange={(e) => setAge(e.target.value)} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-zinc-800 text-sm transition-all focus:ring-1 focus:ring-primary-500" />
</div>
<div>
<label htmlFor="driver-weight" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Peso kg</label>
<input id="driver-weight" type="number" min={30} max={180} value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-zinc-800 text-sm transition-all focus:ring-1 focus:ring-primary-500" />
</div>
</div>
</div>

<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
<div>
<label htmlFor="driver-experience" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Experiência</label>
<select id="driver-experience" value={experience} onChange={(e) => setExperience(e.target.value)} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-zinc-800 text-sm transition-all focus:ring-1 focus:ring-primary-500">
<option>Nunca corri campeonato</option>
<option>Já andei algumas vezes</option>
<option>Corro mensalmente</option>
<option>Tenho experiência em campeonatos</option>
</select>
</div>
<div>
<label htmlFor="driver-level" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Nível atual</label>
<select id="driver-level" value={currentLevel} onChange={(e) => setCurrentLevel(e.target.value)} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-zinc-800 text-sm transition-all focus:ring-1 focus:ring-primary-500">
<option>A definir pela organização</option>
<option>Estreante</option>
<option>Intermediário</option>
<option>Competitivo</option>
</select>
</div>
<div>
<label htmlFor="driver-heats" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Participação desejada</label>
<select id="driver-heats" value={intendedHeats} onChange={(e) => setIntendedHeats(e.target.value)} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-zinc-800 text-sm transition-all focus:ring-1 focus:ring-primary-500">
<option>Quero participar quando houver vaga</option>
<option>Quero correr o máximo de etapas possível</option>
<option>Quero baterias avulsas</option>
</select>
</div>
<div>
<label htmlFor="driver-ranking" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Ranking</label>
<select id="driver-ranking" value={rankingInterest} onChange={(e) => setRankingInterest(e.target.value)} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-zinc-800 text-sm transition-all focus:ring-1 focus:ring-primary-500">
<option>Quero entrar no ranking geral</option>
<option>Quero entender regras antes de decidir</option>
<option>Quero apenas experiência avulsa</option>
</select>
</div>
<div>
<label htmlFor="driver-window" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Janelas preferidas</label>
<input id="driver-window" value={preferredRaceWindows} onChange={(e) => setPreferredRaceWindows(e.target.value)} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-zinc-800 text-sm transition-all focus:ring-1 focus:ring-primary-500" />
</div>
<div>
<label htmlFor="driver-equipment" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Equipamento</label>
<select id="driver-equipment" value={equipment} onChange={(e) => setEquipment(e.target.value)} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-zinc-800 text-sm transition-all focus:ring-1 focus:ring-primary-500">
<option>Tenho capacete próprio</option>
<option>Preciso de capacete do kartódromo</option>
<option>Tenho equipamento completo</option>
</select>
</div>
</div>

<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
<div>
<label htmlFor="emergency-name" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Contato de emergência</label>
<input id="emergency-name" value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-zinc-800 text-sm transition-all focus:ring-1 focus:ring-primary-500" placeholder="Nome" />
</div>
<div>
<label htmlFor="emergency-phone" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Telefone emergência</label>
<input id="emergency-phone" value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-zinc-800 text-sm transition-all focus:ring-1 focus:ring-primary-500" placeholder="(31) 99999-9999" />
</div>
</div>

<textarea value={goals} onChange={(e) => setGoals(e.target.value)} className="w-full min-h-24 px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-zinc-800 text-sm transition-all focus:ring-1 focus:ring-primary-500" placeholder="Objetivo no campeonato" />
<textarea value={medicalRestrictions} onChange={(e) => setMedicalRestrictions(e.target.value)} className="w-full min-h-20 px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-zinc-800 text-sm transition-all focus:ring-1 focus:ring-primary-500" placeholder="Restrições médicas, alergias ou medicamentos" />
<textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full min-h-20 px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-zinc-800 text-sm transition-all focus:ring-1 focus:ring-primary-500" placeholder="Observações operacionais" />

<div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-700">
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
                <div className="bg-primary-50/50 border border-primary-500/20 rounded-xl p-4 text-xs text-primary-800 leading-relaxed font-light">
                  <strong>Nota sobre pagamento:</strong> Após a submissão do formulário, as inscrições ficam no status pendente até a validação do Pix ou boleto de cobrança com o chefe de equipe via WhatsApp.
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 disabled:opacity-50 text-zinc-950 font-bold uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-md"
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
