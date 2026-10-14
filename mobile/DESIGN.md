# Interface do aplicativo de Betim

Direção aprovada em 14/10/2026: **Interface nativa essencial**, com equilíbrio entre reservas e experiência do piloto. Referência em `docs/mobile/redesign-2026-10-14/approved-home.svg`.

## Identidade

- Logo completa original, sem mudança de proporção: `assets/brand-logo.png`, cópia exata de `public/brand/kib-logo.png`.
- Fotografia real: `assets/betim-track.jpg`, cópia exata de `public/posters/home-karting.jpg`.
- Ícones do app usam o emblema do kart e bandeira extraído da marca. Splash usa a logo completa. Sem letra K inventada, QR fictício ou pista desenhada sem medição.

## Tema e componentes

`src/components/theme.ts` concentra as cores semânticas e a tipografia. `useUi()` acompanha a aparência do aparelho. Fundo claro #F8F9F9, texto #202725 e ação #23624F; esquema escuro correspondente com contraste AA. Branco nos suportes de marca e QR é intencional.

Fontes nativas, título 28, seção 20, corpo 15–17, legenda 14 e rótulos de navegação 11. Escala do sistema preservada, sem redução automática de texto. Controles de pelo menos 48 dp, foco/estado acessível, números tabulares nos tempos, status descrito também por texto.

`brand.tsx`: marca e símbolos SF Symbols/Material via expo-symbols já instalado. Ícones decorativos ocultos da leitura assistiva. `auth-ui.tsx` e `features/reservations/components.tsx` compartilham tema, campos, mensagens e botões.

Links com `asChild` recebem estilo estático em TouchableOpacity: o Slot desta versão do Expo Router não preserva callbacks de estilo de Pressable. A foto tem tamanho calculado a partir da largura disponível, evitando que a altura intrínseca do Image prevaleça.

## Navegação e listas

Cinco destinos: Início, Agenda, Reservas, Resultados e GPS. Ícones e rótulos visíveis; a altura da barra acompanha a fonte e o inset inferior. Telas de conta e pedido usam Voltar da plataforma. Predictive Back habilitado no Android.

Agenda, reservas, resultados e treinos usam FlatList; nunca colocar essas listas dentro de outra ScrollView. Atualização por gesto em agenda, reservas e resultados. Formulários usam rolagem e tratamento de teclado; cabeçalhos não repetem a área segura superior quando a Stack já a fornece.

## Conteúdo e estados

Preços, vagas, cupons, pedidos e resultados vêm da API. Nenhum dado ilustrativo é incluído no cliente. Vazio, erro de consulta, indisponibilidade, processamento e confirmação têm apresentação própria. Resultado oficial e treino pessoal permanecem distintos.

Agenda preserva somente bateriaId numérico, positivo e seguro durante o login; o retorno é exclusivamente à rota interna de reservas. SessionBoundary preserva o isolamento entre contas. Cronometragem GPS permanece bloqueada até existir geometria medida e aprovada, embora o primeiro início com geometria válida esteja corrigido e coberto por regressão.

## Verificação

Ver relatório e capturas em `docs/mobile/redesign-2026-10-14/verification.md`. Dados TESTE CODEX usados em API local efêmera; nunca em produção. Builds da Expo usam homologação isolada, sem a API local de QA.
