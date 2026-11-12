# Plano — unificar reservas.kartodromodebetim.com.br e cadastro.kartodromodebetim.com.br

Data: 12/11/2026 · Status: proposta (nada implementado)

## 1. Como está hoje (levantamento)

| | reservas. | cadastro. (?r=TOKEN) |
|---|---|---|
| Quem serve | worker `kartodromo-reservas-2026` (`reservas-deploy/`): entrega o app React `apps/reservas` e repassa `/api/*` ao `kartodromo-cadastro` (service binding `LEGACY`) | worker `kartodromo-cadastro` (`workers/pre-cadastro`), página `public/index.html` + remendos de produção (`docs/operacao/patches-producao/cadastro-2026110x`) |
| Quem cria | o próprio cliente, online | só a equipe, no painel web (Agenda → Reserva em grupo, `lib/ops/grupos.ts`) |
| Pagamento | comprador paga TUDO (Pix/cartão Asaas), vagas seguradas 15 min | 3 modos: `unico` (responsável paga), `individual` (cada um paga a sua vaga pelo link), `sinal` (% + resto no balcão) |
| Dados dos pilotos | comprador digita nome/CPF/nascimento de todos | cada amigo preenche o próprio cadastro completo pelo link único |
| Acompanhamento | "Minhas reservas" por CPF + código; check-in GPS | painel do organizador `/painel?g=&k=` (quem já preencheu, quem pagou, liberar vaga) |
| Gravação no SRVKART | `lib/ops/reserva-online.ts`: pedido → `Inscricao` Origem `site` | `ReservaGrupo` + `ReservaGrupoPiloto` + `Inscricao` (vaga do grupo, "Amigo N") |

Conclusão: **são o mesmo produto em dois pedaços**. O backend já é um worker só (`kartodromo-cadastro` atende os dois domínios), o banco é o mesmo, e `ReservaGrupo.Origem` já prevê `'site'`. O que falta é o cliente conseguir **criar um grupo sozinho** pelo site e o site e o link do grupo usarem a mesma tela.

Lacunas que doem hoje:
1. Cliente de primeiro contato no WhatsApp não tem link para "montar o grupo"; a recepção precisa criar no painel.
2. No site, quem reserva para 8 pessoas precisa saber CPF e nascimento de todas.
3. Reserva do site não aparece como grupo (texto do próprio site: "reservas por grupo não aparecem aqui").
4. Dois visuais, dois códigos de formulário, duas validações (React vs. HTML com remendo).
5. Risco operacional: o worker no ar tem código que não está no fonte (memória: "deploy do cadastro só pelo fonte do main"; README dos patches). Unificar sem resolver isso quebra produção.

## 2. Visão final (o que o cliente vê)

Um único site: **reservas.kartodromodebetim.com.br**. `cadastro.` continua funcionando (QR do balcão e links antigos) mas redireciona/serve a mesma app.

Fluxo do organizador (link que a recepção manda no WhatsApp):
1. Escolhe dia e horário (igual hoje).
2. "Quantos pilotos?" → N.
3. **"Como vocês vão pagar?"** (novo)
   - **Eu pago tudo agora** → fluxo atual (pode digitar os dados dos amigos agora *ou* deixar para cada um preencher pelo link).
   - **Cada um paga o seu** → organizador paga só a vaga dele (ou nada, ver §5) e recebe o link do grupo.
   - **Sinal agora, resto no balcão** (opcional, só se a casa quiser liberar online).
4. Dados só do organizador (CPF, nascimento, WhatsApp, e-mail).
5. Pagamento.
6. **Tela do grupo** (é o atual painel do organizador, dentro da app): link para compartilhar (botão "Enviar no WhatsApp"), lista "Amigo 1…N" com status *aguardando / cadastro feito / pago*, contador de tempo para segurar vagas, botão de copiar link, liberar vaga.

Fluxo do convidado (abre o link `reservas.…/g/CODIGO` ou o `?r=TOKEN` antigo):
1. Vê "Você foi convidado por Fulano · sábado 16/11 · 19h · Bateria X · 3 de 8 vagas livres".
2. Preenche o próprio cadastro (mesmo formulário do pré-cadastro, com termo).
3. Se modo individual: paga a vaga dele (Pix/cartão); se não: só confirma.
4. Cai na tela do grupo em modo leitura (quem já entrou) + check-in no dia.

Bônus fáceis depois de unificado:
- "Minhas reservas" mostra também os grupos em que a pessoa está.
- Lembrete automático ao organizador quando faltam X cadastros a 24h da bateria.
- Link do grupo também abre no app (deep link) quando instalado.
- Recepção cria grupo no painel e o link gerado já é o novo (mesma tela).

## 3. Decisões do dono (12/11/2026)

1. **Vagas dos amigos (cada um paga o seu)**: ficam guardadas até **24h antes da bateria**. Sem pagamento até lá, a vaga volta para venda e o organizador é avisado. Grupo criado com menos de 24h para a bateria: só o fluxo "eu pago tudo".
2. **Organizador que não pilota**: paga **1 vaga de garantia** para criar o grupo; abatida se alguém faltar ou devolvida conforme a política.
3. **Sinal**: só no painel interno da recepção. No site: "eu pago tudo" e "cada um paga o seu".
4. **Tamanho do grupo pelo site**: **2 a 10 pilotos** (acima disso, recepção).
5. **Primeira vez e cupom**: valem **por piloto** (cada CPF) também no "cada um paga o seu".
6. **Desistência de quem já pagou**: vale a política de cancelamento atual, aplicada só à vaga dele, pedida pela recepção no WhatsApp.

## 4. Arquitetura proposta

- **Front único**: `apps/reservas` (React/Vite) vira a única tela. Novas rotas: `/` (reservar), `/g/:codigo` e `/?r=TOKEN` (grupo/convite), `/painel` (organizador, compatível com `?g=&k=`), `/cadastro` (pré-cadastro avulso do QR do balcão), `/minhas`.
- **Backend**: continua `kartodromo-cadastro`. Novas rotas públicas:
  - `POST /api/reservas` aceita `modo: 'unico' | 'individual' | 'sinal'` e `pilotosDepois: true` (amigos sem dados).
  - `GET /api/grupo/:codigo` (resumo público: data, horário, vagas livres, organizador primeiro nome, status por vaga sem dados pessoais).
  - `POST /api/grupo/:codigo/entrar` (cadastro + cobrança da vaga; reaproveita o código já remendado de `cobrancaDoLink`).
- **SRVKART** (`lib/ops/reserva-online.ts` + `lib/ops/grupos.ts`): pedido do site com `modo` ≠ fluxo atual vira `ReservaGrupo` Origem `site` (função de criação já existe em `gruposRoutes`; extrair para `criarGrupo()` reutilizável). Vagas dos amigos = `Inscricao` "Amigo N" como hoje. Expiração das vagas não pagas com o prazo da decisão §3.1.
- **cadastro.kartodromodebetim.com.br**: rota `/` sem `?r` → app `/cadastro`; com `?r` → `/g/...`. Redirect 301 só depois de estável.

## 5. Fases (cada uma entra em produção sozinha)

**Fase 0 — Pôr a casa em ordem — CONCLUÍDA 12/11/2026.** Bundle no ar (deploy 13:39Z) idêntico byte a byte ao `wrangler deploy --dry-run` do fonte; páginas `/`, `/painel`, `/reservar`, `/conta`, `/privacidade` idênticas a `public/`. Os remendos já tinham sido portados (commit 2e5228b). Adicionado `tests/grupo-link.test.ts` (9 testes) ao CI de deploy; READMEs de patches marcados como histórico.

Itens originais:
- Trazer para `workers/pre-cadastro/src` TODO o código que só existe no bundle no ar (identificar cliente, `/api/sync/grupos/pagos`, cobrança do link, campos obrigatórios). Comparar com bundle baixado até diff = zero.
- Testes (vitest) para `/api/grupo`, `/api/grupo/pagamento`, painel e cobrança Asaas.
- Só então liberar deploy pelo fonte (main). Atualizar README dos patches como "obsoleto".

**Fase 1 — Mesma cara (~2–3 dias)** · Decisão do dono 12/11/2026: o visual vencedor é o do **cadastro** (escuro #030504, verde #00e676, Anton + Rajdhani, cantos 4px, botões chanfrados). O app `apps/reservas` (claro, verde #007a3d, cantos 12px) é que troca de pele: tokens do `public/index.html` viram as variáveis de `apps/reservas/src/styles.css`; estrutura e regras da reserva ficam iguais.
FEITO 12/11/2026: reskin publicado (aaec9d9). `reservas.…/?r=TOKEN`, `/cadastro` e `/painel` abrem as páginas do cadastro pelo worker `kartodromo-reservas-2026` (um endereço só). A reescrita do formulário de grupo em React fica para a Fase 2, junto com o fluxo novo. Corrigido também `Permissions-Policy` que bloqueava o GPS do check-in.
- Portar a página do link do grupo (`?r=`) e o painel para dentro de `apps/reservas`, usando as rotas que já existem. Sem mudar regra de negócio.
- `cadastro.` com `?r=` passa a servir a app nova. Formulário de pessoa único (`FormPessoa`) para reserva, grupo e pré-cadastro.
- Teste com grupo real criado pela recepção.

**Fase 2 — Cliente cria o grupo sozinho (~4–6 dias)**
- Passo "Como vocês vão pagar?" na reserva.
- Opção "deixar cada amigo preencher" no modo "eu pago tudo" (resolve lacuna 2).
- SRVKART: pedido do site → `ReservaGrupo` Origem `site`; publicar no `grupos/todos.json` como hoje.
- Tela do grupo pós-pagamento com botão WhatsApp (`https://wa.me/?text=` + link).
- Expiração das vagas de amigos não pagas + aviso ao organizador.

**Fase 3 — Acabamento (~2–3 dias)**
- "Minhas reservas" inclui grupos; check-in por vaga de grupo.
- Lembretes (WhatsApp/e-mail) de cadastros/pagamentos pendentes.
- Versão EN nas telas novas (i18n já existe).
- Redirect definitivo `cadastro.` → `reservas.`; QR do balcão aponta para `/cadastro`.

**Fase 4 — App (opcional)**: deep link `/g/:codigo` abre o app; tela do grupo no app usando as mesmas rotas.

## 6. Riscos e cuidados

- Deploy por cima de remendo de produção (já derrubou link do grupo em 05/11 e 08/11) → Fase 0 é obrigatória.
- Nunca iframe/proxy do widget MyLapTime (Cloudflare já marcou phishing).
- Vagas presas sem pagamento travam bateria cheia → prazo curto + painel da recepção mostrando "vagas de grupo pendentes".
- Cobrança duplicada (amigo paga duas vezes / organizador paga tudo e amigo também): manter `PagoPeloGrupo` e checar vaga coberta antes de gerar cobrança.
- Links antigos `?r=` já enviados precisam continuar funcionando.
- LGPD: página pública do grupo mostra só primeiro nome e status, nunca CPF/telefone.

## 7. Como validar

- Vitest: criação de pedido com cada modo, entrar no grupo, expiração, cobrança duplicada.
- Ponta a ponta no sandbox Asaas (`ASAAS_URL` sandbox, worker homolog `wrangler.homolog.jsonc`).
- Ensaio real: grupo de testadores (`scripts/play-grupo-testadores.mjs`) com 3 celulares, cada modo.
- Conferir na Recepção/totem/cronometragem que as vagas aparecem como sempre.
