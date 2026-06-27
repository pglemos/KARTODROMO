export type ClienteLocal = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cpf: string | null;
  notes: string | null;
};

export type ClienteLapTime = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  documento: string | null;
  cidade: string | null;
  estado: string | null;
  criadoEm: string | null;
};
