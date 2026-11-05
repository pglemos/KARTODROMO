import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Brand, Icon } from './brand';
import { Caixa, Toque, cor, useK } from './design-kit';
import { tap } from './motion';
import { rankingApi, type CarreiraPiloto } from '../features/ranking/api';
import { xpDe } from '../features/ranking/gamificacao';
import { useSession } from '../session/provider';

/** carreira de quem está logado (nula sem login ou enquanto carrega) */
export function useMinhaCarreira() {
  const { session } = useSession();
  const [eu, setEu] = useState<CarreiraPiloto | null>(null);
  useEffect(() => {
    if (!session) return;
    let vivo = true;
    rankingApi.minha(session.accessToken).then((d) => { if (vivo) setEu(d); }).catch(() => undefined);
    return () => { vivo = false; };
  }, [session]);
  const xp = session && eu ? xpDe(eu) : 0;
  return { eu: session ? eu : null, logado: !!session, xp, nivel: Math.floor(xp / 500) + 1, xpNivel: xp % 500 };
}

/**
 * Logo, sino e o botão de nível, nas medidas do desenho. `y` é o topo do sino/botão; `detalhe` mostra o XP embaixo do
 * nível (como na agenda).
 */
export function CabecalhoPiloto({ y, logo, detalhe = false }: { y: number; logo: { x: number; y: number; w: number }; detalhe?: boolean }) {
  const k = useK();
  const { logado, nivel, xpNivel } = useMinhaCarreira();
  const ir = (h: Href) => () => { tap(); router.push(h); };
  return (
    <>
      <Caixa x={logo.x} y={logo.y} pointerEvents="none"><Brand width={logo.w * k} /></Caixa>
      <Toque x={detalhe ? 507 : 522} y={y + (detalhe ? 5 : 2)} w={detalhe ? 70 : 66} h={detalhe ? 70 : 66} rotulo="Avisos" onPress={ir(logado ? '/(tabs)/reservas' : '/(auth)/login')}
        style={{ borderRadius: 18 * k, backgroundColor: 'rgba(14,17,16,0.92)', borderWidth: 1, borderColor: '#2A302D', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="bell" color="#FFFFFF" size={34 * k} />
        <View style={{ position: 'absolute', top: 8 * k, right: 9 * k, width: 15 * k, height: 15 * k, borderRadius: 8 * k, backgroundColor: cor.verde, borderWidth: 2 * k, borderColor: '#0E1110' }} />
      </Toque>
      <Toque x={detalhe ? 598 : 605} y={y} w={detalhe ? 225 : 218} h={detalhe ? 70 : 68} rotulo={logado ? `Nível ${nivel}` : 'Entrar'} onPress={ir(logado ? ('/(tabs)/carreira' as Href) : '/(auth)/login')}
        style={{ borderRadius: 35 * k, backgroundColor: 'rgba(14,17,16,0.92)', borderWidth: 1, borderColor: '#2A302D', flexDirection: 'row', alignItems: 'center', paddingLeft: 2 * k }}>
        <View style={{ width: 66 * k, height: 66 * k, borderRadius: 33 * k, borderWidth: 3 * k, borderColor: cor.verde, backgroundColor: '#0B1A10', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="helmet" color={cor.verde} size={38 * k} />
        </View>
        <View style={{ marginLeft: 16 * k, flex: 1 }}>
          {detalhe && logado ? (
            <>
              <Text style={{ color: cor.verde, fontSize: 19 * k, fontWeight: '600' }}>Nível {nivel}</Text>
              <Text style={{ color: '#A9B0AC', fontSize: 16 * k, marginTop: 3 * k }}>{xpNivel} / 500 XP</Text>
            </>
          ) : (
            <Text style={{ color: '#FFFFFF', fontSize: 24 * k, fontWeight: '500' }}>
              {logado ? <>Nível <Text style={{ color: cor.verde, fontWeight: '700' }}>{nivel}</Text></> : 'Entrar'}
            </Text>
          )}
        </View>
        <View style={{ marginRight: 20 * k }}><Icon name="chevron" color="#FFFFFF" size={24 * k} /></View>
      </Toque>
    </>
  );
}
