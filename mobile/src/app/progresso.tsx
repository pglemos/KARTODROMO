/**
 * Meu progresso: categoria e XP, todos os números da carreira, eficiência, corridas com grid cheio (10+ pilotos),
 * roadmap para alcançar quem está acima e o líder, e comparação com qualquer piloto (por posição ou nome).
 */
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Aviso, Barra, Bloco, Numero, TelaCarreira, useMinhaCarreira } from '../components/carreira-kit';
import { tap } from '../components/motion';
import { useUi } from '../components/theme';
import { rankingApi, type VizinhoXp } from '../features/ranking/api';
import { categoriaDe, conquistasDe, nomeBonito, XP_REGRAS, xpDe } from '../features/ranking/gamificacao';

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export default function Progresso() {
  const { palette } = useUi();
  const { dados, erro, carregando, carregar } = useMinhaCarreira();
  const [posicoes, setPosicoes] = useState('5');
  const [nome, setNome] = useState('');
  const [busca, setBusca] = useState<VizinhoXp[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  if (!dados) return <TelaCarreira titulo="Meu progresso" carregando={carregando} onRefresh={carregar}>{erro ? <Aviso texto={erro} /> : null}</TelaCarreira>;

  const xp = xpDe(dados);
  const cat = categoriaDe(xp);
  const e = dados.estatisticas;
  const conq = conquistasDe(dados);
  const c = dados.comparativo;
  const xpPorBateria = dados.baterias ? xp / dados.baterias : XP_REGRAS.bateria;
  const alvos = [c?.acima ? { rotulo: 'Competidor acima', v: c.acima, cor: '#B91C1C' } : null, c?.lider ? { rotulo: 'Líder do ranking', v: c.lider, cor: '#B45309' } : null].filter(Boolean) as { rotulo: string; v: VizinhoXp; cor: string }[];
  const n = Math.max(1, Math.min(10, Number(posicoes) || 1));
  const comparado = c?.acimaLista?.[n - 1] ?? null;

  const procurar = async () => {
    if (nome.trim().length < 3) return;
    setBuscando(true);
    try { setBusca((await rankingApi.buscar(nome.trim())).pilotos); } catch { setBusca([]); } finally { setBuscando(false); }
  };

  return (
    <TelaCarreira titulo="Meu progresso" onRefresh={carregar}>
      <Bloco titulo="Seu nível" index={0}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
          <Text style={{ color: cat.cor, fontSize: 30, fontWeight: '900' }}>{cat.nome}</Text>
          <Text style={{ flex: 1, textAlign: 'right', color: palette.text, fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{xp.toLocaleString('pt-BR')} XP</Text>
        </View>
        <Barra valor={cat.progresso} cor={cat.cor} altura={10} />
        <Text style={{ color: palette.textMuted, fontSize: 13 }}>{cat.proxima ? `faltam ${(cat.proxima.desde - xp).toLocaleString('pt-BR')} XP para ${cat.proxima.nome}` : 'categoria máxima'}{c ? ` · ${c.pos.toLocaleString('pt-BR')}º de ${c.de.toLocaleString('pt-BR')} no ranking de XP` : ''}</Text>
        <Pressable onPress={() => { tap(); router.push('/minhas-conquistas' as Href); }} accessibilityRole="button" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {conq.filter((x) => x.liberada).map((x) => <View key={x.id} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: x.cor }} accessibilityLabel={x.nome} />)}
          <Text style={{ color: palette.textSecondary, fontSize: 13, alignSelf: 'center', marginLeft: 4 }}>{conq.filter((x) => x.liberada).length}/{conq.length} conquistas ›</Text>
        </Pressable>
      </Bloco>

      <Bloco titulo="Números da carreira" index={1}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Numero valor={dados.baterias} rotulo="Baterias" />
          <Numero valor={dados.corridas} rotulo="Corridas" />
          <Numero valor={dados.vitorias} rotulo="Vitórias" cor="#F59E0B" />
          <Numero valor={dados.podios} rotulo="Pódios" cor="#F97316" />
          <Numero valor={dados.poles} rotulo="Poles" cor="#22C55E" />
          <Numero valor={dados.voltasMaisRapidas} rotulo="Voltas mais rápidas" cor="#A855F7" />
          <Numero valor={dados.voltas} rotulo="Voltas" />
          {e ? <Numero valor={e.classificatorias} rotulo="Tomadas de tempo" /> : null}
          {e ? <Numero valor={e.treinos} rotulo="Treinos e baterias livres" /> : null}
          {e ? <Numero valor={e.noturnas} rotulo="Depois das 18h" /> : null}
          {e ? <Numero valor={e.tracadosDiferentes} rotulo="Traçados diferentes" /> : null}
          {e ? <Numero valor={e.maiorSequenciaVitorias} rotulo="Maior sequência de vitórias" /> : null}
        </View>
      </Bloco>

      <Bloco titulo="Eficiência" index={2}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Numero valor={pct(dados.vitorias, dados.corridas)} sufixo="%" rotulo="Taxa de vitória" cor="#22C55E" />
          <Numero valor={pct(dados.podios, dados.corridas)} sufixo="%" rotulo="Taxa de pódio" cor="#F97316" />
          <Numero valor={pct(dados.poles, e?.classificatorias ?? 0)} sufixo="%" rotulo="Poles por tomada" cor="#22C55E" />
          <Numero valor={pct(dados.voltasMaisRapidas, e?.comTempo ?? dados.baterias)} sufixo="%" rotulo="Voltas mais rápidas" cor="#A855F7" />
        </View>
        <Text style={{ color: palette.textMuted, fontSize: 12 }}>Taxas sobre as corridas e tomadas de tempo com resultado. Baterias antigas sem tempo (fev/2025 a abr/2026) contam só como presença.</Text>
      </Bloco>

      {e?.cheias.corridas ? (
        <Bloco titulo="Corridas com grid cheio (10+ pilotos)" index={3}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Numero valor={e.cheias.corridas} rotulo="Corridas" />
            <Numero valor={e.cheias.vitorias} rotulo="Vitórias" cor="#F59E0B" />
            <Numero valor={e.cheias.podios} rotulo="Pódios" cor="#F97316" />
          </View>
        </Bloco>
      ) : null}

      {alvos.map((a, i) => {
        const falta = Math.max(0, a.v.xp - xp + 1);
        return (
          <Bloco key={a.rotulo} titulo={`Roadmap · como alcançar ${a.rotulo.toLowerCase()}`} index={4 + i}>
            <Pressable onPress={() => { tap(); router.push(`/piloto/${a.v.id}` as Href); }} accessibilityRole="button" style={{ backgroundColor: a.cor, borderRadius: 16, padding: 14 }}>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '800' }}>{a.rotulo.toUpperCase()}</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '900' }}>{nomeBonito(a.v.nome)} · {a.v.xp.toLocaleString('pt-BR')} XP</Text>
            </Pressable>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Numero valor={falta} rotulo="XP necessário" cor="#EF4444" />
              <Numero valor={Math.ceil(falta / (XP_REGRAS.bateria + XP_REGRAS.podio + XP_REGRAS.vitoria))} rotulo="Vitórias necessárias" cor="#F59E0B" />
              <Numero valor={Math.ceil(falta / (XP_REGRAS.bateria + XP_REGRAS.podio))} rotulo="Pódios necessários" cor="#F97316" />
              <Numero valor={Math.ceil(falta / xpPorBateria)} rotulo="Baterias no seu ritmo" />
            </View>
          </Bloco>
        );
      })}

      {c ? (
        <Bloco titulo="Comparação personalizada" index={6}>
          <Text style={{ color: palette.textSecondary, fontSize: 13 }}>Comparar com quem está X posições acima (até 10)</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput value={posicoes} onChangeText={(t) => setPosicoes(t.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" accessibilityLabel="Posições acima"
              style={{ flex: 1, backgroundColor: palette.surfaceElevated, color: palette.text, borderRadius: 12, padding: 12, fontSize: 18, fontWeight: '800', textAlign: 'center' }} />
          </View>
          {comparado ? (
            <Pressable onPress={() => { tap(); router.push(`/piloto/${comparado.id}` as Href); }} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surfaceElevated, borderRadius: 14, padding: 12, gap: 10 }}>
              <Text style={{ color: palette.textMuted, fontWeight: '900', width: 52 }}>{(c.pos - n).toLocaleString('pt-BR')}º</Text>
              <Text numberOfLines={1} style={{ flex: 1, color: palette.text, fontWeight: '800' }}>{nomeBonito(comparado.nome)}</Text>
              <Text style={{ color: '#EF4444', fontWeight: '900', fontVariant: ['tabular-nums'] }}>-{(comparado.xp - xp).toLocaleString('pt-BR')} XP</Text>
            </Pressable>
          ) : <Text style={{ color: palette.textMuted }}>Não há piloto {n} posições acima.</Text>}
          <Text style={{ color: palette.textSecondary, fontSize: 13, marginTop: 6 }}>Pesquisar piloto por nome</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput value={nome} onChangeText={setNome} placeholder="Nome do piloto" placeholderTextColor={palette.textMuted} onSubmitEditing={procurar} returnKeyType="search" accessibilityLabel="Nome do piloto"
              style={{ flex: 1, backgroundColor: palette.surfaceElevated, color: palette.text, borderRadius: 12, padding: 12, fontSize: 16 }} />
            <Pressable onPress={() => { tap(); void procurar(); }} accessibilityRole="button" style={{ backgroundColor: palette.accent, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' }}>
              <Text style={{ color: '#000000', fontWeight: '900' }}>{buscando ? '…' : 'Buscar'}</Text>
            </Pressable>
          </View>
          {busca?.length === 0 ? <Text style={{ color: palette.textMuted }}>Nenhum piloto encontrado.</Text> : null}
          {busca?.map((p) => (
            <Pressable key={p.id} onPress={() => { tap(); router.push(`/piloto/${p.id}` as Href); }} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surfaceElevated, borderRadius: 14, padding: 12, gap: 10 }}>
              <Text numberOfLines={1} style={{ flex: 1, color: palette.text, fontWeight: '800' }}>{nomeBonito(p.nome)}</Text>
              <Text style={{ color: p.xp > xp ? '#EF4444' : '#22C55E', fontWeight: '900', fontVariant: ['tabular-nums'] }}>{p.xp > xp ? '-' : '+'}{Math.abs(p.xp - xp).toLocaleString('pt-BR')} XP</Text>
            </Pressable>
          ))}
        </Bloco>
      ) : null}
    </TelaCarreira>
  );
}
