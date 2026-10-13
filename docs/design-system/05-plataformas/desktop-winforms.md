# Apps nativos .NET (WinForms)

Cronometragem, Recepção e Totem são **apps nativos .NET instalados em cada PC** — nunca app web/Chrome.
Código em `desktop/src/`; peças comuns em `Kartodromo.Comum`.

## Tokens
```csharp
using Kartodromo.Comum;

painel.BackColor = Tokens.Claro.CorSuperficiePadrao;
rotulo.ForeColor = Tokens.Claro.CorTextoSecundario;
rotulo.Font      = Tokens.Fonte(13);                 // px → pt (× 0,75)
titulo.Font      = Tokens.Fonte(17, FontStyle.Bold);
botao.Height     = Tokens.Claro.ComponenteControleAlturaM;
Forma.AplicarRaio(cartao, Tokens.Claro.RaioCartao);
```
- `Tokens.g.cs` é **gerado** (`npm run tokens`); `Tokens.cs` só tem `Fonte(px, estilo)`.
- Nomes antigos (`Tokens.Superficie`, `Tokens.VerdeEscuro`, `Tokens.Espaco3`…) continuam com o valor de antes
  (`legado.desktop.*`, obsoletos). Tela nova usa `Tokens.Claro.*`.
- Totem (escuro) usará `Tokens.Escuro.*` + `componente.totem.*` na fase 6, com os mesmos valores de hoje.

## Regras de layout
1. `TableLayoutPanel`/`FlowLayoutPanel` (`WrapContents = true` em barras de botão), `Dock`/`Anchor`. Nada de posição
   absoluta calculada para 1920.
2. Os apps rodam **DpiUnawareGdiScaled**: o layout é em pixels lógicos; teste em 1280×720 e 1366×768 a 125%.
3. Altura de diálogo acompanha o conteúdo, limitada à área útil; corpo rola, cabeçalho/rodapé fixos (`DialogoDesign`).
4. `Forma.AplicarRaio` e `Forma.ArredondarComContorno` acompanham o tamanho sozinhos (chamar de novo só troca o raio). A
   janela `CartaoModal` ainda precisa de `Arredondar()` depois de mudar o tamanho por código.
5. `AccessibleName` em botão só-ícone e controles desenhados; `AcceptButton`/`CancelButton` em todo diálogo.
6. Texto que pode ser longo: `AutoEllipsis = true` + dica.

## Peças a usar (Comum)
Componentes do design system (`Design/`): `Botao`, `Selo`, `Banner`, `Toast`, `EstadoVazio`, `IndicadorCarregando`,
`IconesLucide`, `CoresEstado`; mensagens por `Msg` (já desenhadas) e `Msg.Confirmar` para apagar/estornar.

Peças anteriores: `DialogoDesign`, `CartaoModal`, `TabelaDesign`, `Grade`, `ListaDesign`, `DataDesign`, `SegmentoDesign`, `BotaoPlano`,
`PecasDesign` (campos), `FiltroColuna`, `Forma` (raio, ícone, tile), `Msg` (mensagens + `erros.log`), `Prompt`.
Ainda a eliminar ao migrar as telas: `TemaCrono`, `Tema` (Ui.cs), `KitVisual`, `Estilo`, `Icone.Tile`.

Testes dos componentes: `dotnet run --project desktop/tests/Kartodromo.Comum.Testes -c Release -- <pasta>` (com a pasta,
salva `galeria.png` e as mensagens para conferir o desenho).

## Teste de telas (fotos fora da tela)
```powershell
$env:KARTODROMO_TESTE = 'telas'; $env:KARTODROMO_AUTOTESTE_TAMANHO = '1280x720'
.\Kartodromo.Cronometragem.exe --autoteste C:\temp\fotos-1280
```
(A ordem importa: `--autoteste <pasta>`. Outra ordem abre o app normal e a TV em tela cheia.)
Recepção: `--teste-telas`. Apontar o `appsettings` para o simulador (`:4153`), nunca para a pista em uso.
Detalhe em [08-governanca/aceite-de-tela.md](../08-governanca/aceite-de-tela.md).

## Publicação
`dotnet publish` antes de instalar (o instalador remoto copia `desktop\publish` como está; o hash precisa mudar).
Não instalar em PC em uso sem autorização; versão em `Directory.Build.props`.
