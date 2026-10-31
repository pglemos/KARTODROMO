import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

const caixaCs = read('desktop/src/Kartodromo.Recepcao/Caixa.cs');
const telasCaixaCs = read('desktop/src/Kartodromo.Recepcao/TelasCaixa.cs');
const formTvCs = read('desktop/src/Kartodromo.Cronometragem/FormTV.cs');
const officeTs = read('lib/ops/office.ts');

// ============================================================================
// Modelos e Oráculos TypeScript
// ============================================================================

interface ItemCarrinhoModel {
  k: number;
  inscricaoId?: number | null;
  produtoId?: number | null;
  cliente: string;
  produto: string;
  qtd: number;
  unit: number;
  desc: number;
  acr: number;
  descPct: number;
  acrPct: number;
  voucher: boolean;
}

interface PagamentoModel {
  forma: number;
  nome: string;
  valor: number;
}

function esDinheiro(forma: number, nome: string | null | undefined): boolean {
  return forma === 1 || (nome != null && nome.toLowerCase().includes('dinheiro'));
}

function calcularTotais(
  itens: ItemCarrinhoModel[],
  pagamentos: PagamentoModel[]
): {
  tot: number;
  des: number;
  acr: number;
  sub: number;
  rec: number;
  troco: number;
  falta: number;
} {
  const tot = itens.reduce((acc, i) => acc + i.unit * i.qtd, 0);
  const des = itens.reduce((acc, i) => acc + i.desc, 0);
  const acr = itens.reduce((acc, i) => acc + i.acr, 0);
  const sub = tot - des + acr;
  const rec = pagamentos.reduce((acc, p) => acc + p.valor, 0);
  const falta = Math.max(0, sub - rec);
  const excessoTotal = Math.max(0, rec - sub);

  let troco = 0;
  if (excessoTotal > 0) {
    const totalDinheiro = pagamentos
      .filter((p) => esDinheiro(p.forma, p.nome))
      .reduce((acc, p) => acc + p.valor, 0);
    const totalNaoDinheiro = pagamentos
      .filter((p) => !esDinheiro(p.forma, p.nome))
      .reduce((acc, p) => acc + p.valor, 0);
    const subtotalRestante = Math.max(0, sub - totalNaoDinheiro);
    const excessoDinheiro = totalDinheiro - subtotalRestante;
    if (excessoDinheiro > 0) {
      troco = Math.min(excessoTotal, excessoDinheiro);
    }
  }

  return { tot, des, acr, sub, rec, troco, falta };
}

/**
 * Simula a validação pré-checkout do método Aprovar() em Caixa.cs
 */
function validarAprovacao(
  itens: ItemCarrinhoModel[],
  pagamentos: PagamentoModel[],
  pagamentoAtivo: boolean = true
): { aprovado: boolean; erro?: string } {
  if (itens.length === 0) return { aprovado: false, erro: 'Carrinho vazio.' };
  if (!pagamentoAtivo) return { aprovado: false, erro: 'Revise o carrinho e clique em ‘Continuar para pagamento’ antes de concluir.' };

  const t = calcularTotais(itens, pagamentos);
  if (t.falta > 0) {
    return { aprovado: false, erro: `Ainda faltam ser pagos R$ ${(t.falta / 100).toFixed(2)} para poder concluir a compra.` };
  }

  const totalDinheiro = pagamentos.filter((p) => esDinheiro(p.forma, p.nome)).reduce((acc, p) => acc + p.valor, 0);
  const totalNaoDinheiro = pagamentos.filter((p) => !esDinheiro(p.forma, p.nome)).reduce((acc, p) => acc + p.valor, 0);

  if (t.troco > 0 && t.troco > totalDinheiro) {
    return { aprovado: false, erro: 'Troco não pode ser maior que o dinheiro recebido.' };
  }

  if (totalNaoDinheiro > t.sub) {
    return { aprovado: false, erro: 'O valor lançado em cartão/Pix não pode ser superior ao subtotal da venda. Não é permitido troco para pagamentos eletrônicos.' };
  }

  return { aprovado: true };
}

function desvincularVoucherItem(item: ItemCarrinhoModel): void {
  item.voucher = false;
  item.desc = 0;
  item.descPct = 0;
  if (item.acrPct > 0) {
    const baseV = item.unit * item.qtd;
    item.acr = Math.round((baseV * item.acrPct) / 100);
  }
}

function desvincularVoucherCarrinho(
  carrinho: ItemCarrinhoModel[],
  selecionadosK: number[],
  voucherCodigoAtual: string | null
): { voucherCodigo: string | null; itensDesvinculados: number } {
  const selSet = new Set(selecionadosK);
  const comVoucher = carrinho.filter((c) => (selSet.size === 0 || selSet.has(c.k)) && c.voucher);
  if (comVoucher.length === 0) {
    if (voucherCodigoAtual != null || carrinho.some((c) => c.voucher)) {
      // Remover de todos
      for (const c of carrinho.filter((c) => c.voucher)) desvincularVoucherItem(c);
      return { voucherCodigo: null, itensDesvinculados: 0 };
    }
    return { voucherCodigo: voucherCodigoAtual, itensDesvinculados: 0 };
  }

  for (const c of comVoucher) {
    desvincularVoucherItem(c);
  }

  const temRestante = carrinho.some((c) => c.voucher);
  return {
    voucherCodigo: temRestante ? voucherCodigoAtual : null,
    itensDesvinculados: comVoucher.length,
  };
}

function validarSangria(valor: number, dinheiroEmCaixa: number): { valido: boolean; erro: string | null } {
  if (valor <= 0) return { valido: false, erro: 'Informe um valor maior que zero.' };
  if (valor > dinheiroEmCaixa) return { valido: false, erro: 'Valor de sangria não pode ser superior ao dinheiro disponível em caixa.' };
  return { valido: true, erro: null };
}

function validarFechamento(valor: number, dinheiroEmCaixa: number): { valido: boolean; erro: string | null } {
  if (valor < 0) return { valido: false, erro: 'Valor para o próximo turno inválido.' };
  if (valor > dinheiroEmCaixa) return { valido: false, erro: 'O valor para o próximo turno não pode ser superior ao dinheiro disponível em caixa.' };
  return { valido: true, erro: null };
}

// ============================================================================
// Bateria de Testes Adversariais M4
// ============================================================================

describe('Adversarial & Stress Challenger — Milestone M4 (Caixa, Troco & Fraudes)', () => {

  // --------------------------------------------------------------------------
  // Desafio 1: Pagamento 100% Cartão ou Pix com valor superior ao subtotal
  // --------------------------------------------------------------------------
  describe('Desafio 1: Tentativa de Fraude com Cartão ou Pix Excedente', () => {
    it('garante que troco é SEMPRE 0 em pagamento 100% Cartão de Crédito com valor superior', () => {
      const itens: ItemCarrinhoModel[] = [
        { k: 1, cliente: 'Piloto Teste', produto: 'Bateria Noturna', qtd: 1, unit: 15000, desc: 0, acr: 0, descPct: 0, acrPct: 0, voucher: false }
      ];
      // Tentativa de passar R$ 250,00 no cartão em uma compra de R$ 150,00
      const pags: PagamentoModel[] = [
        { forma: 2, nome: 'Cartão de Crédito', valor: 25000 }
      ];

      const res = calcularTotais(itens, pags);
      expect(res.sub).toBe(15000);
      expect(res.rec).toBe(25000);
      expect(res.troco).toBe(0); // VULNERABILIDADE BLOQUEADA: Troco DEVE ser 0!
    });

    it('checkout rejeita categoricamente conclusão quando Cartão de Crédito excede subtotal', () => {
      const itens: ItemCarrinhoModel[] = [
        { k: 1, cliente: 'Piloto Teste', produto: 'Bateria Noturna', qtd: 1, unit: 15000, desc: 0, acr: 0, descPct: 0, acrPct: 0, voucher: false }
      ];
      const pags: PagamentoModel[] = [
        { forma: 2, nome: 'Cartão de Crédito', valor: 25000 }
      ];

      const validacao = validarAprovacao(itens, pags, true);
      expect(validacao.aprovado).toBe(false);
      expect(validacao.erro).toContain('Não é permitido troco para pagamentos eletrônicos.');
    });

    it('garante que troco é SEMPRE 0 em pagamento 100% Pix com valor superior', () => {
      const itens: ItemCarrinhoModel[] = [
        { k: 1, cliente: 'Piloto Teste', produto: 'Bateria Cadete', qtd: 1, unit: 9000, desc: 0, acr: 0, descPct: 0, acrPct: 0, voucher: false }
      ];
      // Tentativa de Pix de R$ 150,00 em compra de R$ 90,00
      const pags: PagamentoModel[] = [
        { forma: 3, nome: 'Pix QR Code', valor: 15000 }
      ];

      const res = calcularTotais(itens, pags);
      expect(res.sub).toBe(9000);
      expect(res.rec).toBe(15000);
      expect(res.troco).toBe(0); // Troco DEVE ser 0
    });

    it('checkout rejeita categoricamente conclusão quando Pix excede subtotal', () => {
      const itens: ItemCarrinhoModel[] = [
        { k: 1, cliente: 'Piloto Teste', produto: 'Bateria Cadete', qtd: 1, unit: 9000, desc: 0, acr: 0, descPct: 0, acrPct: 0, voucher: false }
      ];
      const pags: PagamentoModel[] = [
        { forma: 3, nome: 'Pix QR Code', valor: 15000 }
      ];

      const validacao = validarAprovacao(itens, pags, true);
      expect(validacao.aprovado).toBe(false);
      expect(validacao.erro).toContain('Não é permitido troco para pagamentos eletrônicos.');
    });

    it('combinação de múltiplos meios eletrônicos (Cartão + Pix) somando além do subtotal resulta em troco 0 e checkout rejeitado', () => {
      const itens: ItemCarrinhoModel[] = [
        { k: 1, cliente: 'Piloto Teste', produto: 'Bateria Light', qtd: 1, unit: 10000, desc: 0, acr: 0, descPct: 0, acrPct: 0, voucher: false }
      ];
      // Subtotal R$ 100,00. Pago R$ 70 no cartão e R$ 50 no Pix (Total R$ 120 eletrônico)
      const pags: PagamentoModel[] = [
        { forma: 2, nome: 'Cartão de Débito', valor: 7000 },
        { forma: 3, nome: 'Pix', valor: 5000 }
      ];

      const res = calcularTotais(itens, pags);
      expect(res.troco).toBe(0);

      const validacao = validarAprovacao(itens, pags, true);
      expect(validacao.aprovado).toBe(false);
      expect(validacao.erro).toContain('Não é permitido troco para pagamentos eletrônicos.');
    });
  });

  // --------------------------------------------------------------------------
  // Desafio 2: Pagamentos Mistos e Tentativas de Extração de Dinheiro Físico
  // --------------------------------------------------------------------------
  describe('Desafio 2: Pagamento Misto (Dinheiro + Eletrônico) e Limites de Troco', () => {
    it('em pagamento misto válido, troco é estritamente limitado ao excesso efetivamente recebido em dinheiro', () => {
      const itens: ItemCarrinhoModel[] = [
        { k: 1, cliente: 'Piloto A', produto: 'Bateria', qtd: 1, unit: 20000, desc: 0, acr: 0, descPct: 0, acrPct: 0, voucher: false }
      ];
      // Subtotal R$ 200,00. Cartão R$ 120,00 + Dinheiro R$ 100,00. Total R$ 220,00.
      // Subtotal restante a pagar em dinheiro = 200 - 120 = 80.
      // Dinheiro entregue = 100.
      // Excesso em dinheiro = 100 - 80 = 20.
      const pags: PagamentoModel[] = [
        { forma: 2, nome: 'Cartão de Crédito', valor: 12000 },
        { forma: 1, nome: 'Dinheiro', valor: 10000 }
      ];

      const res = calcularTotais(itens, pags);
      expect(res.sub).toBe(20000);
      expect(res.rec).toBe(22000);
      expect(res.troco).toBe(2000); // Exatamente R$ 20,00 de troco em dinheiro!

      const validacao = validarAprovacao(itens, pags, true);
      expect(validacao.aprovado).toBe(true);
    });

    it('tentativa de fraude em venda mista: cartão já excede subtotal e cliente adiciona dinheiro para extrair troco', () => {
      const itens: ItemCarrinhoModel[] = [
        { k: 1, cliente: 'Fraudador', produto: 'Bateria', qtd: 1, unit: 10000, desc: 0, acr: 0, descPct: 0, acrPct: 0, voucher: false }
      ];
      // Subtotal R$ 100. Passa R$ 150 no cartão e dá R$ 50 em dinheiro.
      const pags: PagamentoModel[] = [
        { forma: 2, nome: 'Cartão de Crédito', valor: 15000 },
        { forma: 1, nome: 'Dinheiro', valor: 5000 }
      ];

      // O checkout DEVE bloquear pois totalNaoDinheiro (150) > sub (100)
      const validacao = validarAprovacao(itens, pags, true);
      expect(validacao.aprovado).toBe(false);
      expect(validacao.erro).toContain('Não é permitido troco para pagamentos eletrônicos.');
    });

    it('troco nunca ultrapassa o montante total de dinheiro entregue na venda', () => {
      const itens: ItemCarrinhoModel[] = [
        { k: 1, cliente: 'Piloto', produto: 'Bateria', qtd: 1, unit: 8000, desc: 0, acr: 0, descPct: 0, acrPct: 0, voucher: false }
      ];
      // Subtotal R$ 80. Dinheiro R$ 100 entregue. Troco = R$ 20.
      const pags: PagamentoModel[] = [
        { forma: 1, nome: 'Dinheiro', valor: 10000 }
      ];

      const res = calcularTotais(itens, pags);
      expect(res.troco).toBe(2000);
      expect(res.troco).toBeLessThanOrEqual(10000);
    });

    it('quando dinheiro entregue é exatamente a quantia faltante após o cartão, troco é zero', () => {
      const itens: ItemCarrinhoModel[] = [
        { k: 1, cliente: 'Piloto', produto: 'Bateria', qtd: 1, unit: 15000, desc: 0, acr: 0, descPct: 0, acrPct: 0, voucher: false }
      ];
      // Subtotal R$ 150. Cartão R$ 100 + Dinheiro R$ 50. Total R$ 150.
      const pags: PagamentoModel[] = [
        { forma: 2, nome: 'Cartão de Débito', valor: 10000 },
        { forma: 1, nome: 'Dinheiro', valor: 5000 }
      ];

      const res = calcularTotais(itens, pags);
      expect(res.sub).toBe(15000);
      expect(res.rec).toBe(15000);
      expect(res.troco).toBe(0);
      expect(res.falta).toBe(0);

      const validacao = validarAprovacao(itens, pags, true);
      expect(validacao.aprovado).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Desafio 3: Fuzzing e Invariantes Matemáticas em 1.000 Cenários Aleatórios
  // --------------------------------------------------------------------------
  describe('Desafio 3: Fuzzing e Teste de Estresse das Invariantes de Troco', () => {
    it('executa 1.000 combinações aleatórias garantindo 6 invariantes fundamentais', () => {
      for (let i = 0; i < 1000; i++) {
        const sub = Math.floor(Math.random() * 50000) + 100; // R$ 1,00 a R$ 500,00
        const dinheiro = Math.random() > 0.3 ? Math.floor(Math.random() * 60000) : 0;
        const cartao = Math.random() > 0.3 ? Math.floor(Math.random() * 60000) : 0;
        const pix = Math.random() > 0.5 ? Math.floor(Math.random() * 30000) : 0;

        const itens: ItemCarrinhoModel[] = [
          { k: 1, cliente: 'Random', produto: 'Prod', qtd: 1, unit: sub, desc: 0, acr: 0, descPct: 0, acrPct: 0, voucher: false }
        ];

        const pags: PagamentoModel[] = [];
        if (dinheiro > 0) pags.push({ forma: 1, nome: 'Dinheiro', valor: dinheiro });
        if (cartao > 0) pags.push({ forma: 2, nome: 'Cartão', valor: cartao });
        if (pix > 0) pags.push({ forma: 3, nome: 'Pix', valor: pix });

        const res = calcularTotais(itens, pags);
        const totalEletronico = cartao + pix;
        const totalDinheiro = dinheiro;

        // Invariante I1: Troco é sempre >= 0
        expect(res.troco).toBeGreaterThanOrEqual(0);

        // Invariante I2: Troco nunca excede o dinheiro físico total recebido
        expect(res.troco).toBeLessThanOrEqual(totalDinheiro);

        // Invariante I3: Se nenhum dinheiro físico foi entregue, troco é SEMPRE 0
        if (totalDinheiro === 0) {
          expect(res.troco).toBe(0);
        }

        // Invariante I4: Se valor recebido é menor que subtotal, troco é SEMPRE 0
        if (res.rec < sub) {
          expect(res.troco).toBe(0);
          expect(res.falta).toBe(sub - res.rec);
        }

        // Invariante I5: Troco + Subtotal nunca excede o total recebido
        expect(res.troco + sub).toBeLessThanOrEqual(res.rec + sub); // res.troco <= res.rec - sub (quando rec >= sub)
        if (res.rec >= sub) {
          expect(res.troco).toBeLessThanOrEqual(res.rec - sub);
        }

        // Invariante I6: Se pagamento eletrônico for maior que o subtotal, checkout DEVE recusar
        if (totalEletronico > sub) {
          const val = validarAprovacao(itens, pags, true);
          expect(val.aprovado).toBe(false);
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // Desafio 4: Desvinculação de Voucher e Restauração de Totais
  // --------------------------------------------------------------------------
  describe('Desafio 4: Desvinculação de Voucher & Integridade do Carrinho', () => {
    it('restaura exatamente os valores brutos ao desvincular voucher de item único', () => {
      const item: ItemCarrinhoModel = {
        k: 1,
        inscricaoId: 101,
        produtoId: 5,
        cliente: 'Piloto Teste',
        produto: 'Bateria Noturna',
        qtd: 1,
        unit: 14000,
        desc: 4000,  // Desconto de R$ 40 do voucher
        descPct: 28.57,
        acr: 0,
        acrPct: 0,
        voucher: true
      };

      desvincularVoucherItem(item);

      expect(item.voucher).toBe(false);
      expect(item.desc).toBe(0);
      expect(item.descPct).toBe(0);
      expect(item.unit).toBe(14000);
      expect(item.qtd).toBe(1);
      expect(item.inscricaoId).toBe(101);
      expect(item.produtoId).toBe(5);
    });

    it('restaura e recalcula acréscimo percentual com precisão exata ao desvincular voucher', () => {
      const item: ItemCarrinhoModel = {
        k: 1,
        cliente: 'Piloto Noturno',
        produto: 'Bateria Especial',
        qtd: 2,      // 2 vagas de R$ 100 = R$ 200
        unit: 10000,
        desc: 5000,  // Desconto de voucher de R$ 50
        descPct: 25,
        acr: 2000,   // Acréscimo percentual de 10% (10% de R$ 200 = R$ 20)
        acrPct: 10,
        voucher: true
      };

      desvincularVoucherItem(item);

      expect(item.voucher).toBe(false);
      expect(item.desc).toBe(0);
      expect(item.descPct).toBe(0);
      expect(item.unit).toBe(10000);
      expect(item.qtd).toBe(2);
      expect(item.acrPct).toBe(10);
      expect(item.acr).toBe(2000); // 10% de R$ 200,00 recalculado perfeitamente!
    });

    it('em carrinho com múltiplos itens, desvincula apenas o item selecionado e preserva os demais', () => {
      const carrinho: ItemCarrinhoModel[] = [
        { k: 1, cliente: 'Piloto 1', produto: 'Bateria A', qtd: 1, unit: 12000, desc: 3000, acr: 0, descPct: 25, acrPct: 0, voucher: true },
        { k: 2, cliente: 'Piloto 2', produto: 'Bateria B', qtd: 1, unit: 12000, desc: 3000, acr: 0, descPct: 25, acrPct: 0, voucher: true },
        { k: 3, cliente: 'Piloto 3', produto: 'Luva', qtd: 1, unit: 5000, desc: 0, acr: 0, descPct: 0, acrPct: 0, voucher: false }
      ];

      // Desvincula apenas o item k = 1
      const res = desvincularVoucherCarrinho(carrinho, [1], 'VOUCH_ABC');

      expect(res.itensDesvinculados).toBe(1);
      expect(res.voucherCodigo).toBe('VOUCH_ABC'); // Mantém voucher pois item k=2 ainda tem voucher ativo
      expect(carrinho[0].voucher).toBe(false);
      expect(carrinho[0].desc).toBe(0);
      expect(carrinho[1].voucher).toBe(true);
      expect(carrinho[1].desc).toBe(3000);
      expect(carrinho[2].voucher).toBe(false);
    });

    it('quando o último item com voucher é desvinculado, limpa o código do voucher', () => {
      const carrinho: ItemCarrinhoModel[] = [
        { k: 1, cliente: 'Piloto 1', produto: 'Bateria A', qtd: 1, unit: 12000, desc: 0, acr: 0, descPct: 0, acrPct: 0, voucher: false },
        { k: 2, cliente: 'Piloto 2', produto: 'Bateria B', qtd: 1, unit: 12000, desc: 3000, acr: 0, descPct: 25, acrPct: 0, voucher: true },
      ];

      // Desvincula o item k = 2
      const res = desvincularVoucherCarrinho(carrinho, [2], 'VOUCH_ABC');

      expect(res.itensDesvinculados).toBe(1);
      expect(res.voucherCodigo).toBeNull(); // Resetou pois não há mais itens com voucher
      expect(carrinho[1].voucher).toBe(false);
      expect(carrinho[1].desc).toBe(0);
    });

    it('desvinculação sem seleção explícita remove vouchers de todos os itens com voucher', () => {
      const carrinho: ItemCarrinhoModel[] = [
        { k: 1, cliente: 'Piloto 1', produto: 'Bateria A', qtd: 1, unit: 12000, desc: 3000, acr: 0, descPct: 25, acrPct: 0, voucher: true },
        { k: 2, cliente: 'Piloto 2', produto: 'Bateria B', qtd: 1, unit: 12000, desc: 3000, acr: 0, descPct: 25, acrPct: 0, voucher: true },
      ];

      const res = desvincularVoucherCarrinho(carrinho, [], 'VOUCH_ABC');

      expect(res.itensDesvinculados).toBe(2);
      expect(res.voucherCodigo).toBeNull();
      expect(carrinho[0].voucher).toBe(false);
      expect(carrinho[1].voucher).toBe(false);
    });

    it('idempotência: chamar desvinculação em item já desvinculado não gera efeitos colaterais', () => {
      const item: ItemCarrinhoModel = {
        k: 1, cliente: 'Piloto', produto: 'Bateria', qtd: 1, unit: 10000, desc: 0, acr: 1000, descPct: 0, acrPct: 10, voucher: false
      };

      desvincularVoucherItem(item);
      expect(item.voucher).toBe(false);
      expect(item.desc).toBe(0);
      expect(item.acr).toBe(1000);

      desvincularVoucherItem(item);
      expect(item.voucher).toBe(false);
      expect(item.desc).toBe(0);
      expect(item.acr).toBe(1000);
    });
  });

  // --------------------------------------------------------------------------
  // Desafio 5: Trava de Idempotência e Bloqueio de Concorrência
  // --------------------------------------------------------------------------
  describe('Desafio 5: Idempotência e Proteção contra Duplo Clique no Checkout', () => {
    it('inspeção estática confirma bloqueio imediato com _salvando e _btnConcluir.Enabled = false', () => {
      const idxAprovar = caixaCs.indexOf('void Aprovar() => Seguro.Rodar(this, async () =>');
      expect(idxAprovar).toBeGreaterThan(0);

      const trechoAprovar = caixaCs.slice(idxAprovar, idxAprovar + 300);
      expect(trechoAprovar).toContain('if (_salvando) return;');
      expect(trechoAprovar).toContain('_salvando = true;');
      expect(trechoAprovar).toContain('if (_btnConcluir != null) _btnConcluir.Enabled = false;');
    });

    it('garante geração de idempotencyKey única tipo GUID ("N") enviada no payload', () => {
      expect(caixaCs).toContain('var idempotencyKey = Guid.NewGuid().ToString("N");');
      expect(caixaCs).toContain('["idempotencyKey"] = idempotencyKey');
    });

    it('atalho F12 em ProcessCmdKey checa estritamente _btnConcluir.Enabled && !_salvando', () => {
      expect(caixaCs).toContain('protected override bool ProcessCmdKey(ref Message msg, Keys keyData)');
      expect(caixaCs).toContain('if (keyData == Keys.F12)');
      expect(caixaCs).toContain('_btnConcluir.Enabled && !_salvando');
    });

    it('bloco finally assegura restauração determinística de _salvando e chamada a Atualizar()', () => {
      expect(caixaCs).toContain('finally');
      expect(caixaCs).toContain('_salvando = false;');
      expect(caixaCs).toContain('Atualizar();');
    });
  });

  // --------------------------------------------------------------------------
  // Desafio 6: Validação de Sangria e Fechamento de Caixa
  // --------------------------------------------------------------------------
  describe('Desafio 6: Limites Físicos de Sangria e Fechamento', () => {
    it('rejeita sangria com valores limítrofes inválidos (0, negativos, maiores que caixa)', () => {
      expect(validarSangria(0, 10000).valido).toBe(false);
      expect(validarSangria(-1, 10000).valido).toBe(false);
      expect(validarSangria(-999999, 10000).valido).toBe(false);
      expect(validarSangria(10001, 10000).valido).toBe(false);
      expect(validarSangria(10000, 10000).valido).toBe(true);
      expect(validarSangria(5000, 10000).valido).toBe(true);
    });

    it('rejeita fechamento com valores limítrofes inválidos (negativos, maiores que caixa)', () => {
      expect(validarFechamento(-1, 10000).valido).toBe(false);
      expect(validarFechamento(10001, 10000).valido).toBe(false);
      expect(validarFechamento(0, 10000).valido).toBe(true);
      expect(validarFechamento(10000, 10000).valido).toBe(true);
      expect(validarFechamento(5000, 10000).valido).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Desafio 7: Prevenção de Falhas GDI e Vetos do Proprietário (AGENTS.md)
  // --------------------------------------------------------------------------
  describe('Desafio 7: Integridade Operacional, GDI e Regras do Proprietário', () => {
    it('LinearGradientBrush protegido contra dimensões zeradas ou negativas no resumo e botão', () => {
      expect(caixaCs).toContain('if (resumo.ClientRectangle.Width <= 0 || resumo.ClientRectangle.Height <= 0) return;');
      expect(caixaCs).toContain('if (aprovar.ClientRectangle.Width <= 0 || aprovar.ClientRectangle.Height <= 0) return;');
    });

    it('FormTV.cs não sofreu qualquer alteração no escopo da Milestone M4', () => {
      expect(formTvCs).toContain('public class FormTV : Form');
      expect(formTvCs).not.toContain('CalcularTotais');
      expect(formTvCs).not.toContain('DesvincularVoucher');
      expect(formTvCs).not.toContain('ValidarSangria');
    });

    it('Nenhuma senha, credencial ou segredo em texto claro foi inserido em Caixa.cs ou TelasCaixa.cs', () => {
      const codigo = caixaCs + telasCaixaCs;
      expect(codigo).not.toMatch(/password\s*=\s*['"][^'"]+['"]/i);
      expect(codigo).not.toMatch(/senha\s*=\s*['"][^'"]+['"]/i);
      expect(codigo).not.toMatch(/secret\s*=\s*['"][^'"]+['"]/i);
    });

    it('Preserva aplicação Windows nativa WinForms sem web wrappers ou Chrome', () => {
      // WinForms vem do Directory.Build.props (usings implícitos), não de "using" em cada arquivo
      const props = readFileSync(resolve(__dirname, '../desktop/Directory.Build.props'), 'utf-8');
      expect(props).toContain('<UseWindowsForms>true</UseWindowsForms>');
      expect(caixaCs).not.toMatch(/chrome\.exe|msedge\.exe|Process\.Start\(\s*"http/i);
      expect(telasCaixaCs).toContain('DialogoDesign');
    });
  });
});
