/**
 * Suíte E2E da Recepção - Test Harness & Oráculos
 * Fornece oráculos autoritativos, modelos de domínio, simuladores de banco/API
 * e fixtures para validação opaca dos 36 itens de requisitos da Recepção.
 */

export interface FilaImpressaoJob {
  id: number;
  url: string;
  titulo: string;
  origem: string;
  status: 'pendente' | 'imprimindo' | 'impressa' | 'falhou';
  tentativas: number;
  criadoEm: Date;
  pegoEm?: Date | null;
  feitaEm?: Date | null;
  falhouEm?: Date | null;
  ultimoErro?: string | null;
}

export interface ClienteRecord {
  id: number;
  nome: string;
  tipoDocumento: string;
  documento: string;
  email: string;
  telefone: string;
  nascimento: string;
  peso: number;
  instagram?: string | null;
  cep: string;
  endereco: string;
  numero: string | null;
  complemento: string | null;
  bairro: string;
  cidade: string;
  estado: string;
  responsavelId?: number | null;
  lgpdAceiteEm?: Date | null;
  bloqueado?: boolean;
}

export interface BateriaRecord {
  id: number;
  nome: string;
  inicio: string; // ISO formato YYYY-MM-DDTHH:mm:00
  status: 'aberta' | 'fechada' | 'cancelada';
  autoAtendimento: boolean;
  reservaFechada: boolean;
  maxKarts: number;
  vagasOcupadas: number;
}

export interface MovimentoCaixaRecord {
  id: number;
  usuarioId: number;
  terminalId: number;
  turnoId: number;
  abertoEm: Date;
  fechadoEm?: Date | null;
  inicialCentavos: number;
  proximoTurnoCentavos?: number | null;
}

export interface ItemVendaInput {
  produtoId?: number | null;
  inscricaoId?: number | null;
  descricao: string;
  quantidade: number;
  unitarioCentavos: number;
  descontoCentavos?: number;
  acrescimoCentavos?: number;
  voucherId?: number | null;
}

export interface PagamentoInput {
  formaPagamentoId: number;
  tipo: 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'pix';
  valorCentavos: number;
}

export interface VendaResult {
  id: number;
  brutoCentavos: number;
  descontoCentavos: number;
  acrescimoCentavos: number;
  finalCentavos: number;
  recebidoCentavos: number;
  trocoCentavos: number;
  itens: Array<ItemVendaInput & { liquidoCentavos: number; estornado?: boolean }>;
  pagamentos: PagamentoInput[];
  voucherId?: number | null;
}

/**
 * Oráculo Financeiro do Caixa / PDV (Itens 10, 11, 12, 13, 14, 16)
 */
export class OraculoFinanceiro {
  static calcularTotais(itens: ItemVendaInput[]) {
    let bruto = 0;
    let desconto = 0;
    let acrescimo = 0;

    for (const it of itens) {
      const qtd = it.quantidade || 1;
      const unit = it.unitarioCentavos;
      const desc = it.descontoCentavos || 0;
      const acr = it.acrescimoCentavos || 0;
      const liq = unit * qtd - desc + acr;
      if (liq < 0) {
        throw new Error('Desconto maior que o valor do item.');
      }
      bruto += unit * qtd;
      desconto += desc;
      acrescimo += acr;
    }

    const final = bruto - desconto + acrescimo;
    return { bruto, desconto, acrescimo, final };
  }

  /**
   * Valida pagamentos e cálculo de troco (Item 10)
   * REGRA CRÍTICA: Troco em dinheiro só pode ser concedido se houver pagamento em DINHEIRO,
   * e o valor do troco não pode exceder o montante pago em dinheiro.
   */
  static validarEPagamento(
    totalVenda: number,
    pagamentos: PagamentoInput[],
    validarTotalPago = true
  ) {
    let recebidoTotal = 0;
    let dinheiroRecebido = 0;

    for (const pg of pagamentos) {
      if (pg.valorCentavos <= 0) continue;
      recebidoTotal += pg.valorCentavos;
      if (pg.tipo === 'dinheiro') {
        dinheiroRecebido += pg.valorCentavos;
      }
    }

    if (validarTotalPago && recebidoTotal < totalVenda) {
      throw new Error(`Ainda faltam ser pagos ${totalVenda - recebidoTotal} centavos.`);
    }

    const trocoCalculado = Math.max(0, recebidoTotal - totalVenda);

    if (trocoCalculado > 0) {
      if (dinheiroRecebido === 0) {
        throw new Error('Troco só pode ser dado sobre pagamento em dinheiro. Ajuste os valores.');
      }
      if (trocoCalculado > dinheiroRecebido) {
        throw new Error('Troco não pode exceder o valor recebido em dinheiro.');
      }
    }

    return {
      recebido: recebidoTotal,
      dinheiro: dinheiroRecebido,
      troco: trocoCalculado,
    };
  }

  /**
   * Valida sangria de caixa (Item 12)
   */
  static validarSangria(saldoDinheiroEmCaixa: number, valorSangria: number) {
    if (valorSangria <= 0) {
      throw new Error('Informe o valor.');
    }
    if (valorSangria > saldoDinheiroEmCaixa) {
      throw new Error('Valor de sangria maior que o valor em caixa.');
    }
    return true;
  }

  /**
   * Valida fechamento de caixa e valor para próximo turno (Item 13)
   */
  static validarFechamentoTurno(saldoDinheiroEmCaixa: number, proximoTurno: number) {
    if (proximoTurno < 0) {
      throw new Error('Valor para próximo turno inválido.');
    }
    if (proximoTurno > saldoDinheiroEmCaixa) {
      throw new Error(`Valor para o próximo turno inválido. Não há saldo em dinheiro suficiente no caixa.`);
    }
    return true;
  }
}

/**
 * Oráculo de Validação Cadastral e PII (Itens 23, 24, 25, 26, 27)
 */
export class OraculoCliente {
  /**
   * Harmonização de peso (Item 27): Limites válidos unificados entre 15 kg e 250 kg
   */
  static validarPeso(pesoStr: string | number | null | undefined): { valido: boolean; peso?: number; erro?: string } {
    if (pesoStr === null || pesoStr === undefined || String(pesoStr).trim() === '') {
      return { valido: false, erro: 'O peso é obrigatório.' };
    }
    const clean = String(pesoStr).replace(',', '.').trim();
    const kg = Number(clean);
    if (!Number.isFinite(kg) || isNaN(kg)) {
      return { valido: false, erro: 'Peso inválido.' };
    }
    if (kg < 15 || kg > 250) {
      return { valido: false, erro: 'Peso deve estar entre 15 kg e 250 kg.' };
    }
    return { valido: true, peso: kg };
  }

  /**
   * Flexibilização de Instagram (Item 26): Instagram é opcional
   */
  static validarInstagram(instagram: string | null | undefined): { valido: boolean; normalizado: string | null } {
    if (!instagram || String(instagram).trim() === '') {
      return { valido: true, normalizado: null };
    }
    const limpo = String(instagram).trim();
    if (limpo.toLowerCase() === 'não possui' || limpo.toLowerCase() === 'nao possui') {
      return { valido: true, normalizado: null };
    }
    let usuario = limpo;
    const match = usuario.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)/i);
    if (match) usuario = match[1];
    if (usuario.startsWith('@')) usuario = usuario.slice(1);
    const normalizado = usuario.length === 0 ? null : '@' + usuario.toLowerCase();
    return { valido: true, normalizado };
  }

  /**
   * Mascaramento de PII (Item 25)
   */
  static mascararPii(cliente: ClienteRecord) {
    const maskCpf = (cpf: string) => {
      const d = cpf.replace(/\D/g, '');
      if (d.length === 11) {
        return `${d.slice(0, 3)}.***.***-${d.slice(9)}`;
      }
      return '***.***.***-**';
    };

    const maskEmail = (email: string) => {
      if (!email || !email.includes('@')) return '***@***';
      const [user, domain] = email.split('@');
      const maskedUser = user.length <= 2 ? user[0] + '***' : user[0] + '***' + user[user.length - 1];
      return `${maskedUser}@${domain}`;
    };

    const maskTelefone = (tel: string) => {
      const d = tel.replace(/\D/g, '');
      if (d.length >= 10) {
        return `(${d.slice(0, 2)}) *****-${d.slice(-4)}`;
      }
      return '(**) *****-****';
    };

    const maskEndereco = (endereco: string, numero: string | null, comp: string | null) => {
      if (!endereco) return '';
      const parte = endereco.slice(0, Math.min(10, endereco.length));
      return `${parte}***, ${numero || 'S/N'}`;
    };

    return {
      id: cliente.id,
      nome: cliente.nome,
      tipoDocumento: cliente.tipoDocumento,
      documento: maskCpf(cliente.documento),
      email: maskEmail(cliente.email),
      telefone: maskTelefone(cliente.telefone),
      nascimento: cliente.nascimento,
      peso: String(cliente.peso),
      cep: cliente.cep ? `${cliente.cep.slice(0, 5)}-***` : '',
      endereco: maskEndereco(cliente.endereco, cliente.numero, cliente.complemento),
      numero: cliente.numero ? '***' : null,
      complemento: cliente.complemento ? '***' : null,
      bairro: cliente.bairro,
      cidade: cliente.cidade,
      estado: cliente.estado,
    };
  }

  /**
   * Cálculo de seleção do cursor para máscaras sem jumping (Item 23)
   */
  static calcularCursorMascara(
    antigoTexto: string,
    novoTextoFormatado: string,
    posicaoAntiga: number
  ): number {
    // Se o usuário digitou no fim, mantém no fim do novo texto
    if (posicaoAntiga >= antigoTexto.length) {
      return novoTextoFormatado.length;
    }
    // Conta quantos dígitos brutos havia antes do cursor no texto antigo
    const digitosAntes = antigoTexto.slice(0, posicaoAntiga).replace(/\D/g, '').length;
    // Encontra no novo texto a posição onde se atinge a mesma quantidade de dígitos
    let digitosEncontrados = 0;
    let novaPosicao = 0;
    for (let i = 0; i < novoTextoFormatado.length; i++) {
      if (/\d/.test(novoTextoFormatado[i])) {
        digitosEncontrados++;
      }
      if (digitosEncontrados === digitosAntes) {
        novaPosicao = i + 1;
        break;
      }
    }
    return Math.min(novaPosicao || posicaoAntiga, novoTextoFormatado.length);
  }
}

/**
 * Oráculo de Baterias e Agendamentos (Itens 17, 18, 19, 20, 21)
 */
export class OraculoBaterias {
  /**
   * Normalização ISO Datetime com segundos :00 (Item 20)
   */
  static normalizarIsoDateTime(dataHora: string): string {
    const s = String(dataHora || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s)) {
      throw new Error('Data/hora inválida para SQL Server.');
    }
    if (s.length === 16) {
      return `${s}:00`;
    }
    return s;
  }

  /**
   * Bloqueio de baterias iniciadas / passadas (Itens 17 e 18)
   * Tolerância de -30 minutos ELIMINADA.
   * Se inicio <= agora, a bateria NÃO é agendável nem visível no totem.
   */
  static bateriaEstaAgendavel(inicioIso: string, agora: Date): boolean {
    const inicioDate = new Date(inicioIso);
    return inicioDate.getTime() > agora.getTime();
  }

  /**
   * Validação de movimentação de cliente (Item 21)
   */
  static validarMovimentacaoCliente(
    bateriaDestino: BateriaRecord,
    agora: Date
  ): { permitido: boolean; motivo?: string } {
    if (!this.bateriaEstaAgendavel(bateriaDestino.inicio, agora)) {
      return { permitido: false, motivo: 'Não é permitido mover para bateria com horário já iniciado.' };
    }
    if (bateriaDestino.status !== 'aberta') {
      return { permitido: false, motivo: 'Bateria destino está fechada ou cancelada.' };
    }
    const vagasLivres = bateriaDestino.maxKarts - bateriaDestino.vagasOcupadas;
    if (vagasLivres <= 0) {
      return { permitido: false, motivo: 'Bateria destino não possui vagas disponíveis.' };
    }
    return { permitido: true };
  }
}

/**
 * Simulador de Fila de Impressão Persistente (Itens 1, 2)
 * Simula a tabela dbo.FilaImpressao e a CTE atômica UPDLOCK, READPAST.
 */
export class SimuladorFilaImpressao {
  private itens: FilaImpressaoJob[] = [];
  private seq = 0;

  enfileirar(url: string, titulo: string, origem: string): FilaImpressaoJob {
    const job: FilaImpressaoJob = {
      id: ++this.seq,
      url,
      titulo,
      origem,
      status: 'pendente',
      tentativas: 0,
      criadoEm: new Date(),
    };
    this.itens.push(job);
    return { ...job };
  }

  /**
   * Simula a CTE atômica:
   * WITH Proximo AS (
   *   SELECT TOP 1 * FROM dbo.FilaImpressao WITH (UPDLOCK, READPAST)
   *   WHERE Status = 'pendente' OR (Status = 'imprimindo' AND PegoEm < DATEADD(second, -90, SYSDATETIME()))
   *   ORDER BY CriadoEm ASC
   * )
   */
  proximoJob(agora: Date = new Date()): FilaImpressaoJob | null {
    const limiteReentregaMs = 90 * 1000;
    const candidato = this.itens.find((j) => {
      if (j.status === 'pendente') return true;
      if (j.status === 'imprimindo' && j.pegoEm) {
        return agora.getTime() - j.pegoEm.getTime() > limiteReentregaMs;
      }
      return false;
    });

    if (!candidato) return null;

    candidato.status = 'imprimindo';
    candidato.pegoEm = agora;
    candidato.tentativas += 1;
    return { ...candidato };
  }

  marcarFeita(id: number, agora: Date = new Date()): boolean {
    const job = this.itens.find((j) => j.id === id);
    if (!job) return false;
    job.status = 'impressa';
    job.feitaEm = agora;
    return true;
  }

  marcarFalhou(id: number, erro: string, agora: Date = new Date()): boolean {
    const job = this.itens.find((j) => j.id === id);
    if (!job) return false;
    job.status = 'falhou';
    job.falhouEm = agora;
    job.ultimoErro = erro;
    return true;
  }

  recuperarParaFila(id: number): boolean {
    const job = this.itens.find((j) => j.id === id);
    if (!job) return false;
    job.status = 'pendente';
    job.pegoEm = null;
    return true;
  }

  obterTodos(): FilaImpressaoJob[] {
    return this.itens.map((j) => ({ ...j }));
  }

  obterPorStatus(status: FilaImpressaoJob['status']): FilaImpressaoJob[] {
    return this.itens.filter((j) => j.status === status).map((j) => ({ ...j }));
  }
}
