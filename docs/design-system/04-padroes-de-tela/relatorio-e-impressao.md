# Relatório e impressão

Resultado da bateria, relatório de equalização (PDF da oficina), fechamento de caixa, relatórios gerenciais.

## Tela do relatório (antes de imprimir)
```
Resultado — Bateria 14 · 08/10/2026 17:40           [Enviar por e-mail] [Imprimir] [PDF]
┌───────────────────────────────────────────────────────────┐
│  pré-visualização da folha (A4, fundo branco)             │
└───────────────────────────────────────────────────────────┘
```
- Barra de ferramentas no topo, **fora** da área impressa (`@media print` esconde).
- Pré-visualização = exatamente o que sai no papel/PDF.
- Carregando: esqueleto da folha. Erro: mensagem + "Tentar de novo" (`.report-alert`, `.retry-button`).

## Folha impressa
| Elemento | Regra |
|---|---|
| Papel | A4 retrato (relatórios largos: paisagem), margens 12 mm |
| Cabeçalho | logo + nome do kartódromo + título + data/hora da emissão |
| Corpo | **sempre tema claro**, preto sobre branco, sem fundos cheios (economia de tinta); tabelas com linhas finas |
| Números | fonte numérica, alinhados à direita |
| Rodapé | "Página X de Y", quem emitiu, versão do sistema |
| Assinaturas | linhas de assinatura (`.sign-line`) quando há aceite (termo, fechamento de caixa) |
| Quebra | cabeçalho da tabela repete em cada página; linha não quebra no meio |

## Comportamento
| Gatilho | Efeito |
|---|---|
| Imprimir | diálogo de impressão do sistema; na Recepção, fila do agente de impressão |
| PDF | gera e oferece "Abrir"/"Abrir pasta" no toast |
| Enviar por e-mail | confirma destinatários (quantos) antes de enviar; toast "E-mail enviado a 8 pilotos." |

O resultado da bateria é enviado por e-mail **automaticamente** ao finalizar ([e-mail de resultados](../05-plataformas/timing-ui.md)).

## Implementação
`services/timing-ui/resultado.html` (classes `.rdlc-table`, `.c-right`, `.signatures-table`),
`equalizacao.html` (PDF da oficina), `FormRelatoriosCrono` / `FormRelatoriosCronometragem` (desktop), `Relatorio` (Comum).
