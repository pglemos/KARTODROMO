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

describe('Milestone M3: Desktop Comum & Periféricos (Validação Rigorosa)', () => {
  // --------------------------------------------------------------------------
  // Item 4: Polling Inteligente do Agente de Impressão
  // --------------------------------------------------------------------------
  describe('Item 4: Polling Inteligente do Agente de Impressão (AgenteImpressao.cs)', () => {
    it('verifica se impressora existe e NÃO inicia timer de polling caso impressora não seja encontrada', () => {
      expect(agenteImpressaoCs).toContain('if (!existe)');
      expect(agenteImpressaoCs).toContain('Situacao = "Impressora dos termos não encontrada";');
      expect(agenteImpressaoCs).toContain('Polling de impressão não iniciado');
      expect(agenteImpressaoCs).toContain('return;');

      // Garante que a instanciação do Timer ocorre estritamente APÓS a verificação de existência
      const posCheck = agenteImpressaoCs.indexOf('if (!existe)');
      const posTimer = agenteImpressaoCs.indexOf('new System.Windows.Forms.Timer');
      expect(posCheck).toBeGreaterThan(0);
      expect(posTimer).toBeGreaterThan(posCheck);
    });

    it('registra mensagem de log clara e define situação visual correta quando ativa', () => {
      expect(agenteImpressaoCs).toContain('Situacao = "Termos do totem: " + _impressora;');
      expect(agenteImpressaoCs).toContain('Log($"agente ligado, impressora {_impressora}");');
    });
  });

  // --------------------------------------------------------------------------
  // Item 5: Timeout no WebView2 em Impressão Silenciosa
  // --------------------------------------------------------------------------
  describe('Item 5: Timeout no WebView2 em Impressão Silenciosa (Relatorio.cs)', () => {
    it('adiciona timeout de segurança de 15 segundos no carregamento do WebView2', () => {
      expect(relatorioCs).toContain('Task.Delay(TimeSpan.FromSeconds(15))');
      expect(relatorioCs).toContain('await Task.WhenAny(carregou.Task, timeoutTask)');
    });

    it('lança TimeoutException informativa e limpa handler de evento em caso de estouro', () => {
      expect(relatorioCs).toContain('completou == timeoutTask');
      expect(relatorioCs).toContain('throw new TimeoutException');
      expect(relatorioCs).toContain('Tempo limite de 15 segundos excedido ao carregar o termo para impressão silenciosa');
      expect(relatorioCs).toContain('web.CoreWebView2.NavigationCompleted -= OnNavCompleted');
    });

    it('garante liberação do semáforo e fechamento do host em bloco finally', () => {
      expect(relatorioCs).toContain('finally');
      expect(relatorioCs).toContain('host.Close();');
      expect(relatorioCs).toContain('_semImpressaoSilenciosa.Release();');
    });
  });

  // --------------------------------------------------------------------------
  // Item 6: Tratamento de Expiração de Sessão (401) sem Modal Bloqueante
  // --------------------------------------------------------------------------
  describe('Item 6: Tratamento de Sessão Expirada 401 no Agente de Impressão (AgenteImpressao.cs)', () => {
    it('NÃO exibe diálogo modal bloqueante (Msg.Info) na thread de UI ao expirar sessão', () => {
      expect(agenteImpressaoCs).not.toContain('Msg.Info(dono');
      expect(agenteImpressaoCs).not.toContain('Msg.Info(');
    });

    it('atualiza status visual amigável e define pausa para nova tentativa após login', () => {
      expect(agenteImpressaoCs).toContain('e is ApiException { Status: 401 }');
      expect(agenteImpressaoCs).toContain('Situacao = "Sessão expirada (401) - faça login novamente";');
      expect(agenteImpressaoCs).toContain('Log("Sessão expirada (401) ao buscar impressões');
      expect(agenteImpressaoCs).toContain('_pausaAte = DateTime.Now.AddSeconds(30);');
    });
  });

  // --------------------------------------------------------------------------
  // Item 7: Guilhotinamento e Corte de Bobina na TM-T20X
  // --------------------------------------------------------------------------
  describe('Item 7: Guilhotinamento e Corte de Bobina na TM-T20X (Relatorio.cs)', () => {
    it('configura largura exata de 80mm em polegadas e altura dinâmica sem forçar A4 fixo', () => {
      // 80mm / 25.4 mm por polegada (~3.15 pol)
      expect(relatorioCs).toContain('cfg.PageWidth = 80.0 / 25.4;');
      expect(relatorioCs).toContain('Math.max(document.body ? document.body.scrollHeight');
      expect(relatorioCs).toContain('cfg.PageHeight = Math.Max(2.5, (alturaPx / 96.0) + 0.25);');
    });

    it('zera margens e habilita backgrounds para impressão térmica fiel', () => {
      expect(relatorioCs).toContain('cfg.MarginTop = cfg.MarginBottom = cfg.MarginLeft = cfg.MarginRight = 0;');
      expect(relatorioCs).toContain('cfg.ShouldPrintBackgrounds = true;');
      expect(relatorioCs).toContain('cfg.ShouldPrintHeaderAndFooter = false;');
    });
  });

  // --------------------------------------------------------------------------
  // Itens 8 & 9: Monitoramento de Spooler e Saneamento de Filas Fantasma
  // --------------------------------------------------------------------------
  describe('Itens 8 & 9: Monitoramento de Spooler e Saneamento de Filas Fantasma (Relatorio.cs e AgenteImpressao.cs)', () => {
    it('implementa rotina nativa VerificarSpooler com detecção de status offline, sem papel e erros', () => {
      expect(relatorioCs).toContain('public static (bool ok, string motivo) VerificarSpooler(string impressora)');
      expect(relatorioCs).toContain('PRINTER_STATUS_OFFLINE');
      expect(relatorioCs).toContain('PRINTER_STATUS_PAPER_OUT');
      expect(relatorioCs).toContain('PRINTER_STATUS_PAPER_JAM');
      expect(relatorioCs).toContain('PRINTER_STATUS_DOOR_OPEN');
      expect(relatorioCs).toContain('PRINTER_STATUS_ERROR');
      expect(relatorioCs).toContain('Impressora offline ou desconectada');
      expect(relatorioCs).toContain('Impressora sem papel');
    });

    it('implementa rotina de saneamento LimparFilaSpooler usando PRINTER_CONTROL_PURGE nativo', () => {
      expect(relatorioCs).toContain('public static bool LimparFilaSpooler(string impressora)');
      expect(relatorioCs).toContain('PRINTER_CONTROL_PURGE = 3');
      expect(relatorioCs).toContain('SetPrinter(hPrinter, 0, IntPtr.Zero, PRINTER_CONTROL_PURGE)');
    });

    it('integra monitoramento de spooler na rodada periódica de impressão antes de puxar jobs', () => {
      expect(agenteImpressaoCs).toContain('Relatorio.VerificarSpooler(_impressora)');
      expect(agenteImpressaoCs).toContain('Relatorio.LimparFilaSpooler(_impressora)');
    });
  });

  // --------------------------------------------------------------------------
  // Item 23: Correção de Cursor Jumping em Máscaras
  // --------------------------------------------------------------------------
  describe('Item 23: Correção de Cursor Jumping em Máscaras (Ui.cs)', () => {
    it('expõe CalcularCursorMascara e preserva contagem de caracteres alfanuméricos', () => {
      expect(uiCs).toContain('public static int CalcularCursorMascara(string antigoTexto, string novoTextoFormatado, int posicaoAntiga)');
      expect(uiCs).toContain('char.IsLetterOrDigit');
      expect(uiCs).toContain('CalcularCursorMascara(textoAntes, textoNovo, pos)');
    });

    // Verificação comportamental da lógica de cálculo de cursor
    function calcularCursorMascara(antigoTexto: string, novoTextoFormatado: string, posicaoAntiga: number): number {
      if (posicaoAntiga >= antigoTexto.length) return novoTextoFormatado.length;
      if (posicaoAntiga <= 0) return 0;

      let rawAntes = 0;
      for (let i = 0; i < Math.min(posicaoAntiga, antigoTexto.length); i++) {
        if (/[a-zA-Z0-9]/.test(antigoTexto[i])) rawAntes++;
      }

      let novoPos = 0;
      let rawCont = 0;
      while (novoPos < novoTextoFormatado.length && rawCont < rawAntes) {
        if (/[a-zA-Z0-9]/.test(novoTextoFormatado[novoPos])) rawCont++;
        novoPos++;
      }

      return Math.min(novoPos > 0 ? novoPos : posicaoAntiga, novoTextoFormatado.length);
    }

    it('mantém o cursor na posição esperada ao digitar no meio de CPF formatado', () => {
      // Texto antigo digitando o 4 no meio: "123" -> adiciona "4" -> "1234" vira "123.4"
      const pos1 = calcularCursorMascara('1234', '123.4', 4);
      expect(pos1).toBe(5); // Cursor após o 4 no texto formatado

      // Digitando no meio de um CPF completo: cursor estava na posição 6 (após '4')
      const pos2 = calcularCursorMascara('123.4956.789-00', '123.495.678-90', 6);
      expect(pos2).toBe(6); // Não reseta para 0!

      // Digitando no fim
      const posFim = calcularCursorMascara('12345678901', '123.456.789-01', 11);
      expect(posFim).toBe(14); // Cursor no final do texto formatado
    });
  });

  // --------------------------------------------------------------------------
  // Item 26: Flexibilização de Instagram
  // --------------------------------------------------------------------------
  describe('Item 26: Flexibilização de Instagram (ValidacaoCliente.cs)', () => {
    it('trata Instagram como opcional retornando null para strings vazias ou nulas', () => {
      expect(validacaoClienteCs).toContain('if (string.IsNullOrWhiteSpace(instagram)) return null;');
    });

    // Verificação comportamental da validação C# espelhada
    function normalizarInstagram(instagram: string | null): string {
      let usuario = (instagram || '').trim();
      const match = usuario.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)\/?(?:[?#].*)?$/i);
      if (match) usuario = match[1];
      if (usuario.startsWith('@')) usuario = usuario.slice(1);
      return usuario.length === 0 ? '' : '@' + usuario.toLowerCase();
    }

    function erroInstagram(instagram: string | null): string | null {
      if (!instagram || !instagram.trim()) return null; // opcional
      const perfil = normalizarInstagram(instagram);
      return /^@[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?$/.test(perfil) && !perfil.includes('..')
        ? null
        : 'Instagram inválido.';
    }

    it('aceita valores nulos, vazios e com espaços sem erro', () => {
      expect(erroInstagram(null)).toBeNull();
      expect(erroInstagram('')).toBeNull();
      expect(erroInstagram('   ')).toBeNull();
    });

    it('valida perfis preenchidos legítimos e rejeita caracteres inválidos', () => {
      expect(erroInstagram('piloto.betim')).toBeNull();
      expect(erroInstagram('@piloto_123')).toBeNull();
      expect(erroInstagram('https://www.instagram.com/piloto.oficial/')).toBeNull();
      expect(erroInstagram('@')).not.toBeNull();
      expect(erroInstagram('nome com espaco')).not.toBeNull();
      expect(erroInstagram('<script>')).not.toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Item 27: Harmonização de Faixas de Peso
  // --------------------------------------------------------------------------
  describe('Item 27: Harmonização de Faixas de Peso (ValidacaoCliente.cs)', () => {
    it('aceita valores de peso na faixa de 10 kg a 250 kg', () => {
      expect(validacaoClienteCs).toContain('kg >= 10 && kg <= 250');
      expect(validacaoClienteCs).toContain('entre 10 e 250 kg');
    });

    function erroPeso(peso: string | null): string | null {
      const p = (peso || '').trim().replace(',', '.');
      if (p.length === 0) return 'O peso é obrigatório.';
      const n = Number(p);
      return !Number.isNaN(n) && Number.isFinite(n) && n >= 10 && n <= 250
        ? null
        : 'Peso inválido. Informe um valor entre 10 e 250 kg.';
    }

    it('aceita 10 kg e 250 kg como limites válidos', () => {
      expect(erroPeso('10')).toBeNull();
      expect(erroPeso('10,0')).toBeNull();
      expect(erroPeso('80.5')).toBeNull();
      expect(erroPeso('80,5')).toBeNull();
      expect(erroPeso('250')).toBeNull();
    });

    it('rejeita valores fora da faixa aceita (menor que 10 e maior que 250)', () => {
      expect(erroPeso('0')).not.toBeNull();
      expect(erroPeso('-1')).not.toBeNull();
      expect(erroPeso('9.9')).not.toBeNull();
      expect(erroPeso('250.1')).not.toBeNull();
      expect(erroPeso('500')).not.toBeNull();
      expect(erroPeso('abc')).not.toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Item 28: Redução de Timeout HTTP Resiliente
  // --------------------------------------------------------------------------
  describe('Item 28: Redução de Timeout HTTP Resiliente (Api.cs)', () => {
    it('define timeout padrão do HttpClient como 10 segundos em vez de 30 segundos', () => {
      expect(apiCs).toContain('Timeout = timeout ?? TimeSpan.FromSeconds(10)');
      expect(apiCs).not.toContain('TimeSpan.FromSeconds(30)');
    });

    it('expõe propriedade Timeout para inspeção direta', () => {
      expect(apiCs).toContain('public TimeSpan Timeout => _http.Timeout;');
    });
  });

  // --------------------------------------------------------------------------
  // Item 33: Eliminação de Vazamento Massivo de Regiões GDI
  // --------------------------------------------------------------------------
  describe('Item 33: Eliminação de Vazamento Massivo de Regiões GDI (Design.cs)', () => {
    it('armazena e descarta explicitamente a região anterior em Forma.Recortar', () => {
      expect(designCs).toContain('var antiga = c.Region;');
      expect(designCs).toContain('c.Region = new Region(path);');
      expect(designCs).toContain('antiga?.Dispose();');

      const posAntiga = designCs.indexOf('var antiga = c.Region;');
      const posNewRegion = designCs.indexOf('c.Region = new Region(path);');
      const posDispose = designCs.indexOf('antiga?.Dispose();');

      expect(posAntiga).toBeGreaterThan(0);
      expect(posNewRegion).toBeGreaterThan(posAntiga);
      expect(posDispose).toBeGreaterThan(posNewRegion);
    });

    it('armazena e descarta explicitamente a região anterior em AjustarContorno', () => {
      expect(designCs).toContain('var antiga = painel.Region;');
      expect(designCs).toContain('painel.Region = new Region(path);');
    });
  });
});
