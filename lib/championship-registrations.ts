import crypto from 'node:crypto';

export const championshipRegistrationsTable = 'kartodromo_campeonato_inscricoes';

export type ChampionshipRegistrationStatus = 'pendente' | 'em_analise' | 'confirmada' | 'recusada' | 'cancelada';
export type ChampionshipRegistrationMode = 'equipe' | 'individual';

export type ChampionshipRegistrationRow = {
  id: string;
  protocol: string;
  campeonato_id: string | null;
  evento: string;
  modalidade: ChampionshipRegistrationMode;
  status: ChampionshipRegistrationStatus;
  nome_equipe: string | null;
  nome_chefe: string | null;
  nome_completo: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  idade: number | null;
  peso_kg: number | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  experiencia: string | null;
  nivel_atual: string | null;
  disponibilidade: string | null;
  participacao_desejada: string | null;
  interesse_ranking: string | null;
  janelas_preferidas: string | null;
  equipamento: string | null;
  equipamento_detalhes: string | null;
  contato_emergencia_nome: string | null;
  contato_emergencia_telefone: string | null;
  restricoes_medicas: string | null;
  alergias: string | null;
  medicamentos: string | null;
  objetivos: string | null;
  observacoes: string | null;
  quantidade_karts: number | null;
  pilotos: Array<{ nome: string; peso_kg: number | null }>;
  pagamento: string | null;
  aceites: Record<string, boolean>;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ChampionshipRegistrationInput = Partial<{
  campeonato_id: unknown;
  evento: unknown;
  event: unknown;
  championshipName: unknown;
  modalidade: unknown;
  nome_da_equipe: unknown;
  nomeEquipe: unknown;
  nome_da_equipe_oficial: unknown;
  nome_do_chefe_da_equipe: unknown;
  nomeChefe: unknown;
  fullName: unknown;
  nome_completo: unknown;
  cpf: unknown;
  birthDate: unknown;
  data_nascimento: unknown;
  age: unknown;
  idade: unknown;
  weight: unknown;
  peso_kg: unknown;
  whatsapp: unknown;
  telefone: unknown;
  email: unknown;
  city: unknown;
  cidade: unknown;
  experience: unknown;
  experiencia: unknown;
  currentLevel: unknown;
  nivel_atual: unknown;
  availability: unknown;
  disponibilidade: unknown;
  intendedHeats: unknown;
  participacao_desejada: unknown;
  rankingInterest: unknown;
  interesse_ranking: unknown;
  preferredRaceWindows: unknown;
  janelas_preferidas: unknown;
  equipment: unknown;
  equipamento: unknown;
  equipmentDetails: unknown;
  equipamento_detalhes: unknown;
  emergencyContactName: unknown;
  contato_emergencia_nome: unknown;
  emergencyContactPhone: unknown;
  contato_emergencia_telefone: unknown;
  medicalRestrictions: unknown;
  restricoes_medicas: unknown;
  allergies: unknown;
  alergias: unknown;
  medications: unknown;
  medicamentos: unknown;
  goals: unknown;
  objetivos: unknown;
  notes: unknown;
  observacoes: unknown;
  pilotos: unknown;
  quantidade_karts_no_campeonato: unknown;
  quantidadeKarts: unknown;
  pagamento: unknown;
  acceptedContact: unknown;
  acceptedRules: unknown;
  acceptedResponsibility: unknown;
  acceptedImage: unknown;
}>;

export function generateRegistrationProtocol() {
  const date = new Date();
  const stamp = date.toISOString().slice(2, 10).replace(/-/g, '');
  return `KDB-${stamp}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

const numberValue = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const parsed = Number(value.replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const intValue = (value: unknown) => {
  const parsed = numberValue(value);
  return parsed === null ? null : Math.trunc(parsed);
};

const boolValue = (value: unknown) => value === true || value === 'true';

const pilotsValue = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((pilot) => {
      if (!pilot || typeof pilot !== 'object') return null;
      const row = pilot as Record<string, unknown>;
      const nome = text(row.nome ?? row.name);
      if (!nome) return null;
      return {
        nome,
        peso_kg: numberValue(row.peso_kg ?? row.weight),
      };
    })
    .filter((pilot): pilot is { nome: string; peso_kg: number | null } => Boolean(pilot));
};

export function normalizeChampionshipRegistration(input: ChampionshipRegistrationInput) {
  const evento = text(input.evento ?? input.event ?? input.championshipName);
  const nomeEquipe = text(input.nome_da_equipe ?? input.nomeEquipe ?? input.nome_da_equipe_oficial);
  const nomeChefe = text(input.nome_do_chefe_da_equipe ?? input.nomeChefe);
  const nomeCompleto = text(input.fullName ?? input.nome_completo);
  const pilotos = pilotsValue(input.pilotos);
  const modalidade: ChampionshipRegistrationMode =
    text(input.modalidade) === 'individual' || (!nomeEquipe && nomeCompleto) ? 'individual' : 'equipe';

  return {
    campeonato_id: text(input.campeonato_id),
    evento,
    modalidade,
    status: 'pendente' as ChampionshipRegistrationStatus,
    nome_equipe: nomeEquipe,
    nome_chefe: nomeChefe,
    nome_completo: nomeCompleto,
    cpf: text(input.cpf),
    data_nascimento: text(input.birthDate ?? input.data_nascimento),
    idade: intValue(input.age ?? input.idade),
    peso_kg: numberValue(input.weight ?? input.peso_kg),
    email: text(input.email),
    telefone: text(input.whatsapp ?? input.telefone),
    cidade: text(input.city ?? input.cidade),
    experiencia: text(input.experience ?? input.experiencia),
    nivel_atual: text(input.currentLevel ?? input.nivel_atual),
    disponibilidade: text(input.availability ?? input.disponibilidade),
    participacao_desejada: text(input.intendedHeats ?? input.participacao_desejada),
    interesse_ranking: text(input.rankingInterest ?? input.interesse_ranking),
    janelas_preferidas: text(input.preferredRaceWindows ?? input.janelas_preferidas),
    equipamento: text(input.equipment ?? input.equipamento),
    equipamento_detalhes: text(input.equipmentDetails ?? input.equipamento_detalhes),
    contato_emergencia_nome: text(input.emergencyContactName ?? input.contato_emergencia_nome),
    contato_emergencia_telefone: text(input.emergencyContactPhone ?? input.contato_emergencia_telefone),
    restricoes_medicas: text(input.medicalRestrictions ?? input.restricoes_medicas),
    alergias: text(input.allergies ?? input.alergias),
    medicamentos: text(input.medications ?? input.medicamentos),
    objetivos: text(input.goals ?? input.objetivos),
    observacoes: text(input.notes ?? input.observacoes),
    quantidade_karts: intValue(input.quantidade_karts_no_campeonato ?? input.quantidadeKarts),
    pilotos,
    pagamento: text(input.pagamento),
    aceites: {
      contato: boolValue(input.acceptedContact),
      regulamento: boolValue(input.acceptedRules),
      responsabilidade: boolValue(input.acceptedResponsibility),
      imagem: boolValue(input.acceptedImage),
    },
  };
}

export function validateChampionshipRegistration(
  payload: ReturnType<typeof normalizeChampionshipRegistration>,
) {
  const errors: string[] = [];

  if (!payload.evento) errors.push('Evento é obrigatório.');

  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    errors.push('E-mail inválido.');
  }

  if (payload.modalidade === 'equipe') {
    if (!payload.nome_equipe) errors.push('Nome da equipe é obrigatório.');
    if (!payload.nome_chefe) errors.push('Nome do chefe da equipe é obrigatório.');
    if (payload.pilotos.length < 1 || payload.pilotos.length > 50) {
      errors.push('Informe de 1 a 50 pilotos.');
    }
    payload.pilotos.forEach((pilot, index) => {
      if (!pilot.nome) errors.push(`Nome do piloto ${index + 1} é obrigatório.`);
      if (pilot.peso_kg !== null && (pilot.peso_kg < 30 || pilot.peso_kg > 180)) {
        errors.push(`Peso do piloto ${index + 1} deve estar entre 30 e 180 kg.`);
      }
    });
    if (!payload.quantidade_karts || payload.quantidade_karts < 1 || payload.quantidade_karts > 50) {
      errors.push('Quantidade de karts deve estar entre 1 e 50.');
    }
  } else {
    if (!payload.nome_completo) errors.push('Nome completo é obrigatório.');
    if (!payload.telefone) errors.push('WhatsApp é obrigatório.');
    if (!payload.email) errors.push('E-mail é obrigatório.');
    if (payload.idade !== null && (payload.idade < 8 || payload.idade > 90)) {
      errors.push('Idade deve estar entre 8 e 90 anos.');
    }
    if (payload.peso_kg !== null && (payload.peso_kg < 30 || payload.peso_kg > 180)) {
      errors.push('Peso deve estar entre 30 e 180 kg.');
    }
  }

  return errors;
}
