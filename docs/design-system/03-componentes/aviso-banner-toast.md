# Avisos: nota, banner e toast

**Status:** canônico · **Tema:** ambos

## Qual usar
| Componente | Quando | Some sozinho? |
|---|---|---|
| **Nota (inline)** | explicação ou alerta ligado a uma seção/campo ("Esta bateria já tem resultado enviado") | não |
| **Banner** | condição da tela inteira que persiste (sem conexão com o servidor, caixa fechado, modo simulador) | só quando a condição acaba |
| **Toast** | confirmação de ação concluída ou falha não bloqueante | sucesso/info: 4–6 s · erro: **não** |
| **Diálogo** | precisa de decisão agora | — ([modal](modal-e-dialogo.md)) |

## Anatomia
```
Nota    ┌▌ ⓘ  Texto da nota com o que fazer.          ┐  fundo cor.estado.*.fundo, barra 3 px estado, raio.campo
Banner  ┌ ⚠  Sem conexão com o servidor desde 17:40. Tentando de novo…   [Tentar agora] ┐  largura total, topo do conteúdo
Toast           ┌ ✓  Cliente salvo.        [Desfazer] ✕ ┐   canto inferior direito, elevacao.2, máx. 420 px
```
Ícone por estado: ✓ sucesso · ⓘ info · ⚠ aviso · ✕ perigo. Texto `corpo`, `cor.estado.*.texto` no ícone e
`cor.texto.principal` no texto.

## Comportamento
| Gatilho | Interface | Efeito |
|---|---|---|
| Ação concluída | toast entra (200 ms) | — |
| Passar o mouse/focar o toast | pausa o tempo de sumir | — |
| Desfazer | reverte a ação e mostra "Desfeito." | — |
| ✕ | fecha | — |
| Vários toasts | empilham (máx. 3, o mais novo embaixo) | — |
| Banner com ação | botão P dentro do banner | ex.: reconectar |

## Acessibilidade
Toast: `aria-live="polite"` (erro: `assertive`). Banner: `role="status"`/`alert`. Nada de informação que **só**
aparece num toast que some.

## Implementação
WinForms: nota `DialogoDesign.Nota(...)`; **`Banner`** (`new Banner("Sem conexão…", Estado.Perigo, "Tentar agora", Reconectar)`) e
**`Toast.Mostrar(this, "Cliente salvo.")`** prontos em `Kartodromo.Comum/Design/Avisos.cs` (no autoteste o toast é só registrado). Web: componentes `Aviso`, `Toast`. timing-ui: `.report-alert`, `.hint`. Totem: `Alerta` — travado.
