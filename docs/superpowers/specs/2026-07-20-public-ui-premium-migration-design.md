# Public UI Premium Migration Design

## Contexto

O site público estabilizado usa Next.js/OpenNext e já possui rotas canônicas, SEO, testes responsivos e deploy no Cloudflare. A interface React, porém, ainda carrega resíduos de um tema claro antigo em `src/index.css`, enquanto os documentos em `public/design/*.dc.html` contêm a direção visual premium aprovada: fundo escuro, verde de alta energia, tipografia editorial de automobilismo, botões angulados, fotografia real e ritmo cinematográfico.

Os documentos `.dc` não podem voltar a ser páginas de produção porque dependem de runtime client-side e expõem templates crus aos mecanismos de busca. Eles serão usados somente como referência visual.

## Objetivo

Migrar a identidade premium para componentes Next reutilizáveis, mobile-first e acessíveis, preservando o conteúdo e as jornadas reais do site, sem reintroduzir o runtime `.dc`.

## Direção visual

- Fundo principal verdadeiro: `#030504`.
- Superfícies: `#070b08`, `#0b100c`, `#101711`.
- Verde principal: `#00e676`; verde de ação: `#00c853`.
- Texto principal: `#f7faf6`; texto secundário mínimo AA: `#aeb8b0`.
- Títulos editoriais em Anton ou fonte display equivalente já instalada.
- Texto e controles em Rajdhani, com mínimo de 14 px para informação auxiliar e 16 px para leitura normal.
- Geometria: cortes angulares e linhas de pista; evitar arredondamento genérico e cardificação excessiva.
- Fotografia real como elemento estrutural, não como miniaturas decorativas.
- Movimento curto e funcional, sempre respeitando `prefers-reduced-motion`.

## Arquitetura

### Tokens

`tailwind.config.js` e `src/index.css` passam a representar um único sistema escuro. Regras globais de tema claro e sobrescritas `!important` serão removidas. Tokens cobrirão:

- cores;
- tipografia;
- containers;
- espaçamento;
- bordas e cortes angulares;
- sombras e brilho;
- tempos e curvas de movimento;
- breakpoints e áreas de toque.

### Componentes compartilhados

- `SiteHeader`: topbar, navegação desktop, drawer mobile, estado ativo e CTA de reserva.
- `SiteFooter`: navegação, contato, redes, localização e CTA final.
- `PageHero`: variações editorial, vídeo e imagem.
- `SectionHeading`: hierarquia consistente e responsiva.
- `AngledButton`: variantes primary, outline, ghost e destructive quando aplicável.
- `MediaFrame`: imagem/vídeo responsivo com crop e fallback.
- `MetricRail`: indicadores adaptáveis sem compressão.
- `ResponsiveTable`: rolagem sinalizada e alternativa em cards no mobile quando necessário.
- `LeadModal`: foco controlado, bloqueio de rolagem e formulário em uma coluna no mobile.

### Grupos de páginas

1. Fundação, Header, Footer e Home.
2. Pista, Locação, Reservas e Dúvidas.
3. Eventos e Campeonatos.
4. KAC, KAC Super, 200 Milhas e 500 Milhas.
5. Clube informativo e estados de implantação.

Cada grupo deve ser visualmente verificável e publicável sem depender do grupo seguinte.

## Responsividade

### Mobile

- Viewports de referência: 320, 360, 375, 390 e 430 px.
- Uma coluna por padrão.
- Margens laterais entre 16 e 20 px.
- Botões com altura mínima de 48 px.
- Nenhuma funcionalidade dependente de hover.
- Vídeo pesado substituído por poster quando `prefers-reduced-motion` ou economia de dados estiver ativa.

### Tablet

- Referências: 768, 820 e 1024 px.
- Cards em no máximo duas colunas.
- Heros com proporção controlada e texto não comprimido.
- Navegação adaptada antes de ocorrer wrapping.

### Desktop

- Referências: 1280, 1440 e 1600 px.
- Containers entre 1200 e 1480 px conforme a página.
- Ritmo editorial com áreas full-bleed e conteúdo alinhado por grid.

## Acessibilidade

- WCAG 2.2 AA para contraste e foco.
- `lang="pt-BR"` preservado.
- Navegação completa por teclado.
- Drawer e modal com focus trap e restauração de foco.
- Textos auxiliares não menores que 14 px.
- Estados de foco não dependem apenas de cor.
- Redução de movimento aplicada a animações, contadores, reveals e transições.

## Performance

- Conteúdo principal disponível no HTML inicial.
- Vídeos com poster e carregamento condicionado.
- Imagens com dimensões estáveis, lazy loading fora do primeiro viewport e formatos modernos.
- Componentes pesados carregados de forma condicional.
- Evitar listeners globais duplicados e re-renderizações desnecessárias.

## Estratégia de comparação

O pipeline capturará:

- implementação Next canônica;
- referência correspondente em `/design/*.dc.html`;
- desktop 1440 × 900;
- tablet 820 × 1180;
- mobile 390 × 844.

As imagens serão comparadas por página para copy, hierarquia, grid, tipografia, paleta, mídia, CTA, espaçamento, responsividade e estados interativos.

## Critérios de aceite

1. Nenhum componente público depende de `/design/*.dc.html`.
2. Nenhuma regra global força tema claro ou usa `!important` para alterar cores utilitárias.
3. Todas as páginas passam sem overflow em 320–1600 px.
4. Todas as rotas passam Playwright, typecheck, lint, build Next e build OpenNext.
5. Header e Footer são únicos em todas as páginas públicas.
6. Texto normal possui pelo menos 16 px e texto auxiliar pelo menos 14 px, salvo dados tabulares justificadamente compactos.
7. Modal e menu mobile possuem controle de foco e Escape.
8. Conceito premium e implementação são comparados visualmente por rota e viewport.
9. O deploy só ocorre após smoke test no domínio público.

## Fora de escopo desta migração visual

- Implementar backend transacional do Clube.
- Alterar regras esportivas, preços ou calendário sem fonte oficial.
- Recriar MyLapTime dentro do domínio.
- Modificar módulos administrativos que não compartilham componentes públicos.
