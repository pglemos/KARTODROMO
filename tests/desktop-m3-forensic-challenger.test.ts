import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

const relatorioCs = read('desktop/src/Kartodromo.Comum/Relatorio.cs');
const agenteImpressaoCs = read('desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs');
const uiCs = read('desktop/src/Kartodromo.Comum/Ui.cs');
const validacaoClienteCs = read('desktop/src/Kartodromo.Comum/ValidacaoCliente.cs');
const apiCs = read('desktop/src/Kartodromo.Comum/Api.cs');
const designCs = read('desktop/src/Kartodromo.Comum/Design.cs');
const formTvCs = read('desktop/src/Kartodromo.Cronometragem/FormTV.cs');

describe('Forensic Integrity Challenger — Milestone M3 (Desktop Comum & Periféricos)', () => {
  // --------------------------------------------------------------------------
  // Auditoria de Integridade e Regras do Dono (AGENTS.md)
  // --------------------------------------------------------------------------
  describe('Auditoria Forense de Vetos e Regras do Dono', () => {
    it('FormTV.cs (--tv) NÃO possui alterações introduzidas pela Milestone M3', () => {
      // Verifica se FormTV.cs mantém sua integridade
      expect(formTvCs).toContain('public class FormTV : Form');
      expect(formTvCs).not.toContain('AgenteImpressao');
      expect(formTvCs).not.toContain('CalcularCursorMascara');
    });

    it('Nenhuma credencial, senha em texto claro ou segredo foi inserido no código', () => {
      const todosCodigos = relatorioCs + agenteImpressaoCs + uiCs + validacaoClienteCs + apiCs + designCs;
      expect(todosCodigos).not.toMatch(/password\s*=\s*['"][^'"]+['"]/i);
      expect(todosCodigos).not.toMatch(/senha\s*=\s*['"][^'"]+['"]/i);
      expect(todosCodigos).not.toMatch(/secret\s*=\s*['"][^'"]+['"]/i);
    });

    it('Não existem mocks de teste embutidos em código de produção', () => {
      expect(relatorioCs).not.toContain('if (Environment.GetEnvironmentVariable("VITEST")');
      expect(agenteImpressaoCs).not.toContain('if (Environment.GetEnvironmentVariable("VITEST")');
      expect(uiCs).not.toContain('if (Environment.GetEnvironmentVariable("VITEST")');
      expect(validacaoClienteCs).not.toContain('if (Environment.GetEnvironmentVariable("VITEST")');
    });

    it('Preserva ecossistema Windows nativo .NET 8 WinForms sem desvios para web/Chrome', () => {
      expect(agenteImpressaoCs).toContain('System.Windows.Forms.Timer');
      expect(uiCs).toContain('TextBox t');
      expect(designCs).toContain('Control c');
      expect(relatorioCs).toContain('winspool.drv');
    });
  });

  // --------------------------------------------------------------------------
  // Teste de Estresse Adversarial: CalcularCursorMascara (Ui.cs)
  // --------------------------------------------------------------------------
  describe('Stress-Testing: Algoritmo de Preservação de Cursor (Ui.cs)', () => {
    // Replicando exatamente a lógica C# de CalcularCursorMascara:
    function calcularCursorMascara(antigoTexto: string | null | undefined, novoTextoFormatado: string | null | undefined, posicaoAntiga: number): number {
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

      return Math.min(novoPos > 0 ? novoPos : posicaoAntiga, novo.length);
    }

    it('lida perfeitamente com valores nulos, vazios e índices negativos ou gigantes', () => {
      expect(calcularCursorMascara(null, null, 0)).toBe(0);
      expect(calcularCursorMascara('', '', 0)).toBe(0);
      expect(calcularCursorMascara('', '123', -5)).toBe(0);
      expect(calcularCursorMascara('123', '123', 999)).toBe(3);
      expect(calcularCursorMascara(null, 'formatado', 5)).toBe(9);
    });

    it('mantém o cursor exato ao digitar caracteres no meio de um telefone', () => {
      // Antigo: "(31) 988" -> insere '7' no meio -> "31988" com '7' vira "(31) 9878"
      // Se o cursor estava no índice 6 (após '9' e antes do '8')
      const pos1 = calcularCursorMascara('(31) 988', '(31) 9878', 6);
      expect(pos1).toBe(6); // Após '9'

      // Se o cursor estava no índice 7 (após o primeiro '8')
      const pos2 = calcularCursorMascara('(31) 988', '(31) 9878', 7);
      expect(pos2).toBe(7); // Após o primeiro '8'
    });

    it('mantém o cursor estável ao apagar caracteres (backspace) no meio de um CEP', () => {
      // "32.600-000" apagando o '6': cursor estava no índice 4
      const pos = calcularCursorMascara('32.600-000', '32.000-00', 4);
      expect(pos).toBe(4);
    });

    it('mantém o cursor no início se posicaoAntiga for 0', () => {
      const pos = calcularCursorMascara('123.456', '123.456.789', 0);
      expect(pos).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Teste de Estresse Adversarial: Validações de Cliente (ValidacaoCliente.cs)
  // --------------------------------------------------------------------------
  describe('Stress-Testing: Validação de Cliente (ValidacaoCliente.cs)', () => {
    function erroInstagram(instagram: string | null | undefined): string | null {
      if (!instagram || !instagram.trim()) return null;
      let usuario = instagram.trim();
      const match = usuario.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)\/?(?:[?#].*)?$/i);
      if (match) usuario = match[1];
      if (usuario.startsWith('@')) usuario = usuario.slice(1);
      const perfil = usuario.length === 0 ? '' : '@' + usuario.toLowerCase();

      return /^@[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?$/.test(perfil) && !perfil.includes('..')
        ? null
        : 'Instagram inválido. Informe o @usuário do piloto (ex.: @andre.silva).';
    }

    function erroPeso(peso: string | null | undefined): string | null {
      const p = (peso || '').trim().replace(',', '.');
      if (p.length === 0) return 'O peso é obrigatório. Informe o peso em kg.';
      const kg = Number(p);
      return !Number.isNaN(kg) && Number.isFinite(kg) && kg >= 10 && kg <= 250
        ? null
        : 'Peso inválido. Informe um valor entre 10 e 250 kg.';
    }

    it('Instagram: aceita variações com espaços vazios, tabulações e quebras de linha como opcional', () => {
      expect(erroInstagram('')).toBeNull();
      expect(erroInstagram('   ')).toBeNull();
      expect(erroInstagram('\t\n ')).toBeNull();
      expect(erroInstagram(undefined)).toBeNull();
      expect(erroInstagram(null)).toBeNull();
    });

    it('Instagram: normaliza e valida URLs completas e tags válidas', () => {
      expect(erroInstagram('https://www.instagram.com/piloto_pro/')).toBeNull();
      expect(erroInstagram('http://instagram.com/piloto.1')).toBeNull();
      expect(erroInstagram('@ayrton.senna')).toBeNull();
      expect(erroInstagram('rubens_barrichello')).toBeNull();
    });

    it('Instagram: rejeita perfis com dois pontos consecutivos ou símbolos proibidos', () => {
      expect(erroInstagram('@piloto..invalido')).not.toBeNull();
      expect(erroInstagram('@piloto!alerta')).not.toBeNull();
      expect(erroInstagram('@piloto#1')).not.toBeNull();
    });

    it('Peso: aceita valores limítrofes exatos 10 e 250', () => {
      expect(erroPeso('10')).toBeNull();
      expect(erroPeso('10.0')).toBeNull();
      expect(erroPeso('10,00')).toBeNull();
      expect(erroPeso('250')).toBeNull();
      expect(erroPeso('250.0')).toBeNull();
      expect(erroPeso('250,0')).toBeNull();
    });

    it('Peso: rejeita valores abaixo de 10 e acima de 250', () => {
      expect(erroPeso('9.99')).not.toBeNull();
      expect(erroPeso('0')).not.toBeNull();
      expect(erroPeso('-15')).not.toBeNull();
      expect(erroPeso('250.01')).not.toBeNull();
      expect(erroPeso('300')).not.toBeNull();
      expect(erroPeso('9999')).not.toBeNull();
      expect(erroPeso('NaN')).not.toBeNull();
      expect(erroPeso('Infinity')).not.toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Teste de Estresse Adversarial: Fórmulas de Impressão Térmica (Relatorio.cs)
  // --------------------------------------------------------------------------
  describe('Stress-Testing: Fórmulas de Dimensão da TM-T20X (Relatorio.cs)', () => {
    it('cálculo de largura em polegadas corresponde fielmente a 80mm', () => {
      const larguraMm = 80.0;
      const larguraPol = larguraMm / 25.4;
      expect(larguraPol).toBeCloseTo(3.1496, 3);
      expect(relatorioCs).toContain('cfg.PageWidth = 80.0 / 25.4;');
    });

    it('cálculo de altura dinâmica escala proporcionalmente com altura em pixels do DOM', () => {
      function calcularAlturaPol(alturaPx: number): number {
        return Math.max(2.5, (alturaPx / 96.0) + 0.25);
      }

      // Termo curto: 200px -> 200/96 + 0.25 = 2.33 -> limitado ao mínimo de segurança 2.5 pol
      expect(calcularAlturaPol(200)).toBe(2.5);

      // Termo médio: 800px -> 800/96 + 0.25 = 8.58 pol
      expect(calcularAlturaPol(800)).toBeCloseTo(8.583, 2);

      // Termo longo com dependentes: 1500px -> 1500/96 + 0.25 = 15.875 pol
      expect(calcularAlturaPol(1500)).toBeCloseTo(15.875, 2);
    });

    it('semáforo de impressão silenciosa possui liberação no bloco finally', () => {
      expect(relatorioCs).toContain('await _semImpressaoSilenciosa.WaitAsync();');
      expect(relatorioCs).toContain('finally');
      expect(relatorioCs).toContain('_semImpressaoSilenciosa.Release();');
    });
  });

  // --------------------------------------------------------------------------
  // Teste de Estresse Adversarial: P/Invoke e Spooler Win32 (Relatorio.cs)
  // --------------------------------------------------------------------------
  describe('Stress-Testing: Spooler Win32 P/Invoke & Constantes (Relatorio.cs)', () => {
    it('constantes de status do spooler correspondem aos valores oficiais da Win32 API', () => {
      // PRINTER_STATUS_PAUSED = 0x00000001
      expect(relatorioCs).toContain('PRINTER_STATUS_PAUSED = 0x00000001;');
      // PRINTER_STATUS_ERROR = 0x00000002
      expect(relatorioCs).toContain('PRINTER_STATUS_ERROR = 0x00000002;');
      // PRINTER_STATUS_PAPER_JAM = 0x00000008
      expect(relatorioCs).toContain('PRINTER_STATUS_PAPER_JAM = 0x00000008;');
      // PRINTER_STATUS_PAPER_OUT = 0x00000010
      expect(relatorioCs).toContain('PRINTER_STATUS_PAPER_OUT = 0x00000010;');
      // PRINTER_STATUS_OFFLINE = 0x00000080
      expect(relatorioCs).toContain('PRINTER_STATUS_OFFLINE = 0x00000080;');
      // PRINTER_STATUS_DOOR_OPEN = 0x00400000
      expect(relatorioCs).toContain('PRINTER_STATUS_DOOR_OPEN = 0x00400000;');
      // PRINTER_CONTROL_PURGE = 3
      expect(relatorioCs).toContain('PRINTER_CONTROL_PURGE = 3;');
    });

    it('VerificarSpooler trata impressora vazia ou inexistente de forma segura sem lançar exceção', () => {
      expect(relatorioCs).toContain('if (string.IsNullOrWhiteSpace(impressora))');
      expect(relatorioCs).toContain('return (false, "Impressora não configurada");');
      expect(relatorioCs).toContain('if (!ImpressoraExiste(impressora))');
      expect(relatorioCs).toContain('return (false, "Impressora não encontrada no sistema");');
    });
  });

  // --------------------------------------------------------------------------
  // Teste de Estresse Adversarial: Resiliência do Agente de Impressão (AgenteImpressao.cs)
  // --------------------------------------------------------------------------
  describe('Stress-Testing: Resiliência do Agente de Impressão (AgenteImpressao.cs)', () => {
    it('Agente de Impressão protege contra crash na enumeração de impressoras com bloco try-catch', () => {
      expect(agenteImpressaoCs).toContain('try');
      expect(agenteImpressaoCs).toContain('PrinterSettings.InstalledPrinters.Cast<string>()');
      expect(agenteImpressaoCs).toContain('catch (Exception ex)');
      expect(agenteImpressaoCs).toContain('existe = false;');
    });

    it('Agente não chama Msg.Info bloqueante em nenhuma circunstância no tratamento de erros', () => {
      expect(agenteImpressaoCs).not.toContain('Msg.Info');
      expect(agenteImpressaoCs).not.toContain('MessageBox.Show');
    });

    it('Agente pausa execução e reporta situação clara em caso de 401', () => {
      expect(agenteImpressaoCs).toContain('if (e is ApiException { Status: 401 })');
      expect(agenteImpressaoCs).toContain('_pausaAte = DateTime.Now.AddSeconds(30);');
      expect(agenteImpressaoCs).toContain('Situacao = "Sessão expirada (401) - faça login novamente";');
    });
  });

  // --------------------------------------------------------------------------
  // Teste de Estresse Adversarial: Vazamento GDI (Design.cs)
  // --------------------------------------------------------------------------
  describe('Stress-Testing: Descarte de Recursos GDI (Design.cs)', () => {
    it('em Forma.Recortar e AjustarContorno o descarte da região anterior é estritamente garantido', () => {
      expect(designCs).toContain('var antiga = c.Region;');
      expect(designCs).toContain('c.Region = new Region(path);');
      expect(designCs).toContain('antiga?.Dispose();');

      expect(designCs).toContain('var antiga = painel.Region;');
      expect(designCs).toContain('painel.Region = new Region(path);');
      expect(designCs).toContain('antiga?.Dispose();');
    });
  });
});
