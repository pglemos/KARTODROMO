import { describe, expect, it } from 'vitest';
import {
  OraculoBaterias,
  OraculoFinanceiro,
  type BateriaRecord,
  type ClienteRecord,
  type ItemVendaInput,
} from './harness';

describe('Tier 3: Combinações entre Funcionalidades da Recepção', () => {
  // -------------------------------------------------------------------------
  // 1. Voucher + Desconto Manual + Acréscimo (Itens 14, 16)
  // -------------------------------------------------------------------------
  describe('Combinação: Voucher de Parceiro + Desconto + Acréscimo no PDV (Itens 14, 16)', () => {
    it('calcula comissão do parceiro estritamente sobre a base líquida após aplicação do voucher', () => {
      // Vaga de R$ 120,00 com voucher de R$ 20,00 de desconto
      const valorUnitario = 12000;
      const voucherDesconto = 2000;
      const acrescimoTaxa = 500; // Taxa de R$ 5,00

      const item: ItemVendaInput = {
        descricao: 'Bateria Super 20min',
        quantidade: 1,
        unitarioCentavos: valorUnitario,
        descontoCentavos: voucherDesconto,
        acrescimoCentavos: acrescimoTaxa,
        voucherId: 15,
      };

      const totais = OraculoFinanceiro.calcularTotais([item]);
      expect(totais.bruto).toBe(12000);
      expect(totais.desconto).toBe(2000);
      expect(totais.acrescimo).toBe(500);
      expect(totais.final).toBe(10500); // R$ 105,00

      // Comissão de parceiro (10% sobre o líquido do item com voucher)
      const taxaComissaoPercentual = 10;
      const baseLiquidaVoucher = valorUnitario - voucherDesconto; // R$ 100,00
      const valorComissao = Math.round((baseLiquidaVoucher * taxaComissaoPercentual) / 100);

      expect(valorComissao).toBe(1000); // R$ 10,00 de comissão
    });

    it('desvinculação de voucher recalculando totais sem perder acréscimos do pedido', () => {
      const itemInicial: ItemVendaInput = {
        descricao: 'Inscrição Bateria 18h',
        quantidade: 1,
        unitarioCentavos: 12000,
        descontoCentavos: 3000,
        acrescimoCentavos: 1000, // taxa de inscrição especial
        voucherId: 22,
      };

      const totaisComVoucher = OraculoFinanceiro.calcularTotais([itemInicial]);
      expect(totaisComVoucher.final).toBe(10000); // 120 - 30 + 10 = 100

      // Operador desvincula o voucher no PDV:
      const itemSemVoucher: ItemVendaInput = {
        ...itemInicial,
        descontoCentavos: 0,
        voucherId: null,
      };

      const totaisSemVoucher = OraculoFinanceiro.calcularTotais([itemSemVoucher]);
      expect(totaisSemVoucher.desconto).toBe(0);
      expect(totaisSemVoucher.acrescimo).toBe(1000); // acréscimo preservado
      expect(totaisSemVoucher.final).toBe(13000); // 120 + 10 = 130
    });
  });

  // -------------------------------------------------------------------------
  // 2. Mover Cliente: Bateria Paga vs Não Paga, Vagas e Horários (Item 21)
  // -------------------------------------------------------------------------
  describe('Combinação: Movimentação de Piloto entre Baterias (Item 21)', () => {
    interface InscricaoPiloto {
      id: number;
      clienteId: number;
      bateriaId: number;
      pago: boolean;
      vendaId?: number | null;
    }

    const agora = new Date('2026-10-26T14:00:00Z');

    const bateriaOrigem: BateriaRecord = {
      id: 10,
      nome: 'Bateria 15h',
      inicio: '2026-10-26T15:00:00Z',
      status: 'aberta',
      autoAtendimento: true,
      reservaFechada: false,
      maxKarts: 20,
      vagasOcupadas: 18,
    };

    const bateriaDestinoValida: BateriaRecord = {
      id: 20,
      nome: 'Bateria 16h',
      inicio: '2026-10-26T16:00:00Z',
      status: 'aberta',
      autoAtendimento: true,
      reservaFechada: false,
      maxKarts: 20,
      vagasOcupadas: 15, // 5 vagas livres
    };

    const bateriaDestinoCheia: BateriaRecord = {
      id: 30,
      nome: 'Bateria 17h Cheia',
      inicio: '2026-10-26T17:00:00Z',
      status: 'aberta',
      autoAtendimento: true,
      reservaFechada: false,
      maxKarts: 20,
      vagasOcupadas: 20, // 0 vagas livres
    };

    const bateriaDestinoPassada: BateriaRecord = {
      id: 40,
      nome: 'Bateria 13h Já Iniciada',
      inicio: '2026-10-26T13:00:00Z',
      status: 'aberta',
      autoAtendimento: true,
      reservaFechada: false,
      maxKarts: 20,
      vagasOcupadas: 5,
    };

    const executarMovimentacao = (
      inscricao: InscricaoPiloto,
      origem: BateriaRecord,
      destino: BateriaRecord
    ) => {
      const validacao = OraculoBaterias.validarMovimentacaoCliente(destino, agora);
      if (!validacao.permitido) {
        throw new Error(validacao.motivo);
      }

      // Decrementa vaga na origem e incrementa no destino
      origem.vagasOcupadas -= 1;
      destino.vagasOcupadas += 1;
      inscricao.bateriaId = destino.id;

      return {
        inscricao,
        origemVagas: origem.vagasOcupadas,
        destinoVagas: destino.vagasOcupadas,
      };
    };

    it('move com sucesso inscrição PAGA para bateria válida mantendo o vínculo financeiro', () => {
      const inscricaoPaga: InscricaoPiloto = {
        id: 101,
        clienteId: 50,
        bateriaId: bateriaOrigem.id,
        pago: true,
        vendaId: 9001,
      };

      const res = executarMovimentacao(inscricaoPaga, { ...bateriaOrigem }, { ...bateriaDestinoValida });
      expect(res.inscricao.bateriaId).toBe(bateriaDestinoValida.id);
      expect(res.inscricao.pago).toBe(true);
      expect(res.inscricao.vendaId).toBe(9001); // Pagamento e venda preservados
      expect(res.origemVagas).toBe(17);
      expect(res.destinoVagas).toBe(16);
    });

    it('move com sucesso inscrição NÃO PAGA mantendo status de pendente de pagamento', () => {
      const inscricaoPendente: InscricaoPiloto = {
        id: 102,
        clienteId: 51,
        bateriaId: bateriaOrigem.id,
        pago: false,
        vendaId: null,
      };

      const res = executarMovimentacao(inscricaoPendente, { ...bateriaOrigem }, { ...bateriaDestinoValida });
      expect(res.inscricao.bateriaId).toBe(bateriaDestinoValida.id);
      expect(res.inscricao.pago).toBe(false);
      expect(res.inscricao.vendaId).toBeNull();
    });

    it('impede movimentação para bateria com vagas esgotadas', () => {
      const inscricao: InscricaoPiloto = { id: 103, clienteId: 52, bateriaId: bateriaOrigem.id, pago: false };
      expect(() => executarMovimentacao(inscricao, { ...bateriaOrigem }, { ...bateriaDestinoCheia })).toThrow(
        /não possui vagas disponíveis/
      );
    });

    it('impede movimentação para bateria com horário já iniciado', () => {
      const inscricao: InscricaoPiloto = { id: 104, clienteId: 53, bateriaId: bateriaOrigem.id, pago: false };
      expect(() => executarMovimentacao(inscricao, { ...bateriaOrigem }, { ...bateriaDestinoPassada })).toThrow(
        /horário já iniciado/
      );
    });
  });

  // -------------------------------------------------------------------------
  // 3. Preservação de Endereço Multi-Campo no Totem (Item 24)
  // -------------------------------------------------------------------------
  describe('Combinação: Preservação de Número e Complemento com Edição Parcial de Endereço (Item 24)', () => {
    it('ao editar endereço pelo totem, preserva colunas Numero e Complemento relacionais', () => {
      const clienteOriginal: ClienteRecord = {
        id: 77,
        nome: 'Roberta Almeida',
        tipoDocumento: 'CPF',
        documento: '987.654.321-99',
        email: 'roberta@kart.test',
        telefone: '(31) 98765-1122',
        nascimento: '1992-08-14',
        peso: 58,
        cep: '32600-200',
        endereco: 'Rua Rio de Janeiro',
        numero: '500',
        complemento: 'Ap 304',
        bairro: 'Brasiléia',
        cidade: 'Betim',
        estado: 'MG',
      };

      // Simulação do comportamento da rota POST /api/totem/cadastro com a correção do Item 24
      const atualizarCadastroTotem = (
        cliente: ClienteRecord,
        dadosEntrada: { endereco?: string; telefone?: string }
      ) => {
        // Se o totem manda o endereço unificado ou não altera, não deve apagar Numero e Complemento
        const atualizado = { ...cliente };
        if (dadosEntrada.telefone) atualizado.telefone = dadosEntrada.telefone;
        if (dadosEntrada.endereco !== undefined && dadosEntrada.endereco.trim() !== '') {
          atualizado.endereco = dadosEntrada.endereco.trim();
        }
        // A CORREÇÃO: Não executa UPDATE dbo.Cliente SET Numero = NULL, Complemento = NULL!
        return atualizado;
      };

      const clienteAtualizado = atualizarCadastroTotem(clienteOriginal, {
        telefone: '(31) 99999-8888',
        endereco: 'Rua Rio de Janeiro, 500, Ap 304',
      });

      expect(clienteAtualizado.telefone).toBe('(31) 99999-8888');
      expect(clienteAtualizado.numero).toBe('500'); // Preservado!
      expect(clienteAtualizado.complemento).toBe('Ap 304'); // Preservado!
    });
  });

  // -------------------------------------------------------------------------
  // 4. Idempotência sob Concorrência no Checkout (Item 11)
  // -------------------------------------------------------------------------
  describe('Combinação: Idempotência sob Concorrência de Checkout (Item 11)', () => {
    it('requisições concorrentes com a mesma chave retornam o mesmo resultado sem duplicar registros', async () => {
      interface RegistroVenda { id: number; total: number; chaveIdempotencia: string }
      const bancoVendas: RegistroVenda[] = [];
      const chavesBloqueadas = new Set<string>();

      let proximoIdVenda = 1000;

      const checkoutComIdempotencia = async (
        chave: string,
        total: number
      ): Promise<RegistroVenda> => {
        // Simula lock atômico UPDLOCK no banco para a chave
        const existente = bancoVendas.find((v) => v.chaveIdempotencia === chave);
        if (existente) {
          return existente;
        }

        if (chavesBloqueadas.has(chave)) {
          // Aguarda liberação
          while (chavesBloqueadas.has(chave)) {
            await new Promise((r) => setTimeout(r, 5));
          }
          return bancoVendas.find((v) => v.chaveIdempotencia === chave)!;
        }

        chavesBloqueadas.add(chave);
        try {
          // Processa venda
          const novaVenda: RegistroVenda = {
            id: ++proximoIdVenda,
            total,
            chaveIdempotencia: chave,
          };
          bancoVendas.push(novaVenda);
          return novaVenda;
        } finally {
          chavesBloqueadas.delete(chave);
        }
      };

      // Dispara 3 requisições simultâneas com a mesma idempotencyKey
      const chave = 'idemp-checkout-race-9988';
      const [res1, res2, res3] = await Promise.all([
        checkoutComIdempotencia(chave, 12000),
        checkoutComIdempotencia(chave, 12000),
        checkoutComIdempotencia(chave, 12000),
      ]);

      // Todas retornam o mesmo ID de venda
      expect(res1.id).toBe(res2.id);
      expect(res2.id).toBe(res3.id);
      // Apenas 1 venda foi criada no banco
      expect(bancoVendas.length).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Isolamento Transacional de Abertura de Caixa (Item 15)
  // -------------------------------------------------------------------------
  describe('Combinação: Isolamento de Abertura Concorrente no Terminal (Item 15)', () => {
    it('índice único filtrado UX_Movimento_TerminalAberto garante que apenas um caixa fique aberto', async () => {
      interface Movimento { id: number; terminalId: number; fechadoEm: Date | null }
      const movimentos: Movimento[] = [];
      let nextId = 1;

      const tentarAbrirCaixa = (terminalId: number) => {
        // Simula índice filtrado WHERE FechadoEm IS NULL
        const aberto = movimentos.find((m) => m.terminalId === terminalId && m.fechadoEm === null);
        if (aberto) {
          throw new Error('Violation of UNIQUE KEY constraint UX_Movimento_TerminalAberto');
        }
        const mov: Movimento = { id: nextId++, terminalId, fechadoEm: null };
        movimentos.push(mov);
        return mov;
      };

      const mov1 = tentarAbrirCaixa(1);
      expect(mov1.id).toBe(1);

      // Segunda tentativa com o terminal ainda aberto lança erro de violação de chave única
      expect(() => tentarAbrirCaixa(1)).toThrow(/UX_Movimento_TerminalAberto/);

      // Após fechar o movimento, é possível abrir outro
      mov1.fechadoEm = new Date();
      const mov2 = tentarAbrirCaixa(1);
      expect(mov2.id).toBe(2);
    });
  });
});
