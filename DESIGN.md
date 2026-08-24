---
name: Kartódromo Internacional de Betim
description: Sistema visual "Pit Lane Noturno" — motorsport escuro de cronometragem ao vivo, com painel administrativo técnico em camadas dramáticas.
colors:
  preto-box: "#030504"
  asfalto-elevado: "#0b100c"
  neon-cronometrico: "#00e676"
  verde-podio: "#00c853"
  branco-giz: "#f7faf6"
  linha-fantasma: "rgba(255,255,255,0.10)"
  verde-institucional: "#007a3d"
  papel-admin: "#f5f7f5"
  superficie-admin: "#ffffff"
  tinta-admin: "#14170f"
  alerta-racing: "#d92d2d"
  sage-suave: "#a8b2aa"
  tinta-cta: "#041301"
  nevoa-clara: "#d7ded8"
  ouro-podio: "#ffd24a"
  verde-viplex: "#00ff66"
  grafite-caixa: "#333c34"
  teal-telao: "#03110f"
  teal-header: "#007965"
  amarelo-posicao: "#facc15"
typography:
  display:
    fontFamily: "Anton, sans-serif"
    fontSize: "clamp(2.75rem, 6vw, 5rem)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "0.01em"
    fontVariation: "uppercase por padrão"
  headline:
    fontFamily: "Anton, sans-serif"
    fontSize: "clamp(1.9rem, 3.4vw, 2.75rem)"
    fontWeight: 400
    lineHeight: 1.08
  title:
    fontFamily: "Rajdhani, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Rajdhani, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.55
  label:
    fontFamily: "Rajdhani, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.16em"
  ui-sm:
    fontFamily: "Rajdhani, sans-serif"
    fontSize: "12px"
    fontWeight: 500
  ui-md:
    fontFamily: "Rajdhani, sans-serif"
    fontSize: "14px"
    fontWeight: 500
  ui-lg:
    fontFamily: "Rajdhani, sans-serif"
    fontSize: "18px"
    fontWeight: 600
  mono-telao:
    fontFamily: "ui-monospace, Consolas, 'Courier New', monospace"
    fontSize: "12px"
    fontWeight: 400
  telao-xs:
    fontFamily: "Rajdhani, sans-serif"
    fontSize: "10px"
    fontWeight: 700
  ui-13:
    fontFamily: "Rajdhani, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  ui-15:
    fontFamily: "Rajdhani, sans-serif"
    fontSize: "15px"
    fontWeight: 500
  ui-19:
    fontFamily: "Rajdhani, sans-serif"
    fontSize: "19px"
    fontWeight: 700
  display-sm:
    fontFamily: "Anton, sans-serif"
    fontSize: "34px"
    fontWeight: 400
    lineHeight: 1
    fontVariation: "uppercase por padrão"
  display-md:
    fontFamily: "Anton, sans-serif"
    fontSize: "38px"
    fontWeight: 400
    lineHeight: 1
    fontVariation: "uppercase por padrão"
rounded:
  chip: "3px"
  sm: "6px"
  designer: "7px"
  md: "8px"
  tile: "9px"
  lg: "12px"
  card-telao: "14px"
  xl: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  secao: "64px"
components:
  cta-publico-primario:
    backgroundColor: "linear-gradient(135deg, {colors.neon-cronometrico}, {colors.verde-podio})"
    textColor: "{colors.preto-box}"
    typography: "{typography.title}"
    rounded: "{rounded.sm}"
    padding: "14px 28px"
  botao-admin-primario:
    backgroundColor: "{colors.verde-institucional}"
    textColor: "{colors.superficie-admin}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 14px"
  botao-admin-secundario:
    backgroundColor: "#27272a"
    textColor: "#f4f4f5"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 14px"
  card-admin:
    backgroundColor: "{colors.superficie-admin}"
    textColor: "{colors.tinta-admin}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
---

# Design System: Kartódromo Internacional de Betim

## Overview

**Creative North Star: "Pit Lane Noturno"**

O sistema é a noite de prova antes das 500 Milhas: asfalto quase absoluto (`#030504`), dados cravados em verde neon cronométrico e tipografia de placar que grita a largada. O site público vive nesse mundo escuro — heróis cinematográficos com veículo protagonista, bordas fantasma `rgba(255,255,255,0.10)` separando seções como retas de box. O painel administrativo é o contrapeso técnico: superfícies claras de prancheta (`#f5f7f5`/#ffffff), acento verde institucional `#007a3d`, densidade de tabela e Rajdhani medindo cada pixel. O telão é um terceiro território de transmissão (2048×512, teal profundo `#03110f` com amarelo de posição `#facc15`) e segue gramática própria.

A partir daqui, novos trabalhos elevam o conjunto para **camadas dramáticas**: profundidade pronunciada, superfícies empilhadas e sombras com intenção — nunca flat esquecido, nunca ornamento sem função. A logo original (`public/brand/kib-logo.png`) é patrimônio intocável e recebe sempre contraste controlado.

**Key Characteristics:**
- Asfalto primeiro: o escuro `#030504` é a base do público; claro só no admin.
- Verde com voz: neon para dados/ação, institucional para operação — sempre pela escala, nunca hex solto.
- Duas vozes tipográficas: Anton grita títulos em caixa alta; Rajdhani mede todo o resto.
- Bordas fantasma `white/10` em vez de sombras no público; profundidade dramática reservada ao admin.
- Movimento curto e revelador (200ms; reveals por entrada).

## Colors

Paleta de dois territórios: o noturno do público e o técnico do admin, unidos pelos verdes da marca.

### Primary
- **Neon Cronométrico** (#00e676): o verde dos dados vivos — links, destaques de volta rápida, foco visível (`outline rgba(0,200,83,.72)`), início do gradiente de CTA. É a cor da cronometragem; se está pulsando, é informação.
- **Verde Pódio** (#00c853): fechamento do gradiente de ação e hover de elementos primários; também o thumb do scrollbar no hover.

### Secondary
- **Verde Institucional** (#007a3d): acento do painel administrativo (botões primários, links, estados ativos) com contraste branco; versão suave `rgba(0,122,61,0.10)` para fundos selecionados.

### Tertiary
- **Alerta Racing** (#d92d2d): exclusivo destrutivo no admin (ações de risco, erros), fundo suave `rgba(217,45,45,0.08)`.
- Amarelo de posição (#facc15) e header teal (#007965): restritos ao telão, não vazam para site/admin.

### Neutral
- **Preto Box** (#030504): fundo do público; também cor de texto sobre CTA gradiente.
- **Asfalto Elevado** (#0b100c): superfícies erguidas sobre o asfalto (cards, modais).
- **Branco Giz** (#f7faf6): texto padrão no público.
- **Linha Fantasma** (rgba(255,255,255,0.10)): divisores e bordas de cartão no escuro.
- **Papel Admin** (#f5f7f5) / **Superfície Admin** (#ffffff): fundo e cartões do painel.
- **Tinta Admin** (#14170f): texto do painel; muted #5d6660; bordas #e2e6e1.
- Escala zinc (Tailwind) cobre os intermediários estruturais do admin (zinc-800 nos botões secundários).

### Named Rules
**A Regra da Fonte Única.** Todo verde nasce da escala (`primary-50…950` / accent do admin). Hex de verde escrito à mão fora da escala é bug visual.

**A Regra Asfalto Primeiro.** O site público não tem tema claro. Superfície nova começa em `#030504`/`#0b100c`; branco é texto, não fundo.

## Typography

**Display Font:** Anton (fallback Arial Black/Impact) — caixa alta permanente.
**Body Font:** Rajdhani (400–700; fallback Arial Narrow) — corpo, tabelas, formulários e o admin inteiro (`--font-admin`).
**Label/Mono:** nenhuma família distinta; labels são Rajdhani 700 com tracking largo.

**Character:** O par Anton+Rajdhani é placar de autódromo — impacto bruto em cima, telemetria legível embaixo. Nada de serifado; nada de itálico decorativo.

### Hierarchy
- **Display** (400, clamp(2.75–5rem), 1.02): hero e títulos de seção do público, sempre uppercase.
- **Headline** (400, clamp(1.9–2.75rem), 1.08): títulos internos de seção/bloco.
- **Title** (700, 1.25rem, 1.3): títulos de cartão e módulos do admin.
- **Body** (500, 1rem, 1.55): parágrafos e tabelas; linhas curtas, leitura de pista.
- **Label** (700, 0.72rem, tracking 0.16em, UPPERCASE): eyebrows ("COMPETIÇÃO"), métricas de stat-card e cabeçalhos de tabela.

### Escala operacional (passos intermediários oficiais)
Além dos cinco papéis acima, estes passos são parte da rampa e podem ser usados livremente em UI densa e composição responsiva:

`0.68rem · 0.72rem · 0.75rem · 0.8rem · 0.875rem · 0.95rem · 1rem · 1.125rem · 1.25rem · 1.5rem · 1.75rem · 2xl (1.5rem italic display) · text-3xl/4xl/5xl via clamp`

Regra: qualquer `text-[..px/rem]` literal deve pertencer a esta lista; tamanho fora dela exige atualizar esta seção antes de usar.

### Exceção Telão
O telão TB50 é superfície de transmissão com gramática própria e pode usar famílias adicionais (ex.: fontes de dígito largo do pacote ViPlex) sem seguir as duas vozes acima. Essa exceção não se estende a site nem admin.

### Named Rules
**A Regra do Grito Curto.** Anton nunca passa de duas linhas; se o título precisar de mais, virá Headline em Rajdhani bold.

**A Regra dos Passos Oficiais.** A rampa operacional é {11 · 12 · 14 · 16 · 18 · 22}px (+ Display/Headline via clamp). Entre um passo e outro não existe meio-termo; tamanho novo exige atualizar esta seção antes de usar.

**A Regra do Eyebrow de Prova.** O eyebrow tracked-caps acima de títulos de página/hero é assinatura oficial do Pit Lane Noturno (decisão do dono, 2026-08-23) — exceção deliberada ao anti-padrão genérico de kickers.

**UI densa intencional.** Painéis operacionais (admin, telão, designer) usam steps próximos de propósito para densidade informacional; `flat-type-hierarchy` não se aplica a essas superfícies.

### Exceção Telão (ampliada)
Telão TB50, placar e o designer de layouts podem usar famílias adicionais — dígitos monoespaçados (`ui-monospace`/Consolas) para tempos e fallbacks Arial em contexto broadcast — sem seguir as duas vozes acima. Essa exceção não se estende a site nem admin.

**A Regra dos Passos Oficiais.** Entre 0.68rem e o clamp do Display, só existe a escala operacional acima — nem um pixel inventado no meio do caminho.

## Layout

Site público em seções de largura total sobre o asfalto, separadas por Linha Fantasma, com contêiner central (`max-w-*` + padding lateral) e ritmo vertical generoso (`py-16` → `md:py-24`). Hero em `min-height:82svh` ancorado ao rodapé. Admin em densidade de operação: contêiner fluido com gutter fixo, tabelas `DataTable` com cabeçalho sticky, paginação a cada 10 linhas e filtros em linha acima da grade. Breakpoints Tailwind padrão (sm 640 / md 768 / lg 1024); público colapsa navegação em gaveta mobile e mantém CTAs de WhatsApp acessíveis.

## Elevation & Depth

Doutrina: **Camadas Dramáticas**. Profundidade existe para hierarquia de atenção, e ela é pronunciada — superfícies empilhadas com sombras longas e, quando houver mídia atrás, vidro (`backdrop-filter`) com contenção. O vocabulário herdado parte de uma única sombra técnica e sobe dela:

### Shadow Vocabulary
- **Sombra de Prancheta** (`box-shadow: 0 12px 32px rgba(20,30,20,0.08)`): camada base de cartões/modais do admin hoje; ponto de partida para as camadas mais dramáticas.
- **Elevação de Ação** (a estabelecer na implementação): sombra direcional longa para elementos flutuantes (modais, dropdowns, CTAs fixos) seguindo a doutrina acima.
- No público, profundidade vem de **gradiente de imagem + Linha Fantasma**, não de sombra.

### Named Rules
**A Regra da Camada com Intenção.** Toda sombra responde a uma pergunta — "isto está acima da pista?" Se a resposta é não, superfície plana.

## Shapes

Público: cantos majoritariamente vivos/quase vivos (raio pequeno 4–6px), pílulas `999px` apenas para chips/badges e o botão de WhatsApp; recortes diagonais pontuais evocam aerodinâmica sem virar tema de corrida de rua. Admin: raio consistente de 8px (controles, `rounded-lg`) e 12px (cartões/modais), bordas de 1px sólidas (`#e2e6e1` claro, Linha Fantasma no escuro). Nenhuma sombra interna na logo; área de respiro mínima ao redor dela.

## Components

### Buttons
- **Shape:** admin raio 8px, altura 36px, padding 0 14px; público CTA raio pequeno com padding generoso (14px 28px).
- **Primary (admin):** Verde Institucional com texto branco; loading exibe spinner e bloqueia; disabled 50% opacidade.
- **Primary (público):** gradiente `linear-gradient(135deg,#00e676,#00c853)` com texto Preto Box e hover com leve elevação.
- **Secondary / Ghost:** secundário `#27272a`→hover `#3f3f46`; ghost transparente com borda Linha Fantasma e texto que acende no hover.
- **Danger:** `#d92d2d` 90% → 100% no hover, texto branco, reservado a ações irreversíveis.

### Chips / Status Badges
- **Style:** pílula com borda 1px e fundo do tom 900/950 da cor semântica; texto do tom 200.
- **State:** emerald (válido/sucesso), amber (atenção/curta), red (inválido/punição), blue (informacional), zinc (neutro/arquivado).

### Cards / Containers
- **Corner Style:** 12px no admin; vivo/quase vivo no público.
- **Background:** Superfície Admin no claro; `#0b100c` + Linha Fantasma no escuro.
- **Shadow Strategy:** Sombra de Prancheta hoje; elevar conforme Camadas Dramáticas.
- **Border:** 1px sólida; nunca dupla borda + sombra pesada juntos.
- **Internal Padding:** 24px (lg) padrão do admin.

### Inputs / Fields
- **Style:** fundo branco (claro) ou `#09090b` (escuro), borda 1px, raio 8px, altura 40px no público.
- **Focus:** anel `rgba(0,200,83,.20)` + borda que acende para o verde; outline global 3px para teclado.
- **Error:** mensagem abaixo do campo vinculada por `aria-describedby`; campo mantém borda neutra + texto de erro.

### Navigation
- Pública: barra superior fixa com logo à esquerda, links Rajdhani semi-bold, ativo em Neon Cronométrico; gaveta mobile; barra de progresso de scroll fina no topo.
- Admin: shell lateral/topbar com item ativo em fundo suave do acento; ícones Lucide 16–18px; breadcrumb pelo PageHeader (eyebrow uppercase + título Anton/Rajdhani bold).

### Signature: Telão TB50
Superfície de transmissão 2048×512: teal profundo `#03110f`, faixa de cabeçalho `#007965`, posições em amarelo `#facc15`, karts em branco. Regras próprias de legibilidade a distância; nunca reutilizar esses tokens fora do telão.

## Do's and Don'ts

### Do:
- **Do** usar exclusivamente a escala de verdes (`primary-*` / Verde Institucional) e os nomes consagrados (Neon Cronométrico, Verde Pódio, Preto Box).
- **Do** manter Anton em caixa alta com no máximo duas linhas e Rajdhani em todo texto corrente.
- **Do** aplicar Linha Fantasma `rgba(255,255,255,0.10)` como divisor padrão no escuro.
- **Do** dar contraste controlado à logo original (`public/brand/kib-logo.png`) com respiro mínimo definido.
- **Do** tornar foco visível sempre (outline 3px `rgba(0,200,83,.72)` + offset 3px).

### Don't:
- **Don't** introduzir fundo claro no site público — o mundo vigente é Preto Box; claro pertence ao admin.
- **Don't** aplicar gradiente, inclinação ou redesenho na logo (compromisso vinculante).
- **Don't** escrever hex de verde fora da escala nem criar "variantes" novas de verde.
- **Don't** vazar tokens do telão (teal/amarelo de posição) para site ou admin.
- **Don't** usar sombra sem resposta à pergunta da Camada com Intenção; ornamento flutuante sem hierarquia é proibido.
