# Plano de correção: confiabilidade dos resultados por e-mail

## Objetivo

Corrigir no código os defeitos verificáveis da lista de 50 itens, dar estado fiel e recuperável por destinatário, exigir PDFs antes de prometer/anunciar anexos, proteger as rotas administrativas e preservar evidência operacional. Não alterar dados históricos nem inventar contatos. Provedor e segredos de produção serão migrados/rotacionados somente com configuração substituta válida.

## Etapas

1. Base segura: trabalhar sobre o snapshot ativo do ORBITS (`78b401b`) e preservar o estado local divergente; registrar este plano.
2. 100 Milhas: remover a supressão incondicional; determinar elegibilidade pelo evento e estado; corrigir fila/retry; marcar explicitamente sessões sem contatos válidos e expor contatos faltantes.
3. Integridade do envio: falhar fechado quando PDF obrigatório não puder ser gerado; corrigir texto e anexos por tipo de prova; armazenar destinatário, mensagem, identificadores e progresso incremental; impedir sobreposição de timeouts; deduplicar destinatários; timeout e backoff classificados.
4. Resiliência: persistência atômica da fila, alerta/quarentena em JSON inválido, fallback para dados de email disponíveis, timeout de operações individuais, validação de destinatário e saneamento de logs.
5. Segurança/configuração: autenticar rotas de configuração, teste e reenvio; limitar destinatários de teste; remover segredos da API e logs; validação estrita de configuração, porta e TLS; gravação atômica; armazenamento protegido via segredo do sistema ou arquivo com ACL; orientação de rotação para credenciais expostas.
6. Entrega/diagnóstico: distinguir aceite SMTP de entrega confirmada, propagar Message-ID e expor saúde/teste ponta a ponta sem enviar mensagens reais durante validação.
7. Executar testes unitários e simulador com dados `TESTE CODEX`; rever mudanças e produzir matriz item a item com status corrigido, histórico, operacional ou bloqueado por dado/credencial externa.

## Limites operacionais

- Não enviar email real nem criar sessão no serviço de produção durante a validação.
- O código não pode confirmar domínio/token Cloudflare nem trocar credenciais sem os novos valores e escolha explícita do provedor.
- Endereços ausentes precisam ser fornecidos pelo cadastro responsável.
- Não reescrever históricos de corrida ou registros de destinatários retroativamente.
- Deploy/restart requer checagem de sessão em andamento e janela operacional definida no `AGENTS.md`.

## Verificação

Vitest focado nos módulos de e-mail/fila/rotas, typecheck quando viável e execução isolada do simulador `:4150` usando apenas dados sintéticos marcados `TESTE CODEX`. Confirmar que rejeições (PDF obrigatório ausente, não autorizado, destinatário inválido) impedem envio e que aceites SMTP não são exibidos como confirmação de entrega.
