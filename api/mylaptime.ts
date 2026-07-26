const MYLAPTIME_ORIGIN = 'https://tools.mylaptime.com.br';

type ServerlessRequest = {
    method?: string;
    url?: string;
    headers: Record<string, string | string[] | undefined>;
    body?: unknown;
};

type ServerlessResponse = {
    status: (statusCode: number) => ServerlessResponse;
    setHeader: (name: string, value: string | string[]) => void;
    send: (body: string | Buffer) => void;
    end: () => void;
};

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
    if (typeof getSetCookie === 'function') return getSetCookie.call(headers);

    const combined = headers.get('set-cookie');
    return combined ? splitSetCookie(combined) : [];
};

const buildTargetUrl = (request: ServerlessRequest) => {
    const requestUrl = new URL(request.url || '/', 'https://kartodromobetim.vercel.app');
    const path = requestUrl.searchParams.get('path') || 'booking';
    const targetUrl = new URL(`/${path.replace(/^\/+/, '')}`, MYLAPTIME_ORIGIN);

    requestUrl.searchParams.forEach((value, key) => {
        if (key !== 'path') targetUrl.searchParams.append(key, value);
    });

    return targetUrl;
};

const buildRequestHeaders = (request: ServerlessRequest) => {
    const headers = new Headers();

    Object.entries(request.headers).forEach(([key, value]) => {
        if (!EXCLUDED_REQUEST_HEADERS.has(key.toLowerCase()) && value !== undefined) {
            headers.set(key, Array.isArray(value) ? value.join(', ') : value);
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
                    if (message.indexOf('Failed to connect via WebSockets, using the Long Polling fallback transport') !== -1) return;
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

    return html.includes(blazorScript) ? html.replace(blazorScript, patchedScript) : html;
};

const requestBody = (request: ServerlessRequest, method: string) => {
    if (method === 'GET' || method === 'HEAD' || request.body === undefined) return undefined;
    if (typeof request.body === 'string' || request.body instanceof Buffer) return request.body;
    return JSON.stringify(request.body);
};

export default async function handler(request: ServerlessRequest, response: ServerlessResponse) {
    const targetUrl = buildTargetUrl(request);
    const method = (request.method || 'GET').toUpperCase();
    const upstreamResponse = await fetch(targetUrl, {
        method,
        headers: buildRequestHeaders(request),
        body: requestBody(request, method),
        redirect: 'manual',
    });

    upstreamResponse.headers.forEach((value, key) => {
        if (!EXCLUDED_RESPONSE_HEADERS.has(key.toLowerCase())) response.setHeader(key, value);
    });

    const cookies = getSetCookies(upstreamResponse.headers).map(rewriteCookie);
    if (cookies.length > 0) response.setHeader('set-cookie', cookies);

    response.status(upstreamResponse.status);
    if (method === 'HEAD') return response.end();

    const contentType = upstreamResponse.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
        response.setHeader('content-type', contentType);
        response.setHeader('cache-control', 'no-store');
        return response.send(patchBookingHtml(await upstreamResponse.text()));
    }

    return response.send(Buffer.from(await upstreamResponse.arrayBuffer()));
}
