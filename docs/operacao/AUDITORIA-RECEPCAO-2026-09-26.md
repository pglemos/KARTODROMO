# Auditoria da recepção — 26/09/2026

## Correções

- Criar/editar bateria: normalizar `YYYY-MM-DDTHH:mm` para segundos antes de enviar ao SQL Server DATETIME2, preservando hora local. Validar calendário, horas e minutos. O log do servidor registrou erro SQL 241 no PUT da bateria da foto; TRY_CONVERT confirmou que o texto sem segundos era rejeitado.
- Trocar senha: solicitar senha atual, enviá-la ao servidor e alinhar mínimo de oito caracteres. Nenhuma senha de operador foi alterada.

## Entrega

- Confirmada a correção de datas no arquivo ativo do SRVKART e pela API de produção. Preservadas alterações simultâneas de outro trabalho.
- Aplicativo compilado com as alterações recentes da main e instalado em `192.168.20.53`, com hash verificado. O executável anterior foi preservado. Processo em uso não foi interrompido; nova versão será usada na próxima abertura.
- Hash de appsettings.json permaneceu igual: configuração da impressora preservada.

## Verificação

- 20/20 testes de operações; ESLint dos arquivos alterados sem erros.
- Publicação .NET Release win-x64 concluída.
- Suíte geral: 292/293 aprovados. Falha fora do aplicativo nativo: sincronização de public/design com design-source.
- Typecheck geral: duas incompatibilidades preexistentes do literal classificacao nos testes de timing-engine.
- 29 consultas autenticadas das áreas de recepção responderam HTTP 200.
- API de produção: criar, editar, fechar, reabrir bateria e rejeitar data impossível. Bateria TESTE CODEX 7050 cancelada ao final; bateria real da foto não foi modificada.
- 40 chamadas/casos com assertivas usando código de rotas e SQL real, em transação externa revertida: cadastros, reserva, aprovação, mudança de bateria, caixa, suprimento, sangria e limites, venda, troco, proteção de reserva paga, estorno, vouchers, comissão de parceiro, idempotência do pagamento, fechamento, senha e fidelidade.
- O adaptador dessa auditoria substitui commits internos por uma transação externa. Portanto esse teste valida SQL e regras, mas não comprova concorrência nem durabilidade entre commits.
- Reversão confirmada por consulta independente: zero usuários/produtos/vouchers/vendas da auditoria persistidos. Resultados locais em `C:\KARTODROMO\audit-recepcao-20260926\resultado.txt`.

## Limitações que permanecem

- Autoteste nativo remoto abriu telas principais e menus, mas vários diálogos falharam porque a sessão WinRM não é UserInteractive. Isso é limitação do ambiente de teste; não há evidência suficiente para declarar todos os diálogos aprovados no balcão.
- Impressão física, operação por mouse/teclado de todos os diálogos e integrações externas não foram integralmente validadas nesta rodada.
- Não foi feito teste de corrida real nem alteração na cronometragem/telão.
