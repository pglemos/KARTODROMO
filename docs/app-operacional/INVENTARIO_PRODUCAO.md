# Inventário da produção (leitura em 31/10/2026, via `ssh orbits`)

Nada foi alterado na produção. Cópias de leitura ficaram só em pasta temporária.

## Serviços
| Item | Evidência |
|---|---|
| Máquina | `CRONOMETRAGEM` (Windows, sessão PowerShell) |
| Código | `C:\repos\KARTODROMO`, executado com tsx, não pacote compilado |
| Cronometragem | porta `4050` em `0.0.0.0` |
| Outras portas | `4051`, `7070`, `7680` em escuta. `7070` respondeu sem dados à rota de grid sem chave |
| Tarefas ativas | `KartodromoCronometragem`, `KartodromoLiveTimeTunnel`, `KartodromoTVPublicBridge`, `KartodromoVigiaTVs` |
| Programas Windows | `C:\Program Files\Kartodromo\Cronometragem` e `Recepcao` |
| Serviço do banco e `cloudflared` | Não apareceram como serviço Windows no filtro usado. NÃO VERIFICADO onde rodam |

## Versões
- Produção: branch `main`, commit `78b401b` (20/10/2026, "Recepção/Crono 1.0.70"), com **321 arquivos alterados sem commit**. `timing-server.ts` modificado em 31/10/2026 17:54.
- Máquina de desenvolvimento: `fix/mobile-exclusao-protegida`, `f5108f6`, com 207 arquivos alterados sem commit.
- App base: Expo `~57.0.31`, Expo Router `~57.0.29`, React Native `0.86.3`.

## Diferenças produção × desenvolvimento (ignorando fim de linha)
| Arquivo | Linhas diferentes | Afeta o app? |
|---|---:|---|
| `services/timing-server.ts` | 378 | **Sim.** Produção tem `operator-auth`, redação de e-mails e `agenda-saida`; desenvolvimento não |
| `services/ops-server.ts` | 584 | Sim, a conferir por rota usada |
| `lib/timing/race-engine.ts` | 42 | **Sim.** `startSession` difere: em desenvolvimento há largada parada com cronômetro imediato |
| `lib/timing/sorteio.ts` | 3 | **Sim.** Produção aceita só kart numérico; desenvolvimento aceita alfanumérico |
| `lib/timing/equalizacao.ts` | 2 | Sim. Desenvolvimento tem meta fixa |
| `lib/timing/kart-fisico.ts` | 0 | Não |

**Risco:** nenhum dos dois lados é subconjunto do outro. Publicar a partir da máquina de desenvolvimento desfaria proteções em produção. As linhas citadas nestes documentos são da **cópia da produção**, salvo aviso.

## Backup e janela de deploy
- `KartodromoTimingBackupOffsite`: **última execução 31/10/2026 04:00 terminou com código 1**. Próxima: 01/11 04:00. A causa não foi investigada; é um alerta à parte.
- Os dados de prova ficam em JSON por bateria, em `data/timing` (escrita atômica).
- Janela segura: fora de bateria. Horário exato NÃO VERIFICADO.

## Testes
- Baseline contra a **cópia da produção**: 10/10.
- Baseline contra o commit `f5108f6`: 9/10. Falha o teste do bloqueio pela internet, porque a condição está escrita de outro jeito. Essa falha é da diferença entre as versões; a produção é a referência.
- `timing-sorteio` e `timing-engine` no commit: 72/72.
- Limitação: os testes de `preparar` e do bloqueio pela internet leem o código-fonte. O servidor completo não foi executado; os demais exercitam as funções reais.
