# Railway Scraper Service

Use this for the persistent public scraper required by production.

## Required variables

```env
LIVETIME_UID=58856059-c4fd-4626-aea7-42aefc048eec
LIVETIME_HEADLESS=true
LIVETIME_SCRAPER_POLL_MS=2000
```

Railway provides `PORT` automatically. The scraper exposes:

```txt
/healthz
/api/livetime-snapshot
```

## Docker

Deploy using `Dockerfile.scraper`.

After Railway publishes a public domain, configure Vercel:

```bash
echo "https://SEU-SCRAPER.up.railway.app/api/livetime-snapshot" | vercel env add LIVETIME_SNAPSHOT_ENDPOINT production
vercel deploy --prod --yes
```

## Local public tunnel fallback

For temporary operation only:

```bash
npm run scraper
ngrok http 4010
```

Then use the ngrok HTTPS URL plus `/api/livetime-snapshot` as `LIVETIME_SNAPSHOT_ENDPOINT`.
