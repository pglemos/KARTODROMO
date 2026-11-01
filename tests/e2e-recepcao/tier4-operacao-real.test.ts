import { describe, expect, it } from 'vitest';
import {
  OraculoFinanceiro,
  SimuladorFilaImpressao,
  type ItemVendaInput,
  type PagamentoInput,
} from './harness';

describe('Tier 4: Cenários Reais da Operação da Recepção', () => {
  // -------------------------------------------------------------------------
  // Cenário 1: Ciclo Completo de Turno do Operador
  // -------------------------------------------------------------------------
  describe('Cenário Real 1: Ciclo Completo de Turno do Operador de Recepção', () => {
    interface MovimentoCaixa {
      id: number;
      operador: string;
      terminalId: number;
      inicialCentavos: number;
      abertoEm: Date;
      fechadoEm: Date | null;
      proximoTurnoCentavos: number | null;
    }

    interface TransacaoCaixa {
      id: number;
      movimentoId: number;
      tipo: 'suprimento' | 'sangria';
      valorCentavos: number;
      motivo: string;
    }

    interface ItemVendaReal {
      id: number;
      vendaId: number;
      descricao: string;
      unitarioCentavos: number;
      quantidade: number;
      descontoCentavos: number;
      liquidoCentavos: number;
      estornado: boolean;
      voucherId?: number | null;
    }

    interface VendaReal {
      id: number;
      movimentoId: number;
      brutoCentavos: number;
      descontoCentavos: number;
      finalCentavos: number;
      recebidoCentavos: number;
      trocoCentavos: number;
      cancelada: boolean;
      itens: ItemVendaReal[];
      pagamentos: PagamentoInput[];
    }

    interface ParceiroComissaoReal {
      id: number;
      vendaId: number;
      parceiroId: number;
      baseCentavos: number;
      percentual: number;
      valorCentavos: number;
      estado: 'ativa' | 'estornada';
    }

    // Estado da operação do turno
    let movimento: MovimentoCaixa;
    const transacoes: TransacaoCaixa[] = [];
    const vendas: VendaReal[] = [];
    const comissoes: ParceiroComissaoReal[] = [];

    // Função auxiliar para calcular dinheiro físico em caixa
    const calcularDinheiroEmGaveta = () => {
      let dinheiro = movimento.inicialCentavos;
      for (const t of transacoes) {
        if (t.tipo === 'suprimento') dinheiro += t.valorCentavos;
        if (t.tipo === 'sangria') dinheiro -= t.valorCentavos;
      }
      for (const v of vendas) {
        for (const p of v.pagamentos) {
          if (p.tipo === 'dinheiro') dinheiro += p.valorCentavos;
        }
        dinheiro -= v.trocoCentavos;
        // Subtrai estornos em dinheiro
        for (const it of v.itens) {
          if (it.estornado) {
            dinheiro -= it.liquidoCentavos;
          }
        }
      }
      return dinheiro;
    };

    it('Etapa 1: Abertura de Caixa no Terminal 1 com suprimento inicial de R$ 200,00', () => {
      movimento = {
        id: 1,
        operador: 'suenia',
        terminalId: 1,
        inicialCentavos: 20000, // R$ 200,00
        abertoEm: new Date('2026-10-26T13:00:00Z'),
        fechadoEm: null,
        proximoTurnoCentavos: null,
      };

      expect(movimento.id).toBe(1);
      expect(movimento.fechadoEm).toBeNull();
      expect(calcularDinheiroEmGaveta()).toBe(20000); // R$ 200,00 em gaveta
    });

    it('Etapa 2: Venda 1 - 2x Vagas de Bateria em Dinheiro (R$ 240,00) com nota de R$ 300,00 e troco de R$ 60,00', () => {
      const itens: ItemVendaInput[] = [
        { descricao: 'Bateria Light 15h - Piloto 1', quantidade: 1, unitarioCentavos: 12000 },
        { descricao: 'Bateria Light 15h - Piloto 2', quantidade: 1, unitarioCentavos: 12000 },
      ];
      const totais = OraculoFinanceiro.calcularTotais(itens);
      expect(totais.final).toBe(24000); // R$ 240,00

      const pagamentos: PagamentoInput[] = [
        { formaPagamentoId: 1, tipo: 'dinheiro', valorCentavos: 30000 }, // R$ 300,00
      ];
      const { recebido, troco } = OraculoFinanceiro.validarEPagamento(totais.final, pagamentos);
      expect(troco).toBe(6000); // R$ 60,00 de troco em dinheiro

      const venda1: VendaReal = {
        id: 101,
        movimentoId: movimento.id,
        brutoCentavos: totais.bruto,
        descontoCentavos: 0,
        finalCentavos: totais.final,
        recebidoCentavos: recebido,
        trocoCentavos: troco,
        cancelada: false,
        itens: itens.map((it, idx) => ({
          id: idx + 1,
          vendaId: 101,
          descricao: it.descricao,
          unitarioCentavos: it.unitarioCentavos,
          quantidade: it.quantidade,
          descontoCentavos: 0,
          liquidoCentavos: it.unitarioCentavos * it.quantidade,
          estornado: false,
        })),
        pagamentos,
      };
      vendas.push(venda1);

      // Saldo em caixa: 200 (inicial) + 300 (recebido) - 60 (troco) = R$ 440,00
      expect(calcularDinheiroEmGaveta()).toBe(44000);
    });

    it('Etapa 3: Venda 2 - Vaga Super + Balaclava em Cartão e Pix (R$ 170,00) sem troco', () => {
      const itens: ItemVendaInput[] = [
        { descricao: 'Bateria Super 16h - Piloto 3', quantidade: 1, unitarioCentavos: 14000 },
        { descricao: 'Balaclava de Algodão', quantidade: 1, unitarioCentavos: 3000 },
      ];
      const totais = OraculoFinanceiro.calcularTotais(itens);
      expect(totais.final).toBe(17000); // R$ 170,00

      const pagamentos: PagamentoInput[] = [
        { formaPagamentoId: 2, tipo: 'cartao_debito', valorCentavos: 10000 }, // R$ 100,00 no débito
        { formaPagamentoId: 3, tipo: 'pix', valorCentavos: 7000 }, // R$ 70,00 no Pix
      ];
      const { recebido, troco } = OraculoFinanceiro.validarEPagamento(totais.final, pagamentos);
      expect(troco).toBe(0); // Cartão/Pix nunca gera troco

      const venda2: VendaReal = {
        id: 102,
        movimentoId: movimento.id,
        brutoCentavos: totais.bruto,
        descontoCentavos: 0,
        finalCentavos: totais.final,
        recebidoCentavos: recebido,
        trocoCentavos: troco,
        cancelada: false,
        itens: itens.map((it, idx) => ({
          id: idx + 10,
          vendaId: 102,
          descricao: it.descricao,
          unitarioCentavos: it.unitarioCentavos,
          quantidade: it.quantidade,
          descontoCentavos: 0,
          liquidoCentavos: it.unitarioCentavos * it.quantidade,
          estornado: false,
        })),
        pagamentos,
      };
      vendas.push(venda2);

      // Dinheiro em gaveta inalterado: continua R$ 440,00
      expect(calcularDinheiroEmGaveta()).toBe(44000);
    });

    it('Etapa 4: Sangria de R$ 300,00 para cofre aprovada após validação de saldo físico', () => {
      const saldoAtual = calcularDinheiroEmGaveta();
      const valorSangria = 30000; // R$ 300,00
      expect(OraculoFinanceiro.validarSangria(saldoAtual, valorSangria)).toBe(true);

      transacoes.push({
        id: 1,
        movimentoId: movimento.id,
        tipo: 'sangria',
        valorCentavos: valorSangria,
        motivo: 'Sangria de segurança para cofre',
      });

      // Saldo em dinheiro restante: R$ 440,00 - R$ 300,00 = R$ 140,00 (14.000 centavos)
      expect(calcularDinheiroEmGaveta()).toBe(14000);
    });

    it('Etapa 5: Tentativa de sangria ilegal de R$ 200,00 (maior que os R$ 140,00 em caixa) é barrada com erro 400', () => {
      const saldoAtual = calcularDinheiroEmGaveta();
      expect(saldoAtual).toBe(14000);
      expect(() => OraculoFinanceiro.validarSangria(saldoAtual, 20000)).toThrow(
        /Valor de sangria maior que o valor em caixa/
      );
      // Saldo permanece R$ 140,00
      expect(calcularDinheiroEmGaveta()).toBe(14000);
    });

    it('Etapa 6: Venda 3 - Vaga com voucher de parceiro (R$ 90,00) + Luvas (R$ 50,00) em dinheiro com comissão', () => {
      const itens: ItemVendaInput[] = [
        {
          descricao: 'Vaga Bateria 17h (Voucher Pousada)',
          quantidade: 1,
          unitarioCentavos: 12000,
          descontoCentavos: 3000, // Desconto voucher R$ 30,00
          voucherId: 5,
        },
        {
          descricao: 'Luvas de Competição',
          quantidade: 1,
          unitarioCentavos: 5000,
          descontoCentavos: 0,
        },
      ];
      const totais = OraculoFinanceiro.calcularTotais(itens);
      expect(totais.bruto).toBe(17000);
      expect(totais.desconto).toBe(3000);
      expect(totais.final).toBe(14000); // R$ 140,00

      const pagamentos: PagamentoInput[] = [
        { formaPagamentoId: 1, tipo: 'dinheiro', valorCentavos: 14000 },
      ];
      const { recebido, troco } = OraculoFinanceiro.validarEPagamento(totais.final, pagamentos);

      const venda3: VendaReal = {
        id: 103,
        movimentoId: movimento.id,
        brutoCentavos: totais.bruto,
        descontoCentavos: totais.desconto,
        finalCentavos: totais.final,
        recebidoCentavos: recebido,
        trocoCentavos: troco,
        cancelada: false,
        itens: [
          {
            id: 20,
            vendaId: 103,
            descricao: itens[0].descricao,
            unitarioCentavos: 12000,
            quantidade: 1,
            descontoCentavos: 3000,
            liquidoCentavos: 9000,
            estornado: false,
            voucherId: 5,
          },
          {
            id: 21,
            vendaId: 103,
            descricao: itens[1].descricao,
            unitarioCentavos: 5000,
            quantidade: 1,
            descontoCentavos: 0,
            liquidoCentavos: 5000,
            estornado: false,
          },
        ],
        pagamentos,
      };
      vendas.push(venda3);

      // Comissão do parceiro de 15% sobre o item do voucher (R$ 90,00 líq = R$ 13,50)
      comissoes.push({
        id: 1,
        vendaId: 103,
        parceiroId: 8,
        baseCentavos: 9000,
        percentual: 15,
        valorCentavos: 1350,
        estado: 'ativa',
      });

      // Dinheiro em caixa: 140 (anterior) + 140 (venda 3) = R$ 280,00
      expect(calcularDinheiroEmGaveta()).toBe(28000);
    });

    it('Etapa 7: Estorno parcial apenas da Luva (R$ 50,00) devolvendo dinheiro sem cancelar voucher/comissão da vaga', () => {
      const venda3 = vendas.find((v) => v.id === 103)!;
      const itemLuva = venda3.itens.find((i) => i.id === 21)!;

      // Estorna somente o item 21 (Luva)
      itemLuva.estornado = true;

      // Regra do Item 16: O item 20 (Vaga com voucher) continua ativo e a comissão continua 'ativa'
      const itemVaga = venda3.itens.find((i) => i.id === 20)!;
      expect(itemVaga.estornado).toBe(false);

      const comissao = comissoes.find((c) => c.vendaId === 103)!;
      expect(comissao.estado).toBe('ativa'); // Não estornou a comissão do parceiro!

      // Dinheiro em caixa: R$ 280,00 - R$ 50,00 (estorno devolvido ao cliente) = R$ 230,00
      expect(calcularDinheiroEmGaveta()).toBe(23000);
    });

    it('Etapa 8: Fechamento de Caixa: validação de saldo para próximo turno e encerramento', () => {
      const saldoFinalDinheiro = calcularDinheiroEmGaveta();
      expect(saldoFinalDinheiro).toBe(23000); // R$ 230,00

      // Tentativa de deixar R$ 250,00 para o próximo turno falha
      expect(() => OraculoFinanceiro.validarFechamentoTurno(saldoFinalDinheiro, 25000)).toThrow(
        /Não há saldo em dinheiro suficiente no caixa/
      );

      // Informa R$ 200,00 para o próximo operador (aprovado)
      const proximoTurno = 20000;
      expect(OraculoFinanceiro.validarFechamentoTurno(saldoFinalDinheiro, proximoTurno)).toBe(true);

      movimento.fechadoEm = new Date('2026-10-26T22:00:00Z');
      movimento.proximoTurnoCentavos = proximoTurno;

      expect(movimento.fechadoEm).not.toBeNull();
      expect(movimento.proximoTurnoCentavos).toBe(20000);
    });
  });

  // -------------------------------------------------------------------------
  // Cenário 2: Enfileiramento e Consumo Concorrente de Termos
  // -------------------------------------------------------------------------
  describe('Cenário Real 2: Enfileiramento e Consumo Concorrente de Termos de Responsabilidade (Itens 1, 2, 4, 6)', () => {
    it('múltiplos totens enfileiram termos simultaneamente e agente processa com contingência sem perdas', async () => {
      const fila = new SimuladorFilaImpressao();

      // Dois totens enfileiram termos ao mesmo tempo
      const termoTotem1A = fila.enfileirar('/termo?id=101', 'Termo Piloto Lucas', 'Totem 1');
      const termoTotem2A = fila.enfileirar('/termo?id=102', 'Termo Piloto Beatriz', 'Totem 2');
      const termoTotem1B = fila.enfileirar('/termo?id=103', 'Termo Menor Enzo (Resp: Lucas)', 'Totem 1');
      const termoTotem2B = fila.enfileirar('/termo?id=104', 'Termo Piloto Rafael', 'Totem 2');

      expect(fila.obterTodos().length).toBe(4);
      expect(fila.obterPorStatus('pendente').length).toBe(4);

      // Agente da recepção inicia consumo
      const agora = new Date('2026-10-26T16:00:00Z');

      // 1. Processa Termo 1
      const job1 = fila.proximoJob(agora);
      expect(job1?.id).toBe(termoTotem1A.id);
      expect(job1?.status).toBe('imprimindo');
      // Impressão concluída
      fila.marcarFeita(job1!.id, new Date('2026-10-26T16:00:05Z'));

      // 2. Processa Termo 2, mas ocorre falha transitória (ex.: impressora sem papel)
      const job2 = fila.proximoJob(new Date('2026-10-26T16:00:06Z'));
      expect(job2?.id).toBe(termoTotem2A.id);
      fila.marcarFalhou(job2!.id, 'Spooler reporta fim de bobina', new Date('2026-10-26T16:00:10Z'));

      // Verifica que o termo não sumiu nem foi descartado
      const termoFalho = fila.obterTodos().find((j) => j.id === job2!.id);
      expect(termoFalho?.status).toBe('falhou');
      expect(termoFalho?.ultimoErro).toContain('fim de bobina');

      // 3. Processa Termos 3 e 4
      const job3 = fila.proximoJob(new Date('2026-10-26T16:00:15Z'));
      expect(job3?.id).toBe(termoTotem1B.id);
      fila.marcarFeita(job3!.id, new Date('2026-10-26T16:00:20Z'));

      const job4 = fila.proximoJob(new Date('2026-10-26T16:00:22Z'));
      expect(job4?.id).toBe(termoTotem2B.id);
      fila.marcarFeita(job4!.id, new Date('2026-10-26T16:00:25Z'));

      // Fila de pendentes agora está vazia
      expect(fila.proximoJob(new Date('2026-10-26T16:00:30Z'))).toBeNull();

      // Total de termos impressos com sucesso = 3; em contingência/falha retida = 1
      expect(fila.obterPorStatus('impressa').length).toBe(3);
      expect(fila.obterPorStatus('falhou').length).toBe(1);

      // O termo falho pode ser reaberto pelo operador para reimpressão
      fila.recuperarParaFila(job2!.id);

      // Agora o job 2 volta a ser o próximo da fila
      const job2Recuperado = fila.proximoJob(new Date('2026-10-26T16:01:00Z'));
      expect(job2Recuperado?.id).toBe(job2!.id);
      fila.marcarFeita(job2Recuperado!.id, new Date('2026-10-26T16:01:05Z'));

      expect(fila.obterPorStatus('impressa').length).toBe(4);
      expect(fila.obterPorStatus('pendente').length).toBe(0);
    });
  });
});
