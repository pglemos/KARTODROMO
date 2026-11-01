import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { erroCadastroObrigatorio, erroPesoCliente } from '../lib/ops/cadastro-obrigatorio';
import { erroInstagramCliente, normalizarInstagram as normalizarInstagramTs } from '../lib/ops/instagram';

const root = resolve(import.meta.dirname, '..');
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

const uiCs = read('desktop/src/Kartodromo.Comum/Ui.cs');
const validacaoClienteCs = read('desktop/src/Kartodromo.Comum/ValidacaoCliente.cs');

// ============================================================================
// Oráculo C# de Formatação (Fmt.cs)
// ============================================================================
function digitos(s: string | null | undefined): string {
  return (s ?? '').replace(/\D/g, '');
}

function mascaraCpf(v: string): string {
  let d = digitos(v);
  if (d.length > 11) d = d.slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function mascaraFone(v: string): string {
  let d = digitos(v);
  if (d.length > 11) d = d.slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function mascaraCep(v: string): string {
  let d = digitos(v);
  if (d.length > 8) d = d.slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

// ============================================================================
// Oráculo C# de CalcularCursorMascara (Ui.cs)
// ============================================================================
const minSafe = (a: number, b: number) => Math.min(a, b);

function calcularCursorMascara(
  antigoTexto: string | null | undefined,
  novoTextoFormatado: string | null | undefined,
  posicaoAntiga: number
): number {
  const antigo = antigoTexto ?? '';
  const novo = novoTextoFormatado ?? '';
  if (posicaoAntiga >= antigo.length) return novo.length;
  if (posicaoAntiga <= 0) return 0;

  let rawAntes = 0;
  for (let i = 0; i < Math.min(posicaoAntiga, antigo.length); i++) {
    if (/[a-zA-Z0-9]/.test(antigo[i])) rawAntes++;
  }

  let novoPos = 0;
  let rawCont = 0;
  while (novoPos < novo.length && rawCont < rawAntes) {
    if (/[a-zA-Z0-9]/.test(novo[novoPos])) rawCont++;
    novoPos++;
  }

  return minSafe(novoPos > 0 ? novoPos : posicaoAntiga, novo.length);
}

// ============================================================================
// Simulador de TextBox WinForms com Ui.Campos.Mascara
// ============================================================================
class SimuladorTextBoxMascara {
  text: string = '';
  selectionStart: number = 0;
  maskFn: (v: string) => string;

  constructor(maskFn: (v: string) => string) {
    this.maskFn = maskFn;
  }

  /**
   * Simula a digitação de uma tecla de caractere na posição atual do cursor.
   */
  digitar(char: string): void {
    const textoAntes = this.text;
    const pos = this.selectionStart;
    const textoComDigito = textoAntes.slice(0, pos) + char + textoAntes.slice(pos);
    const posComDigito = pos + char.length;

    const textoNovo = this.maskFn(textoComDigito);
    if (textoNovo !== textoComDigito) {
      const novaPos = calcularCursorMascara(textoComDigito, textoNovo, posComDigito);
      this.text = textoNovo;
      this.selectionStart = novaPos;
    } else {
      this.text = textoComDigito;
      this.selectionStart = posComDigito;
    }
  }

  /**
   * Simula o pressionamento da tecla Backspace na posição atual do cursor.
   */
  backspace(): void {
    if (this.selectionStart <= 0) return;
    const textoAntes = this.text;
    const pos = this.selectionStart;
    const textoAposApagar = textoAntes.slice(0, pos - 1) + textoAntes.slice(pos);
    const posAposApagar = pos - 1;

    const textoNovo = this.maskFn(textoAposApagar);
    if (textoNovo !== textoAposApagar) {
      const novaPos = calcularCursorMascara(textoAposApagar, textoNovo, posAposApagar);
      this.text = textoNovo;
      this.selectionStart = novaPos;
    } else {
      this.text = textoAposApagar;
      this.selectionStart = posAposApagar;
    }
  }

  /**
   * Simula a colagem de texto na posição atual do cursor.
   */
  colar(conteudo: string): void {
    const textoAntes = this.text;
    const pos = this.selectionStart;
    const textoComColagem = textoAntes.slice(0, pos) + conteudo + textoAntes.slice(pos);
    const posComColagem = pos + conteudo.length;

    const textoNovo = this.maskFn(textoComColagem);
    if (textoNovo !== textoComColagem) {
      const novaPos = calcularCursorMascara(textoComColagem, textoNovo, posComColagem);
      this.text = textoNovo;
      this.selectionStart = novaPos;
    } else {
      this.text = textoComColagem;
      this.selectionStart = posComColagem;
    }
  }

  /**
   * Move o cursor para um índice específico.
   */
  moverCursor(novoIndice: number): void {
    this.selectionStart = Math.max(0, Math.min(novoIndice, this.text.length));
  }
}

// ============================================================================
// Oráculo C# de Validação de Cliente (ValidacaoCliente.cs)
// ============================================================================
function normalizarInstagramCs(instagram: string | null | undefined): string {
  let usuario = (instagram ?? '').trim();
  const perfil = usuario.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)\/?(?:[?#].*)?$/i);
  if (perfil) usuario = perfil[1];
  if (usuario.startsWith('@')) usuario = usuario.slice(1);
  return usuario.length === 0 ? '' : '@' + usuario.toLowerCase();
}

function erroInstagramCs(instagram: string | null | undefined): string | null {
  if (!instagram || !instagram.trim()) return null; // opcional
  const perfil = normalizarInstagramCs(instagram);
  return /^@[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?$/.test(perfil) && !perfil.includes('..')
    ? null
    : 'Instagram inválido. Informe o @usuário do piloto (ex.: @andre.silva).';
}

function erroPesoCs(peso: string | null | undefined): string | null {
  const p = (peso ?? '').trim();
  if (p.length === 0) return 'O peso é obrigatório. Informe o peso em kg.';
  const valorTexto = p.replace(',', '.');
  const kg = Number(valorTexto);
  return !Number.isNaN(kg) && Number.isFinite(kg) && kg >= 10 && kg <= 250
    ? null
    : 'Peso inválido. Informe um valor entre 10 e 250 kg.';
}

// ============================================================================
// SUÍTE DE TESTES ADVERSARIAIS M3
// ============================================================================
describe('Desafio Adversarial M3 — Cursor Jumping e Validações de Cadastro', () => {
  // --------------------------------------------------------------------------
  // PARTE 1: Algoritmo de Cursor Jumping (CalcularCursorMascara)
  // --------------------------------------------------------------------------
  describe('1. Algoritmo de Cursor Jumping (CalcularCursorMascara)', () => {
    it('Fonte C# em Ui.cs contém a implementação oficial e assinatura de CalcularCursorMascara', () => {
      expect(uiCs).toContain('public static int CalcularCursorMascara(string antigoTexto, string novoTextoFormatado, int posicaoAntiga)');
      expect(uiCs).toContain('if (posicaoAntiga >= antigoTexto.Length) return novoTextoFormatado.Length;');
      expect(uiCs).toContain('if (posicaoAntiga <= 0) return 0;');
      expect(uiCs).toContain('char.IsLetterOrDigit');
      expect(uiCs).toContain('return Math.Min(novoPos > 0 ? novoPos : posicaoAntiga, novoTextoFormatado.Length);');
    });

    it('Fonte C# em Ui.cs aplica CalcularCursorMascara no evento TextChanged de Mascara', () => {
      expect(uiCs).toContain('var pos = t.SelectionStart;');
      expect(uiCs).toContain('var textoAntes = t.Text ?? "";');
      expect(uiCs).toContain('var textoNovo = fn(textoAntes) ?? "";');
      expect(uiCs).toContain('var novaPos = CalcularCursorMascara(textoAntes, textoNovo, pos);');
      expect(uiCs).toContain('t.Text = textoNovo;');
      expect(uiCs).toContain('t.SelectionStart = novaPos;');
    });

    describe('Simulação de Digitação Contínua: CPF', () => {
      it('digitação sequencial de 11 dígitos do CPF mantém o cursor sempre no final sem resetar para 0', () => {
        const tb = new SimuladorTextBoxMascara(mascaraCpf);
        const cpfDigitos = '12345678901';

        for (let i = 0; i < cpfDigitos.length; i++) {
          const d = cpfDigitos[i];
          tb.digitar(d);

          // Invariante essencial: o cursor nunca pode ser 0 após digitar um dígito!
          expect(tb.selectionStart).toBeGreaterThan(0);
          expect(tb.selectionStart).toBe(tb.text.length);
        }

        expect(tb.text).toBe('123.456.789-01');
        expect(tb.selectionStart).toBe(14);
      });

      it('digitação no início de um CPF existente nunca joga o cursor para 0', () => {
        const tb = new SimuladorTextBoxMascara(mascaraCpf);
        tb.colar('2345678901'); // 10 dígitos -> "234.567.890-1"
        expect(tb.text).toBe('234.567.890-1');

        // Usuário posiciona o cursor no início (índice 0) e digita '1'
        tb.moverCursor(0);
        expect(tb.selectionStart).toBe(0);

        tb.digitar('1');
        // O cursor deve avançar para após o primeiro dígito '1' (índice 1), NUNCA 0!
        expect(tb.selectionStart).toBe(1);
        expect(tb.text).toBe('123.456.789-01');
      });

      it('digitação no meio de um CPF formatado nunca joga o cursor para 0 e preserva posição após o dígito', () => {
        const tb = new SimuladorTextBoxMascara(mascaraCpf);
        tb.colar('1234567890'); // 10 dígitos -> "123.456.789-0"
        expect(tb.text).toBe('123.456.789-0');

        // Testar inserção em todos os pontos possíveis do meio (entre o 1º e o 10º caractere)
        for (let p = 1; p < tb.text.length; p++) {
          const tbTeste = new SimuladorTextBoxMascara(mascaraCpf);
          tbTeste.colar('123456789'); // 9 dígitos: "123.456.789"
          tbTeste.moverCursor(p);
          tbTeste.digitar('0');

          // O cursor NÃO pode ser 0!
          expect(tbTeste.selectionStart).toBeGreaterThan(0);
          expect(tbTeste.selectionStart).toBeLessThanOrEqual(tbTeste.text.length);
        }
      });
    });

    describe('Simulação de Digitação Contínua: Telefone com DDD', () => {
      it('digitação sequencial de celular 11 dígitos com DDD mantém cursor no final e nunca 0', () => {
        const tb = new SimuladorTextBoxMascara(mascaraFone);
        const fone = '31987654321';

        for (let i = 0; i < fone.length; i++) {
          tb.digitar(fone[i]);
          expect(tb.selectionStart).toBeGreaterThan(0);
          expect(tb.selectionStart).toBe(tb.text.length);
        }

        expect(tb.text).toBe('(31) 98765-4321');
        expect(tb.selectionStart).toBe(15);
      });

      it('digitação no início de um telefone (antes do parêntese) nunca joga o cursor para 0', () => {
        const tb = new SimuladorTextBoxMascara(mascaraFone);
        tb.colar('1987654321'); // falta o primeiro dígito do DDD
        expect(tb.text).toBe('(19) 8765-4321');

        // Cursor antes do '(' (índice 0)
        tb.moverCursor(0);
        tb.digitar('3');

        // Como o telefone formata com '(', o '3' fica em index 1 e o cursor deve ficar em index 2 (após '3')
        expect(tb.selectionStart).toBe(2);
        expect(tb.selectionStart).toBeGreaterThan(0);
      });

      it('digitação entre o DDD e o número do telefone mantém o cursor na posição correta e nunca 0', () => {
        const tb = new SimuladorTextBoxMascara(mascaraFone);
        tb.colar('3187654321'); // 10 dígitos (fixo): "(31) 8765-4321"
        expect(tb.text).toBe('(31) 8765-4321');

        // Mover cursor para após o espaço: "(31) " -> índice 5
        tb.moverCursor(5);
        tb.digitar('9'); // adiciona o 9 do celular

        expect(tb.selectionStart).toBe(6); // após o '9'
        expect(tb.text).toBe('(31) 98765-4321');
        expect(tb.selectionStart).toBeGreaterThan(0);
      });
    });

    describe('Simulação de Digitação Contínua: CEP', () => {
      it('digitação sequencial de 8 dígitos do CEP mantém cursor no final e nunca 0', () => {
        const tb = new SimuladorTextBoxMascara(mascaraCep);
        const cep = '32600000';

        for (let i = 0; i < cep.length; i++) {
          tb.digitar(cep[i]);
          expect(tb.selectionStart).toBeGreaterThan(0);
          expect(tb.selectionStart).toBe(tb.text.length);
        }

        expect(tb.text).toBe('32600-000');
        expect(tb.selectionStart).toBe(9);
      });

      it('digitação no início de um CEP existente nunca joga o cursor para 0', () => {
        const tb = new SimuladorTextBoxMascara(mascaraCep);
        tb.colar('2600000'); // 7 dígitos: "26000-00"
        tb.moverCursor(0);
        tb.digitar('3');

        expect(tb.selectionStart).toBe(1);
        expect(tb.selectionStart).toBeGreaterThan(0);
        expect(tb.text).toBe('32600-000');
      });

      it('digitação no meio de um CEP (ao redor do hífen) mantém o cursor estável e nunca 0', () => {
        const tb = new SimuladorTextBoxMascara(mascaraCep);
        tb.colar('3260000'); // 7 dígitos: "32600-00"
        // Cursor no índice 5 (antes do hífen)
        tb.moverCursor(5);
        tb.digitar('1');

        // No texto original "32600-00", o hífen estava no índice 5.
        // Ao digitar '1', o texto vira "32600-100".
        // Os primeiros 5 dígitos ocupam 0..4, o hífen ocupa 5, o dígito '1' inserido fica no índice 6,
        // logo o cursor fica no índice 7 (imediatamente após o '1' digitado).
        expect(tb.selectionStart).toBe(7);
        expect(tb.selectionStart).toBeGreaterThan(0);
      });
    });

    describe('Estresse Adversarial e Fuzzing de Operações de Edição', () => {
      it('Fuzzing com 300 operações aleatórias: invariante de cursor válido e sem reset indevido para 0', () => {
        const mascaras = [
          { nome: 'CPF', fn: mascaraCpf },
          { nome: 'Fone', fn: mascaraFone },
          { nome: 'CEP', fn: mascaraCep },
        ];

        for (const m of mascaras) {
          const tb = new SimuladorTextBoxMascara(m.fn);

          for (let op = 0; op < 100; op++) {
            const acao = Math.floor(Math.random() * 4);

            if (acao === 0 || tb.text.length === 0) {
              // Digitar dígito aleatório
              const digito = String(Math.floor(Math.random() * 10));
              tb.digitar(digito);
            } else if (acao === 1) {
              // Mover cursor para posição aleatória
              const novoIndice = Math.floor(Math.random() * (tb.text.length + 1));
              tb.moverCursor(novoIndice);
            } else if (acao === 2) {
              // Backspace
              tb.backspace();
            } else {
              // Digitar no meio
              const meio = Math.floor(tb.text.length / 2);
              tb.moverCursor(meio);
              tb.digitar('7');
            }

            // Invariante 1: O cursor nunca deve ultrapassar o tamanho do texto
            expect(tb.selectionStart).toBeGreaterThanOrEqual(0);
            expect(tb.selectionStart).toBeLessThanOrEqual(tb.text.length);

            // Invariante 2: Se o texto contém dígitos e o cursor não estava em 0 antes de digitar,
            // o cursor NÃO PODE ser 0!
            if (tb.text.length > 0 && /\d/.test(tb.text) && acao === 0) {
              expect(tb.selectionStart).toBeGreaterThan(0);
            }
          }
        }
      });

      it('Casos Limítrofes (Edge Cases): nulo, vazio, índices negativos e além do comprimento', () => {
        expect(calcularCursorMascara(null, null, 0)).toBe(0);
        expect(calcularCursorMascara('', '', 0)).toBe(0);
        expect(calcularCursorMascara('', '123', -10)).toBe(0);
        expect(calcularCursorMascara('123', '123', -1)).toBe(0);
        expect(calcularCursorMascara('123', '12345', 1000)).toBe(5);
        expect(calcularCursorMascara('123', '', 2)).toBe(0);
        expect(calcularCursorMascara('...', '...', 2)).toBe(2);
      });
    });
  });

  // --------------------------------------------------------------------------
  // PARTE 2: Validação de Peso (ValidacaoCliente.ErroPeso & erroPesoCliente)
  // --------------------------------------------------------------------------
  describe('2. Validação de Peso (ValidacaoCliente.ErroPeso & erroPesoCliente)', () => {
    it('Código-fonte C# em ValidacaoCliente.cs implementa a faixa exata [10, 250] kg', () => {
      expect(validacaoClienteCs).toContain('double.TryParse(peso.Replace(\',\', \'.\'), NumberStyles.Float, CultureInfo.InvariantCulture, out var kg)');
      expect(validacaoClienteCs).toContain('double.IsFinite(kg) && kg >= 10 && kg <= 250');
      expect(validacaoClienteCs).toContain('Peso inválido. Informe um valor entre 10 e 250 kg.');
    });

    describe('Testes de Borda Estrita (9, 10, 250, 251 kg)', () => {
      it('Borda inferior: 9 kg é REJEITADO tanto em C# quanto em TS', () => {
        expect(erroPesoCs('9')).toBe('Peso inválido. Informe um valor entre 10 e 250 kg.');
        expect(erroPesoCliente('9')).toBe('Peso inválido. Informe um valor entre 10 e 250 kg.');
        expect(erroPesoCs('9.9')).toBe('Peso inválido. Informe um valor entre 10 e 250 kg.');
        expect(erroPesoCliente('9.9')).toBe('Peso inválido. Informe um valor entre 10 e 250 kg.');
        expect(erroPesoCs('9,999')).toBe('Peso inválido. Informe um valor entre 10 e 250 kg.');
        expect(erroPesoCliente('9,999')).toBe('Peso inválido. Informe um valor entre 10 e 250 kg.');
      });

      it('Borda inferior: 10 kg é ACEITO (retorna null) tanto em C# quanto em TS', () => {
        expect(erroPesoCs('10')).toBeNull();
        expect(erroPesoCliente('10')).toBeNull();
        expect(erroPesoCs('10.0')).toBeNull();
        expect(erroPesoCliente('10.0')).toBeNull();
        expect(erroPesoCs('10,0')).toBeNull();
        expect(erroPesoCliente('10,0')).toBeNull();
        expect(erroPesoCs('10.001')).toBeNull();
        expect(erroPesoCliente('10.001')).toBeNull();
      });

      it('Valores típicos intermediários são ACEITOS', () => {
        expect(erroPesoCs('50')).toBeNull();
        expect(erroPesoCliente('50')).toBeNull();
        expect(erroPesoCs('75.5')).toBeNull();
        expect(erroPesoCliente('75.5')).toBeNull();
        expect(erroPesoCs('82,3')).toBeNull();
        expect(erroPesoCliente('82,3')).toBeNull();
        expect(erroPesoCs('120')).toBeNull();
        expect(erroPesoCliente('120')).toBeNull();
      });

      it('Borda superior: 250 kg é ACEITO (retorna null) tanto em C# quanto em TS', () => {
        expect(erroPesoCs('250')).toBeNull();
        expect(erroPesoCliente('250')).toBeNull();
        expect(erroPesoCs('250.0')).toBeNull();
        expect(erroPesoCliente('250.0')).toBeNull();
        expect(erroPesoCs('250,0')).toBeNull();
        expect(erroPesoCliente('250,0')).toBeNull();
        expect(erroPesoCs('249.99')).toBeNull();
        expect(erroPesoCliente('249.99')).toBeNull();
      });

      it('Borda superior: 251 kg é REJEITADO tanto em C# quanto em TS', () => {
        expect(erroPesoCs('251')).toBe('Peso inválido. Informe um valor entre 10 e 250 kg.');
        expect(erroPesoCliente('251')).toBe('Peso inválido. Informe um valor entre 10 e 250 kg.');
        expect(erroPesoCs('250.01')).toBe('Peso inválido. Informe um valor entre 10 e 250 kg.');
        expect(erroPesoCliente('250.01')).toBe('Peso inválido. Informe um valor entre 10 e 250 kg.');
        expect(erroPesoCs('250,1')).toBe('Peso inválido. Informe um valor entre 10 e 250 kg.');
        expect(erroPesoCliente('250,1')).toBe('Peso inválido. Informe um valor entre 10 e 250 kg.');
        expect(erroPesoCs('300')).toBe('Peso inválido. Informe um valor entre 10 e 250 kg.');
        expect(erroPesoCliente('300')).toBe('Peso inválido. Informe um valor entre 10 e 250 kg.');
      });
    });

    describe('Entradas Não Numéricas, Nulas, Negativas e Especiais', () => {
      it('rejeita valores nulos, vazios ou apenas com espaços exigindo peso obrigatório', () => {
        const msgObrigatorio = 'O peso é obrigatório. Informe o peso em kg.';
        expect(erroPesoCs(null)).toBe(msgObrigatorio);
        expect(erroPesoCliente(null)).toBe(msgObrigatorio);
        expect(erroPesoCs('')).toBe(msgObrigatorio);
        expect(erroPesoCliente('')).toBe(msgObrigatorio);
        expect(erroPesoCs('   ')).toBe(msgObrigatorio);
        expect(erroPesoCliente('   ')).toBe(msgObrigatorio);
        expect(erroPesoCs('\t\n')).toBe(msgObrigatorio);
        expect(erroPesoCliente('\t\n')).toBe(msgObrigatorio);
      });

      it('rejeita formatos textuais não numéricos ou com unidades no campo', () => {
        const msgInvalido = 'Peso inválido. Informe um valor entre 10 e 250 kg.';
        expect(erroPesoCs('abc')).toBe(msgInvalido);
        expect(erroPesoCliente('abc')).toBe(msgInvalido);
        expect(erroPesoCs('10kg')).toBe(msgInvalido);
        expect(erroPesoCliente('10kg')).toBe(msgInvalido);
        expect(erroPesoCs('70 kg')).toBe(msgInvalido);
        expect(erroPesoCliente('70 kg')).toBe(msgInvalido);
        expect(erroPesoCs('oitenta')).toBe(msgInvalido);
        expect(erroPesoCliente('oitenta')).toBe(msgInvalido);
      });

      it('rejeita valores especiais como NaN, Infinity e números negativos', () => {
        const msgInvalido = 'Peso inválido. Informe um valor entre 10 e 250 kg.';
        expect(erroPesoCs('NaN')).toBe(msgInvalido);
        expect(erroPesoCliente('NaN')).toBe(msgInvalido);
        expect(erroPesoCs('Infinity')).toBe(msgInvalido);
        expect(erroPesoCliente('Infinity')).toBe(msgInvalido);
        expect(erroPesoCs('-Infinity')).toBe(msgInvalido);
        expect(erroPesoCliente('-Infinity')).toBe(msgInvalido);
        expect(erroPesoCs('-10')).toBe(msgInvalido);
        expect(erroPesoCliente('-10')).toBe(msgInvalido);
        expect(erroPesoCs('0')).toBe(msgInvalido);
        expect(erroPesoCliente('0')).toBe(msgInvalido);
        expect(erroPesoCs('-0.01')).toBe(msgInvalido);
        expect(erroPesoCliente('-0.01')).toBe(msgInvalido);
      });

      it('paridade total entre C# e TypeScript para uma matriz de 30 valores adversariais', () => {
        const casos = [
          '', ' ', null, undefined, 'abc', 'dez', '0', '-5', '9.99', '10', '10.0', '10,0',
          '15', '45.2', '78,9', '100', '150', '200', '249.99', '250', '250.0', '250,0',
          '250.01', '251', '350', '1000', 'NaN', 'Infinity', '-Infinity', '10kg'
        ];

        for (const c of casos) {
          const resCs = erroPesoCs(c as string);
          const resTs = erroPesoCliente(c);
          expect(resCs).toBe(resTs);
        }
      });
    });
  });

  // --------------------------------------------------------------------------
  // PARTE 3: Flexibilização de Instagram (ValidacaoCliente.ErroInstagram)
  // --------------------------------------------------------------------------
  describe('3. Flexibilização de Instagram (ValidacaoCliente.ErroInstagram & erroInstagramCliente)', () => {
    it('Código-fonte C# em ValidacaoCliente.cs torna o campo Instagram opcional', () => {
      expect(validacaoClienteCs).toContain('if (string.IsNullOrWhiteSpace(instagram)) return null; // Instagram é opcional');
      expect(validacaoClienteCs).toContain('public static string NormalizarInstagram(string instagram)');
      expect(validacaoClienteCs).toContain('public static string ErroInstagram(string instagram)');
    });

    describe('Campo Opcional: nulo, vazio, espaços em branco', () => {
      it('retorna null (válido) para qualquer valor vazio, nulo ou em branco', () => {
        expect(erroInstagramCs(null)).toBeNull();
        expect(erroInstagramCliente(null)).toBeNull();
        expect(erroInstagramCs('')).toBeNull();
        expect(erroInstagramCliente('')).toBeNull();
        expect(erroInstagramCs('   ')).toBeNull();
        expect(erroInstagramCliente('   ')).toBeNull();
        expect(erroInstagramCs('\t\r\n')).toBeNull();
        expect(erroInstagramCliente('\t\r\n')).toBeNull();
        expect(erroInstagramCs(undefined)).toBeNull();
        expect(erroInstagramCliente(undefined)).toBeNull();
      });
    });

    describe('Formatos Válidos com Arroba (@)', () => {
      it('aceita perfis com arroba e normaliza corretamente', () => {
        const validos = ['@andre.silva', '@piloto_123', '@ayrtonsenna', '@a', '@user.name_1'];
        for (const v of validos) {
          expect(erroInstagramCs(v)).toBeNull();
          expect(erroInstagramCliente(v)).toBeNull();
        }
      });

      it('aceita nomes de usuário com até 30 caracteres válidos', () => {
        const user30 = '@' + 'a'.repeat(30);
        expect(erroInstagramCs(user30)).toBeNull();
        expect(erroInstagramCliente(user30)).toBeNull();
      });
    });

    describe('Formatos Válidos Sem Arroba (Inclusão de Clientes que Digitam Direto)', () => {
      it('aceita perfis informados sem o caractere arroba prefixado', () => {
        const semArroba = ['andre.silva', 'piloto_123', 'ayrtonsenna', 'a', 'kart_betim'];
        for (const s of semArroba) {
          expect(erroInstagramCs(s)).toBeNull();
          expect(erroInstagramCliente(s)).toBeNull();
          expect(normalizarInstagramCs(s)).toBe('@' + s.toLowerCase());
          expect(normalizarInstagramTs(s)).toBe('@' + s.toLowerCase());
        }
      });
    });

    describe('Formatos Válidos com URLs do Instagram', () => {
      it('extrai e aceita URLs https, http, www e com parâmetros de tracking', () => {
        const urlsValidas = [
          'https://www.instagram.com/piloto.oficial/',
          'http://instagram.com/piloto.oficial',
          'https://instagram.com/piloto_123?igshid=xyz123',
          'https://www.instagram.com/andre.silva/?utm_source=ig_web_copy_link',
          'https://instagram.com/piloto#perfil',
          'instagram.com/piloto.betim',
          'www.instagram.com/piloto.betim',
        ];

        for (const u of urlsValidas) {
          expect(erroInstagramCs(u)).toBeNull();
          expect(erroInstagramCliente(u)).toBeNull();
        }
      });
    });

    describe('Formatos Inválidos e Tentativas Maliciosas (Rejeitados)', () => {
      it('rejeita arroba isolada ou nomes com caracteres proibidos', () => {
        const invalidos = [
          '@',
          '@.usuario', // não pode começar com ponto
          '@usuario.', // não pode terminar com ponto
          '@usu..ario', // não pode ter dois pontos consecutivos
          '.usuario',
          'usuario.',
          'usu..ario',
          '@usuario com espaco',
          'usuario com espaco',
          '@piloto!especial',
          '@piloto#1',
          '@piloto$dinheiro',
          '<script>alert(1)</script>',
          'https://twitter.com/piloto',
          'https://facebook.com/piloto',
          'https://instagram.com/', // sem usuário
          'https://instagram.com',
          '@' + 'a'.repeat(31), // > 30 caracteres
        ];

        const msgErro = 'Instagram inválido. Informe o @usuário do piloto (ex.: @andre.silva).';
        for (const inv of invalidos) {
          expect(erroInstagramCs(inv)).toBe(msgErro);
          expect(erroInstagramCliente(inv)).toBe(msgErro);
        }
      });

      it('paridade total de normalização e validação entre C# e TypeScript', () => {
        const casos = [
          '', '   ', null, '@piloto', 'piloto', '@andre.silva', 'andre.silva',
          '@usu..ario', '@.piloto', 'https://instagram.com/piloto',
          'https://www.instagram.com/piloto/?ref=1', '@', 'piloto com espaco',
          'https://google.com/piloto'
        ];

        for (const c of casos) {
          expect(erroInstagramCs(c)).toBe(erroInstagramCliente(c));
          if (c && c.trim()) {
            expect(normalizarInstagramCs(c)).toBe(normalizarInstagramTs(c));
          }
        }
      });
    });
  });

  // --------------------------------------------------------------------------
  // PARTE 4: Integração no Cadastro Obrigatório Geral (erroCadastroObrigatorio)
  // --------------------------------------------------------------------------
  describe('4. Integração no Cadastro Obrigatório Geral', () => {
    it('aprova cadastro completo quando e-mail é válido, peso está em [10, 250] e instagram é opcional (vazio)', () => {
      const cadastro = {
        email: 'piloto@kartodromodebetim.com.br',
        peso: '75',
        instagram: '', // opcional!
      };
      expect(erroCadastroObrigatorio(cadastro)).toBeNull();
    });

    it('aprova cadastro quando instagram preenchido é válido', () => {
      const cadastro = {
        email: 'piloto@kartodromodebetim.com.br',
        peso: '80.5',
        instagram: '@piloto_oficial',
      };
      expect(erroCadastroObrigatorio(cadastro)).toBeNull();
    });

    it('rejeita cadastro se peso for inválido mesmo com instagram vazio', () => {
      const cadastro = {
        email: 'piloto@kartodromodebetim.com.br',
        peso: '8', // menor que 10 kg
        instagram: '',
      };
      expect(erroCadastroObrigatorio(cadastro)).toBe('Peso inválido. Informe um valor entre 10 e 250 kg.');
    });

    it('rejeita cadastro se instagram preenchido for inválido', () => {
      const cadastro = {
        email: 'piloto@kartodromodebetim.com.br',
        peso: '75',
        instagram: '@piloto..invalido',
      };
      expect(erroCadastroObrigatorio(cadastro)).toBe('Instagram inválido. Informe o @usuário do piloto (ex.: @andre.silva).');
    });
  });
});
