/**
 * App do cliente: vínculo automático da conta do app com o cadastro da recepção (SRVKART).
 * O resultado pessoal (e a carreira) do app só aparece com esse vínculo. Antes era só a recepção, à mão
 * (botão "App" na ficha do cliente); agora, a cada minuto, o servidor pede ao Worker as contas com e-mail confirmado
 * ainda sem vínculo e procura o cliente pelo CPF. Só vincula se o e-mail OU o telefone da conta também forem os do
 * cadastro — CPF sozinho não basta (qualquer um digita o CPF de outra pessoa). O que não bater continua manual.
 * Env: MOBILE_IDENTITY_LINK_URL (…/api/mobile/v1/internal/identity-links) e MOBILE_ADMIN_TOKEN.
 */
import { mobileApiEndpoint } from '../mobile-api-url';
import { onlyDigits, query } from './db';

type Log = (...args: unknown[]) => void;
type Candidata = { email: string; cpf: string; phone: string };

const INTERVALO_MS = 60_000;
/** conta que não bateu com nenhum cadastro: tenta de novo depois (a recepção pode corrigir o cadastro) */
const ESPERA_SEM_CADASTRO_MS = 30 * 60_000;
let ultimaVez = 0;
const semCadastro = new Map<string, number>();

export function vinculoAutomaticoLigado() {
  return Boolean(process.env.MOBILE_IDENTITY_LINK_URL && process.env.MOBILE_ADMIN_TOKEN);
}

/** Mesmo telefone: compara os últimos 10 dígitos (DDD + número, com ou sem o 9 e o +55). */
export function mesmoTelefone(a: string, b: string) {
  const x = onlyDigits(a).replace(/^55(?=\d{10,11}$)/, '');
  const y = onlyDigits(b).replace(/^55(?=\d{10,11}$)/, '');
  if (x.length < 10 || y.length < 10) return false;
  const fim = (s: string) => (s.length === 11 && s[2] === '9' ? s.slice(0, 2) + s.slice(3) : s).slice(-10);
  return fim(x) === fim(y);
}

/** Cliente da recepção que é dono desta conta: mesmo CPF e (mesmo e-mail ou mesmo telefone). */
export async function clienteDaConta(c: Candidata) {
  const cpf = onlyDigits(c.cpf);
  if (cpf.length !== 11) return null;
  const linhas = await query<{ id: number; email: string | null; telefone: string | null }>(
    `SELECT TOP 10 Id id, Email email, Telefone telefone FROM dbo.Cliente
      WHERE (DocumentoNum = @doc OR Documento = @doc) AND ResponsavelId IS NULL ORDER BY AtualizadoEm DESC`,
    { doc: cpf },
  );
  const email = c.email.trim().toLowerCase();
  const dono = linhas.find((l) => (email && String(l.email ?? '').trim().toLowerCase() === email) || mesmoTelefone(String(l.telefone ?? ''), c.phone));
  return dono?.id ?? null;
}

/** Roda junto com o ciclo da reserva online (5 s), mas só uma vez por minuto. Devolve quantas contas vinculou. */
export async function vincularContasDoApp(log: Log, agora = Date.now()) {
  if (!vinculoAutomaticoLigado() || agora - ultimaVez < INTERVALO_MS) return 0;
  ultimaVez = agora;
  const destino = process.env.MOBILE_IDENTITY_LINK_URL!;
  const token = process.env.MOBILE_ADMIN_TOKEN!;
  const vincular = mobileApiEndpoint(destino, '/api/mobile/v1/internal/identity-links');
  if (!vincular) return 0;
  const listar = new URL('/api/mobile/v1/internal/identity-candidates', vincular);
  const r = await fetch(listar, { headers: { 'x-mobile-admin-token': token }, redirect: 'error', signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`contas do app: HTTP ${r.status}`);
  const contas = (await r.json()) as Candidata[];
  let feitos = 0;
  for (const conta of contas) {
    const chave = onlyDigits(conta.cpf) + '|' + conta.email.trim().toLowerCase();
    if ((semCadastro.get(chave) ?? 0) > agora) continue;
    const clienteId = await clienteDaConta(conta);
    if (!clienteId) { semCadastro.set(chave, agora + ESPERA_SEM_CADASTRO_MS); continue; }
    const v = await fetch(vincular, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mobile-admin-token': token },
      body: JSON.stringify({ customerId: String(clienteId), email: conta.email.trim().toLowerCase() }),
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    if (v.ok) { feitos++; log(`app: conta vinculada ao cliente ${clienteId} (CPF e e-mail ou telefone conferidos)`); continue; }
    // 409 = o cliente já tem outra conta do app: fica para a recepção decidir
    semCadastro.set(chave, agora + ESPERA_SEM_CADASTRO_MS);
    if (v.status === 409) log(`app: cliente ${clienteId} já tem outra conta do app vinculada; ficou para a recepção`);
  }
  return feitos;
}
