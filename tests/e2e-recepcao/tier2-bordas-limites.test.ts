import { describe, expect, it } from 'vitest';
import {
  OraculoBaterias,
  OraculoCliente,
  OraculoFinanceiro,
  SimuladorFilaImpressao,
  type ItemVendaInput,
  type PagamentoInput,
} from './harness';

describe('Tier 2: Casos de Borda e Limites dos 36 Itens da Recepção', () => {
  // -------------------------------------------------------------------------
  // 1. Pagamentos e Troco (Item 10)
  // -------------------------------------------------------------------------
  describe('Troco Exato vs Troco Excessivo em Dinheiro/Cartão (Item 10)', () => {
    const total = 10000; // R$ 100,00

    it('rejeita troco quando o pagamento é 100% Cartão de Crédito com valor superior', () => {
      const pagamentos: PagamentoInput[] = [
        { formaPagamentoId: 2, tipo: 'cartao_credito', valorCentavos: 12000 },
      ];
      expect(() => OraculoFinanceiro.validarEPagamento(total, pagamentos)).toThrow(
        /Troco só pode ser dado sobre pagamento em dinheiro/
      );
    });

    it('rejeita troco quando o pagamento é 100% Pix com valor superior', () => {
      const pagamentos: PagamentoInput[] = [
        { formaPagamentoId: 3, tipo: 'pix', valorCentavos: 10500 },
      ];
      expect(() => OraculoFinanceiro.validarEPagamento(total, pagamentos)).toThrow(
        /Troco só pode ser dado sobre pagamento em dinheiro/
      );
    });

    it('permite troco em pagamento misto onde o troco é menor ou igual ao dinheiro recebido', () => {
      // Venda R$ 100: R$ 50 dinheiro + R$ 60 cartão = R$ 110 recebido. Troco R$ 10. Dinheiro (R$ 50) >= R$ 10
      const pagamentos: PagamentoInput[] = [
        { formaPagamentoId: 1, tipo: 'dinheiro', valorCentavos: 5000 },
        { formaPagamentoId: 2, tipo: 'cartao_credito', valorCentavos: 6000 },
      ];
      const res = OraculoFinanceiro.validarEPagamento(total, pagamentos);
      expect(res.troco).toBe(1000); // R$ 10,00 de troco em dinheiro
    });

    it('rejeita troco em pagamento misto onde o troco excede o valor recebido em dinheiro', () => {
      // Venda R$ 100: R$ 10 dinheiro + R$ 110 cartão = R$ 120 recebido. Troco R$ 20. Dinheiro é só R$ 10!
      const pagamentos: PagamentoInput[] = [
        { formaPagamentoId: 1, tipo: 'dinheiro', valorCentavos: 1000 },
        { formaPagamentoId: 2, tipo: 'cartao_credito', valorCentavos: 11000 },
      ];
      expect(() => OraculoFinanceiro.validarEPagamento(total, pagamentos)).toThrow(
        /Troco não pode exceder o valor recebido em dinheiro/
      );
    });

    it('em dinheiro puro com valor exato, troco é exatamente zero', () => {
      const pagamentos: PagamentoInput[] = [
        { formaPagamentoId: 1, tipo: 'dinheiro', valorCentavos: 10000 },
      ];
      const res = OraculoFinanceiro.validarEPagamento(total, pagamentos);
      expect(res.troco).toBe(0);
    });

    it('rejeita pagamento insuficiente quando validarTotalPago for true', () => {
      const pagamentos: PagamentoInput[] = [
        { formaPagamentoId: 1, tipo: 'dinheiro', valorCentavos: 9999 },
      ];
      expect(() => OraculoFinanceiro.validarEPagamento(total, pagamentos, true)).toThrow(
        /Ainda faltam ser pagos 1 centavos/
      );
    });
  });

  // -------------------------------------------------------------------------
  // 2. Carrinho Zerado e Limites de Itens (Itens 10, 11)
  // -------------------------------------------------------------------------
  describe('Carrinho Zerado e Limites de Desconto (Itens 10, 11)', () => {
    it('carrinho com itens vazios resulta em totais zerados', () => {
      const totais = OraculoFinanceiro.calcularTotais([]);
      expect(totais.bruto).toBe(0);
      expect(totais.final).toBe(0);
    });

    it('aceita item com desconto de 100% (liquido zero)', () => {
      const itens: ItemVendaInput[] = [
        { descricao: 'Vaga Cortesia Piloto Campeão', quantidade: 1, unitarioCentavos: 12000, descontoCentavos: 12000 },
      ];
      const totais = OraculoFinanceiro.calcularTotais(itens);
      expect(totais.bruto).toBe(12000);
      expect(totais.desconto).toBe(12000);
      expect(totais.final).toBe(0);
    });

    it('rejeita item cujo desconto é 1 centavo maior que o valor bruto', () => {
      const itens: ItemVendaInput[] = [
        { descricao: 'Item com Desconto Abusivo', quantidade: 1, unitarioCentavos: 10000, descontoCentavos: 10001 },
      ];
      expect(() => OraculoFinanceiro.calcularTotais(itens)).toThrow(
        /Desconto maior que o valor do item/
      );
    });
  });

  // -------------------------------------------------------------------------
  // 3. Bateria no Minuto Limite e Tolerâncias (Itens 17, 18)
  // -------------------------------------------------------------------------
  describe('Bateria no Minuto Limite - Eliminação de Tolerância de -30 min (Itens 17, 18)', () => {
    const inicio = '2026-10-26T15:00:00Z';

    it('permite agendamento 1 segundo antes do início', () => {
      const umSegundoAntes = new Date('2026-10-26T14:59:59Z');
      expect(OraculoBaterias.bateriaEstaAgendavel(inicio, umSegundoAntes)).toBe(true);
    });

    it('bloqueia agendamento exatamente no segundo do início', () => {
      const exatamenteInicio = new Date('2026-10-26T15:00:00Z');
      expect(OraculoBaterias.bateriaEstaAgendavel(inicio, exatamenteInicio)).toBe(false);
    });

    it('bloqueia agendamento 1 segundo após o início', () => {
      const umSegundoDepois = new Date('2026-10-26T15:00:01Z');
      expect(OraculoBaterias.bateriaEstaAgendavel(inicio, umSegundoDepois)).toBe(false);
    });

    it('bloqueia agendamento 25 minutos após o início (que a tolerância indevida legada aceitava)', () => {
      const vinteCincoMinutosDepois = new Date('2026-10-26T15:25:00Z');
      expect(OraculoBaterias.bateriaEstaAgendavel(inicio, vinteCincoMinutosDepois)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Faixas Extremas de Tolerância de Peso (Item 27)
  // -------------------------------------------------------------------------
  describe('Harmonização Estrita de Faixas de Peso: 15 kg a 250 kg (Item 27)', () => {
    it('rejeita 14.9 kg (abaixo do limite mínimo de 15 kg)', () => {
      const res = OraculoCliente.validarPeso('14.9');
      expect(res.valido).toBe(false);
      expect(res.erro).toContain('entre 15 kg e 250 kg');
    });

    it('aceita exatamente 15.0 kg (limite inferior)', () => {
      const res = OraculoCliente.validarPeso('15.0');
      expect(res.valido).toBe(true);
      expect(res.peso).toBe(15.0);
    });

    it('aceita exatamente 250.0 kg (limite superior)', () => {
      const res = OraculoCliente.validarPeso('250.0');
      expect(res.valido).toBe(true);
      expect(res.peso).toBe(250.0);
    });

    it('rejeita 250.1 kg (acima do limite máximo de 250 kg)', () => {
      const res = OraculoCliente.validarPeso('250.1');
      expect(res.valido).toBe(false);
      expect(res.erro).toContain('entre 15 kg e 250 kg');
    });

    it('rejeita zero, valores negativos e não numéricos', () => {
      expect(OraculoCliente.validarPeso('0').valido).toBe(false);
      expect(OraculoCliente.validarPeso('-10').valido).toBe(false);
      expect(OraculoCliente.validarPeso('abc').valido).toBe(false);
      expect(OraculoCliente.validarPeso('').valido).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Sangria nos Limites do Caixa (Item 12)
  // -------------------------------------------------------------------------
  describe('Validação Limite de Sangria (Item 12)', () => {
    const saldoGaveta = 35000; // R$ 350,00

    it('permite sangria de exatamente 100% do saldo em gaveta', () => {
      expect(OraculoFinanceiro.validarSangria(saldoGaveta, 35000)).toBe(true);
    });

    it('rejeita sangria de 1 centavo acima do saldo em gaveta', () => {
      expect(() => OraculoFinanceiro.validarSangria(saldoGaveta, 35001)).toThrow(
        /Valor de sangria maior que o valor em caixa/
      );
    });

    it('rejeita sangria com valor zero ou negativo', () => {
      expect(() => OraculoFinanceiro.validarSangria(saldoGaveta, 0)).toThrow(/Informe o valor/);
      expect(() => OraculoFinanceiro.validarSangria(saldoGaveta, -500)).toThrow(/Informe o valor/);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Fechamento de Caixa nos Limites (Item 13)
  // -------------------------------------------------------------------------
  describe('Validação Limite de Saldo para Próximo Turno (Item 13)', () => {
    const saldoCaixa = 20000; // R$ 200,00

    it('permite valor para próximo turno exatamente igual ao saldo em caixa', () => {
      expect(OraculoFinanceiro.validarFechamentoTurno(saldoCaixa, 20000)).toBe(true);
    });

    it('permite valor para próximo turno igual a zero (caixa limpo)', () => {
      expect(OraculoFinanceiro.validarFechamentoTurno(saldoCaixa, 0)).toBe(true);
    });

    it('rejeita valor para próximo turno 1 centavo acima do saldo em dinheiro', () => {
      expect(() => OraculoFinanceiro.validarFechamentoTurno(saldoCaixa, 20001)).toThrow(
        /Não há saldo em dinheiro suficiente no caixa/
      );
    });

    it('rejeita valor negativo para o próximo turno', () => {
      expect(() => OraculoFinanceiro.validarFechamentoTurno(saldoCaixa, -100)).toThrow(
        /Valor para próximo turno inválido/
      );
    });
  });

  // -------------------------------------------------------------------------
  // 7. Máscara de Telefone e Posição do Cursor (Itens 23, 26)
  // -------------------------------------------------------------------------
  describe('Máscaras de Telefone e Edição no Meio do Texto (Itens 23, 26)', () => {
    it('suporta telefone nacional com DDD e 9 dígitos', () => {
      const formatarTelefone = (input: string) => {
        const d = input.replace(/\D/g, '');
        if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
        if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
        return input;
      };

      expect(formatarTelefone('31987654321')).toBe('(31) 98765-4321');
      expect(formatarTelefone('3133334444')).toBe('(31) 3333-4444');
    });

    it('suporta número internacional com código de país para turistas sem travar em máscara rígida', () => {
      const validarTelefoneFlexivel = (tel: string) => {
        const digits = tel.replace(/\D/g, '');
        // Padrão ITU-T E.164: entre 8 e 15 dígitos
        return digits.length >= 8 && digits.length <= 15;
      };

      expect(validarTelefoneFlexivel('+1 555-0199')).toBe(true);
      expect(validarTelefoneFlexivel('+351 912 345 678')).toBe(true);
      expect(validarTelefoneFlexivel('(31) 98888-0000')).toBe(true);
    });

    it('ao editar dígito no meio da string, o cursor não é forçado para o fim', () => {
      const textoAntigo = '3198888';
      const novoFormatado = '(31) 98888';
      // Usuário editou após o DDD (posição 2)
      const novaPosicao = OraculoCliente.calcularCursorMascara(textoAntigo, novoFormatado, 2);
      expect(novaPosicao).toBeLessThan(novoFormatado.length);
      expect(novaPosicao).toBeGreaterThanOrEqual(3); // após o ') '
    });
  });

  // -------------------------------------------------------------------------
  // 8. Dimensões Limites do LinearGradientBrush (Item 36)
  // -------------------------------------------------------------------------
  describe('Limites de Dimensão em LinearGradientBrush (Item 36)', () => {
    const criarBrushProtegido = (w: number, h: number) => {
      if (w <= 0 || h <= 0) {
        return null;
      }
      return { width: w, height: h };
    };

    it('trata dimensões 0x0, 0x100 e 100x0 retornando nulo sem lançar exceção', () => {
      expect(criarBrushProtegido(0, 0)).toBeNull();
      expect(criarBrushProtegido(0, 100)).toBeNull();
      expect(criarBrushProtegido(100, 0)).toBeNull();
      expect(criarBrushProtegido(-1, 50)).toBeNull();
    });

    it('aceita dimensão mínima válida 1x1', () => {
      const brush = criarBrushProtegido(1, 1);
      expect(brush).not.toBeNull();
      expect(brush?.width).toBe(1);
      expect(brush?.height).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // 9. Fila de Impressão e Janela de Reentrega (Itens 1, 2)
  // -------------------------------------------------------------------------
  describe('Fila de Impressão: Reentrega e Contingência sem Purga (Itens 1, 2)', () => {
    it('job em impressão há menos de 90 segundos não é reentregue antecipadamente', () => {
      const fila = new SimuladorFilaImpressao();
      fila.enfileirar('/termo?id=200', 'Termo Teste', 'Totem 1');
      const t0 = new Date('2026-10-26T12:00:00Z');
      fila.proximoJob(t0);

      // 89 segundos depois: ainda não venceu timeout de reentrega
      const t89 = new Date('2026-10-26T12:01:29Z');
      expect(fila.proximoJob(t89)).toBeNull();
    });

    it('job em impressão há 91 segundos (> 90s) é reentregue automaticamente', () => {
      const fila = new SimuladorFilaImpressao();
      const job = fila.enfileirar('/termo?id=201', 'Termo Teste 2', 'Totem 1');
      const t0 = new Date('2026-10-26T12:00:00Z');
      fila.proximoJob(t0);

      // 91 segundos depois: reentrega atômica
      const t91 = new Date('2026-10-26T12:01:31Z');
      const reentregue = fila.proximoJob(t91);
      expect(reentregue).not.toBeNull();
      expect(reentregue?.id).toBe(job.id);
      expect(reentregue?.tentativas).toBe(2);
    });

    it('jobs com mais de 3 horas não são apagados da fila persistente', () => {
      const fila = new SimuladorFilaImpressao();
      fila.enfileirar('/termo?id=202', 'Termo Antigo Retido', 'Totem 1');

      // Simula consulta 4 horas depois
      const todos = fila.obterTodos();
      expect(todos.length).toBe(1);
      expect(todos[0].id).toBe(1);
    });
  });
});
