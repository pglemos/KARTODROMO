const MYLAPTIME_ORIGIN = 'https://tools.mylaptime.com.br';

const EXCLUDED_RESPONSE_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'content-security-policy',
  'keep-alive',
  'set-cookie',
  'transfer-encoding',
  'upgrade',
  'x-frame-options',
]);

const EXCLUDED_REQUEST_HEADERS = new Set(['connection', 'host', 'keep-alive', 'transfer-encoding', 'upgrade']);

const splitSetCookie = (value: string) =>
  value.split(/,(?=\s*[^;,=\s]+=[^;]+)/g).map((cookie) => cookie.trim()).filter(Boolean);

const rewriteCookie = (cookie: string) =>
  cookie.replace(/;\s*Domain=[^;]+/i, '').replace(/;\s*SameSite=None/i, '; SameSite=Lax');

const getSetCookies = (headers: Headers) => {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === 'function') return getSetCookie.call(headers);

  const combined = headers.get('set-cookie');
  return combined ? splitSetCookie(combined) : [];
};

function buildRequestHeaders(request: Request): Headers {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    if (!EXCLUDED_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });

  headers.set('origin', MYLAPTIME_ORIGIN);
  headers.set('referer', `${MYLAPTIME_ORIGIN}/booking`);

  return headers;
}

function rewriteProxyLocation(value: string): string {
  try {
    const locationUrl = new URL(value, MYLAPTIME_ORIGIN);
    if (locationUrl.origin !== MYLAPTIME_ORIGIN) return value;

    const path = `${locationUrl.pathname}${locationUrl.search}${locationUrl.hash}`;

    if (
      locationUrl.pathname === '/booking' ||
      locationUrl.pathname.startsWith('/api/auth/') ||
      locationUrl.pathname.startsWith('/_content/') ||
      locationUrl.pathname.startsWith('/_framework/') ||
      locationUrl.pathname.startsWith('/_blazor') ||
      locationUrl.pathname === '/LapTime.Web.Tools.styles.css'
    ) {
      return path;
    }

    return `/mylaptime${path}`;
  } catch {
    return value;
  }
}

function patchBookingHtml(html: string): string {
  const blazorScript = '<script src="_framework/blazor.web.js"></script>';
  const patchedScript = `<script src="_framework/blazor.web.js" autostart="false"></script>
    <script>
        (function () {
            function rewriteMylaptimeUrl(value) {
                try {
                    var url = new URL(value, window.location.href);

                    if (url.origin === 'https://tools.mylaptime.com.br') {
                        return url.pathname + url.search + url.hash;
                    }

                    return url.href;
                } catch (error) {
                    return value;
                }
            }

            window.open = function (value) {
                if (value) {
                    window.location.href = rewriteMylaptimeUrl(value);
                }

                return null;
            };

            document.addEventListener('click', function (event) {
                var target = event.target;
                var anchor = target && target.closest ? target.closest('a[href]') : null;

                if (!anchor) return;

                var linkTarget = (anchor.getAttribute('target') || '').toLowerCase();

                if (linkTarget === '_top' || linkTarget === '_parent' || linkTarget === '_blank') {
                    event.preventDefault();
                    window.location.href = rewriteMylaptimeUrl(anchor.href);
                }
            }, true);

            function startBlazorWithLongPolling() {
                if (!window.Blazor || window.__kibBlazorStarted) return;
                window.__kibBlazorStarted = true;
                var originalWarn = console.warn.bind(console);
                var originalError = console.error.bind(console);
                console.warn = function () {
                    var message = Array.prototype.join.call(arguments, ' ');
                    if (message.indexOf('Failed to connect via WebSockets, using the Long Polling fallback transport') !== -1) {
                        return;
                    }

                    originalWarn.apply(console, arguments);
                };
                console.error = function () {
                    var message = Array.prototype.join.call(arguments, ' ');
                    if (message.indexOf("There is no tracked object with id") !== -1) {
                        return;
                    }

                    originalError.apply(console, arguments);
                };
                window.Blazor.start({
                    logLevel: 4,
                    circuit: {
                        configureSignalR: function (builder) {
                            builder.configureLogging(4);
                            builder.withUrl('/_blazor', { transport: 4 });
                        }
                    }
                }).catch(function (error) {
                    console.error('[Kartodromo] Falha ao iniciar reserva online.', error);
                });
            }

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', startBlazorWithLongPolling);
            } else {
                startBlazorWithLongPolling();
            }
        })();
    </script>`;

  return html.includes(blazorScript) ? html.replace(blazorScript, patchedScript) : html;
}

export type MyLapTimeProxyMode = 'transform' | 'passthrough';

/**
 * Mirrors o antigo `api/mylaptime.ts` (Vercel Edge Function, nunca chega a rodar no
 * Cloudflare Workers/OpenNext). `transform` reescreve cookies/Location e injeta o patch do
 * Blazor (usado por /booking e /api/auth/*); `passthrough` so encaminha bytes (assets estaticos
 * do Blazor e do SignalR em /_content, /_framework, /_blazor, /mylaptime, styles.css).
 */
export async function proxyMyLapTime(
  request: Request,
  upstreamPath: string,
  mode: MyLapTimeProxyMode,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const targetUrl = new URL(`/${upstreamPath.replace(/^\/+/, '')}`, MYLAPTIME_ORIGIN);
  requestUrl.searchParams.forEach((value, key) => targetUrl.searchParams.append(key, value));

  const method = request.method.toUpperCase();
  const upstreamResponse = await fetch(targetUrl, {
    method,
    headers: buildRequestHeaders(request),
    body: method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer(),
    redirect: 'manual',
  });

  const responseHeaders = new Headers();
  upstreamResponse.headers.forEach((value, key) => {
    if (!EXCLUDED_RESPONSE_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, mode === 'transform' && key.toLowerCase() === 'location' ? rewriteProxyLocation(value) : value);
    }
  });

  if (mode === 'transform') {
    getSetCookies(upstreamResponse.headers).forEach((cookie) => {
      responseHeaders.append('set-cookie', rewriteCookie(cookie));
    });
  }

  const contentType = upstreamResponse.headers.get('content-type') || '';
  if (mode === 'transform' && contentType.includes('text/html')) {
    responseHeaders.set('content-type', contentType);
    responseHeaders.set('cache-control', 'no-store');

    return new Response(patchBookingHtml(await upstreamResponse.text()), {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}
