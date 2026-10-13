# Refatoração proposta — migração por fases

Cada fase é **executada só com aprovação do dono**, uma por vez, com o aceite abaixo. O telão nunca entra, salvo pedido.

| Fase | Escopo | Resultado visível | Risco |
|---|---|---|---|
| **0** ✅ | tokens únicos, gerador, lint com catraca, esta documentação | **nenhum pixel** | nenhum |
| **1** ✅ | `Kartodromo.Comum`: `DialogoDesign` único (sobre `CartaoModal`), `Botao` P/M/G com variantes, `TabelaDesign` base (`LiveGrid` especializada), `Selo`, `Toast`, `Banner`, `EstadoVazio`, `Carregando`, helpers únicos (`Forma`, ícone, `CheckVerde`) | pequenas correções de alinhamento | médio — afeta os 3 apps |
| **2** ✅ | Recepção: `KitVisual`/`VisualPrincipal` → `Tokens.Claro.*`; botões e tabelas pelos componentes da fase 1 | cores corrigidas (contraste), botões padronizados | médio |
| **3** ✅ | Cronometragem: `TemaCrono` → tokens; acessibilidade (foco, nomes, 2º sinal além da cor); **FormTV fora** | idem | alto (usada ao vivo) — instalar fora do horário |
| **4** ✅ | Admin web: `--admin-*` → `--kib-*` com `data-tema="claro"`; componentes `components/ui` | mínimo | baixo |
| **5** ✅ | timing-ui de operação/relatório: `tokens.css` + `.btn`/`.panel` com variáveis | mínimo | baixo |
| **6** ✅ | Totem: `Estilo`/`Controles` → `Tokens.Escuro` + `componente.totem.*` com **valores idênticos** | **nenhum** (fotos iguais) | baixo |
| **7** ✅ | Android sorteio: `Tema.kt`/`themes.xml` → `Tokens.Escuro` (vira neon) | **muda** — exige aprovação | baixo |
| **8** ✅ | Site público: remover legado Vite (`src/main.tsx`, `App.tsx`, `index.css` com Inter/Montserrat), alinhar breakpoints a `tela.*`, decidir Oswald | mínimo | médio (SEO/cache) |

## Fase 1 — o que já foi feito (08/10/2026)
- **Componentes prontos** em `Kartodromo.Comum/Design/`: `Botao` (P/M/G; primário, secundário, fantasma, perigo, só-ícone;
  carregando sem clique duplo), `Selo` (+ pílula com ponto), `Banner`, `Toast`, `EstadoVazio`, `IndicadorCarregando`,
  `DialogoMensagem`, `IconesLucide`, `CoresEstado` — todos só com `Tokens.Claro.*`.
- **`Msg` no visual do sistema**: Aviso/Erro/Info/Sucesso/Pergunta/ErroComRetry desenhados (`DialogoMensagem`), Esc = não/fechar,
  Ctrl+C copia o texto, cai na caixa do Windows se o desenho falhar; novo `Msg.Confirmar` para ação destrutiva (foco em Cancelar).
- **Helpers únicos**: `Forma.AplicarRaio` acompanha o redimensionamento (a cópia da Recepção já fazia; a do Comum cortava o
  que crescia); `Forma.ArredondarComContorno` substitui os dois `Arredondar` iguais de `Cadastros`/`Caixa` (e não empilha
  eventos — `Caixa.cs` chamava a cada redimensionamento); `KitVisual.CheckVerde/AplicarRaio/CaminhoArredondado` e
  `VisualPrincipal.Redondo` delegam ao `Forma`.
- **Testes**: `desktop/tests/Kartodromo.Comum.Testes` (tamanhos, texto que não corta, raio, diálogo, autoteste) + galeria PNG.
- **Verificado**: autoteste da Cronometragem a 1920×1080 contra o simulador — 52 telas, diálogos iguais aos de antes
  (diferenças só de dados do simulador e do cursor piscando).
- **10/10/2026**: `DialogoDados` (9 janelas de campos da Cronometragem: atribuir passagem, penalidade, cadastros,
  decoder, parâmetros, backup, painel de LED…) agora é um `DialogoDesign` com a mesma API — ícone, seção arredondada,
  campos com rótulo, Gravar à direita (teste com 2 e 10 campos em Kartodromo.Cronometragem.Testes). Cronometragem 1.0.59.
- **10/10/2026 (fase 1 concluída)**: nenhuma tela usa mais `Janela` nem `ModalMeta` — viraram `DialogoDesign`:
  `Prompt.Pedir` (Comum), voltas do kart e transponders (Crono, tabela padrão `Grade`), ajuda/atalhos (tabela Tecla |
  O que faz), pesquisar cliente, adicionar produto e pagar/estornar comissão (Recepção). `Janela` ficou `[Obsolete]`.
- **Tabelas**: `Grade` (lista grande: ordenação, funil, seleção múltipla, milhares de linhas) e `TabelaDesign` (tabela
  curta dentro de janela) continuam dois componentes por função, **com o mesmo visual vindo dos tokens** (cabeçalho
  12 px semibold, linha 33–34 px, divisória `Tokens.Linha`, foco `cor.acao.principal`). `LiveGrid` segue especializada.
- **Ícones**: `Icone.Tile` (glifo do Windows) não aparece em nenhuma tela — a barra antiga da Cronometragem não é
  exibida e a da Recepção é redesenhada pelo kit visual. Ícone novo = `Forma.Tile` com caminho Lucide.
- Publicação: Cronometragem 1.0.59 (18:50) e Recepção 1.0.59 (18:55) depois do fechamento de 10/10.
- (histórico) Faltava na fase 1: `DialogoDesign` absorver `Janela`/`ModalMeta`; `TabelaDesign` absorver `Grade`;
  `Forma.Icone` com PNG Lucide no lugar de `Icone.Tile`. Ficam para quando cada tela migrar (fases 2–3), porque mudam telas.

## Fase 3 — o que já foi feito (08/10/2026)
- 104 cores soltas da Cronometragem trocadas pelos tokens de **mesmo valor** (texto, ação, borda, estados, bandeiras) —
  nenhum pixel mudou (autoteste a 1920×1080: diferenças só de dados do simulador). `TemaCrono` aponta para os tokens.
  FormTV fora (congelada). Hardcode da Cronometragem: 564 → 459.
- Token novo `cor.dominio.melhor-volta`; a melhor volta da prova ganhou o marcador ■ além do roxo.
- Confirmações destrutivas com `Msg.Confirmar` (botão vermelho, foco em Cancelar): excluir observação, excluir cadastro do
  catálogo, excluir regra de equalização, retirar penalidade, tirar piloto da bateria. **Ações de corrida** (bandeiras,
  encerrar, limpar/retirar passagens — restauráveis) continuam com Sim/Não e Enter rápido, para não atrasar o cronometrista.
- **Falta na fase 3**: fontes fora da escala (143 `new Font`, mudam pixel — exigem fotos antes/depois e aprovação), botões
  pelo `Botao`, nomes acessíveis nos botões só-ícone.

## Fase 5 — feita (08/10/2026)
- `operador.html` e `admin.html` saíram do tema escuro improvisado para o **tema claro** pelos tokens (`/tokens.css` +
  `data-tema="claro"`): estados, seleção, foco visível, melhor volta com ■, sobreposição e sombras dos tokens.
- `resultado.html` e `equalizacao.html` (já claros) com as variáveis apontando para os tokens **com valor de reserva**
  (`var(--kib-…, #hex)`): se o `/tokens.css` faltar no servidor, o relatório continua igual. Folha impressa intacta.
- Correções achadas nas fotos: rolagem horizontal do operador no celular (390 px) eliminada; lista de baterias mostrava
  "undefined · 1 pilotos" na equalização → "Equalização · 1 piloto".
- Verificado com Playwright contra o simulador em 1920/1366/1280/390 e impressão. timing-ui: 330 → 254 cores soltas.
- Teste novo garante que as quatro páginas carregam os tokens no tema claro (e o telão continua sem).

## Fase 4 — feita (08/10/2026)
- Cores `kib-*` no Tailwind (apelidos das `--kib-cor-*`, com opacidade por `color-mix`); 1.109 classes de paleta crua
  (`zinc`, `brand`, `red`, `amber`…) do admin trocadas por elas em `src/admin/**`, `components/admin/**` e no login.
- `styles/admin.css`: `--admin-*` viram apelidos dos tokens; o remendo de ~30 regras `!important` que pintava o
  admin escuro de claro saiu; painel do login (sempre escuro) com `data-tema="escuro"` e cores dos tokens.
- `data-tema` no `.admin-root`/`.admin-login` acompanha o botão da lua (claro/escuro), sem mudar o `localStorage`.
- Correções achadas nas fotos: caixa de erro rosa-acinzentada (vermelho do tema escuro sobre o claro) e título
  "Selecione uma bateria" branco no fundo claro (invisível) em Reservas/Resultados/Cronometragem.
- Fotos antes/depois (Playwright, sessão de teste local) em 1440 e 390, claro e escuro, 8 telas. Lint: −36 contagens.

## Fase 8 — parte feita (08/10/2026)
- `src/index.css`: Inter e Montserrat saíram (nunca eram carregadas; só um título oculto para leitor de tela as usava).
  Fotos do site antes/depois em 390/768/1440, 15 páginas: **idênticas** (a home varia só pela animação).
- Pontos de quebra do site já batem com `tela.tablet` (768); o do admin (720 → 767) também.
- Oswald: mantida em `font-race` (em uso em /reservas e /historia).
- `src/App.tsx` e `src/index.css` **ficam**: o Next usa (os 4 arquivos do Vite saíram, ver abaixo).

## Fase 3 — fontes (09/10/2026, aprovado pelo dono)
- 125 `new Font` da Cronometragem (fora o telão) → `Tokens.Fonte`/`FonteSemibold`/`FonteNumero` no degrau mais próximo
  da escala (11·12·13·15·17·22·28·34 px). Fica o cronômetro grande (44 pt) e a arte exportada "Ranking por peso".
- Cabeçalho em 1280: os passos ganham um 4º nível curto ("Crono", "Equal.") — antes o seletor cobria o menu.
- Fotos antes/depois (simulador :4153) em 1280×720 e 1440×900. Publicação: Cronometragem 1.0.50 depois das 21:45.

## Fase 7 — feita (09/10/2026, aprovado pelo dono)
- Tablet do sorteio: `object Cor` aponta para `Tokens.Escuro` (neon #00E676, fundo #030504); texto sobre o verde escuro
  (`Cor.SobreVerde`, contraste); themes.xml usa `@color/kib_escuro_*`. APK 1.5 (versionCode 6), assinado v1+v2,
  em C:KartodromoAppsinstaladores e no link cadastro.kartodromodebetim.com.br/app/SorteioKarts.apk (o link estava
  entregando um APK antigo de 1,1 MB). Fotos no emulador "tablet" com o simulador :4150.

## Fase 2 — publicada (Recepção 1.0.51/1.0.52, 09/10/2026 à noite)
- 279 usos dos nomes antigos (`Tokens.Verde`, `Tokens.Linha`…) → `Tokens.Claro.*`; 18 cores soltas quase iguais → token;
  97 cores próprias mantidas (painéis escuros do troco/voucher, destaques). 199 fontes na escala.
- Muda de fato: texto terciário #8E8E93→#76767B, laranja #B26A00→#9A5B00, azul de link #1E6FE8→#0A63D6 (contraste).
- Foi junto com a correção urgente do ponteiro preso/lista travando (não havia fonte da 1.0.47 separada). Comparação
  antes/depois continua disponível: `C:KARTODROMO	mpcomparar-recepcao.ps1` (o dono digita o login); build anterior para
  voltar atrás em `C:KARTODROMO	mpecepcao-antes`.
- Junto: `Grade` que não refaz colunas/rolagem na sincronização de 10 s e `Seguro.Rodar` com ponteiro por contagem
  (ver [tabela-e-grade](../03-componentes/tabela-e-grade.md) e [carregando](../03-componentes/carregando.md)).

## Fase 6 — feita (09/10/2026)
- 35 tokens `componente.totem.*` com os **valores exatos** de antes (cartão de vidro, textos, campo, selos Super/informativo,
  contornos e véus em branco translúcido, caixa de marcar, menu da equipe). `Estilo` (16 cores) e 23 cores soltas de
  `Controles.cs`/`FormTotem.cs` passaram a ler deles; sobram só tons calculados a partir do verde (`Estilo.Verde` com alfa).
- Prova: autoteste do totem (36 fotos: 1366×768, 1920×1080, 125% e 150%) **idêntico byte a byte** entre o código antigo e o
  novo. (Uma 1ª captura do alerta a 150% oscilou; refeita com o código antigo, bateu 36/36.)
- `KARTODROMO_FORA_DA_TELA=1` no autoteste do totem: roda num PC em uso (ORBITS) sem cobrir a tela de ninguém.
- `tests/design-tokens/totem-congelado.test.ts` trava os valores aprovados e a paleta sem cor solta.

## Fase 8 — concluída (09/10/2026)
- `index.html`, `src/main.tsx`, `src/vite-env.d.ts` e `vite.config.ts` (entrada do site antigo em Vite) apagados; o
  `tsconfig.json` não precisa mais excluí-los. Build de produção, tipos, lint e testes passam.

## Aceite de cada fase
1. `dotnet build` sem avisos + testes .NET; `npm test`, `typecheck`, `lint`, `build`.
2. Autoteste nas 5 resoluções + modo degradado ([aceite-de-tela](../08-governanca/aceite-de-tela.md)); comparação com o canvas aprovado.
3. Contraste dos tokens usados (automático) + roteiro de teclado.
4. `npm run lint:design` com contagem **menor** e baseline baixada.
5. Diff vazio nos arquivos congelados (telão) e, na fase 6, fotos do totem idênticas.
6. Changelog + versão; instalar fora do horário, com o PC livre.

## Ordem das telas dentro de cada app
Primeiro as mais usadas e com mais problemas (pela [matriz impacto × esforço](../08-governanca/auditoria-ux-ui.md)):
Recepção → Checkout, Cliente, Agenda, Terminal; Crono → Ao vivo, Pilotos, Bateria, Equalização, Cadastros.
