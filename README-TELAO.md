# Placar Telão 2048x512

Aplicação intermediária para exibir cronometragem LiveTime/LapTime em telão LED NovaStar TB50.

## URL da tela

```txt
/placar-telao?uid=58856059-c4fd-4626-aea7-42aefc048eec
```

Parâmetros suportados:

```txt
uid=<uid-da-corrida>
fontScale=0.85..1.2
showHeader=true|false
```

## Desenvolvimento local

```bash
npm install
npm run dev
```

Abrir:

```txt
http://localhost:3000/placar-telao?uid=58856059-c4fd-4626-aea7-42aefc048eec
```

## Dados

A tela consome:

```txt
GET /api/livetime-snapshot?uid=<uid>
```

Em desenvolvimento, se `LIVETIME_SNAPSHOT_ENDPOINT` não estiver configurado, a API retorna dados demo com status `DEMO`. Em produção, a ausência do endpoint retorna erro para evitar falso positivo em evento ao vivo. Para dados reais do LiveTime Blazor Server, rode o scraper persistente:

```bash
npm run scraper
```

Depois configure:

```env
LIVETIME_SNAPSHOT_ENDPOINT=http://localhost:4010/api/livetime-snapshot
```

## Produção

Para evento ao vivo, use uma destas opções:

1. VPS pequena rodando `npm run scraper` e a aplicação Next.js.
2. Mini PC local no kartódromo rodando scraper e tela em Chrome kiosk.
3. Vercel para a tela, apontando `LIVETIME_SNAPSHOT_ENDPOINT` para um scraper externo persistente.

Não usar função serverless comum para manter Playwright aberto continuamente.

## Build e testes

```bash
npm test
npm run build
```
