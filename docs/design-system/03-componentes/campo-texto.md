# Campo de texto

**Status:** canônico · **Tema:** ambos

## Para que serve
Digitar texto, número, CPF, telefone, e-mail, valor, hora. Para escolher de uma lista fechada use [seleção](selecao-e-data.md).

## Anatomia
```
Rótulo do campo *                       ← 1
┌────────────────────────────────────┐
│ [ícone] valor digitado        [ação]│  ← 2, 3, 4   altura 40 (M) / 32 (P)
└────────────────────────────────────┘
Ajuda ou mensagem de erro               ← 5
```
1. Rótulo **acima**, `fonte.tamanho.pequeno` semibold, `cor.texto.secundario`; `*` = obrigatório.
2. Caixa — `cor.superficie.padrao` (ou `.campo` na busca), borda `cor.borda.campo`, `raio.campo`.
3. Valor — `fonte.tamanho.corpo`, `cor.texto.principal`. Placeholder `cor.texto.terciario` (exemplo, nunca o rótulo).
4. Ação opcional (P, à direita): "Buscar", "Limpar ✕", "Mostrar".
5. Ajuda/erro — `fonte.tamanho.pequeno`.

## Variantes
Texto · Número (alinhado à direita, só dígitos) · Valor R$ (máscara, 2 casas) · CPF/telefone (máscara) · Hora `hh:mm` ·
Senha (com mostrar/ocultar) · Multilinha (observações, altura mín. 3 linhas, com contador se tiver limite) · Busca
(ícone lupa, ver [filtros-e-busca.md](filtros-e-busca.md)).

## Estados
| Estado | Aparência |
|---|---|
| Normal | borda 1 px `cor.borda.campo` |
| Hover | borda escurece levemente |
| Foco | borda 2 px `cor.borda.foco`, cursor no fim |
| Preenchido | igual normal |
| Erro | borda 2 px `perigo` + ícone + mensagem embaixo em `cor.estado.perigo.texto` |
| Desabilitado | fundo `cor.superficie.campo`, texto `desabilitado`, sem foco |
| Somente leitura | sem borda, fundo `superficie.suave`, texto selecionável |

## Comportamento
| Gatilho | Interface | Efeito |
|---|---|---|
| Clique / Tab | foca; em edição de cadastro existente, **seleciona tudo** | — |
| Digitação | máscara aplicada ao vivo; erro anterior some ao corrigir | — |
| Sair do campo | valida o formato (CPF, e-mail, hora) e mostra erro se houver | — |
| Enter (campo único/busca) | executa a busca ou aciona o primário do diálogo | — |
| Enter (multilinha) | nova linha (Ctrl+Enter salva) | — |
| Esc | limpa a busca; em diálogo, fecha (perguntando se há alteração) | — |
| Colar | aceita e limpa formatação (CPF colado com pontos funciona) | — |

**Totem:** teclado USB físico, **nunca teclado virtual na tela**.

## Validação
Formato no sair do campo; regra de negócio (CPF já cadastrado, limite de idade) ao salvar, com mensagem que diz o que
fazer. Nunca bloquear a digitação com alerta modal.

## Faça / não faça
- ✅ Rótulo sempre visível. ✅ Largura proporcional ao conteúdo esperado (CEP curto, nome longo).
- ❌ Placeholder no lugar do rótulo. ❌ Erro só por cor. ❌ Campo sem borda em formulário de cadastro.

## Tokens
`cor.superficie.padrao|campo`, `cor.borda.campo|foco`, `cor.estado.perigo.*`, `cor.texto.*`, `raio.campo`,
`componente.controle.altura-m|p`, `borda-largura.*`, `fonte.tamanho.corpo|pequeno`.

## Implementação
| Plataforma | Onde |
|---|---|
| WinForms | `PecasDesign.Texto/Numero/Hora` + `DialogoDesign.Campo(grade, rótulo, controle, colunas, ações)`; Recepção `KitVisual` (fase 2) |
| Web | `<label>` + `<input>` com `--kib-*`; admin `.field` |
| timing-ui | `.field` (admin.html), `.sign-field` (resultado) |
| Android | `OutlinedTextField` |
| Totem | `CampoTexto` — travado |
