# Relatório do gate G1

**Situação: F1 construída e testada localmente. Nada publicado. Aguarda aceite e autorizações do dono.**

## Entregue
- API `/api/app/v1`: login individual, três perfis, sessão com prazo absoluto de 12 h, auditoria, idempotência, `UNKNOWN`, revisão persistente e eventos em tempo real.
- Worker público, sem deploy. App Android/iOS em `PROJETOS/kartodromo-operacional`, com login, barra de conexão e baterias só para leitura.
- Sem `APP_V1_TOKEN_SECRET` as rotas respondem 503: o código pode ir para o servidor desligado.

## Evidência
- Servidor: testes verdes, exceto `lint-hardcode` (cor em `Caixa.cs`, herdada da produção). Baseline 10/10.
- App: 18 testes, TypeScript e bundle iOS.
- Simulador iOS contra servidor local em simulação: login, bateria nova aparecendo em tempo real, "Reconectando" ao derrubar o servidor e retorno sozinho.
- Teste: nenhum comando de prova responde em nenhum perfil, incluindo `GERENCIA`.
- Transações do `node:sqlite` validadas no ORBITS (Node 24.16).

## Não verificado
- Android: app não aberto no emulador.
- Worker, túnel e streaming na Cloudflare real; atraso real em Wi-Fi e 4G.
- Renovação de token no aparelho; a lógica só tem teste automático.
- Tempo de gravação no disco do ORBITS. A revisão só grava quando a composição muda, então passagens não geram custo.
- Programas Windows sem compilar.

## Decisões da revisão
- Revisão considera estado, karts, pilotos, penalidades e bandeira de piloto; não as passagens.
- `refresh` anterior vale por 60 s, para queda de rede não deslogar.
- Bloqueio derruba `/events` em até 15 s; pedidos normais recusam no seguinte.
- Eventos mostram baterias em andamento ou criadas nas últimas 48 h.

## Ajustes menores adiados (antes da F3)
`UNKNOWN` por queda sem linha de auditoria; corte da resposta no app em `enviarOperacao`; efeito parcial marcado como `REJECTED`; falha em `finalizar` deixa `PENDING`; hash ignora `reason` e revisão; `deviceId` fixo no app; bloquear e criar usuário sem auditoria; desbloqueio reativa sessões antigas; `sid` basta para revogar sessão; limite do Worker por isolate; backoff zera em 503; fluxo órfão ao sair durante leitura do token; sem rede ao abrir, app vai ao login.

## Autorizações pedidas
1. Publicar `alinhamento/base-app` no ORBITS, fora de bateria, com rotas desligadas; os programas Windows ficam fora até compilar.
2. Criar o Worker e o domínio `operacao.kartodromodebetim.com.br`, e os segredos.
3. Ligar o módulo e criar o primeiro usuário Gerência.
