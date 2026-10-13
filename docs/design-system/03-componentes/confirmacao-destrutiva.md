# Confirmação destrutiva

**Status:** canônico · **Tema:** ambos

## Quando usar
Antes de ação que **apaga, estorna, cancela ou não tem volta**: excluir cliente/observação/volta, estornar pagamento,
cancelar bateria, desclassificar piloto, apagar equalização. **Não** use para ações reversíveis (prefira fazer e
oferecer "Desfazer" no toast).

## Anatomia (diálogo de 560 px)
```
┌──────────────────────────────────────────────┐
│ ⚠  Excluir a observação?                      │  ícone perigo + título com o OBJETO
│                                              │
│  "Kart 12 puxando para a direita" — 08/10    │  o item, identificado
│  Ela some do relatório da bateria 14.        │  a consequência
│  Isso não pode ser desfeito.                 │
│                                              │
│                  [Cancelar] [Excluir observação] │  foco inicial em Cancelar
└──────────────────────────────────────────────┘
```

## Níveis
| Nível | Quando | Confirmação |
|---|---|---|
| 1 | apaga 1 item simples | diálogo acima |
| 2 | apaga muitos itens ou dinheiro (estorno, cancelar bateria paga) | diálogo + **motivo obrigatório** (campo) |
| 3 | irreversível e amplo (zerar dados, apagar campeonato) | digitar o nome/número para liberar o botão |

## Comportamento
| Gatilho | Interface | Efeito |
|---|---|---|
| Abrir | foco em **Cancelar** | — |
| Enter | aciona o botão com foco (Cancelar por padrão) | — |
| Esc | cancela | nada muda |
| Botão de perigo | "Excluindo…" | executa; fecha; toast "Observação excluída." (+ Desfazer quando possível) |
| Falha | mantém aberto com a mensagem | nada parcial |

Toda ação destrutiva fica no **registro de auditoria** (quem, quando, o quê, motivo).

## Regras
- Botão de perigo repete o verbo do título ("Excluir observação"), nunca "Sim".
- Nunca confirmar o que não foi pedido ("Tem certeza que deseja salvar?").
- **Fim de bateria é sempre manual** pelo cronometrista: nenhuma confirmação automática encerra corrida.

## Implementação
WinForms: **`Msg.Confirmar(dono, "Excluir a observação?", "…consequência…", "Excluir observação")`** — `DialogoMensagem` com botão vermelho e foco em Cancelar (Enter não apaga). `Msg.Pergunta` (Sim/Não) também já sai desenhado; as telas que apagam passam a `Msg.Confirmar` nas fases 2–3.
Web: componente `ConfirmarExclusao`. Android: `AlertDialog` com botão vermelho.
