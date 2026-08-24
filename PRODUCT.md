# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Três públicos em pé de igualdade no site público:

1. **Cliente avulso** — quer correr uma bateria de aluguel hoje/no fim de semana; ação: reservar horário (hoje via MyLapTime) ou chamar no WhatsApp.
2. **Evento corporativo/festa** — contrata eventos fechados; ação: pedir orçamento via WhatsApp.
3. **Piloto de campeonato** — participa do KAC/clube/enduro (200/500 Milhas); acompanha regulamento, etapas, classificação e resultados.

Superfície **admin** separada (`/admin`) serve a equipe interna com RBAC de 7 perfis (owner, admin, financeiro, recepcao, lanchonete, operador_telao, viewer): reservas, recepção, lanchonete, cronometragem, campeonatos, resultados, telão, financeiro, clientes, equalização de karts, administrativa.

## Product Purpose

Site institucional + sistema administrativo do **Kartódromo Internacional de Betim** (pista de kart em Betim/MG). O site apresenta a pista, serviços e provas e converte visita em reserva/orçamento; o admin opera o dia a dia integrado à cronometragem profissional. Sucesso: reserva/orçamento gerado pelo visitante, piloto informado com dados oficiais da cronometragem, equipe rodando o kartódromo sem planilhas paralelas.

## Positioning

**Cronometragem profissional + grandes provas**: transponders, sistema LapTime, telão ao vivo e provas de endurance próprias (200 Milhas, 500 Milhas) — conjunto que nenhum kartódromo vizinho poderia copiar. A cronometragem oficial é argumento central de venda e diferencial técnico.

## Operating Context

- **LapTime (Sisecom)** é a fonte da verdade da cronometragem: tempos, posições, voltas, punições aplicadas em tempo real pelo cronometrista. O sistema local nunca calcula punição — apenas exibe.
- **MyLapTime** (SaaS externo `tools.mylaptime.com.br`) cuida de reserva e pagamento públicos; o projeto apenas aponta para ele.
- Inscrições de campeonato vão para webhook **n8n** externo.
- **WhatsApp** é canal oficial de orçamento/contato.
- Infra: Next.js em Cloudflare Workers (D1 + R2), deploy por CI do GitHub em `main`; scraper/ponte local para o LapTime exposto via túnel.
- Regulamentos variam por evento/campeonato (tomada de tempo, paradas obrigatórias, pontuação própria) — configuráveis no admin, sem parâmetro global; padrão do kartódromo = TT monta grid + corrida livre sem parada.

## Capabilities and Constraints

- Rotas públicas definidas em `src/config/publicRoutes.ts` (home, pista, kart-locacao, reservas, eventos, campeonatos, historia, duvidas, kac, kac-super, 200-milhas, 500-milhas, clube-*), com status active/coming-soon por rota.
- Design público é gerado de `design-source/*.dc.html` (34 telas) sincronizado para `public/design` (`npm run sync:design` / `check:design`) — alterar visual significa alterar a fonte, não o artefato.
- Deploy bloqueado se typecheck/lint/testes não passarem (CI GitHub Actions em `main`).
- **Zero dado mock**: bancos foram purgados de seed fictício (decisão do dono, 2026-08-23). Toda informação exibida deve vir de fonte real (LapTime, cadastro operacional).
- Conteúdo exclusivamente em pt-BR.

## Brand Commitments

- **Logo original intocável** (`public/brand/kib-logo.png`): não redesenhar símbolo, tipografia, bandeira, kart/piloto nem proporção; aplicar com contraste e respiro adequados.
- **pt-BR** em toda a interface.
- **Brandbook v1.0** (`docs/brandbook-kartodromo.md`): registrado, mas **diverge da produção** — o documento prescreve base clara/mineral com grafite + verde institucional + vermelho racing + amarelo pontual; a produção consolidou um mundo escuro (#030504) com verde neon (#00e676) e Rajdhani. Pelo critério do dono ("se estiver 1:1 em produção é lei"), a direção do brandbook **não é vinculante hoje**; logo e idioma sim. Convergir ou formalizar o mundo escuro é decisão futura do dono.

## Evidence on Hand

- Brandbook completo em `docs/brandbook-kartodromo.md`.
- Fonte visual vigente em `design-source/` (34 telas, pública + admin).
- Prints reais do sistema legado e telão em `KARTODROMO - SISTEMA/prints/` (fora do git).
- Histórico real de corridas no LapTime (ex.: 500 Milhas #637101 com 38 karts; baterias diárias TT+Corrida).
- **Não fabricar**: depoimentos, números de clientes, prêmios, preços ou benchmarks inexistentes.

## Product Principles

1. **A cronometragem manda** — todo tempo, posição e punição exibido nasce do LapTime; nada calculado ou inventado localmente.
2. **Dado real ou nada** — sem mock, seed ou conteúdo de demonstração no banco ou na interface.
3. **Três públicos, nenhum protagonista falso** — avulso, evento e piloto têm caminhos claros sem competir entre si.
4. **Falha visível, operação firme** — dependências externas (LapTime, MyLapTime, túnel) exibem estado honesto e nunca travam a experiência inteira.
5. **A marca existente é patrimônio** — valorizar a logo e a identidade já reconhecidas, nunca redesenhá-las.
