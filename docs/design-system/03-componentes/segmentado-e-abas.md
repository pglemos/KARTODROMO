# Segmentado, abas e passos

**Status:** canônico · **Tema:** ambos

## Quando usar cada um
| Componente | Quando | Exemplo |
|---|---|---|
| **Segmentado** | alternar a **visão** do mesmo conteúdo (2–5 opções curtas) | Dia / Semana / Mês; Todos / Pagos / A pagar |
| **Abas** | separar **conteúdos diferentes** da mesma entidade | Cliente: Dados · Histórico · Fidelidade |
| **Passos** | fluxo em ordem, com progresso | Crono: 1 Bateria → 2 Pilotos → 3 Corrida |

## Anatomia
```
Segmentado  ┌────────┬────────┬────────┐   trilho cor.superficie.campo, raio.botao
            │ ■ Dia  │ Semana │  Mês   │   ativo: cor.superficie.padrao + elevacao.1, texto semibold
            └────────┴────────┴────────┘   altura 32 (P) / 40 (M)

Abas        Dados   Histórico   Fidelidade
            ─────                            ativo: sublinhado 2 px cor.acao.principal + texto principal
                                             inativo: cor.texto.secundario

Passos      (1) Bateria ─── (2) Pilotos ─── (3) Corrida
            concluído ✓ verde · atual: círculo cheio cor.acao.principal · futuro: contorno cinza
```

## Estados
Ativo · inativo · hover (fundo leve) · foco (anel) · desabilitado (com dica) · com contador (selo "3") · com alerta
(ponto `aviso` + texto na dica).

## Comportamento
| Gatilho | Interface | Efeito |
|---|---|---|
| Clique | troca na hora, sem animação longa (≤ 200 ms) | segmentado: refiltra · abas: mostra o painel · passos: só volta para passo **concluído** |
| ← → com foco | move entre opções e ativa (segmentado/abas) | — |
| Ctrl+Tab / Ctrl+Shift+Tab | próxima/anterior aba | — |
| Trocar aba com edição não salva | mantém os dados digitados (não perde) | — |
| Passo futuro | não clicável; dica "Conclua o passo 2 primeiro" | — |

## Faça / não faça
- ✅ Rótulos curtos e paralelos. ✅ Lembrar a última aba aberta por janela.
- ❌ Abas em duas linhas. ❌ Segmentado com mais de 5 opções (use lista). ❌ Aba que salva sozinha ao sair sem avisar.

## Implementação
| Plataforma | Onde |
|---|---|
| WinForms | `SegmentoDesign` (Comum), `DialogoDesign.Abas(...)`, `PassosSegmento` (Crono), `AbasSemCabecalho` (Crono, conteúdo das abas) |
| Web | `role="tablist"`/`tab`/`tabpanel`; segmentado `role="radiogroup"` |
| timing-ui | `.tabs`/`.tab-content` (operador.html) |
| Android | `TabRow` / `SegmentedButton` |
