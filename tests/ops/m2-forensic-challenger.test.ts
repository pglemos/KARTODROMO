import { describe, expect, it } from 'vitest';
import { renderTermoResponsabilidade, type TermoParticipante } from '../../lib/ops/termo';
import { TOTEM_BATERIAS_SQL, bateriaDisponivelNoTotem } from '../../lib/ops/totem-baterias';
import { erroInstagramCliente } from '../../lib/ops/instagram';
import { erroCadastroObrigatorio, erroPesoCliente } from '../../lib/ops/cadastro-obrigatorio';
import * as fs from 'fs';
import * as path from 'path';

describe('Auditoria Forense Independente - Milestone M2', () => {
  const opsServerPath = path.resolve(__dirname, '../../services/ops-server.ts');
  const opsServerCode = fs.readFileSync(opsServerPath, 'utf-8');
  const officePath = path.resolve(__dirname, '../../lib/ops/office.ts');
  const officeCode = fs.readFileSync(officePath, 'utf-8');

  describe('Forensic Check 1: Fila de Impressão e CTE Atômica', () => {
    it('verifica persistência em dbo.FilaImpressao e ausência de fila em memória volátil', () => {
      expect(opsServerCode).toContain('INSERT INTO dbo.FilaImpressao (Url, Titulo, Origem, Status, Tentativas)');
      expect(opsServerCode).not.toContain('const filaImpressao: Impressao[] = [];');
      expect(opsServerCode).not.toContain('filaImpressao.splice');
    });

    it('verifica CTE atômica com locks concorrentes UPDLOCK e READPAST', () => {
      expect(opsServerCode).toMatch(/WITH\s+Proximo\s+AS\s*\(\s*SELECT\s+TOP\s*\(1\)\s+\*\s+FROM\s+dbo\.FilaImpressao\s+WITH\s*\(UPDLOCK,\s*READPAST\)/i);
      expect(opsServerCode).toContain("WHERE Status = 'pendente' OR (Status = 'imprimindo' AND PegoEm < DATEADD(second, -90, SYSDATETIME()))");
      expect(opsServerCode).toContain("UPDATE Proximo SET Status = 'imprimindo', PegoEm = SYSDATETIME(), Tentativas = Tentativas + 1");
      expect(opsServerCode).toContain("OUTPUT inserted.Id id, inserted.Url url, inserted.Titulo titulo, inserted.Origem origem, inserted.Tentativas tentativa");
    });

    it('verifica transição para contingência sem purga aos 180 minutos', () => {
      expect(opsServerCode).toContain("SET Status = 'falhou', UltimoErro = 'contingencia'");
      expect(opsServerCode).toContain("DATEDIFF(hour, CriadoEm, SYSDATETIME()) >= 3");
    });

    it('verifica endpoints de ciclo de vida da impressão', () => {
      expect(opsServerCode).toContain("path === '/api/office/impressao/proxima'");
      expect(opsServerCode).toContain("SET Status = 'impressa', FeitaEm = SYSDATETIME()");
      expect(opsServerCode).toContain("SET Status = 'falhou'");
      expect(opsServerCode).toContain("FalhouEm = SYSDATETIME()");
      expect(opsServerCode).toContain("SET Status = 'pendente', PegoEm = NULL, Tentativas = 0, UltimoErro = NULL");
    });
  });

  describe('Forensic Check 2: Bobina Térmica Dinâmica e Layout', () => {
    it('garante tamanho dinâmico @page { size: 80mm auto; } e ausência de 297mm em múltiplos participantes', () => {
      const p1: TermoParticipante = {
        nome: 'Piloto Um',
        documento: '111.222.333-44',
        nascimento: '1995-05-10',
        email: 'p1@teste.com',
        telefone: '(31) 98888-1111',
        cep: '32000-000',
        endereco: 'Rua das Flores',
        numero: '10',
        complemento: 'Bloco A',
        bairro: 'Jardim',
        cidade: 'Betim',
        responsavelNome: null,
        responsavelDocumento: null,
        responsavelTelefone: null,
        responsavelEmail: null,
      };
      const p2: TermoParticipante = {
        ...p1,
        nome: 'Piloto Dois',
        documento: '555.666.777-88',
        email: 'p2@teste.com',
      };

      const html = renderTermoResponsabilidade({
        empresa: { nome: 'Kartódromo de Betim', razaoSocial: 'Kartódromo Betim Ltda', cidade: 'Betim' },
        participantes: [p1, p2],
      });

      expect(html).toContain('@page{size:80mm auto;margin:0}');
      expect(html).toContain('.page{position:relative;width:80mm;min-height:auto;padding:0 5.7mm 4mm');
      expect(html).not.toContain('297mm');
    });
  });

  describe('Forensic Check 3: Proteção de Dados Pessoais (LGPD / PII)', () => {
    it('verifica que mascaramento foi implementado e cobre todos os campos de identificação', () => {
      expect(opsServerCode).toContain('mascararDocumento(c.documento, c.tipoDocumento)');
      expect(opsServerCode).toContain('mascararEmail(c.email)');
      expect(opsServerCode).toContain('mascararTelefone(c.telefone)');
      expect(opsServerCode).toContain('mascararEndereco(enderecoCompleto)');
      expect(opsServerCode).toContain("numero: ''");
      expect(opsServerCode).toContain("complemento: ''");
    });

    it('verifica preservação de endereço e descarte de campos mascarados no update do cliente', () => {
      expect(opsServerCode).toMatch(/if\s*\(typeof dados\.documento === 'string' && .*dados\.documento\.includes\('\*+'\).*delete dados\.documento;/);
      expect(opsServerCode).toMatch(/if\s*\(typeof dados\.email === 'string' && .*dados\.email\.includes\('\*+'\).*delete dados\.email;/);
      expect(opsServerCode).toMatch(/if\s*\(typeof dados\.telefone === 'string' && .*dados\.telefone\.includes\('\*+'\).*delete dados\.telefone;/);
      expect(opsServerCode).toMatch(/if\s*\(typeof dados\.cep === 'string' && .*dados\.cep\.includes\('\*+'\).*delete dados\.cep;/);
      expect(opsServerCode).not.toContain('Numero = NULL, Complemento = NULL');
    });
  });

  describe('Forensic Check 4: Bloqueio de Baterias Vencidas', () => {
    it('confirma que office.ts removeu tolerância de 30 minutos', () => {
      expect(officeCode).toContain('CASE WHEN b.Inicio < SYSDATETIME() THEN 1 ELSE 0 END passada');
      expect(officeCode).not.toContain('DATEADD(minute, -30, SYSDATETIME())');
    });

    it('confirma que TOTEM_BATERIAS_SQL filtra início futuro', () => {
      expect(TOTEM_BATERIAS_SQL).toContain('b.Inicio >= SYSDATETIME()');
    });

    it('stress-test de bateriaDisponivelNoTotem com testes de borda de tempo', () => {
      const cand = {
        inicio: '2026-10-26T15:30:00',
        status: 'aberta',
        autoAtendimento: true,
        reservaFechada: false,
        livres: 5,
      };

      // 1 minuto antes do início -> LIBERADA
      expect(bateriaDisponivelNoTotem(cand, '2026-10-26', '2026-10-26T15:29:00')).toBe(true);

      // Exatamente no minuto de início -> LIBERADA
      expect(bateriaDisponivelNoTotem(cand, '2026-10-26', '2026-10-26T15:30:00')).toBe(true);

      // 1 minuto após início -> BLOQUEADA
      expect(bateriaDisponivelNoTotem(cand, '2026-10-26', '2026-10-26T15:31:00')).toBe(false);

      // Sem vagas -> BLOQUEADA
      expect(bateriaDisponivelNoTotem({ ...cand, livres: 0 }, '2026-10-26', '2026-10-26T15:00:00')).toBe(false);

      // Status fechada -> BLOQUEADA
      expect(bateriaDisponivelNoTotem({ ...cand, status: 'fechada' }, '2026-10-26', '2026-10-26T15:00:00')).toBe(false);

      // Autoatendimento desativado -> BLOQUEADA
      expect(bateriaDisponivelNoTotem({ ...cand, autoAtendimento: false }, '2026-10-26', '2026-10-26T15:00:00')).toBe(false);
    });
  });

  describe('Forensic Check 5: Parametrização SQL e Prevenção de Injeção', () => {
    it('garante que query de baterias do grupo não concatena arrays diretamente', () => {
      expect(opsServerCode).not.toContain('IN (${rows.map');
      expect(opsServerCode).not.toContain('IN (${lista})');
      expect(opsServerCode).toContain('bat_${idx}');
      expect(opsServerCode).toContain('grp_${idx}');
      expect(opsServerCode).toContain('query<{ b: number; n: number }>(sqlText, { ...bParams, ...gParams })');
    });
  });

  describe('Forensic Check 6: Estorno Granular de Vouchers', () => {
    it('garante atualização restrita ao VoucherId específico do item', () => {
      expect(officeCode).toContain('UPDATE TOP (1) dbo.VoucherUso SET Estornado = 1 WHERE VendaId = @vendaId AND VoucherId = @voucherId AND Estornado = 0');
      expect(officeCode).not.toMatch(/UPDATE dbo\.VoucherUso SET Estornado = 1 WHERE VendaId = @vendaId AND EXISTS/);
    });
  });

  describe('Forensic Check 7: Validações de Negócio de Cadastro (Instagram e Peso)', () => {
    it('Instagram é genuinamente opcional', () => {
      expect(erroInstagramCliente('')).toBeNull();
      expect(erroInstagramCliente('   ')).toBeNull();
      expect(erroInstagramCliente(null)).toBeNull();
      expect(erroInstagramCliente(undefined)).toBeNull();
      expect(erroCadastroObrigatorio({ email: 'piloto@betim.com.br', peso: 75 })).toBeNull();
      expect(erroCadastroObrigatorio({ email: 'piloto@betim.com.br', peso: 75, instagram: '' })).toBeNull();
    });

    it('Instagram rejeita formatos maliciosos ou inválidos quando fornecido', () => {
      expect(erroInstagramCliente('@usuario.valido_123')).toBeNull();
      expect(erroInstagramCliente('@nome..duplo')).toContain('Instagram inválido');
      expect(erroInstagramCliente('usuario_sem_arroba')).toBeNull(); // normalizarInstagram prefixa @
      expect(erroInstagramCliente('usuario com espaço')).toContain('Instagram inválido');
    });

    it('Peso é validado estritamente na faixa harmonizada [10, 250]', () => {
      expect(erroPesoCliente(9.99)).toContain('Peso inválido');
      expect(erroPesoCliente(10.0)).toBeNull();
      expect(erroPesoCliente('10')).toBeNull();
      expect(erroPesoCliente('80,5')).toBeNull();
      expect(erroPesoCliente(250.0)).toBeNull();
      expect(erroPesoCliente(250.01)).toContain('Peso inválido');
      expect(erroPesoCliente(null)).toContain('O peso é obrigatório');
      expect(erroPesoCliente('abc')).toContain('Peso inválido');
    });
  });

  describe('Forensic Check 8: Otimização em /api/crono/uso-karts', () => {
    it('utiliza coluna persistida KartNumero = @n', () => {
      expect(opsServerCode).toContain('WHERE KartNumero = @n');
      expect(opsServerCode).not.toContain('WHERE TRY_CAST(LTRIM(RTRIM(Kart)) AS int) = @n');
    });
  });

  describe('Forensic Check 9: Regras do Dono e Vetos', () => {
    it('não alterou FormTV (--tv) no escopo da Milestone M2', () => {
      const cronoPath = path.resolve(__dirname, '../../desktop/src/Kartodromo.Cronometragem/FormTV.cs');
      const stat = fs.statSync(cronoPath);
      // M2 iniciou em 2026-10-26T22:23Z (ou 19:23 local). FormTV é anterior a isso.
      const m2StartTime = new Date('2026-10-26T22:00:00Z').getTime();
      expect(stat.mtimeMs).toBeLessThan(m2StartTime);
    });
  });
});
