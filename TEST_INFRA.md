# Infraestrutura de Testes E2E: Kartódromo Operacional (F01 a F50)

## 1. Filosofia de Testes
- **Opaque-Box & Requirement-Driven**: Derivado estritamente do inventário de funcionalidades de `SCOPE.md` (Features F01 a F50) e dos requisitos de negócio em `ORIGINAL_REQUEST.md`.
- **Independência de Detalhes Internos**: Valida contratos de interface, invariantes de domínio, protocolos de rede (RFC 1918, W3C SSE), regras de segurança (RBAC, cofre, idempotência), cronometragem (:4150) e estabilidade operacional.
- **Isolamento Total**: Cada teste cria seu próprio estado, não depende da ordem de execução, não deixa resíduos e roda de forma determinística em qualquer ambiente (local ou CI).
- **Metodologia de 4 Tiers**:
  - **Tier 1 (Cobertura Funcional)**: Caminhos felizes e contratos de interface para cada uma das 50 features (F01 a F50).
  - **Tier 2 (Bordas e Limites - BVA)**: Análise de valores limite, IPs RFC 1918 extremos e ataques de subdomínio, retry de token 401, buffers fragmentados de SSE, tolerâncias de peso [20, 250 kg], arredondamentos decimais (IEEE 754), karts alfanuméricos com zeros à esquerda e formato estrito `MM:SS.mmm`.
  - **Tier 3 (Combinações Cross-Feature)**: Integrações e transições de estado entre múltiplos subsistemas (Sorteio -> Balança -> Troca no Box -> Direção de Prova; Bateria Tomada + Corrida; Quarentena de Frota -> O.S. -> Liberação por Gerência; Cronometragem -> Balança -> Desclassificação DSQ).
  - **Tier 4 (Cenários Reais da Operação)**: Workloads operacionais completos do dia a dia do kartódromo (ciclo de prova completo: check-in, sorteio "Um a um", pesagem com cálculo de lastro de 5kg/2.5kg, largada, quebra de kart com troca em box e retenção, advertência com diálogo de confirmação, bandeira quadriculada, post-race weight check com DSQ e rebaixamento; recuperação de 401 no meio de operação de pit stop).

---

## 2. Matriz de Cobertura das 50 Features (F01 a F50) nos 4 Tiers

| # | Feature | Descrição Resumida | Requisito | Milestone | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|:---:|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **F01** | Base Segura RFC 1918 | Suporte a LAN privada em Release e tela fallback sem API URL | R1 | M1 | ✅ | ✅ | — | ✅ |
| **F02** | Auto Refresh JWT 401 | Renovação transparente de token em postar e enviarOperacao | R1 | M1 | ✅ | ✅ | — | ✅ |
| **F03** | UUID por Dispositivo | UUID persistido no SecureStore em vez de deviceId fixo | R1 | M1 | ✅ | ✅ | — | ✅ |
| **F04** | SSE Keep-Alive Ignore | Ignorar eventos ping, heartbeat e comentários sem desconectar | R1 | M1 | ✅ | ✅ | — | — |
| **F05** | SSE W3C Multiline | Tratar payloads data: de múltiplas linhas conforme W3C | R1 | M1 | ✅ | ✅ | — | — |
| **F06** | Timeout Handshake SSE | Timeout de 5s no handshake inicial do stream SSE | R1 | M1 | ✅ | ✅ | — | — |
| **F07** | RBAC Gerência | Proteger telas administrativas sensíveis com perfil GERENCIA | R1 | M1 | ✅ | — | ✅ | — |
| **F08** | Anti Auto-Bloqueio | Ocultar botão de bloquear a própria conta conectada | R1 | M1 | ✅ | ✅ | — | — |
| **F09** | Confirmação de Senha | Campo de confirmação de senha na criação e alteração | R1 | M1 | ✅ | ✅ | — | — |
| **F10** | Filtros de Auditoria | Filtros de lastro (`weight-check`) e frota (`fleet`) | R1 | M1 | ✅ | — | — | — |
| **F11** | FlatList Paginada | Lista virtualizada paginada na tela de histórico | R1 | M1 | ✅ | — | — | — |
| **F12** | Logout Pós-Troca de Senha | Encerrar sessão e redirecionar ao login após trocar senha | R1 | M1 | ✅ | — | — | — |
| **F13** | Fuso America/Sao_Paulo | Formatar horários com fuso horário local (UTC-3) | R1 | M1 | ✅ | — | — | — |
| **F14** | Chave Agrupamento Baterias | Remover sufixos de etapa para evitar duplicidade | R1 | M2 | ✅ | — | ✅ | — |
| **F15** | Ordem Pilotos "Um a um" | Preservar ordem original de entrada durante sorteio | R1 | M2 | ✅ | ✅ | ✅ | ✅ |
| **F16** | Sorteio Baterias Avulsas | Permitir sorteio de avulsas quando recepção offline | R1 | M2 | ✅ | — | — | — |
| **F17** | Preservação Prévia 409 | Preservar escala sorteada em memória após 409 e atualizar revisão | R1 | M2 | ✅ | — | — | — |
| **F18** | Botão Recusar Kart | Condição de troca considerando karts elegíveis não atribuídos | R1 | M2 | ✅ | ✅ | — | — |
| **F19** | Rótulo 1 Piloto Um a um | Confirmar piloto em vez de rótulo genérico plural | R1 | M2 | ✅ | ✅ | — | — |
| **F20** | Validação Pilotos Aptos | Validar existência de aptos antes de habilitar sorteio | R1 | M2 | ✅ | ✅ | — | — |
| **F21** | Spinner Sorteio Individual | ActivityIndicator e bloqueio concorrente durante sorteio | R1 | M2 | ✅ | — | — | — |
| **F22** | ID Persistente Balança | Rastrear piloto por ID único/kart e não por índice numérico | R1 | M2 | ✅ | — | — | — |
| **F23** | Incremento +/- Sem Peso | Habilitar incremento rápido inicializando na meta da bateria | R1 | M2 | ✅ | ✅ | — | — |
| **F24** | Incremento de Zero/Nulo | Inicializar incremento em valor coerente a partir da meta | R1 | M2 | ✅ | ✅ | — | — |
| **F25** | Foco Preservado Balança | Não sobrescrever campo digitado durante sync em background | R1 | M2 | ✅ | — | — | — |
| **F26** | Meta de Peso Dinâmica | Meta configurada na categoria (80, 95, 110 kg) sem hardcode | R1 | M2 | ✅ | — | ✅ | ✅ |
| **F27** | Banner Conclusão Balança | Banner de conclusão após pesagem do último piloto | R1 | M2 | ✅ | — | — | — |
| **F28** | Arredondamento 1 Casa | Arredondamento padronizado a 1 casa decimal com vírgula | R1 | M2 | ✅ | ✅ | ✅ | — |
| **F29** | Campeonatos & Lastros R2 | Cálculo de peças de lastro de 5 kg e 2,5 kg por regulamento | R2 | M2 | ✅ | — | ✅ | ✅ |
| **F30** | Status Frota Fora na Quebra | Atualizar kart para `fora: true` com motivo detalhado | R1 | M3 | ✅ | — | ✅ | ✅ |
| **F31** | Detalhamento de Quebra | 9 quebras + 9 defeitos de desempenho + campo livre | R1 | M3 | ✅ | — | — | — |
| **F32** | Karts Alfanuméricos Frota | Suporte a identificadores alfanuméricos e ordenação natural | R1 | M3 | ✅ | ✅ | — | — |
| **F33** | Confirmação Toast Não Bloqueante | Toast de troca mantendo visibilidade da grade de pilotos | R1 | M3 | ✅ | — | — | — |
| **F34** | Normalização Zeros à Esquerda | Normalizar numeração evitando duplicidades ('4' vs '04') | R1 | M3 | ✅ | ✅ | ✅ | — |
| **F35** | Idempotência Frota | Utilizar `enviarOperacao` com `operationId` nas ações de frota | R1 | M3 | ✅ | — | — | — |
| **F36** | Payload Frota Padronizado | Padronizar `{ fora: true, reason }` e `{ fora: false }` | R1 | M3 | ✅ | — | — | — |
| **F37** | Alertas Todas Baterias | Monitorar todas as baterias ativas e em preparação | R1 | M3 | ✅ | — | — | — |
| **F38** | Trocas & Quebras com O.S. R3 | Quarentena, O.S. com mecânico e liberação por GERENCIA | R3 | M3 | ✅ | — | ✅ | ✅ |
| **F39** | Bandeiras em Inglês | Enviar IDs aceitos pela cronometragem (`green`, `yellow`, etc.) | R1 | M4 | ✅ | — | ✅ | ✅ |
| **F40** | Confirmação Advertência | Diálogo de confirmação antes de advertir piloto | R1 | M4 | ✅ | — | — | — |
| **F41** | Penalidade Tempo Customizada | Campo para penalidades além de 5s, 10s e 30s | R1 | M4 | ✅ | — | — | — |
| **F42** | Justificativa Opcional Largada | Justificativa opcional para largadas normais de prova | R1 | M4 | ✅ | — | — | — |
| **F43** | Fallback Penalidades Nulas | Proteção contra arrays nulos em penalidades | R1 | M4 | ✅ | — | — | — |
| **F44** | Sincronização Passagens | Atualização periódica/tempo real na tela de passagens | R1 | M4 | ✅ | — | — | — |
| **F45** | Validação MM:SS.mmm | Validação estrita de formato de tempo em registros manuais | R1 | M4 | ✅ | ✅ | — | — |
| **F46** | Destino Kart Passagem | Validar existência do kart destino na bateria antes da troca | R1 | M4 | ✅ | — | — | — |
| **F47** | Validação Cronometragem R4 | Validação de trocas pelo cronometrista e alertas | R4 | M4 | ✅ | — | ✅ | ✅ |
| **F48** | Pesagem Pós-Corrida DSQ R5 | Convocação pós-corrida, Peso NoK -> DSQ rebaixando a último | R5 | M4 | ✅ | ✅ | ✅ | ✅ |
| **F49** | Auditoria de Operador R6 | Gravar operador na trilha sem expor credenciais em logs | R6 | M4 | ✅ | — | — | — |
| **F50** | Integração E2E & Simulador | Suíte `npm test` automatizada e compatibilidade :4150 | R6 | M5 | ✅ | — | — | ✅ |

---

## 3. Arquitetura da Suíte e Layout de Arquivos
A suíte está implementada no diretório `/Users/pedroguilherme/PROJETOS/kartodromo-operacional/tests/`:
```
tests/
├── harness.ts                           # Modelos determinísticos, contratos e simuladores
├── tier1-features.test.ts               # Cobertura funcional completa F01 a F50 (50 testes)
├── tier2-boundary-corner-cases.test.ts  # Casos de borda, BVA, injeções e concorrência (24 testes)
├── tier3-cross-feature.test.ts          # Workflows integrados e transições de estado (4 testes)
├── tier4-lifecycle-e2e.test.ts          # Cenários reais de corrida e recuperação de rede (2 testes)
├── cliente.test.ts                      # Testes legados de API e cofre (6 testes)
├── tempo-real.test.ts                   # Testes legados de SSE e tempo real (11 testes)
├── sorteio.test.ts                      # Testes legados de sorteio e formatos (6 testes)
└── baterias.test.ts                     # Testes legados de baterias (5 testes)
```

---

## 4. Como Executar os Testes

Executar toda a suíte de testes no projeto operacional:
```bash
cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npm test
```

Executar suítes específicas por Tier:
```bash
# Tier 1: Cobertura Funcional de F01 a F50
cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npx jest tests/tier1-features.test.ts

# Tier 2: Casos de Borda e Limites (BVA)
cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npx jest tests/tier2-boundary-corner-cases.test.ts

# Tier 3: Integrações Cross-Feature
cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npx jest tests/tier3-cross-feature.test.ts

# Tier 4: Cenários Reais e Ciclo de Prova Completo
cd /Users/pedroguilherme/PROJETOS/kartodromo-operacional && npx jest tests/tier4-lifecycle-e2e.test.ts
```

---

## 5. Critérios de Aceitação e Garantia de Qualidade
- **Taxa de Sucesso**: 100% dos testes passam sem falhas (`118 / 118` testes aprovados across 8 test suites).
- **Tempo de Execução**: Menos de 1 segundo para a execução de toda a suíte (`~0.55s`).
- **Isolamento de Ambiente**: Não depende de hardware MYLAPS nem de conexão ativa com o servidor `:4050` de produção, garantindo conformidade com as diretrizes operacionais do kartódromo (`AGENTS.md`).
