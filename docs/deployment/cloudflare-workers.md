# Deploy no Cloudflare Workers

## Visão geral

O projeto é publicado como um Worker Next.js usando `@opennextjs/cloudflare` e Wrangler.

Arquivos principais:

- `wrangler.jsonc`: Worker, assets e bindings;
- `open-next.config.ts`: configuração do adaptador;
- `public/_headers`: cache e indexação de assets;
- `.github/workflows/cloudflare-worker.yml`: verificação e deploy;
- `package.json`: comandos OpenNext.

## Pré-requisitos no Cloudflare

O Worker deve existir com o nome:

```txt
kartodromo
```

Bindings esperados:

| Binding | Tipo | Recurso |
| --- | --- | --- |
| `ASSETS` | Static Assets | `.open-next/assets` |
| `WORKER_SELF_REFERENCE` | Service | `kartodromo` |
| `IMAGES` | Cloudflare Images | conta atual |
| `KARTODROMO_ADMIN_DB` | D1 | `kartodromo-admin` |

Banco D1 configurado:

```txt
database_id = daeb26fd-cef9-42b8-b51a-22e20b1607fe
```

## Token de CI

Crie um API Token específico para CI, sem usar Global API Key.

Permissões mínimas esperadas:

- Account · Workers Scripts · Edit;
- Account · Workers Tail · Read, para observabilidade quando necessário;
- Account · D1 · Edit, somente se o deploy ou migrations precisarem alterar D1;
- Zone · Workers Routes · Edit, somente se o domínio for administrado pelo workflow.

Restrinja o token à conta e à zona do Kartódromo.

## Secrets no GitHub

No repositório `pglemos/KARTODROMO`, cadastre em **Settings → Secrets and variables → Actions**:

```txt
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

Não coloque esses valores em arquivos `.env`, issues, commits, logs ou descrição de pull request.

## Variáveis de build

A URL pública canônica deve ser:

```txt
NEXT_PUBLIC_SITE_URL=https://kartodromodebetim.com.br
```

As integrações Supabase usam:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Variáveis necessárias durante o build devem existir no ambiente do GitHub Actions ou no sistema de build do Cloudflare.

## Fluxo de pull request

O job `verify` executa:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install --with-deps chromium
npm start -- -p 4174
npm run test:pre-delivery
npm run build:worker
```

O PR não deve ser marcado como pronto nem mesclado se qualquer etapa falhar.

## Fluxo de produção

Push em `main` executa novamente o job de verificação. O deploy só começa quando ele termina com sucesso.

Comando final:

```bash
npm run deploy:worker
```

Esse script chama o comando oficial do adaptador:

```bash
opennextjs-cloudflare build && opennextjs-cloudflare deploy
```

## Preview local no runtime Cloudflare

O `next dev` usa Node.js e não reproduz completamente o Worker. Para validar o runtime real:

```bash
npm ci
npm run preview
```

O preview executa o build OpenNext e inicia o `workerd` por meio do Wrangler.

## Migrations D1

As migrations ficam em:

```txt
migrations/d1
```

Antes de aplicar em produção:

1. revise a migration;
2. aplique em banco local ou ambiente de teste;
3. faça backup lógico dos dados afetados;
4. aplique remotamente com o Wrangler usando o mesmo arquivo versionado;
5. valide as rotas administrativas após a alteração.

Migrations não devem ser aplicadas automaticamente por um PR de frontend.

## Domínio e canonical

O site usa como origem oficial:

```txt
https://kartodromodebetim.com.br
```

Configure no Cloudflare:

- domínio customizado apontando para o Worker `kartodromo`;
- redirecionamento de `www` para o domínio canônico, ou o inverso, mantendo apenas uma origem;
- HTTPS obrigatório;
- cache sem transformar HTML autenticado em conteúdo público.

## Pós-deploy

Valide:

```txt
/
/pista
/kart-locacao
/reservas
/eventos
/campeonatos
/historia
/duvidas
/kac
/kac-super
/200-milhas
/500-milhas
/clube-vantagens
/clube-regulamento
/sitemap.xml
/robots.txt
```

Confirme também:

- `/valores` redireciona permanentemente para `/kart-locacao`;
- aliases `/campeonatos/*` redirecionam para a rota canônica;
- nenhuma URL pública redireciona para `/design/*.dc.html`;
- páginas transacionais do Clube mostram `Portal em implantação`;
- canonical e título mudam por rota;
- Worker logs não contêm exceptions durante navegação;
- D1 e painel administrativo permanecem acessíveis.

## Rollback

Em caso de regressão:

1. interrompa novos merges em `main`;
2. identifique o último commit verde;
3. faça revert do merge problemático em um novo PR;
4. aguarde o workflow de verificação;
5. mescle o revert para disparar novo deploy;
6. confirme a versão ativa no painel do Cloudflare Workers.

Não faça rollback manual de arquivos isolados no painel, pois isso cria diferença entre produção e GitHub.
