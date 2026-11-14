# Auditoria geral — sistema, servidores e aplicativos (13/11/2026)

Somente leitura: nada foi alterado, reiniciado ou publicado.

Escopo conferido: repositório (site Next 16, 16 workers Cloudflare, app Expo 57, serviços Node do SRVKART),
resposta ao vivo dos domínios, DNS, configurações da zona no Cloudflare, e os dois Windows
(CRONOMETRAGEM/ORBITS e SRVKART) por SSH.

Não conferido: login no painel admin (não digito senha em site de produção), escrita nas rotas do telão
(testar alteraria o telão), conteúdo e restauração do backup, lojas (App Store / Play), código .NET do desktop.

## Prioridade 1 — segurança (corrigir primeiro)

| # | Achado | Evidência | Correção |
|---|---|---|---|
| 1 | Rotas do telão gravam sem login | `app/api/telao-layout`, `telao-playlist`, `tb50-display-mode`, `tb50-page`, `viplex-programs` têm `PUT` sem nenhuma checagem; `telao-upload` aceita `POST` de até 50 MB direto no R2. Não existe `middleware.ts`/`proxy.ts`. No ar, os `GET` respondem 200 sem login. O `PUT` não foi testado ao vivo. | Exigir `verifyAdminSession` (já usado em `/api/admin/*`) em todo `PUT`/`POST` dessas rotas. |
| 2 | Sem HSTS e sem HTTPS forçado | Zona: `always_use_https: off`, HSTS desligado, `min_tls_version: 1.0`, SSL `full` (não `strict`). | Ligar Always Use HTTPS, HSTS (começar com 6 meses), TLS mínimo 1.2, SSL Full (strict). |
| 3 | Nenhum CSP em nenhum domínio | Nenhum arquivo do repositório define `Content-Security-Policy`; `admin.`, `resultados.` e `ops.` respondem sem nenhum cabeçalho de segurança. | CSP por worker (começar em `Report-Only`), mais `nosniff`, `X-Frame-Options`/`frame-ancestors` no admin e no ops. |
| 4 | Login do admin do site sem limite de tentativas | `app/api/admin/login/route.ts`: compara senha em texto puro (`===`) com `ADMIN_PASSWORD`, sem bloqueio nem atraso. | Limite por IP (Cloudflare Rate Limiting ou contador em D1), comparação em tempo constante, senha com hash. Ideal: Cloudflare Access na frente de `admin.` e `ops.`. |
| 5 | E-mail falsificável | DMARC `p=none`; SPF `~all` ainda inclui `websitewelcome.com` (hospedagem antiga) e 5 IPs avulsos; sem DNSSEC, CAA e MTA-STS. | Limpar o SPF, subir DMARC para `quarantine` e depois `reject`, ligar DNSSEC, criar CAA. |
| 6 | SRVKART exposto na rede interna | Escutando: SQL 1433, RDP 3389, PPTP 1723, 80/443, AnyDesk 7070, WinRM, SSH. Windows Server 2019, último patch 14/10, sem reiniciar há 30 dias. | Fechar 1433 para fora da máquina, desligar PPTP (protocolo quebrado), tirar AnyDesk se o túnel Cloudflare já cobre, aplicar os patches de novembro. |
| 7 | CRONOMETRAGEM com firewall desligado | Perfis Domain e Public desligados; 13 logins com falha em 24 h; Spotify, Opera e AnyDesk na máquina da cronometragem; build Insider (26300). | Ligar os três perfis, investigar os logins com falha, tirar software que não é da operação, sair do canal Insider. |
| 8 | Credenciais coladas no chat | Token Cloudflare sem validade, chaves R2, chave Resend e senha do admin ficaram no histórico desta sessão. | Trocar todas e guardar em cofre de senhas; token Cloudflare com validade e escopo mínimo. |

## Prioridade 2 — confiabilidade e operação

- **Deploy manual e com várias sessões publicando por cima.** Já derrubou o `/api` (20/10) e apagou o link do grupo (05 e 08/11). Falta: deploy só pelo CI a partir do `main`, ambiente de homologação para todos os workers (hoje só o mobile tem) e rollout gradual do Cloudflare.
- **Site no ar diferente do fonte.** O domínio principal responde `geolocation=()`, o fonte diz `geolocation=(self)`; existem `kartodromo` e `kartodromo-site-2026`. Definir qual é o oficial e apagar o outro, junto com `premium-preview` e `premium-reference` (parados desde julho).
- **Sem monitoramento de erro nem alerta.** Nenhum Sentry (ou similar) no site, nos workers ou no app; nenhuma verificação externa de disponibilidade. Tarefas com falha silenciosa: `Kartodromo Ranking App Sync` (erro desde 30/10), `KartodromoLocalApi` e `KartodromoLiveTimeTunnel` (código de erro no último ciclo).
- **Backup existe, restauração não comprovada.** `Kartodromo Backup Banco` roda 02:30 com sucesso e envia cópia criptografada ao R2. Falta teste de restauração mensal e backup dos D1 (`kartodromo-mobile`, `kartodromo-admin`). O SQL é Express, sem Agent e limitado a 10 GB por banco.
- **SRVKART com pouca memória:** 2,7 GB livres de 7,8 GB com SQL, dois Node, DNS e RDS na mesma máquina.
- **CRONOMETRAGEM com disco em 12 % livre** (28 GB de 237 GB).
- **CI inconsistente:** Node 22 na verificação e Node 24 no deploy; o deploy do site não roda os testes antes de publicar.

## Prioridade 3 — dependências

- Site: 3 vulnerabilidades (2 altas em `@azure/msal-node` via `mssql`, 1 moderada em `nodemailer`). Resolve com `npm audit fix`, sem quebra.
- App: 13 (3 altas, 3 moderadas, 7 baixas), todas em ferramentas de build/teste, não no app instalado.
- Atrasados com versão maior nova: Tailwind 3 → 4, ESLint 9 → 10, Vitest 4 → 5, `eslint-plugin-react-hooks` ainda em RC de 2024.
- `compatibility_date` dos workers em três datas diferentes (07/2026 a 10/2026): alinhar.

## Funcionalidades que faltam

**App (Expo 57, React Native 0.86)**
- Atualização sem loja (`expo-updates`): hoje qualquer correção exige nova versão na loja.
- Notificações push: lembrete de bateria, resultado pronto, pagamento confirmado.
- Relatório de erro (Sentry) e login por biometria.
- `version` fixa em 1.0.0.

**Site e reservas**
- `/.well-known/security.txt`.
- Proteção contra robô (Turnstile) no cadastro e na reserva: nenhuma referência no código.
- Painel de saúde único (workers, túnel, SRVKART, tarefas agendadas).

**Servidor**
- Registro central de logs e alerta quando tarefa agendada falha.
- Limpeza das 12 tarefas desativadas e de `OpenChrome`, `Reparo Windows 30-10`, `Ultras Grupo 20261110`.

## O que está bom

- Segredos fora do Git (`.gitignore` cuidadoso, nenhum token encontrado nos arquivos versionados).
- `/.env` e `/.git/config` respondem 404; `/api/admin/*` responde 401 sem sessão.
- Cookie do admin `HttpOnly`, `SameSite=Lax`, assinatura HMAC comparada em tempo constante.
- Reserva com chave de idempotência; CPF e e-mail guardados como HMAC.
- Defender ativo e atualizado nas duas máquinas; SMB1 desligado; RDP com NLA.
- 199 arquivos de teste; CI com typecheck, lint, testes, build e auditoria de acessibilidade.
- Versões atuais: Next 16.4, React 19, Expo 57, TypeScript 6.

## Ordem sugerida

1. Fechar as rotas do telão (item 1) e trocar as credenciais (item 8).
2. Zona Cloudflare: HTTPS forçado, HSTS, TLS 1.2, Full strict, DNSSEC (itens 2 e 5).
3. Cloudflare Access em `admin.` e `ops.`; limite de tentativas no login.
4. Patches e portas do SRVKART; firewall da CRONOMETRAGEM.
5. Sentry + verificação de disponibilidade + alerta de tarefa com falha.
6. `npm audit fix`; teste de restauração do backup.
7. App: `expo-updates` e push.
