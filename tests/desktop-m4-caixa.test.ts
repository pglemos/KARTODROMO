import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

const caixaCs = read('desktop/src/Kartodromo.Recepcao/Caixa.cs');
const telasCaixaCs = read('desktop/src/Kartodromo.Recepcao/TelasCaixa.cs');

// ============================================================================
// Oráculo TypeScript das Regras de Negócio de Caixa e Totais (Caixa.cs)
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

function desvincularVoucherItem(item: ItemCarrinhoModel): void {
  item.voucher = false;
  item.desc = 0;
  item.descPct = 0;
  if (item.acrPct > 0) {
    const baseV = item.unit * item.qtd;
    item.acr = Math.round((baseV * item.acrPct) / 100);
  }
}

// ============================================================================
// Oráculo TypeScript das Regras de Sangria e Fechamento (TelasCaixa.cs)
// ============================================================================

function validarSangria(valor: number, dinheiroEmCaixa: number): { valido: boolean; erro: string | null } {
  if (valor <= 0) {
    return { valido: false, erro: 'Informe um valor maior que zero.' };
  }
  if (valor > dinheiroEmCaixa) {
    return { valido: false, erro: 'Valor de sangria não pode ser superior ao dinheiro disponível em caixa.' };
  }
  return { valido: true, erro: null };
}

function validarFechamento(valor: number, dinheiroEmCaixa: number): { valido: boolean; erro: string | null } {
  if (valor < 0) {
    return { valido: false, erro: 'Valor para o próximo turno inválido.' };
  }
  if (valor > dinheiroEmCaixa) {
    return { valido: false, erro: 'O valor para o próximo turno não pode ser superior ao dinheiro disponível em caixa.' };
  }
  return { valido: true, erro: null };
}

describe('Milestone M4: Desktop Recepção — Caixa & PDV (Validação Rigorosa)', () => {
  // --------------------------------------------------------------------------
  // Item 10: Vulnerabilidade no Cálculo de Troco (Caixa.cs)
  // --------------------------------------------------------------------------
  describe('Item 10: Vulnerabilidade no Cálculo de Troco (Caixa.cs)', () => {
    it('declara método EsDinheiro e CalcularTotais estáticos com regras de proteção de troco', () => {
      expect(caixaCs).toContain('public static bool EsDinheiro(long forma, string? nome)');
      expect(caixaCs).toContain('public static (long tot, long des, long acr, long sub, long rec, long troco, long falta) CalcularTotais(');
      expect(caixaCs).toContain('forma == 1 || (nome != null && nome.IndexOf("dinheiro", StringComparison.OrdinalIgnoreCase) >= 0)');
    });

    it('restringe troco exclusivamente a pagamentos em dinheiro físico', () => {
      expect(caixaCs).toContain('var totalDinheiro = pagamentos.Where(p => EsDinheiro(p.forma, p.nome)).Sum(p => p.valor);');
      expect(caixaCs).toContain('var totalNaoDinheiro = pagamentos.Where(p => !EsDinheiro(p.forma, p.nome)).Sum(p => p.valor);');
      expect(caixaCs).toContain('var subtotalRestante = Math.Max(0, sub - totalNaoDinheiro);');
      expect(caixaCs).toContain('var excessoDinheiro = totalDinheiro - subtotalRestante;');
      expect(caixaCs).toContain('troco = Math.Min(excessoTotal, excessoDinheiro);');
    });

    it('retorna troco = 0 para pagamentos exclusivos em Cartão mesmo se o valor for superior ao subtotal', () => {
      const itens: ItemCarrinhoModel[] = [
        { k: 1, cliente: 'Piloto A', produto: 'Bateria Adulto', qtd: 1, unit: 12000, desc: 0, acr: 0, descPct: 0, acrPct: 0, voucher: false }
      ];
      // Pagamento em Cartão de Crédito de R$ 150,00 para subtotal de R$ 120,00
      const pagamentos: PagamentoModel[] = [
        { forma: 2, nome: 'Cartão de Crédito', valor: 15000 }
      ];

      const res = calcularTotais(itens, pagamentos);
      expect(res.sub).toBe(12000);
      expect(res.rec).toBe(15000);
      expect(res.falta).toBe(0);
      expect(res.troco).toBe(0); // TROCO DEVE SER ZERO
    });

    it('retorna troco = 0 para pagamentos exclusivos em Pix com valor excedente', () => {
      const itens: ItemCarrinhoModel[] = [
        { k: 1, cliente: 'Piloto B', produto: 'Bateria Cadete', qtd: 1, unit: 9000, desc: 0, acr: 0, descPct: 0, acrPct: 0, voucher: false }
      ];
      // Pagamento em Pix de R$ 100,00 para subtotal de R$ 90,00
      const pagamentos: PagamentoModel[] = [
        { forma: 3, nome: 'Pix QR', valor: 10000 }
      ];

      const res = calcularTotais(itens, pagamentos);
      expect(res.sub).toBe(9000);
      expect(res.rec).toBe(10000);
      expect(res.troco).toBe(0); // TROCO DEVE SER ZERO
    });

    it('calcula troco correto quando pagamento é em Dinheiro com valor a maior', () => {
      const itens: ItemCarrinhoModel[] = [
        { k: 1, cliente: 'Piloto C', produto: 'Bateria Super', qtd: 1, unit: 15000, desc: 0, acr: 0, descPct: 0, acrPct: 0, voucher: false }
      ];
      // Pagamento em Dinheiro de R$ 200,00 para subtotal de R$ 150,00
      const pagamentos: PagamentoModel[] = [
        { forma: 1, nome: 'Dinheiro', valor: 20000 }
      ];

      const res = calcularTotais(itens, pagamentos);
      expect(res.sub).toBe(15000);
      expect(res.rec).toBe(20000);
      expect(res.falta).toBe(0);
      expect(res.troco).toBe(5000); // R$ 50,00 de troco
    });

    it('em pagamento misto (Cartão + Dinheiro), troco é estritamente limitado ao excesso pago em dinheiro', () => {
      const itens: ItemCarrinhoModel[] = [
        { k: 1, cliente: 'Piloto D', produto: 'Bateria Adulto', qtd: 1, unit: 10000, desc: 0, acr: 0, descPct: 0, acrPct: 0, voucher: false }
      ];
      // Subtotal R$ 100,00. Pago R$ 60,00 no Cartão e R$ 50,00 em Dinheiro (Total R$ 110,00)
      const pagamentos: PagamentoModel[] = [
        { forma: 2, nome: 'Cartão de Débito', valor: 6000 },
        { forma: 1, nome: 'Dinheiro', valor: 5000 }
      ];

      const res = calcularTotais(itens, pagamentos);
      expect(res.sub).toBe(10000);
      expect(res.rec).toBe(11000);
      expect(res.troco).toBe(1000); // R$ 10,00 de troco (50 - (100 - 60) = 10)
    });

    it('em Aprovar(), bloqueia conclusão se valor em cartão for superior ao subtotal ou se troco exceder dinheiro', () => {
      expect(caixaCs).toContain('var totalNaoDinheiro = _pags.Where(p => !EsDinheiro(p.forma, p.nome)).Sum(p => p.valor);');
      expect(caixaCs).toContain('if (totalNaoDinheiro > t.sub)');
      expect(caixaCs).toContain('Não é permitido troco para pagamentos eletrônicos.');
      expect(caixaCs).toContain('if (t.troco > dinheiroRecebido)');
      expect(caixaCs).toContain('Não é permitido troco para pagamentos em cartão ou Pix.');
    });
  });

  // --------------------------------------------------------------------------
  // Item 11: Trava de Idempotência e Bloqueio de Duplo Clique no Checkout (Caixa.cs)
  // --------------------------------------------------------------------------
  describe('Item 11: Trava de Idempotência e Bloqueio de Duplo Clique no Checkout (Caixa.cs)', () => {
    it('desabilita imediatamente _btnConcluir.Enabled e ativa _salvando no início de Aprovar()', () => {
      // Confirma que a trava ocorre antes de qualquer validação ou requisição assíncrona
      const posAprovar = caixaCs.indexOf('void Aprovar() => Seguro.Rodar(this, async () =>');
      const posSalvandoCheck = caixaCs.indexOf('if (_salvando) return;', posAprovar);
      const posSalvandoSet = caixaCs.indexOf('_salvando = true;', posSalvandoCheck);
      const posBtnDisable = caixaCs.indexOf('if (_btnConcluir != null) _btnConcluir.Enabled = false;', posSalvandoSet);
      const posApiPost = caixaCs.indexOf('await Api.Post("/api/office/vendas"', posBtnDisable);

      expect(posAprovar).toBeGreaterThan(0);
      expect(posSalvandoCheck).toBeGreaterThan(posAprovar);
      expect(posSalvandoSet).toBeGreaterThan(posSalvandoCheck);
      expect(posBtnDisable).toBeGreaterThan(posSalvandoSet);
      expect(posApiPost).toBeGreaterThan(posBtnDisable);
    });

    it('gera e envia idempotencyKey única formatada ("N") por tentativa de checkout', () => {
      expect(caixaCs).toContain('var idempotencyKey = Guid.NewGuid().ToString("N");');
      expect(caixaCs).toContain('["idempotencyKey"] = idempotencyKey');
    });

    it('bloqueia checkout se houver valor pendente (t.falta > 0) e mantém _btnConcluir desabilitado', () => {
      expect(caixaCs).toContain('if (t.falta > 0)');
      expect(caixaCs).toContain('Msg.Aviso(this, $"Ainda faltam ser pagos {Fmt.Brl(t.falta)} para poder concluir a compra.");');
      expect(caixaCs).toContain('_btnConcluir.Enabled = !_salvando && pagamentoLiberado && t.falta <= 0;');
    });

    it('restaura estado e recalcula botão em bloco finally', () => {
      expect(caixaCs).toContain('finally');
      expect(caixaCs).toContain('_salvando = false;');
      expect(caixaCs).toContain('Atualizar();');
    });

    it('suporta atalho F12 verificando _btnConcluir.Enabled e !_salvando em ProcessCmdKey', () => {
      expect(caixaCs).toContain('protected override bool ProcessCmdKey(ref Message msg, Keys keyData)');
      expect(caixaCs).toContain('if (keyData == Keys.F12)');
      expect(caixaCs).toContain('_btnConcluir.Enabled && !_salvando');
    });
  });

  // --------------------------------------------------------------------------
  // Item 12: Validação de Saldo Físico em Sangria (TelasCaixa.cs)
  // --------------------------------------------------------------------------
  describe('Item 12: Validação de Saldo Físico em Sangria (TelasCaixa.cs)', () => {
    it('expõe método estático ValidarSangria com mensagem clara e validações de limite', () => {
      expect(telasCaixaCs).toContain('public static bool ValidarSangria(long valor, long dinheiroEmCaixa, out string? erro)');
      expect(telasCaixaCs).toContain('Valor de sangria não pode ser superior ao dinheiro disponível em caixa.');
    });

    it('rejeita sangrias com valor zero ou negativo', () => {
      const r0 = validarSangria(0, 50000);
      expect(r0.valido).toBe(false);
      expect(r0.erro).toBe('Informe um valor maior que zero.');

      const rNeg = validarSangria(-1000, 50000);
      expect(rNeg.valido).toBe(false);
      expect(rNeg.erro).toBe('Informe um valor maior que zero.');
    });

    it('rejeita sangria que exceda o dinheiro disponível na gaveta física', () => {
      const emCaixa = 35000; // R$ 350,00 em caixa
      const pedido = 40000;  // Solicita sangria de R$ 400,00

      const res = validarSangria(pedido, emCaixa);
      expect(res.valido).toBe(false);
      expect(res.erro).toBe('Valor de sangria não pode ser superior ao dinheiro disponível em caixa.');
    });

    it('aprova sangria quando o valor é menor ou igual ao saldo em caixa', () => {
      const emCaixa = 50000; // R$ 500,00
      const pedidoParcial = 20000; // R$ 200,00
      const pedidoTotal = 50000;   // R$ 500,00

      const rParcial = validarSangria(pedidoParcial, emCaixa);
      expect(rParcial.valido).toBe(true);
      expect(rParcial.erro).toBeNull();

      const rTotal = validarSangria(pedidoTotal, emCaixa);
      expect(rTotal.valido).toBe(true);
      expect(rTotal.erro).toBeNull();
    });

    it('aplica foco no campo de valor (_valor.Focus()) em caso de sangria superior ao saldo', () => {
      expect(telasCaixaCs).toContain('if (_tipo == "sangria" && !ValidarSangria(valor, emCaixa, out var erroSangria))');
      expect(telasCaixaCs).toContain('Msg.Aviso(this, erroSangria);');
      expect(telasCaixaCs).toContain('_valor.Focus();');
      expect(telasCaixaCs).toContain('return;');
    });
  });

  // --------------------------------------------------------------------------
  // Item 13: Consistência no Fechamento de Caixa (TelasCaixa.cs)
  // --------------------------------------------------------------------------
  describe('Item 13: Consistência no Fechamento de Caixa (TelasCaixa.cs)', () => {
    it('expõe método estático ValidarFechamento com validação de limites físicos', () => {
      expect(telasCaixaCs).toContain('public static bool ValidarFechamento(long valor, long dinheiroEmCaixa, out string? erro)');
      expect(telasCaixaCs).toContain('O valor para o próximo turno não pode ser superior ao dinheiro disponível em caixa.');
      expect(telasCaixaCs).toContain('Valor para o próximo turno inválido.');
    });

    it('rejeita valor negativo para o próximo turno', () => {
      const res = validarFechamento(-500, 30000);
      expect(res.valido).toBe(false);
      expect(res.erro).toBe('Valor para o próximo turno inválido.');
    });

    it('rejeita valor de próximo turno que exceda o dinheiro disponível na gaveta', () => {
      const emCaixa = 20000; // R$ 200,00 em caixa
      const proximo = 25000; // Informa R$ 250,00 para próximo turno

      const res = validarFechamento(proximo, emCaixa);
      expect(res.valido).toBe(false);
      expect(res.erro).toBe('O valor para o próximo turno não pode ser superior ao dinheiro disponível em caixa.');
    });

    it('aprova fechamento quando valor do próximo turno está entre 0 e dinheiroEmCaixa', () => {
      const emCaixa = 30000; // R$ 300,00 em caixa

      const rZero = validarFechamento(0, emCaixa);
      expect(rZero.valido).toBe(true);
      expect(rZero.erro).toBeNull();

      const rMedio = validarFechamento(15000, emCaixa);
      expect(rMedio.valido).toBe(true);
      expect(rMedio.erro).toBeNull();

      const rExato = validarFechamento(30000, emCaixa);
      expect(rExato.valido).toBe(true);
      expect(rExato.erro).toBeNull();
    });

    it('aplica foco no campo _proximo.Focus() ao falhar a validação no fechamento', () => {
      expect(telasCaixaCs).toContain('if (!ValidarFechamento(valor, emCaixa, out var erroFechamento))');
      expect(telasCaixaCs).toContain('Msg.Aviso(this, erroFechamento);');
      expect(telasCaixaCs).toContain('_proximo.Focus();');
    });
  });

  // --------------------------------------------------------------------------
  // Item 14: Desvinculação Limpa de Vouchers no PDV (Caixa.cs)
  // --------------------------------------------------------------------------
  describe('Item 14: Desvinculação Limpa de Vouchers no PDV (Caixa.cs)', () => {
    it('adiciona botão de Desvincular voucher na barra do carrinho', () => {
      expect(caixaCs).toContain('barraCarrinho.Controls.Add(Acao("Desvincular voucher", DesvincularVoucher, 130));');
    });

    it('implementa DesvincularVoucher e DesvincularVoucherItem preservando os itens no carrinho', () => {
      expect(caixaCs).toContain('public void DesvincularVoucher()');
      expect(caixaCs).toContain('public static void DesvincularVoucherItem(ItemCarrinho item)');
      expect(caixaCs).toContain('item.Voucher = false;');
      expect(caixaCs).toContain('item.Desc = 0;');
      expect(caixaCs).toContain('item.DescPct = 0;');
    });

    it('restaura o valor original do item e recalcula acréscimo percentual adequadamente', () => {
      const item: ItemCarrinhoModel = {
        k: 1,
        cliente: 'Piloto Teste',
        produto: 'Bateria Noturna',
        qtd: 2,
        unit: 10000, // 2 x 100 = 200
        desc: 5000,  // Desconto de R$ 50 do voucher
        descPct: 25,
        acr: 2000,   // Acréscimo de 10% (R$ 20)
        acrPct: 10,
        voucher: true
      };

      desvincularVoucherItem(item);

      expect(item.voucher).toBe(false);
      expect(item.desc).toBe(0);
      expect(item.descPct).toBe(0);
      expect(item.unit).toBe(10000);
      expect(item.qtd).toBe(2);
      expect(item.acr).toBe(2000); // 10% de R$ 200 = R$ 20 (2000 centavos)
    });

    it('limpa _voucher e campo de código quando todos os itens com voucher forem desvinculados', () => {
      expect(caixaCs).toContain('if (!_car.Any(c => c.Voucher))');
      expect(caixaCs).toContain('_voucher = null;');
      expect(caixaCs).toContain('_codVoucher.Text = "";');
    });

    it('exibe mensagem informativa confirmando que o item foi mantido com valor original', () => {
      expect(caixaCs).toContain('Voucher desvinculado com sucesso. O item foi mantido no carrinho com seu valor original.');
      expect(caixaCs).toContain('Voucher removido da venda. Os itens foram mantidos no carrinho com seu valor original.');
    });
  });

  // --------------------------------------------------------------------------
  // Item 36: Prevenção de Exceção em LinearGradientBrush (Caixa.cs)
  // --------------------------------------------------------------------------
  describe('Item 36: Prevenção de Exceção em LinearGradientBrush (Caixa.cs)', () => {
    it('verifica dimensões válidas (> 0) no painel de resumo antes de instanciar LinearGradientBrush', () => {
      expect(caixaCs).toContain('if (resumo.ClientRectangle.Width <= 0 || resumo.ClientRectangle.Height <= 0) return;');
      const posGuard = caixaCs.indexOf('if (resumo.ClientRectangle.Width <= 0 || resumo.ClientRectangle.Height <= 0) return;');
      const posBrush = caixaCs.indexOf('new LinearGradientBrush(resumo.ClientRectangle', posGuard);
      expect(posGuard).toBeGreaterThan(0);
      expect(posBrush).toBeGreaterThan(posGuard);
    });

    it('verifica dimensões válidas (> 0) no botão aprovar antes de instanciar LinearGradientBrush', () => {
      expect(caixaCs).toContain('if (aprovar.ClientRectangle.Width <= 0 || aprovar.ClientRectangle.Height <= 0) return;');
      const posGuard = caixaCs.indexOf('if (aprovar.ClientRectangle.Width <= 0 || aprovar.ClientRectangle.Height <= 0) return;');
      const posBrush = caixaCs.indexOf('new LinearGradientBrush(aprovar.ClientRectangle', posGuard);
      expect(posGuard).toBeGreaterThan(0);
      expect(posBrush).toBeGreaterThan(posGuard);
    });
  });
});
