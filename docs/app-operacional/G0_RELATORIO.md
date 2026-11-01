# Relatório do gate G0

**Situação: levantamento concluído, com pendências. Aguarda aceite do dono.** Nada foi publicado.

## As 10 questões do PRD 22
| # | Resposta | Situação |
|:-:|---|---|
| 1 | `aprovada=1` **não** inclui pagamento nem termo | Provado no código; contagens reais NÃO VERIFICADAS |
| 2 | Não há rota de entrada após largada. Parece viável com funções atuais | Desligado até homologar |
| 3 | Troca guarda ou ignora voltas conforme descrito; Tabajara é regra da tela Windows | Provado por testes |
| 4 | Sem revisão nem transação; JSON atômico em processo único | Provado no código |
| 5 | 1.6, Windows e a sincronização a cada 60 s escrevem na mesma bateria | Provado no código |
| 6 | Rotas de passagem existem; segurança de cada uma ainda não exercida | Parcial, fica para F4 |
| 7 | Manutenção "fora de operação" não existe centralmente | Provado no código; 1.6 ofuscado |
| 8 | SSE sem revisão nem cursor; reconexão recebe estado completo | Provado no código |
| 9 | Rede local quase sem login nas escritas; internet só leitura | Provado no código; regras do Cloudflare NÃO VERIFICADAS |
| 10 | Produção **não** é igual ao repositório, com diferenças nos dois sentidos | Provado por hash e diff |

## O que muda no PRD
1. Elegibilidade: `aprovada` sozinho não basta.
2. Lastro: a regra está só no APK; vai para o servidor novo com os exemplos de teste.
3. Frota: precisa de cadastro central novo de "fora de operação".
4. Revisão, idempotência e fila por bateria são todas novas.
5. Um acréscimo mínimo em `saveSession` é necessário para a revisão pegar as escritas do Windows.
6. A remoção automática de quem saiu da agenda continua; o app apenas avisa.

## Pendências antes da F1
1. **Alinhar produção e repositório.** Cada lado tem mudanças que o outro não tem, e a produção tem 321 arquivos sem commit. Publicar sem alinhar pode desfazer proteções. Precisa de plano próprio.
2. **Backup externo falhou** na última execução (código 1).
3. **Decisões do dono:** pendente aprovado sem pagar pode correr? Termo é obrigatório para sortear?
4. **Medição real** de combinações exige autorizar leitura agregada no banco.
