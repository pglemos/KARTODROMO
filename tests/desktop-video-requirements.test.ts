import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');
const principal = read('desktop/src/Kartodromo.Recepcao/FormPrincipal.cs');
const grade = read('desktop/src/Kartodromo.Comum/Ui.cs');
const caixa = read('desktop/src/Kartodromo.Recepcao/Caixa.cs');
const crono = [
  read('desktop/src/Kartodromo.Cronometragem/FormCrono.cs'),
  read('desktop/src/Kartodromo.Cronometragem/FormCrono.AoVivo.cs'),
  read('desktop/src/Kartodromo.Cronometragem/FormCrono.Competidores.cs'),
].join('\n');
const servidor = read('services/timing-server.ts');
const liveGrid = read('desktop/src/Kartodromo.Cronometragem/LiveGrid.cs');
const gruposPassagens = read('desktop/src/Kartodromo.Cronometragem/GrupoPassagens.cs');

describe('correções solicitadas nos vídeos da operação', () => {
  it('expande o módulo selecionado para tornar os filtros de status visíveis', () => {
    expect(principal).toContain('if (e.Node.Level == 0 && e.Node.Nodes.Count > 0) e.Node.Expand();');
    expect(principal).toContain('reservas:aprovar');
    expect(principal).toContain('baterias:abertas');
  });

  it('oferece seleção de todas as linhas visíveis e não perde a primeira', () => {
    expect(grade).toContain('public void AlternarMarcacaoTodos()');
    expect(grade).toContain('Convert.ToBoolean(r.Cells["__sel"].Value ?? false)');
    expect(caixa).toContain('AlternarMarcacaoTodos');
    expect(caixa).toContain('Selecionar todas');
  });

  it('abre o ajuste de posição no duplo clique das grades de resultado', () => {
    expect(crono).toContain('EditarPosicao(s)');
    expect(crono).toContain('Nova posição (1 = líder; 0 = automática)');
    expect(crono).toContain('/position');
  });

  it('persiste a posição manual no servidor e no resultado atualizado', () => {
    expect(servidor).toContain('setManualPosition');
    expect(servidor).toContain("action === 'position'");
    expect(liveGrid).toContain('_hoverRow');
    expect(liveGrid).toContain('e.RowIndex % 2');
  });

  it('separa o registro de passagens por volta do líder com faixa cinza e divisor', () => {
    expect(liveGrid).toContain('public Func<int, bool> SeparadorAntes');
    expect(liveGrid).toContain('public Func<int, Color?> CorGrupo');
    expect(crono).toContain('_gPass.SeparadorAntes');
    expect(crono).toContain('_gPass.CorGrupo');
    expect(crono).toContain('GrupoPassagens.SepararGrupos(GrupoPassagemNaLinha(i), GrupoPassagemNaLinha(i - 1))');
    expect(gruposPassagens).toContain('PorVoltaDoLider');
  });
});
