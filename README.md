# Kartódromo Internacional de Betim

Aplicação oficial do Kartódromo Internacional de Betim, com site público, campeonatos, reservas, Clube de Vantagens em implantação e painel administrativo.

## Stack atual

- Next.js 16 com App Router
- React 19
- TypeScript 5.9
- Tailwind CSS 3
- Supabase
- Cloudflare Workers
- OpenNext Cloudflare
- Cloudflare D1 e Images
- Vitest e Playwright

## Arquitetura pública

As URLs públicas são servidas pela aplicação Next através de `app/[[...slug]]/page.tsx`.

O registro canônico de rotas fica em:

```txt
src/config/publicRoutes.ts
```

Esse arquivo é a fonte de verdade para:

- título e descrição por página;
- canonical;
- Open Graph e Twitter Card;
- sitemap;
- disponibilidade das áreas do Clube;
- resolução da página pública.

Os documentos antigos em `public/design/*.dc.html` permanecem apenas como referência visual e não são páginas canônicas de produção.

## Rotas públicas

### Institucional

- `/`
- `/pista`
- `/kart-locacao`
- `/reservas`
- `/eventos`
- `/campeonatos`
- `/historia`
- `/duvidas`

### Campeonatos

- `/kac`
- `/kac-super`
- `/200-milhas`
- `/500-milhas`

Aliases antigos em `/campeonatos/*` usam redirect permanente para a URL canônica.

### Clube de Vantagens

- `/clube-vantagens`
- `/clube-regulamento`
- demais rotas `/clube-*`

As áreas transacionais do Clube permanecem em estado explícito de implantação até existirem autenticação, persistência, integração com corridas e resgates auditáveis. O site não exibe clientes, CPFs, saldos ou confirmações fictícias.

## Requisitos

- Node.js 22
- npm
- acesso ao projeto Cloudflare Workers para deploy

## Desenvolvimento

```bash
npm ci
npm run dev
```

A aplicação fica disponível em `http://localhost:3000`.

## Verificação

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

### Auditoria visual e funcional

Depois do build:

```bash
npm start -- -p 4174
```

Em outro terminal:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4174 npm run test:pre-delivery
```

A auditoria cobre as 23 rotas canônicas em:

- 375 × 812;
- 768 × 1024;
- 1024 × 768;
- 1440 × 900.

Ela verifica overflow, contraste, foco, movimento reduzido, metadata, canonical, templates não resolvidos, links para documentos `.dc` e o estado seguro das páginas do Clube.

## Cloudflare Workers

O projeto usa `@opennextjs/cloudflare` e `wrangler.jsonc`.

### Preview no runtime do Worker

```bash
npm run preview
```

### Build do Worker

```bash
npm run build:worker
```

### Deploy manual

```bash
npm run deploy
```

O deploy exige:

```env
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
NEXT_PUBLIC_SITE_URL=https://kartodromodebetim.com.br
```

Nunca versione valores reais.

## CI/CD

O workflow `.github/workflows/cloudflare-worker.yml` executa em pull requests e branches de correção:

1. instalação com `npm ci`;
2. typecheck;
3. lint;
4. testes unitários;
5. build Next;
6. Playwright;
7. build OpenNext.

Em push para `main`, o deploy de produção ocorre somente depois da verificação completa.

Cada execução de produção publica o contexto `cloudflare/deploy` no commit de `main`, registrando sucesso ou falha e apontando para o respectivo workflow do GitHub Actions.

Secrets exigidos no GitHub:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Consulte `docs/deployment/cloudflare-workers.md` para o procedimento completo.

## Bindings Cloudflare

O Worker usa:

- `ASSETS` para arquivos estáticos;
- `WORKER_SELF_REFERENCE` para autorreferência do Worker;
- `IMAGES` para Cloudflare Images;
- `KARTODROMO_ADMIN_DB` para o banco D1 `kartodromo-admin`.

As migrations do D1 ficam em:

```txt
migrations/d1
```

## Reservas

A reserva abre a plataforma oficial do MyLapTime em nova aba. Não clone, incorpore por proxy ou reescreva a aplicação de terceiros.

## Variáveis Supabase

O projeto aceita os nomes atuais:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Os nomes legados sem o sublinhado após `PUBLIC` continuam temporariamente suportados para evitar interrupção durante a migração.

## Regras de contribuição

- não faça alterações diretamente em `main`;
- use branch e pull request;
- não publique dados de demonstração como dados reais;
- não versione secrets;
- atualize `src/config/publicRoutes.ts` ao criar uma rota pública;
- execute todos os comandos de verificação antes do merge;
- valide o build OpenNext, não apenas o servidor Node local.
