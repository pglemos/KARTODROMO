// Vercel Serverless Function — proxies form submission to the n8n webhook
// Keeps API credentials server-side only (never exposed to the browser)

export const config = {
    runtime: 'edge',
};

type Pilot = {
    nome?: unknown;
    peso_kg?: unknown;
};

type RegistrationPayload = {
    evento?: unknown;
    nome_da_equipe?: unknown;
    nome_do_chefe_da_equipe?: unknown;
    email?: unknown;
    telefone?: unknown;
    pilotos?: unknown;
    quantidade_karts_no_campeonato?: unknown;
    pagamento?: unknown;
};

const jsonResponse = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

const readEnv = (...keys: string[]) => {
    for (const key of keys) {
        const value = process.env[key];
        if (value) return value;
    }
    return '';
};

const isNonEmptyString = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

const validatePayload = (body: RegistrationPayload) => {
    const errors: string[] = [];

    if (!isNonEmptyString(body.evento)) errors.push('Evento é obrigatório.');
    if (!isNonEmptyString(body.nome_da_equipe)) errors.push('Nome da equipe é obrigatório.');
    if (!isNonEmptyString(body.nome_do_chefe_da_equipe)) errors.push('Nome do chefe da equipe é obrigatório.');

    if (body.email !== undefined && body.email !== '' && typeof body.email === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
        errors.push('E-mail inválido.');
    }

    if (!Array.isArray(body.pilotos) || body.pilotos.length < 1 || body.pilotos.length > 50) {
        errors.push('Informe de 1 a 50 pilotos.');
    } else {
        body.pilotos.forEach((pilot: Pilot, index: number) => {
            if (!isNonEmptyString(pilot.nome)) errors.push(`Nome do piloto ${index + 1} é obrigatório.`);
            const weight = Number(pilot.peso_kg);
            if (!Number.isFinite(weight) || weight < 30 || weight > 200) {
                errors.push(`Peso do piloto ${index + 1} deve estar entre 30 kg e 200 kg.`);
            }
        });
    }

    const kartCount = Number(body.quantidade_karts_no_campeonato);
    if (!Number.isInteger(kartCount) || kartCount < 1 || kartCount > 50) {
        errors.push('Quantidade de karts deve estar entre 1 e 50.');
    }

    return errors;
};

export default async function handler(request: Request) {
    if (request.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 20000) {
        return jsonResponse({ error: 'Payload too large' }, 413);
    }

    const user = readEnv('FORM_MANAGEMENT_USER', 'FORM_MANAGERMENT_USER', 'VITE_FORM_MANAGERMENT_USER');
    const key = readEnv('FORM_MANAGEMENT_KEY', 'FORM_MANAGERMENT_KEY', 'VITE_FORM_MANAGERMENT_KEY');
    const webhookUrl = readEnv('FORM_WEBHOOK_URL', 'VITE_WEBHOOK_URL');

    if (!user || !key || !webhookUrl) {
        return jsonResponse({ error: 'Server misconfigured' }, 500);
    }

    try {
        const body = await request.json() as RegistrationPayload;
        const validationErrors = validatePayload(body);

        if (validationErrors.length > 0) {
            return jsonResponse({ error: 'Invalid registration payload', details: validationErrors }, 400);
        }

        const credentials = btoa(`${user}:${key}`);

        const webhookResponse = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Basic ${credentials}`,
            },
            body: JSON.stringify(body),
        });

        const responseData = await webhookResponse.text();
        let responsePayload: unknown = {
            ok: webhookResponse.ok,
            message: responseData || (webhookResponse.ok ? 'Registration forwarded' : 'Webhook rejected registration'),
        };

        try {
            responsePayload = responseData ? JSON.parse(responseData) : responsePayload;
        } catch {
            // n8n can return plain text; keep a valid JSON response for the client.
        }

        return jsonResponse(responsePayload, webhookResponse.status);
    } catch {
        return jsonResponse({ error: 'Failed to process registration' }, 500);
    }
}
