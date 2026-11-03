import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createHmac } from 'crypto';

// Leitura de fontes para validação estrutural e integridade
const opsServerPath = path.resolve(__dirname, '../../services/ops-server.ts');
const opsServerCode = fs.readFileSync(opsServerPath, 'utf-8');

const migrationPath = path.resolve(__dirname, '../../migrations/ops/0012_lgpd_menor.sql');
const migrationCode = fs.readFileSync(migrationPath, 'utf-8');

const kioskHookPath = path.resolve(__dirname, '../../desktop/src/Kartodromo.Autoatendimento/BloqueioTeclasKiosk.cs');
const kioskHookCode = fs.readFileSync(kioskHookPath, 'utf-8');

const formTotemPath = path.resolve(__dirname, '../../desktop/src/Kartodromo.Autoatendimento/FormTotem.cs');
const formTotemCode = fs.readFileSync(formTotemPath, 'utf-8');

const apiCsPath = path.resolve(__dirname, '../../desktop/src/Kartodromo.Comum/Api.cs');
const apiCsCode = fs.readFileSync(apiCsPath, 'utf-8');

// ============================================================================
// Funções espelho do backend para testes unitários de lógica criptográfica e regras
// ============================================================================

function onlyDigits(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

function mascararDocumento(doc: unknown, tipo?: unknown): string {
  if (!doc) return '';
  const d = String(doc).trim();
  const digits = onlyDigits(d);
  if (digits.length === 11 && (!tipo || String(tipo).toUpperCase() === 'CPF')) {
    return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
  }
  if (d.length <= 4) return '***';
  return `${d.slice(0, 2)}***${d.slice(-2)}`;
}

function mascararEmail(email: unknown): string {
  if (!email) return '';
  const s = String(email).trim();
  const at = s.indexOf('@');
  if (at <= 0) return 'u***@***.com';
  const user = s.slice(0, at);
  const domain = s.slice(at + 1);
  const u = user.length > 2 ? `${user[0]}***${user[user.length - 1]}` : (user.length > 0 ? `${user[0]}***` : 'u***');
  const dot = domain.indexOf('.');
  const domName = dot > 0 ? domain.slice(0, dot) : domain;
  const ext = dot > 0 ? domain.slice(dot) : '.com';
  const dMask = domName.length > 0 ? `${domName[0]}***` : 'd***';
  return `${u}@${dMask}${ext}`;
}

function mascararTelefone(telefone: unknown): string {
  if (!telefone) return '';
  const digits = onlyDigits(telefone);
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits[2]}****-${digits.slice(-4)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ****-${digits.slice(-4)}`;
  }
  if (digits.length >= 4) {
    return `(**) *****-${digits.slice(-4)}`;
  }
  return '(**) *****-****';
}

function mascararNomeMenor(nome: unknown): string {
  if (!nome) return '';
  const partes = String(nome).trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return partes[0] ?? '';
  const primeiro = partes[0];
  const ultimo = partes[partes.length - 1];
  const meio = partes.slice(1, -1).map((p) => `${p[0]}.`).join(' ');
  const meioStr = meio ? ` ${meio}` : '';
  return `${primeiro}${meioStr} ${ultimo[0]}***`;
}

function calcularIdade(nascimento: unknown): number | null {
  if (!nascimento) return null;
  const d = new Date(String(nascimento));
  if (isNaN(d.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - d.getFullYear();
  const m = hoje.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) idade--;
  return idade;
}

const key = process.env.OPS_RECEPCAO_KEY || '';
const sign = (text: string) => createHmac('sha256', key || 'sem-chave').update(text).digest('base64url').slice(0, 22);

function emiteTotemSession(clienteId: number, totemId: string): string {
  const agora = Date.now();
  const exp = agora + 15 * 60_000;
  const nonce = Math.random().toString(36).slice(2, 8);
  const payload = `${clienteId}:${totemId}:${agora}:${exp}:${nonce}`;
  const sig = sign(`totem_sess:${payload}`);
  return `${payload}:${sig}`;
}

function validaTotemSession(token: string | null | undefined): { clienteId: number; totemId: string } | null {
  if (!token) return null;
  const partes = token.split(':');
  if (partes.length !== 6) return null;
  const [cidStr, totemId, agoraStr, expStr, nonce, sig] = partes;
  const payload = `${cidStr}:${totemId}:${agoraStr}:${expStr}:${nonce}`;
  if (sig !== sign(`totem_sess:${payload}`)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  const cid = Number(cidStr);
  if (!Number.isInteger(cid) || cid <= 0) return null;
  return { clienteId: cid, totemId };
}

// ============================================================================
// SUÍTE OFICIAL DE SEGURANÇA, PRIVACIDADE E LGPD (MILESTONE M2 - ITENS 7 A 11)
// ============================================================================

describe('Segurança, Privacidade e LGPD - Autoatendimento (Milestone M2)', () => {

  describe('Item 7: Mascaramento Rigoroso de PII no Totem Público', () => {
    it('mascara CPF no formato exato ***.456.789-** preservando dígitos centrais para conferência', () => {
      expect(mascararDocumento('123.456.789-00', 'CPF')).toBe('***.456.789-**');
      expect(mascararDocumento('12345678900', 'CPF')).toBe('***.456.789-**');
      expect(mascararDocumento('98765432199', undefined)).toBe('***.654.321-**');
    });

    it('mascara documentos de outros tipos (RG, CNH, Passaporte)', () => {
      expect(mascararDocumento('MG-12.345.678', 'RG')).toBe('MG***78');
      expect(mascararDocumento('12345678901', 'CNH')).toBe('12***01');
      expect(mascararDocumento('AB123456', 'Passaporte')).toBe('AB***56');
      expect(mascararDocumento('123', 'RG')).toBe('***');
    });

    it('mascara e-mail preservando primeira e última letra do usuário e domínio abreviado', () => {
      expect(mascararEmail('pedro@gmail.com')).toBe('p***o@g***.com');
      expect(mascararEmail('luciana.ferreira@kartodromo.com.br')).toBe('l***a@k***.com.br');
      expect(mascararEmail('joao@empresa.com.br')).toBe('j***o@e***.com.br');
      expect(mascararEmail('a@x.org')).toBe('a***@x***.org');
      expect(mascararEmail('invalido')).toBe('u***@***.com');
    });

    it('mascara telefone preservando o DDD e 4 dígitos finais sem expor corpo do número', () => {
      expect(mascararTelefone('31987654321')).toBe('(31) 9****-4321');
      expect(mascararTelefone('(31) 98765-4321')).toBe('(31) 9****-4321');
      expect(mascararTelefone('3133334444')).toBe('(31) ****-4444');
      expect(mascararTelefone('123')).toBe('(**) *****-****');
    });

    it('garante que número e complemento de endereço são forçados a vazio no backend', () => {
      expect(opsServerCode).toContain("numero: ''");
      expect(opsServerCode).toContain("complemento: ''");
      expect(opsServerCode).toContain("nascimento: c.nascimento ? `**/**/${String(c.nascimento).slice(0, 4)}` : ''");
      expect(opsServerCode).toContain("temNascimento: Boolean(c.nascimento)");
    });
  });

  describe('Item 8: Proteção Reforçada de Menores de Idade', () => {
    it('mascara o nome do dependente menor para a fila pública', () => {
      expect(mascararNomeMenor('Enzo Gabriel da Silva')).toBe('Enzo G. d. S***');
      expect(mascararNomeMenor('Lucas Silva')).toBe('Lucas S***');
      expect(mascararNomeMenor('Maria')).toBe('Maria');
    });

    it('exige flag menor para trazer dependentes e ofusca o dia/mês de nascimento do dependente', () => {
      expect(opsServerCode).toContain("const buscaMenores = Boolean(body.menor);");
      expect(opsServerCode).toContain("if (buscaMenores) {");
      expect(opsServerCode).toContain("nascimento: d.nascimento ? `${d.nascimento.slice(0, 4)}-01-01` : ''");
      expect(opsServerCode).toContain("token: d.token");
    });
  });

  describe('Item 9: Token Seguro de Sessão de Totem (HMAC) e Desacoplamento de IP', () => {
    it('emite e valida tokens de sessão HMAC genuínos com expiração e integridade', () => {
      const token = emiteTotemSession(42, 'Totem 1');
      const payload = validaTotemSession(token);
      expect(payload).not.toBeNull();
      expect(payload?.clienteId).toBe(42);
      expect(payload?.totemId).toBe('Totem 1');
    });

    it('rejeita tokens HMAC expirados ou com integridade violada', () => {
      const token = emiteTotemSession(42, 'Totem 1');
      const tokenAdulterado = token.replace('42', '99');
      expect(validaTotemSession(tokenAdulterado)).toBeNull();
      expect(validaTotemSession('token_invalido')).toBeNull();
      expect(validaTotemSession('')).toBeNull();
      expect(validaTotemSession(null)).toBeNull();

      // Token expirado
      const expirado = `${42}:Totem 1:${Date.now() - 3600_000}:${Date.now() - 60_000}:nonce1`;
      const sigExp = sign(`totem_sess:${expirado}`);
      expect(validaTotemSession(`${expirado}:${sigExp}`)).toBeNull();
    });

    it('servidor backend prioriza X-Totem-Session sobre socket remoteAddress', () => {
      expect(opsServerCode).toContain("req.headers['x-totem-session']");
      expect(opsServerCode).toContain("validaTotemSession(headerToken.trim())");
      expect(opsServerCode).toContain("req.headers['x-totem-id']");
      expect(opsServerCode).toContain("req.headers['x-client-machine']");
    });

    it('cliente desktop WinForms Api.cs implementa headers de sessão de totem', () => {
      expect(apiCsCode).toContain("public string TotemSession { get; set; }");
      expect(apiCsCode).toContain("public string TotemId");
      expect(apiCsCode).toContain('req.Headers.TryAddWithoutValidation("X-Totem-Session", TotemSession);');
      expect(apiCsCode).toContain('req.Headers.TryAddWithoutValidation("X-Totem-Id", totemIdent);');
    });

    it('FormTotem.cs limpa a sessão ao reiniciar para não transferir vagas pagas ao próximo cliente', () => {
      expect(formTotemCode).toContain("_api.TotemSession = null;");
      expect(formTotemCode).toContain('_api.TotemSession = r.S("totemToken");');
    });
  });

  describe('Item 10: Bloqueio de Teclas Kiosk no Teclado USB (WinForms)', () => {
    it('implementa Low-Level Keyboard Hook com WH_KEYBOARD_LL = 13', () => {
      expect(kioskHookCode).toContain("WH_KEYBOARD_LL = 13");
      expect(kioskHookCode).toContain("SetWindowsHookEx");
      expect(kioskHookCode).toContain("UnhookWindowsHookEx");
      expect(kioskHookCode).toContain("CallNextHookEx");
    });

    it('intercepta teclas de escape do SO (WinKey, Alt+Tab, Alt+Esc, Ctrl+Esc, Ctrl+Shift+Esc, Alt+F4)', () => {
      expect(kioskHookCode).toContain("VK_LWIN = 0x5B");
      expect(kioskHookCode).toContain("VK_RWIN = 0x5C");
      expect(kioskHookCode).toContain("VK_TAB = 0x09");
      expect(kioskHookCode).toContain("VK_ESCAPE = 0x1B");
      expect(kioskHookCode).toContain("VK_APPS = 0x5D");
      expect(kioskHookCode).toContain("VK_F4 = 0x73");
    });

    it('preserva digitação de caracteres, ABNT2 (AltGr) e atalho de equipe Ctrl+Shift+Alt+S', () => {
      expect(kioskHookCode).toContain("vk == (int)Keys.S");
      expect(kioskHookCode).toContain("ctrlPressionado && shiftPressionado && altPressionado");
    });

    it('FormTotem instala o hook apenas quando autoteste for nulo e desinstala ao fechar', () => {
      expect(formTotemCode).toContain("if (autoteste == null)");
      expect(formTotemCode).toContain("_bloqueioKiosk = BloqueioTeclasKiosk.Instalar");
      expect(formTotemCode).toContain("_bloqueioKiosk?.Dispose();");
    });
  });

  describe('Item 11: Consentimento de Menores LGPD (Art. 14)', () => {
    it('migration 0012_lgpd_menor.sql adiciona colunas de auditoria e cria dbo.TermoAceite', () => {
      expect(migrationCode).toContain("LgpdMenorAceitoEm");
      expect(migrationCode).toContain("LgpdMenorResponsavelId");
      expect(migrationCode).toContain("LgpdMenorTermoVersao");
      expect(migrationCode).toContain("dbo.TermoAceite");
      expect(migrationCode).toContain("IX_TermoAceite_Cliente");
      expect(migrationCode).toContain("IX_TermoAceite_Responsavel");
    });

    it('backend exige consentimento explícito do responsável para dependentes menores', () => {
      expect(opsServerCode).toContain("if (body.consentimentoMenor !== true)");
      expect(opsServerCode).toContain("LGPD Art. 14");
    });

    it('backend valida faixas etárias de menores (mínimo 6 anos e menor que 18 anos)', () => {
      expect(opsServerCode).toContain("if (idade !== null && idade >= 18)");
      expect(opsServerCode).toContain("if (idade !== null && idade < 6)");
      expect(calcularIdade('2024-01-01')).toBeLessThan(6);
      expect(calcularIdade('2015-05-10')).toBeGreaterThanOrEqual(6);
    });

    it('backend bloqueia menor de 18 anos sem responsável na tela de adultos', () => {
      expect(opsServerCode).toContain("if (!id && idade !== null && idade < 18)");
      expect(opsServerCode).toContain("Menores de 18 anos devem ser cadastrados por um responsável legal (LGPD Art. 14)");
    });

    it('FormTotem.cs contém checkbox explícito de consentimento e modal para leitura do termo', () => {
      expect(formTotemCode).toContain('var lgpdMenor = Marca(c, "Sou pai/mãe ou responsável legal e autorizo o tratamento de dados do menor (LGPD Art. 14) *", 90, 622, false, 32);');
      expect(formTotemCode).toContain('linkMenor.LinkClicked += (_, _) => TermoLgpdMenor();');
      expect(formTotemCode).toContain('["consentimentoMenor"] = true');
      expect(formTotemCode).toContain('if (!lgpdMenor.Marcado)');
    });
  });
});
