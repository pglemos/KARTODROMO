# Site público — Kartódromo Internacional de Betim

Reconstrução das 24 páginas públicas, em React/Vite e Cloudflare Workers. O logo original, fotos reais e regulamentos oficiais permanecem como fontes da marca e do conteúdo.

## Desenvolvimento

```sh
cd website
npm ci
npm run dev
npm run lint
npm test
npm run build
npm run preview
```

O build gera HTML específico de cada rota, metadados, dados estruturados, sitemap e assets. O código do site fica em `src/pages`; navegação, formulários e elementos compartilhados ficam em `src/components`. Tokens responsivos e fontes hospedadas localmente estão em `src/style.css`, `src/refinement.css` e `public/media`.

A prévia estática atende o HTML próprio de cada página, como o Worker. Isso evita comparar uma página interna com o HTML da home durante a hidratação.

## Publicação

```sh
CLOUDFLARE_ACCOUNT_ID=<conta> CLOUDFLARE_API_TOKEN=<token> npm run deploy
```

Não salve credenciais em arquivos versionados. O Worker `kartodromo-site-2026` usa a ligação `LEGACY` ao Worker existente `kartodromo` para APIs de inscrição, painel administrativo, telão e rotas operacionais. As 24 rotas públicas e os novos assets são atendidos pelo novo Worker.

O domínio de prévia é `https://kartodromo-site-2026.kartodromo.workers.dev`. A ativação no domínio institucional é feita pelas rotas Workers existentes, `kartodromodebetim.com.br/*` e `www.kartodromodebetim.com.br/*`. Para reverter, aponte essas duas rotas ao Worker `kartodromo`. O serviço original permanece disponível.

## Funcionalidades

- Navegação desktop e mobile, teclado, foco, Escape e redução de movimento.
- Pista: 30 mapas oficiais, filtros por configuração e ampliação em janela acessível.
- Reservas: planejador independente de bateria aberta/exclusiva, número de pilotos e estimativa. No mobile, o planejador precede a fotografia e pode ser aberto diretamente pelo cabeçalho. A compra continua na agenda oficial.
- Home: seletor de experiências com teclado, circuito, prova em destaque, guia de visita e dúvidas essenciais.
- Galerias: fotos reais ampliáveis, anterior/próxima, Escape e retorno de foco.
- Campeonatos: calendário filtrável, exportação ICS das datas confirmadas, regulamentos, cronogramas e inscrições com equipe/pilotos, CPF, total e aceites.
- Inscrição: API original `/api/inscricao`; o protocolo aparece somente após resposta válida. Falhas preservam campos e oferecem envio manual por WhatsApp. Confirmação da vaga depende da organização e do pagamento.
- Eventos: formatos, ambientes, capacidades e pedido de orçamento por WhatsApp.
- FAQ: busca sem diferenciar acentos, categorias e respostas expansíveis.
- História: conteúdo factual do site original.
- Clube: apresentação, 10 páginas de portal e regulamento; sem saldos, histórico ou resgates fictícios. Cadastro e transações seguem em implantação.

## Validação

Os testes em `tests` verificam regras de inscrição, formato ICS e delegação do Worker. A validação de navegador percorre todas as rotas em 1440, 768, 390 e 320px, audita WCAG AA em páginas representativas e verifica filtros, mapas, FAQ, menu, orçamento e os estados de sucesso/falha da inscrição. Escritas de inscrição são simuladas no navegador para não criar dados em produção.

Veja [a direção visual](docs/design.md) e [a verificação da entrega](docs/verification.md).
