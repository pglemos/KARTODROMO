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

export type ClienteCalXPro = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  documento: string | null;
  cidade: string | null;
  criadoEm: string | null;
};

export type ContatoCalXPro = {
  id: string;
  nome: string;
  telefone: string | null;
  celular: string | null;
  cidade: string | null;
  criadoEm: string | null;
};
