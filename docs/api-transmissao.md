# API de transmissão ao vivo — Kartódromo Internacional de Betim

Dados oficiais da cronometragem, em tempo real, para quem transmite as corridas (YouTube, vMix, OBS, Singular etc.).
Somente leitura. Versão **1**.

## Endereços

| Onde você está | Endereço | Atualização |
|---|---|---|
| **Fora do kartódromo (internet)** | `https://kartodromodebetim.com.br/api/transmissao/v1/corrida` | consulte **1 vez por segundo** |
| **Dentro do kartódromo (rede local)** | `http://192.168.20.249:4050/api/transmissao/v1/corrida` | consulte quando quiser |
| Rede local, fluxo contínuo (SSE) | `http://192.168.20.249:4050/api/transmissao/v1/eventos` | o servidor empurra a cada mudança (≤ 1 s) |

## Chave de acesso

Toda chamada precisa da sua chave, que o kartódromo entrega em particular. Ela é pessoal: não publique, não coloque
na descrição da live, nem em código público.

```
Authorization: Bearer SUA_CHAVE
```

Também vale `X-Api-Key: SUA_CHAVE`. Para fonte de navegador (OBS/vMix), que não deixa mandar cabeçalho, use
`?chave=SUA_CHAVE` no endereço. Evite esse formato onde o endereço possa aparecer na tela.

Exemplo:

```bash
curl -H "Authorization: Bearer SUA_CHAVE" https://kartodromodebetim.com.br/api/transmissao/v1/corrida
```

Fluxo contínuo na rede local (JavaScript):

```js
const fonte = new EventSource('http://192.168.20.249:4050/api/transmissao/v1/eventos?chave=SUA_CHAVE');
fonte.addEventListener('corrida', (e) => desenhar(JSON.parse(e.data)));
```

## Respostas

| Código | Significa |
|---|---|
| `200` | dados da corrida (abaixo) |
| `401` | chave ausente ou inválida |
| `503` | API ainda não ligada no servidor |
| `502` | falha momentânea: tente de novo em 1 s |

## O que vem em `/corrida`

```json
{
  "versao": 1,
  "atualizadoEm": "2026-10-08T23:05:00.000Z",
  "sinal": "ao-vivo",
  "situacao": "em-andamento",
  "bateria": {
    "id": "2026-10-08-c3d90b4f",
    "nome": "BATERIA 20:00 · CORRIDA",
    "tipo": "corrida",
    "tipoTexto": "Corrida",
    "classificacaoPor": "voltas-e-tempo",
    "chuva": false,
    "tracado": { "nome": "Traçado principal", "metros": 1000 },
    "bandeira": "verde",
    "largadaEm": "2026-10-08T23:00:00.000Z",
    "quadriculadaEm": null,
    "encerradaEm": null,
    "duracaoMs": 600000,
    "decorridoMs": 300000,
    "restanteMs": 300000,
    "tempoEsgotado": false,
    "voltasProgramadas": null,
    "voltasDoLider": 10,
    "voltasRestantes": null
  },
  "melhorVolta": { "kart": "5", "nome": "Bia Lima", "tempoMs": 61900, "tempo": "1:01.900", "volta": 3 },
  "pilotos": [
    {
      "posicao": 1, "kart": "4", "nome": "Ana Souza", "categoria": null, "voltas": 10,
      "ultimaVoltaMs": 63228, "ultimaVolta": "1:03.228",
      "melhorVoltaMs": 62100, "melhorVolta": "1:02.100", "melhorVoltaNumero": 7, "melhorDaBateria": false,
      "tempoTotalMs": 640000, "tempoTotal": "10:40.000",
      "diferencaLiderMs": null, "diferencaLiderVoltas": 0, "diferencaLider": null,
      "intervaloMs": null, "intervalo": null,
      "velocidadeMediaKmh": 56.3, "penalidadeMs": 0, "advertencias": 0, "desclassificado": false, "terminou": false
    },
    {
      "posicao": 2, "kart": "5", "nome": "Bia Lima", "voltas": 10,
      "diferencaLiderMs": 1500, "diferencaLider": "+1.500", "intervaloMs": 1500, "intervalo": "+1.500",
      "melhorDaBateria": true
    }
  ]
}
```
(o segundo piloto está resumido; todos vêm com os mesmos campos)

### Campos

| Campo | Valores |
|---|---|
| `sinal` | só pela internet: `ao-vivo`, ou `sem-sinal` se a cronometragem não envia há mais de 90 s (queda de internet no kartódromo). Mostre o último dado e um aviso discreto |
| `situacao` | `sem-bateria`, `preparando` (grid montado, sem largada), `aguardando-largada` (bandeira verde dada, esperando o 1º kart passar), `em-andamento`, `bandeira-quadriculada`, `encerrada` |
| `bateria.tipo` | `treino`, `classificacao` (tomada de tempo: ordem pela **melhor volta**), `corrida` (ordem por **voltas e tempo**) |
| `bateria.bandeira` | `nenhuma`, `verde`, `amarela`, `vermelha`, `branca`, `quadriculada` |
| `decorridoMs` / `restanteMs` | cronômetro da bateria em milissegundos, de segundo em segundo. `restanteMs` é `null` em prova só por voltas |
| `voltasProgramadas` / `voltasRestantes` | prova por número de voltas (senão `null`) |
| `pilotos` | já na ordem oficial (`posicao` 1, 2, 3…), incluindo penalidades aplicadas pelo cronometrista |
| `diferencaLider` / `intervalo` | texto pronto: `"+1.500"` (segundos.milésimos) ou `"+2 voltas"`; `null` para o líder. Na tomada de tempo é a diferença de **melhor volta** |
| `ultimaVolta`, `melhorVolta`, `tempoTotal` | texto pronto `m:ss.mmm` (ou `ss.mmm`); os campos `…Ms` trazem o número em milissegundos |
| `melhorDaBateria` | `true` no piloto dono da melhor volta da bateria (destaque roxo, como no telão) |
| `desclassificado` | bandeira preta: vai para o fim da classificação |
| `terminou` | já recebeu a quadriculada |

### Regras importantes

- **O fim da bateria é manual**: a `situacao` só vira `encerrada` quando o cronometrista encerra, mesmo com o tempo
  esgotado (`tempoEsgotado: true`).
- Fora de bateria, a API mostra a **próxima bateria preparada** (grid) ou o **resultado da última encerrada**.
- Nomes vêm como aparecem no telão. A API não traz dados pessoais (documento, telefone, e-mail).
- A ordem e os tempos são oficiais. Correções do cronometrista (penalidade, passagem manual) aparecem na próxima
  atualização.

## Limites

- Internet: consulte **no máximo 1 vez por segundo**. O dado é atualizado de segundo em segundo, então consultar mais
  vezes não traz nada mais novo.
- Rede local: use o fluxo `/eventos` (uma conexão aberta) em vez de consultar muitas vezes.

## Suporte

Kartódromo Internacional de Betim, cronometragem. Se a chave vazar, avise para trocarmos.
