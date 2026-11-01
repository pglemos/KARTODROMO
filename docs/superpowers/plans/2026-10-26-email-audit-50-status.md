# Auditoria dos 50 itens de e-mail

Estado deste trabalho: mudanças aplicadas ao checkout ativo em `C:\repos\KARTODROMO` e serviço de timing reiniciado em 26/10/2026 após confirmar ausência de bateria em andamento e intervalo seguro desde a última chegada. A chave está na configuração instalada; acesso direto de outra máquina sem chave recebeu 403, e o mesmo host com chave recebeu 200. O cadastro desktop do mesmo host também pode continuar pela verificação conjunta de IP local e nome de máquina.

| # | Estado | Observação |
|---:|---|---|
| 1 | Corrigido no código | Novas sessões de endurance liberam e-mail; sessões antigas de 100 Milhas ignoram a marca incorreta. |
| 2 | Corrigido no código | A supressão continua para eventos como Tabajara, com exceção explícita de 100 Milhas. |
| 3 | Corrigido no código | Retry recupera sessões antigas de 100 Milhas com estado `sem-email-pilotos`. |
| 4 | Pendente de cadastro | Três equipes ainda precisam de endereços válidos fornecidos pelos responsáveis. |
| 5 | Gmail atual até o corte | Gmail SMTP na porta 587 continua ativo até a migração segura; a autenticação foi verificada sem enviar mensagem. |
| 6 | Provedor escolhido; migração pendente | Cloudflare Email Sending para resultados transacionais; falta habilitar o domínio e criar credencial nova com escopo mínimo. |
| 7 | Diagnóstico confirmado | Credenciais R2 não são credenciais SMTP; nenhuma mudança de código corrige essa diferença. |
| 8 | Pendente de ativação externa | Habilitar `kartodromodebetim.com.br` no Cloudflare Email Service e publicar/verificar os registros de envio necessários. |
| 9 | Pendente externo | Escopo do token e estado do domínio não foram validados nem alterados. |
| 10 | Já corrigido na fonte ativa | A geração atual usa perfis de navegador exclusivos por PDF; falhas históricas não são reversíveis. |
| 11 | Corrigido no código | PDF obrigatório ausente agora encerra o envio antes do SMTP. |
| 12 | Corrigido no código | O texto só promete anexos PDF quando há PDF anexado. |
| 13 | Corrigido no código | Sem Edge/Chrome ou com erro de geração, o envio falha com mensagem explícita. |
| 14 | Limitação documentada | Rastreamento cPanel só serve para HostGator; após migração, consultar logs/metrics do Cloudflare sem confundir aceite SMTP com entrega. |
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
| 35 | Política definida | Enviar uma mensagem personalizada por kart, mesmo quando vários karts usam a mesma caixa; cada mensagem mantém seu próprio resultado e PDF volta a volta. A lista endereço+kart já evita duplicar o mesmo kart. |
| 36 | Provedor e papéis definidos | Cloudflare Email Sending para saída transacional; HostGator pode manter as caixas de entrada. `resultados@` como remetente público e caixa de resposta; `crono@` para operação interna; sem BCC global. |
| 37 | Corrigido e verificado | Fixture integrada simula geração dos dois PDFs, composição dos anexos e aceite SMTP sem rede; outro teste comprova que falha no PDF volta a volta cancela antes do SMTP. |
| 38 | Corrigido e ativo | Configuração exige chave; arquivo instalado e `.env.local` agora têm ACL limitada a SYSTEM, Administradores e usuário do cronômetro. |
| 39 | Corrigido e ativo | Endpoint de teste exige a chave; nenhuma mensagem de teste real foi enviada. |
| 40 | Corrigido e ativo | Consulta/reenvio manual exigem chave; leitura local vinculada ao host é necessária para o desktop ativo. |
| 41 | Parcial | Serviço continua em `0.0.0.0` para operar na LAN; túnel público segue somente leitura e chamadas remotas de escrita precisam de chave. |
| 42 | Corrigido e ativo | Configuração SMTP permanece visível apenas em resposta autorizada; teste remoto sem identidade recebeu 403. |
| 43 | Corrigido e ativo | Senha SMTP protegida com DPAPI LocalMachine no JSON; leitura migra automaticamente o formato legado. Verificado no arquivo ativo após reinício, sem devolver a senha ao cliente. |
| 44 | Corrigido no código | JSON SMTP inválido gera aviso no log e retorna aos padrões. |
| 45 | Corrigido no código | Configuração SMTP passa a gravar em temporário e renomear atomicamente. |
| 46 | Corrigido e verificado | Configuração rejeita chaves desconhecidas e valida campos, tipos, host e portas SMTP permitidas. Teste cobre JSON inválido, schema desconhecido e porta inválida. |
| 47 | Corrigido no código | Só aceita 465/587; Cloudflare exige 465. |
| 48 | Corrigido no caminho ativo | Logger do servidor redige endereços de e-mail em novas linhas de log e tem teste unitário. Logs históricos permanecem como evidência histórica. |
| 49 | Corrigido | Os arquivos atualizados vieram do snapshot ativo e foram aplicados ao checkout executado em produção; não usei o clone local divergente. |
| 50 | Pendente externo | Tokens Cloudflare/R2 e senha SMTP expostos precisam ser revogados e substituídos; não usei nem repeti os valores expostos. |

## Verificação executada

- Vitest focado no checkout ativo: 17 testes passaram em dois arquivos, incluindo simulação integrada de ambos os PDFs sem rede.
- Após o reinício, `/healthz` respondeu saudável; `/api/email-config/verificar` confirmou autenticação SMTP Gmail na porta 587 e declarou que nenhuma mensagem foi enviada.
- O endpoint ativo migrou a senha legada; conferi apenas que o valor em disco começa pelo prefixo DPAPI, que os campos SMTP continuam `smtp.gmail.com:587`, envio automático/PDF permanecem ligados e que a API não devolve a senha.
- A pedido anterior, enviei os pacotes da tomada de tempo e da corrida de 25/10 ao destinatário indicado; cada mensagem incluiu o PDF oficial e o PDF volta a volta de todos os karts. Os dois foram aceitos pelo SMTP e têm Message-ID registrado; o Gmail/cPanel não confirmou a chegada na caixa.
- `tsc --noEmit`: passou no snapshot isolado. No checkout ativo permanecem erros TypeScript preexistentes em `lib/ops/grupos.ts`, módulos móveis ausentes e testes de timing/TV; nenhum erro novo foi apontado nos módulos de e-mail alterados.
- Smoke test sem envio: `/healthz` respondeu, estado sem sessão ativa; chamada sem identidade/chave recebeu 403, chamada com chave local recebeu 200.
- Reinício do serviço feito após confirmar zero baterias em andamento e mais de 24 h desde o último encerramento.
- `tsc --noEmit` continua falhando em erros preexistentes alheios aos módulos de e-mail: tipo em `lib/ops/grupos.ts`, quatro imports de módulos móveis ausentes, tipo de penalidade e erros de tipos no teste de TV. Nenhum erro novo apareceu nos módulos de e-mail alterados.
- Nenhuma bateria de teste foi criada e nenhuma mensagem foi enviada nesta verificação; Gmail continua ativo até a migração para Cloudflare.
- Contatos ausentes e segredos expostos ainda exigem correção/rotação fora do código.

## Decisão operacional de provedor e caixas (26/10/2026)

- **Provedor de saída:** Cloudflare Email Sending para resultados transacionais. A HostGator proíbe disparos em massa por SMTP e não publica cota fixa nos planos compartilhados; VPS/dedicado informa 500 destinatários únicos por hora e ainda orienta contratar outro serviço para envio em massa.
- **Escopo:** os resultados pós-prova são transacionais; Cloudflare documenta Email Sending para esse uso e permite enviar para qualquer destinatário no Workers Paid depois de habilitar o domínio. Não usar Cloudflare para campanhas de marketing.
- **Caixas:** manter HostGator, se desejado, para recebimento/IMAP. `resultados@kartodromodebetim.com.br` será o remetente e caixa pública de resposta; `crono@kartodromodebetim.com.br` será a caixa interna de operação. As senhas dessas caixas precisam ser rotacionadas antes de reuso, pois foram expostas.
- **SMTP Cloudflare:** `smtp.mx.cloudflare.net`, TLS implícito na porta 465, usuário literal `api_token` e token novo com somente `Email Sending: Edit`. Credenciais de R2 não servem para este SMTP; o token Cloudflare exposto não será reutilizado.
- **Cotas e anexos:** Workers Paid inclui 3.000 mensagens/mês e cobra US$ 0,35 por mil adicionais; a cota diária inicial é conservadora e pode crescer conforme reputação e histórico. Tamanho total SMTP máximo: 5 MiB com anexos já codificados em MIME. Não encontrei PDFs persistidos para medir; conferir no primeiro envio controlado antes do corte.
- **Endereços compartilhados:** um envio por par `(endereço, kart)`. Se a mesma caixa estiver cadastrada para dois karts, recebe duas mensagens distintas, cada uma com classificação e PDF volta a volta daquele kart. Não adicionar BCC global.
- **Estado de execução:** o código já reconhece o SMTP Cloudflare. Gmail fica ativo até habilitar o domínio, instalar um token novo e verificar o serviço em um endereço interno. A configuração ativa ainda não foi alterada: não há token Cloudflare novo nem confirmação de domínio disponível neste ambiente.
