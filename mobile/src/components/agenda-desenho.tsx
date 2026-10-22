import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Icon } from './brand';
import { CabecalhoPiloto } from './cabecalho-piloto';
import { Caixa, Foto, LARGO, T, cor, fonte, fundos, useK, useTopo } from './design-kit';
import type { AgendaSlot } from '../types/racing';

export type TipoHorario = 'bateria' | 'treino' | 'evento';

/** separa os horários pelo nome: treino livre, eventos (campeonatos, endurance) e o resto, que são baterias */
export function tipoDe(titulo: string): TipoHorario {
  const t = (titulo ?? '').toLowerCase();
  if (/treino/.test(t)) return 'treino';
  if (/evento|campeonato|copa|endurance|milhas|grupo|anivers/.test(t)) return 'evento';
  return 'bateria';
}

const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const MESES_LONGOS = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

function rotuloDia(data: string) {
  const [d, m, a] = data.split('/').map(Number);
  const dia = new Date(a, m - 1, d);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const diff = Math.round((dia.getTime() - hoje.getTime()) / 86_400_000);
  return { semana: diff === 0 ? 'HOJE' : diff === 1 ? 'AMANHÃ' : DIAS[dia.getDay()] ?? '', dia: `${d} ${MESES[m - 1] ?? ''}`, mes: MESES_LONGOS[m - 1] ?? '' };
}

const Y0 = 70;
const y = (n: number) => n - Y0;
const TIPOS: { id: TipoHorario; nome: string; icone: 'bolt' | 'trophy' | 'people' }[] = [
  { id: 'bateria', nome: 'BATERIA', icone: 'bolt' },
  { id: 'treino', nome: 'TREINO', icone: 'trophy' },
  { id: 'evento', nome: 'EVENTO', icone: 'people' },
];

/** topo da agenda no desenho: foto, título, dias e o filtro de tipo; `children` vem logo abaixo (avisos e carregando) */
export function CabecalhoAgenda({ dates, selectedDate, onDate, tipo, onTipo, children }: {
  dates: string[]; selectedDate: string; onDate: (d: string) => void; tipo: TipoHorario; onTipo: (t: TipoHorario) => void; children?: ReactNode;
}) {
  const k = useK();
  const insets = { top: useTopo() };
  const mes = dates[0] ? rotuloDia(dates[0]).mes : '';
  return (
    <View style={{ paddingTop: insets.top }}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: insets.top + 6, backgroundColor: '#0A0C0B' }} />
      <View style={{ width: 852 * k, height: (690 - Y0) * k, alignSelf: 'center' }}>
        <Caixa x={0} y={y(72)} w={852} h={386} pointerEvents="none"><Foto fonte={fundos.agendaTopo} /></Caixa>
        <CabecalhoPiloto y={y(88)} logo={{ x: 40, y: y(80), w: 325 }} detalhe />
        <Caixa x={45} y={y(203)} pointerEvents="none"><T s={21} c="#D3D8D5" p="500" style={{ letterSpacing: 12 * k }}>AGENDA</T></Caixa>
        <Caixa x={42} y={y(241)} pointerEvents="none">
          <T s={60} f={fonte.display} largo={LARGO} lh={49} style={{ letterSpacing: -0.5 * k }}>ESCOLHA</T>
          <T s={60} f={fonte.display} largo={LARGO} lh={49} style={{ letterSpacing: -0.5 * k }}>SUA BATERIA</T>
        </Caixa>
        <Caixa x={43} y={y(358)} w={360} pointerEvents="none">
          <T testID="agenda-selected-date" s={21} lh={28} c="#DCE1DE">Selecione o dia e o horário da sua bateria e garanta sua vaga na pista.</T>
        </Caixa>

        <Caixa x={0} y={y(463)} w={852} h={106}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 32 * k, gap: 12 * k }}>
            {dates.map((date) => {
              const sel = date === selectedDate;
              const r = rotuloDia(date);
              return (
                <Pressable key={date} testID={`date-pill-${date}`} accessibilityRole="button" accessibilityState={{ selected: sel }} accessibilityLabel={`${r.semana} ${r.dia}`}
                  onPress={() => onDate(date)}
                  style={{ width: 122 * k, height: 104 * k, borderRadius: 18 * k, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? cor.verde : '#121716', borderWidth: 1, borderColor: sel ? '#57F591' : '#262B29',
                    shadowColor: cor.verde, shadowOpacity: sel ? 0.5 : 0, shadowRadius: 14 * k, elevation: sel ? 8 : 0 }}>
                  <T s={19} p="600" c={sel ? '#04230F' : '#C3C9C6'} style={{ letterSpacing: 1 * k }}>{r.semana}</T>
                  <T s={20} p="800" c={sel ? '#04230F' : '#FFFFFF'} style={{ marginTop: 6 * k }}>{r.dia}</T>
                  {sel ? <View style={{ width: 8 * k, height: 8 * k, borderRadius: 4 * k, backgroundColor: '#04230F', marginTop: 6 * k }} /> : null}
                </Pressable>
              );
            })}
            {mes ? (
              <View accessible accessibilityLabel={`Mês de ${mes.toLowerCase()}`} style={{ width: 122 * k, height: 104 * k, borderRadius: 18 * k, alignItems: 'center', justifyContent: 'center', backgroundColor: '#121716', borderWidth: 1, borderColor: '#262B29' }}>
                <Icon name="calendar" color="#FFFFFF" size={38 * k} />
                <T s={15} p="500" c="#C3C9C6" style={{ marginTop: 10 * k, letterSpacing: 1 * k }}>{mes}</T>
              </View>
            ) : null}
          </ScrollView>
        </Caixa>

        <Caixa x={42} y={y(601)} w={768} h={67} style={{ borderRadius: 34 * k, borderWidth: 1, borderColor: '#2B302E', backgroundColor: '#0D1110', flexDirection: 'row', padding: 2 * k }}>
          {TIPOS.map((t) => {
            const sel = t.id === tipo;
            return (
              <Pressable key={t.id} onPress={() => onTipo(t.id)} accessibilityRole="button" accessibilityState={{ selected: sel }} accessibilityLabel={t.nome.toLowerCase()}
                style={{ flex: t.id === 'bateria' ? 1.02 : 1, borderRadius: 32 * k, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 * k,
                  backgroundColor: sel ? '#0D3A1E' : 'transparent', borderWidth: sel ? 1.5 * k : 0, borderColor: '#2BD96A', shadowColor: cor.verde, shadowOpacity: sel ? 0.6 : 0, shadowRadius: 14 * k }}>
                <Icon name={t.icone} color={sel ? cor.verde : '#D9DEDB'} size={30 * k} />
                <T s={19} p="700" c={sel ? cor.verde : '#D9DEDB'} style={{ letterSpacing: 2.5 * k }}>{t.nome}</T>
              </Pressable>
            );
          })}
        </Caixa>
      </View>
      {children}
    </View>
  );
}

/** cartão de um horário: hora, vagas em segmentos e o botão Reservar, com a pista no fundo */
export function CartaoHorario({ slot, destaque, esgotado, rotuloBotao, rotulo, onPress }: {
  slot: AgendaSlot; destaque: boolean; esgotado: boolean; rotuloBotao: string; rotulo: string; onPress: () => void;
}) {
  const k = useK();
  const total = Math.max(slot.maxSlots || 30, slot.availableSlots, 1);
  const livres = Math.max(0, slot.availableSlots);
  const SEG = 30;
  const cheios = Math.round((livres / total) * SEG);
  return (
    <View style={{ width: 852 * k, alignSelf: 'center', paddingHorizontal: 28 * k, marginBottom: 16 * k }}>
      <Pressable testID={`agenda-slot-card-${slot.id}`} accessibilityRole="button" accessibilityLabel={rotulo} disabled={esgotado} onPress={onPress}
        style={({ pressed }) => ({ height: 122 * k, borderRadius: 18 * k, overflow: 'hidden', backgroundColor: '#0D1110', borderWidth: destaque ? 2 * k : 1, borderColor: destaque ? '#2BD96A' : '#262B29',
          shadowColor: cor.verde, shadowOpacity: destaque ? 0.5 : 0, shadowRadius: 16 * k, opacity: esgotado ? 0.55 : pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
        <View style={{ position: 'absolute', left: 400 * k, top: 0, bottom: 0, right: 0 }}><Foto fonte={fundos.agendaCartao} opacidade={0.75} /></View>
        <View style={{ position: 'absolute', left: 340 * k, top: 0, bottom: 0, width: 120 * k, flexDirection: 'row' }} pointerEvents="none">
          {Array.from({ length: 8 }, (_, i) => <View key={i} style={{ flex: 1, backgroundColor: '#0D1110', opacity: 1 - i / 8 }} />)}
        </View>

        <Caixa x={27} y={13} pointerEvents="none">
          <T s={46} p="700" style={{ fontVariant: ['tabular-nums'], letterSpacing: -0.5 * k }}>{slot.time}</T>
        </Caixa>
        <Caixa x={27} y={64} w={160} pointerEvents="none"><T s={17} p="600" c="#C9CFCC" style={{ letterSpacing: 3 * k }} linhas={1}>{(slot.title && slot.title.toUpperCase() !== `BATERIA ${slot.time}` ? slot.title : 'BATERIA').toUpperCase()}</T></Caixa>
        <Caixa x={27} y={88} pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="clock" color="#FFFFFF" size={18 * k} />
          <T s={16} style={{ marginLeft: 10 * k }}>20 min</T>
        </Caixa>
        <Caixa x={140} y={86} w={1.5} h={22} pointerEvents="none" style={{ backgroundColor: '#3A403D' }} />

        <Caixa x={197} y={16} pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="people" color="#FFFFFF" size={22 * k} />
          <T s={18} style={{ marginLeft: 10 * k }}>{total} vagas</T>
        </Caixa>
        <Caixa x={198} y={51} w={378} h={14} pointerEvents="none" style={{ flexDirection: 'row', gap: 2.5 * k }}>
          {Array.from({ length: SEG }, (_, i) => (
            <View key={i} style={{ flex: 1, borderRadius: 2 * k, backgroundColor: i < cheios ? (livres <= 5 ? '#F5B729' : '#22E06B') : '#2E3532' }} />
          ))}
        </Caixa>
        <Caixa x={165} y={86} pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="flag" color="#FFFFFF" size={18 * k} />
          <T s={16} c="#D5DAD7" style={{ marginLeft: 10 * k }}>Tomada de tempo</T>
          <View style={{ width: 1.5 * k, height: 22 * k, backgroundColor: '#3A403D', marginHorizontal: 18 * k }} />
          <Icon name="people" color="#FFFFFF" size={18 * k} />
          <T s={16} c="#D5DAD7" style={{ marginLeft: 10 * k }}>Individual</T>
        </Caixa>

        <Caixa x={560} y={16} w={213} pointerEvents="none" style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <T testID={`slot-vagas-${slot.id}`} s={16} c={esgotado ? '#FF6B6B' : '#E3E7E5'}>{esgotado ? 'Esgotado' : livres === 1 ? '1 vaga' : `${livres} vagas`}</T>
          {esgotado ? null : <T s={16} c="#E3E7E5">{livres === 1 ? ' disponível' : ' disponíveis'}</T>}
        </Caixa>
        {esgotado ? null : (
          <Caixa x={617} y={52} w={164} h={54} pointerEvents="none" style={{ borderRadius: 27 * k, backgroundColor: '#1ED760', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 * k, shadowColor: cor.verde, shadowOpacity: 0.5, shadowRadius: 10 * k }}>
            <T s={20} p="800" c="#04230F">{rotuloBotao}</T>
            <Icon name="chevron" color="#04230F" size={22 * k} />
          </Caixa>
        )}
      </Pressable>
    </View>
  );
}
