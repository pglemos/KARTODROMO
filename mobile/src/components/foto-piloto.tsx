import { Image } from 'expo-image';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { rankingApi } from '../features/ranking/api';
import { iniciais } from '../features/ranking/gamificacao';

/** foto do piloto (enviada pelo app); sem foto, um círculo colorido com as iniciais */
export function FotoPiloto({ id, nome, tamanho, cor, versao, claro = true }: { id: string | null; nome: string; tamanho: number; cor: string; versao?: number; claro?: boolean }) {
  const [semFoto, setSemFoto] = useState(!id);
  return (
    <View style={{ width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: cor, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <Text style={{ color: claro ? '#000000' : '#FFFFFF', fontWeight: '900', fontSize: tamanho * 0.36 }}>{iniciais(nome)}</Text>
      {id && !semFoto ? (
        <Image key={`${id}-${versao ?? 0}`} source={{ uri: rankingApi.fotoUrl(id, versao) }} onError={() => setSemFoto(true)}
          transition={250} contentFit="cover" accessibilityIgnoresInvertColors style={{ position: 'absolute', width: tamanho, height: tamanho }} />
      ) : null}
    </View>
  );
}
