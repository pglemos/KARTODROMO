# Local Persistent Scraper

This machine can run the production scraper through macOS LaunchAgents.

Services installed locally:

```txt
com.kartodromo.livetime-scraper
com.kartodromo.livetime-ngrok
```

Public scraper URL configured in Vercel:

```txt
https://repeatable-sanora-feignedly.ngrok-free.dev/api/livetime-snapshot
```

Health checks:

```bash
curl http://localhost:4010/healthz
curl https://repeatable-sanora-feignedly.ngrok-free.dev/healthz
curl https://kartodromo-telao-livetime.vercel.app/api/livetime-snapshot?uid=58856059-c4fd-4626-aea7-42aefc048eec
```

Logs:

```txt
/tmp/kartodromo-livetime-scraper.out.log
/tmp/kartodromo-livetime-scraper.err.log
/tmp/kartodromo-livetime-ngrok.out.log
/tmp/kartodromo-livetime-ngrok.err.log
```

Manual control:

```bash
launchctl print gui/$(id -u)/com.kartodromo.livetime-scraper
launchctl print gui/$(id -u)/com.kartodromo.livetime-ngrok
launchctl kickstart -k gui/$(id -u)/com.kartodromo.livetime-scraper
launchctl kickstart -k gui/$(id -u)/com.kartodromo.livetime-ngrok
```

For event production, prefer Railway/VPS over local ngrok when credentials are available.
