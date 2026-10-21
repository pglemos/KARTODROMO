/**
 * Desafios do mês, medidos nas baterias reais do piloto: ativos (mês atual, com prazo e progresso), concluídos
 * (meses anteriores em que bateu a marca) e próximos (os do mês que vem).
 */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Aviso, Barra, Bloco, TelaCarreira, useMinhaCarreira } from '../components/carreira-kit';
import { tap } from '../components/motion';
import { useUi } from '../components/theme';
import type { CarreiraPiloto } from '../features/ranking/api';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
type Mes = NonNullable<CarreiraPiloto['xpMes']>[number];
const MODELOS: { id: string; titulo: string; texto: string; cor: string; alvo: number; de: (m: Mes | undefined) => number }[] = [
  { id: 'maratona', titulo: 'Maratonista', texto: 'Ande 6 baterias no mês', cor: '#7C3AED', alvo: 6, de: (m) => m?.baterias ?? 0 },
  { id: 'frequencia', titulo: 'Presença garantida', texto: 'Ande 3 baterias no mês', cor: '#2563EB', alvo: 3, de: (m) => m?.baterias ?? 0 },
  { id: 'podio', titulo: 'Caçador de pódio', texto: 'Suba ao pódio 2 vezes no mês', cor: '#B45309', alvo: 2, de: (m) => m?.podios ?? 0 },
  { id: 'vitoria', titulo: 'Vencedor do mês', texto: 'Vença uma corrida no mês', cor: '#047857', alvo: 1, de: (m) => m?.vitorias ?? 0 },
  { id: 'xp', titulo: 'Turbo de XP', texto: 'Ganhe 500 XP no mês', cor: '#DB2777', alvo: 500, de: (m) => m?.xp ?? 0 },
];
const ABAS = ['Ativos', 'Concluídos', 'Em breve'] as const;
const dataBr = (d: Date) => d.toLocaleDateString('pt-BR');

export default function Desafios() {
  const { palette } = useUi();
  const { dados, erro, carregando, carregar } = useMinhaCarreira();
  const [aba, setAba] = useState<(typeof ABAS)[number]>('Ativos');
  const [aberto, setAberto] = useState<string | null>(null);
  if (!dados) return <TelaCarreira titulo="Desafios" carregando={carregando} onRefresh={carregar}>{erro ? <Aviso texto={erro} /> : null}</TelaCarreira>;

  const hoje = new Date();
  const chave = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59);
  const dias = Math.max(0, Math.ceil((fim.getTime() - hoje.getTime()) / 86_400_000));
  const atual = dados.xpMes?.find((m) => m.mes === chave(hoje));
  const passados = (dados.xpMes ?? []).filter((m) => m.mes < chave(hoje));
  const concluidos = passados.flatMap((m) => MODELOS.filter((d) => d.de(m) >= d.alvo).map((d) => ({ d, m })));
  const proximo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);

  return (
    <TelaCarreira titulo="Desafios" onRefresh={carregar}>
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
        {ABAS.map((a) => (
          <Pressable key={a} onPress={() => { tap(); setAba(a); }} accessibilityRole="tab" accessibilityState={{ selected: aba === a }}
            style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: aba === a ? (a === 'Ativos' ? '#22C55E' : a === 'Em breve' ? '#F97316' : palette.text) : palette.surface }}>
            <Text style={{ color: aba === a ? '#000000' : palette.textSecondary, fontWeight: '900', fontSize: 13 }}>{a}</Text>
          </Pressable>
        ))}
      </View>

      {aba === 'Ativos' ? MODELOS.map((d, i) => {
        const feito = d.de(atual);
        const ok = feito >= d.alvo;
        return (
          <Bloco key={d.id} index={i}>
            <Pressable onPress={() => { tap(); setAberto(aberto === d.id ? null : d.id); }} accessibilityRole="button" accessibilityLabel={`${d.titulo}: ${d.texto}. ${ok ? 'Concluído' : `${feito} de ${d.alvo}`}`} style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: d.cor, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '900' }}>{ok ? '✓' : `${Math.round(Math.min(1, feito / d.alvo) * 100)}%`.replace('100%', '✓')}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.text, fontSize: 17, fontWeight: '900' }}>{d.titulo}</Text>
                  <Text style={{ color: palette.textMuted, fontSize: 13 }}>{d.texto} · {MESES[hoje.getMonth()]}</Text>
                </View>
                <Text style={{ color: palette.textMuted, fontSize: 12 }}>{dias} dia{dias === 1 ? '' : 's'}</Text>
              </View>
              <Barra valor={feito / d.alvo} cor={ok ? palette.neonGreen : d.cor} />
              <Text style={{ color: ok ? palette.neonGreen : palette.textSecondary, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{ok ? 'Concluído neste mês!' : `${feito.toLocaleString('pt-BR')} de ${d.alvo.toLocaleString('pt-BR')}`}</Text>
              {aberto === d.id ? (
                <View style={{ gap: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: palette.borderSubtle }}>
                  <Text style={{ color: palette.textSecondary }}>Início: {dataBr(inicio)} 00:00</Text>
                  <Text style={{ color: palette.textSecondary }}>Término: {dataBr(fim)} 23:59</Text>
                  <Text style={{ color: palette.textMuted, fontSize: 12 }}>Conta sozinho: toda bateria que você anda no kartódromo entra aqui, sem precisar se inscrever.</Text>
                </View>
              ) : null}
            </Pressable>
          </Bloco>
        );
      }) : null}

      {aba === 'Concluídos' ? (concluidos.length ? concluidos.map(({ d, m }, i) => (
        <Bloco key={d.id + m.mes} index={i}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: d.cor, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#FFFFFF', fontWeight: '900' }}>✓</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.text, fontWeight: '900' }}>{d.titulo}</Text>
              <Text style={{ color: palette.textMuted, fontSize: 13 }}>{MESES[Number(m.mes.slice(5, 7)) - 1]} de {m.mes.slice(0, 4)} · {d.de(m).toLocaleString('pt-BR')}/{d.alvo.toLocaleString('pt-BR')}</Text>
            </View>
          </View>
        </Bloco>
      )) : <Aviso texto="Nenhum desafio concluído nos meses anteriores. Este mês é a hora!" />) : null}

      {aba === 'Em breve' ? MODELOS.map((d, i) => (
        <Bloco key={d.id} index={i}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: d.cor, opacity: 0.6 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.text, fontWeight: '900' }}>{d.titulo}</Text>
              <Text style={{ color: palette.textMuted, fontSize: 13 }}>{d.texto} · começa em {dataBr(proximo)}</Text>
            </View>
          </View>
        </Bloco>
      )) : null}
    </TelaCarreira>
  );
}
