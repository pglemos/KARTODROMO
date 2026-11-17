/**
 * Foto que o piloto envia pelo app → banco do kartódromo (kart.cliente_foto), na hora.
 *
 * O servidor de cadastro (worker do app) chama PUT /api/app/foto/:cliente assim que a foto chega (e DELETE quando o
 * piloto tira). O app já recorta quadrado, reduz para 600 px e manda JPEG; aqui só gera a miniatura (160 px) e, se a
 * foto passar do teto do cadastro, reduz de novo. Daí em diante a Recepção, o CRM, a TV, o telão e o pódio leem do banco.
 * jpeg-js é JavaScript puro (sem binário nativo): roda no SRVKART sem instalar nada além da pasta do pacote.
 */
import jpeg from 'jpeg-js';
import { one, query } from './db';

export const FOTO_MAX = 400_000;
export const MINI_MAX = 40_000;

const ehJpeg = (b: Uint8Array) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/** Reduz um JPEG para o lado maior `lado` (média de blocos: limpa e barata) e devolve outro JPEG. */
export function reduzirJpeg(entrada: Uint8Array, lado: number, qualidade: number): Buffer {
  const img = jpeg.decode(entrada, { useTArray: true, maxMemoryUsageInMB: 256, maxResolutionInMP: 40 });
  const escala = Math.min(1, lado / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * escala));
  const h = Math.max(1, Math.round(img.height * escala));
  const out = new Uint8Array(w * h * 4);
  const fx = img.width / w, fy = img.height / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * fy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * fy));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * fx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * fx));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1 && yy < img.height; yy++) {
        for (let xx = x0; xx < x1 && xx < img.width; xx++) {
          const i = (yy * img.width + xx) * 4;
          r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++;
        }
      }
      const o = (y * w + x) * 4;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
    }
  }
  return Buffer.from(jpeg.encode({ data: out, width: w, height: h }, qualidade).data);
}

/** Foto principal (≤ 400 KB) e miniatura (≤ 40 KB) a partir do JPEG do app. */
export function fotoEMiniatura(bytes: Uint8Array): { foto: Buffer; mini: Buffer } {
  if (!ehJpeg(bytes)) throw new Error('A foto do app precisa ser JPEG.');
  let foto: Buffer = Buffer.from(bytes);
  for (const [lado, q] of [[720, 80], [600, 70], [480, 65]] as const) {
    if (foto.length <= FOTO_MAX) break;
    foto = reduzirJpeg(bytes, lado, q);
  }
  if (foto.length > FOTO_MAX) throw new Error('Foto grande demais.');
  let mini = reduzirJpeg(bytes, 160, 75);
  if (mini.length > MINI_MAX) mini = reduzirJpeg(bytes, 120, 60);
  return { foto, mini };
}

/** Grava (ou troca) a foto do cliente com a que veio do app. */
export async function gravarFotoDoApp(clienteId: number, bytes: Uint8Array): Promise<{ ok: true; bytes: number }> {
  if (!(await one(`select 1 x from kart.cliente where id = @id`, { id: clienteId }))) throw Object.assign(new Error('Cliente não encontrado.'), { status: 404 });
  const { foto, mini } = fotoEMiniatura(bytes);
  await query(
    `insert into kart.cliente_foto (cliente_id, foto, miniatura, tipo, atualizado_por) values (@id, @foto, @mini, 'image/jpeg', null)
     on conflict (cliente_id) do update set foto = excluded.foto, miniatura = excluded.miniatura, tipo = excluded.tipo, atualizado_por = null, atualizado_em = now()`,
    { id: clienteId, foto, mini },
  );
  return { ok: true, bytes: foto.length };
}

export async function apagarFotoDoApp(clienteId: number): Promise<void> {
  await query(`delete from kart.cliente_foto where cliente_id = @id`, { id: clienteId });
}

/** A foto do banco para quem mostra o piloto (TV, telão, pódio): bytes + tipo, ou null. */
export async function fotoDoBanco(clienteId: number, mini: boolean): Promise<{ bytes: Buffer; tipo: string } | null> {
  const f = await one<{ Foto: Buffer; Miniatura: Buffer; Tipo: string }>(`select foto "Foto", miniatura "Miniatura", tipo "Tipo" from kart.cliente_foto where cliente_id = @id`, { id: clienteId });
  if (!f) return null;
  return { bytes: Buffer.from(mini ? f.Miniatura : f.Foto), tipo: f.Tipo || 'image/jpeg' };
}
