# Estados, concorrência e tempo real

## Estados
Reais (`race-engine.ts:7`): `preparando`, `em_andamento`, `bandeira_final`, `encerrada`, `cancelada`. Reinício volta a `preparando` (`:696`).

| App (PRD 6) | Servidor |
|---|---|
| AGENDADA | Sem sessão (só agenda) |
| PREPARADA, SORTEIO_RASCUNHO, SORTEIO_CONFIRMADO, PRONTA | `preparando` + dados só do app |
| EM_ANDAMENTO | `em_andamento` |
| QUADRICULADA | `bandeira_final` |
| ENCERRADA | `encerrada` |
| CANCELADA | `cancelada` |

Atenção: em produção, `startSession` zera `startedAt`; o cronômetro começa no primeiro kart a cruzar a linha. "Sorteio confirmado" é identificado hoje só por uma observação de autor `Sorteio`, então o app precisa de registro próprio.

## Persistência e atomicidade
JSON por bateria, com escrita atômica (`saveSession`), sem banco nem transação. Node em processo único, então uma rota sem `await` entre ler e gravar já é serial. Rotas com `await` (como `sorteio` POST lendo o corpo antes de validar) precisam de fila por bateria no adaptador. Auditoria parcial existe (`journal`, `observations`).

## Revisão e tempo real
- **Não há revisão nem cursor.** `/api/events` manda o estado inteiro ao conectar e a cada mudança, com espera de cerca de 150 ms (`scheduleStateBroadcast`), inclusive variante leve. Sem retomada: ao reconectar vem o estado completo.
- Proposta sem mudar contrato: a revisão nasce em `saveSession`, ponto por onde todas as escritas passam, inclusive as do Windows. Exige uma linha acrescentada no servidor; é aditiva. Alternativa sem tocar: hash do snapshot, mais lenta.
- Esses 150 ms somam-se à rede. A meta de 200 ms em rede local do PRD fica apertada, então medir antes de aceitar.

## Idempotência
Não existe. Repetição duplica ao menos em penalidade, observação, relargada e reinício. O adaptador precisa de tabela de `operationId` persistente antes de expor comandos.

## Frota
- Cadastro de karts: derivado de `transponderMap`, só numéricos (`kartsCadastrados`, `:1322`).
- `dbo.Manutencao` registra uso e serviços da oficina, **não** "fora de operação".
- "Karts em manutenção" do 1.6 parecem seleção local no aparelho. **Não há fonte central**, então o app precisa criar uma, somente aditiva.

## Atrasado depois da largada
Não há rota específica. `validarSorteio` recusa após a largada; `setCompetitors` e `acrescentarPilotos` existem, mas a sincronização só age em `preparando`. Um kart desconhecido vira linha `autoAdded`, e a troca sabe absorvê-la. Tecnicamente viável, ainda **não homologado**: botão desligado até testes da F3.

## Autenticação atual
- Internet: só `GET/HEAD` em lista fechada; o resto recebe 403 (`:3446`). Detecção por cabeçalhos `cf-*` e `x-public-bridge`.
- Rede local: **a maioria das rotas de escrita não tem login**. `isAuthorizedDestructive` (`:3420`) protege restart, close, cancel, clear e e-mails, mas não `remontar` (`:3214`), relargada por `/flag` (`:3125`) nem restore do catálogo (`:2237`), que também sobrescrevem dados. Quem de fato alcança a porta pelo Wi-Fi: NÃO VERIFICADO (firewall e segmentação não vistos).
- A API pública atual não tem usuários operacionais; o Worker só tem contas de clientes.
