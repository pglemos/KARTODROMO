# Relatório do gate G0

**Situação: levantamento concluído, com pendências. Aguarda aceite do dono.** Nada foi publicado.

## As 10 questões do PRD 22
| # | Resposta | Situação |
|:-:|---|---|
| 1 | `aprovada=1` **não** inclui pagamento nem termo | Provado no código; contagens medidas |
| 2 | Não há rota de entrada após largada. Parece viável com funções atuais | Desligado até homologar |
| 3 | Troca guarda ou ignora voltas conforme descrito; Tabajara só pré-marca a opção na tela Windows | Voltas: testes. Tabajara: leitura do código |
| 4 | Sem revisão nem transação; JSON atômico em processo único | Provado no código |
| 5 | 1.6, Windows e a sincronização a cada 60 s escrevem na mesma bateria | Provado no código |
| 6 | Rotas de passagem existem; segurança de cada uma ainda não exercida | Parcial, fica para F4 |
| 7 | Manutenção "fora de operação" não existe centralmente | Provado no código; 1.6 ofuscado |
| 8 | SSE sem revisão nem cursor; reconexão recebe estado completo | Provado no código |
| 9 | Rede local quase sem login nas escritas; internet só leitura | Provado no código; alcance no Wi-Fi e regras do Cloudflare NÃO VERIFICADOS |
| 10 | Produção **não** é igual ao repositório, com diferenças nos dois sentidos | Provado por hash e diff |

## O que muda no PRD
1. Elegibilidade: `aprovada` sozinho não basta, e o filtro vale na listagem e na gravação do app, porque a lista pode nascer sem filtro pelo Windows.
2. Lastro: a regra está só no APK; vai para o servidor novo com os exemplos de teste.
3. Frota: precisa de cadastro central novo de "fora de operação".
4. Revisão, idempotência e fila por bateria são todas novas.
5. Um acréscimo mínimo em `saveSession` é necessário para a revisão pegar as escritas do Windows.
6. A remoção automática de quem saiu da agenda continua; o app apenas avisa.

## Pendências antes da F1
1. **Alinhar produção e repositório.** Cada lado tem mudanças que o outro não tem, e a produção tem 321 arquivos sem commit. Publicar sem alinhar pode desfazer proteções. Precisa de plano próprio.
2. **Backup externo falhou** na última execução (código 1).
3. **Termo no filtro:** obrigatório por decisão do dono, mas 236 de 2.556 inscrições (9,2%) estão sem `TermoImpressoEm`. Confirmar se esse campo é o registro certo antes de ligar o bloqueio.

Decisões do dono em 31/10/2026: só pago; termo obrigatório; Endurance e valor zero são exceção ao pagamento. Contagens medidas: ver `ELEGIBILIDADE.md`.
