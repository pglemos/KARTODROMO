/**
 * Minhas metas: o piloto cria metas (quebrar o tempo num traçado, vitórias, pódios, baterias, poles, voltas mais
 * rápidas, XP) com prazo opcional. O progresso vem da carreira real; metas de contagem medem a partir do dia em que
 * foram criadas. Ficam guardadas no próprio celular.
 */
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { Aviso, Barra, Bloco, Numero, TelaCarreira, useMinhaCarreira } from '../components/carreira-kit';
import { tap } from '../components/motion';
import { useUi } from '../components/theme';
import { formatarVolta, type CarreiraPiloto } from '../features/ranking/api';
import { xpDe } from '../features/ranking/gamificacao';

type Tipo = 'tempo' | 'vitorias' | 'podios' | 'baterias' | 'poles' | 'voltasMaisRapidas' | 'xp';
type Meta = { id: string; tipo: Tipo; alvo: number; base: number; tracado?: string; criada: string; prazo?: string };

const TIPOS: { tipo: Tipo; titulo: string; texto: string; icone: string }[] = [
  { tipo: 'tempo', titulo: 'Quebrar tempo de volta', texto: 'Baixar seu melhor tempo num traçado', icone: '⏱️' },
  { tipo: 'vitorias', titulo: 'Conquistar vitórias', texto: 'Vencer um número de corridas', icone: '🏆' },
  { tipo: 'podios', titulo: 'Conquistar pódios', texto: 'Subir ao pódio um número de vezes', icone: '🥉' },
  { tipo: 'baterias', titulo: 'Aumentar participação', texto: 'Andar um número de baterias', icone: '📅' },
  { tipo: 'poles', titulo: 'Fazer poles', texto: 'Primeiro lugar em tomadas de tempo', icone: '🎯' },
  { tipo: 'voltasMaisRapidas', titulo: 'Voltas mais rápidas', texto: 'Fazer a melhor volta da bateria', icone: '⚡' },
  { tipo: 'xp', titulo: 'Ganhar experiência', texto: 'Chegar a um total de XP', icone: '⭐' },
];
const CHAVE = 'minhas-metas';
const contagem = (d: CarreiraPiloto, t: Tipo) => (t === 'xp' ? xpDe(d) : t === 'tempo' ? 0 : (d[t] as number));

function progresso(m: Meta, d: CarreiraPiloto) {
  if (m.tipo === 'tempo') {
    const t = d.tracados.find((x) => x.nome === m.tracado);
    const atual = t?.ms ?? null;
    return { feito: atual !== null && atual <= m.alvo, valor: atual, fracao: atual ? Math.min(1, m.base > m.alvo ? (m.base - atual) / (m.base - m.alvo) : 1) : 0 };
  }
  const v = m.tipo === 'xp' ? contagem(d, 'xp') : contagem(d, m.tipo) - m.base;
  return { feito: v >= m.alvo, valor: v, fracao: Math.min(1, Math.max(0, v / m.alvo)) };
}

export default function Metas() {
  const { palette } = useUi();
  const { dados, erro, carregando, carregar } = useMinhaCarreira();
  const [metas, setMetas] = useState<Meta[]>([]);
  const [criando, setCriando] = useState<Tipo | null>(null);
  const [alvo, setAlvo] = useState('');
  const [tracado, setTracado] = useState<string | null>(null);
  const [prazo, setPrazo] = useState('30');
  const [agora] = useState(() => Date.now());

  useEffect(() => { void SecureStore.getItemAsync(CHAVE).then((t) => { if (t) setMetas(JSON.parse(t) as Meta[]); }).catch(() => undefined); }, []);
  const salvar = (lista: Meta[]) => { setMetas(lista); void SecureStore.setItemAsync(CHAVE, JSON.stringify(lista)).catch(() => undefined); };

  if (!dados) return <TelaCarreira titulo="Minhas metas" carregando={carregando} onRefresh={carregar}>{erro ? <Aviso texto={erro} /> : null}</TelaCarreira>;

  const lista = metas.map((m) => ({ m, p: progresso(m, dados) }));
  const concluidas = lista.filter((x) => x.p.feito).length;
  const atrasadas = lista.filter((x) => !x.p.feito && x.m.prazo && Date.parse(x.m.prazo) < agora).length;

  const criar = () => {
    if (!criando) return;
    let valor: number;
    if (criando === 'tempo') {
      const m = /^(?:(\d+):)?(\d{1,2})[.,](\d{1,3})$/.exec(alvo.trim());
      if (!tracado || !m) { Alert.alert('Meta de tempo', 'Escolha o traçado e digite o tempo, por exemplo 1:02.500'); return; }
      valor = (Number(m[1] ?? 0) * 60 + Number(m[2])) * 1000 + Number(m[3].padEnd(3, '0'));
    } else {
      valor = Number(alvo.replace(/\D/g, ''));
      if (!valor) { Alert.alert('Meta', 'Digite um número maior que zero.'); return; }
    }
    const dias = Number(prazo.replace(/\D/g, ''));
    const base = criando === 'tempo' ? (dados.tracados.find((x) => x.nome === tracado)?.ms ?? valor) : contagem(dados, criando);
    const criadaEm = new Date();
    salvar([...metas, { id: String(criadaEm.getTime()), tipo: criando, alvo: valor, base, tracado: tracado ?? undefined, criada: criadaEm.toISOString(), prazo: dias ? new Date(criadaEm.getTime() + dias * 86_400_000).toISOString() : undefined }]);
    setCriando(null); setAlvo(''); setTracado(null);
  };

  return (
    <TelaCarreira titulo="Minhas metas" onRefresh={carregar}>
      <Bloco titulo="Estatísticas de metas" index={0}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Numero valor={metas.length} rotulo="Total" />
          <Numero valor={metas.length - concluidas} rotulo="Ativas" cor="#F97316" />
          <Numero valor={concluidas} rotulo="Concluídas" cor="#22C55E" />
          <Numero valor={atrasadas} rotulo="Atrasadas" cor="#EF4444" />
          <Numero valor={metas.length ? Math.round((concluidas / metas.length) * 100) : 0} sufixo="%" rotulo="Taxa" />
        </View>
      </Bloco>

      {lista.map(({ m, p }, i) => {
        const t = TIPOS.find((x) => x.tipo === m.tipo)!;
        const atrasada = !p.feito && m.prazo && Date.parse(m.prazo) < agora;
        const titulo = m.tipo === 'tempo' ? `${m.tracado}: abaixo de ${formatarVolta(m.alvo)}` : m.tipo === 'xp' ? `Chegar a ${m.alvo.toLocaleString('pt-BR')} XP` : `${m.alvo} ${t.titulo.replace(/^\S+ /, '').toLowerCase()}`;
        return (
          <Bloco key={m.id} index={i + 1}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 24 }}>{t.icone}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>{titulo}</Text>
                <Text style={{ color: p.feito ? palette.neonGreen : atrasada ? '#EF4444' : palette.textMuted, fontSize: 12 }}>
                  {p.feito ? 'Concluída ✓' : atrasada ? 'Prazo vencido' : m.prazo ? `até ${new Date(m.prazo).toLocaleDateString('pt-BR')}` : 'sem prazo'}
                  {m.tipo === 'tempo' ? ` · seu melhor: ${p.valor ? formatarVolta(p.valor) : '—'}` : m.tipo === 'xp' ? ` · agora ${Number(p.valor).toLocaleString('pt-BR')} XP` : ` · ${p.valor} de ${m.alvo} desde ${new Date(m.criada).toLocaleDateString('pt-BR')}`}
                </Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Apagar meta" hitSlop={10} onPress={() => { tap(); salvar(metas.filter((x) => x.id !== m.id)); }}>
                <Text style={{ color: palette.textMuted, fontSize: 18 }}>✕</Text>
              </Pressable>
            </View>
            <Barra valor={p.fracao} cor={p.feito ? palette.neonGreen : palette.accent} />
          </Bloco>
        );
      })}

      <Bloco titulo={criando ? 'Nova meta' : 'Criar meta'} index={lista.length + 1}>
        {!criando ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {TIPOS.map((t) => (
              <Pressable key={t.tipo} onPress={() => { tap(); setCriando(t.tipo); }} accessibilityRole="button"
                style={({ pressed }) => ({ width: '47%', flexGrow: 1, borderRadius: 16, borderWidth: 1, borderColor: palette.border, padding: 12, gap: 4, alignItems: 'center', opacity: pressed ? 0.7 : 1 })}>
                <Text style={{ fontSize: 24 }}>{t.icone}</Text>
                <Text style={{ color: palette.text, fontWeight: '900', textAlign: 'center' }}>{t.titulo}</Text>
                <Text style={{ color: palette.textMuted, fontSize: 12, textAlign: 'center' }}>{t.texto}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>{TIPOS.find((x) => x.tipo === criando)?.titulo}</Text>
            {criando === 'tempo' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {dados.tracados.map((t) => (
                  <Pressable key={t.nome} onPress={() => { tap(); setTracado(t.nome); }} accessibilityRole="button"
                    style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: tracado === t.nome ? palette.accent : palette.surfaceElevated }}>
                    <Text style={{ color: tracado === t.nome ? '#000000' : palette.text, fontWeight: '700', fontSize: 13 }}>{t.nome} · {formatarVolta(t.ms)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <TextInput value={alvo} onChangeText={setAlvo} keyboardType={criando === 'tempo' ? 'numbers-and-punctuation' : 'number-pad'} accessibilityLabel="Valor da meta"
              placeholder={criando === 'tempo' ? 'Tempo alvo, ex.: 1:02.500' : criando === 'xp' ? `XP total, ex.: ${(xpDe(dados) + 1000).toLocaleString('pt-BR')}` : 'Quantidade a partir de hoje, ex.: 3'} placeholderTextColor={palette.textMuted}
              style={{ backgroundColor: palette.surfaceElevated, color: palette.text, borderRadius: 12, padding: 12, fontSize: 16 }} />
            <TextInput value={prazo} onChangeText={setPrazo} keyboardType="number-pad" accessibilityLabel="Prazo em dias" placeholder="Prazo em dias (vazio = sem prazo)" placeholderTextColor={palette.textMuted}
              style={{ backgroundColor: palette.surfaceElevated, color: palette.text, borderRadius: 12, padding: 12, fontSize: 16 }} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => { tap(); setCriando(null); }} accessibilityRole="button" style={{ flex: 1, borderRadius: 999, borderWidth: 1, borderColor: palette.border, padding: 14, alignItems: 'center' }}>
                <Text style={{ color: palette.text, fontWeight: '800' }}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={() => { tap(); criar(); }} accessibilityRole="button" style={{ flex: 1, borderRadius: 999, backgroundColor: palette.accent, padding: 14, alignItems: 'center' }}>
                <Text style={{ color: '#000000', fontWeight: '900' }}>Salvar meta</Text>
              </Pressable>
            </View>
          </View>
        )}
      </Bloco>
    </TelaCarreira>
  );
}
