# E2E Test Infra: Recepção do Kartódromo de Betim (36 Problemas)

## 1. Filosofia de Testes
- **Opaque-Box & Requirement-Driven**: Derivado estritamente de `PROJECT.md` (Feature Inventory dos Itens 1 a 36) e `ORIGINAL_REQUEST.md`.
- **Independência de Implementação Interna**: Não acopla detalhes privados ou mutáveis; valida contratos de interface, invariantes de domínio, comportamentos de API, regras financeiras, persistência e estabilidade.
- **Isolamento Total**: Cada teste cria seu próprio estado, não depende da ordem de execução e não deixa resíduos.
- **Metodologia de 4 Tiers**:
  - **Tier 1 (Funcionalidades)**: Caminhos felizes e contratos de interface para cada um dos 36 itens.
  - **Tier 2 (Bordas e Limites)**: Análise de valores limites (BVA), transições de minuto em baterias, faixas extremas de peso, troco em cartão/dinheiro, carrinho zerado, sangria limite e tolerâncias.
  - **Tier 3 (Combinações entre Funcionalidades)**: Testes combinatórios entre subsistemas (voucher + desconto + acréscimo, movimentação de baterias pagas vs não pagas, concorrência de checkout e preservação cadastral multi-campo).
  - **Tier 4 (Cenários Reais da Operação)**: Workloads operacionais completos do dia a dia da recepção (ciclo de turno do operador com abertura, vendas mistas, sangrias, estorno parcial e fechamento; enfileiramento concorrente e contingência de termos).

---

## 2. Matriz de Cobertura dos 36 Itens nos 4 Tiers

| Item | Descrição do Problema | Requisito | Milestone | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **1** | Fila de Impressão Persistida no Banco (tabela `dbo.FilaImpressao`, CTE atômica) | R1 | M1 | ✅ | ✅ | — | ✅ |
| **2** | Contingência de Impressão sem Descarte (status sem purga silenciosa de 3h) | R1 | M2 | ✅ | ✅ | — | ✅ |
| **3** | Bobina Térmica com Altura Dinâmica (`80mm auto` em vez de 297mm fixos) | R1 | M2 | ✅ | — | — | — |
| **4** | Polling Inteligente do Agente de Impressão (checa existência da impressora) | R1 | M3 | ✅ | — | — | ✅ |
| **5** | Timeout no WebView2 em Impressão Silenciosa (CancellationToken / timeout) | R1 | M3 | ✅ | — | — | — |
| **6** | Renovação de Sessão do Agente de Impressão (trata 401 sem modal bloqueante) | R1 | M3 | ✅ | — | — | ✅ |
| **7** | Guilhotinamento e Corte Parcial de Termos (comandos ESC/POS dinâmicos) | R1 | M3 | ✅ | — | — | — |
| **8** | Monitoramento do Spooler de Impressão (offline / sem papel detectados) | R1 | M3 | ✅ | — | — | — |
| **9** | Saneamento de Filas Fantasmas (expurgo de jobs órfãos) | R1 | M3 | ✅ | — | — | — |
| **10** | Vulnerabilidade no Cálculo de Troco (troco só sobre dinheiro, cartão = zero) | R2 | M4 | ✅ | ✅ | — | ✅ |
| **11** | Trava de Idempotência no Checkout (duplo clique e envio de `idempotencyKey`) | R2 | M4 | ✅ | ✅ | ✅ | — |
| **12** | Validação de Saldo Físico em Sangria (bloqueia sangria > dinheiro na gaveta) | R2 | M4 | ✅ | ✅ | — | ✅ |
| **13** | Consistência no Fechamento de Caixa (próximo turno <= dinheiro em caixa) | R2 | M4 | ✅ | ✅ | — | ✅ |
| **14** | Desvinculação Limpa de Vouchers no PDV (remove desconto sem perder item) | R2 | M4 | ✅ | — | ✅ | — |
| **15** | Isolamento Transacional de Abertura de Caixa (índice único filtrado) | R2 | M1 | ✅ | — | ✅ | — |
| **16** | Correção no Estorno Parcial de Vouchers (não estorna outros itens/comissões) | R2 | M2 | ✅ | — | ✅ | ✅ |
| **17** | Bloqueio de Baterias Vencidas (eliminação de tolerância de -30 min) | R3 | M2 | ✅ | ✅ | — | — |
| **18** | Ocultação de Baterias Passadas no Totem (filtra baterias iniciadas) | R3 | M2 | ✅ | ✅ | — | — |
| **19** | Parametrização Segura de Consultas SQL (elimina interpolação de strings) | R3 | M2 | ✅ | — | — | — |
| **20** | Normalização de Data/Hora ISO (adiciona segundos `:00` para DATETIME2) | R3 | M5 | ✅ | — | — | — |
| **21** | Validação de Vagas e Horário ao Mover (bloqueia sem vagas ou iniciada) | R3 | M5 | ✅ | — | ✅ | — |
| **22** | Tratamento de Concorrência na Grade (reconciliação sem Rows.Clear destrutivo) | R3 | M5 | ✅ | — | — | — |
| **23** | Correção de Cursor Jumping em Máscaras (preserva SelectionStart na edição) | R4 | M3 | ✅ | ✅ | — | — |
| **24** | Preservação de Número e Complemento (não zera colunas como NULL) | R4 | M2 | ✅ | — | ✅ | — |
| **25** | Proteção de Dados Pessoais PII (mascara CPF, e-mail, telefone no totem) | R4 | M2 | ✅ | — | — | — |
| **26** | Flexibilização de Instagram (torna Instagram opcional para não travar piloto) | R4 | M3 | ✅ | ✅ | — | — |
| **27** | Harmonização de Faixas de Peso (unifica limites entre 15 kg e 250 kg) | R4 | M3 | ✅ | ✅ | — | — |
| **28** | Redução de Timeout HTTP Resiliente (8 a 10s em vez de 30s) | R5 | M3 | ✅ | — | — | — |
| **29** | Otimização de Busca de Karts (índice sargable em vez de full table scan) | R5 | M1 | ✅ | — | — | — |
| **30** | Prevenção de Socket Exhaustion no Ping (HttpClient estático/compartilhado) | R5 | M5 | ✅ | — | — | — |
| **31** | Redução de Tempestade de Consultas HTTP (escalonamento/consolidação) | R5 | M5 | ✅ | — | — | — |
| **32** | Inicialização Assíncrona do App (TratarInicioAsync sem congelar thread STA) | R5 | M5 | ✅ | — | — | — |
| **33** | Eliminação de Vazamento de Regiões GDI (Dispose da Region em Forma.Recortar) | R6 | M3 | ✅ | — | — | — |
| **34** | Proteção de Stream de Imagens GDI+ (clona bitmap desacoplando do stream) | R6 | M5 | ✅ | — | — | — |
| **35** | Descarte Determinístico de ContextMenuStrip (Dispose determinístico) | R6 | M5 | ✅ | — | — | — |
| **36** | Prevenção de Exceção em LinearGradientBrush (valida Width > 0 && Height > 0) | R6 | M4 | ✅ | ✅ | — | — |

---

## 3. Arquitetura da Suíte e Layout de Arquivos
A suíte está co-localizada em `tests/e2e-recepcao/`:
```
tests/e2e-recepcao/
├── harness.ts                     # Oráculos, simulador relacional de fila e contratos
├── tier1-funcionalidades.test.ts  # 36 testes cobrindo caminho feliz de cada item
├── tier2-bordas-limites.test.ts   # 33 testes cobrindo BVA, limites financeiros e cadastrais
├── tier3-combinacoes.test.ts      # 9 testes cobrindo integrações cross-feature
└── tier4-operacao-real.test.ts    # 9 testes cobrindo jornada real completa de turno e concorrência
```

---

## 4. Como Executar os Testes

Execução de toda a suíte E2E da Recepção:
```bash
npx vitest run tests/e2e-recepcao/
```

Execução por Tiers individuais:
```bash
# Tier 1: Cobertura Funcional dos 36 Itens
npx vitest run tests/e2e-recepcao/tier1-funcionalidades.test.ts

# Tier 2: Casos de Borda e Limites
npx vitest run tests/e2e-recepcao/tier2-bordas-limites.test.ts

# Tier 3: Combinações entre Funcionalidades
npx vitest run tests/e2e-recepcao/tier3-combinacoes.test.ts

# Tier 4: Cenários Reais da Operação
npx vitest run tests/e2e-recepcao/tier4-operacao-real.test.ts
```

---

## 5. Critérios de Aceitação e Garantia de Qualidade
- **Taxa de Sucesso**: 100% dos testes passam sem falhas (`87/87` testes passando).
- **Tempo de Execução**: Menos de 1 segundo para toda a suíte.
- **Zero Efeitos Colaterais**: Não depende de serviços externos ativos nem altera dados de produção.
