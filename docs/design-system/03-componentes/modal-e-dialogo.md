# Modal e diálogo

**Status:** canônico (consolidação na fase 1) · **Tema:** ambos

## Para que serve
Tarefa focada que precisa terminar ou ser cancelada antes de voltar (cadastrar, editar, pagar, configurar).
Não use para mensagens de sucesso (use [toast](aviso-banner-toast.md)) nem para conteúdo que o usuário quer comparar com a tela de trás.

## Anatomia
```
            véu cor.sobreposicao
   ┌──────────────────────────────────────────────────┐  raio.janela 18 · elevacao.3 · superficie.padrao
   │ [■36] Título do diálogo                       ✕  │  cabeçalho 62 px (fixo)
   │       subtítulo/contexto                         │
   ├──────────────────────────────────────────────────┤
   │  SEÇÃO                                           │  corpo: fundo.app, seções = cartões; ROLA se não couber
   │  Rótulo           Rótulo          Rótulo         │  grade de 6 colunas, calha 16, margem 24
   │  [campo      ]    [campo   ]      [campo  ]      │
   ├──────────────────────────────────────────────────┤
   │ texto do rodapé       [Excluir]  [Cancelar] [Salvar] │  rodapé 60 px (fixo)
   └──────────────────────────────────────────────────┘
```

## Tamanhos
560 (confirmação/simples) · 760 · 860–900 (com seções) · **960 padrão** (`componente.janela.largura-padrao`) · 1060
(cadastro com lista). Altura: acompanha o conteúdo até a área útil da tela; acima disso o **corpo rola** e cabeçalho e
rodapé ficam fixos. < 768 px: tela cheia.

## Estados
Abrindo (véu + sobe 8 px, 320 ms) · aberto · salvando (primário "Salvando…", campos bloqueados) · erro (mensagem no topo
do corpo + campos com erro marcados; foco no primeiro erro) · com alteração não salva (fechar pergunta).

## Comportamento
| Gatilho | Interface | Efeito / destino |
|---|---|---|
| Abrir | foco no primeiro campo editável | tela de trás fica inerte |
| Enter | aciona o primário (exceto em multilinha) | salva → fecha → toast na tela de origem, que **permanece** e atualiza |
| Esc / ✕ / Cancelar | sem alterações: fecha · com alterações: "Descartar alterações?" | nada gravado |
| Clique no véu | **não fecha** (evita perder dados) | — |
| Salvar com erro de validação | mantém aberto, mostra erros | — |
| Falha de rede | mantém aberto, dados preservados, "Tentar de novo" | — |
| Ação secundária que abre outro diálogo | o novo fica por cima com véu; ao fechar, foco volta | — |

## Teclado e acessibilidade
Foco preso no diálogo; Tab circula; ao fechar o foco volta ao controle que abriu. Web: `role="dialog"`,
`aria-modal="true"`, `aria-labelledby` no título. WinForms: `AcceptButton`/`CancelButton`, `ShowDialog(dono)`.

## Faça / não faça
- ✅ Título diz a tarefa ("Novo cliente", "Editar bateria 14"). ✅ Rodapé sempre visível.
- ❌ Diálogo sobre diálogo sobre diálogo. ❌ Rodapé fora da área visível. ❌ `MessageBox` do Windows em tela nova (use `Msg`/diálogo do sistema).

## Implementação
| Plataforma | Hoje | Destino |
|---|---|---|
| WinForms | `DialogoDesign` (Comum, padrão), `CartaoModal` (base), `Janela`; `DialogoDados` (Crono), `ModalMeta` (Recepção). **`Msg` já desenha no padrão** (`DialogoMensagem`, com volta à caixa do Windows se falhar) | **`DialogoDesign`** único; `Janela`, `DialogoDados`, `ModalMeta` migram nas fases 2–3 |
| Web | `WhatsAppQuoteModal` (site); admin `.dialog-actions` | componente `Dialogo` com `<dialog>` |
| Android | `AlertDialog`/`Dialog` | — |
| Totem | `Alerta` — travado |
