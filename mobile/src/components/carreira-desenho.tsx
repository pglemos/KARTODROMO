/**
 * Topo da Carreira no desenho aprovado (imagem de 852 px, medidas escaladas à largura do celular): foto do capacete,
 * avatar com anel verde, nome, categoria, XP, números da carreira, os seis cartões com foto, carteira e perfil, a
 * última atividade na pista e o desempenho das últimas baterias.
 */
import { router, type Href } from 'expo-router';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';

import { Brand, Icon } from './brand';
import { Caixa, Foto, SetaCirculo, T, Toque, cor, fundos, useK } from './design-kit';
import { FotoPiloto } from './foto-piloto';
import { tap } from './motion';
import { formatarDia, formatarVolta, type CarreiraPiloto } from '../features/ranking/api';
import { nomeBonito } from '../features/ranking/gamificacao';

type Categoria = { nome: string; cor: string; progresso: number; proxima: { nome: string; desde: number } | null };
type NomeIcone = Parameters<typeof Icon>[0]['name'];

const TILES: { x: number; y: number; w: number; titulo: string; texto: string; icone: NomeIcone; corIcone: string; borda: string; foto: number; rota: string }[] = [
  { x: 35, y: 780, w: 257, titulo: 'Meu progresso', texto: 'Evolução de XP,\nníveis e estatísticas', icone: 'check2', corIcone: '#22C55E', borda: '#1E8A45', foto: fundos.tileProgresso, rota: '/progresso' },
  { x: 307, y: 780, w: 249, titulo: 'Conquistas', texto: 'Suas medalhas\ne troféus', icone: 'trophy', corIcone: '#F5B729', borda: '#A7741B', foto: fundos.tileConquistas, rota: '/minhas-conquistas' },
  { x: 571, y: 780, w: 249, titulo: 'Desafios', texto: 'Complete desafios\ne ganhe prêmios', icone: 'fire', corIcone: '#F43F7A', borda: '#A01A55', foto: fundos.tileDesafios, rota: '/desafios' },
  { x: 35, y: 978, w: 257, titulo: 'Minhas metas', texto: 'Defina objetivos\ne acompanhe', icone: 'target', corIcone: '#22C55E', borda: '#1E8A45', foto: fundos.tileMetas, rota: '/metas' },
  { x: 307, y: 978, w: 249, titulo: 'Karts do dia', texto: 'Seus melhores\ntempos por kart', icone: 'timer', corIcone: '#8B5CF6', borda: '#5B2FB5', foto: fundos.tileKarts, rota: '/karts' },
  { x: 571, y: 978, w: 249, titulo: 'Modo piloto', texto: 'Seu estilo, dados\ne configurações', icone: 'send', corIcone: '#F97316', borda: '#A8501A', foto: fundos.tileModo, rota: '/cockpit' },
];

/** y do desenho onde começa o recorte do topo (abaixo da barra de status da imagem) */
const Y0 = 80;
const y = (n: number) => n - Y0;

export function CarreiraTopo({ dados, xp, cat, eu, versaoFoto, enviandoFoto, onFoto }: {
  dados: CarreiraPiloto; xp: number; cat: Categoria; eu: boolean; versaoFoto: number; enviandoFoto: boolean; onFoto: () => void;
}) {
  const k = useK();
  const ir = (rota: string) => () => { tap(); router.push(rota as Href); };
  const voltar = () => { tap(); if (router.canGoBack()) router.back(); else router.replace('/(tabs)'); };
  const numeros: { v: number; r: string; icone: NomeIcone; c: string }[] = [
    { v: dados.baterias, r: 'Baterias', icone: 'flag', c: '#FFFFFF' },
    { v: dados.vitorias, r: 'Vitórias', icone: 'trophy', c: '#F5B729' },
    { v: dados.podios, r: 'Pódios', icone: 'chart', c: '#8B5CF6' },
    { v: dados.poles, r: 'Poles', icone: 'helmet', c: '#FFFFFF' },
    { v: dados.voltasMaisRapidas, r: 'Voltas + rápidas', icone: 'timer', c: '#FFFFFF' },
    { v: dados.voltas, r: 'Voltas', icone: 'route', c: '#FFFFFF' },
  ];
  const colunas = [33, 167, 297, 428, 560, 697, 820];
  const ultima = dados.recentes[0];
  const barras = [...dados.recentes].slice(0, 26).reverse();

  return (
    <View style={{ width: 852 * k, alignSelf: 'center' }}>
      {/* topo com foto, avatar, XP e números (y 80–760) */}
      <View style={{ height: (765 - Y0) * k }}>
        <Caixa x={0} y={0} w={852} h={346} pointerEvents="none"><Foto fonte={fundos.carreiraTopo} /></Caixa>
        <Toque x={35} y={y(102)} w={63} h={63} rotulo="Voltar" onPress={voltar}
          style={{ borderRadius: 32 * k, borderWidth: 1.5, borderColor: '#3A403D', backgroundColor: 'rgba(10,12,11,0.7)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="back" color="#FFFFFF" size={28 * k} />
        </Toque>
        <Caixa x={118} y={y(97)} pointerEvents="none"><Brand width={294 * k} /></Caixa>
        <Toque x={560} y={y(103)} w={188} h={57} rotulo="Meus resultados" onPress={ir('/(tabs)/resultados')}
          style={{ borderRadius: 28 * k, borderWidth: 1.5 * k, borderColor: '#1E8A45', backgroundColor: 'rgba(10,38,22,0.9)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 * k }}>
          <Icon name="flag" color={cor.verde} size={28 * k} />
          <T s={20}>Resultados</T>
        </Toque>
        <Toque x={758} y={y(101)} w={60} h={60} rotulo="Meu perfil e preferências" onPress={ir('/perfil')}
          style={{ borderRadius: 30 * k, borderWidth: 1, borderColor: '#2E3431', backgroundColor: 'rgba(14,17,16,0.92)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="gear" color="#FFFFFF" size={30 * k} />
        </Toque>

        <Pressable disabled={!eu || enviandoFoto} onPress={onFoto} accessibilityRole={eu ? 'button' : undefined} accessibilityLabel={eu ? 'Trocar foto' : undefined}
          style={{ position: 'absolute', left: 33 * k, top: y(200) * k, width: 186 * k, height: 186 * k }}>
          <View style={{ width: 186 * k, height: 186 * k, borderRadius: 93 * k, borderWidth: 6 * k, borderColor: cor.verde, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B110E', shadowColor: cor.verde, shadowOpacity: 0.6, shadowRadius: 16 * k }}>
            <FotoPiloto key={versaoFoto} id={dados.id} versao={versaoFoto} nome={dados.nome} tamanho={164 * k} cor={cat.cor} />
          </View>
          {eu ? (
            <View style={{ position: 'absolute', left: 120 * k, top: 129 * k, width: 58 * k, height: 58 * k, borderRadius: 29 * k, backgroundColor: '#111615', borderWidth: 1.5, borderColor: '#3A403D', alignItems: 'center', justifyContent: 'center' }}>
              {enviandoFoto ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Icon name="camera" color="#FFFFFF" size={28 * k} />}
            </View>
          ) : null}
        </Pressable>
        <Caixa x={238} y={y(240)} w={330} pointerEvents="none">
          <T s={31} p="700" lh={33} linhas={2} style={{ textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 8 }}>{nomeBonito(dados.nome)}</T>
        </Caixa>
        <Caixa x={238} y={y(319)} h={43} pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 * k, paddingHorizontal: 18 * k, borderRadius: 12 * k, backgroundColor: cat.cor }}>
          <Icon name="crown" color="#1A1200" size={28 * k} />
          <T s={23} p="900" c="#1A1200" style={{ letterSpacing: 1 * k }}>{cat.nome}</T>
        </Caixa>
        {dados.primeira ? (
          <Caixa x={240} y={y(375)} pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center', gap: 16 * k }}>
            <Icon name="calendar" color="#D3D8D5" size={24 * k} />
            <T s={20} c="#D3D8D5">Na pista desde {formatarDia(dados.primeira)}</T>
          </Caixa>
        ) : null}
        {eu ? (
          <Toque x={650} y={y(365)} w={170} h={48} rotulo="Editar perfil" onPress={ir('/perfil')}
            style={{ borderRadius: 24 * k, borderWidth: 1.5 * k, borderColor: cor.verde, backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 * k }}>
            <Icon name="pencil" color={cor.verde} size={22 * k} />
            <T s={19}>Editar perfil</T>
          </Toque>
        ) : null}

        <Caixa x={33} y={y(428)} w={787} h={149} pointerEvents="none" style={{ borderRadius: 16 * k, borderWidth: 1.5 * k, borderColor: '#1F5A36', backgroundColor: '#0B1410' }}>
          <Caixa x={30} y={20}>
            <T s={54} p="800" style={{ fontVariant: ['tabular-nums'], letterSpacing: -1 * k }}>{xp.toLocaleString('pt-BR')} <T s={54} p="800" c={cor.verde}>XP</T></T>
          </Caixa>
          <Caixa x={29} y={94} w={521} h={23} style={{ borderRadius: 12 * k, backgroundColor: '#1E2321', borderWidth: 1, borderColor: '#2B302E', overflow: 'hidden' }}>
            <View style={{ width: `${Math.round(cat.progresso * 100)}%`, height: '100%', borderRadius: 12 * k, backgroundColor: cor.verde }} />
          </Caixa>
          <Caixa x={560} y={20} w={202} style={{ alignItems: 'flex-end' }}>
            <T s={17} c="#C9CFCC">{cat.proxima ? 'Categoria atual' : 'Categoria máxima'}</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 * k, marginTop: 6 * k }}>
              <Icon name="crown" color={cat.cor} size={30 * k} />
              <T s={25} p="800" c={cat.cor} style={{ letterSpacing: 1 * k }}>{cat.nome}</T>
            </View>
            <T s={17} c="#C9CFCC" style={{ marginTop: 10 * k }}>{cat.proxima ? `Próximo: ${cat.proxima.nome}` : 'Próximo nível'}</T>
            <T s={19} style={{ marginTop: 4 * k }}>{cat.proxima ? `${(cat.proxima.desde - xp).toLocaleString('pt-BR')} XP` : `${(500 - (xp % 500)).toLocaleString('pt-BR')} XP`}</T>
          </Caixa>
        </Caixa>

        <Caixa x={33} y={y(595)} w={787} h={163} pointerEvents="none" style={{ borderRadius: 16 * k, backgroundColor: '#0E1211', borderWidth: 1, borderColor: '#1F2422' }}>
          {numeros.map((n, i) => {
            const x0 = colunas[i] - 33, w = colunas[i + 1] - colunas[i];
            return (
              <View key={n.r} style={{ position: 'absolute', left: x0 * k, top: 0, width: w * k, height: '100%', alignItems: 'center', paddingTop: 26 * k, borderLeftWidth: i ? 1 : 0, borderLeftColor: '#262B29' }}>
                <Icon name={n.icone} color={n.c} size={40 * k} />
                <T s={36} p="800" style={{ marginTop: 14 * k, fontVariant: ['tabular-nums'] }}>{n.v.toLocaleString('pt-BR')}</T>
                <T s={16.5} c="#E3E7E5" linhas={1} style={{ marginTop: 4 * k }}>{n.r}</T>
              </View>
            );
          })}
        </Caixa>
      </View>

      {/* cartões com foto (y 780–1158), carteira e perfil (y 1176–1276) */}
      {eu ? (
        <View style={{ height: (1290 - 765) * k }}>
          {TILES.map((t) => (
            <Toque key={t.titulo} x={t.x} y={t.y - 765} w={t.w} h={180} rotulo={t.titulo} onPress={ir(t.rota)}
              style={{ borderRadius: 16 * k, overflow: 'hidden', borderWidth: 1.5 * k, borderColor: t.borda, backgroundColor: '#0E1211' }}>
              <Foto fonte={t.foto} />
              <Caixa x={22} y={22} w={55} h={55} pointerEvents="none" style={{ borderRadius: 14 * k, backgroundColor: t.corIcone, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={t.icone} color="#FFFFFF" size={32 * k} />
              </Caixa>
              <Caixa x={22} y={93} pointerEvents="none"><T s={21} p="700">{t.titulo}</T></Caixa>
              <Caixa x={22} y={123} w={190} pointerEvents="none"><T s={17} c="#C9CFCC" lh={22}>{t.texto}</T></Caixa>
              <SetaCirculo x={t.w - 55} y={118} d={40}><Icon name="chevron" color="#FFFFFF" size={20 * k} /></SetaCirculo>
            </Toque>
          ))}
          {([
            { x: 35, w: 383, titulo: 'Carteira', texto: 'Cupons, benefícios e créditos', icone: 'wallet' as NomeIcone, c: '#2563EB', rota: '/carteira' },
            { x: 435, w: 385, titulo: 'Meu perfil', texto: 'Dados pessoais e preferências', icone: 'person' as NomeIcone, c: '#6B7280', rota: '/perfil' },
          ]).map((c) => (
            <Toque key={c.titulo} x={c.x} y={1176 - 765} w={c.w} h={100} rotulo={c.titulo} onPress={ir(c.rota)}
              style={{ borderRadius: 16 * k, backgroundColor: '#0E1211', borderWidth: 1, borderColor: '#1F2422' }}>
              <Caixa x={25} y={17} w={62} h={62} pointerEvents="none" style={{ borderRadius: 14 * k, backgroundColor: c.c, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={c.icone} color="#FFFFFF" size={34 * k} />
              </Caixa>
              <Caixa x={110} y={22} w={c.w - 175} pointerEvents="none">
                <T s={20} p="700">{c.titulo}</T>
                <T s={17} c="#C9CFCC" lh={21} style={{ marginTop: 6 * k }}>{c.texto}</T>
              </Caixa>
              <SetaCirculo x={c.w - 56} y={32} d={36}><Icon name="chevron" color="#FFFFFF" size={18 * k} /></SetaCirculo>
            </Toque>
          ))}
        </View>
      ) : null}

      {/* última atividade (y 1295–1520) */}
      {ultima ? (
        <View style={{ height: 245 * k }}>
          <Caixa x={33} y={5} w={787} h={225} style={{ borderRadius: 16 * k, backgroundColor: '#0E1211', borderWidth: 1, borderColor: '#1F2422' }}>
            <Caixa x={23} y={20} pointerEvents="none"><T s={21} p="700">Última atividade na pista</T></Caixa>
            <Toque x={650} y={14} w={120} h={36} rotulo="Ver todas as baterias" onPress={ir('/(tabs)/resultados')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12 * k }}>
              <T s={18} c="#D3D8D5" style={{ textDecorationLine: 'underline' }}>Ver todas</T>
              <Icon name="chevron" color="#D3D8D5" size={20 * k} />
            </Toque>
            <Caixa x={24} y={58} w={298} h={150} pointerEvents="none" style={{ borderRadius: 10 * k, overflow: 'hidden' }}>
              <Image source={fundos.ultimaAtividade} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
            </Caixa>
            <Caixa x={343} y={64} w={190} pointerEvents="none">
              <T s={21} p="700" linhas={1}>{ultima.bateria || ultima.tipo}</T>
              <T s={18} c="#C9CFCC" style={{ marginTop: 8 * k }}>{formatarDia(ultima.dia)}</T>
            </Caixa>
            {ultima.pos > 0 ? (
              <Caixa x={537} y={78} h={31} pointerEvents="none" style={{ paddingHorizontal: 14 * k, borderRadius: 8 * k, backgroundColor: '#0E4A27', justifyContent: 'center' }}>
                <T s={17} p="800" c={cor.verde}>{ultima.pos}º LUGAR</T>
              </Caixa>
            ) : null}
            {([
              { x: 343, icone: 'timer' as NomeIcone, v: ultima.melhor ? formatarVolta(ultima.melhor) : '—', r: 'Melhor volta' },
              { x: 503, icone: 'flag' as NomeIcone, v: `#${ultima.kart || '—'}`, r: 'Kart' },
              { x: 640, icone: 'people' as NomeIcone, v: String(ultima.de || '—'), r: 'Pilotos' },
            ]).map((s, i) => (
              <Caixa key={s.r} x={s.x} y={132} w={i === 0 ? 160 : 130} h={64} pointerEvents="none" style={{ flexDirection: 'row', borderLeftWidth: i ? 1 : 0, borderLeftColor: '#3A403D', paddingLeft: i ? 20 * k : 0 }}>
                <Icon name={s.icone} color="#FFFFFF" size={30 * k} />
                <View style={{ marginLeft: 14 * k }}>
                  <T s={23} p="700" style={{ fontVariant: ['tabular-nums'] }}>{s.v}</T>
                  <T s={16} c="#C9CFCC" style={{ marginTop: 4 * k }}>{s.r}</T>
                </View>
              </Caixa>
            ))}
          </Caixa>
        </View>
      ) : null}

      {/* desempenho das últimas baterias: barra mais alta = posição melhor */}
      {barras.length ? (
        <View style={{ height: 190 * k }}>
          <Caixa x={33} y={0} w={787} h={175} style={{ borderRadius: 16 * k, backgroundColor: '#0E1211', borderWidth: 1, borderColor: '#1F2422' }}>
            <Caixa x={23} y={20} pointerEvents="none"><T s={21} p="700">Desempenho das últimas baterias</T></Caixa>
            <Toque x={630} y={14} w={140} h={36} rotulo="Ver meu progresso" onPress={ir('/progresso')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12 * k }}>
              <T s={18} c="#D3D8D5" style={{ textDecorationLine: 'underline' }}>Ver gráfico</T>
              <Icon name="chevron" color="#D3D8D5" size={20 * k} />
            </Toque>
            <Caixa x={50} y={68} w={690} h={86} pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 * k }}>
              {barras.map((b, i) => {
                const nota = b.pos > 0 && b.de > 0 ? 1 - (b.pos - 1) / Math.max(b.de, 1) : 0.15;
                return <View key={i} style={{ flex: 1, height: `${Math.max(12, nota * 100)}%`, borderTopLeftRadius: 3 * k, borderTopRightRadius: 3 * k, backgroundColor: b.pos === 1 ? cor.verde : '#1C9E4E' }} />;
              })}
            </Caixa>
          </Caixa>
        </View>
      ) : null}
    </View>
  );
}
