import crypto from 'node:crypto';

/**
 * Cliente da API REST local do LapTime (`LapTime.Api`, hospedada no IIS do CRONO1 em
 * `http://192.168.20.254/laptime/api`). A autenticacao NAO e' login/senha: e' um esquema temporal
 * proprio da Sisecom (engenharia reversa em 2026-07-02). O endpoint `POST /Security/Authenticate`
 * le dois headers, `pOrigin` e `pKey`, e concede acesso `admin` quando
 * `pOrigin == Decrypt(pKey, <ticks-de-meia-noite-UTC-do-servidor>)`.
 *
 * `pKey` = AES-256-CBC( pOrigin + "yyyyMMddHHmm"(UTC, ate o minuto) + <ticks-meia-noite-UTC> +
 * WordsOfMonth[dia-1] ), com Key/IV derivados por PBKDF2-SHA512(EncryptionKey, "Ivan Medvedev",
 * 2121). Todos esses valores sao constantes embutidas no `Sisecom.Framework.dll`; a implementacao
 * abaixo foi validada byte-a-byte contra a DLL e contra a API real.
 *
 * IMPORTANTE: o servidor valida a janela de tempo (±5 min) contra o RELOGIO DELE. Como pode haver
 * desvio de relogio entre o CRONO1 e a maquina que roda este cliente (observado ~49 min em
 * 2026-07-02), o horario usado para montar o `pKey` DEVE vir do proprio servidor — passe
 * `serverNowUtc` obtido de `SELECT GETUTCDATE()` no SQL do LapTime, nunca `new Date()` local.
 */

const ENCRYPTION_KEY =
  'CKkBDem3PEMe4dfFfe1pfYrNCPQEUZMWd4dPYHSjw2D8F4b2wW+hDKHB3n0F/w3YkXGoDdACrs5OAhE5pwqWWDBZSrYh0LopgJG9RgI9Y0k';
const SALT = Buffer.from('Ivan Medvedev', 'utf8');
const PBKDF2_ITERATIONS = 2121;
const WORDS_OF_MONTH = [
  '5MNTl3rnD', 'JLPBEE1uC', 'Y95fdk72I', 'tDCGHwKAq', 'SSCxI5hmT', '2JLxtQoPZ', '8Ft3Fh1eQ',
  'KnX6RJzkk', 'u26EPPCF1', 'SuQ804cxz', 'MWpGnt8m0', 'eKmspBo7d', 'H2cREYj7l', 'o1Z4Yg8hG',
  'XB2dEJopp', 'DIuCBM4UY', 'uiZtFQYUM', 'cJUkLrW5J', 'i2ycoeE3f', 'I1OsTrbDI', 'Uje4prU2e',
  'NHPG5XrJP', 'LynBd3xXk', '9GI5KHqX7', 'nuAQmb5io', 'Pua6tuCPs', 'PlYXXgI7Y', '34SjsnnZk',
  '5Ifm2AEPz', 'OafTLdOth', 'rNi3BxXZ1',
];
// 1970-01-01 em ticks .NET (100ns desde 0001-01-01).
const UNIX_EPOCH_TICKS = 621355968000000000n;

const derivedKeyMaterial = crypto.pbkdf2Sync(
  Buffer.from(ENCRYPTION_KEY, 'utf8'),
  SALT,
  PBKDF2_ITERATIONS,
  48,
  'sha512',
);
const AES_KEY = derivedKeyMaterial.subarray(0, 32);
const AES_IV = derivedKeyMaterial.subarray(32, 48);

function encryptString(input: string): string {
  const cipher = crypto.createCipheriv('aes-256-cbc', AES_KEY, AES_IV);
  const plaintext = Buffer.from(input, 'utf16le'); // Encoding.Unicode no .NET
  return Buffer.concat([cipher.update(plaintext), cipher.final()]).toString('base64');
}

function ticksFromUtcMillis(millis: number): bigint {
  return UNIX_EPOCH_TICKS + BigInt(millis) * 10000n;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Monta o `pKey` para um dado `pOrigin`, ancorado no horario UTC do servidor LapTime. */
export function buildAuthKey(origin: string, serverNowUtc: Date): string {
  const year = serverNowUtc.getUTCFullYear();
  const monthIndex = serverNowUtc.getUTCMonth();
  const day = serverNowUtc.getUTCDate();
  const stamp =
    `${year}${pad2(monthIndex + 1)}${pad2(day)}${pad2(serverNowUtc.getUTCHours())}${pad2(serverNowUtc.getUTCMinutes())}`;
  const midnightMillis = Date.UTC(year, monthIndex, day);
  const additionalWord = ticksFromUtcMillis(midnightMillis).toString();
  const wordOfMonth = WORDS_OF_MONTH[day - 1];
  return encryptString(origin + stamp + additionalWord + wordOfMonth);
}

export type LapTimeApiOptions = {
  baseUrl: string; // ex: http://192.168.20.254/laptime/api
  origin?: string; // nome do "modulo" que nos identificamos como; default LapTimeMirror
  timeoutMs?: number;
};

type AuthenticateResponse = {
  origin: string;
  token: string;
  key: string;
  expiration: string;
};

type ApiEnvelope<T> = {
  message?: string;
  success?: boolean;
  data?: T;
};

function normalizeApiBaseUrl(value: string): string {
  const url = new URL(value);
  url.search = '';
  url.hash = '';
  const pathname = url.pathname.replace(/\/+$/, '');

  if (!/(^|\/)api$/i.test(pathname)) {
    url.pathname = `${pathname || ''}/api`;
  } else {
    url.pathname = pathname;
  }

  return url.toString().replace(/\/+$/, '');
}

export class LapTimeApiClient {
  private readonly baseUrl: string;
  private readonly origin: string;
  private readonly timeoutMs: number;
  private token: string | null = null;
  private tokenExpiresAt = 0;

  /**
   * @param getServerNowUtc funcao que devolve o horario UTC atual do servidor LapTime (ex: um
   *   `SELECT GETUTCDATE()` no SQL). Necessaria para contornar desvio de relogio local.
   */
  constructor(
    options: LapTimeApiOptions,
    private readonly getServerNowUtc: () => Promise<Date>,
  ) {
    this.baseUrl = normalizeApiBaseUrl(options.baseUrl);
    this.origin = options.origin || 'LapTimeMirror';
    this.timeoutMs = options.timeoutMs || 15000;
  }

  private async authenticate(): Promise<void> {
    const serverNow = await this.getServerNowUtc();
    const pKey = buildAuthKey(this.origin, serverNow);

    const response = await this.fetchWithTimeout(`${this.baseUrl}/Security/Authenticate`, {
      method: 'POST',
      headers: {
        pOrigin: this.origin,
        pKey,
        'content-type': 'application/json',
      },
      body: '',
    });

    if (!response.ok) {
      throw new Error(`Authenticate falhou: HTTP ${response.status}`);
    }

    const body = (await response.json()) as AuthenticateResponse;
    if (!body.token) {
      throw new Error('Authenticate nao retornou token');
    }

    this.token = body.token;
    // O JWT expira em `expiration`; renovamos 5 min antes por seguranca.
    const expMillis = body.expiration ? new Date(body.expiration).getTime() : Date.now() + 3600_000;
    this.tokenExpiresAt = expMillis - 5 * 60 * 1000;
  }

  private async ensureToken(): Promise<string> {
    if (!this.token || Date.now() >= this.tokenExpiresAt) {
      await this.authenticate();
    }
    return this.token as string;
  }

  async getToken(): Promise<string> {
    return this.ensureToken();
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  /** GET autenticado numa rota da API (ex: "/Booking/SelectOpenBookings"), com 1 retry ao 401. */
  async get<T = unknown>(path: string): Promise<T> {
    const url = `${this.baseUrl}/${path.replace(/^\/+/, '')}`;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = await this.ensureToken();
      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401 && attempt === 0) {
        // Token pode ter expirado (ou o relogio virou o dia) — forca reautenticacao e tenta 1x.
        this.token = null;
        continue;
      }

      if (!response.ok) {
        throw new Error(`GET ${path} falhou: HTTP ${response.status}`);
      }

      const body = (await response.json()) as ApiEnvelope<T> | T;
      // A API embrulha em { success, data }. Devolvemos `data` quando presente.
      if (body && typeof body === 'object' && 'data' in (body as ApiEnvelope<T>)) {
        return (body as ApiEnvelope<T>).data as T;
      }
      return body as T;
    }

    throw new Error(`GET ${path} falhou apos reautenticacao`);
  }
}
