import http from 'node:http';
import { DEFAULT_UID } from '@/lib/livetime/demo-data';
import { LiveTimeScraper } from './livetime-scraper';

const uid = process.env.LIVETIME_UID || process.env.NEXT_PUBLIC_DEFAULT_UID || DEFAULT_UID;
const port = Number(process.env.SCRAPER_PORT || process.env.PORT || '4010');

const scraper = new LiveTimeScraper({
  uid,
  headless: process.env.LIVETIME_HEADLESS !== 'false',
  pollMs: Number(process.env.LIVETIME_SCRAPER_POLL_MS || '2000'),
});

const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

  if (url.pathname !== '/api/livetime-snapshot') {
    response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'not_found' }));
    return;
  }

  response.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  response.end(JSON.stringify(scraper.getSnapshot()));
});

async function main() {
  await scraper.start();
  server.listen(port, () => {
    console.log(`LiveTime scraper listening on http://localhost:${port}/api/livetime-snapshot`);
  });
}

process.on('SIGINT', async () => {
  await scraper.stop();
  server.close(() => process.exit(0));
});

process.on('SIGTERM', async () => {
  await scraper.stop();
  server.close(() => process.exit(0));
});

void main();
