import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ResumoTab } from '@/src/admin/modules/patrocinadores/ResumoTab';
import { periodosSobrepoem, valorMensal } from '@/src/admin/modules/patrocinadores/formatacao';
import type { Cobranca, Contrato, Espaco } from '@/src/admin/modules/patrocinadores/patrocinadores.types';

const espaco = (id: string, nome: string): Espaco => ({
  id, nome, tipo: 'outdoor', localizacao: null, dimensoes: null, descricao: null, valor_tabela: 0, foto_arquivo_id: null, ativo: true,
});

const contrato: Contrato = {
  id: 'c1', empresa_id: 'e1', espaco_id: 'o1', titulo: 'TESTE CODEX outdoor', status: 'ativo', valor: 3000, recorrencia: 'trimestral',
  dia_vencimento: 10, data_inicio: '2020-01-01', data_fim: null, renovacao_automatica: false, arte_arquivo_id: null,
  contrato_arquivo_id: null, observacoes: null, empresa_nome: 'TESTE CODEX Marca', espaco_nome: 'Outdoor 1', espaco_tipo: 'outdoor',
};

const atrasada: Cobranca = {
  id: 'b1', contrato_id: 'c1', parcela: 1, vencimento: '2020-02-10', valor: 3000, status: 'atrasado', pago_em: null,
  forma_pagamento: null, observacoes: null, contrato_titulo: 'x', empresa_id: 'e1', empresa_nome: 'TESTE CODEX Marca',
};

describe('patrocinadores', () => {
  it('resumo mostra receita mensal, atraso e ocupacao dos espacos', () => {
    const html = renderToStaticMarkup(
      <ResumoTab carregando={false} cobrancas={[atrasada]} contratos={[contrato]} espacos={[espaco('o1', 'Outdoor 1'), espaco('o2', 'Pódio')]} irPara={() => undefined} />,
    );
    expect(html).toContain('1 de 2');
    expect(html).toContain('1 cobrança(s) vencida(s)');
    expect(html).toContain('Ocupado');
    expect(html).toContain('Livre');
    expect(html.replace(/\s/g, ' ')).toMatch(/R\$\s1\.000,00/);
  });

  it('calcula valor mensal e conflito de vigencia', () => {
    expect(valorMensal(1200, 'anual')).toBe(100);
    expect(valorMensal(500, 'unico')).toBe(0);
    expect(periodosSobrepoem({ data_inicio: '2026-01-01', data_fim: '2026-06-30' }, { data_inicio: '2026-06-30', data_fim: null })).toBe(true);
    expect(periodosSobrepoem({ data_inicio: '2026-01-01', data_fim: '2026-06-29' }, { data_inicio: '2026-06-30', data_fim: null })).toBe(false);
  });
});
