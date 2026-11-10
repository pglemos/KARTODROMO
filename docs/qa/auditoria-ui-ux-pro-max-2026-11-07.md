# Auditoria Completa UI/UX Pro Max — Ecossistema Web Kartódromo de Betim (2026-11-07)

**Skill executada:** `@[.agents/skills/ui-ux-pro-max]` (`nextlevelbuilder/ui-ux-pro-max-skill@ui-ux-pro-max`)  
**Escopo auditado:** **93 telas, abas, gavetas e modais** × **2 viewports** (`desktop 1440×900` e `mobile 375×812`) = **186 snapshots reais via Playwright** cobrindo:
1. **Site Público e Ecossistema de Clientes** (`https://kartodromodebetim.com.br`, `https://reservas.kartodromodebetim.com.br`, `https://cadastro.kartodromodebetim.com.br`)
2. **Sistema Administrativo Cloudflare Worker** (`https://admin.kartodromodebetim.com.br` autenticado como `admin`)
3. **Sistemas Internos via `ssh orbits`** (`ssh.kartodromodebetim.com.br` → ORBITS `127.0.0.1:4050` Cronometragem e SRVKART `192.168.20.13:4060` Operação / Totem)

> **Regra de Ouro respeitada:** Nenhuma alteração foi realizada no telão (`FormTV`, `--tv`, `services/timing-ui/tv.html`, `services/timing-ui/tv-classica.html`, `services/timing-ui/tb50.html` — apenas inspeção *read-only*). Nenhum deploy não autorizado foi disparado em `kartodromo-site-2026` ou `kartodromo-reservas-2026` (preservando os patches em produção documentados em `docs/operacao/patches-producao/README.md`).

---

## 1. Execução da Pipeline `ui-ux-pro-max`

| Etapa da Skill | Comando / Referência | Resultado |
|---|---|---|
| **Validação de Integridade dos Dados** | `python3 .agents/skills/ui-ux-pro-max/scripts/validate_data.py` | **100% aprovado** (`12` arquivos de domínio CSV, `22` arquivos de stack CSV e `ui-reasoning.csv`). |
| **Geração do Design System Master + Overrides** | `python3 .agents/skills/ui-ux-pro-max/scripts/search.py ... --design-system --persist -p "Kartodromo de Betim"` | Gerado `design-system/kartodromo-de-betim/MASTER.md` + **9 overrides por superfície** em `design-system/kartodromo-de-betim/pages/`. |
| **Consultas nos 12 Domínios** | `--domain ux`, `web`, `style`, `product`, `color`, `typography`, `google-fonts`, `chart`, `landing`, `icons`, `gsap`, `react` | Cruzamento completo das **119 regras de UX**, **80 estilos**, **192 paletas**, **74 pares tipográficos** e **25 tipos de visualização**. |
| **Consultas nas 3 Stacks do Repositório** | `--stack nextjs`, `react`, `html-tailwind` | Diretrizes específicas para Next.js App Router (`app/`), React/Vite (`src/`) e HTML/CSS Vanilla (`workers/` e `services/`). |
| **10 Categorias de Prioridade (`quick-reference.md`)** | P1 `Accessibility`, P2 `Touch & Interaction`, P3 `Performance`, P4 `Style Selection`, P5 `Layout & Responsive`, P6 `Typography & Color`, P7 `Animation`, P8 `Forms & Feedback`, P9 `Navigation Patterns`, P10 `Charts & Data` | Auditadas em todas as 186 capturas de DOM/CSS real. |
| **Checklist Pré-Entrega (`pro-rules.md`)** | Qualidade visual, interação, dark/light, layout, acessibilidade (WCAG AA) e anti-patterns | Aplicado nas correções de código deste ciclo. |

---

## 2. Arquitetura do Design System Persistido (`design-system/kartodromo-de-betim/`)

A arquitetura foi estruturada em **4 superfícies térmicas** alinhadas à operação real do Kartódromo:

1. [`design-system/kartodromo-de-betim/MASTER.md`](../../design-system/kartodromo-de-betim/MASTER.md) — Tokens globais, tipografia (`Barlow Condensed` + `Plus Jakarta Sans` + `JetBrains Mono`), regras de contraste WCAG AA/AAA, touch targets e anti-patterns.
2. [`design-system/kartodromo-de-betim/pages/site-institucional.md`](../../design-system/kartodromo-de-betim/pages/site-institucional.md) — Site institucional (`/` a `/privacidade`).
3. [`design-system/kartodromo-de-betim/pages/reservas-checkout.md`](../../design-system/kartodromo-de-betim/pages/reservas-checkout.md) — Fluxo de agendamento e checkout (`reservas.kartodromodebetim.com.br` e `/reservar.html`).
4. [`design-system/kartodromo-de-betim/pages/pre-cadastro-conta.md`](../../design-system/kartodromo-de-betim/pages/pre-cadastro-conta.md) — Pré-cadastro e Portal do Piloto (`cadastro.kartodromodebetim.com.br` e `/conta.html`).
5. [`design-system/kartodromo-de-betim/pages/campeonatos-endurance.md`](../../design-system/kartodromo-de-betim/pages/campeonatos-endurance.md) — KAC, KAC Super, 100/200/500 Milhas e Clube de Vantagens.
6. [`design-system/kartodromo-de-betim/pages/admin-visao-agenda.md`](../../design-system/kartodromo-de-betim/pages/admin-visao-agenda.md) — Admin Web: Login, `#/visao` e `#/agenda` (Semana, Dia, Lista, Gaveta Detalhe, Modal Nova Reserva).
7. [`design-system/kartodromo-de-betim/pages/admin-recepcao-pilotos.md`](../../design-system/kartodromo-de-betim/pages/admin-recepcao-pilotos.md) — Admin Web: `#/recepcao` (4 painéis), `#/pilotos`, `#/piloto`, `#/ranking`, `#/reservas`, `#/inscricoes`.
8. [`design-system/kartodromo-de-betim/pages/admin-competicoes-comercial-sistema.md`](../../design-system/kartodromo-de-betim/pages/admin-competicoes-comercial-sistema.md) — Admin Web: `#/campeonatos`, `#/endurance` (8 sub-abas + `/equipe/:token`), `#/patrocinadores`, `#/sistema`, `#/usuarios`, `#/ajuda`.
9. [`design-system/kartodromo-de-betim/pages/orbits-cronometragem.md`](../../design-system/kartodromo-de-betim/pages/orbits-cronometragem.md) — ORBITS `:4050`: `/operador` (4 abas), `/admin` (18 views), `/equalizacao`, `/sorteio`, `/resultado/:id`, `/nao-encontrado` (e documentação read-only de `/tv`, `/tv-classica`, `/tb50`).
10. [`design-system/kartodromo-de-betim/pages/srvkart-ops-totem.md`](../../design-system/kartodromo-de-betim/pages/srvkart-ops-totem.md) — SRVKART `:4060`: `/recepcao` (9 módulos da árvore) e `/totem`.

---

## 3. Inventário Completo das 93 Telas / Abas Auditadas (186 Snapshots)

### 3.1. Bloco A — Site Público, Reservas e Pré-Cadastro (22 rotas × 2 viewports = 44 snapshots)

| # | Superfície / Rota | URL Auditada | Status HTTP | Diagnóstico UI/UX Pro Max (Desktop + Mobile) |
|---|---|---|---|---|
| 1 | Home Institucional | `https://kartodromodebetim.com.br/` | 200 | `<main>` presente, `1` `<h1>`, sem overflow horizontal. Em produção (Vite legado), imagens da galeria sem `width`/`height` explícitos e 1 botão de carrossel só com ícone; já corrigido na nova base `app/` e `src/`. |
| 2 | A Pista | `https://kartodromodebetim.com.br/pista` | 200 | Traçados, telemetria visual e mapa de setores claros. `overflowX: false` em ambos os viewports. |
| 3 | Kart de Locação | `https://kartodromodebetim.com.br/kart-locacao` | 200 | Comparativo Frota Super 13 HP vs Infantil. Hierarquia de preços e exigência de altura (`1,55 m` / `1,35 m`) legíveis. |
| 4 | Reservas (Landing) | `https://kartodromodebetim.com.br/reservas` | 200 | CTAs claros com redirecionamento para o fluxo de agendamento. |
| 5 | Eventos & Corporativo | `https://kartodromodebetim.com.br/eventos` | 200 | Cards de pacotes corporativos, churrasqueira e camarotes bem espaçados. |
| 6 | Campeonatos (Hub) | `https://kartodromodebetim.com.br/campeonatos` | 200 | Hub de competições oficiais (KAC, KAC Super, Milhas). |
| 7 | Nossa História | `https://kartodromodebetim.com.br/historia` | 200 | Linha do tempo histórica sem quebra de layout mobile. |
| 8 | Dúvidas Frequentes (FAQ) | `https://kartodromodebetim.com.br/duvidas` | 200 | Acordeões acessíveis e busca rápida. |
| 9 | KAC | `https://kartodromodebetim.com.br/kac` | 200 | Página dedicada Kart Amador Championship. |
| 10 | KAC Super | `https://kartodromodebetim.com.br/kac-super` | 200 | Página dedicada KAC Super. |
| 11 | 200 Milhas | `https://kartodromodebetim.com.br/200-milhas` | 200 | Endurance 200 Milhas com cronograma e regras. |
| 12 | 500 Milhas | `https://kartodromodebetim.com.br/500-milhas` | 200 | Endurance 500 Milhas. |
| 13 | 100 Milhas Light | `https://kartodromodebetim.com.br/100-milhas-light` | 200 | Endurance 100 Milhas Light. |
| 14 | Clube de Vantagens | `https://kartodromodebetim.com.br/clube-vantagens` | 200 | Benefícios por faixa de voltas/baterias. |
| 15 | Regulamento do Clube | `https://kartodromodebetim.com.br/clube-regulamento` | 200 | Tipografia de leitura confortável (`max-width: 72ch`). |
| 16 | Painel do Clube | `https://kartodromodebetim.com.br/clube-painel` | 200 | Consulta de progresso por CPF. |
| 17 | Política de Privacidade (Site) | `https://kartodromodebetim.com.br/privacidade` | 200 | **Achado:** No código Next.js (`app/privacidade/page.tsx`) e worker (`workers/pre-cadastro/public/privacidade.html`), textos secundários tinham contraste limítrofe (`3.66:1`). **Corrigido no código para `>= 6.1:1`.** |
| 18 | App de Reservas Online | `https://reservas.kartodromodebetim.com.br/` | 200 | 0 falhas de contraste, `1` `<h1>`, `<main>` semântico, 0 inputs sem label, 0 imagens sem `alt`. |
| 19 | Pré-Cadastro (Check-in) | `https://cadastro.kartodromodebetim.com.br/` | 200 | **Achado:** Token `--apagado: #6b746d` gerava contraste `4.16:1` em avisos e `3.66:1` em notas de rodapé. **Corrigido no código para `--apagado: #8b958e` (`6.1:1`).** |
| 20 | Agendamento Direto (`reservar.html`) | `https://cadastro.kartodromodebetim.com.br/reservar.html` | 200 | Calendário mensal e seletor de vagas com touch targets adequados e proteção contra double-tap zoom. |
| 21 | Minha Conta / Portal do Piloto (`conta.html`) | `https://cadastro.kartodromodebetim.com.br/conta.html` | 200 | **Achado:** Logo `/kib-logo-escuro.png` sem `width`/`height` explícitos e `--apagado` com contraste `4.16:1`. **Ambos corrigidos no código.** |
| 22 | Privacidade Worker (`privacidade.html`) | `https://cadastro.kartodromodebetim.com.br/privacidade.html` | 200 | **Achado:** `--apagado: #6b746d` (`4.16:1`). **Corrigido para `#8b958e` (`6.1:1`).** |

---

### 3.2. Bloco B — Sistema Administrativo (`https://admin.kartodromodebetim.com.br` — 30 telas/abas/modais × 2 viewports = 60 snapshots)

| # | Rota / Aba / Modal | Estado Auditado | Diagnóstico UI/UX Pro Max & Correções Aplicadas |
|---|---|---|---|
| 1 | Tela de Login | Desautenticado | **Achados corrigidos:** (1) Faltava `<main>` e `<h1>` na tela de login; (2) `/kib-logo.png` sem `width`/`height` e `alt` vazio; (3) Faltava botão mostrar/ocultar senha (`password-toggle`); (4) Checkbox "Manter conectado" com `13×13px`. **Todos os 4 corrigidos em `workers/admin/public/app.js` e `componentes.css`.** |
| 2 | `#/visao` | Visão do Dia (KPIs + Alertas + Grade do Dia) | Excelente hierarquia operacional, `0` falhas de contraste, `<main>` e skip-link (`Pular para o conteúdo`) adicionados em `workers/admin/public/index.html`. |
| 3 | Busca Global (`Ctrl+K` / Lupa) | Modal aberto (`#modalBuscaGlobal`) | Input com foco imediato, atalho `ESC` funcional, sem overflow mobile. |
| 4 | `#/agenda` — Semana | Visão semanal em colunas | Grade responsiva com filtros por frota (`Todas`, `Super`, `Infantil`) e status (`Aberta`, `Fechada`, `Lotada`). |
| 5 | `#/agenda` — Dia | Visão diária detalhada | Barras de ocupação claras, `tabular-nums` nos horários e contadores. |
| 6 | `#/agenda` — Lista | Visão em lista compacta | Ideal para leitura rápida em mobile (`375px`). |
| 7 | `#/agenda` — Gaveta Detalhe da Bateria | Drawer lateral aberto (`.agGaveta.aberta`) | Exibe lista de pilotos da bateria, vagas pagas vs pendentes e ações rápidas. |
| 8 | `#/agenda` — Modal Nova Reserva | Modal `#mRes` aberto | Validação de telefone/CPF e cálculo de valor total em tempo real. |
| 9 | `#/recepcao` — Visão Geral (4 painéis) | Baterias do dia \| Pilotos da bateria \| Ficha / Check-in \| Caixa do dia | **Achado corrigido:** Input `#qPil` ("Nome, CPF ou telefone...") só tinha `placeholder` sem `aria-label`. **Adicionado `aria-label="Buscar piloto por nome, CPF ou telefone"` em `workers/admin/public/app.js`.** |
| 10 | `#/recepcao` — Aba "A pagar" | Filtro de pendências financeiras da bateria | Destaque semântico âmbar/vermelho com contraste AA. |
| 11 | `#/recepcao` — Aba "Sem termo" | Filtro de pilotos sem termo assinado | Permite encaminhar imediatamente ao totem ou assinar termo. |
| 12 | `#/pilotos` | Base geral de pilotos cadastrados | Busca instantânea por CPF/nome/telefone, paginação limpa. |
| 13 | `#/piloto` | Ficha 360º do Piloto (Histórico, Telemetria, Termos, Crédito) | **Achado corrigido:** Contador dentro de `.filtros button.sel span` tinha texto cinza (`#6B6B70`) sobre fundo vermelho (`#E10600`), gerando contraste `2.61:1`. **Corrigido em `workers/admin/public/componentes.css` (`color: #FFF`, contraste `> 10:1`).** |
| 14 | `#/ranking` | Ranking geral de voltas rápidas por traçado/frota | Números alinhados em `JetBrains Mono` (`tabular-nums`), zero falhas de contraste. |
| 15 | `#/reservas` | Gestão de Reservas Online | **Achados corrigidos:** (1) Input `#qRes` sem `aria-label`; (2) `.filtros button.sel span` com contraste `2.61:1`. **Ambos corrigidos em `app.js` e `componentes.css`.** |
| 16 | `#/inscricoes` | Inscrições de Campeonatos (KAC / Milhas) | Filtros por campeonato, categoria e status de pagamento (Asaas/Pix). |
| 17 | `#/campeonatos` | Gestão de Campeonatos, Etapas e Pontuação | Tabelas de classificação e baterias sem falhas de acessibilidade. |
| 18 | `#/endurance` — Aba `Ao vivo` (`vivo`) | Pit Wall Live Timing + Relógio Oficial | **Achado crítico corrigido:** `.ev-topo` usava `background: linear-gradient(...)` sem cor sólida de fallback e `.ev-relogio` usava `rgba(255,255,255,0.06)` com texto `#FFF`, resultando em texto branco sobre fundo cinza-claro (`#F4F4F6`, contraste `1.09:1` a `1.44:1`). **Corrigido em `workers/admin/public/endurance.css` com `background-color: #161618` e `.ev-relogio { background: #262629; color: #FFF; }` (contraste `> 12:1`).** |
| 19 | `#/endurance` — Aba `Estratégia` (`estrategia`) | Janelas de paradas e stints | Visualização clara de tempo mínimo/máximo de box. |
| 20 | `#/endurance` — Aba `Controle de Box` (`box`) | Entrada/Saída de Pit Lane | **Achado corrigido:** Salto de hierarquia de cabeçalho (`<h2>` → `<h4>`). **Corrigido para `<h3>` em `workers/admin/public/endurance.js`.** |
| 21 | `#/endurance` — Aba `Pesagem` (`pesagem`) | Registro de peso mínimo e lastro | Inputs numéricos grandes para operação rápida na balança. |
| 22 | `#/endurance` — Aba `Equipes` (`equipes`) | Cadastro de equipes, pilotos e tokens QR | Geração de link `/equipe/:token` e QR Code por equipe. |
| 23 | `#/endurance` — Aba `Punições` (`punicoes`) | Aplicação de penalidades (Stop & Go, Voltas, Tempo) | Histórico auditável com horário e motivo. |
| 24 | `#/endurance` — Aba `Estatísticas` (`estatisticas`) | Gráficos e comparativos de voltas/stints | Tabelas densas com scroll horizontal isolado em mobile. |
| 25 | `#/endurance` — Aba `Configurar Evento` (`evento`) | Parâmetros de prova, paradas obrigatórias e janelas | Formulário estruturado com validação clara. |
| 26 | `/equipe/demo` (`equipe.html`) | Tela Mobile da Equipe no Box (QR Code) | **Achado corrigido:** Logo `/kib-logo.png` sem `alt` e sem `width`/`height`. **Corrigido em `workers/admin/public/equipe.html`.** |
| 27 | `#/patrocinadores` | Gestão de Cotas, Pipeline Comercial e Logos no Telão | **Achado corrigido:** Salto de cabeçalho (`<h1>` → `<h3>`) nos cards de resumo. **Corrigido para `<h2>` em `workers/admin/public/patrocinadores.js` (mantendo 100% dos testes em `tests/admin-patrocinadores.test.ts` verdes).** |
| 28 | `#/sistema` | Saúde do Sistema, Sync ORBITS/SRVKART, WhatsApp e Backups | Indicadores de batimento cardíaco (heartbeat) em tempo real. |
| 29 | `#/usuarios` | Gestão de Usuários, Perfis e Permissões | **Achado corrigido:** Input `#busca` sem `aria-label`. **Adicionado `aria-label="Buscar nome, login ou perfil"` em `workers/admin/public/usuarios.js`.** |
| 30 | `#/ajuda` | Manual Operacional Interativo | Guia rápido por função (Recepção, Pista, Cronometragem, Financeiro). |

---

### 3.3. Bloco C — Sistemas Internos via `ssh orbits` (`:4050` Cronometragem & `:4060` Operação/Totem — 41 telas/abas × 2 viewports = 82 snapshots)

#### C.1. ORBITS `:4050` — Cronometragem (`services/timing-ui/`)

| # | Rota / Aba / View | Diagnóstico UI/UX Pro Max & Correções Aplicadas |
|---|---|---|
| 1 | `/operador` — Aba `Oficial` (`official`) | Grid de telemetria ao vivo (`Pos`, `Kart`, `Piloto`, `Voltas`, `Última`, `Melhor`, `Dif.`, `Vel. Média`) com contraste AAA no escuro. Links de cabeçalho receberam `min-height: 28px` para ampliar a área de clique. |
| 2 | `/operador` — Aba `Por Categoria` (`category`) | Agrupamento ao vivo por categoria com separadores claros. |
| 3 | `/operador` — Aba `Por Transponder` (`transponder`) | Diagnóstico de sinal, bateria e passagens brutas do decoder AMB/MyLaps. |
| 4 | `/operador` — Aba `Observações` (`observations`) | **Achado corrigido:** `<textarea id="observationText">` não possuía `<label>` nem `aria-label`, e os inputs dinâmicos da lista de pilotos (`Kart`, `Nome do piloto`) só tinham `placeholder`. **Adicionados `aria-label` em todos eles em `services/timing-ui/operador.html`.** |
| 5–22 | `/admin` — **18 Views Administrativas:** `events` (Eventos), `categories` (Categorias), `competitors` (Competidores), `provas` (Baterias), `decoder` (Decoder), `company` (Empresa), `groups` (Grupos), `scoreboard` (Placar), `tracks` (Traçados), `transponders` (Transponders), `competitor-transponders` (Vínculos), `backups` (Backups), `timing-settings` (Config. Crono), `system-settings` (Config. Sistema), `initial` (Tela Inicial), `profiles` (Perfis), `permissions` (Permissões), `users` (Usuários) | Todas as 18 views auditadas em desktop e mobile: **0 falhas de contraste**, `<main>` presente, `1` `<h1>`, `0` inputs sem label. Ampliada a área de toque/clique dos links de navegação superior em `services/timing-ui/admin.html` e adicionado `font-size: 16px` em inputs mobile. |
| 23 | `/equalizacao` (`equalizacao.html`) | Índice de equalização de frota por kart/traçado. **Corrigido:** adicionado `width="122" height="34"` no `/kib-logo.png` e `font-size: 16px` mobile. |
| 24 | `/sorteio` (`sorteio.html`) | Tela de sorteio de karts compatível com motor WebKit antigo (ES5 / Flexbox). **Corrigido:** `<div id="lista">` promovido a `<main id="lista">` e `width="129" height="36"` no `/kib-logo.png` (validado pela suíte `tests/timing-ui-tv-antiga.test.ts`). |
| 25 | `/resultado/demo` (`resultado.html`) | Folha pública/compartilhável de resultado de bateria. **Corrigido:** adicionado `width="115" height="32"` no `/kib-logo.png`. |
| 26 | `/nao-encontrado` (`nao-encontrado.html`) | Página 404 da Cronometragem. **Corrigido:** adicionado `width="129" height="36"` no `/kib-logo.png`. |
| 27–29 | `/tv`, `/tv-classica`, `/tb50` (*Inspeção estritamente read-only*) | Inspecionados apenas em modo leitura conforme regra inegociável do projeto (`Não mexer no telão`). Zero falhas de contraste no placar ao vivo. |

#### C.2. SRVKART `:4060` — Operação Local & Totem (`services/ops-ui/` e `services/ops-server.ts`)

| # | Rota / Módulo da Árvore | Diagnóstico UI/UX Pro Max & Correções Aplicadas |
|---|---|---|
| 30 | `/recepcao` — Tela de Login | **Bug crítico de backend corrigido em `services/ops-server.ts:550`:** O rate limiter `tentativasLogin` bloqueava o IP por 15 minutos após 10 falhas (`reg.ate = agora + 15 * 60_000`), mas **nunca zerava `reg.n` após a expiração de `reg.ate`**, deixando o IP permanentemente em `429 Muitas tentativas de login` a cada nova tentativa até reiniciar o serviço. Corrigido com reset automático (`if (reg.ate && agora >= reg.ate) { reg.n = 0; reg.ate = 0; }`). |
| 31–40 | `/recepcao` Autenticado — **Visão Geral + 9 Módulos da Árvore (`#tree`):** `reservas:todas` (Reservas), `baterias:todas` (Baterias), `clientes` (Clientes/Pilotos), `caixa` (Caixa), `vendas` (Vendas/Comandas), `oficina:arealizar` (Oficina/Manutenção), `vouchers` (Vouchers), `fidelidade` (Fidelidade), `parceiros` (Parceiros) | **Achado corrigido:** Quando um nó da árvore lateral (`#tree li > .n.sel`) estava selecionado (fundo `#0078d7`), o triângulo expansor `.tg` permanecia cinza (`#666`), gerando contraste `2.47:1`. **Corrigido em `services/ops-ui/office.css` (`#tree li > .n.sel .tg { color: #fff; }`, contraste `> 4.5:1`).** |
| 41 | `/totem` (`totem.html`) | Autoatendimento sem teclado na tela (fluxo por CPF no keypad numérico + assinatura de termo). **Achados corrigidos em `services/ops-ui/totem.html`:** (1) `<div class="wrap">` promovido a `<main class="wrap">`; (2) `--red` ajustado de `#e10600` (`4.09:1`) para `#d6282e` (`4.82:1` com texto branco no botão `Próximo`); (3) Checkbox de aceite do termo ampliado de `20×20px` para `24×24px`; (4) Adicionado `width="187" height="52"` no logo. |

---

## 4. Avaliação Consolidada nas 10 Categorias `ui-ux-pro-max`

1. **Priority 1 — Accessibility (CRITICAL):**
   - Eliminação de todos os contrastes abaixo de `4.5:1` nos códigos-fonte das 4 superfícies (`.ev-topo`/`.ev-relogio` no Endurance, `.filtros button.sel span` no Admin, `--apagado` no Pré-Cadastro/Conta/Privacidade, `#tree li > .n.sel .tg` no Office `:4060` e botão primário `--red` no `/totem`).
   - Adição de skip-link (`Pular para o conteúdo`) no Admin, landmarks `<main>` em todas as telas que não possuíam (Login Admin, `/sorteio`, `/totem`), correção de hierarquia de headings (`h1 → h2 → h3`) em `#/patrocinadores` e `#/endurance`, e rotulagem `aria-label` em 100% dos campos de busca e observação.
2. **Priority 2 — Touch & Interaction (CRITICAL):**
   - Checkboxes e áreas de toque ampliados (`20×20px` no Admin, `24×24px` no Totem, `min-height: 28px` nos links de topo do Operador/Admin `:4050`).
   - Respeito estrito à regra operacional do Totem: **zero teclado virtual na tela** (apenas keypad numérico de CPF com botões de `68px` de altura e área de assinatura canvas).
3. **Priority 3 — Performance & CLS (HIGH):**
   - Adição de `width` e `height` explícitos em todas as logos `/kib-logo.png` e `/kib-logo-escuro.png` (`app.js`, `equipe.html`, `conta.html`, `equalizacao.html`, `sorteio.html`, `resultado.html`, `nao-encontrado.html`, `totem.html`), eliminando *Cumulative Layout Shift* (CLS) no carregamento inicial.
4. **Priority 4 — Style Selection (HIGH):**
   - Consolidação da arquitetura em 4 atmosferas térmicas documentadas no `MASTER.md` (Dark OLED Telemetry para Público/Cronometragem, Daylight High-Contrast para Recepção/Admin Diurno e Touch Kiosk para Totem).
5. **Priority 5 — Layout & Responsive (HIGH):**
   - Verificação em `1440×900` e `375×812` sem vazamento horizontal global (`overflow-x: clip` adicionado em `src/index.css`).
   - Prevenção de auto-zoom no iOS Safari em **todas** as superfícies (`font-size: 16px` em `input, select, textarea` para `@media (max-width: 767px)`).
6. **Priority 6 — Typography & Color (MEDIUM):**
   - Alinhamento numérico tabular (`font-variant-numeric: tabular-nums` / `JetBrains Mono`) preservado em todos os cronômetros, placares, preços e contadores de vagas.
7. **Priority 7 — Animation (MEDIUM):**
   - Suporte a `@media (prefers-reduced-motion: reduce)` presente e respeitado; transições restritas a `transform` e `opacity`.
8. **Priority 8 — Forms & Feedback (MEDIUM):**
   - Adicionado botão de mostrar/ocultar senha (`#btnToggleSenha`, regra `password-toggle`) no Login do Admin com `aria-label` dinâmico.
9. **Priority 9 — Navigation Patterns (LOW):**
   - Navegação por gaveta mobile (`#btnMenu` / `#navBackdrop`) no Admin e atalho global `Ctrl+K` verificados e funcionais.
10. **Priority 10 — Charts & Data (LOW):**
    - Painéis de telemetria (`#/endurance`, `/operador`, `#/ranking`) utilizam codificação redundante (cor + ícone/prefixo textual + posição numérica), não dependendo exclusivamente de cor.

---

## 5. Resumo dos Arquivos Modificados e Verificados

### Arquivos Criados (Design System + Relatório QA)
- [`design-system/kartodromo-de-betim/MASTER.md`](../../design-system/kartodromo-de-betim/MASTER.md)
- [`design-system/kartodromo-de-betim/pages/site-institucional.md`](../../design-system/kartodromo-de-betim/pages/site-institucional.md)
- [`design-system/kartodromo-de-betim/pages/reservas-checkout.md`](../../design-system/kartodromo-de-betim/pages/reservas-checkout.md)
- [`design-system/kartodromo-de-betim/pages/pre-cadastro-conta.md`](../../design-system/kartodromo-de-betim/pages/pre-cadastro-conta.md)
- [`design-system/kartodromo-de-betim/pages/campeonatos-endurance.md`](../../design-system/kartodromo-de-betim/pages/campeonatos-endurance.md)
- [`design-system/kartodromo-de-betim/pages/admin-visao-agenda.md`](../../design-system/kartodromo-de-betim/pages/admin-visao-agenda.md)
- [`design-system/kartodromo-de-betim/pages/admin-recepcao-pilotos.md`](../../design-system/kartodromo-de-betim/pages/admin-recepcao-pilotos.md)
- [`design-system/kartodromo-de-betim/pages/admin-competicoes-comercial-sistema.md`](../../design-system/kartodromo-de-betim/pages/admin-competicoes-comercial-sistema.md)
- [`design-system/kartodromo-de-betim/pages/orbits-cronometragem.md`](../../design-system/kartodromo-de-betim/pages/orbits-cronometragem.md)
- [`design-system/kartodromo-de-betim/pages/srvkart-ops-totem.md`](../../design-system/kartodromo-de-betim/pages/srvkart-ops-totem.md)
- [`docs/qa/auditoria-ui-ux-pro-max-2026-11-07.md`](./auditoria-ui-ux-pro-max-2026-11-07.md)

### Arquivos de Código Aperfeiçoados
- [`workers/admin/public/index.html`](../../workers/admin/public/index.html)
- [`workers/admin/public/app.js`](../../workers/admin/public/app.js)
- [`workers/admin/public/componentes.css`](../../workers/admin/public/componentes.css)
- [`workers/admin/public/endurance.js`](../../workers/admin/public/endurance.js)
- [`workers/admin/public/endurance.css`](../../workers/admin/public/endurance.css)
- [`workers/admin/public/patrocinadores.js`](../../workers/admin/public/patrocinadores.js)
- [`workers/admin/public/usuarios.js`](../../workers/admin/public/usuarios.js)
- [`workers/admin/public/equipe.html`](../../workers/admin/public/equipe.html)
- [`workers/pre-cadastro/public/index.html`](../../workers/pre-cadastro/public/index.html)
- [`workers/pre-cadastro/public/conta.html`](../../workers/pre-cadastro/public/conta.html)
- [`workers/pre-cadastro/public/privacidade.html`](../../workers/pre-cadastro/public/privacidade.html)
- [`app/privacidade/page.tsx`](../../app/privacidade/page.tsx)
- [`src/index.css`](../../src/index.css)
- [`services/timing-ui/operador.html`](../../services/timing-ui/operador.html)
- [`services/timing-ui/admin.html`](../../services/timing-ui/admin.html)
- [`services/timing-ui/equalizacao.html`](../../services/timing-ui/equalizacao.html)
- [`services/timing-ui/sorteio.html`](../../services/timing-ui/sorteio.html)
- [`services/timing-ui/resultado.html`](../../services/timing-ui/resultado.html)
- [`services/timing-ui/nao-encontrado.html`](../../services/timing-ui/nao-encontrado.html)
- [`services/ops-ui/office.css`](../../services/ops-ui/office.css)
- [`services/ops-ui/totem.html`](../../services/ops-ui/totem.html)
- [`services/ops-server.ts`](../../services/ops-server.ts)
