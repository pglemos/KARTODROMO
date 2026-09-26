# Auditoria da recepção — 26/09/2026

## Correções

- Criar/editar bateria: normalizar `YYYY-MM-DDTHH:mm` para segundos antes de enviar ao SQL Server DATETIME2, preservando hora local. Validar calendário, horas e minutos. O log do servidor registrou erro SQL 241 no PUT da bateria da foto; TRY_CONVERT confirmou que o texto sem segundos era rejeitado.
- Trocar senha: solicitar senha atual, enviá-la ao servidor e alinhar mínimo de oito caracteres. Nenhuma senha de operador foi alterada.
- Editar reserva: incluir peso decimal na consulta e salvar/limpar o peso no cadastro do cliente, com limites válidos acima de 0 e abaixo de 500 kg.
- Produto da reserva: preço, desconto e total são recalculados na tela. Ao trocar o produto de uma reserva não paga, o servidor atualiza produto/preço, remove o desconto anterior e invalida o termo. A API bloqueia troca de produto em reserva paga.
- Situação do termo: a consulta agora retorna os campos `termo` e `idade`; a tela deixa confirmar/remover a assinatura e grava o estado usando o timestamp legado `TermoImpressoEm`, que já abastecia os relatórios. Alterar cliente, produto ou bateria invalida a confirmação.
- Mover reserva: em reservas não pagas, produto e preço seguem a bateria destino e um desconto de outro produto é removido. Em reservas pagas, a lista e a API só permitem destino com o mesmo produto e preço; o termo é invalidado. A mensagem antiga que prometia ajuste automático de diferença foi removida porque não existe lançamento financeiro parcial para cobrar/devolver essa diferença com auditoria.
- Participantes: exibir idade e manter peso decimal na lista.
- Revisão das cinco capturas: os grandes retângulos vazios nas duas primeiras parecem mascaramento de dados da tabela; não foram tratados como defeito de renderização. As outras três telas correspondem aos formulários atuais.

## Entrega

- As alterações do backend foram mescladas em blocos isolados no arquivo ativo do SRVKART, preservando alterações simultâneas. Foram mantidos backups antes das substituições.
- Servidor reiniciado após a atualização final: tarefa `Kartodromo Servidor` em execução, `/healthz` saudável e um único listener na porta 4060.
- Aplicativo Recepção publicado como Release win-x64 e instalado em `192.168.20.53` com SHA-256 conferido. O executável anterior foi preservado. A sessão/processo aberto foi mantido; a nova versão será usada na próxima abertura.
- `appsettings.json` permaneceu com o mesmo hash, preservando impressora e configuração local.

## Verificação

- 35/35 testes de operações e lint geral sem erros.
- Build e publicação .NET Release win-x64 concluídos.
- Suíte geral: 307/308 passaram. O único teste que falha é a sincronização de `public/design` com `design-source`, em arquivos fora da Recepção; não foi executado `sync:design` para evitar regravar esses arquivos alheios ao pedido.
- Typecheck geral: duas incompatibilidades preexistentes do literal classificacao nos testes de timing-engine.
- 29 consultas autenticadas das áreas de recepção responderam HTTP 200.
- 51 chamadas/casos de API com SQL Server real, executados em transação externa revertida: peso, idade/termo, confirmação de termo, troca de produto e preço, desconto, transferência não paga, bloqueio/transferência paga, caixa, venda, troco, estorno, vouchers, comissão, idempotência, fechamento, senha e fidelidade.
- Também confirmados 7 casos de rejeição esperada, incluindo peso inválido, troca de produto/preço em reserva paga, venda repetida e limites do caixa/fidelidade.
- O adaptador dessa auditoria substitui commits internos por uma transação externa. Portanto esse teste valida SQL e regras, mas não comprova concorrência nem durabilidade entre commits.
- Reversão confirmada no fim do teste e por consulta independente: zero usuários, terminais, clientes, baterias, produtos, vouchers ou vendas da auditoria persistidos. Resultados em `C:\KARTODROMO\audit-recepcao-20260926\resultado.txt`.

## Limitações que permanecem

- Autoteste nativo remoto abriu telas principais e menus, mas vários diálogos falharam porque a sessão WinRM não é UserInteractive. Isso é limitação do ambiente de teste; não há evidência suficiente para declarar todos os diálogos aprovados no balcão.
- Impressão física, operação por mouse/teclado de todos os diálogos e integrações externas não foram integralmente validadas nesta rodada.
- Diferença parcial em reserva paga ainda exige processo de estorno e nova reserva; não há lançamento para crédito/débito diferencial ligado à mesma reserva.
- Não foi feito teste de corrida real nem alteração na cronometragem/telão.
