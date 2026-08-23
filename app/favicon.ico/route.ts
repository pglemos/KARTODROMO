const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#2f7d45"/><path fill="#fff" d="M16 16h32v32H16z"/><path fill="#2f7d45" d="M16 16h8v8h-8zm16 0h8v8h-8zM24 24h8v8h-8zm16 0h8v8h-8zM16 32h8v8h-8zm16 0h8v8h-8zM24 40h8v8h-8zm16 0h8v8h-8z"/></svg>`;

export function GET() {
  return new Response(FAVICON_SVG, {
    headers: {
      'content-type': 'image/svg+xml',
      'cache-control': 'public, max-age=86400',
    },
  });
}
