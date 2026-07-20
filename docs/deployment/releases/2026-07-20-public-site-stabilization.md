# Publicação de produção — 20 de julho de 2026

## Escopo

Publicação da estabilização do site público do Kartódromo Internacional de Betim.

## Conteúdo da versão

- URLs públicas servidas pelo Next.js/OpenNext;
- remoção dos redirects canônicos para documentos `.dc`;
- metadata, canonical, Open Graph, sitemap e robots por rota;
- redirects permanentes de URLs legadas;
- resposta HTTP 404 real;
- remoção de dados e operações fictícias do Clube de Vantagens;
- estado explícito de implantação nas áreas transacionais do Clube;
- auditoria Playwright das 23 rotas em mobile, tablet e desktop;
- rotas Cloudflare do domínio raiz e do `www` vinculadas ao Worker;
- build e deploy por Cloudflare Workers.

## Verificação anterior

A versão foi aprovada em:

- typecheck;
- lint;
- testes unitários;
- build Next.js;
- Playwright em 375, 768, 1024 e 1440 px;
- build OpenNext para Cloudflare Workers.

## Verificação pós-deploy

O pipeline valida o domínio público depois de cada publicação:

- Home responde com HTTP 200 sem redirecionar para `/design`;
- HTML não contém templates `{{ ... }}`;
- canonical aponta para o domínio oficial;
- páginas transacionais do Clube mostram `Portal em implantação`;
- `/valores` redireciona permanentemente para `/kart-locacao`;
- sitemap e robots estão disponíveis e coerentes.

## Procedimento

Este branch usa o prefixo protegido `deploy/production-` e só pode publicar depois do job completo de verificação. O resultado será registrado no commit pelo contexto `cloudflare/deploy`.
