/**
 * Karts do dia: como cada kart andou no último dia de pista. Grade colorida do mais rápido (verde) ao mais lento
 * (vermelho) e, em lista, a melhor volta, a melhor posição e cada bateria do kart (hora, posição, piloto, tempo).
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Aviso, Bloco, TelaCarreira } from '../components/carreira-kit';
import { tap } from '../components/motion';
import { useUi } from '../components/theme';
import { formatarDia, formatarVolta, rankingApi, type KartDoDia } from '../features/ranking/api';
import { nomeBonito } from '../features/ranking/gamificacao';

const MODOS = ['Melhor volta', 'Melhor posição', 'Número'] as const;
/** verde → amarelo → vermelho pela posição relativa (0 = melhor) */
const corDe = (f: number) => `hsl(${Math.round(120 - Math.max(0, Math.min(1, f)) * 120)}, 75%, 45%)`;
const hora = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

export default function Karts() {
  const { palette } = useUi();
  const [dados, setDados] = useState<{ dia: string | null; karts: KartDoDia[] } | null>(null);
  const [erro, setErro] = useState('');
  const [modo, setModo] = useState<(typeof MODOS)[number]>('Melhor volta');
  const [grade, setGrade] = useState(false);
  const carregar = useCallback(async () => {
    try { setDados(await rankingApi.kartsDoDia()); setErro(''); } catch { setErro('Não foi possível carregar os karts.'); }
  }, []);
  useEffect(() => { void Promise.resolve().then(carregar); }, [carregar]);

  const karts = [...(dados?.karts ?? [])].sort((a, b) =>
    modo === 'Número' ? Number(a.kart) - Number(b.kart) || a.kart.localeCompare(b.kart)
      : modo === 'Melhor posição' ? (a.melhorPos ?? 99) - (b.melhorPos ?? 99) || (a.posVolta ?? 99) - (b.posVolta ?? 99)
        : (a.posVolta ?? 999) - (b.posVolta ?? 999));
  const total = Math.max(1, (dados?.karts ?? []).filter((k) => k.posVolta).length - 1);
  const cor = (k: KartDoDia) => (k.posVolta ? corDe((k.posVolta - 1) / total) : palette.surfaceElevated);

  return (
    <TelaCarreira titulo="Karts do dia" onRefresh={carregar} carregando={!dados && !erro}>
      {erro ? <Aviso texto={erro} /> : null}
      {dados && !dados.karts.length ? <Aviso texto="Ainda não há baterias com tempo para mostrar os karts." /> : null}
      {dados?.karts.length ? (
        <>
          <Text style={{ color: palette.textSecondary, textAlign: 'center' }}>{dados.dia ? formatarDia(dados.dia) : ''} · {dados.karts.length} karts · verde = mais rápido</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {MODOS.map((m) => (
              <Pressable key={m} onPress={() => { tap(); setModo(m); }} accessibilityRole="tab" accessibilityState={{ selected: modo === m }}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: modo === m ? palette.text : palette.surface }}>
                <Text style={{ color: modo === m ? palette.background : palette.textSecondary, fontWeight: '800', fontSize: 13 }}>{m}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => { tap(); setGrade(!grade); }} accessibilityRole="button" style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: palette.border }}>
              <Text style={{ color: palette.text, fontWeight: '800', fontSize: 13 }}>{grade ? 'Ver lista' : 'Ver grade'}</Text>
            </Pressable>
          </View>

          {grade ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {karts.map((k) => (
                <View key={k.kart} accessible accessibilityLabel={`Kart ${k.kart}, ${k.posVolta ? `${k.posVolta}º melhor volta` : 'sem volta válida'}`}
                  style={{ width: 54, height: 54, borderRadius: 12, backgroundColor: cor(k), alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '900' }}>{k.kart}</Text>
                </View>
              ))}
            </View>
          ) : karts.map((k, i) => (
            <Bloco key={k.kart} index={Math.min(i, 8)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 60, height: 60, borderRadius: 14, backgroundColor: cor(k), alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900' }}>{k.kart}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.textMuted, fontSize: 11, fontWeight: '800' }}>MELHOR VOLTA</Text>
                  <Text style={{ color: palette.text, fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{k.posVolta ? `${k.posVolta}º · ${formatarVolta(k.melhorMs!)}` : '—'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: palette.textMuted, fontSize: 11, fontWeight: '800' }}>MELHOR POSIÇÃO</Text>
                  <Text style={{ color: palette.text, fontSize: 18, fontWeight: '900' }}>{k.melhorPos ? `${k.melhorPos}º` : '—'}</Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {k.corridas.map((c) => (
                  <View key={c.inicio + c.piloto} style={{ width: 170, borderRadius: 12, padding: 10, backgroundColor: c.pos >= 1 ? corDe((c.pos - 1) / Math.max(1, c.de - 1)) : palette.surfaceElevated, gap: 2 }}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>{hora(c.inicio)}  P{c.pos || '—'}</Text>
                    <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 12 }}>{nomeBonito(c.piloto)}</Text>
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontVariant: ['tabular-nums'] }}>{c.ms ? formatarVolta(c.ms) : '—'}</Text>
                    <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11 }}>{c.bateria}</Text>
                  </View>
                ))}
              </ScrollView>
            </Bloco>
          ))}
        </>
      ) : null}
    </TelaCarreira>
  );
}
