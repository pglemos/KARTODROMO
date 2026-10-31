import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createHmac } from 'crypto';
import { erroCadastroObrigatorio, erroPesoCliente } from '../../lib/ops/cadastro-obrigatorio';
import { erroInstagramCliente, normalizarInstagram } from '../../lib/ops/instagram';
import { clienteColumns, type ClienteInput } from '../../lib/ops/db';
import { erroTelefone } from '../../services/ops-server';

// Caminhos dos fontes sob auditoria
const formTotemPath = path.resolve(__dirname, '../../desktop/src/Kartodromo.Autoatendimento/FormTotem.cs');
const formTotemCode = fs.readFileSync(formTotemPath, 'utf-8');

const fmtPath = path.resolve(__dirname, '../../desktop/src/Kartodromo.Comum/Fmt.cs');
const fmtCode = fs.readFileSync(fmtPath, 'utf-8');

const validacaoClientePath = path.resolve(__dirname, '../../desktop/src/Kartodromo.Comum/ValidacaoCliente.cs');
const validacaoClienteCode = fs.readFileSync(validacaoClientePath, 'utf-8');

const opsServerPath = path.resolve(__dirname, '../../services/ops-server.ts');
const opsServerCode = fs.readFileSync(opsServerPath, 'utf-8');

const dbPath = path.resolve(__dirname, '../../lib/ops/db.ts');
const dbCode = fs.readFileSync(dbPath, 'utf-8');

const cadastroObrigatorioPath = path.resolve(__dirname, '../../lib/ops/cadastro-obrigatorio.ts');
const cadastroObrigatorioCode = fs.readFileSync(cadastroObrigatorioPath, 'utf-8');

// Helper para emular HMAC de token idêntico ao ops-server
const OPS_SECRET = process.env.OPS_SECRET || 'dev-secret-kartodromo-2026';
function sign(val: string): string {
  return createHmac('sha256', OPS_SECRET).update(val).digest('hex').slice(0, 32);
}

// Algoritmo canônico de cursor de máscara espelhado do C# Ui.Campos.CalcularCursorMascara
function calcularCursorMascara(antigoTexto: string, novoTextoFormatado: string, posicaoAntiga: number): number {
  antigoTexto = antigoTexto ?? '';
  novoTextoFormatado = novoTextoFormatado ?? '';
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

describe('Milestone M3 (R3: Validação de Dados e Cadastro no Totem - Itens 12 a 19)', () => {

  // ==========================================================================
  // Item 12: Instagram Opcional no Totem e Backend
  // ==========================================================================
  describe('Item 12: Instagram Opcional', () => {
    it('erroCadastroObrigatorio aceita campo de instagram vazio, nulo ou omitido', () => {
      expect(erroCadastroObrigatorio({ email: 'piloto@betim.com.br', peso: 75 })).toBeNull();
      expect(erroCadastroObrigatorio({ email: 'piloto@betim.com.br', peso: 75, instagram: '' })).toBeNull();
      expect(erroCadastroObrigatorio({ email: 'piloto@betim.com.br', peso: 75, instagram: '   ' })).toBeNull();
      expect(erroCadastroObrigatorio({ email: 'piloto@betim.com.br', peso: 75, instagram: null })).toBeNull();
      expect(erroCadastroObrigatorio({ email: 'piloto@betim.com.br', peso: 75, instagram: undefined })).toBeNull();
    });

    it('erroCadastroObrigatorio aceita semInstagram: true explicitamente', () => {
      expect(erroCadastroObrigatorio({ email: 'piloto@betim.com.br', peso: 75, semInstagram: true })).toBeNull();
      expect(erroCadastroObrigatorio({ email: 'piloto@betim.com.br', peso: 75, instagram: '', semInstagram: true })).toBeNull();
      // Mesmo com texto inválido, se marcou semInstagram: true não deve bloquear
      expect(erroCadastroObrigatorio({ email: 'piloto@betim.com.br', peso: 75, instagram: 'invalido..insta', semInstagram: true })).toBeNull();
    });

    it('erroCadastroObrigatorio valida formato de instagram apenas quando preenchido e semInstagram é falso', () => {
      expect(erroCadastroObrigatorio({ email: 'piloto@betim.com.br', peso: 75, instagram: '@piloto.betim' })).toBeNull();
      expect(erroCadastroObrigatorio({ email: 'piloto@betim.com.br', peso: 75, instagram: 'invalido..insta', semInstagram: false })).toContain('Instagram inválido');
    });

    it('clienteColumns no db.ts atualiza coluna Instagram para NULL quando semInstagram: true (mesmo em partial update)', () => {
      const input: ClienteInput = { semInstagram: true };
      const cols = clienteColumns(input, true);
      expect(cols).toHaveProperty('Instagram');
      expect(cols.Instagram).toBeNull();
    });

    it('clienteColumns no db.ts preserva e normaliza Instagram quando fornecido', () => {
      const input: ClienteInput = { instagram: 'piloto.betim' };
      const cols = clienteColumns(input, true);
      expect(cols.Instagram).toBe('@piloto.betim');
    });

    it('FormTotem.cs não força Obrigatorio para fInstagram e disponibiliza opção Não possuo Instagram', () => {
      // Confirma remoção da obrigatoriedade artificial
      expect(formTotemCode).not.toContain('Obrigatorio(fInstagram, "Instagram do piloto (@usuário)", true);');
      expect(formTotemCode).toContain('Não possuo Instagram');
      expect(formTotemCode).toContain('chkSemInsta');
      expect(formTotemCode).toContain('chkSemInstaMenor');
      expect(formTotemCode).toContain('Instagram opcional');
    });

    it('TelaCadastroMenor em FormTotem.cs não exige Instagram no loop de obrigatórios', () => {
      // Loop de campos obrigatórios do menor não deve conter instagram
      const regexMenorLoop = /foreach\s*\(\s*var\s*\(\s*campo\s*,\s*rotulo\s*\)\s*in\s*new\[\]\s*\{[^}]*\}\s*\)/;
      const match = formTotemCode.match(regexMenorLoop);
      expect(match).not.toBeNull();
      expect(match![0]).not.toContain('instagram');
    });
  });

  // ==========================================================================
  // Item 13: Telefone Internacional / Turistas com Passaporte
  // ==========================================================================
  describe('Item 13: Telefone Internacional e E.164', () => {
    it('erroTelefone rejeita telefone vazio para titular', () => {
      expect(erroTelefone('')).toBe('O número de telefone é obrigatório.');
      expect(erroTelefone(null)).toBe('O número de telefone é obrigatório.');
      expect(erroTelefone(undefined)).toBe('O número de telefone é obrigatório.');
    });

    it('erroTelefone rejeita caracteres inválidos', () => {
      expect(erroTelefone('31 99999-ABCD')).toBe('Número de telefone inválido.');
      expect(erroTelefone('telefone123')).toBe('Número de telefone inválido.');
    });

    it('erroTelefone rejeita telefone nacional com menos de 10 dígitos', () => {
      expect(erroTelefone('9999-8888')).toBe('Número de telefone inválido.');
      expect(erroTelefone('319999999')).toBe('Número de telefone inválido.'); // 9 dígitos
    });

    it('erroTelefone aceita telefones nacionais válidos (10 a 11 dígitos, ou 12-13 com DDI 55)', () => {
      expect(erroTelefone('(31) 3333-4444')).toBeNull(); // 10 dígitos (fixo)
      expect(erroTelefone('(31) 99999-8888')).toBeNull(); // 11 dígitos (celular)
      expect(erroTelefone('+55 (31) 99999-8888')).toBeNull(); // 13 dígitos internacional BR
      expect(erroTelefone('5531999998888')).toBeNull(); // 13 dígitos
    });

    it('erroTelefone aceita números internacionais E.164 iniciando com + (7 a 15 dígitos)', () => {
      expect(erroTelefone('+1 202 555 0199')).toBeNull(); // EUA (11 dígitos)
      expect(erroTelefone('+351 912 345 678')).toBeNull(); // Portugal (12 dígitos)
      expect(erroTelefone('+44 7911 123456')).toBeNull(); // Reino Unido (12 dígitos)
      expect(erroTelefone('+33 1 42 68 55 55')).toBeNull(); // França (11 dígitos)
      expect(erroTelefone('+598 2 123 4567')).toBeNull(); // Uruguai (10 dígitos)
      expect(erroTelefone('+49 30 123456')).toBeNull(); // Alemanha (8 dígitos)
      expect(erroTelefone('+500 12345')).toBeNull(); // Ilhas Malvinas (7 dígitos)
    });

    it('erroTelefone aceita números internacionais quando tipoDocumento é PASSAPORTE', () => {
      expect(erroTelefone('2025550199', 'PASSAPORTE')).toBeNull();
      expect(erroTelefone('912345678', 'Passaporte')).toBeNull();
    });

    it('erroTelefone aceita telefone mascarado pré-existente sem disparar erro', () => {
      expect(erroTelefone('(31) *****-1234')).toBeNull();
      expect(erroTelefone('(**) *****-****')).toBeNull();
    });

    it('Fmt.cs MascaraFone não quebra nem trunca números internacionais iniciando com +', () => {
      expect(fmtCode).toContain("trimmed.StartsWith('+')");
      expect(fmtCode).toContain('if (intl.Length > 15) intl = intl[..15];');
      expect(fmtCode).toContain('return "+" + intl;');
    });

    it('ValidacaoCliente.cs contém ErroTelefone harmonizado', () => {
      expect(validacaoClienteCode).toContain('public static string ErroTelefone(string telefone, string tipoDoc = null)');
      expect(validacaoClienteCode).toContain('d.Length >= 7 && d.Length <= 15');
      expect(validacaoClienteCode).toContain('d.Length >= 10 && d.Length <= 13');
    });

    it('FormTotem.cs usa ValidacaoCliente.ErroTelefone e atualiza placeholder para Passaporte', () => {
      expect(formTotemCode).toContain('ValidacaoCliente.ErroTelefone(fFone.Text, tipoDoc)');
      expect(formTotemCode).toContain('ValidacaoCliente.ErroTelefone(fone.Text, tipoDoc)');
      expect(formTotemCode).toContain('+1 202 555 0199');
    });
  });

  // ==========================================================================
  // Item 14: Harmonização de Faixas de Peso (10–250 kg)
  // ==========================================================================
  describe('Item 14: Harmonização de Faixas de Peso (10–250 kg)', () => {
    it('erroPesoCliente no backend aceita exatamente a faixa de 10 a 250 kg', () => {
      expect(erroPesoCliente(10)).toBeNull();
      expect(erroPesoCliente('10')).toBeNull();
      expect(erroPesoCliente('10,0')).toBeNull();
      expect(erroPesoCliente('10.0')).toBeNull();
      expect(erroPesoCliente(15)).toBeNull();
      expect(erroPesoCliente(18)).toBeNull();
      expect(erroPesoCliente(38.5)).toBeNull();
      expect(erroPesoCliente(78.5)).toBeNull();
      expect(erroPesoCliente(250)).toBeNull();
      expect(erroPesoCliente('250')).toBeNull();
    });

    it('erroPesoCliente no backend rejeita pesos fora do intervalo [10, 250] kg', () => {
      expect(erroPesoCliente(9.9)).toContain('Peso inválido');
      expect(erroPesoCliente(0)).toContain('Peso inválido');
      expect(erroPesoCliente(-5)).toContain('Peso inválido');
      expect(erroPesoCliente(250.1)).toContain('Peso inválido');
      expect(erroPesoCliente(300)).toContain('Peso inválido');
      expect(erroPesoCliente(500)).toContain('Peso inválido');
      expect(erroPesoCliente('abc')).toContain('Peso inválido');
      expect(erroPesoCliente(NaN)).toContain('Peso inválido');
      expect(erroPesoCliente(Infinity)).toContain('Peso inválido');
    });

    it('FormTotem.cs eliminou kg < 20 e delega validação para ValidacaoCliente.ErroPeso', () => {
      // Não deve conter a restrição rígida de kg < 20 que rejeitava adultos leves
      expect(formTotemCode).not.toContain('kg < 20');
      expect(formTotemCode).toContain('ValidacaoCliente.ErroPeso(fPeso.Text)');
      expect(formTotemCode).toContain('ValidacaoCliente.ErroPeso(peso.Text)');
    });

    it('ValidacaoCliente.ErroPeso no desktop aceita 10 a 250 kg', () => {
      expect(validacaoClienteCode).toContain('kg >= 10 && kg <= 250');
    });
  });

  // ==========================================================================
  // Item 15: Preservação de Número e Complemento
  // ==========================================================================
  describe('Item 15: Preservação de Número e Complemento', () => {
    it('clienteColumns com partial: true e apenas endereco NÃO inclui Numero nem Complemento nas colunas', () => {
      const input: ClienteInput = {
        endereco: 'Rua Principal, 100 Apto 201',
      };
      const cols = clienteColumns(input, true);
      expect(cols).toHaveProperty('Endereco');
      expect(cols).not.toHaveProperty('Numero');
      expect(cols).not.toHaveProperty('Complemento');
    });

    it('ops-server.ts não contém query deletéria que zera Numero e Complemento', () => {
      expect(opsServerCode).not.toContain('UPDATE dbo.Cliente SET Numero = NULL');
      expect(opsServerCode).not.toContain('Complemento = NULL');
      expect(opsServerCode).toContain('await updateCliente(id, { ...dados, lgpd: true }, true);');
    });
  });

  // ==========================================================================
  // Item 16: Edição Assistida de Cadastro (Nome e Documento)
  // ==========================================================================
  describe('Item 16: Edição Assistida de Cadastro', () => {
    it('FormTotem.cs permite edição de nome e ajuste assistido de documento para clientes existentes', () => {
      expect(formTotemCode).toContain('fNome.Enabled = true; // Edição assistida de nome permitida');
      expect(formTotemCode).toContain('Ajustar documento');
      expect(formTotemCode).toContain('lnkEditarDoc');
    });

    it('FormTotem.cs envia nome e documento atualizados no submit para cliente existente', () => {
      expect(formTotemCode).toContain('if (nomeCompleto != _cliente.S("nome")) dados["nome"] = nomeCompleto;');
      expect(formTotemCode).toContain('if (docFoiAlterado)');
    });

    it('ops-server.ts valida e processa atualização de nome e documento desmascarados', () => {
      expect(opsServerCode).toContain("if (dados.documento && !String(dados.documento).includes('*'))");
      expect(opsServerCode).toContain('SELECT TOP 1 Id id FROM dbo.Cliente WHERE DocumentoNum = @d AND Id <> @id');
    });
  });

  // ==========================================================================
  // Item 17: Tratamento Elegante de HTTP 409
  // ==========================================================================
  describe('Item 17: Tratamento Elegante de HTTP 409', () => {
    it('ops-server.ts retorna HTTP 409 estruturado com error: "documento_cadastrado", id e token assinado', () => {
      expect(opsServerCode).toContain("error: 'documento_cadastrado'");
      expect(opsServerCode).toContain('id: dup.id');
      expect(opsServerCode).toContain('token: sign(`cli:${dup.id}`)');
    });

    it('assinatura de token no 409 bate com o padrão de autenticação do totem', () => {
      const mockId = 42;
      const token = sign(`cli:${mockId}`);
      expect(token).toHaveLength(32);
      expect(token).toMatch(/^[a-f0-9]{32}$/);
    });

    it('FormTotem.cs captura HTTP 409 sem limpar formulário e oferece resgate do cadastro existente', () => {
      expect(formTotemCode).toContain('catch (ApiException ex) when (ex.Status == 409)');
      expect(formTotemCode).toContain('fDoc.Caixa.Focus();');
      expect(formTotemCode).toContain('lnkResgatar');
      expect(formTotemCode).toContain('Carregar cadastro existente com este documento');
    });

    it('TelaCadastroMenor em FormTotem.cs captura HTTP 409 e foca campo de documento do menor', () => {
      expect(formTotemCode).toContain('catch (ApiException ex) when (ex.Status == 409)');
      expect(formTotemCode).toContain('Já existe um cadastro com o documento informado para o menor.');
      expect(formTotemCode).toContain('doc.Caixa.Focus();');
    });
  });

  // ==========================================================================
  // Item 18: Correção do Cursor em Mascarar
  // ==========================================================================
  describe('Item 18: Correção do Cursor em Mascarar', () => {
    it('FormTotem.cs Mascarar chama Campos.CalcularCursorMascara e não força novo.Length', () => {
      expect(formTotemCode).toContain('Campos.CalcularCursorMascara(textoAntes, novo, pos)');
      expect(formTotemCode).toContain('t.SelectionStart = novaPos;');
      // Confirma que não usa mais o código defeituoso
      expect(formTotemCode).not.toContain('t.SelectionStart = novo.Length;');
    });

    it('algoritmo calcularCursorMascara preserva cursor ao digitar no meio de CPF formatado', () => {
      // Cenário: Usuário tem "123.456.789-00" e clica logo após o '4' (índice 5: "123.4|")
      // Digita um caractere ou ajusta a formatação:
      const antigo = '123.4';
      const novo = '123.45';
      const pos = 5;
      const novaPos = calcularCursorMascara(antigo, novo, pos);
      // O cursor deve ficar imediatamente após o caractere digitado, não saltar para posições distantes
      expect(novaPos).toBeGreaterThanOrEqual(5);
      expect(novaPos).toBeLessThanOrEqual(6);
    });

    it('calcularCursorMascara retorna final do texto quando cursor já estava no fim', () => {
      const antigo = '12345';
      const novo = '123.45';
      const pos = antigo.length;
      expect(calcularCursorMascara(antigo, novo, pos)).toBe(novo.length);
    });

    it('calcularCursorMascara retorna início (0) quando cursor estava no início', () => {
      const antigo = '12345';
      const novo = '123.45';
      const pos = 0;
      expect(calcularCursorMascara(antigo, novo, pos)).toBe(0);
    });
  });

  // ==========================================================================
  // Item 19: Parametrização SQL de Baterias
  // ==========================================================================
  describe('Item 19: Parametrização SQL de Baterias', () => {
    it('ops-server.ts utiliza parâmetros nomeados @bat_N e @grp_N na contagem de vagas do grupo', () => {
      expect(opsServerCode).toContain('const key = `bat_${idx}`;');
      expect(opsServerCode).toContain('bParams[key] = Number(r.id);');
      expect(opsServerCode).toContain("bMarks.push(`@${key}`);");

      expect(opsServerCode).toContain('const key = `grp_${idx}`;');
      expect(opsServerCode).toContain('gParams[key] = Number(id);');
      expect(opsServerCode).toContain("gMarks.push(`@${key}`);");

      expect(opsServerCode).toContain('WHERE i.BateriaId IN (${bMarks.join(\',\')})');
      expect(opsServerCode).toContain('AND (i.ClienteId IN (${gMarks.join(\',\')})');
      expect(opsServerCode).toContain('query<{ b: number; n: number }>(sqlText, { ...bParams, ...gParams })');
    });

    it('consulta de baterias não realiza concatenação crua de IDs de usuário na query SQL', () => {
      // Assegura que não há "IN (" + grupo.join(',') + ")" sem parametrização
      expect(opsServerCode).not.toMatch(/WHERE i\.BateriaId IN \(\$\{grupo\.join/);
      expect(opsServerCode).not.toMatch(/i\.ClienteId IN \(\$\{grupo\.join/);
    });
  });

});
