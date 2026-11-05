#!/usr/bin/env node
// Define o Grupo do Google como testador das faixas do Play (rodar uma vez).
// Uso: GOOGLE_SA_JSON_PATH=chave.json node scripts/play-grupo-testadores.mjs
// Exige: conta de serviço convidada no Play Console com permissão de gerir testes.
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const GRUPO = process.env.GRUPO_TESTADORES ?? 'testadores-kartodromobetim@googlegroups.com';
const ALVOS = [
  // Faixa interna não aceita grupo via API; usar a fechada (Alpha).
  { pacote: 'br.com.kartodromobetim.app', faixa: 'alpha' },
  { pacote: 'br.com.kartodromobetim.operacional', faixa: 'alpha' },
];
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';

const conta = JSON.parse(readFileSync(process.env.GOOGLE_SA_JSON_PATH, 'utf8'));
const b64 = (s) => Buffer.from(s).toString('base64url');

async function token() {
  const iat = Math.floor(Date.now() / 1000);
  const base = `${b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64(
    JSON.stringify({
      iss: conta.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat,
      exp: iat + 3600,
    }),
  )}`;
  const sig = createSign('RSA-SHA256').update(base).sign(conta.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${base}.${sig}`,
    }),
  });
  if (!r.ok) throw new Error(`token ${r.status}: ${await r.text()}`);
  return (await r.json()).access_token;
}

const t = await token();
const h = { authorization: `Bearer ${t}`, 'content-type': 'application/json' };
for (const { pacote, faixa } of ALVOS) {
  const edit = await (await fetch(`${API}/${pacote}/edits`, { method: 'POST', headers: h })).json();
  if (!edit.id) throw new Error(`${pacote}: ${JSON.stringify(edit)}`);
  const atual = await (await fetch(`${API}/${pacote}/edits/${edit.id}/testers/${faixa}`, { headers: h })).json();
  const grupos = [...new Set([...(atual.googleGroups ?? []), GRUPO])];
  const up = await fetch(`${API}/${pacote}/edits/${edit.id}/testers/${faixa}`, {
    method: 'PUT',
    headers: h,
    body: JSON.stringify({ googleGroups: grupos }),
  });
  if (!up.ok) throw new Error(`${pacote} testers: ${up.status} ${await up.text()}`);
  const c = await fetch(`${API}/${pacote}/edits/${edit.id}:commit`, { method: 'POST', headers: h });
  if (!c.ok) throw new Error(`${pacote} commit: ${c.status} ${await c.text()}`);
  console.log(`OK ${pacote} (${faixa}) → ${grupos.join(', ')}`);
}
