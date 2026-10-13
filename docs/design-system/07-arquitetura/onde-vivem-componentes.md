# Onde vivem os componentes

| Plataforma | Lugar único | Pode existir fora? |
|---|---|---|
| WinForms | `desktop/src/Kartodromo.Comum` | só componente de **domínio** de um app (ex.: `LiveGrid`, `BotaoBandeira`, `PainelLed` na Crono) e, mesmo assim, só com tokens |
| Web site | `src/components/site-ui` → `components/site` (fase 8) | não |
| Web admin | `components/admin` (+ `components/ui` na fase 4) | não |
| timing-ui | `services/timing-ui/tokens.css` + classes compartilhadas (fase 5: `timing-ui/base.css`) | página não define cor própria |
| Android | `android/sorteio/.../design/` | não |
| Totem | `Kartodromo.Autoatendimento/Controles.cs` | travado |

## Qual duplicata sobrevive (fase 1 — ✅ = já feito)
| Função | Hoje | Fica | Sai |
|---|---|---|---|
| Diálogo | `DialogoDesign`, `CartaoModal`, `Janela`, `DialogoDados`, `ModalMeta` | `DialogoDesign` (sobre `CartaoModal`) | `Janela`, `DialogoDados`, `ModalMeta` viram `DialogoDesign` |
| Botão ◐ | `BotaoPlano`, `BotaoRodape`, `AcaoCampo`, `BotaoBarra`, `BotaoQuadrado`, `BotaoIcone`, `KitVisual` | `Botao` (pronto, herda `BotaoPlano`) + `BotaoBandeira` | demais, ao migrar a tela |
| Tabela | `TabelaDesign`, `Grade`, `LiveGrid`, `DataGridView` cru | `TabelaDesign` + `LiveGrid` | `Grade` absorvida; grades cruas migram |
| Paleta | `Tokens` (legado), `TemaCrono`, `Tema` (Ui.cs), `KitVisual`, `Estilo`, `VisualPrincipal` | `Tokens.Claro/Escuro` | as demais |
| Raio/forma ✅ | `Forma.Redondo/AplicarRaio`, `VisualPrincipal.Redondo`, `KitVisual.AplicarRaio/CaminhoArredondado`, `Arredondar` locais | `Forma` (`AplicarRaio`, `ArredondarComContorno`) | cópias agora só repassam ao `Forma` |
| Ícone | `Icone.Tile`, `VisualPrincipal.Icone`, `Forma.Icone/Tile` | `Forma.Icone` (PNG do SVG) | `Icone.Tile` |
| Marcação ✅ | `Forma.CheckVerde`, `KitVisual.CheckVerde` | `Forma.CheckVerde` | a da Recepção repassa |
| Selo ◐ | `PilulaStatus`, `SeloTerminal` | `Selo` (pronto) | cópias, ao migrar a tela |
| Mensagens ✅ | `Msg` (MessageBox) | `Msg` desenhado (`DialogoMensagem`) + `Msg.Confirmar` + `Toast`/`Banner` | MessageBox cru (só como reserva) |
