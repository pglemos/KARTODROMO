/** Contrato público da API (OpenAPI 3.1), servido em /api/transmissao/v1/openapi.json. */
const inteiroOuNulo = { type: ['integer', 'null'] };
const textoOuNulo = { type: ['string', 'null'] };
const dataOuNula = { type: ['string', 'null'], format: 'date-time' };

const respostaErro = (description: string) => ({ description, content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/Problema' } } } });
const erros = { 401: respostaErro('Chave ausente ou inválida'), 429: respostaErro('Limite excedido; veja Retry-After'), 502: respostaErro('Falha momentânea; tente de novo em 1 s'), 503: respostaErro('API não configurada') };
const parametroEtag = { name: 'If-None-Match', in: 'header', required: false, schema: { type: 'string' }, description: 'ETag da última resposta; se nada mudou, a resposta é 304.' };
const parametroKart = { name: 'kart', in: 'query', required: false, schema: { type: 'string' }, description: 'Devolve o volta a volta só deste kart.' };

export const OPENAPI = {
  openapi: '3.1.0',
  info: { title: 'Transmissão ao vivo do Kartódromo de Betim', version: '1.1.0', description: 'Dados oficiais da cronometragem, somente leitura. Tempos em milissegundos; datas em UTC (ISO 8601).' },
  servers: [{ url: 'https://kartodromodebetim.com.br/api/transmissao/v1', description: 'Internet' }],
  security: [{ bearer: [] }, { apiKey: [] }, { chaveNaUrl: [] }],
  paths: {
    '/corrida': {
      get: {
        operationId: 'lerCorrida', summary: 'Classificação da bateria em foco', parameters: [parametroEtag],
        responses: { 200: { description: 'Retrato da bateria', content: { 'application/json': { schema: { $ref: '#/components/schemas/Corrida' } } } }, 304: { description: 'Nada mudou' }, ...erros },
      },
    },
    '/voltas': {
      get: {
        operationId: 'lerVoltas', summary: 'Volta a volta de todos os karts', parameters: [parametroEtag, parametroKart],
        responses: { 200: { description: 'Voltas por piloto', content: { 'application/json': { schema: { $ref: '#/components/schemas/Voltas' } } } }, 304: { description: 'Nada mudou' }, ...erros },
      },
    },
    '/eventos': {
      get: {
        operationId: 'fluxoAoVivo', summary: 'Tempo real por SSE', description: 'Eventos `corrida` e `voltas`, com o retrato completo, ao conectar e a cada mudança. Comentário de ping a cada 15 s.', parameters: [parametroKart],
        responses: { 200: { description: 'Fluxo de eventos', content: { 'text/event-stream': { schema: { type: 'string' } } } }, ...erros },
      },
    },
    '/saude': {
      get: {
        operationId: 'saude', summary: 'Situação do envio da cronometragem', security: [],
        responses: { 200: { description: 'Recebendo', content: { 'application/json': { schema: { $ref: '#/components/schemas/Saude' } } } }, 503: { description: 'Sem sinal há mais de 90 s', content: { 'application/json': { schema: { $ref: '#/components/schemas/Saude' } } } } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearer: { type: 'http', scheme: 'bearer' },
      apiKey: { type: 'apiKey', in: 'header', name: 'X-Api-Key' },
      chaveNaUrl: { type: 'apiKey', in: 'query', name: 'chave', description: 'Só para fonte de navegador que não envia cabeçalho.' },
    },
    schemas: {
      Problema: {
        type: 'object', required: ['title', 'status', 'detail'],
        properties: { type: { type: 'string' }, title: { type: 'string' }, status: { type: 'integer' }, detail: { type: 'string' }, erro: { type: 'string' } },
      },
      Saude: {
        type: 'object',
        properties: { status: { enum: ['ok', 'sem-sinal'] }, sinal: { enum: ['ao-vivo', 'sem-sinal'] }, ultimoRecebimentoEm: dataOuNula, situacao: { $ref: '#/components/schemas/Situacao' } },
      },
      Situacao: { enum: ['sem-bateria', 'preparando', 'aguardando-largada', 'em-andamento', 'bandeira-quadriculada', 'encerrada'] },
      Corrida: {
        type: 'object', required: ['versao', 'atualizadoEm', 'situacao', 'sinal', 'pilotos'],
        properties: {
          versao: { const: 1 }, atualizadoEm: { type: 'string', format: 'date-time' }, recebidoEm: { type: 'string', format: 'date-time' },
          sinal: { enum: ['ao-vivo', 'sem-sinal'] }, situacao: { $ref: '#/components/schemas/Situacao' },
          bateria: {
            type: ['object', 'null'],
            properties: {
              id: { type: 'string' }, nome: { type: 'string' }, tipo: { enum: ['treino', 'classificacao', 'corrida'] }, tipoTexto: { type: 'string' },
              classificacaoPor: { enum: ['melhor-volta', 'voltas-e-tempo'] }, chuva: { type: 'boolean' },
              tracado: { type: 'object', properties: { nome: { type: 'string' }, metros: inteiroOuNulo } },
              bandeira: { enum: ['nenhuma', 'verde', 'amarela', 'vermelha', 'branca', 'quadriculada'] },
              largadaEm: dataOuNula, quadriculadaEm: dataOuNula, encerradaEm: dataOuNula,
              duracaoMs: inteiroOuNulo, decorridoMs: inteiroOuNulo, restanteMs: inteiroOuNulo, tempoEsgotado: { type: 'boolean' },
              voltasProgramadas: inteiroOuNulo, voltasDoLider: { type: 'integer' }, voltasRestantes: inteiroOuNulo,
            },
          },
          melhorVolta: { type: ['object', 'null'], properties: { kart: { type: 'string' }, nome: { type: 'string' }, tempoMs: { type: 'integer' }, tempo: { type: 'string' }, volta: inteiroOuNulo } },
          pilotos: { type: 'array', items: { $ref: '#/components/schemas/Piloto' } },
        },
      },
      Piloto: {
        type: 'object',
        properties: {
          posicao: { type: 'integer' }, kart: { type: 'string' }, nome: { type: 'string' }, categoria: textoOuNulo, voltas: { type: 'integer' },
          ultimaVoltaMs: inteiroOuNulo, ultimaVolta: textoOuNulo, melhorVoltaMs: inteiroOuNulo, melhorVolta: textoOuNulo, melhorVoltaNumero: inteiroOuNulo, melhorDaBateria: { type: 'boolean' },
          tempoTotalMs: { ...inteiroOuNulo, description: 'Já inclui a penalidade.' }, tempoTotal: textoOuNulo,
          diferencaLiderMs: inteiroOuNulo, diferencaLiderVoltas: { type: 'integer' }, diferencaLider: textoOuNulo, intervaloMs: inteiroOuNulo, intervalo: textoOuNulo,
          velocidadeMediaKmh: { type: ['number', 'null'] },
          penalidadeMs: { type: 'integer', description: 'Soma das penalidades de tempo, já aplicada ao total, às diferenças e à posição.' },
          advertencias: { type: 'integer' }, desclassificado: { type: 'boolean' }, terminou: { type: 'boolean' },
        },
      },
      Voltas: {
        type: 'object', required: ['versao', 'atualizadoEm', 'situacao', 'sinal', 'pilotos'],
        properties: {
          versao: { const: 1 }, atualizadoEm: { type: 'string', format: 'date-time' }, sinal: { enum: ['ao-vivo', 'sem-sinal'] }, situacao: { $ref: '#/components/schemas/Situacao' },
          bateria: { type: ['object', 'null'], properties: { id: { type: 'string' }, nome: { type: 'string' } } },
          pilotos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                posicao: { type: 'integer' }, kart: { type: 'string' }, nome: { type: 'string' }, penalidadeMs: { type: 'integer' },
                voltas: {
                  type: 'array',
                  items: { type: 'object', properties: { volta: { type: 'integer' }, tempoMs: inteiroOuNulo, tempo: textoOuNulo, em: { type: 'string', format: 'date-time' }, valida: { type: 'boolean' }, melhor: { type: 'boolean' } } },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;
