# Lista com filtros (consulta e cadastro)

Clientes, vendas, reservas, karts, baterias passadas, vouchers.

```
Clientes                                                     [+ Novo cliente]
512 cadastrados
┌──────────────────────────────────────────────────────────────────────────┐
│ [🔍 Nome, CPF ou telefone]  [Todos|Ativos|Bloqueados]  [Filtros ▾]  [Exportar] │
│ (Aniversariantes ✕)  Limpar filtros                         37 de 512    │
├──────────────────────────────────────────────────────────────────────────┤
│ tabela                                                                   │
│ …                                                                        │
├──────────────────────────────────────────────────────────────────────────┤
│ seleção: 1 cliente      [Editar] [Histórico] [Excluir]        ‹ 1 2 3 ›  │
└──────────────────────────────────────────────────────────────────────────┘
```

## Fluxo
| Gatilho | Resposta | Destino |
|---|---|---|
| Abrir a tela | foco na busca; lista carrega (esqueleto) | permanece |
| Digitar | filtra ao vivo | permanece |
| Enter com 1 resultado | abre o registro | diálogo de edição |
| Duplo clique / Enter na linha | abre o registro | diálogo de edição |
| + Novo | abre cadastro vazio; se havia busca, ela preenche o campo correspondente (nome/CPF) | diálogo |
| Salvar no diálogo | fecha; a linha aparece **selecionada** e visível; toast | permanece |
| Excluir | [confirmação destrutiva](../03-componentes/confirmacao-destrutiva.md) | permanece |
| Exportar | gera o arquivo do que está **filtrado** (CSV/PDF) | permanece; toast com "Abrir pasta" |

## Regras
Ações de linha ficam desabilitadas sem seleção (com dica). Filtros e ordenação lembrados na sessão. Sem resultado →
[estado vazio](../03-componentes/estado-vazio.md) com "Cadastrar" já preenchido com o termo.
