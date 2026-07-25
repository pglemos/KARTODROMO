// Shared data/helpers for the Clube de Vantagens pages (public + portal).
// Imported via dynamic import('./clube-shared.js').

export const REWARDS = [
  { id: 'rw1', nome: 'Boné Oficial', pontos: 100, categoria: 'Vestuário', estoque: 18 },
  { id: 'rw2', nome: 'Troféu Pequeno', pontos: 100, categoria: 'Colecionável', estoque: 12 },
  { id: 'rw3', nome: 'Camiseta Oficial', pontos: 200, categoria: 'Vestuário', estoque: 9 },
  { id: 'rw4', nome: 'Troféu Grande', pontos: 200, categoria: 'Colecionável', estoque: 5 },
  { id: 'rw5', nome: 'Voucher para uma corrida', pontos: 300, categoria: 'Experiência', estoque: 30 },
];

export const POINT_RULES = [
  { label: 'Terça a Sexta', pontos: 20 },
  { label: 'Sábados, domingos e feriados', pontos: 10 },
];

export const CAMPAIGNS = [
  { id: 'cp1', nome: 'Bônus de aniversário', desc: 'Ganhe 50 pontos extras no mês do seu aniversário.', ativa: true },
  { id: 'cp2', nome: 'Indique um amigo', desc: 'Ganhe 30 pontos para cada amigo que se cadastrar e correr pela primeira vez.', ativa: true },
  { id: 'cp3', nome: 'Dose dupla de fim de ano', desc: 'Pontuação em dobro em corridas de dezembro.', ativa: false },
];

// Mock "logged in" customer used across portal pages.
export const CUSTOMER = {
  nome: 'Rafael Nogueira',
  cpf: '123.456.789-00',
  email: 'rafael.nog@email.com',
  telefone: '(31) 99456-7788',
  cidade: 'Betim',
  membroDesde: '2024-03-10',
  pontos: 260,
};

export const RACE_HISTORY = [
  { data: '2026-07-14', descricao: 'Bateria de aniversário', pontos: 20 },
  { data: '2026-07-08', descricao: 'Corrida avulsa', pontos: 20 },
  { data: '2026-06-28', descricao: 'Corrida — sábado', pontos: 10 },
  { data: '2026-06-14', descricao: 'Corrida avulsa', pontos: 20 },
  { data: '2026-05-31', descricao: 'Corrida — domingo', pontos: 10 },
  { data: '2026-05-19', descricao: 'Corrida avulsa', pontos: 20 },
];

export const REDEMPTION_HISTORY = [
  { data: '2026-06-02', descricao: 'Resgate de Boné Oficial', pontos: -100 },
  { data: '2026-04-11', descricao: 'Resgate de Troféu Pequeno', pontos: -100 },
];

export function nextReward(pontos) {
  const sorted = REWARDS.slice().sort((a, b) => a.pontos - b.pontos);
  return sorted.find((r) => r.pontos > pontos) || sorted[sorted.length - 1];
}

export function formatDateBR(iso) {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Simple deterministic mock lookup by CPF digits for the public "consulta" page.
export function lookupByCpf(cpf) {
  const digits = (cpf || '').replace(/\D/g, '');
  if (digits.length !== 11) return null;
  if (digits === '12345678900') {
    return { nome: CUSTOMER.nome, cpfMasked: '123.456.789-**', pontos: CUSTOMER.pontos, history: RACE_HISTORY.concat(REDEMPTION_HISTORY).sort((a, b) => (a.data < b.data ? 1 : -1)) };
  }
  // Deterministic pseudo-record for any other valid-length CPF so the demo always finds something.
  const seed = digits.split('').reduce((a, d) => a + Number(d), 0);
  const pontos = 40 + (seed % 9) * 30;
  return {
    nome: 'Piloto ' + digits.slice(0, 3) + '.' + digits.slice(3, 6),
    cpfMasked: digits.slice(0, 3) + '.' + digits.slice(3, 6) + '.' + digits.slice(6, 9) + '-**',
    pontos,
    history: RACE_HISTORY.slice(0, 3),
  };
}
