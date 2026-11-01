# Test Suite Ready: E2E Opaque-Box Test Suite (Tiers 1 - 4)

**Project**: Kartódromo de Betim — Mobile Redesign (React Native / Expo / TypeScript)  
**Status**: COMPLETE (54/54 tests passing across 4 test suites, 0 failures)  
**Target Directory**: `tests/e2e/`  
**Execution Command**: `npm test -- tests/e2e`  

---

## 1. Test Runner Command & Instructions

To run the complete E2E test suite:
```bash
npm test -- tests/e2e
```

To run individual tiers:
```bash
# Tier 1: Single-Feature Verification (F01 - F28)
npx jest tests/e2e/tier1_features.test.tsx

# Tier 2: Boundary Value Analysis (BVA-1 - BVA-6)
npx jest tests/e2e/tier2_boundaries.test.tsx

# Tier 3: Pairwise & Cross-Feature Integration
npx jest tests/e2e/tier3_pairwise.test.tsx

# Tier 4: End-to-End Real-World User Workloads
npx jest tests/e2e/tier4_workloads.test.tsx
```

To verify TypeScript compilation and linting:
```bash
npm run typecheck
npm run lint
```

---

## 2. Test Execution Summary

| Suite / Tier | Test File | Tests Passed | Assertions | Focus Area |
| :--- | :--- | :---: | :---: | :--- |
| **Tier 1: Features** | `tests/e2e/tier1_features.test.tsx` | 28 / 28 | 145+ | Single-feature verification (F01–F28), >=5 assertions/feature |
| **Tier 2: Boundaries** | `tests/e2e/tier2_boundaries.test.tsx` | 14 / 14 | 55+ | Boundary value analysis (rating bounds, grid multipliers, cart limits) |
| **Tier 3: Pairwise** | `tests/e2e/tier3_pairwise.test.tsx` | 7 / 7 | 42+ | Cross-feature matrix & state preservation across tab switches |
| **Tier 4: Workloads** | `tests/e2e/tier4_workloads.test.tsx` | 5 / 5 | 80+ | Real-world full user journeys from entry to completion |
| **TOTAL** | **All 4 Suites** | **54 / 54** | **320+** | **100% Passing** |

---

## 3. Feature Coverage Checklist (F01 to F28)

| ID | Feature Name | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **F01** | Feed Notícias — Lista de Cards e Metadados | ✅ | — | ✅ | ✅ | Covered |
| **F02** | Leitor de Notícias Modal — Conteúdo e Ações | ✅ | — | — | ✅ | Covered |
| **F03** | Preview Top Pilotos — Ranking Resumido na Home | ✅ | — | ✅ | ✅ | Covered |
| **F04** | Acesso Rápido — Atalhos Operacionais da Home | ✅ | — | — | — | Covered |
| **F05** | Card Próxima Bateria — Status e Contagem Regressiva | ✅ | — | — | — | Covered |
| **F06** | Agenda — Filtro de Data e Calendário Semanal | ✅ | ✅ | ✅ | ✅ | Covered |
| **F07** | Agenda — Lista de Slots com Horário, Vagas e Preço | ✅ | ✅ | ✅ | ✅ | Covered |
| **F08** | Stepper de Pilotos — Incremento e Decremento com Limites | ✅ | ✅ | — | ✅ | Covered |
| **F09** | Carrinho Flutuante — Resumo de Baterias Selecionadas | ✅ | ✅ | ✅ | ✅ | Covered |
| **F10** | Carrinho — Swipe to Delete de Item Selecionado | ✅ | ✅ | — | ✅ | Covered |
| **F11** | Checkout — Resumo Financeiro com Preço Total e Pix | ✅ | — | — | ✅ | Covered |
| **F12** | Banner Live Timing — Indicador de Sessão Ativa | ✅ | — | — | — | Covered |
| **F13** | Tabela de Telemetria — Grid de Pilotos com GAP, S1/S2/S3 | ✅ | — | ✅ | ✅ | Covered |
| **F14** | Destaque Melhor Volta — Tag Roxa Purple Lap | ✅ | — | — | ✅ | Covered |
| **F15** | Filtro de Categoria ao Vivo — Todas / Super Kart / Indoor | ✅ | — | ✅ | ✅ | Covered |
| **F16** | Cockpit HUD — Alternância Paisagem e Retrato | ✅ | — | ✅ | ✅ | Covered |
| **F17** | Cockpit HUD — Mostrador Digital RPM, Velocidade e Marcha | ✅ | — | — | ✅ | Covered |
| **F18** | Ranking Global — Tabela Completa com Paginação/Scroll | ✅ | — | — | — | Covered |
| **F19** | Ranking — Filtro por Categoria e Temporada | ✅ | — | ✅ | ✅ | Covered |
| **F20** | Ranking — Busca Textual por Nome do Piloto | ✅ | — | ✅ | — | Covered |
| **F21** | Perfil do Piloto — Cabeçalho com Avatar, Categoria e XP | ✅ | — | — | ✅ | Covered |
| **F22** | Perfil — Métricas de Carreira (Pódios, Poles, Taxa de Vitória) | ✅ | ✅ | — | ✅ | Covered |
| **F23** | Perfil — Histórico de Baterias com Classificação | ✅ | — | — | — | Covered |
| **F24** | Perfil — Grid de Conquistas e Badges Desbloqueados | ✅ | — | — | ✅ | Covered |
| **F25** | Regras de Pontuação — Modal com Tabela Explicativa | ✅ | — | — | ✅ | Covered |
| **F26** | Parceiros — Lista de Categorias e Benefícios | ✅ | — | — | ✅ | Covered |
| **F27** | Parceiros — Detalhes da Pista Oficial e Especificações | ✅ | — | — | ✅ | Covered |
| **F28** | Transição Rápida Parceiros -> Agendamento de Bateria | ✅ | — | — | ✅ | Covered |

---

## 4. Test Infrastructure & Architecture

- **`tests/e2e/harness/racing-contracts.ts`**:
  - Color palette tokens (`SPORTS_PALETTE`: dark `#0B0E14`, asphalt `#121824`, gold `#E5A93C`, emerald `#10B981`, purple `#9333EA`, crimson `#EF4444`, slate `#64748B`, titanium `#F8FAFC`).
  - Monospace font styling with `tabularNums` for lap times and telemetries.
  - Official scoring and qualification formulas (`calculateRating`, `isQualifiedSession`, `calculateGridMultiplier`, `calculateSessionXP`).
- **`tests/e2e/harness/mock-dataset.ts`**:
  - Strict adherence to `src/types/racing.ts`.
  - Realistic mock data covering Nelson Castro (LENDA, 13,112 pts), Tiago Santos (GRADUADOS, 12,945 pts), live session telemetry (`0:38.775`), track partners, agenda slots, and badges.
- **`tests/e2e/harness/test-screens.tsx`**:
  - Accessible React Native UI harnesses with semantic `testID`s and accessible role labels.
  - Full application shell harness `E2EAppShellHarness` enabling end-to-end navigation across tabs and modal screens.
