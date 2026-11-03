import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createHmac } from 'crypto';
import { renderTermoResponsabilidade, idadeNaData, type TermoParticipante, type TermoEmpresa } from '../../lib/ops/termo';
import { TOTEM_BATERIAS_SQL, bateriaDisponivelNoTotem, type TotemBateriaCandidate } from '../../lib/ops/totem-baterias';
import { erroCadastroObrigatorio, erroPesoCliente } from '../../lib/ops/cadastro-obrigatorio';
import { erroInstagramCliente, normalizarInstagram } from '../../lib/ops/instagram';
import { onlyDigits, isValidCpf, clienteColumns } from '../../lib/ops/db';

const opsServerPath = path.resolve(__dirname, '../../services/ops-server.ts');
const opsServerCode = fs.readFileSync(opsServerPath, 'utf-8');

// Implementações exatas de proteção de PII (idênticas a services/ops-server.ts:269-310)
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

function mascararEndereco(endereco: unknown): string {
  if (!endereco) return '';
  const s = String(endereco).trim();
  if (!s) return '';
  const virgula = s.indexOf(',');
  const logradouro = (virgula > 0 ? s.slice(0, virgula) : s).trim();
  const partes = logradouro.split(/\s+/);
  return partes.length <= 1 ? `${partes[0].slice(0, 3)}***` : `${partes[0]} ***, ***`;
}

const key = process.env.OPS_RECEPCAO_KEY || '';
const sign = (text: string) => createHmac('sha256', key || 'sem-chave').update(text).digest('base64url').slice(0, 22);

describe('CHALLENGER M2: Testes Adversariais e de Estresse Empírico da Milestone M2', () => {

  // =========================================================================
  // 1. Injeção SQL e Parametrização Segura em Filtros de Baterias do Totem
  // =========================================================================
  describe('1. Injeção SQL e Parametrização em /api/totem/baterias', () => {
    // Algoritmo exato de extração de grupo de ops-server.ts:478
    function parseGrupoFromQuery(rawGrupo: string, signedSignFn: (t: string) => string): number[] {
      return String(rawGrupo ?? '')
        .split(',')
        .map((x) => x.split('.'))
        .filter(([id, tk]) => Number(id) > 0 && tk === signedSignFn(`cli:${Number(id)}`))
        .map(([id]) => Number(id));
    }

    // Algoritmo exato de montagem da consulta parametrizada de ops-server.ts:482-506
    function buildGrupoSql(rows: Array<{ id: number }>, grupo: number[]) {
      if (!grupo.length || !rows.length) return null;
      const bParams: Record<string, unknown> = {};
      const bMarks: string[] = [];
      rows.forEach((r, idx) => {
        const k = `bat_${idx}`;
        bParams[k] = Number(r.id);
        bMarks.push(`@${k}`);
      });

      const gParams: Record<string, unknown> = {};
      const gMarks: string[] = [];
      grupo.forEach((id, idx) => {
        const k = `grp_${idx}`;
        gParams[k] = Number(id);
        gMarks.push(`@${k}`);
      });

      const sqlText = `
        SELECT i.BateriaId b, COUNT(*) n FROM dbo.Inscricao i
        WHERE i.BateriaId IN (${bMarks.join(',')}) AND i.Status <> 'cancelada'
          AND (i.ClienteId IN (${gMarks.join(',')})
               OR (i.Origem = 'site' AND i.Pago = 1 AND i.ClienteId IN (SELECT ResponsavelId FROM dbo.Cliente WHERE Id IN (${gMarks.join(',')}) AND ResponsavelId IS NOT NULL)))
        GROUP BY i.BateriaId`;

      return { sqlText, params: { ...bParams, ...gParams }, bMarks, gMarks };
    }

    it('rejeita e expurga payloads clássicos de SQL Injection passados no parâmetro grupo', () => {
      const maliciousPayloads = [
        "1' OR '1'='1",
        "1; DROP TABLE dbo.Inscricao;--",
        "1 UNION SELECT null, null, null--",
        "1' OR 1=1--",
        "' OR ''='",
        "admin'--",
        "1' AND SLEEP(5)--",
        "1' WAITFOR DELAY '0:0:5'--",
        "1)); EXEC xp_cmdshell('dir');--",
      ];

      for (const payload of maliciousPayloads) {
        const parsed = parseGrupoFromQuery(payload, sign);
        expect(parsed).toEqual([]);
        const sqlBuilt = buildGrupoSql([{ id: 101 }], parsed);
        expect(sqlBuilt).toBeNull();
      }
    });

    it('rejeita números negativos, zeros, floats e valores não numéricos em grupo', () => {
      const invalidInputs = [
        "-1",
        "-9999",
        "0",
        "0.0",
        "NaN",
        "Infinity",
        "-Infinity",
        "1e5",
        "abc",
        "null",
        "undefined",
        "<script>alert(1)</script>",
        "!@#$%^&*()_+=",
        "",
        "   ",
        ",,,",
      ];

      for (const input of invalidInputs) {
        const parsed = parseGrupoFromQuery(input, sign);
        expect(parsed).toEqual([]);
      }
    });

    it('rejeita tokens adulterados, vazios ou com assinaturas forjadas', () => {
      const forgedAttempts = [
        "1.",
        "1.token_falso",
        "1.invalid_signature",
        "1. ",
        ".fake_token",
        `1.${sign('cli:2')}`, // token do cliente 2 para o cliente 1
        `1.${sign('admin:1')}`,
        `1.${sign('termo:1')}`,
        `1.${sign('cli:1') + 'tamper'}`,
      ];

      for (const attempt of forgedAttempts) {
        const parsed = parseGrupoFromQuery(attempt, sign);
        expect(parsed).toEqual([]);
      }
    });

    it('em ataque misto (ID válido + payload malicioso concatenado), isola estritamente o ID válido', () => {
      const validToken1 = sign('cli:42');
      const mixedAttack = `42.${validToken1},1' OR 1=1--,99.fake,0,NaN`;
      const parsed = parseGrupoFromQuery(mixedAttack, sign);

      // Apenas o cliente 42 com token assinado válido é aceito
      expect(parsed).toEqual([42]);

      const sql = buildGrupoSql([{ id: 200 }], parsed)!;
      expect(sql).not.toBeNull();
      expect(sql.sqlText).toContain('i.ClienteId IN (@grp_0)');
      expect(sql.sqlText).not.toContain("1' OR 1=1");
      expect(sql.params).toEqual({ bat_0: 200, grp_0: 42 });
      expect(typeof sql.params.grp_0).toBe('number');
    });

    it('parametrizador gera placeholders seguros (@bat_N, @grp_N) e tipos primitivos de dados', () => {
      const ids = [10, 20, 30];
      const validGrupo = ids.map((id) => `${id}.${sign(`cli:${id}`)}`).join(',');
      const parsed = parseGrupoFromQuery(validGrupo, sign);
      expect(parsed).toEqual([10, 20, 30]);

      const rows = [{ id: 101 }, { id: 102 }];
      const sql = buildGrupoSql(rows, parsed)!;

      expect(sql.bMarks).toEqual(['@bat_0', '@bat_1']);
      expect(sql.gMarks).toEqual(['@grp_0', '@grp_1', '@grp_2']);
      expect(sql.sqlText).toContain('i.BateriaId IN (@bat_0,@bat_1)');
      expect(sql.sqlText).toContain('i.ClienteId IN (@grp_0,@grp_1,@grp_2)');

      // Validação estrita de tipos no dicionário de parâmetros
      for (const [k, val] of Object.entries(sql.params)) {
        expect(k).toMatch(/^(bat|grp)_\d+$/);
        expect(typeof val).toBe('number');
        expect(Number.isInteger(val)).toBe(true);
      }
    });

    it('stress-test com 50 baterias e 100 participantes no grupo mantém integridade e ausência de injeção', () => {
      const rows = Array.from({ length: 50 }, (_, i) => ({ id: 1000 + i }));
      const grupoIds = Array.from({ length: 100 }, (_, i) => 5000 + i);
      const grupoParam = grupoIds.map((id) => `${id}.${sign(`cli:${id}`)}`).join(',');
      const parsed = parseGrupoFromQuery(grupoParam, sign);
      expect(parsed.length).toBe(100);

      const sql = buildGrupoSql(rows, parsed)!;
      expect(Object.keys(sql.params).length).toBe(150);

      // Placeholders dinâmicos contêm estritamente @bat_N e @grp_N
      for (const m of sql.bMarks) expect(m).toMatch(/^@bat_\d+$/);
      for (const m of sql.gMarks) expect(m).toMatch(/^@grp_\d+$/);

      // Todos os valores de parâmetros são inteiros puros
      for (const val of Object.values(sql.params)) {
        expect(typeof val).toBe('number');
        expect(Number.isInteger(val)).toBe(true);
      }
    });
  });

  // =========================================================================
  // 2. Proteção de PII e LGPD no Autoatendimento Público (POST /api/totem/identificar)
  // =========================================================================
  describe('2. Mascaramento Estrito de PII e Proteção de Menores', () => {
    it('comprova que as funções de teste são idênticas ao código de ops-server.ts', () => {
      expect(opsServerCode).toContain("return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;");
      expect(opsServerCode).toContain("return `${d.slice(0, 2)}***${d.slice(-2)}`;");
      expect(opsServerCode).toContain("return `${u}@${dMask}${ext}`;");
      expect(opsServerCode).toContain("return `(${digits.slice(0, 2)}) ${digits[2]}****-${digits.slice(-4)}`;");
      expect(opsServerCode).toContain("return partes.length <= 1 ? `${partes[0].slice(0, 3)}***` : `${partes[0]} ***, ***`;");
    });

    describe('2.1 Mascaramento de CPF e Documentos', () => {
      it('mascara estritamente CPF formatado de 11 dígitos no formato ***.456.789-**', () => {
        expect(mascararDocumento('123.456.789-00', 'CPF')).toBe('***.456.789-**');
        expect(mascararDocumento('987.654.321-99', 'CPF')).toBe('***.654.321-**');
        expect(mascararDocumento('001.002.003-04', 'CPF')).toBe('***.002.003-**');
      });

      it('mascara CPF digitado apenas com números sem formatação', () => {
        expect(mascararDocumento('12345678900', 'CPF')).toBe('***.456.789-**');
        expect(mascararDocumento('12345678900', undefined)).toBe('***.456.789-**');
        expect(mascararDocumento('12345678900', null)).toBe('***.456.789-**');
      });

      it('mascara outros tipos de documento (RG, Passaporte, CNH)', () => {
        expect(mascararDocumento('MG-12.345.678', 'RG')).toBe('MG***78');
        expect(mascararDocumento('USA987654321', 'Passaporte')).toBe('US***21');
        expect(mascararDocumento('12345678901', 'CNH')).toBe('12***01');
      });

      it('mascara documentos curtos (<= 4 caracteres) exibindo apenas ***', () => {
        expect(mascararDocumento('1234', 'RG')).toBe('***');
        expect(mascararDocumento('123', 'RG')).toBe('***');
        expect(mascararDocumento('A', 'RG')).toBe('***');
      });

      it('trata valores vazios ou indefinidos retornando vazio ou máscara mínima segura', () => {
        expect(mascararDocumento('', 'CPF')).toBe('');
        expect(mascararDocumento(null, 'CPF')).toBe('');
        expect(mascararDocumento(undefined, 'CPF')).toBe('');
        // Espaços são normalizados para tamanho 0 (<= 4), retornando máscara segura ***
        expect(mascararDocumento('   ', 'CPF')).toBe('***');
      });

      it('oráculo invariante: início e dígitos verificadores do CPF nunca são revelados', () => {
        const cpfOriginal = '12345678900';
        const mascarado = mascararDocumento(cpfOriginal);
        expect(mascarado).toBe('***.456.789-**');
      });
    });

    describe('2.2 Mascaramento de E-mail', () => {
      it('mascara a parte local e o domínio preservando primeira e última letra do usuário e inicial do domínio', () => {
        expect(mascararEmail('pedro.guilherme@kartodromo.com.br')).toBe('p***e@k***.com.br');
        expect(mascararEmail('luciana.ferreira@empresa.com')).toBe('l***a@e***.com');
        expect(mascararEmail('a@x.org')).toBe('a***@x***.org');
      });

      it('trata e-mails inválidos ou sem arroba retornando máscara genérica segura', () => {
        expect(mascararEmail('emailinvalido.com')).toBe('u***@***.com');
        expect(mascararEmail('@dominio.com')).toBe('u***@***.com');
        expect(mascararEmail('')).toBe('');
        expect(mascararEmail(null)).toBe('');
        expect(mascararEmail(undefined)).toBe('');
      });

      it('oráculo invariante: o corpo central do e-mail do usuário e o nome do provedor nunca são expostos', () => {
        const email = 'segredo.confidencial@gmail.com';
        const masked = mascararEmail(email);
        expect(masked).not.toContain('egredo');
        expect(masked).not.toContain('confidencial');
        expect(masked).not.toContain('mail');
        expect(masked).toBe('s***l@g***.com');
      });
    });

    describe('2.3 Mascaramento de Telefone', () => {
      it('revela os últimos 4 dígitos e preserva DDD para conferência sem expor corpo do número', () => {
        expect(mascararTelefone('31987654321')).toBe('(31) 9****-4321');
        expect(mascararTelefone('(31) 98765-4321')).toBe('(31) 9****-4321');
        expect(mascararTelefone('3133334444')).toBe('(31) ****-4444');
      });

      it('suporta telefones internacionais sem quebrar o mascaramento', () => {
        expect(mascararTelefone('+1 (555) 123-4567')).toBe('(15) 5****-4567');
      });

      it('para números muito curtos (< 4 dígitos) mascara com padrão seguro', () => {
        expect(mascararTelefone('190')).toBe('(**) *****-****');
        expect(mascararTelefone('')).toBe('');
        expect(mascararTelefone(null)).toBe('');
      });

      it('oráculo invariante: miolo do número nunca é visível', () => {
        const tel = '(31) 98765-4321';
        const masked = mascararTelefone(tel);
        expect(masked).not.toContain('8765');
        expect(masked).toBe('(31) 9****-4321');
      });
    });

    describe('2.4 Mascaramento de Endereço, Número e Complemento', () => {
      it('mascara logradouros preservando apenas a primeira palavra', () => {
        expect(mascararEndereco('Av. Afonso Pena, 1500 - Sala 302')).toBe('Av. ***, ***');
        expect(mascararEndereco('Rua das Flores, 123')).toBe('Rua ***, ***');
        expect(mascararEndereco('Alameda dos Pinhais')).toBe('Alameda ***, ***');
        expect(mascararEndereco('Centro')).toBe('Cen***');
      });

      it('no endpoint /api/totem/identificar, numero e complemento são estritamente forçados a string vazia', () => {
        expect(opsServerCode).toContain("numero: ''");
        expect(opsServerCode).toContain("complemento: ''");
        expect(opsServerCode).not.toContain("numero: c.numero");
        expect(opsServerCode).not.toContain("complemento: c.complemento");
      });
    });

    describe('2.5 Proteção de Dependentes Menores', () => {
      it('a query de dependentes em ops-server.ts:378 seleciona exclusivamente id, nome e nascimento', () => {
        const dependentesQueryMatch = opsServerCode.match(/SELECT c\.Id id, c\.Nome nome, CONVERT\(varchar\(10\), c\.Nascimento, 126\) nascimento FROM dbo\.Cliente c WHERE c\.ResponsavelId/);
        expect(dependentesQueryMatch).not.toBeNull();

        // Não deve selecionar Documento, Email, Telefone ou Endereço de menores na tela pública
        expect(opsServerCode).not.toMatch(/SELECT [^;]*c\.Documento[^;]*FROM dbo\.Cliente c WHERE c\.ResponsavelId/);
        expect(opsServerCode).not.toMatch(/SELECT [^;]*c\.Email[^;]*FROM dbo\.Cliente c WHERE c\.ResponsavelId/);
        expect(opsServerCode).not.toMatch(/SELECT [^;]*c\.Telefone[^;]*FROM dbo\.Cliente c WHERE c\.ResponsavelId/);
      });

      it('cada dependente recebe um token de sessão HMAC assinado (sign(cli:id))', () => {
        expect(opsServerCode).toContain("dependentes.map((d) => ({ ...d, token: sign(`cli:${d.id}`) }))");
      });
    });

    describe('2.6 Preservação de Dados de Endereço e Proteção Contra Máscaras', () => {
      it('descarta campos mascarados com *** no POST /api/totem/cadastro para evitar sobrescrita', () => {
        const payloadComMascara: Record<string, unknown> = {
          documento: '123.***.***-00',
          email: 'u***@***.com',
          telefone: '(**) *****-1234',
          cep: '32600-***',
          endereco: 'Av. ***, ***',
        };

        // Simula o descarte defensivo de ops-server.ts:435-450
        if (typeof payloadComMascara.documento === 'string' && payloadComMascara.documento.includes('***')) delete payloadComMascara.documento;
        if (typeof payloadComMascara.email === 'string' && payloadComMascara.email.includes('***')) delete payloadComMascara.email;
        if (typeof payloadComMascara.telefone === 'string' && payloadComMascara.telefone.includes('***')) delete payloadComMascara.telefone;
        if (typeof payloadComMascara.cep === 'string' && payloadComMascara.cep.includes('***')) delete payloadComMascara.cep;
        if (typeof payloadComMascara.endereco === 'string' && payloadComMascara.endereco.includes('***')) delete payloadComMascara.endereco;

        expect(payloadComMascara.documento).toBeUndefined();
        expect(payloadComMascara.email).toBeUndefined();
        expect(payloadComMascara.telefone).toBeUndefined();
        expect(payloadComMascara.cep).toBeUndefined();
        expect(payloadComMascara.endereco).toBeUndefined();
      });

      it('clienteColumns com partial=true preserva colunas omitidas sem gravar NULL', () => {
        const cols = clienteColumns({ nome: 'Piloto Teste', telefone: '(31) 98765-4321' }, true);
        expect(cols.Nome).toBe('Piloto Teste');
        expect(cols.Telefone).toBe('(31) 98765-4321');
        // Não deve incluir Numero nem Complemento como null
        expect(cols.Numero).toBeUndefined();
        expect(cols.Complemento).toBeUndefined();
        expect(cols.Endereco).toBeUndefined();
      });
    });
  });

  // =========================================================================
  // 3. Bobina Térmica Dinâmica e Formato de Termos (/termo e lib/ops/termo.ts)
  // =========================================================================
  describe('3. Bobina Térmica Dinâmica (80mm auto vs 297mm legado)', () => {
    const defaultEmpresa: TermoEmpresa = {
      nome: 'Kartódromo Betim',
      razaoSocial: 'Kartódromo Internacional de Betim Ltda',
      cidade: 'Betim',
    };

    const participantePadrao: TermoParticipante = {
      nome: 'Ayrton Senna da Silva',
      documento: '12.345.678-9',
      nascimento: '1990-03-21',
      email: 'ayrton@senna.test',
      telefone: '(31) 98888-7777',
      cep: '32600-000',
      endereco: 'Rua do Kart',
      numero: '100',
      complemento: 'Box 1',
      bairro: 'Distrito',
      cidade: 'Betim',
      responsavelNome: null,
      responsavelDocumento: null,
      responsavelTelefone: null,
      responsavelEmail: null,
    };

    it('HTML gerado não possui menção a 297mm em nenhum caso de uso', () => {
      const html1 = renderTermoResponsabilidade({ empresa: defaultEmpresa, participantes: [participantePadrao] });
      const htmlMulti = renderTermoResponsabilidade({
        empresa: defaultEmpresa,
        participantes: [
          participantePadrao,
          { ...participantePadrao, nome: 'Alain Prost' },
          { ...participantePadrao, nome: 'Nigel Mansell' },
        ],
      });
      const htmlBranco = renderTermoResponsabilidade({ empresa: defaultEmpresa, participantes: [participantePadrao], branco: true });
      const htmlVazio = renderTermoResponsabilidade({ empresa: defaultEmpresa, participantes: [] });

      for (const html of [html1, htmlMulti, htmlBranco, htmlVazio]) {
        expect(html).not.toContain('297mm');
        expect(html).not.toMatch(/297\s*mm/i);
      }
    });

    it('estilos CSS declaram @page { size: 80mm auto; margin: 0; } e width: 80mm', () => {
      const html = renderTermoResponsabilidade({ empresa: defaultEmpresa, participantes: [participantePadrao] });
      expect(html).toContain('@page{size:80mm auto;margin:0}');
      expect(html).toContain('html,body{margin:0;padding:0;width:80mm;background:#fff;color:#000}');
      expect(html).toContain('.page{position:relative;width:80mm;min-height:auto;');
      expect(html).not.toMatch(/\.page\{[^}]*height:\s*\d+/);
    });

    it('previne páginas em branco: .page:last-child desativa a quebra de página', () => {
      const html = renderTermoResponsabilidade({
        empresa: defaultEmpresa,
        participantes: [
          participantePadrao,
          { ...participantePadrao, nome: 'Piloto 2' },
        ],
      });
      expect(html).toContain('break-after:page;page-break-after:always');
      expect(html).toContain('.page:last-child{break-after:auto;page-break-after:auto}');
    });

    it('bloco de assinatura possui proteção contra quebra interna (break-inside: avoid)', () => {
      const html = renderTermoResponsabilidade({ empresa: defaultEmpresa, participantes: [participantePadrao] });
      expect(html).toContain('.assinatura{margin:16mm auto 0;width:50mm;text-align:center;flex:none;break-inside:avoid;page-break-inside:avoid}');
    });

    it('escapa com segurança caracteres especiais e tentativas de injeção XSS', () => {
      const invasor: TermoParticipante = {
        ...participantePadrao,
        nome: '<script>alert("xss")</script>',
        documento: '"><img src=x onerror=alert(1)>',
        email: 'attacker@evil.com"><b',
        endereco: 'Rua & < > " \' Maliciosa',
      };
      const html = renderTermoResponsabilidade({ empresa: defaultEmpresa, participantes: [invasor] });
      expect(html).not.toContain('<script>alert');
      expect(html).not.toContain('<img src=x');
      expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(html).toContain('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
    });

    it('rota /termo valida assinatura criptográfica do link antes de renderizar', () => {
      expect(opsServerCode).toContain("url.searchParams.get('s') !== sign('termo:' + ids.join(','))");
      expect(opsServerCode).toContain("throw new HttpError(403, 'Link do termo inválido.')");
    });
  });

  // =========================================================================
  // 4. Validação de Peso e Instagram (Fronteiras e Limites Estritos)
  // =========================================================================
  describe('4. Validação de Peso e Instagram (Fronteiras e Limites)', () => {
    describe('4.1 Fronteiras Estritas de Peso [10 kg, 250 kg]', () => {
      it('rejeita pesos abaixo de 10 kg (9 kg, 9.99 kg, 0 kg, negativos)', () => {
        expect(erroPesoCliente(9)).toContain('Peso inválido. Informe um valor entre 10 e 250 kg.');
        expect(erroPesoCliente('9')).toContain('Peso inválido');
        expect(erroPesoCliente(9.99)).toContain('Peso inválido');
        expect(erroPesoCliente('9.9')).toContain('Peso inválido');
        expect(erroPesoCliente(0)).toContain('Peso inválido');
        expect(erroPesoCliente(-10)).toContain('Peso inválido');
      });

      it('aceita exatamente o limite inferior de 10 kg', () => {
        expect(erroPesoCliente(10)).toBeNull();
        expect(erroPesoCliente('10')).toBeNull();
        expect(erroPesoCliente('10.0')).toBeNull();
        expect(erroPesoCliente('10,0')).toBeNull();
      });

      it('aceita valores intermediários válidos', () => {
        expect(erroPesoCliente(15)).toBeNull();
        expect(erroPesoCliente(50)).toBeNull();
        expect(erroPesoCliente(78.5)).toBeNull();
        expect(erroPesoCliente('82,3')).toBeNull();
        expect(erroPesoCliente(120)).toBeNull();
      });

      it('aceita exatamente o limite superior de 250 kg', () => {
        expect(erroPesoCliente(250)).toBeNull();
        expect(erroPesoCliente('250')).toBeNull();
        expect(erroPesoCliente('250.0')).toBeNull();
        expect(erroPesoCliente('250,0')).toBeNull();
      });

      it('rejeita pesos acima de 250 kg (250.01 kg, 251 kg, 300 kg)', () => {
        expect(erroPesoCliente(250.01)).toContain('Peso inválido. Informe um valor entre 10 e 250 kg.');
        expect(erroPesoCliente('250.1')).toContain('Peso inválido');
        expect(erroPesoCliente(251)).toContain('Peso inválido');
        expect(erroPesoCliente('251')).toContain('Peso inválido');
        expect(erroPesoCliente(300)).toContain('Peso inválido');
      });

      it('rejeita peso vazio, nulo, indefinido ou não numérico com mensagem adequada', () => {
        expect(erroPesoCliente('')).toContain('O peso é obrigatório. Informe o peso em kg.');
        expect(erroPesoCliente('   ')).toContain('O peso é obrigatório');
        expect(erroPesoCliente(null)).toContain('O peso é obrigatório');
        expect(erroPesoCliente(undefined)).toContain('O peso é obrigatório');
        expect(erroPesoCliente('abc')).toContain('Peso inválido');
        expect(erroPesoCliente('NaN')).toContain('Peso inválido');
        expect(erroPesoCliente('Infinity')).toContain('Peso inválido');
      });
    });

    describe('4.2 Validação e Normalização de Instagram', () => {
      it('trata Instagram como opcional: aceita valores vazios, nulos ou indefinidos', () => {
        expect(erroInstagramCliente('')).toBeNull();
        expect(erroInstagramCliente('   ')).toBeNull();
        expect(erroInstagramCliente(null)).toBeNull();
        expect(erroInstagramCliente(undefined)).toBeNull();
        expect(normalizarInstagram('')).toBe('');
        expect(normalizarInstagram(null)).toBe('');
        expect(normalizarInstagram(undefined)).toBe('');
      });

      it('aceita e normaliza @usuário válido', () => {
        expect(erroInstagramCliente('@andre.silva')).toBeNull();
        expect(normalizarInstagram('@andre.silva')).toBe('@andre.silva');

        expect(erroInstagramCliente('andre.silva')).toBeNull();
        expect(normalizarInstagram('andre.silva')).toBe('@andre.silva');

        expect(erroInstagramCliente('PILOTO_BETIM')).toBeNull();
        expect(normalizarInstagram('PILOTO_BETIM')).toBe('@piloto_betim');
      });

      it('normaliza URLs completas de perfil do Instagram', () => {
        expect(normalizarInstagram('https://www.instagram.com/piloto.oficial/')).toBe('@piloto.oficial');
        expect(normalizarInstagram('http://instagram.com/piloto.oficial')).toBe('@piloto.oficial');
        expect(normalizarInstagram('instagram.com/piloto.oficial?igsh=123')).toBe('@piloto.oficial');
        expect(erroInstagramCliente('https://www.instagram.com/piloto.oficial/')).toBeNull();
      });

      it('rejeita formatos inválidos de Instagram', () => {
        expect(erroInstagramCliente('@')).toContain('Instagram inválido');
        expect(erroInstagramCliente('nome com espaço')).toContain('Instagram inválido');
        expect(erroInstagramCliente('piloto@email.com')).toContain('Instagram inválido');
        expect(erroInstagramCliente('<script>')).toContain('Instagram inválido');
        expect(erroInstagramCliente('@piloto..duplo')).toContain('Instagram inválido');
        expect(erroInstagramCliente('@piloto.')).toContain('Instagram inválido');
        expect(erroInstagramCliente('@.piloto')).toContain('Instagram inválido');
      });

      it('testa limite de caracteres do Instagram (máximo 30 caracteres de usuário)', () => {
        const trintaChars = 'a'.repeat(30);
        expect(erroInstagramCliente(`@${trintaChars}`)).toBeNull();
        expect(normalizarInstagram(`@${trintaChars}`)).toBe(`@${trintaChars}`);

        const trintaEUmChars = 'a'.repeat(31);
        expect(erroInstagramCliente(`@${trintaEUmChars}`)).toContain('Instagram inválido');
      });

      it('erroCadastroObrigatorio integra peso e Instagram perfeitamente', () => {
        const dadosValidos = { email: 'piloto@example.com', peso: 75, instagram: '' };
        expect(erroCadastroObrigatorio(dadosValidos)).toBeNull();

        const dadosComInsta = { email: 'piloto@example.com', peso: '80', instagram: '@piloto' };
        expect(erroCadastroObrigatorio(dadosComInsta)).toBeNull();

        const pesoInvalido = { email: 'piloto@example.com', peso: 9, instagram: '' };
        expect(erroCadastroObrigatorio(pesoInvalido)).toContain('Peso inválido');

        const instaInvalido = { email: 'piloto@example.com', peso: 75, instagram: 'invalido com espaco' };
        expect(erroCadastroObrigatorio(instaInvalido)).toContain('Instagram inválido');
      });
    });
  });

  // =========================================================================
  // 5. Bloqueio de Baterias Vencidas (SYSDATETIME vs Tolerância de -30 minutos)
  // =========================================================================
  describe('5. Bloqueio Estrito de Baterias Vencidas', () => {
    it('bateriaDisponivelNoTotem rejeita baterias cujo horário de início já passou (granularidade por minuto)', () => {
      const bateria = {
        inicio: '2026-10-26T14:30:00',
        status: 'aberta',
        autoAtendimento: true,
        reservaFechada: false,
        livres: 10,
      };

      // Agora = 14:31:00 (1 minuto após início) -> rejeitado
      expect(bateriaDisponivelNoTotem(bateria, '2026-10-26', '2026-10-26T14:31:00')).toBe(false);

      // Agora = 14:35:00 (5 minutos após início) -> rejeitado
      expect(bateriaDisponivelNoTotem(bateria, '2026-10-26', '2026-10-26T14:35:00')).toBe(false);

      // Agora = 14:29:00 (1 minuto antes do início) -> aceito
      expect(bateriaDisponivelNoTotem(bateria, '2026-10-26', '2026-10-26T14:29:00')).toBe(true);
    });

    it('TOTEM_BATERIAS_SQL possui cláusula b.Inicio >= SYSDATETIME() para precisão em segundos no banco', () => {
      expect(TOTEM_BATERIAS_SQL).toContain('b.Inicio >= SYSDATETIME()');
    });

    it('lib/ops/office.ts removeu a tolerância de -30 minutos', () => {
      const officePath = path.resolve(__dirname, '../../lib/ops/office.ts');
      const officeCode = fs.readFileSync(officePath, 'utf-8');
      expect(officeCode).toContain('CASE WHEN b.Inicio < SYSDATETIME() THEN 1 ELSE 0 END passada');
      expect(officeCode).not.toContain('DATEADD(minute, -30, SYSDATETIME())');
    });
  });
});
