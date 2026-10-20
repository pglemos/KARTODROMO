# Project: Kartódromo de Betim Mobile Redesign (Dark/OLED Premium)

## Architecture
- **Framework**: React Native 0.86.3, React 19.2.3, Expo SDK 57 (~57.0.28), Expo Router ~57.0.26, TypeScript ~6.0.3 (Strict mode, React Compiler enabled).
- **Styling Architecture**: Custom StyleSheet Design System with centralized semantic tokens in `src/components/theme.ts`.
- **Navigation**: Expo Router Stack root with customized floating capsule `BottomTabBar` in `src/app/(tabs)/_layout.tsx` targeting 5 destinations: Home, Parceiros, LiveTime, Agenda, Carreira.
- **State Management**:
  - `SessionProvider` (`src/session/provider.tsx`) for user authentication and SecureStore token persistence.
  - `CartProvider` (`src/features/cart/context.tsx`) for reactive floating cart and order flow.
  - Domain datasets in `src/mock/kart-data.ts` conforming strictly to TypeScript schemas in `src/types/racing.ts`.
- **Telemetry & Sensor Control**: Screen orientation locking (`expo-screen-orientation`) and KeepAwake (`expo-keep-awake`) for Cockpit HUD mode.

---

## Feature Inventory
Every feature identified during the Survey phase mapped to its assigned milestone:

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F01 | Design System Dark/OLED Tokens | Paleta #000000, #161A1D, #1E2228, #2A2E35 e acentos esportivos (#F59E0B, #00E676, #EF4444, #6F4B89, #3B82F6) | M1 | survey_visual & survey_flows |
| F02 | Tipografia Esportiva & Numerais Tabulares | Headers em caixa alta condensada bold e numerais tabulares `fontVariant: ['tabular-nums']` | M1 | survey_visual & survey_flows |
| F03 | Floating Bottom Navigation Capsule | Barra inferior flutuante estilizada (#121212, pílula ativa #343434) com 5 destinos | M1 | survey_visual & survey_flows |
| F04 | Central Mock & Schema Architecture | Interfaces TypeScript e dataset oficial (pilotos, notícias, pista, telemetria) | M1 | survey_codebase & survey_flows |
| F05 | Home Screen Top Pilotos Preview | Card com ranking top 5 pilotos, iniciais circulares, categoria, XP, badges e pontuação dourada | M2 | survey_visual & survey_flows |
| F06 | Filtro de Categorias Deslizável | Pílulas: [TODOS], [LENDA], [PROFISSIONAL], [SEMI-PRO], [AMADOR], [NOVATO] | M2 | survey_visual & survey_flows |
| F07 | Tela Cheia de Ranking de Pilotos | Rota `src/app/ranking.tsx` com busca por nome, filtros de categoria e ícone `(i)` | M2 | survey_visual & survey_flows |
| F08 | Carrossel de Notícias Esportivas | Carrossel horizontal com fotos de alta qualidade, tags, manchetes e datas | M2 | survey_visual & survey_flows |
| F09 | Leitor Completo de Notícias | Rota `src/app/noticia/[id].tsx` com banner, texto completo, autor e compartilhamento | M2 | survey_visual & survey_flows |
| F10 | Cabeçalho do Kartódromo de Betim | Logo oficial, título, telefone `(31)99884-2898`, WhatsApp, redes e botão favoritar | M3 | survey_visual & survey_flows |
| F11 | Atalhos Rápidos da Pista | Cards para Eventos Concluídos, Ranking da Pista e Ranking de XP | M3 | survey_visual & survey_flows |
| F12 | Top Pilotos Betim Local | Ranking dos pilotos locais da pista com bandeiras MG e recarregar `⟳` | M3 | survey_visual & survey_flows |
| F13 | Reservas Disponíveis na Pista | Seletor de data interativo e listagem de horários para a pista | M3 | survey_visual & survey_flows |
| F14 | LiveTime Cabeçalho de Sessão | Título da bateria, horário, tipo (Escola/Race/Rental) e pista Betim | M4 | survey_visual & survey_flows |
| F15 | Banner Roxo "Volta Mais Rápida" | Faixa roxa neon (#6F4B89) destacando piloto, kart, tempo (0:38.775) e volta (L5) | M4 | survey_visual & survey_flows |
| F16 | Status da Bandeira e Tempo | Bandeira verde (#00E676) + cronômetro de sessão decorrido (0:17:54.548) | M4 | survey_visual & survey_flows |
| F17 | Tabela / Cards de Telemetria | Grid de competidores: Pos, Kart/Nome, Categoria, Volta, Última, Melhor roxa, Diff | M4 | survey_visual & survey_flows |
| F18 | Modo Paisagem Cockpit HUD | Tela horizontal forçada OLED `#000000`, botão `X` de retorno, KeepAwake ativo | M4 | survey_visual & survey_flows |
| F19 | Telemetria Cockpit HUD em Tempo Real | Cronômetro gigante (0:05.8), P1, delta em tempo real (+0:30.121 ⬆ verde / -0:32.878 vermelho) | M4 | survey_visual & survey_flows |
| F20 | Cart State Context | Gerenciamento global de itens, adição, remoção, cálculo e sincronização | M5 | survey_codebase & survey_flows |
| F21 | Agenda Seletor de Data & Baterias | Calendário de dias e lista de baterias com vagas ("12 VAGAS") | M5 | survey_visual & survey_flows |
| F22 | Detalhe da Bateria & Adicionar ao Carrinho | Preço (R$ 110,00), tipo, seletor de quantidade e botão de adicionar | M5 | survey_visual & survey_flows |
| F23 | Barra Flutuante Global de Carrinho | Barra suspensa reativa ("🛒 CARRINHO \| 1 ITENS - R$ 110,00") acima das tabs | M5 | survey_visual & survey_flows |
| F24 | Modal do Carrinho & Swipe to Remove | Bottom sheet com lista, gesto de swipe para remover item e recálculo instantâneo | M5 | survey_visual & survey_flows |
| F25 | Ações de Checkout & Pedido | "CONFIRMAR PEDIDO", "REMOVER TODOS", "CONTINUAR COMPRANDO" e fluxo Pix/Asaas | M5 | survey_codebase & survey_flows |
| F26 | Carreira Cabeçalho do Piloto | Avatar com iniciais, nome, badge Lenda, XP (61.251) e pontos (13.112 PTS) | M6 | survey_visual & survey_flows |
| F27 | Card Eficiência & Estatísticas | Grade 2x3 de Eficiência, card azul Estatísticas Qualificadas (10+ pilotos) e Todas | M6 | survey_visual & survey_flows |
| F28 | Conquistas Grid & Modal Regras | Grade de 12 badges, tela de conquistas e modal "Como Funciona o Ranking" (50/20/20/10) | M6 | survey_visual & survey_flows |
| F29 | E2E Testing Suite (Tiers 1-4) | Suíte de testes automatizados com Category-Partition, BVA, Pairwise e Workloads | M7 | test_infra & survey_flows |
| F30 | Hardening Adversarial (Tier 5) | Testes de cobertura caixa-branca, estresse de renderização, tolerância a falhas | M7 | test_infra & survey_flows |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Design System, Tokens, Icons & Floating Navigation | F01, F02, F03, F04: tokens esportivos Dark/OLED, componentes base, ícones esportivos, `FloatingTabBar` em `src/app/(tabs)/_layout.tsx`, mock central `src/mock/kart-data.ts` | none | DONE |
| M2 | Home Screen, Category Filter & News Module | F05, F06, F07, F08, F09: `src/app/(tabs)/index.tsx`, pílulas deslizáveis, ranking completo `ranking.tsx`, carrossel de notícias, leitor `noticia/[id].tsx` | M1 | DONE |
| M3 | Parceiro / Pista Screen & Track Profile | F10, F11, F12, F13: `src/app/(tabs)/parceiros.tsx`, cabeçalho oficial do kartódromo, redes sociais, atalhos rápidos, ranking local Betim, reservas disponíveis | M1 | DONE |
| M4 | LiveTime Telemetry Grid & Cockpit HUD Horizontal | F14, F15, F16, F17, F18, F19: `src/app/(tabs)/livetime.tsx`, banner roxo volta mais rápida, telemetria em tempo real, `src/app/cockpit-hud.tsx` em modo paisagem OLED | M1 | PLANNED |
| M5 | Agenda, Reactive Floating Cart & Carrinho Flow | F20, F21, F22, F23, F24, F25: `src/features/cart/context.tsx`, barra flutuante de carrinho, `src/app/(tabs)/agenda.tsx`, `src/app/carrinho.tsx` com swipe-to-remove | M1 | PLANNED |
| M6 | Carreira Screen, Driver Stats, Badges & Ranking Modal | F26, F27, F28: `src/app/(tabs)/carreira.tsx`, cards de Eficiência e Estatísticas Qualificadas, tela `conquistas.tsx`, modal `RankingRulesModal.tsx` | M1 | PLANNED |
| M7 | E2E Testing Verification & Adversarial Hardening | F29, F30: 100% dos testes E2E aprovados (Tiers 1-4), hardening adversarial (Tier 5), typecheck, lint, build export | M2, M3, M4, M5, M6 | PLANNED |

---

## Interface Contracts

### M1 (Design System & Navigation) ↔ All Modules
- `useUi().palette`:
  - `background`: `#000000` (root OLED)
  - `surface`: `#161A1D` (elevated cards)
  - `surfaceElevated`: `#1E2228` (nested items)
  - `border`: `#2A2E35`
  - `accent`: `#F59E0B` (sports gold)
  - `neonGreen`: `#00E676`
  - `neonRed`: `#EF4444`
  - `purple`: `#6F4B89`
  - `blue`: `#3B82F6`
- Typography helpers:
  - `styles.tabularNums`: `{ fontVariant: ['tabular-nums'], fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) }`
- Layout spacing:
  - Scroll views on all 5 tabs must use `contentContainerStyle={{ paddingBottom: 120 }}` (or `160` when cart bar is active) to prevent floating navigation overlap.

### M5 (Cart Context) ↔ Agenda & Bottom Navigation
- `useCart()`:
  - `items`: `CartItem[]`
  - `totalQuantity`: `number`
  - `totalPriceCentavos`: `number`
  - `totalPriceFormatted`: `string`
  - `addItem(item: Omit<CartItem, 'totalPriceCentavos'>): void`
  - `removeItem(sessionId: string | number): void`
  - `clearCart(): void`
  - `isCartOpen: boolean`
  - `openCart(): void`, `closeCart(): void`

### M6 (Ranking Formula) ↔ Driver Ranking & Profile
- `calculateRating(efficiency: number, wins: number, xp: number, completedRaces: number): number`
  - Returns `round(0.50 * effPts + 0.20 * winPts + 0.20 * xpPts + 0.10 * racesPts)`
- `isQualifiedSession(gridSize: number): boolean`
  - Returns `gridSize >= 10`

---

## Code Layout
- `src/components/theme.ts`: Central sports dark/OLED design system palette and base styles.
- `src/components/sports-icons.tsx`: High-performance vector icon wrappers (SF Symbols / Material Symbols / SVGs).
- `src/components/floating-tab-bar.tsx`: Custom floating capsule bottom navigation bar.
- `src/components/floating-cart-bar.tsx`: Floating cart bar suspended above navigation tabs.
- `src/components/ranking-rules-modal.tsx`: Modal explaining rating formula and XP rules.
- `src/mock/kart-data.ts`: Strongly-typed mock database reflecting reference drivers, news, and telemetry.
- `src/features/cart/context.tsx`: Reactive cart context provider and hook.
- `src/app/(tabs)/_layout.tsx`: 5-destination tab navigator.
- `src/app/(tabs)/index.tsx`: Home screen.
- `src/app/(tabs)/parceiros.tsx`: Betim partner track screen.
- `src/app/(tabs)/livetime.tsx`: Live telemetry screen.
- `src/app/(tabs)/agenda.tsx`: Sessions agenda and booking screen.
- `src/app/(tabs)/carreira.tsx`: Career and driver profile screen.
- `src/app/ranking.tsx`: Full-screen driver ranking.
- `src/app/cockpit-hud.tsx`: Landscape cockpit HUD telemetry mode.
- `src/app/carrinho.tsx`: Shopping cart checkout drawer/screen.
- `src/app/noticia/[id].tsx`: Full motorsport news article reader.
- `src/app/conquistas.tsx`: Full achievements and badges screen.
- `__tests__/`: Unit and integration test suites.
- `tests/e2e/`: Opaque-box E2E test suite (Tiers 1-4).
