# Barra lateral (sidebar) e navegação

**Status:** canônico · **Tema:** ambos

## Para que serve
Navegar entre as áreas de um app (admin web, Recepção) ou entre itens de uma árvore (baterias do dia na Cronometragem).

## Anatomia
```
┌──────────────────────┐  largura 280–340 · cor.superficie.lateral · borda direita sutil
│ [logo] Recepção      │  marca no topo (opcional se o cabeçalho já tem)
│                      │
│ OPERAÇÃO             │  grupo: legenda 11, cor.texto.secundario, MAIÚSC.
│ ▌[■] Caixa       (3) │  ativo: cor.selecao.fundo + barra 3 px cor.acao.principal + texto semibold
│  [■] Clientes        │  item 40 px, ícone 20, raio.botao, margem 8
│  [■] Agenda          │
│ GESTÃO               │
│  [■] Relatórios      │
│ ──────────────────── │
│  [■] Configurações   │  rodapé: usuário, sair, versão
└──────────────────────┘
```

## Estados do item
Normal · hover (`superficie.campo`) · ativo · foco · com contador (selo à direita) · com alerta (ponto + dica) ·
desabilitado (sem permissão: **esconder**, não desabilitar, salvo se for informativo).

## Comportamento
| Gatilho | Interface | Efeito |
|---|---|---|
| Clique no item | marca ativo, troca o conteúdo | web: muda a rota (URL compartilhável) · desktop: troca o painel |
| Enter / Espaço | idem | — |
| ↑ ↓ | move entre itens | — |
| Clique no grupo (recolhível) | abre/fecha; estado lembrado | — |
| Botão recolher (≥ 1024) | vira trilho de 64 px só com ícones + dica | lembrado |
| < 1024 px | vira gaveta sobre o conteúdo (véu); fecha ao escolher ou Esc | — |
| Nome longo (árvore) | corta com "…", dica com o nome inteiro | — |

## Regras
- No máximo 2 níveis. Ordem por frequência de uso, não alfabética.
- O item ativo é sempre visível (rola até ele ao abrir).
- Sem permissão → o item não aparece; acessar a rota direto mostra "Sem permissão" ([estados](../04-padroes-de-tela/estados-vazio-erro-carregando.md)).

## Implementação
| Plataforma | Onde |
|---|---|
| Web admin | `AdminShell` + `components/admin/navigation.ts` (fonte única dos itens) |
| WinForms Recepção | `VisualPrincipal.Lateral` + lista de áreas |
| WinForms Crono | árvore de baterias `ArvoreSemRolagemLateral` |
| Site | `Header` (topo, não lateral) + `MobileStickyBar` |
