# E2E Test Infra: Kartódromo de Betim Mobile Redesign

## Test Philosophy
- Opaque-box, requirement-driven derived strictly from `ORIGINAL_REQUEST.md` and `/Users/pedroguilherme/Downloads/APP KART`.
- No direct dependency on internal implementation designs.
- Verification mechanism operates through accessible component labels, testIDs, text content, and state assertions.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial + Real-World Workloads.

## Feature Inventory & Test Coverage Goals
| # | Feature | Source (Requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|----------------------|:------:|:------:|:------:|
| 1 | F01 - Design System Dark/OLED Tokens | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 2 | F02 - Tabular Numbers & Typography | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 3 | F03 - Floating Bottom Tabs (5 destinations) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 4 | F05 - Home Top Pilotos Ranking | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 5 | F06 - Category Filter Pills | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 6 | F07 - Full Ranking Screen & Search | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 7 | F08 - News Carousel | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 8 | F09 - Full News Reader | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 9 | F10 - Betim Partner Track Header | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 10 | F11 - Track Shortcut Cards | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 11 | F12 - Top Pilotos Betim Local | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 12 | F13 - Track Available Reservations | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 13 | F14 - LiveTime Session Header | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 14 | F15 - Vibrant Purple Fastest Lap Banner | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 15 | F16 - Green Flag Status & Elapsed Timer | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 16 | F17 - Competitors Telemetry Grid/Cards | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 17 | F18 - Cockpit HUD Landscape Mode | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 18 | F19 - Giant Lap Timer & Colored Deltas | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 19 | F20 - Cart State Context & Provider | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 20 | F21 - Agenda Date Selector & Slot List | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 21 | F22 - Battery Detail & Quantity Stepper | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 22 | F23 - Reactive Floating Cart Bar | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 23 | F24 - Cart Modal & Swipe to Remove | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 24 | F25 - Order Actions (Confirm, Clear, Continue) | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 25 | F26 - Career Driver Header & Prestigio | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ |
| 26 | F27 - Efficiency Matrix & Qualified Stats | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ |
| 27 | F28 - Badges Grid & Ranking Rules Modal | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ |

## Test Architecture
- Test Runner: Jest + `@testing-library/react-native`
- Invocation: `npm test -- tests/e2e`
- Format: Deterministic assertions checking screen output, rendered values, color tokens, and state reactivity.
- Directory Layout: `tests/e2e/`
  - `tier1_features.test.tsx` (Tier 1: Feature coverage >= 5 per feature)
  - `tier2_boundaries.test.tsx` (Tier 2: Edge cases, empty states, zero items, limits)
  - `tier3_pairwise.test.tsx` (Tier 3: Multi-tab transitions, cart sync, telemetry updates)
  - `tier4_workloads.test.tsx` (Tier 4: Realistic user journeys: explore -> filter -> book -> cart -> telemetry -> career)

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Piloto Explora Home, Filtra por Categoria e Abre Notícia | F01, F03, F05, F06, F08, F09 | Medium |
| 2 | Usuário Navega em Parceiros, Verifica Pista e Agenda Bateria | F03, F10, F11, F12, F13, F21 | High |
| 3 | Fluxo Completo de Compra: Agenda -> Detalhe -> Carrinho Flutuante -> Swipe Delete -> Checkout | F03, F20, F21, F22, F23, F24, F25 | Very High |
| 4 | Telemetria ao Vivo em Pista e Alternância para Cockpit HUD com Deltas | F03, F14, F15, F16, F17, F18, F19 | Very High |
| 5 | Consulta de Carreira do Piloto, Métricas de Eficiência e Regras do Ranking | F03, F07, F26, F27, F28 | High |

## Coverage Thresholds
- Tier 1: ≥5 per feature (~135 test cases across 27 features)
- Tier 2: ≥5 per feature boundary (~135 test cases)
- Tier 3: ≥27 pairwise combination scenarios
- Tier 4: ≥5 end-to-end workload test cases
- **Total Suite Goal: >300 deterministic test assertions**
