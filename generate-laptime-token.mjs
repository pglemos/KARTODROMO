// Generate LapTime API token using the Sisecom temporal auth scheme
import crypto from 'node:crypto';
import sql from 'mssql';

const ENCRYPTION_KEY = 'CKkBDem3PEMe4dfFfe1pfYrNCPQEUZMWd4dPYHSjw2D8F4b2wW+hDKHB3n0F/w3YkXGoDdACrs5OAhE5pwqWWDBZSrYh0LopgJG9RgI9Y0k';
const SALT = Buffer.from('Ivan Medvedev', 'utf8');
const PBKDF2_ITERATIONS = 2121;
const WORDS_OF_MONTH = [
  '5MNTl3rnD', 'JLPBEE1uC', 'Y95fdk72I', 'tDCGHwKAq', 'SSCxI5hmT', '2JLxtQoPZ', '8Ft3Fh1eQ',
  'KnX6RJzkk', 'u26EPPCF1', 'SuQ804cxz', 'MWpGnt8m0', 'eKmspBo7d', 'H2cREYj7l', 'o1Z4Yg8hG',
  'XB2dEJopp', 'DIuCBM4UY', 'uiZtFQYUM', 'cJUkLrW5J', 'i2ycoeE3f', 'I1OsTrbDI', 'Uje4prU2e',
  'NHPG5XrJP', 'LynBd3xXk', '9GI5KHqX7', 'nuAQmb5io', 'Pua6tuCPs', 'PlYXXgI7Y', '34SjsnnZk',
  '5Ifm2AEPz', 'OafTLdOth', 'rNi3BxXZ1',
];
const UNIX_EPOCH_TICKS = 621355968000000000n;

const derivedKeyMaterial = crypto.pbkdf2Sync(Buffer.from(ENCRYPTION_KEY, 'utf8'), SALT, PBKDF2_ITERATIONS, 48, 'sha512');
const AES_KEY = derivedKeyMaterial.subarray(0, 32);
const AES_IV = derivedKeyMaterial.subarray(32, 48);

function encryptString(input) {
  const cipher = crypto.createCipheriv('aes-256-cbc', AES_KEY, AES_IV);
  const plaintext = Buffer.from(input, 'utf16le');
  return Buffer.concat([cipher.update(plaintext), cipher.final()]).toString('base64');
}

function ticksFromUtcMillis(millis) {
  return UNIX_EPOCH_TICKS + BigInt(millis) * 10000n;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function buildAuthKey(origin, serverNowUtc) {
  const year = serverNowUtc.getUTCFullYear();
  const monthIndex = serverNowUtc.getUTCMonth();
  const day = serverNowUtc.getUTCDate();
  const stamp = `${year}${pad2(monthIndex + 1)}${pad2(day)}${pad2(serverNowUtc.getUTCHours())}${pad2(serverNowUtc.getUTCMinutes())}`;
  const midnightMillis = Date.UTC(year, monthIndex, day);
  const additionalWord = ticksFromUtcMillis(midnightMillis).toString();
  const wordOfMonth = WORDS_OF_MONTH[day - 1];
  return encryptString(origin + stamp + additionalWord + wordOfMonth);
}

async function main() {
  // 1. Get server UTC time from CRONO1 SQL
  console.log('Connecting to CRONO1 SQL...');
  const pool = await sql.connect({
    server: '192.168.20.254',
    port: 52871,
    database: 'LapTime',
    user: 'LapTimeSql',
    password: 'XrO8mjlPnrpotc8y',
    options: { encrypt: false, trustServerCertificate: true },
    connectionTimeout: 10000,
  });

  const result = await pool.request().query('SELECT GETUTCDATE() AS utcNow');
  const serverUtc = new Date(result.recordset[0].utcNow);
  console.log('Server UTC time:', serverUtc.toISOString());
  await pool.close();

  // 2. Build auth key
  const origin = 'LapTimeMirror';
  const pKey = buildAuthKey(origin, serverUtc);
  console.log('Auth key built');

  // 3. Authenticate
  const authUrl = 'http://192.168.20.254/laptime/api/Security/Authenticate';
  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      pOrigin: origin,
      pKey,
      'content-type': 'application/json',
    },
    body: '',
  });

  if (!response.ok) {
    throw new Error(`Authenticate failed: HTTP ${response.status}`);
  }

  const body = await response.json();
  if (!body.token) {
    throw new Error('No token returned');
  }

  console.log('Token obtained! Length:', body.token.length);
  console.log('Expiration:', body.expiration);

  // 4. Save token
  const { writeFileSync, mkdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const runtimeDir = join(process.cwd(), '.runtime');
  mkdirSync(runtimeDir, { recursive: true });
  const tokenPath = join(runtimeDir, 'laptime-api-token.txt');
  writeFileSync(tokenPath, body.token, 'utf8');
  console.log('Token saved to:', tokenPath);

  // 5. Verify token works
  const testResponse = await fetch('http://192.168.20.254/laptime/api/Racing/getByState/5?qtd=1', {
    headers: { Authorization: `Bearer ${body.token}` },
  });
  const testData = await testResponse.json();
  console.log('Test API call status:', testResponse.status);
  console.log('Racing data:', JSON.stringify(testData).substring(0, 200));
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
