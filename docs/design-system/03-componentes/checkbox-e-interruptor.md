# Caixa de marcação e interruptor

**Status:** canônico · **Tema:** ambos

## Quando usar cada um
| Componente | Quando | Efeito |
|---|---|---|
| **Caixa de marcação** | escolher itens num formulário que será salvo depois; aceitar termos; marcar vários | só vale ao **Salvar** |
| **Interruptor** | ligar/desligar uma configuração com efeito **imediato** | aplica na hora |
| **Opção (rádio)** | escolher 1 de 2–4, todas visíveis | só vale ao Salvar |

## Anatomia
```
[✓] Rótulo da opção            (●○) Rótulo do interruptor
    texto de ajuda opcional
```
Caixa 18×18, `raio` 4, marcada = `cor.acao.principal` com ✓ branco; desmarcada = borda `cor.borda.campo`.
Interruptor 36×20, trilho `cor.acao.principal` ligado / `cor.borda.campo` desligado, bolinha branca.
Rótulo à **direita**, `fonte.tamanho.corpo`; toda a linha (caixa + rótulo) é clicável.

## Estados
Desmarcado · marcado · indeterminado (—, "alguns marcados" no cabeçalho de tabela) · hover · foco (anel em volta da
caixa) · desabilitado (com dica do motivo) · erro (termo obrigatório não aceito: mensagem embaixo).

## Comportamento
| Gatilho | Interface | Efeito |
|---|---|---|
| Clique na caixa ou no rótulo | alterna | caixa: nada até salvar · interruptor: aplica e mostra toast curto |
| Espaço com foco | alterna | idem |
| Interruptor que falha ao aplicar | volta à posição anterior + mensagem | nada muda |
| Cabeçalho "marcar todos" | marca/desmarca a página filtrada | — |

## Faça / não faça
- ✅ Rótulo afirmativo ("Enviar resultado por e-mail"). ✅ Alinhar a caixa com a linha de base dos campos (`DialogoDesign.Marca`).
- ❌ Negativa dupla ("Não desativar…"). ❌ Interruptor dentro de formulário que tem botão Salvar.

## Implementação
| Plataforma | Onde |
|---|---|
| WinForms | `CheckBox` com `DialogoDesign.Marca`; `CheckVerde` duplicado em Crono/Recepção → unificar (fase 1); rádio `DialogoDesign.Opcao` |
| Web | `<input type=checkbox>` com `accent-color: var(--kib-cor-acao-principal)`; interruptor `role="switch"` |
| Android | `Checkbox`/`Switch` |
| Totem | `Marcador` — travado |
