/** Conquistas da conta: resumo (quantas, total, %) e as conquistas por grupo, cada uma com progresso real. */
import { Text, View } from 'react-native';

import { Icon } from '../components/brand';
import { Aviso, Barra, Bloco, TelaCarreira, useMinhaCarreira } from '../components/carreira-kit';
import { useUi } from '../components/theme';
import { conquistasDe, type Conquista } from '../features/ranking/gamificacao';

const ICONE: Record<Conquista['icone'], 'flag' | 'trophy' | 'medal' | 'bolt' | 'target' | 'fire' | 'crown' | 'star'> = {
  flag: 'flag', trophy: 'trophy', medal: 'medal', bolt: 'bolt', target: 'target', fire: 'fire', crown: 'crown', star: 'star',
};
const GRUPOS: Conquista['grupo'][] = ['Desempenho', 'Vitórias', 'Experiência', 'Especiais'];

export default function MinhasConquistas() {
  const { palette } = useUi();
  const { dados, erro, carregando, carregar } = useMinhaCarreira();
  if (!dados) return <TelaCarreira titulo="Conquistas" carregando={carregando} onRefresh={carregar}>{erro ? <Aviso texto={erro} /> : null}</TelaCarreira>;
  const todas = conquistasDe(dados);
  const feitas = todas.filter((c) => c.liberada).length;
  return (
    <TelaCarreira titulo="Conquistas" onRefresh={carregar}>
      <Bloco titulo="Progresso" index={0}>
        <View style={{ flexDirection: 'row' }}>
          {[[feitas, 'Conquistadas', palette.text], [todas.length, 'Total', palette.text], [`${Math.round((feitas / todas.length) * 100)}%`, 'Completo', palette.neonGreen]].map(([v, r, cor]) => (
            <View key={String(r)} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: String(cor), fontSize: 28, fontWeight: '900' }}>{v}</Text>
              <Text style={{ color: palette.textMuted, fontSize: 11, fontWeight: '700' }}>{String(r).toUpperCase()}</Text>
            </View>
          ))}
        </View>
        <Barra valor={feitas / todas.length} cor={palette.neonGreen} />
      </Bloco>
      {GRUPOS.map((g, gi) => (
        <Bloco key={g} titulo={g} index={gi + 1}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {todas.filter((c) => c.grupo === g).map((c) => (
              <View key={c.id} accessible accessibilityLabel={`${c.nome}: ${c.descricao}. ${c.liberada ? 'Conquistada' : `${c.atual} de ${c.meta}`}`}
                style={{ width: '47%', flexGrow: 1, borderRadius: 16, borderWidth: 1.5, borderColor: c.liberada ? c.cor : palette.border, backgroundColor: palette.surfaceElevated, padding: 12, gap: 6, opacity: c.liberada ? 1 : 0.85 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.liberada ? c.cor : palette.surface, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={ICONE[c.icone]} color={c.liberada ? '#FFFFFF' : palette.textMuted} size={18} />
                  </View>
                  <Text numberOfLines={2} style={{ flex: 1, color: palette.text, fontWeight: '900', fontSize: 14 }}>{c.nome}</Text>
                </View>
                <Text style={{ color: palette.textMuted, fontSize: 12, lineHeight: 16 }}>{c.descricao}</Text>
                {c.liberada ? <Text style={{ color: c.cor, fontSize: 12, fontWeight: '900' }}>CONCLUÍDA ✓</Text> : (
                  <>
                    <Text style={{ color: palette.textSecondary, fontSize: 12, fontVariant: ['tabular-nums'] }}>{c.atual.toLocaleString('pt-BR')}/{c.meta.toLocaleString('pt-BR')}</Text>
                    <Barra valor={c.atual / c.meta} cor={c.cor} altura={5} />
                  </>
                )}
              </View>
            ))}
          </View>
        </Bloco>
      ))}
    </TelaCarreira>
  );
}
