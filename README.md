# Kartodromo Internacional de Betim

Site institucional do Kartodromo Internacional de Betim, reconstruido com React, TypeScript, Vite e Tailwind CSS.

O projeto concentra a experiencia publica do kartodromo: apresentacao da pista, reservas online, kart de locacao, eventos, campeonatos, pagina dedicada ao KAC Iniciantes e conteudos institucionais.

![Home do Kartodromo de Betim](public/posters/home-karting.jpg)

## Visao Geral

- Site responsivo em portugues para desktop, tablet e mobile.
- Reservas online integradas ao MyLapTime.
- Pagina de reservas com leitura da agenda oficial via iframe/proxy.
- Formulario de inscricao para campeonatos com envio por webhook.
- Paginas dedicadas para pista, eventos, campeonatos, KAC, historia e duvidas frequentes.
- Assets locais organizados em `public/`, incluindo imagens de pista, eventos, historia, campeonatos, videos e regulamentos.
- Deploy preparado para Vercel com rewrites para SPA, MyLapTime e Edge Functions.

## Stack

- React 18
- TypeScript
- Vite 5
- Tailwind CSS
- React Router
- Lucide React
- Vercel Edge Functions
- Playwright para auditoria pre-entrega

## Rotas

| Rota | Conteudo |
| --- | --- |
| `/` | Home com hero, apresentacao, reservas, servicos, promocoes e contato |
| `/pista` | Informacoes da pista, mapas e configuracoes de tracado |
| `/kart-locacao` | Pagina comercial de kart de locacao |
| `/reservas` | Experiencia dedicada de reserva online |
| `/eventos` | Eventos corporativos, grupos e confraternizacoes |
| `/campeonatos` | Lista de campeonatos e formulario de inscricao |
| `/campeonatos/kac` | Pagina oficial do KAC Iniciantes |
| `/historia` | Historia do kartodromo |
| `/duvidas` | FAQ |

## Estrutura

```txt
.
├── api/
│   ├── inscricao.ts       # Edge Function para inscricoes de campeonatos
│   └── mylaptime.ts       # Proxy do MyLapTime usado na reserva online
├── public/
│   ├── brand/             # Logo e elementos de marca
│   ├── championships/     # Imagens dos campeonatos
│   ├── events/            # Imagens de eventos
│   ├── history/           # Imagens historicas
│   ├── kac/               # Assets da pagina KAC
│   ├── posters/           # Posters de videos
│   ├── regulamentos/      # PDFs publicos
│   └── videos/            # Videos publicos
├── src/
│   ├── components/        # Componentes reutilizaveis
│   ├── config/            # URLs e configuracoes do front
│   ├── data/              # Dados estaticos
│   ├── pages/             # Paginas roteadas
│   ├── App.tsx            # Rotas da aplicacao
│   └── main.tsx           # Entrada React
├── tests/
│   └── pre-delivery-audit.spec.ts
├── vercel.json
└── vite.config.ts
```

## Pre-requisitos

- Node.js 18 ou superior
- npm

Verifique as versoes:

```bash
node -v
npm -v
```

## Rodando Localmente

Instale as dependencias:

```bash
npm install
```

Crie um arquivo `.env` na raiz do projeto:

```env
FORM_MANAGEMENT_USER=usuario_do_webhook
FORM_MANAGEMENT_KEY=senha_ou_chave_do_webhook
FORM_WEBHOOK_URL=https://seu-n8n.exemplo/webhook/seu-id

# Opcionais para o proxy local do Vite.
# Se nao forem informadas, o projeto usa os defaults definidos em vite.config.ts.
FORM_WEBHOOK_TARGET=https://seu-n8n.exemplo
FORM_WEBHOOK_PATH=/webhook/seu-id
```

Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

Acesse:

```txt
http://localhost:5173
```

## Variaveis de Ambiente

| Variavel | Uso | Obrigatoria |
| --- | --- | --- |
| `FORM_MANAGEMENT_USER` | Usuario para autenticar o envio ao webhook de inscricoes | Sim, para inscricoes |
| `FORM_MANAGEMENT_KEY` | Chave/senha para autenticar o envio ao webhook | Sim, para inscricoes |
| `FORM_WEBHOOK_URL` | URL completa do webhook usado pela Edge Function `/api/inscricao` | Sim, em producao |
| `FORM_WEBHOOK_TARGET` | Origem usada pelo proxy local do Vite | Opcional |
| `FORM_WEBHOOK_PATH` | Caminho usado pelo proxy local do Vite | Opcional |

O codigo ainda aceita os nomes legados `FORM_MANAGERMENT_USER`, `FORM_MANAGERMENT_KEY`, `VITE_FORM_MANAGERMENT_USER`, `VITE_FORM_MANAGERMENT_KEY` e `VITE_WEBHOOK_URL` para compatibilidade. Para novos ambientes, prefira as variaveis sem `VITE_`, porque credenciais nao devem ser expostas ao navegador.

## Scripts

| Comando | Descricao |
| --- | --- |
| `npm run dev` | Inicia o Vite em modo desenvolvimento |
| `npm run build` | Gera a build de producao em `dist/` |
| `npm run preview` | Serve a build de producao localmente |
| `npm run typecheck` | Executa verificacao TypeScript sem emitir arquivos |
| `npm run lint` | Executa ESLint no projeto |
| `npm run test:pre-delivery` | Executa auditoria Playwright de responsividade, contraste, overflow e interacoes |

## Auditoria Pre-entrega

O teste `test:pre-delivery` espera a build em preview na porta `4173`.

Em um terminal:

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

Em outro terminal:

```bash
npm run test:pre-delivery
```

A auditoria cobre as rotas principais nos viewports `375`, `768`, `1024` e `1440`, verificando:

- ausencia de overflow horizontal;
- contraste minimo em textos visiveis;
- cursores e transicoes de elementos clicaveis;
- ausencia de emoji em texto da interface;
- estado de foco;
- suporte a `prefers-reduced-motion`.

## Integracoes

### MyLapTime

As URLs oficiais de reserva ficam em `src/config/booking.ts`.

No desenvolvimento, `vite.config.ts` cria proxies para endpoints do MyLapTime. Em producao, `vercel.json` redireciona as rotas necessarias e `api/mylaptime.ts` atua como proxy para a pagina de reserva.

Rotas relacionadas:

- `/booking`
- `/mylaptime/*`
- `/_content/*`
- `/_framework/*`
- `/_blazor`
- `/api/auth/*`

### Inscricoes de Campeonatos

O formulario de campeonatos envia dados para `/api/inscricao`.

A Edge Function valida:

- evento;
- nome da equipe;
- nome do chefe da equipe;
- e-mail, quando informado;
- lista de pilotos;
- peso dos pilotos;
- quantidade de karts.

Depois da validacao, a funcao encaminha o payload ao webhook configurado em `FORM_WEBHOOK_URL`.

## Deploy

O projeto esta preparado para deploy na Vercel.

Configuracoes relevantes:

- `vercel.json` contem rewrites para SPA, MyLapTime e assets remotos.
- `api/inscricao.ts` e `api/mylaptime.ts` usam runtime Edge.
- As variaveis de ambiente de inscricao devem ser configuradas no painel da Vercel.

Build command:

```bash
npm run build
```

Output directory:

```txt
dist
```

## Boas Praticas de Conteudo

- Mantenha imagens publicas dentro de `public/`.
- Para novos assets de pagina, prefira subpastas tematicas em `public/`.
- Atualize `src/config/booking.ts` quando URLs oficiais de reserva mudarem.
- Nao versione `.env` nem credenciais reais.
- Antes de publicar, rode `typecheck`, `lint`, `build` e a auditoria Playwright.

## Solucao de Problemas

### Porta 5173 ocupada

```bash
npm run dev -- --port 3000
```

### Dependencias inconsistentes

```bash
rm -rf node_modules
npm install
```

### Formulario de campeonato retorna erro 500

Verifique se `FORM_MANAGEMENT_USER`, `FORM_MANAGEMENT_KEY` e `FORM_WEBHOOK_URL` estao configuradas no ambiente em execucao.

### Reserva online nao carrega no preview local

Confirme se a aplicacao esta rodando por servidor Vite/Vercel. A reserva depende de proxy e nao deve ser testada abrindo arquivos diretamente pelo navegador.
