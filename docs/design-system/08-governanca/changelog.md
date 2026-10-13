# Changelog do design system

Formato: versão (SemVer dos tokens) · data · o que mudou · efeito visível.

## 1.6.1 — 10/10/2026 (limpeza de hardcode)
- 287 `Color.White` → `Tokens.Primitivo.Branco` e 13 cores literais → a primitiva de mesmo valor (pixel idêntico, conferido
  nas 74 telas da Recepção). `Color.Black` mantido: o kit visual da Recepção compara `ForeColor == Color.Black`.
- 48 fontes literais na escala: 15 exatas (zero pixel) + 33 a menos de 0,7 px do degrau mais próximo (13 px corpo,
  15 px títulos de seção, 17 px título da janela de atualização); conferido sem corte nas janelas comuns.
- Hardcode total: 2023 → **1660** (−363). Os grandes (relógio 44 pt, total do caixa, login) ficam.

## 1.6.0 — 10/10/2026 (decisões fechadas)
- `cor.borda.campo` claro: #DBDBDB → **#8E8E93** (3,26:1; WCAG 1.4.11). Contraste agora é regra de erro no build.
  `DialogoDesign` passou a usar o token. Efeito visível: contorno dos campos mais nítido (Recepção, Cronometragem,
  páginas de operador/admin da cronometragem).
- `raio.chip` escuro 3 → 4. Oswald legitimada como fonte numérica do público. Admin web: claro por padrão, escuro opcional (botão que já existia).

## 1.5.0 — 10/10/2026 (fase 1 concluída)
- Fim das janelas antigas: `Janela`/`ModalMeta` → `DialogoDesign` (7 telas); `Janela` obsoleta.
- `TabelaDesign` lê cabeçalho e foco dos tokens (mesmo visual da `Grade`). Código morto removido (`BotaoGrande`).
- Recepção e Cronometragem 1.0.59.

## 1.4.3 — 10/10/2026
- Janelas de campos da Cronometragem (`DialogoDados`) no visual padrão do `DialogoDesign` (Cronometragem 1.0.59).
- Comportamento: lista de baterias do alto só com as do dia; baterias de dias anteriores abrem em Grupos e provas (1.0.58).

## 1.4.2 — 09/10/2026 noite (comportamento)
- Regras novas: atualização automática não refaz colunas nem mexe na rolagem/seleção/ponteiro; ponteiro de espera por
  contagem. Recepção e Cronometragem **1.0.51** (ponteiro) e **1.0.52** (lista que travava durante as baterias).
- Fase 2 (Recepção) publicada junto.

## 1.4.1 — 09/10/2026 (fases 2, 3 e 7)
- `Tokens.FonteSemibold` e `Tokens.FonteNumero` no C#.
- Cronometragem com as fontes na escala; tablet do sorteio no tema escuro oficial; Recepção nos tokens do tema claro.
- **Efeito visível:** fontes uniformes na Cronometragem (1.0.50); tablet em verde neon (1.5); Recepção com contraste
  corrigido (aguarda a comparação com login antes de publicar).

## 1.4.0 — 09/10/2026 (fases 6 e 8)
- 35 tokens `componente.totem.*` com os valores exatos do totem; o totem lê todas as cores fixas deles.
- Site: arquivos de entrada do Vite antigo removidos.
- **Efeito visível:** nenhum (36 fotos do totem idênticas byte a byte).

## Cronometragem 1.0.49 — 09/10/2026
- Seleção das listas segue a cor escolhida pela tela (Eventos/Grupos: verde com letra branca; demais: verde-claro),
  como nas pranchas; antes toda seleção saía cinza.
- Lista de passagens: só a passagem nova entra no topo (as antigas não são reescritas) e acessibilidade resumida.
- **Efeito visível:** linha selecionada verde em Eventos/Grupos/Provas; tela da corrida sem travar com muitas passagens.

## 1.3.1 — 08/10/2026 (fases 4 e 8)
- Tailwind ganha as cores `kib-*` (apelidos dos tokens). Admin web inteiro nelas; `--admin-*` viram apelidos dos tokens.
- Site público: sem Inter/Montserrat no CSS base. Tokens sem mudança de valor.
- Documentação: degradês aprovados (cor.md), catálogo de microinterações e efeitos visuais (movimento.md), estilo 3D
  (elevacao.md).
- **Efeito visível:** admin com os cinzas e verdes oficiais (fundo `#F5F5F7`, verde `#0B7A53`); erros em vermelho claro
  legível e títulos que sumiam no tema claro voltam a aparecer. Site público igual.

## 1.3.0 — 08/10/2026 (fase 5)
- Páginas da cronometragem nos tokens: operador e admin passam ao tema claro; resultado e equalização com tokens + reserva.
- Operador sem rolagem horizontal no celular; lista de baterias sem "undefined" e com singular/plural certo.
- **Efeito visível:** operador e admin do servidor de cronometragem mudam de escuro para claro; relatórios praticamente iguais
  (verde da marca `#0B7A53` no lugar de `#087F48`).

## 1.2.0 — 08/10/2026 (fase 3, parte 1)
- Token `cor.dominio.melhor-volta` (claro `#7A2FC2`, escuro `#C084FC`).
- Cronometragem: 104 cores soltas trocadas por tokens de mesmo valor; `TemaCrono` aponta para os tokens.
- Melhor volta da prova com marcador ■ além do roxo (`LiveGrid.Destaque`).
- Exclusões e retiradas da Cronometragem com confirmação destrutiva (`Msg.Confirmar`).
- **Efeito visível:** marcador ■ na melhor volta; confirmações de excluir/retirar com botão vermelho e foco em Cancelar.

## 1.1.0 — 08/10/2026 (fase 1, parte 1)
- Componentes canônicos no desktop: `Botao`, `Selo`, `Banner`, `Toast`, `EstadoVazio`, `IndicadorCarregando`, `DialogoMensagem`.
- `Msg` passa a desenhar mensagens e perguntas no visual do sistema (antes: caixa cinza do Windows); novo `Msg.Confirmar`.
- `Forma.AplicarRaio` acompanha o redimensionamento; cópias de raio/contorno/caixa de marcar da Recepção unificadas no `Forma`.
- Correção de lint (3 arquivos de 06–07/10) que derrubava o CI.
- **Efeito visível:** mensagens e perguntas dos apps nativos (Cronometragem, Recepção) com o visual novo. Telas e totem iguais.

## 1.0.0 — 08/10/2026
- Criada a fonte única `tokens/kib.tokens.json` (primitivo → semântico com temas claro/escuro → componente) e os
  44 nomes legados do desktop com os valores exatos de antes.
- Gerador para CSS (`styles/tokens.css`, `services/timing-ui/tokens.css` em `/tokens.css`), C# (`Tokens.g.cs`),
  Kotlin/Android e referência em Markdown; contraste verificado no build.
- Verificador de hardcode com catraca por arquivo (cerca de 3.400 ocorrências na linha de base) no CI.
- Documentação `docs/design-system/` (fundação, fundamentos, tokens, componentes, padrões, plataformas, handoff,
  arquitetura, governança, produto, inventário).
- **Efeito visível: nenhum.**
