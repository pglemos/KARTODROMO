/**
 * Peças das telas da carreira (Meu progresso, Conquistas, Desafios, Metas, Karts do dia): cabeçalho com voltar,
 * cartão, barra de progresso, número grande e o carregamento da carreira da conta.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from './brand';
import { Entrada, ListaEsqueleto, tap } from './motion';
import { useUi } from './theme';
import { MobileApiError } from '../api/client';
import { rankingApi, type CarreiraPiloto } from '../features/ranking/api';
import { useSession } from '../session/provider';

export function voltar() {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)/carreira');
}

/** Tela da carreira com título, voltar, puxar para atualizar e rolagem. */
export function TelaCarreira({ titulo, children, onRefresh, carregando = false, direita }: { titulo: string; children: React.ReactNode; onRefresh?: () => Promise<void> | void; carregando?: boolean; direita?: React.ReactNode }) {
  const { palette } = useUi();
  const [atualizando, setAtualizando] = useState(false);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => { tap(); voltar(); }} hitSlop={10} style={{ padding: 6 }}>
          <Icon name="back" color={palette.text} size={24} />
        </Pressable>
        <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, color: palette.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>{titulo}</Text>
        {direita}
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 14, paddingBottom: 120 }}
        refreshControl={onRefresh ? <RefreshControl refreshing={atualizando} onRefresh={async () => { setAtualizando(true); await onRefresh(); setAtualizando(false); }} tintColor={palette.accent} /> : undefined}>
        {carregando ? <ListaEsqueleto itens={4} altura={110} rotulo="Carregando" /> : children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Bloco({ titulo, children, index = 0, acao }: { titulo?: string; children: React.ReactNode; index?: number; acao?: React.ReactNode }) {
  const { palette } = useUi();
  return (
    <Entrada index={index}>
      <View style={{ backgroundColor: palette.surface, borderRadius: 22, borderWidth: 1, borderColor: palette.borderSubtle, padding: 16, gap: 12 }}>
        {titulo ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, color: palette.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>{titulo.toUpperCase()}</Text>
            {acao}
          </View>
        ) : null}
        {children}
      </View>
    </Entrada>
  );
}

export function Barra({ valor, cor, altura = 8 }: { valor: number; cor: string; altura?: number }) {
  const { palette } = useUi();
  return (
    <View style={{ height: altura, borderRadius: altura / 2, backgroundColor: palette.surfaceElevated, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, valor * 100))}%`, height: altura, borderRadius: altura / 2, backgroundColor: cor }} />
    </View>
  );
}

/** número grande com rótulo embaixo (grade de estatísticas) */
export function Numero({ valor, rotulo, cor, sufixo = '' }: { valor: number | string; rotulo: string; cor?: string; sufixo?: string }) {
  const { palette } = useUi();
  return (
    <View style={{ flex: 1, minWidth: 90, backgroundColor: palette.surfaceElevated, borderRadius: 16, padding: 12, gap: 2 }}>
      <Text style={{ color: cor ?? palette.text, fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{typeof valor === 'number' ? valor.toLocaleString('pt-BR') : valor}{sufixo}</Text>
      <Text style={{ color: palette.textMuted, fontSize: 11, fontWeight: '700' }}>{rotulo.toUpperCase()}</Text>
    </View>
  );
}

/** Carreira da conta logada (ou aviso para entrar). */
export function useMinhaCarreira() {
  const { session } = useSession();
  const [dados, setDados] = useState<CarreiraPiloto | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const carregar = useCallback(async () => {
    if (!session) { setErro('Entre na sua conta para ver a sua carreira.'); setCarregando(false); return; }
    try { setDados(await rankingApi.minha(session.accessToken)); setErro(''); }
    catch (e) { setErro(e instanceof MobileApiError ? e.message : 'Não foi possível carregar a carreira.'); }
    finally { setCarregando(false); }
  }, [session]);
  useEffect(() => { void Promise.resolve().then(carregar); }, [carregar]);
  return { dados, erro, carregando, carregar };
}

export function Aviso({ texto }: { texto: string }) {
  const { palette } = useUi();
  return <Text style={{ color: palette.textSecondary, fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: 40 }}>{texto}</Text>;
}
