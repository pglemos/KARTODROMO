# Contratos legados e paridade

Regra: rota antiga não muda. O app chama adaptadores em `/api/app/v1` sobre as mesmas funções. Repetir: **D** duplica efeito, **F** a segunda falha, **I** inofensivo, **?** a confirmar no plano F3.

| Comando | Windows | Rota atual | Rep. | Trava atual | Decisão v1 |
|---|---|---|:-:|---|---|
| Sorteio | APK 1.6 | `GET/POST /api/sessions/:id/sorteio` | D parcial (nova observação, que é o marcador de confirmado) | Só em `preparando`; lista mudou → 409 | Adaptador com elegibilidade |
| Preparar | APK 1.6 | `POST /api/agenda/:id/preparar` | I em sequência; **D** em concorrência (`:3307` antes de `await`) | Nenhuma de aprovação | Adaptador com filtro |
| Troca de kart | `FormCrono.Cadastros.cs:327` | `POST .../swap-kart` + `POST .../observations` | F (kart de origem sem piloto) | Recusa kart com outro piloto | Adaptador une as duas chamadas |
| Advertência / tempo | `FormCrono.Penalidades.cs:27` | `POST .../penalties/:kart` | **D** | Tipo válido | Adaptador com `operationId` |
| Retirar penalidade | `Penalidades.cs:94` | `DELETE .../penalties/:kart/:id` | F | Autor fixo `Cronometragem` na observação | Adaptador registra o autor real na auditoria |
| Bandeira por piloto | `Penalidades.cs:139` | `POST .../flag/:kart` | ? | — | Expor |
| Bandeira geral / relargada | `Penalidades.cs:179` | `POST .../flag` | **D** para relargada | — | Expor, crítico |
| Largar / quadriculada | `FormCrono.cs` | `POST .../start`, `.../checkered` | ? | Estado | Expor, crítico |
| Encerrar / cancelar | `FormCrono.cs` | `POST .../close`, `.../cancel` | ? | `isAuthorizedDestructive` | Expor, crítico |
| Reiniciar | `Penalidades.cs:159` | `POST .../restart` | **D** | `isAuthorizedDestructive` | Expor, crítico |
| Passagens | `FormCrono.cs` | `GET .../passings`, `.../passings/manual`, `/actions`, `/clear` | ? | `clear` protegido | F4 |
| Voltas | `FormCrono.cs` | `.../laps`, `.../laps/invalidate` | ? | — | F4 |
| Posição | `FormCrono.cs` | `POST .../position` | D parcial (observação) | Faixa | F4 |
| Competidor | `Competidores.cs` | `PUT .../competitors/:i` | I | `kartAntes`/`nomeAntes` → 409 | F4 |
| Remontar | `FormCrono.Remontar.cs` | `POST .../remontar` | ? | — | F4 |
| Transponder | `Dialogos.cs:224`, `:252` | `GET/PUT /api/transponders` | I | — | F4 |
| Observação | Várias | `POST .../observations` | D | — | Expor |
| E-mail | `FormCrono.cs` | `GET/POST .../emails` | ? | `isAuthorizedDestructive` | F4 |
| Equalização | `FormCrono.Equalizacao.cs` | `/api/equalizacao/*` | ? | Finalizar/reabrir | F4 |
| Decoder, LED, backup, e-mail SMTP, AnyDesk | Menus | — | — | — | Fora do v1 (PRD 9.4) |

## Regras só de tela, a reproduzir no adaptador
- Padrão Tabajara: nome do evento ou bateria contém `tabajara` → **pré-marca** ignorar voltas, e o operador pode mudar (`Cadastros.cs:357-359`).
- Troca: exige selecionar piloto real, kart novo não vazio e diferente; lista salva antes.
- Mensagem final: voltas e melhor volta do kart novo.

## Diferenças permitidas em relação ao legado
O legado da troca só recusa kart com outro piloto: não sabe de manutenção nem de categoria. O PRD 8.2 pede bloqueio; ele vale só na rota nova. Mudança no Windows: nenhuma.

## Limitação desta matriz
As linhas marcadas `?` não foram exercidas. O plano F3 precisa classificar cada uma antes de expor.
