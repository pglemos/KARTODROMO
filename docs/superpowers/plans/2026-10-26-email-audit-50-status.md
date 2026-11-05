# Auditoria dos 50 itens de e-mail

Estado deste trabalho: mudanças preparadas sobre o snapshot ativo do ORBITS em `C:\KARTODROMO\_audit-50`. Nenhum arquivo de produção foi sobrescrito nem serviço reiniciado. As alterações de proteção por chave não podem ser ativadas até configurar a chave nos clientes: a configuração desktop encontrada não contém `ChaveCronometragem` e não há `TIMING_OPS_KEY`/`OPS_RECEPCAO_KEY` no ambiente desta sessão.

| # | Estado | Observação |
|---:|---|---|
| 1 | Corrigido no código | Novas sessões de endurance liberam e-mail; sessões antigas de 100 Milhas ignoram a marca incorreta. |
| 2 | Corrigido no código | A supressão continua para eventos como Tabajara, com exceção explícita de 100 Milhas. |
| 3 | Corrigido no código | Retry recupera sessões antigas de 100 Milhas com estado `sem-email-pilotos`. |
| 4 | Pendente de cadastro | Três equipes ainda precisam de endereços válidos fornecidos pelos responsáveis. |
| 5 | Pendente de escolha | Gmail está ativo; aguardo decisão entre manter Gmail, HostGator após redefinir senha, ou Cloudflare após validar domínio/token. |
| 6 | Pendente de provedor | O endereço From depende da conta e do domínio autorizados pelo provedor escolhido. |
| 7 | Diagnóstico confirmado | Credenciais R2 não são credenciais SMTP; nenhuma mudança de código corrige essa diferença. |
| 8 | Pendente externo | Configurar SMTP Cloudflare exige domínio habilitado e nova credencial SMTP adequada. |
| 9 | Pendente externo | Escopo do token e estado do domínio não foram validados nem alterados. |
| 10 | Já corrigido na fonte ativa | A geração atual usa perfis de navegador exclusivos por PDF; falhas históricas não são reversíveis. |
| 11 | Corrigido no código | PDF obrigatório ausente agora encerra o envio antes do SMTP. |
| 12 | Corrigido no código | O texto só promete anexos PDF quando há PDF anexado. |
| 13 | Corrigido no código | Sem Edge/Chrome ou com erro de geração, o envio falha com mensagem explícita. |
| 14 | Limitação documentada | Rastreamento cPanel é específico do HostGator; Gmail/Cloudflare ficam como aceite SMTP sem confirmação de entrega. |
| 15 | Limitação documentada | Sem integração do provedor atual, o resultado não será promovido a “entrega confirmada”. |
| 16 | Histórico | As consultas indisponíveis históricas não podem ser reconstituídas sem os logs do provedor. |
| 17 | Já corrigido na fonte ativa | Estado distingue aceite SMTP/relay de entrega confirmada. |
| 18 | Histórico | Os registros das duas sessões não comprovam os envios antigos; não reescrevi a história nem inventei destinatários. |
| 19 | Corrigido no código | Envio manual vinculado a kart persiste endereço enviado e atualiza o estado corrente da sessão. |
| 20 | Corrigido no código | Message-ID e destinatário são persistidos após aceite do Nodemailer. |
| 21 | Histórico | Contagens de tentativas, com retries repetidos, foram preservadas como métricas históricas. |
| 22 | Pendente de cadastro | Endereços rejeitados precisam de validação/correção no cadastro. |
| 23 | Histórico | Falhas de conexão passadas não podem ser removidas retroativamente. |
| 24 | Histórico | O limite HostGator era histórico e não foi aplicado ao Gmail atual. |
| 25 | Corrigido no código | Erros SMTP 5xx e rejeições permanentes de rastreio são marcados e não entram no retry automático. |
| 26 | Melhorado no código | Mantém limite de 12 tentativas/6 h e passa a usar backoff exponencial com jitter. |
| 27 | Corrigido no código | Retry usa intervalos crescentes e aleatórios limitados. |
| 28 | Corrigido no código | Timeout de resposta não libera a trava da sessão enquanto o envio real continua, evitando corrida de duplicatas. |
| 29 | Pendente de otimização | PDFs personalizados ainda são gerados em série; o timeout agora não sobrepõe um segundo lote. |
| 30 | Corrigido no código | Progresso por destinatário é gravado após cada aceite/falha. |
| 31 | Corrigido no código | Falha ao salvar a fila gera log operacional. |
| 32 | Corrigido no código | JSON inválido da fila é preservado em quarentena e gera alerta no log. |
| 33 | Corrigido no código | Falha na API de operações deixa o lote continuar e usa os contatos disponíveis na sessão. |
| 34 | Corrigido no código | Validação estrita de endereços impede caracteres de controle e injeção de cabeçalho. |
| 35 | Requer decisão operacional | A mesma caixa atribuída a karts diferentes continua recebendo um resultado personalizado por kart. |
| 36 | Arquitetura atual | Resultados e e-mails transacionais continuam usando a conta configurada; separar contas exige decisão/configuração de provedor. |
| 37 | Verificação parcial | Testes unitários e simulador são cobertos; fluxo integrado de lote com PDFs precisa de fixture completa adicional. |
| 38 | Corrigido no código; bloqueado para ativação | Rotas de configuração exigem chave. A configuração atual não tem chave nos clientes nem variável de servidor identificada. |
| 39 | Corrigido no código; bloqueado para ativação | Endpoint de teste exige a mesma chave antes de enviar mensagem. |
| 40 | Corrigido no código; bloqueado para ativação | Reenvio e consulta de estado exigem a chave. |
| 41 | Parcial | Serviço continua em `0.0.0.0` para a LAN; túnel público permanece limitado a leitura. A ativação da autenticação requer distribuição da chave. |
| 42 | Corrigido no código; bloqueado para ativação | Dados SMTP continuam na resposta interna, protegida pela chave; sem chave distribuída não é seguro ativar a rota. |
| 43 | Pendente de infraestrutura | A senha continua em JSON local; substituir por cofre/DPAPI requer integração com a identidade do serviço no Windows. |
| 44 | Corrigido no código | JSON SMTP inválido gera aviso no log e retorna aos padrões. |
| 45 | Corrigido no código | Configuração SMTP passa a gravar em temporário e renomear atomicamente. |
| 46 | Corrigido parcialmente | Leitura valida tipos principais, faixa de porta e combinação Cloudflare/465. |
| 47 | Corrigido no código | Só aceita 465/587; Cloudflare exige 465. |
| 48 | Corrigido parcialmente | Destinatário de teste e endereço avulso deixaram de aparecer em logs explícitos; revisão completa dos logs legados ainda é necessária. |
| 49 | Corrigido no processo | A base veio do snapshot ativo do ORBITS, e as alterações locais originais foram mantidas no checkout de produção. |
| 50 | Pendente externo | Tokens Cloudflare/R2 e senha SMTP expostos precisam ser revogados e substituídos; não usei nem repeti os valores expostos. |

## Verificação executada

- Vitest focado: 12 testes passaram.
- `tsc --noEmit`: passou no snapshot isolado depois de corrigir a inferência do lote de endurance e o uso de `Array.at` incompatível com o `target` ES2020. O checkout de produção ainda mantém essas alterações locais antigas e outros diagnósticos preexistentes.
- Nenhum e-mail real foi enviado e nenhuma bateria foi criada.
- Nenhuma implantação/reinicialização foi feita: falta uma chave de API funcional nos clientes e a escolha do provedor SMTP continua pendente.
