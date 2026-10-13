# Componentes existentes

Legenda: **fica** = vira (ou já é) o componente canônico · **funde** = absorvido por outro · **domínio** = específico de
um app, fica com tokens · **travado** = totem/telão, não mexer.

## Desktop — `Kartodromo.Comum`
| Classe | Função | Destino |
|---|---|---|
| `Botao`, `Selo`, `Banner`, `Toast`, `EstadoVazio`, `IndicadorCarregando`, `DialogoMensagem`, `IconesLucide`, `CoresEstado` (`Design/`) | componentes canônicos da fase 1 | **fica** |
| `DialogoDesign` | diálogo com seções, grade de 6 colunas, rodapé fixo | **fica** |
| `CartaoModal` | janela sem borda arredondada | **fica** (base do diálogo) |
| `Janela` | janela simples antiga | funde → `DialogoDesign` |
| `TabelaDesign` | tabela padrão | **fica** |
| `Grade`, `GradeSelectionHeaderCell` | grade densa com marcação | funde → `TabelaDesign` |
| `ListaDesign`, `DataDesign`, `SegmentoDesign` | lista suspensa, data, segmentado | **fica** |
| `BotaoPlano` | botão base | **fica** → `Botao` com variantes |
| `PecasDesign` | campos (texto, número, hora), seta | **fica** |
| `FiltroColuna` | funil de filtro na coluna | **fica** |
| `Forma` | raio, ícone, tile | **fica** |
| `Icone` (Ui.cs) | tile com glifo MDL2 | funde → `Forma.Icone` |
| `Tema` (Ui.cs) | paleta antiga | funde → `Tokens` |
| `Msg`, `Prompt` | mensagens/pergunta | **fica**, redesenhado |
| `Relatorio` | impressão | **fica** |
| `RegistroDesign`, `FonteReg`, `ListaReg` | registro de design/fontes | **fica** (infra) |
| `Tokens` + `Tokens.g.cs` | tokens | **fica** (gerado) |

## Desktop — Cronometragem
`LiveGrid` (domínio, fica) · `PainelLed` (domínio) · `BotaoBandeira` (domínio) · `PilulaStatus` (funde → `Selo`) ·
`PainelArredondado` (funde → cartão) · `PassosSegmento` (fica como "Passos" em Comum) · `BotaoQuadrado` (funde → `Botao`) ·
`DialogoDados` (funde → `DialogoDesign`) · `AbasSemCabecalho`, `ArvoreSemRolagemLateral` (infra, ficam) ·
`TemaCrono` (funde → `Tokens`) · `FormTV` (**travado**) · `TestesPainel` (teste).

## Desktop — Recepção
`KitVisual` (funde → tokens/componentes) · `VisualPrincipal` (barra e lateral: sobe para Comum) · `SeloTerminal`
(funde → `Selo`) · `SegmentoMes` (funde → `SegmentoDesign`) · `ModalMeta` (funde → `DialogoDesign`) ·
`FormListaParticipantes` (tela).

## Desktop — Totem (**travado**)
`CabecalhoTotem`, `CampoTexto`, `CampoLista`, `Cartao`, `Pilula`, `Marcador`, `Alerta`, `IconeSucesso`, `TelaCanvas`,
`Estilo`, `CoresMenu`.

## Web
| Componente | Destino |
|---|---|
| `src/components/site-ui/*`: `AngledButton`, `BigCTA`, `GlassPanel`, `PosterCard`, `SectionHeading`, `StatCounter`, `Ticker`, `MobileStickyBar`, `ScrollProgressBar`, `SocialIcons`, `WhatsAppFloat`, `WhatsAppQuoteModal` | **fica** (público, escuro) → `components/site` (fase 8) |
| `src/components/*` (seções do site: `Hero`, `Header`, `Footer`, `Booking`…) | **fica** |
| `components/admin/*`: `AdminShell`, `AdminDashboard`, `AdminModulePage`, `LegacyAdminContent`, `LogoutButton`, `navigation.ts` | **fica** (claro, fase 4) |
| `components/telao/*`, `app/telao…` | **travado** |

## timing-ui
Classes `.btn`, `.primary`, `.danger`, `.panel`, `.field`, `.toolbar`, `.table-wrap`, `.empty`, `.status` (admin.html);
`.rdlc-table`, `.report-*`, `.sign-*` (resultado.html); `.b-blue`, `.b-green`, `.pill`, `.tabs` (operador.html) — ficam
os nomes, valores passam a `--kib-*` (fase 5).

## Android
`Tema.kt` (funde → `design/Tokens.kt`), telas `TelaBaterias`, `TelaPreparar`, `TelaSortear`, `TelaResultado`, `TelaFiscal`.
