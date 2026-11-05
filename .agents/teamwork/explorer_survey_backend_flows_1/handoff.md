# Relatório de Investigação de Backend e Integração Operacional (R2 a R6 e Simulador :4150)

Data: 2026-11-02T20:17:00Z  
Investigador: Explorer 3 (Backend & Integration Explorer)  
Status: Concluído  

---

## 1. Observação

### 1.1. Arquitetura de Worktrees e Localização dos Módulos do Sistema
- No diretório `/Users/pedroguilherme/PROJETOS/`, foram observados os seguintes repositórios e worktrees (`git worktree list`):
  - `/Users/pedroguilherme/PROJETOS/KARTODROMO` (branch `fix/mobile-exclusao-protegida`)
  - `/Users/pedroguilherme/PROJETOS/KARTODROMO-snapshot` (branch `alinhamento/base-app`)
  - `/Users/pedroguilherme/PROJETOS/KARTODROMO-app-op` (branch `feat/app-operacional-f0`)
  - `/Users/pedroguilherme/PROJETOS/kartodromo-operacional` (aplicativo Expo / React Native)
- No branch `alinhamento/base-app` (em `KARTODROMO-snapshot`), foi implementado o módulo `/api/app/v1/` que atende ao aplicativo operacional (`lib/app-v1/`):
  - `lib/app-v1/store.ts`: Banco SQLite transacional nativo (`node:sqlite`) com tabelas `usuarios`, `sessoes`, `operacoes`, `auditoria`, `karts_fora`, `lastros_conferidos`, `revisoes`.
  - `lib/app-v1/auth.ts`: Autenticação scrypt + HMAC JWT com perfis `RECEPCAO`, `OPERACAO`, `GERENCIA`.
  - `lib/app-v1/comandos.ts`: Fila por bateria (`filaPorBateria`), idempotência por `operationId`, validação de `expectedSessionRevision` e registro de auditoria imutável (gatilhos `auditoria_sem_update` e `auditoria_sem_delete`).
  - `lib/app-v1/rotas.ts`: Roteamento HTTP e SSE (`/events`, `/sessions`, `/operations`, `/fleet`, `/equalization`, etc.).
  - `lib/app-v1/operacao.ts`: Ações de sorteio, atrasados, pesagem, troca de kart, penalidades, bandeiras e comandos de prova.
  - `lib/app-v1/regras.ts`: Elegibilidade de inscritos e cálculo de lastro.

### 1.2. Tópico 1: Simulador de Cronometragem Local :4150 vs Produção :4050
- No arquivo `services/timing-server.ts`:
  - **Portas e Configuração** (Linhas 106–114):
    ```ts
    const PORT = Number(process.env.TIMING_PORT || 4050);
    const SIMULATE = process.env.TIMING_SIMULATE === '1';
    const SIM_PORT = Number(process.env.TIMING_SIM_PORT || 5199);
    const ENV_DECODER_HOST = process.env.TIMING_DECODER_HOST || '192.168.20.171';
    const ENV_DECODER_PROTOCOL: DecoderProtocol = process.env.TIMING_DECODER_PROTOCOL === 'trx' ? 'trx' : 'p3';
    const ENV_DECODER_PORT = Number(process.env.TIMING_DECODER_PORT || (ENV_DECODER_PROTOCOL === 'p3' ? 5403 : 5100));
    ```
  - **Seleção Dinâmica do Decoder** (Linhas 439–445):
    ```ts
    let activeDecoderConfig: DecoderConfig = {
      name: configuredDecoder.name || 'TranX',
      model: configuredDecoder.model || 'TranX',
      protocol: SIMULATE ? 'trx' : configuredDecoder.protocol === 'trx' ? 'trx' : configuredDecoder.protocol === 'p3' ? 'p3' : ENV_DECODER_PROTOCOL,
      host: SIMULATE ? '127.0.0.1' : configuredDecoder.host || ENV_DECODER_HOST,
      port: SIMULATE ? SIM_PORT : Number(configuredDecoder.port || ENV_DECODER_PORT),
    };
    ```
  - **Servidor do Simulador TCP Mock** (Linhas 3486–3512):
    ```ts
    function startSimulator() {
      const karts = (process.env.TIMING_SIM_KARTS || '4,5,8,16,29,33,34,38,47,55,57,68').split(',').map((k) => k.trim());
      const lapSec = Number(process.env.TIMING_SIM_LAP_SEC || 65);
      const reverse = new Map(Object.entries(transponderMap).map(([raw, kart]) => [kart, Number(raw)]));
      const base = Date.now();
      const clock = () => (Date.now() - base) % 86_400_000;
      let seq = 1;
      const sim = net.createServer((sock) => {
        const status = setInterval(() => sock.write(`\u0001#\t20\t0\t26\t0\tx0000\r\n`), 5_000);
        const timers = karts.map((kart, i) => {
          const raw = reverse.get(kart) ?? Number(kart);
          const pace = lapSec * (0.97 + (i % 6) * 0.01);
          const loop = () => {
            sock.write(formatTrxPassing({ sequence: seq++, transponder: raw, decoderTimeMs: clock() }));
            t = setTimeout(loop, pace * 1000 * (0.985 + Math.random() * 0.03));
          };
          let t = setTimeout(loop, 1500 + i * 700);
          return () => clearTimeout(t);
        });
        sock.on('close', () => { clearInterval(status); timers.forEach((stop) => stop()); });
        sock.on('error', () => undefined);
      });
      sim.listen(SIM_PORT, '127.0.0.1', () => log(`SIMULADOR de decoder em 127.0.0.1:${SIM_PORT} (karts ${karts.join(',')}, volta ~${lapSec}s)`));
    }
    ```
  - **Ativação no Boot** (Linha 3516):
    `if (SIMULATE) startSimulator();`
  - **Comando Canônico de Execução do Simulador**:
    ```bash
    TIMING_PORT=4150 TIMING_SIMULATE=1 TIMING_SIM_PORT=5199 TIMING_DATA_DIR=/tmp/timing-sim APP_V1_TOKEN_SECRET=01234567890123456789012345678901 npx tsx services/timing-server.ts
    ```
  - **Diferenças Produção vs Simulador**:
    - Produção (:4050): Conecta ao decoder de hardware MYLAPS TranX no IP `192.168.20.171:5403` via protocolo binário P3; grava sessões reais em `C:\repos\KARTODROMO\data\timing`; envia e-mails reais via SMTP; integra com o telão TB50 e painel LED COM3.
    - Simulador (:4150): Sobe decoder TCP sintético local em `127.0.0.1:5199` emitindo passagens TRX falsas; grava em pasta descartável (`TIMING_DATA_DIR`); não interfere em nenhuma sessão de produção nem manda e-mails reais aos clientes.

### 1.3. Tópico 2: R2 - Gestão de Campeonatos e Lastros Personalizados
- **Situação Atual do Lastro**:
  - Em `lib/app-v1/regras.ts` (Linha 17):
    `export const META_KG: Record<Frota, number> = { LIGHT: 90, SUPER: 100 };`
  - Em `kartodromo-operacional/src/app/bateria/[id].tsx` (Linha 459 e 552):
    `<SeletorCompacto opcoes={[{ id: 'LIGHT', nome: 'Light 90 kg' }, { id: 'SUPER', nome: 'Super 100 kg' }]} atual={frota} aoMudar={setFrota} />`
    `const meta = x.lastro?.metaKg ?? (Number(x.kartAtual) >= 100 ? 100 : 90);`
  - Valores estão fixos em 90 kg e 100 kg.
- **Modelos de Campeonato no Backend**:
  - `lib/admin-d1.ts` (Linhas 43–45):
    `campeonatos: { columns: ['id', 'nome', 'slug', 'temporada', 'status', 'formato_id', 'pontos_json', 'desempate_json', 'bonus_pole', 'bonus_melhor_volta', 'descartes'] }`
  - `lib/race-formats.ts`: Motor de pontuação, bônus de volta e critérios canônicos de desempate.
  - `lib/timing/catalog.ts` (Linha 6): `TimingCategory = { id, name, color, sport?, active? }` (não armazena ainda meta de lastro nem regras de pontuação).
- **Lacunas Identificadas**:
  - Necessidade de adicionar `targetWeightKg?: number` e tabela de metas customizadas (80 kg, 95 kg, 110 kg, etc.) vinculada à categoria/campeonato da bateria.
  - Necessidade de rota no app `/api/app/v1/championships` (ou enriquecer `/api/app/v1/sessions/:id` e `/draw-panel` com `metaLastroKg` e regulamento).
  - Necessidade de nova tela/aba no app operacional dedicada a Campeonatos (regras de pontuação, descartes, metas de lastro e critérios de punições).

### 1.4. Tópico 3: R3 - Gestão de Trocas de Kart por Quebra ou Desempenho e Fluxo Gerencial
- **Situação Atual no App e Backend**:
  - Em `kartodromo-operacional/src/app/bateria/[id].tsx` (Linhas 861–865):
    Opções de troca reduzidas a apenas 3 botões simples:
    `{['Kart quebrou', 'Kart ruim', 'Pedido do piloto'].map((m) => ...)}`
  - Em `lib/app-v1/operacao.ts` (Linha 356):
    `if (karts().has(para)) throw new Error(`O kart ${para} está fora de operação.`);`
    Ao trocar o kart, o kart anterior **não é automaticamente retido** nem colocado em quarentena exigindo liberação formal de gerência.
  - A tabela `karts_fora` em `store.ts` possui apenas: `(kart TEXT PRIMARY KEY, motivo TEXT, usuario TEXT, em TEXT)`. Não há status de bloqueio gerencial, tipo de retenção nem vínculo com Ordem de Serviço.
- **Requisitos de Negócio R3**:
  1. Sub-motivos obrigatórios para "Kart quebrou":
     - `embreagem`
     - `cabo de acelerador`
     - `cabo de freio`
     - `corrente`
     - `direção`
     - `pneu`
     - `banco quebrado`
     - `falha no motor`
     - `falha no sensor`
  2. Sub-defeitos obrigatórios para "Kart ruim":
     - `pouco freio`
     - `motor fraco`
     - `kart pulando`
     - `direção puxando`
     - `não vira tempo`
     - `embreagem ruim`
     - `pneu descalibrado`
     - `pneu lonado`
     - `pneu muito cheio`
  3. Retenção obrigatória: Karts substituídos por quebra ou desempenho devem entrar com status `bloqueado` / `retido` em `karts_fora` e tornarem-se indisponíveis para sorteios futuros até liberação formal por usuário com perfil `GERENCIA`.
  4. Fluxo Gerencial & Ordem de Serviço (O.S.):
     - Visualização diária de trocas e quebras.
     - Abertura de O.S. designando mecânico responsável.
     - Ações gerenciais específicas para "Kart ruim":
       - "testar kart"
       - "ajustar kart"
       - "ir para manutenção" (abertura formal de O.S. com mecânico)
       - "equalizar" (encaminhamento dos dados para o módulo de equalização).

### 1.5. Tópico 4: R4 - Validação pela Cronometragem e Alertas em Tempo Real
- **Situação Atual**:
  - `operacao.ts` (Linha 359) invoca diretamente a rota `/api/sessions/:id/swap-kart` na cronometragem. Não existe estado intermediário de confirmação pelo operador da cronometragem.
  - `services/timing-server.ts` aplica a troca imediatamente (`registrarTrocas(s, [troca])`).
  - Em `lib/timing/race-engine.ts` (Linhas 843–848):
    ```ts
    let comp = session.competitors.find((c) => c.kart === p.kart);
    if (!comp) {
      if (session.state === 'bandeira_final') return 'ignored-state';
      comp = { kart: p.kart, name: `Kart ${p.kart}`, autoAdded: true, flag: 'none', crossings: [], finished: false };
      session.competitors.push(comp);
    }
    ```
    Karts que cruzam a linha sem cadastro na prova recebem `autoAdded: true`, mas não há disparo de alerta auditivo ou visual explícito para o operador da cronometragem nem para o galpão.
- **Requisitos de Negócio R4**:
  - Confirmação de troca: O galpão submete a intenção de troca (`pending-swap`), gerando alerta na tela da cronometragem. O cronometrista clica para validar a troca, sincronizando os tempos no grid.
  - Alertas em tempo real:
    - Alerta sonoro (áudio web / beep no desktop) e visual na cronometragem para trocas pendentes vindas do galpão.
    - Alerta sonoro e visual para kart não autorizado na pista (quando detectada passagem de kart não atribuído a competidor ou com `autoAdded: true`).

### 1.6. Tópico 5: R5 - Verificação de Peso Pós-Corrida Solicitada pela Cronometragem e Desclassificação
- **Situação Atual**:
  - O motor `race-engine.ts` já contempla desclassificação:
    - Linha 1042: `dq: c.flag === 'black'`
    - Linhas 1063–1064 e 1090–1091: `if (a.dq !== b.dq) return a.dq ? 1 : -1;` (piloto com bandeira preta / DQ vai para o final do grid).
    - Linha 1210: `desclassificado: r.dq, racingStatus: r.dq ? 3 : 0`
  - No entanto, inexiste hoje o fluxo de convocação pela cronometragem:
    - Cronometragem não possui rota para selecionar pilotos da bateria encerrada e convocar para a balança.
    - Galpão/Balança não recebe banner ou alerta de convocação pós-corrida.
    - Não existe endpoint para o operador registrar "Peso Ok" vs "Peso NoK".
- **Requisitos de Negócio R5**:
  - Rota na cronometragem para solicitar pesagem pós-corrida: `POST /api/sessions/:id/weight-check-requests` com lista de pilotos convocados.
  - Notificação instantânea (via SSE `event: post-race-weight-request`) para o app operacional na tela de Balança.
  - Interface no app com botões "Peso Ok" e "Peso NoK".
  - Se "Peso NoK": o sistema aplica automaticamente a desclassificação (DSQ), ajusta `flag: 'black'`, `desclassificado: true`, rebaixa para última posição e registra motivo formal (`observations` e resultado oficial: "Desclassificado por peso abaixo do regulamento: XX kg").

### 1.7. Tópico 6: R6 - Rastreabilidade, Auditoria de Operador e Diretrizes de Operação
- **Situação Atual na Trilha de Auditoria**:
  - `store.ts` (Linha 40–42): Grava `auditId`, `operationId`, `actorUserId`, `actorRole`, `deviceId`, `timestampServerUTC`, `routeMode`, `action`, `reason`, `after`, `status`.
  - Em `kartodromo-operacional/src/app/historico.tsx`:
    - Linha 58: Utiliza `<ScrollView>` em vez de `<FlatList>` paginada.
    - Linhas 20–25: Filtros contemplam apenas `['', 'penalty', 'draw', 'kart-swap']` — faltam `weight-check` (lastro) e `fleet` (frota).
    - Não exibe o nome/usuário do operador nas linhas da auditoria porque `SELECT * FROM auditoria` só traz o ID (`actorUserId`).
- **Diretrizes de Segurança e Operação**:
  - Nunca expor credenciais em commits ou logs.
  - Proibição absoluta de alterar `FormTV.cs` / `--tv`.
  - Execução de testes restrita ao simulador `:4150`.

---

## 2. Cadeia Lógica (Logic Chain)

1. **Premissa de Isolamento do Simulador**:  
   Conforme observado no código de `services/timing-server.ts` (linhas 106–114 e 3486–3512), o simulador gera tráfego TCP na porta 5199 e roda o servidor HTTP na porta 4150, desacoplado do hardware da pista e do banco de dados de produção. Logo, todos os testes automatizados e validações de integração ponta a ponta podem ser executados com segurança sem qualquer risco para a cronometragem real do kartódromo.

2. **Premissa de Integração do Backend App-v1**:  
   O branch `alinhamento/base-app` (presente em `KARTODROMO-snapshot`) contém o núcleo funcional `/api/app/v1/` com armazenamento SQLite robusto e controle de concorrência. Integrar as novas regras operacionais (R2, R3, R4, R5, R6) diretamente sobre essa base arquitetural garante suporte a idempotência (`operationId`), bloqueio de concorrência por bateria (`filaPorBateria`) e auditoria inviolável.

3. **Cadeia Lógica para R2 (Campeonatos e Lastros)**:  
   Como a função `planoLastro` em `regras.ts` e os seletores no app utilizam `META_KG` fixo de 90 kg e 100 kg, parametrizar `metaKg` na assinatura de `planoLastro` e permitir a persistência de metas personalizadas (80 kg, 95 kg, 110 kg) permite ao galpão calcular com precisão as placas de 5 kg e 2,5 kg para qualquer categoria ou campeonato. Uma nova rota de catálogo e uma seção dedicada no app operacional consolidam a visualização dos regulamentos e tabelas de pontuação.

4. **Cadeia Lógica para R3 (Trocas, Quebras, Bloqueio e O.S.)**:  
   A interface atual aceita motivos genéricos que não alimentam o diagnóstico da mecânica. Ao exigir enumerações fechadas para quebras (9 tipos) e defeitos de desempenho (9 tipos) antes da confirmação, e ao adicionar um campo `statusRetencao = 'RETIDO'` no banco de dados com exigência de permissão `GERENCIA` para liberação, garante-se que karts danificados ou com comportamento anômalo não retornem à pista inadvertidamente. A criação da entidade Ordem de Serviço (O.S.) com mecânico designado e opções de teste/ajuste/equalização fecha o ciclo de manutenção preventiva.

5. **Cadeia Lógica para R4 (Validação da Cronometragem e Alertas)**:  
   Trocas efetuadas pelo galpão afetam a contagem de voltas e a atribuição de transponders. Se o galpão registrar a troca em estado pendente (`status = 'PENDING_VALIDATION'`), o operador da cronometragem pode checar visualmente se o kart já entrou na pista antes de autorizar. A geração de alerta sonoro e visual para trocas pendentes e karts desconhecidos (`autoAdded: true`) elimina o risco de voltas perdidas ou carros correndo fora da planilha oficial.

6. **Cadeia Lógica para R5 (Pesagem Pós-Corrida e DSQ)**:  
   Dado que `race-engine.ts` já implementa `dq: c.flag === 'black'` com rebaixamento automático para a última posição (`racingStatus: 3`), a introdução do comando de conferência pós-corrida conecta a cronometragem à balança via SSE. O veredito "Peso NoK" invoca diretamente a aplicação da bandeira preta por irregularidade técnica, garantindo conformidade regulamentar sem intervenção manual propensa a erros na tabela de resultados.

7. **Cadeia Lógica para R6 (Auditoria e Rastreabilidade)**:  
   Ao enriquecer a consulta de auditoria com `INNER/LEFT JOIN usuarios ON usuarios.id = auditoria.actorUserId` e exportar `actorUsername` e `actorName`, a tela de histórico passa a exibir o nome do operador responsável. A substituição de `ScrollView` por `FlatList` com suporte a paginação e os novos filtros (`weight-check`, `fleet`) atende plenamente aos requisitos de performance e compliance.

---

## 3. Ressalvas e Limitações (Caveats)

1. **Compatibilidade do Branch Base**:
   O código do backend `/api/app/v1/` encontra-se no branch `alinhamento/base-app` (`KARTODROMO-snapshot`). Ao unificar com a árvore principal ou com os testes do app operacional, o arquivo `services/timing-server.ts` deve receber os módulos `lib/app-v1/` para que o servidor `:4150` responda à totalidade das rotas.
2. **Ambiente Mobile Expo**:
   O aplicativo mobile utiliza `expo-secure-store`. Em ambientes de emulador puro ou testes Jest, mocks de `SecureStore` e `AppState` são necessários para validar fluxos sem hardware físico.
3. **Senhas e Variáveis Sensíveis**:
   A variável `APP_V1_TOKEN_SECRET` deve conter ao menos 32 caracteres para que o módulo de segurança inicialize sem ativar o modo `indisponivel: true`.

---

## 4. Conclusão

A arquitetura do backend do Kartódromo suporta perfeitamente as demandas de campeonatos e novos fluxos operacionais:
- O **simulador local `:4150`** é autossuficiente e seguro para testes sem conexão de rede externa.
- O motor de corrida (`race-engine.ts`) já contém a infraestrutura de desclassificação e desempate necessária para suportar R5 (DSQ por peso) e R2 (pontuação de campeonatos).
- As lacunas identificadas concentram-se na parametrização dinâmica de metas de lastro em `lib/app-v1/regras.ts`, enriquecimento dos payloads de troca e retenção em `lib/app-v1/operacao.ts`, adição de rotas de validação pela cronometragem em `timing-server.ts` e paginação/filtros no app operacional.

---

## 5. Método de Verificação Independente

### 5.1. Execução do Simulador Local na Porta :4150
Em `/Users/pedroguilherme/PROJETOS/KARTODROMO` (ou `KARTODROMO-snapshot`):
```bash
TIMING_PORT=4150 TIMING_SIMULATE=1 TIMING_SIM_PORT=5199 TIMING_DATA_DIR=/tmp/test-crono-4150 APP_V1_TOKEN_SECRET=chave-super-secreta-com-mais-de-32-chars-ok npx tsx services/timing-server.ts
```
**Critério de sucesso**:
- Terminal exibe: `SIMULADOR de decoder em 127.0.0.1:5199` e `Cronometragem em http://0.0.0.0:4150`.
- Requisição `curl -s http://127.0.0.1:4150/healthz` responde `{"ok":true,...}`.
- Requisição `curl -s http://127.0.0.1:4150/api/state` responde com o estado inicial da cronometragem.

### 5.2. Verificação dos Testes do Aplicativo Operacional
No diretório `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`:
```bash
npm test
```
**Critério de sucesso**: 4 suítes de teste passando (29 testes executados com 0 falhas).

### 5.3. Verificação dos Testes do Backend App-v1
No diretório `/Users/pedroguilherme/PROJETOS/KARTODROMO-snapshot`:
```bash
npx vitest run tests/app-v1/
```
**Critério de sucesso**: Todas as suítes de teste de autenticação, comandos, operações, fila e rotas executam com sucesso.
