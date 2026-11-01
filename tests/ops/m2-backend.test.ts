import { describe, expect, it } from 'vitest';
import { renderTermoResponsabilidade, type TermoParticipante } from '../../lib/ops/termo';
import { TOTEM_BATERIAS_SQL, bateriaDisponivelNoTotem } from '../../lib/ops/totem-baterias';
import { erroInstagramCliente } from '../../lib/ops/instagram';
import { erroPesoCliente } from '../../lib/ops/cadastro-obrigatorio';
import * as fs from 'fs';
import * as path from 'path';

describe('M2 - Servidor Backend Operacional (Testes Abrangentes)', () => {
  describe('1. Fila de impressão persistida no banco e rotas de impressão', () => {
    const opsServerPath = path.resolve(__dirname, '../../services/ops-server.ts');
    const opsServerCode = fs.readFileSync(opsServerPath, 'utf-8');

    it('enfileira jobs persistindo na tabela dbo.FilaImpressao via SQL', () => {
      expect(opsServerCode).toContain('INSERT INTO dbo.FilaImpressao');
      expect(opsServerCode).toContain("VALUES (@url, @titulo, @origem, 'pendente', 0)");
    });

    it('implementa CTE atômica com UPDLOCK e READPAST em proximaImpressao', () => {
      expect(opsServerCode).toContain('WITH Proximo AS');
      expect(opsServerCode).toContain('SELECT TOP (1) * FROM dbo.FilaImpressao WITH (UPDLOCK, READPAST)');
      expect(opsServerCode).toContain("WHERE Status = 'pendente' OR (Status = 'imprimindo' AND PegoEm < DATEADD(second, -90, SYSDATETIME()))");
      expect(opsServerCode).toContain("UPDATE Proximo SET Status = 'imprimindo', PegoEm = SYSDATETIME(), Tentativas = Tentativas + 1");
    });

    it('retorna contrato no formato { ok: true, job } e suporta id direto para compatibilidade desktop', () => {
      expect(opsServerCode).toContain("path === '/api/office/impressao/proxima'");
      expect(opsServerCode).toContain('ok: true');
      expect(opsServerCode).toContain('job: job ? { id: job.id, url: job.url, titulo: job.titulo, origem: job.origem } : null');
    });

    it('atualiza status para impressa e FeitaEm no endpoint de conclusão', () => {
      expect(opsServerCode).toContain("SET Status = 'impressa', FeitaEm = SYSDATETIME()");
    });

    it('atualiza status para falhou e FalhouEm no endpoint de falha', () => {
      expect(opsServerCode).toContain("SET Status = 'falhou'");
      expect(opsServerCode).toContain('FalhouEm = SYSDATETIME()');
    });

    it('mantém histórico na consulta de fila sem purgar termos com mais de 3h', () => {
      expect(opsServerCode).toContain("path === '/api/office/impressao/fila'");
      expect(opsServerCode).toContain('FROM dbo.FilaImpressao');
      // não deve conter splice que deleta da memória
      expect(opsServerCode).not.toContain('filaImpressao.splice');
    });
  });

  describe('2. Altura dinâmica do termo térmico na bobina de 80mm', () => {
    const participante: TermoParticipante = {
      nome: 'Piloto Teste',
      documento: '123.456.789-00',
      nascimento: '1990-01-01',
      email: 'piloto@example.com',
      telefone: '(31) 99999-9999',
      cep: '30000-000',
      endereco: 'Rua de Teste',
      numero: '100',
      complemento: null,
      bairro: 'Centro',
      cidade: 'Betim',
      responsavelNome: null,
      responsavelDocumento: null,
      responsavelTelefone: null,
      responsavelEmail: null,
    };

    it('gera CSS com @page { size: 80mm auto; margin: 0; } e elimina altura fixa de 297mm', () => {
      const html = renderTermoResponsabilidade({
        empresa: { nome: 'Kartódromo Betim', razaoSocial: null, cidade: 'Betim' },
        participantes: [participante],
      });

      expect(html).toContain('@page{size:80mm auto;margin:0}');
      expect(html).toContain('min-height:auto;padding:0 5.7mm 4mm');
      expect(html).not.toContain('297mm');
    });
  });

  describe('3. Proteção de PII no endpoint público de identificação do totem', () => {
    const opsServerPath = path.resolve(__dirname, '../../services/ops-server.ts');
    const opsServerCode = fs.readFileSync(opsServerPath, 'utf-8');

    it('define e aplica funções de mascaramento para documento, e-mail, telefone e endereço', () => {
      expect(opsServerCode).toContain('mascararDocumento(c.documento');
      expect(opsServerCode).toContain('mascararEmail(c.email)');
      expect(opsServerCode).toContain('mascararTelefone(c.telefone)');
      expect(opsServerCode).toContain('mascararEndereco(enderecoCompleto)');
    });

    it('não expõe número e complemento em texto claro na resposta pública', () => {
      expect(opsServerCode).toContain("numero: ''");
      expect(opsServerCode).toContain("complemento: ''");
    });
  });

  describe('4. Preservação de dados de endereço e proteção contra sobrescrita com dados mascarados', () => {
    const opsServerPath = path.resolve(__dirname, '../../services/ops-server.ts');
    const opsServerCode = fs.readFileSync(opsServerPath, 'utf-8');

    it('não possui instrução para setar Numero = NULL ou Complemento = NULL', () => {
      expect(opsServerCode).not.toContain('Numero = NULL, Complemento = NULL');
    });

    it('descarta campos mascarados com *** no body de atualização para preservar dados reais no banco', () => {
      expect(opsServerCode).toContain("dados.documento.includes('***')");
      expect(opsServerCode).toContain("dados.email.includes('***')");
      expect(opsServerCode).toContain("dados.telefone.includes('***')");
      expect(opsServerCode).toContain("digitado.includes('***')");
    });
  });

  describe('5. Bloqueio de baterias vencidas', () => {
    const officePath = path.resolve(__dirname, '../../lib/ops/office.ts');
    const officeCode = fs.readFileSync(officePath, 'utf-8');

    it('removeu tolerância de -30 minutos em lib/ops/office.ts:426', () => {
      expect(officeCode).toContain('CASE WHEN b.Inicio < SYSDATETIME() THEN 1 ELSE 0 END passada');
      expect(officeCode).not.toContain('DATEADD(minute, -30, SYSDATETIME())');
    });

    it('filtra b.Inicio >= SYSDATETIME() em TOTEM_BATERIAS_SQL', () => {
      expect(TOTEM_BATERIAS_SQL).toContain('b.Inicio >= SYSDATETIME()');
    });

    it('bateriaDisponivelNoTotem rejeita baterias cujo horário de início já passou', () => {
      const bateriaPassada = {
        inicio: '2026-10-26T14:00:00',
        status: 'aberta',
        autoAtendimento: true,
        reservaFechada: false,
        livres: 10,
      };
      // Testando com agora = 14:05 (5 minutos após início)
      expect(bateriaDisponivelNoTotem(bateriaPassada, '2026-10-26', '2026-10-26T14:05:00')).toBe(false);

      // Testando com agora = 13:55 (5 minutos antes do início)
      expect(bateriaDisponivelNoTotem(bateriaPassada, '2026-10-26', '2026-10-26T13:55:00')).toBe(true);
    });
  });

  describe('6. Parametrização segura SQL em baterias do grupo', () => {
    const opsServerPath = path.resolve(__dirname, '../../services/ops-server.ts');
    const opsServerCode = fs.readFileSync(opsServerPath, 'utf-8');

    it('utiliza parâmetros @bat_ e @grp_ em vez de interpolação direta na query de baterias', () => {
      expect(opsServerCode).toContain('bat_${idx}');
      expect(opsServerCode).toContain('grp_${idx}');
      expect(opsServerCode).toContain('{ ...bParams, ...gParams }');
      expect(opsServerCode).not.toContain('i.BateriaId IN (${rows.map');
    });
  });

  describe('7. Estorno granular de vouchers', () => {
    const officePath = path.resolve(__dirname, '../../lib/ops/office.ts');
    const officeCode = fs.readFileSync(officePath, 'utf-8');

    it('estorna individualmente o VoucherUso vinculado ao item cancelado sem UPDATE em lote na venda', () => {
      expect(officeCode).toContain('UPDATE TOP (1) dbo.VoucherUso SET Estornado = 1 WHERE VendaId = @vendaId AND VoucherId = @voucherId AND Estornado = 0');
      expect(officeCode).not.toContain('UPDATE dbo.VoucherUso SET Estornado = 1 WHERE VendaId = @vendaId AND EXISTS');
    });
  });

  describe('8. Regras de cadastro flexíveis (Instagram e Peso)', () => {
    it('torna Instagram opcional retornando null para valores vazios', () => {
      expect(erroInstagramCliente('')).toBeNull();
      expect(erroInstagramCliente(null)).toBeNull();
      expect(erroInstagramCliente(undefined)).toBeNull();
      expect(erroInstagramCliente('   ')).toBeNull();
      expect(erroInstagramCliente('@piloto.oficial')).toBeNull();
      expect(erroInstagramCliente('invalido com espaco')).toContain('Instagram inválido');
    });

    it('harmoniza validação de peso para aceitar 10 <= peso <= 250', () => {
      expect(erroPesoCliente(10)).toBeNull();
      expect(erroPesoCliente(20)).toBeNull();
      expect(erroPesoCliente(85.5)).toBeNull();
      expect(erroPesoCliente(250)).toBeNull();

      expect(erroPesoCliente(9)).toContain('Peso inválido');
      expect(erroPesoCliente(250.5)).toContain('Peso inválido');
      expect(erroPesoCliente(0)).toContain('Peso inválido');
      expect(erroPesoCliente(-10)).toContain('Peso inválido');
      expect(erroPesoCliente('')).toContain('O peso é obrigatório');
    });
  });

  describe('9. Otimização de performance em /api/crono/uso-karts', () => {
    const opsServerPath = path.resolve(__dirname, '../../services/ops-server.ts');
    const opsServerCode = fs.readFileSync(opsServerPath, 'utf-8');

    it('utiliza coluna indexada KartNumero = @n em vez de expressão escalar', () => {
      expect(opsServerCode).toContain('WHERE KartNumero = @n');
      expect(opsServerCode).not.toContain('WHERE TRY_CAST(LTRIM(RTRIM(Kart)) AS int) = @n');
    });
  });

  describe('10. Estabilidade de runtime', () => {
    const opsServerPath = path.resolve(__dirname, '../../services/ops-server.ts');
    const opsServerCode = fs.readFileSync(opsServerPath, 'utf-8');
    const dbPath = path.resolve(__dirname, '../../lib/ops/db.ts');
    const dbCode = fs.readFileSync(dbPath, 'utf-8');

    it('registra listeners uncaughtException e unhandledRejection em ops-server.ts', () => {
      expect(opsServerCode).toContain("process.on('uncaughtException'");
      expect(opsServerCode).toContain("process.on('unhandledRejection'");
    });

    it('possui error listener no pool de conexões mssql em db.ts', () => {
      expect(dbCode).toContain("newPool.on('error'");
    });
  });
});
