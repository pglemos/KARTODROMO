import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  avaliarElegibilidadeVoucher,
  normalizarBeneficiariosInput,
  normalizarDocVoucher,
  resumirStatusVoucher,
} from '../lib/ops/vouchers';

const root = process.cwd();

describe('vouchers nominais, grupos e esgotamento automatico', () => {
  it('normaliza documentos e remove duplicidades por clienteId e CPF', () => {
    expect(normalizarDocVoucher('123.456.789-00')).toBe('12345678900');
    expect(normalizarDocVoucher('ab 1234')).toBe('AB1234');
    expect(normalizarDocVoucher('')).toBeNull();

    const lista = normalizarBeneficiariosInput([
      { clienteId: 10, nome: 'Ana Paula', documento: '111.222.333-44', usosMax: 2 },
      { clienteId: 10, nome: 'Ana Duplicada', documento: '11122233344', usosMax: 1 },
      { nome: 'Bruno Pre', documento: '555.666.777-88', telefone: '(31) 99999-1111' },
      { nome: 'Bruno Mesmo CPF', documento: '55566677788' },
      { nome: '', documento: '' },
    ]);

    expect(lista).toHaveLength(2);
    expect(lista[0]).toMatchObject({ clienteId: 10, nome: 'Ana Paula', documento: '11122233344', usosMax: 2 });
    expect(lista[1]).toMatchObject({ clienteId: null, nome: 'Bruno Pre', documento: '55566677788', usosMax: 1 });
  });

  it('calcula esgotamento por usoUnico, usoMaxTotal e cotas dos beneficiarios, reabrindo apos estorno', () => {
    const base = { ativo: true, fim: '2026-12-31', hoje: '2026-11-15' };

    expect(resumirStatusVoucher({ ...base, usoUnico: true, usoMaxTotal: null, usos: 0 })).toMatchObject({
      limiteTotal: 1,
      restantes: 1,
      esgotado: false,
      status: 'ativo',
    });
    expect(resumirStatusVoucher({ ...base, usoUnico: true, usoMaxTotal: null, usos: 1 })).toMatchObject({
      limiteTotal: 1,
      restantes: 0,
      esgotado: true,
      status: 'esgotado',
    });

    // Grupo de 3 pessoas com limite global 3
    expect(resumirStatusVoucher({ ...base, usoUnico: false, usoMaxTotal: 3, usos: 2 })).toMatchObject({
      limiteTotal: 3,
      restantes: 1,
      esgotado: false,
      status: 'ativo',
    });
    expect(resumirStatusVoucher({ ...base, usoUnico: false, usoMaxTotal: 3, usos: 3 })).toMatchObject({
      limiteTotal: 3,
      restantes: 0,
      esgotado: true,
      status: 'esgotado',
    });

    // Estorno/liberacao volta usos de 3 -> 2 e reabre saldo automaticamente
    expect(resumirStatusVoucher({ ...base, usoUnico: false, usoMaxTotal: 3, usos: 2 })).toMatchObject({
      restantes: 1,
      esgotado: false,
      status: 'ativo',
    });

    // Voucher restrito a 2 pessoas sem usoMaxTotal explícito esgota quando ambas consumiram suas cotas
    expect(resumirStatusVoucher({
      ...base,
      usoUnico: false,
      usoMaxTotal: null,
      restritoClientes: true,
      usos: 2,
      beneficiarios: [
        { usosMax: 1, usosFeitos: 1 },
        { usosMax: 1, usosFeitos: 1 },
      ],
    })).toMatchObject({
      limiteTotal: 2,
      restantes: 0,
      esgotado: true,
      status: 'esgotado',
    });

    // Expirado e inativo
    expect(resumirStatusVoucher({ ...base, fim: '2026-11-14', usoUnico: false, usos: 0 }).status).toBe('expirado');
    expect(resumirStatusVoucher({ ...base, ativo: false, usoUnico: false, usos: 0 }).status).toBe('inativo');
  });

  it('avalia elegibilidade nominal por clienteId e CPF e bloqueia apos esgotar cota ou limite total', async () => {
    const rowsMock = [
      { id: 1, voucherId: 77, clienteId: 101, nome: 'Carlos Silva', documento: '12345678900', telefone: null, usosMax: 1, observacao: null, usosFeitos: 0, ultimoUsoEm: null },
      { id: 2, voucherId: 77, clienteId: null, nome: 'Daniela Pre', documento: '98765432100', telefone: '31999990000', usosMax: 2, observacao: null, usosFeitos: 1, ultimoUsoEm: '2026-11-10T18:00' },
      { id: 3, voucherId: 77, clienteId: 103, nome: 'Eduardo Esgotado', documento: '55544433322', telefone: null, usosMax: 1, observacao: null, usosFeitos: 1, ultimoUsoEm: '2026-11-11T19:00' },
    ];
    const reader = async () => rowsMock;

    // 1) Bloqueia se limite global ja esgotou
    const esg = await avaliarElegibilidadeVoucher({
      voucherId: 77, usoUnico: false, usoMaxTotal: 2, usoMaxCliente: 1, restritoClientes: true,
      usosTotais: 2, usosClienteDirecto: 0, clienteId: 101, documento: '12345678900', reader,
    });
    expect(esg.ok).toBe(false);
    if (!esg.ok) expect(esg.esgotado).toBe(true);

    // 2) Exige identificacao quando restrito
    const semId = await avaliarElegibilidadeVoucher({
      voucherId: 77, usoUnico: false, usoMaxTotal: 5, usoMaxCliente: 1, restritoClientes: true,
      usosTotais: 2, usosClienteDirecto: 0, clienteId: null, documento: null, reader,
    });
    expect(semId.ok).toBe(false);
    if (!semId.ok) expect(semId.exigeIdentificacao).toBe(true);

    // 3) Rejeita CPF fora da lista
    const fora = await avaliarElegibilidadeVoucher({
      voucherId: 77, usoUnico: false, usoMaxTotal: 5, usoMaxCliente: 1, restritoClientes: true,
      usosTotais: 2, usosClienteDirecto: 0, clienteId: 999, documento: '00000000000', reader,
    });
    expect(fora.ok).toBe(false);

    // 4) Reconhece Daniela pre-cadastrada por CPF e solicita auto-vinculo com clienteId 505
    const porCpf = await avaliarElegibilidadeVoucher({
      voucherId: 77, usoUnico: false, usoMaxTotal: 5, usoMaxCliente: 1, restritoClientes: true,
      usosTotais: 2, usosClienteDirecto: 0, clienteId: 505, documento: '987.654.321-00', reader,
    });
    expect(porCpf).toMatchObject({
      ok: true,
      matchedVcId: 2,
      autoLinkClienteId: 505,
      beneficiarioNome: 'Daniela Pre',
      restantesPessoa: 1,
    });

    // 5) Bloqueia Eduardo que ja consumiu sua cota individual (1/1)
    const cotaEsg = await avaliarElegibilidadeVoucher({
      voucherId: 77, usoUnico: false, usoMaxTotal: 5, usoMaxCliente: 1, restritoClientes: true,
      usosTotais: 2, usosClienteDirecto: 1, clienteId: 103, documento: '55544433322', reader,
    });
    expect(cotaEsg.ok).toBe(false);
    if (!cotaEsg.ok) expect(cotaEsg.esgotado).toBe(true);
  });

  it('mantem contratos de UI e regra de Totem sem teclado na tela', () => {
    const adminVouchers = readFileSync(join(root, 'workers/admin/public/vouchers.js'), 'utf8');
    const adminApp = readFileSync(join(root, 'workers/admin/public/app.js'), 'utf8');
    const adminHtml = readFileSync(join(root, 'workers/admin/public/index.html'), 'utf8');
    const caixaCs = readFileSync(join(root, 'desktop/src/Kartodromo.Recepcao/Caixa.cs'), 'utf8');
    const cadCs = readFileSync(join(root, 'desktop/src/Kartodromo.Recepcao/Cadastros.cs'), 'utf8');
    const totemCs = readFileSync(join(root, 'desktop/src/Kartodromo.Autoatendimento/FormTotem.cs'), 'utf8');

    expect(adminApp).toContain("['vouchers', 'Vouchers', IC.voucher");
    expect(adminHtml).toContain('/vouchers.js');
    expect(adminVouchers).toContain('TELAS.vouchers');
    expect(adminVouchers).toContain('/vouchers/${');
    expect(adminVouchers).toContain('/clientes?q=');

    expect(cadCs).toContain('class FormVoucherClientes');
    expect(caixaCs).toContain('/api/office/vouchers/cliente?clienteId=');
    expect(caixaCs).toContain('&clienteId=');

    // Totem reconhece voucher automaticamente pelo CPF/cadastro sem campo ou teclado de digitacao de cupom
    expect(totemCs).toContain('/api/totem/vouchers-cliente?grupo=');
    expect(totemCs).toContain('vouchersReconhecidos');
    expect(totemCs).not.toContain('AplicarVoucher');
    expect(totemCs).not.toContain('_codVoucher');
  });
});
