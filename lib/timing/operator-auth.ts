import { timingSafeEqual } from 'node:crypto';

/** Compara a chave de operador sem depender de comparação textual de duração variável. */
export function chaveOperadorValida(recebida: unknown, esperada: string | undefined): boolean {
  if (typeof recebida !== 'string' || !esperada) return false;
  const a = Buffer.from(recebida, 'utf8');
  const b = Buffer.from(esperada, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

function normalizarIp(ip: string): string {
  return ip.replace(/^::ffff:/i, '').split('%')[0];
}

/** Aceita o cliente desktop local somente quando a origem TCP e o nome da máquina coincidem com o servidor. */
export function clienteEhMaquinaOperadora(ipRemoto: string, cabecalhoMaquina: unknown, nomeMaquina: string | undefined, ipsLocais: Iterable<string>): boolean {
  if (!nomeMaquina || typeof cabecalhoMaquina !== 'string' || cabecalhoMaquina.toLowerCase() !== nomeMaquina.toLowerCase()) return false;
  const ip = normalizarIp(ipRemoto);
  return [...ipsLocais].some((local) => normalizarIp(local) === ip);
}
