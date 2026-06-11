export const config = {
    runtime: 'edge',
};

const MYLAPTIME_ORIGIN = 'https://tools.mylaptime.com.br';

const EXCLUDED_RESPONSE_HEADERS = new Set([
    'connection',
    'content-encoding',
    'content-length',
    'keep-alive',
    'set-cookie',
    'transfer-encoding',
    'upgrade',
]);

const EXCLUDED_REQUEST_HEADERS = new Set([
    'connection',
    'host',
    'keep-alive',
    'transfer-encoding',
    'upgrade',
]);

const splitSetCookie = (value: string) =>
    value.split(/,(?=\s*[^;,=\s]+=[^;]+)/g).map((cookie) => cookie.trim()).filter(Boolean);

const rewriteCookie = (cookie: string) =>
    cookie
        .replace(/;\s*Domain=[^;]+/i, '')
        .replace(/;\s*SameSite=None/i, '; SameSite=Lax');

const getSetCookies = (headers: Headers) => {
    const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
    if (typeof getSetCookie === 'function') {
        return getSetCookie.call(headers);
    }

    const combined = headers.get('set-cookie');
    return combined ? splitSetCookie(combined) : [];
};

const buildTargetUrl = (request: Request) => {
    const requestUrl = new URL(request.url);
    const path = requestUrl.searchParams.get('path') || 'booking';
    const targetUrl = new URL(`/${path.replace(/^\/+/, '')}`, MYLAPTIME_ORIGIN);

    requestUrl.searchParams.forEach((value, key) => {
        if (key !== 'path') {
            targetUrl.searchParams.append(key, value);
        }
    });

    return targetUrl;
};

const buildRequestHeaders = (request: Request) => {
    const headers = new Headers();

    request.headers.forEach((value, key) => {
        if (!EXCLUDED_REQUEST_HEADERS.has(key.toLowerCase())) {
            headers.set(key, value);
        }
    });

    headers.set('origin', MYLAPTIME_ORIGIN);
    headers.set('referer', `${MYLAPTIME_ORIGIN}/booking`);

    return headers;
};

const patchBookingHtml = (html: string) => {
    const blazorScript = '<script src="_framework/blazor.web.js"></script>';
    const patchedScript = `<script src="_framework/blazor.web.js" autostart="false"></script>
    <script>
        (function () {
            function startBlazorWithLongPolling() {
                if (!window.Blazor || window.__kibBlazorStarted) return;
                window.__kibBlazorStarted = true;
                var originalWarn = console.warn.bind(console);
                console.warn = function () {
                    var message = Array.prototype.join.call(arguments, ' ');
                    if (message.indexOf('Failed to connect via WebSockets, using the Long Polling fallback transport') !== -1) {
                        return;
                    }

                    originalWarn.apply(console, arguments);
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

    return html.includes(blazorScript)
        ? html.replace(blazorScript, patchedScript)
        : html;
};

export default async function handler(request: Request) {
    const targetUrl = buildTargetUrl(request);
    const requestHeaders = buildRequestHeaders(request);
    const method = request.method.toUpperCase();

    const upstreamResponse = await fetch(targetUrl, {
        method,
        headers: requestHeaders,
        body: method === 'GET' || method === 'HEAD' ? undefined : request.body,
        redirect: 'manual',
    });

    const responseHeaders = new Headers();
    upstreamResponse.headers.forEach((value, key) => {
        if (!EXCLUDED_RESPONSE_HEADERS.has(key.toLowerCase())) {
            responseHeaders.set(key, value);
        }
    });

    getSetCookies(upstreamResponse.headers).forEach((cookie) => {
        responseHeaders.append('set-cookie', rewriteCookie(cookie));
    });

    const contentType = upstreamResponse.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
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
