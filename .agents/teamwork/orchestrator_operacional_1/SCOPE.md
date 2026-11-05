# Scope: Kartódromo Operacional — Correções e Novos Fluxos

## Architecture
- **Mobile Frontend**: `/Users/pedroguilherme/PROJETOS/kartodromo-operacional` (React Native 0.86, Expo 57, Expo Router, TypeScript, Jest).
- **Backend & Services**: `/Users/pedroguilherme/PROJETOS/KARTODROMO` e `/Users/pedroguilherme/PROJETOS/KARTODROMO-snapshot/lib/app-v1/` (Node.js, TypeScript, SQLite transacional, SSE, timing simulator :4150).
- **Shared Contracts**: Idempotent operations (`operationId`), JWT bearer tokens, RFC 1918 LAN connectivity, W3C SSE event streaming, timing protocols (TRX/P3).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F01 | Base Segura RFC 1918 & Fallback | Suporte a LAN privada em modo Release e tela amigável sem EXPO_PUBLIC_API_URL | M1 | Falha 01 |
| F02 | Auto Refresh JWT 401 | Renovação transparente de token em métodos de escrita (`postar` e `enviarOperacao`) | M1 | Falha 02 |
| F03 | UUID por Dispositivo | UUID persistido no SecureStore/AsyncStorage em vez de deviceId fixo | M1 | Falha 03 |
| F04 | SSE Keep-Alive Ignore | Ignorar eventos ping, heartbeat e comentários sem reconectar | M1 | Falha 04 |
| F05 | SSE W3C Multiline | Tratar mensagens SSE com payloads `data:` de múltiplas linhas | M1 | Falha 05 |
| F06 | Timeout Handshake SSE | Timeout de 5s no handshake inicial do stream SSE | M1 | Falha 06 |
| F07 | RBAC Gerência | Proteger telas administrativas sensíveis com perfil GERENCIA | M1 | Falha 39 |
| F08 | Anti Auto-Bloqueio | Ocultar botão de bloquear a própria conta conectada | M1 | Falha 40 |
| F09 | Confirmação de Senha | Campo de confirmação de senha na criação e alteração de credenciais | M1 | Falha 41 |
| F10 | Filtros de Auditoria | Filtros de lastro (`weight-check`) e frota (`fleet`) no histórico | M1 | Falha 42 |
| F11 | FlatList Paginada | Lista virtualizada paginada na tela de histórico de auditoria | M1 | Falha 43 |
| F12 | Logout Pós-Troca de Senha | Encerrar sessão com aviso e redirecionar ao login após troca da própria senha | M1 | Falha 44 |
| F13 | Fuso America/Sao_Paulo | Formatar horários de baterias e auditoria com fuso horário local | M1 | Falha 45 |
| F14 | Chave Agrupamento Baterias | Remover sufixos de etapa (`-(?:tomada\|corrida\|treino).*`) para evitar duplicidade | M2 | Falha 08 |
| F15 | Ordem Pilotos "Um a um" | Manter ordem original dos pilotos na lista durante sorteio individual | M2 | Falha 09 |
| F16 | Sorteio Baterias Avulsas | Permitir sorteio de avulsas quando recepção offline | M2 | Falha 10 |
| F17 | Preservação Prévia 409 | Preservar escala sorteada na memória em erro 409 e atualizar revisão | M2 | Falha 11 |
| F18 | Botão Recusar Kart | Condição de troca individual considerando karts elegíveis não atribuídos | M2 | Falha 12 |
| F19 | Rótulo 1 Piloto Um a um | Confirmar piloto em vez de rótulo genérico plural | M2 | Falha 13 |
| F20 | Validação Pilotos Aptos | Validar existência de aptos antes de habilitar sorteio | M2 | Falha 14 |
| F21 | Spinner Sorteio Individual | ActivityIndicator no card e bloqueio concorrente durante sorteio | M2 | Falha 15 |
| F22 | ID Persistente Balança | Rastrear piloto selecionado por ID único/kart, não índice | M2 | Falha 16 |
| F23 | Incremento +/- Sem Peso | Habilitar incremento rápido inicializando na meta da bateria | M2 | Falha 17 |
| F24 | Incremento de Zero/Nulo | Inicializar incremento em valor coerente a partir da meta | M2 | Falha 18 |
| F25 | Foco Preservado Balança | Não sobrescrever campo digitado durante sincronização em background | M2 | Falha 19 |
| F26 | Meta de Peso Dinâmica | Meta configurada na categoria/bateria eliminando hardcode 90/100 | M2 | Falha 20 |
| F27 | Banner Conclusão Balança | Banner de conclusão após pesagem do último piloto | M2 | Falha 21 |
| F28 | Arredondamento 1 Casa | Arredondamento padronizado a 1 casa decimal no lastro | M2 | Falha 22 |
| F29 | Campeonatos & Lastros R2 | Configuração de metas (80, 95, 110 kg), regulamentos e regras de pontos | M2 | R2 |
| F30 | Status Frota Fora na Quebra | Atualizar kart para `fora: true` com motivo detalhado na troca | M3 | Falha 23 |
| F31 | Detalhamento de Quebra | Opções ampliadas de quebra e campo de texto livre | M3 | Falha 24 |
| F32 | Karts Alfanuméricos Frota | Suporte a identificadores alfanuméricos e com sufixo | M3 | Falha 25 |
| F33 | Confirmação Toast Não Bloqueante | Toast/banner de troca mantendo visibilidade da grade de pilotos | M3 | Falha 26 |
| F34 | Normalização Zeros à Esquerda | Normalizar numeração de karts evitando duplicidades ('4' vs '04') | M3 | Falha 27 |
| F35 | Idempotência Frota | Utilizar `enviarOperacao` com `operationId` nas ações de frota | M3 | Falha 28 |
| F36 | Payload Frota Padronizado | Padronizar payload `{ fora: true, reason }` e `{ fora: false }` | M3 | Falha 29 |
| F37 | Alertas Todas Baterias | Monitorar todas as baterias agendadas e em preparação na home | M3 | Falha 30 |
| F38 | Trocas & Quebras com O.S. R3 | 9 quebras + 9 defeitos, quarentena/bloqueio, aba gerencial, O.S. com mecânico | M3 | R3 |
| F39 | Bandeiras em Inglês | Enviar IDs aceitos pela cronometragem (`green`, `yellow`, `red`, `checkered`) | M4 | Falha 31 |
| F40 | Confirmação Advertência | Diálogo de confirmação antes de advertir piloto | M4 | Falha 32 |
| F41 | Penalidade Tempo Customizada | Campo para penalidades além de 5s, 10s, 30s | M4 | Falha 33 |
| F42 | Justificativa Opcional Largada | Justificativa opcional para largadas normais de prova | M4 | Falha 34 |
| F43 | Fallback Penalidades Nulas | Proteção contra arrays nulos em penalidades | M4 | Falha 35 |
| F44 | Sincronização Passagens | Atualização periódica/tempo real na tela de passagens | M4 | Falha 36 |
| F45 | Validação MM:SS.mmm | Validação estrita de formato de tempo em registros manuais | M4 | Falha 37 |
| F46 | Destino Kart Passagem | Validar existência do kart destino na bateria antes da transferência | M4 | Falha 38 |
| F47 | Validação Cronometragem R4 | Validação de trocas pelo cronometrista e alertas sonoros/visuais | M4 | R4 |
| F48 | Pesagem Pós-Corrida DSQ R5 | Convocação pós-corrida, Peso NoK -> DSQ rebaixando a último | M4 | R5 |
| F49 | Auditoria de Operador R6 | Gravar operador na trilha e seguir diretrizes de segurança | M4 | R6 |
| F50 | Integração E2E & Simulador | Suíte de testes `npm test` e validação no simulador :4150 | M5 | Validação |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Arquitetura, Conexão, Auth & Admin | F01–F13 (Falhas 01-07, 39-45) | none | DONE (228 tests passing, audit CLEAN) |
| M2 | Baterias, Sorteio, Balança & Campeonatos | F14–F29 (Falhas 08-22 + R2) | M1 | IN_PROGRESS |
| M3 | Frota, Trocas, Aprovação Gerencial & O.S. | F30–F38 (Falhas 23-30 + R3) | M1, M2 | PLANNED |
| M4 | Direção, Cronometragem, Alertas & DSQ | F39–F49 (Falhas 31-38 + R4, R5, R6) | M1, M3 | PLANNED |
| M5 | Verificação E2E & Simulação :4150 | F50 (`npm test`, simulador :4150, integridade) | M1, M2, M3, M4 | PLANNED |

## Code Layout
- `src/core/api/cliente.ts`: Cliente HTTP, validação de base URL, renovação de token, métodos `postar` e `enviarOperacao`.
- `src/core/security/cofre.ts`: Persistência segura de tokens e UUID único do dispositivo.
- `src/core/realtime/stream.ts`: Cliente SSE, leitor de eventos W3C, timeouts e reconexão.
- `src/features/auth/sessao.tsx`: Contexto de autenticação, login, logout e tela de fallback.
- `src/features/operacao/baterias.ts`: Agrupamento e ordenação de baterias.
- `src/features/operacao/sorteio.ts`: Algoritmo de sorteio de karts.
- `src/features/operacao/formato.ts`: Utilitários de formatação e fuso horário.
- `src/app/index.tsx`: Dashboard inicial e alertas globais.
- `src/app/bateria/[id].tsx`: Abas operacionais (Sorteio, Lastro, Galpão, Direção, Recepção).
- `src/app/frota.tsx`: Frota e oficina de karts.
- `src/app/passagens/[id].tsx`: Telemetria de passagens e auditoria de voltas.
- `src/app/historico.tsx`: Trilha de auditoria virtualizada e filtrada.
- `src/app/usuarios.tsx` & `src/app/conta.tsx`: Administração e credenciais.
- `src/app/campeonatos.tsx`: Gestão de campeonatos e regulamentos (R2).
- `src/app/gerencia.tsx`: Gestão gerencial de trocas e O.S. da oficina (R3).

## Interface Contracts
### M1 Core Contracts
- `baseSegura(base: string, desenvolvimento: boolean): boolean`: Retorna true para HTTPS, localhost, e blocos RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
- `obterOuCriarDeviceId(): Promise<string>`: Retorna UUID persistido no SecureStore.
- `postar<T>` & `enviarOperacao`: Em 401, executam `renovar()`, atualizam headers e repetem a requisição transparentemente.
