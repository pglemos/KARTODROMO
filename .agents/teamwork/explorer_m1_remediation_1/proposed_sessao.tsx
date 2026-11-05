import { fetch as fetchFluxo } from 'expo/fetch';
import Constants from 'expo-constants';
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { baseSegura, criarCliente, type Cliente } from '@/core/api/cliente';
import { cores, fontes } from '@/core/design-system/tokens';
import { aoConectar, aoDesconectar, aoVoltarDoFundo, aplicarEvento, estadoInicial, type EstadoTempoReal, type EventoEstado } from '@/core/realtime/estado';
import { conectarFluxo } from '@/core/realtime/stream';
import { cofreSeguro, obterOuCriarDeviceId } from '@/core/security/cofre';

export type Eu = { usuario: string; nome: string; perfil: 'RECEPCAO' | 'OPERACAO' | 'GERENCIA'; capacidades: string[] };
type Valor = { cliente: Cliente; eu: Eu | null; carregando: boolean; tempoReal: EstadoTempoReal; entrar(u: string, s: string): Promise<void>; sair(): Promise<void> };
const Contexto = createContext<Valor | null>(null);
const BASE = process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra?.apiUrl as string) ?? '';
const BASE_VALIDA = Boolean(BASE) && baseSegura(BASE, __DEV__);

function ServidorNaoConfigurado() {
  return (
    <View style={estilosFallback.container}>
      <Text style={estilosFallback.titulo}>Servidor Não Configurado</Text>
      <Text style={estilosFallback.mensagem}>
        O endereço da API não foi informado ou é inseguro para este dispositivo.
      </Text>
      <Text style={estilosFallback.detalhe}>
        Configure a variável EXPO_PUBLIC_API_URL com um endereço HTTPS ou IP de rede local privada (RFC 1918: 10.x, 172.16-31.x ou 192.168.x).
      </Text>
    </View>
  );
}

type Acao = { t: 'conectou' } | { t: 'caiu' } | { t: 'fundo' } | { t: 'evento'; e: EventoEstado } | { t: 'zerar' };
function redutor(e: EstadoTempoReal, a: Acao) {
  if (a.t === 'conectou') return aoConectar(e);
  if (a.t === 'caiu') return aoDesconectar(e);
  if (a.t === 'fundo') return aoVoltarDoFundo(e);
  if (a.t === 'evento') return aplicarEvento(e, a.e);
  return estadoInicial;
}

function ProvedorSessaoAtivo({ children }: PropsWithChildren) {
  const [eu, setEu] = useState<Eu | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [tempoReal, despachar] = useReducer(redutor, estadoInicial);
  const fluxo = useRef<ReturnType<typeof conectarFluxo> | null>(null);
  const cliente = useMemo(() => criarCliente({ base: BASE, fetch, cofre: cofreSeguro, aoSair: () => { setEu(null); despachar({ t: 'zerar' }); } }), []);

  useEffect(() => {
    void (async () => {
      try {
        if (await cliente.tokenAtual()) setEu(await cliente.get<Eu>('/me'));
      } catch {
        /* sem rede ou sessão vencida: vai ao login */
      } finally {
        setCarregando(false);
      }
    })();
  }, [cliente]);

  useEffect(() => {
    if (!eu) return;
    const c = conectarFluxo(BASE, fetchFluxo as unknown as typeof fetch, cliente, {
      aoConectar: () => despachar({ t: 'conectou' }), aoDesconectar: () => despachar({ t: 'caiu' }),
      aoEvento: (e) => despachar({ t: 'evento', e }), aoSairDoLogin: () => setEu(null),
    });
    fluxo.current = c;
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') { despachar({ t: 'fundo' }); c.reconectar(); } });
    return () => { sub.remove(); c.parar(); };
  }, [eu, cliente]);

  // sequência quebrada: nova conexão entrega o estado completo
  useEffect(() => { if (tempoReal.precisaSincronizar) fluxo.current?.reconectar(); }, [tempoReal.precisaSincronizar]);

  const valor: Valor = {
    cliente, eu, carregando, tempoReal,
    async entrar(u, s) {
      const deviceId = await obterOuCriarDeviceId();
      await cliente.entrar(u, s, deviceId);
      setEu(await cliente.get<Eu>('/me'));
    },
    sair: () => cliente.encerrar(),
  };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function ProvedorSessao({ children }: PropsWithChildren) {
  if (!BASE_VALIDA) {
    return <ServidorNaoConfigurado />;
  }
  return <ProvedorSessaoAtivo>{children}</ProvedorSessaoAtivo>;
}

export function useSessao() {
  const v = useContext(Contexto);
  if (!v) throw new Error('useSessao fora do provedor');
  return v;
}

const estilosFallback = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: cores.fundo,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  titulo: { color: cores.texto, fontSize: 22, fontFamily: fontes.titulo, marginBottom: 12, textAlign: 'center' },
  mensagem: { color: cores.suave, fontSize: 15, textAlign: 'center', lineHeight: 22, maxWidth: 440, marginBottom: 8 },
  detalhe: { color: cores.apagado, fontSize: 13, textAlign: 'center', lineHeight: 18, maxWidth: 440 },
});
