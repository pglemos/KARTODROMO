# Manual da API de transmissão ao vivo

**Kartódromo Internacional de Betim**

Dados oficiais da cronometragem, em tempo real, para quem transmite as corridas (YouTube, vMix, OBS, Singular etc.).
A API é somente leitura e funciona de qualquer lugar com internet.

| | |
|---|---|
| Versão da API | 1 |
| Endereço base (internet) | `https://kartodromodebetim.com.br/api/transmissao/v1` |
| Endereço base (rede local do kartódromo) | `http://192.168.20.249:4050/api/transmissao/v1` |
| Formato | JSON em UTF-8 |
| Tempos | milissegundos (`…Ms`) e texto pronto |
| Datas | UTC, ISO 8601. Em Betim, subtraia 3 horas |

## Sumário

1. Início rápido
2. Todos os endpoints
3. Chave de acesso
4. Tempo real: `GET /eventos`
5. Classificação: `GET /corrida`
6. Volta a volta: `GET /voltas`
7. Punições e advertências
8. Saúde: `GET /saude`
9. Contrato: `GET /openapi.json`
10. Índice: `GET /`
11. Consultas, ETag e limites
12. Códigos de resposta e erros
13. Internet e rede local
14. Como cada situação aparece
15. Exemplos de código
16. Problemas comuns
17. Compatibilidade e suporte

---

## 1. Início rápido

**Testar a chave:**

```bash
curl -H "Authorization: Bearer SUA_CHAVE" https://kartodromodebetim.com.br/api/transmissao/v1/corrida
```

**Receber tudo em tempo real (recomendado):**

```js
const f = new EventSource('https://kartodromodebetim.com.br/api/transmissao/v1/eventos?chave=SUA_CHAVE');
f.addEventListener('corrida', (e) => desenhar(JSON.parse(e.data)));
f.addEventListener('voltas', (e) => desenharVoltas(JSON.parse(e.data)));
```

Sem bateria na pista, a resposta é `200` com a próxima bateria preparada ou o resultado da última encerrada. Os dados
ficam parados até a próxima bateria. Isso não é queda.

---

## 2. Todos os endpoints

Todos usam o método `GET`.

| Endpoint | O que entrega | Chave | Internet | Rede local |
|---|---|---|---|---|
| `/eventos` | tempo real por SSE: eventos `corrida` e `voltas` | sim | sim | sim |
| `/corrida` | bateria e classificação completa | sim | sim | sim |
| `/voltas` | volta a volta de todos os karts | sim | sim | sim |
| `/voltas?kart=78` | volta a volta de um kart | sim | sim | sim |
| `/saude` | se a cronometragem está enviando | não | sim | não |
| `/openapi.json` | contrato da API em OpenAPI 3.1 | não | sim | não |
| `/` (raiz, `/v1`) | lista de endereços, sem dados | não | sim | não |

Endereços completos pela internet:

```text
https://kartodromodebetim.com.br/api/transmissao/v1/eventos
https://kartodromodebetim.com.br/api/transmissao/v1/corrida
https://kartodromodebetim.com.br/api/transmissao/v1/voltas
https://kartodromodebetim.com.br/api/transmissao/v1/saude
https://kartodromodebetim.com.br/api/transmissao/v1/openapi.json
```

**Qual usar:**

- Placar e gráficos ao vivo: `/eventos`.
- Sistema que só sabe consultar: `/corrida` e `/voltas`, 1 vez por segundo.
- Monitorar se os dados estão chegando: `/saude`.
- Gerar código ou testar em Postman, Insomnia e similares: `/openapi.json`.

---

## 3. Chave de acesso

A chave é entregue em particular e é pessoal. Não publique, não coloque na descrição da live nem em código público.
Se vazar, avise para trocarmos.

| Forma | Como enviar | Quando usar |
|---|---|---|
| Bearer | `Authorization: Bearer SUA_CHAVE` | a preferida |
| Cabeçalho | `X-Api-Key: SUA_CHAVE` | sistemas que pedem esse formato |
| Endereço | `?chave=SUA_CHAVE` | OBS, vMix e `EventSource`, que não enviam cabeçalho |

Evite a chave no endereço onde ele possa aparecer na tela, em print ou em gravação.

---

## 4. Tempo real: `GET /eventos`

Conexão aberta por Server-Sent Events (SSE). O servidor envia os dados ao conectar e a cada mudança.

| Evento | Conteúdo |
|---|---|
| `corrida` | igual à resposta de `/corrida` |
| `voltas` | igual à resposta de `/voltas` |
| `: ping` | comentário a cada 15 s, só para manter a conexão |

Exemplo do que trafega:

```text
retry: 2000

id: 42
event: corrida
data: {"versao":1,"situacao":"em-andamento", ... }

id: 42
event: voltas
data: {"versao":1,"situacao":"em-andamento", ... }

: ping
```

Regras:

- Cada evento traz o retrato **completo**. Basta substituir o que está na tela, sem juntar com o anterior.
- `EventSource` reconecta sozinho e, ao voltar, recebe tudo de novo.
- Sem nenhum dado ou ping por mais de 45 s, reconecte.
- Pela internet, se a cronometragem parar de enviar, chega um novo `corrida` com `sinal: "sem-sinal"`.
- Pela internet, `?kart=78` filtra o evento `voltas`. O evento `corrida` continua com todos os pilotos.
- Pela internet, são até 10 conexões abertas por chave. A 11ª recebe `429`.

---

## 5. Classificação: `GET /corrida`

### Resposta completa

```json
{
  "versao": 1,
  "atualizadoEm": "2026-10-08T23:05:00.000Z",
  "recebidoEm": "2026-10-08T23:05:00.120Z",
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
      "posicao": 1,
      "kart": "4",
      "nome": "Ana Souza",
      "categoria": null,
      "voltas": 10,
      "ultimaVoltaMs": 63228,
      "ultimaVolta": "1:03.228",
      "melhorVoltaMs": 62100,
      "melhorVolta": "1:02.100",
      "melhorVoltaNumero": 7,
      "melhorDaBateria": false,
      "tempoTotalMs": 640000,
      "tempoTotal": "10:40.000",
      "diferencaLiderMs": null,
      "diferencaLiderVoltas": 0,
      "diferencaLider": null,
      "intervaloMs": null,
      "intervalo": null,
      "velocidadeMediaKmh": 56.3,
      "penalidadeMs": 0,
      "advertencias": 0,
      "desclassificado": false,
      "terminou": false
    }
  ]
}
```

### Campos gerais

| Campo | Tipo | Significado |
|---|---|---|
| `versao` | número | versão da API: `1` |
| `atualizadoEm` | data | hora em que o retrato foi montado na cronometragem |
| `recebidoEm` | data | só internet: hora em que o site recebeu o retrato |
| `sinal` | texto | só internet: `ao-vivo`, ou `sem-sinal` se não há envio há mais de 90 s. Mostre o último dado e um aviso discreto |
| `situacao` | texto | estado da bateria (tabela abaixo) |
| `bateria` | objeto ou `null` | dados da bateria; `null` em `sem-bateria` |
| `melhorVolta` | objeto ou `null` | melhor volta da bateria |
| `pilotos` | lista | classificação, já na ordem oficial |

### `situacao`

| Valor | Significado |
|---|---|
| `sem-bateria` | não há bateria para mostrar |
| `preparando` | grid montado, sem largada |
| `aguardando-largada` | bandeira verde dada, esperando o 1º kart passar na linha |
| `em-andamento` | correndo |
| `bandeira-quadriculada` | quadriculada dada, karts terminando a volta |
| `encerrada` | o cronometrista encerrou a bateria |

### `bateria`

| Campo | Tipo | Significado |
|---|---|---|
| `id` | texto | identificador único. Quando muda, é outra bateria: limpe a tela |
| `nome` | texto | nome para exibição |
| `tipo` | texto | `treino`, `classificacao` ou `corrida` |
| `tipoTexto` | texto | `Treino`, `Tomada de tempo` ou `Corrida` |
| `classificacaoPor` | texto | `melhor-volta` (treino e tomada) ou `voltas-e-tempo` (corrida) |
| `chuva` | booleano | bateria marcada como chuva |
| `tracado.nome` | texto | nome do traçado |
| `tracado.metros` | número ou `null` | extensão do traçado |
| `bandeira` | texto | `nenhuma`, `verde`, `amarela`, `vermelha`, `branca` ou `quadriculada` |
| `largadaEm` | data ou `null` | início da contagem |
| `quadriculadaEm` | data ou `null` | hora da quadriculada |
| `encerradaEm` | data ou `null` | hora do encerramento |
| `duracaoMs` | número ou `null` | tempo programado; `null` em prova só por voltas |
| `decorridoMs` | número ou `null` | cronômetro, de segundo em segundo. Pode passar da duração, porque o fim é manual |
| `restanteMs` | número ou `null` | tempo que falta, nunca negativo; `null` em prova só por voltas |
| `tempoEsgotado` | booleano | o tempo acabou, mas a bateria só termina quando o cronometrista encerrar |
| `voltasProgramadas` | número ou `null` | total de voltas em prova por voltas |
| `voltasDoLider` | número | voltas completas do 1º colocado |
| `voltasRestantes` | número ou `null` | voltas que faltam em prova por voltas |

### `melhorVolta`

| Campo | Significado |
|---|---|
| `kart`, `nome` | dono da melhor volta. Desclassificado não entra |
| `tempoMs`, `tempo` | tempo da volta, sem punição |
| `volta` | número da volta |

### `pilotos`

| Campo | Tipo | Significado |
|---|---|---|
| `posicao` | número | posição oficial, já com punições e correções do cronometrista |
| `kart` | texto | número do kart. É texto: não converta para número |
| `nome` | texto | nome como aparece no telão |
| `categoria` | texto ou `null` | categoria do piloto |
| `voltas` | número | voltas completas |
| `ultimaVoltaMs` / `ultimaVolta` | número / texto ou `null` | última volta, sem punição |
| `melhorVoltaMs` / `melhorVolta` | número / texto ou `null` | melhor volta válida, sem punição |
| `melhorVoltaNumero` | número ou `null` | em qual volta foi a melhor |
| `melhorDaBateria` | booleano | dono da melhor volta da bateria (destaque roxo, como no telão) |
| `tempoTotalMs` / `tempoTotal` | número / texto ou `null` | soma das voltas **mais a punição**; `null` sem volta completa |
| `diferencaLiderMs` | número ou `null` | atrás do líder em tempo; `null` no líder e em quem está voltas atrás |
| `diferencaLiderVoltas` | número | voltas atrás do líder |
| `diferencaLider` | texto ou `null` | pronto: `+1.500` ou `+2 voltas` |
| `intervaloMs` | número ou `null` | atrás do piloto de cima em tempo; `null` no líder e quando há volta de diferença |
| `intervalo` | texto ou `null` | pronto: `+1.500` ou `+1 volta` |
| `velocidadeMediaKmh` | número ou `null` | média na pista, sem contar a punição |
| `penalidadeMs` | número | soma das punições de tempo em milissegundos |
| `advertencias` | número | quantidade de advertências |
| `desclassificado` | booleano | bandeira preta: vai para o fim |
| `terminou` | booleano | recebeu a quadriculada, ou a bateria foi encerrada |

Na tomada de tempo e no treino, `diferencaLider` e `intervalo` são a diferença de **melhor volta**, somada a punição.

Formatos de texto: até 59,999 s vem `58.412`; a partir de 1 minuto vem `1:03.228`.

---

## 6. Volta a volta: `GET /voltas`

Mesma chave e mesma bateria de `/corrida`, com os pilotos na mesma ordem.

| Parâmetro | Exemplo | Efeito |
|---|---|---|
| `kart` (opcional) | `/voltas?kart=78` | devolve só aquele kart. Kart que não está na bateria devolve `pilotos: []` |

### Resposta

```json
{
  "versao": 1,
  "atualizadoEm": "2026-10-29T20:55:09.464Z",
  "sinal": "ao-vivo",
  "situacao": "encerrada",
  "bateria": { "id": "2026-10-29-dc4d54c3", "nome": "BATERIA 17:35 · CORRIDA" },
  "pilotos": [
    {
      "posicao": 1,
      "kart": "78",
      "nome": "Ana Souza",
      "penalidadeMs": 0,
      "voltas": [
        { "volta": 1, "tempoMs": 84636, "tempo": "1:24.636", "em": "2026-10-29T20:18:53.007Z", "valida": true, "melhor": false },
        { "volta": 2, "tempoMs": 67100, "tempo": "1:07.100", "em": "2026-10-29T20:20:00.107Z", "valida": true, "melhor": true }
      ]
    }
  ]
}
```

### Campos

| Campo | Significado |
|---|---|
| `sinal` | só pela internet, igual a `/corrida` |
| `situacao` | igual a `/corrida` |
| `bateria.id`, `bateria.nome` | bateria destas voltas; `bateria` é `null` em `sem-bateria` |
| `pilotos[].posicao`, `kart`, `nome` | iguais a `/corrida` |
| `pilotos[].penalidadeMs` | soma das punições de tempo |
| `voltas[].volta` | número da volta completa |
| `voltas[].tempoMs`, `tempo` | tempo da volta, sem punição |
| `voltas[].em` | hora em que o kart fechou a volta |
| `voltas[].valida` | `false` = anulada pelo cronometrista; não conta como melhor volta |
| `voltas[].melhor` | é a melhor volta deste piloto |

### Regras

- A primeira passagem na linha só abre a contagem e não aparece como volta.
- A lista é sempre completa, do início da bateria até agora. Substitua a anterior, não acrescente: o cronometrista
  pode anular ou apagar passagens, e os números das voltas seguintes mudam quando uma passagem é apagada.
- Conferência: soma de `tempoMs` de todas as voltas + `penalidadeMs` = `tempoTotalMs` de `/corrida`.
- Em uma troca de kart, as voltas acompanham o piloto.

---

## 7. Punições e advertências

### Formato

A punição vem em `penalidadeMs`: **número inteiro em milissegundos**, com a **soma** das punições de tempo do piloto.

| Lançado pelo cronometrista | `penalidadeMs` |
|---|---|
| nenhuma punição | `0` |
| 5 s | `5000` |
| 5 s + 10 s | `15000` |

### Como funciona

1. O cronometrista apura e lança a punição **em segundos, para o piloto**.
2. A punição vale para a bateria inteira. Ela **não altera o tempo de nenhuma volta**.
3. O tempo é **somado** ao do piloto, nunca abatido.
4. A API já entrega os resultados com a punição aplicada, na atualização seguinte. **Não some de novo.**
5. Se o cronometrista retirar a punição, o valor diminui e os tempos e posições voltam ao normal.

### O que muda

| Campo | Corrida | Treino e tomada de tempo |
|---|---|---|
| `penalidadeMs` | sim | sim |
| `tempoTotal` | **inclui** | **inclui** |
| `diferencaLider` | **inclui** | **inclui** |
| `intervalo` | **inclui** | **inclui** |
| `posicao` | **inclui** | **inclui** |
| `ultimaVolta` | não inclui | não inclui |
| `melhorVolta` | não inclui | não inclui |
| tempos em `/voltas` | não inclui | não inclui |
| `velocidadeMediaKmh` | não inclui | não inclui |

### Efeito na ordem

- **Corrida:** só muda a ordem entre karts **na mesma volta**. Quem tem mais voltas continua na frente, mesmo punido.
- **Treino e tomada de tempo:** a ordem usa melhor volta + punição, mas `melhorVolta` mostra a volta pura.

### Exemplo

Corrida com dois karts na mesma volta. O kart 4 chega 2 s na frente do kart 5, mas leva 5 s de punição.

| | Kart 4, antes | Kart 4, depois |
|---|---|---|
| `posicao` | 1 | 2 |
| `penalidadeMs` | `0` | `5000` |
| `tempoTotal` | `10:00.000` | `10:05.000` |
| `ultimaVolta` | `1:03.228` | `1:03.228` |

O kart 5 passa a líder e o kart 4 fica com `diferencaLider` e `intervalo` de `+3.000` (5 s de punição menos 2 s de vantagem).

### Limitação

A API traz só o **total**. Ela não informa em qual volta nem por qual motivo a punição foi dada. Para mostrar um aviso
de punição nova, compare `penalidadeMs` com a leitura anterior do mesmo piloto.

### Advertência e desclassificação

- **Advertência:** não tem tempo e não muda a ordem. Vem a quantidade em `advertencias`.
- **Bandeira preta:** `desclassificado: true`. O piloto vai para o fim e não concorre à melhor volta da bateria.

---

## 8. Saúde: `GET /saude`

Não precisa de chave. Serve para monitoramento, e só existe pela internet.

```json
{ "status": "ok", "sinal": "ao-vivo", "ultimoRecebimentoEm": "2026-10-30T19:33:21.258Z", "situacao": "encerrada" }
```

| Código | `status` | Significado |
|---|---|---|
| `200` | `ok` | a cronometragem enviou nos últimos 90 s |
| `503` | `sem-sinal` | nada recebido há mais de 90 s, normalmente queda de internet no kartódromo |

`status: "ok"` só diz que os dados estão chegando, não que há corrida. Para isso, olhe `situacao`.

---

## 9. Contrato: `GET /openapi.json`

Descrição da API em OpenAPI 3.1, sem chave. Pode ser importada em Postman, Insomnia, Swagger UI ou em geradores de código.

```text
https://kartodromodebetim.com.br/api/transmissao/v1/openapi.json
```

---

## 10. Índice: `GET /`

Abrir `https://kartodromodebetim.com.br/api/transmissao/v1` mostra só a lista de endereços, sem dados e sem chave.
Os dados estão em `/corrida`, `/voltas` e `/eventos`.

---

## 11. Consultas, ETag e limites

Prefira `/eventos`. Se precisar consultar, faça no máximo **1 consulta por segundo** e use o `ETag`:

1. Guarde o cabeçalho `ETag` da resposta.
2. Envie o valor na consulta seguinte, em `If-None-Match`.
3. Se nada mudou, a resposta é `304`, sem corpo. Mantenha o que tem na tela.

Trate o `ETag` como um valor opaco, sem interpretar o conteúdo, e guarde um para cada endereço.

```bash
curl -i -H "Authorization: Bearer SUA_CHAVE" -H 'If-None-Match: "123-ao-vivo"' https://kartodromodebetim.com.br/api/transmissao/v1/corrida
```

| Limite (internet) | Valor | Ao passar |
|---|---|---|
| Consultas | 10 por segundo, por chave, somando todos os computadores | `429` com `Retry-After` |
| Conexões em `/eventos` | 10 abertas por chave | `429` com `Retry-After` |

Cabeçalhos de cada consulta:

| Cabeçalho | Significado |
|---|---|
| `ETag` | versão do conteúdo |
| `RateLimit-Limit` | consultas permitidas por segundo |
| `RateLimit-Remaining` | consultas que restam neste segundo |
| `RateLimit-Reset` | segundos até renovar |
| `Retry-After` | segundos para esperar, em `429` e `502` |
| `X-Request-Id` | código da resposta, para suporte |

A API aceita chamadas de qualquer site (CORS liberado), inclusive de páginas no navegador.

---

## 12. Códigos de resposta e erros

| Código | Significa | O que fazer |
|---|---|---|
| `200` | dados | usar. Sem bateria na pista também é `200` |
| `304` | nada mudou | manter o que tem |
| `401` | chave ausente ou inválida | conferir a chave |
| `404` | endereço errado | conferir o endereço |
| `405` | método errado | usar `GET` |
| `429` | limite excedido | esperar o `Retry-After` |
| `502` | falha momentânea | tentar de novo em 1 s |
| `503` | API sem configuração; em `/saude`, sem sinal | avisar o kartódromo se persistir |

Pela internet, os erros seguem a RFC 9457 (`application/problem+json`):

```json
{
  "type": "about:blank",
  "title": "Chave inválida",
  "status": 401,
  "detail": "Chave ausente ou inválida. Envie no cabeçalho Authorization: Bearer <chave>.",
  "erro": "Chave ausente ou inválida. Envie no cabeçalho Authorization: Bearer <chave>."
}
```

Na rede local, o erro vem só com o campo `erro`.

---

## 13. Internet e rede local

| | Internet | Rede local |
|---|---|---|
| Endereço | `https://kartodromodebetim.com.br/api/transmissao/v1` | `http://192.168.20.249:4050/api/transmissao/v1` |
| Onde funciona | em qualquer lugar | só dentro da rede do kartódromo |
| Endpoints | todos | `/corrida`, `/voltas`, `/eventos` |
| Se a internet do kartódromo cair | para de atualizar e avisa `sem-sinal` | continua funcionando |
| `sinal`, `recebidoEm` | sim | não |
| `ETag` e limite de consultas | sim | não |
| `?kart=` em `/eventos` | sim | não (em `/voltas`, sim) |
| Formato dos erros | RFC 9457 | só `erro` |

Página aberta em `https` não consegue chamar a rede local, porque o navegador bloqueia `http` dentro de `https`.

---

## 14. Como cada situação aparece

| Situação | Como aparece na API |
|---|---|
| Fora de bateria | a próxima preparada, ou a última encerrada, com `200` |
| Grid montado | `situacao: "preparando"`, pilotos sem voltas e campos de tempo `null` |
| Verde dada, ninguém passou | `situacao: "aguardando-largada"` |
| Piloto sem volta completa | `voltas: 0` e tempos `null` |
| Tempo acabou | `tempoEsgotado: true`, e a bateria segue até o cronometrista agir |
| Quadriculada | `situacao: "bandeira-quadriculada"`. `terminou` fica `true` quando o kart cruza a linha |
| Fim da bateria | **sempre manual**: `situacao: "encerrada"` e `terminou: true` para todos |
| Bateria cancelada | `situacao: "encerrada"` |
| Bandeira vermelha | `bandeira: "vermelha"`, e o cronômetro fica parado |
| Queda de internet no kartódromo | `sinal: "sem-sinal"`, com o último dado |
| Volta anulada | `valida: false` em `/voltas`; deixa de contar como melhor volta |
| Passagem apagada | a volta some da lista e os números são refeitos |
| Correção de posição pelo cronometrista | `posicao` já vem corrigida |
| Bateria de ajuste da oficina (equalização) | não aparece na API |

A API não traz documento, telefone nem e-mail. Os nomes vêm como no telão.

---

## 15. Exemplos de código

### JavaScript, consulta com ETag

```js
const URL_API = 'https://kartodromodebetim.com.br/api/transmissao/v1/corrida';
let etag = null;

async function consultar() {
  const headers = { Authorization: 'Bearer SUA_CHAVE' };
  if (etag) headers['If-None-Match'] = etag;
  const r = await fetch(URL_API, { headers });
  if (r.status === 304) return;
  if (r.status === 429 || r.status === 502) return;
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  etag = r.headers.get('etag');
  desenhar(await r.json());
}

setInterval(() => consultar().catch(console.error), 1000);
```

### Python, consulta com ETag

```python
import time
import requests

URL_API = "https://kartodromodebetim.com.br/api/transmissao/v1/corrida"
cabecalhos = {"Authorization": "Bearer SUA_CHAVE"}

while True:
    r = requests.get(URL_API, headers=cabecalhos, timeout=5)
    if r.status_code == 200:
        cabecalhos["If-None-Match"] = r.headers["ETag"]
        dados = r.json()
        for p in dados["pilotos"]:
            print(p["posicao"], p["kart"], p["nome"], p["tempoTotal"], p["penalidadeMs"])
    elif r.status_code == 429:
        time.sleep(int(r.headers.get("Retry-After", 1)))
    time.sleep(1)
```

### Mostrar um aviso de punição nova

```js
const anteriores = new Map();

function verificarPunicoes(corrida) {
  for (const p of corrida.pilotos) {
    const chave = `${corrida.bateria.id}:${p.kart}`;
    const antes = anteriores.get(chave) ?? 0;
    if (p.penalidadeMs > antes) avisar(`Kart ${p.kart}: +${(p.penalidadeMs - antes) / 1000} s de punição`);
    anteriores.set(chave, p.penalidadeMs);
  }
}
```

### OBS ou vMix

Na fonte de navegador, use uma página própria que se conecta a `/eventos?chave=SUA_CHAVE`. Não deixe o endereço aparecer na tela.

---

## 16. Problemas comuns

| Sintoma | Causa | Solução |
|---|---|---|
| `Endereço não encontrado` | endereço incompleto ou errado | usar `/corrida`, `/voltas` ou `/eventos` |
| `401` | chave errada, com espaço ou ausente | copiar a chave de novo |
| Dados parados | não há bateria na pista | olhar `situacao`. Sem bateria é normal |
| `sinal: "sem-sinal"` | internet do kartódromo caiu ou a cronometragem parou de enviar | mostrar o último dado com um aviso |
| `429` | muitas consultas, ou mais de 10 conexões abertas | consultar menos ou usar `/eventos` |
| Sempre `200`, nunca `304` | `If-None-Match` não está sendo enviado, ou o `ETag` é de outro endereço | guardar um `ETag` por endereço |
| Tempo somado duas vezes | punição somada de novo no seu sistema | usar `tempoTotal` como veio |
| Volta duplicada na tela | lista acrescentada em vez de substituída | substituir a lista a cada leitura |
| Tela com dados da bateria anterior | `bateria.id` mudou | limpar a tela quando o `id` mudar |
| Rede local não abre | fora da rede do kartódromo ou página em `https` | usar o endereço da internet |

---

## 17. Compatibilidade e suporte

- Ignore campos desconhecidos: novos campos podem surgir na versão 1.
- Mudança incompatível só numa nova versão (`/v2`).
- A ordem e os tempos são oficiais. Correções aparecem na atualização seguinte.

**Suporte:** Kartódromo Internacional de Betim, cronometragem. Ao relatar um problema, informe o horário, o endereço
usado e o `X-Request-Id` da resposta.
