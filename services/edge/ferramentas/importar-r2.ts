/**
 * Copia buckets do R2 (API S3 da Cloudflare) para o formato de disco do kart-edge, mantendo content-type, metadados e
 * data de envio. Incremental: pula o que já tem o mesmo tamanho e etag, então dá para rodar de novo logo antes da virada.
 * Uso: R2_ENDPOINT=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... npx tsx services/edge/ferramentas/importar-r2.ts <pasta-r2> <bucket>...
 */
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { join } from 'node:path';
import { R2Bucket } from '../src/r2';

const [pasta, ...nomes] = process.argv.slice(2);
const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
});

for (const nome of nomes) {
  const destino = new R2Bucket(join(pasta, nome));
  let token: string | undefined;
  let total = 0, novos = 0, bytes = 0;
  do {
    const pagina = await s3.send(new ListObjectsV2Command({ Bucket: nome, ContinuationToken: token }));
    const lista = pagina.Contents ?? [];
    total += lista.length;
    // 8 downloads em paralelo por página (até 1000 chaves)
    let i = 0;
    await Promise.all(Array.from({ length: 8 }, async () => { while (i < lista.length) { const o = lista[i++]; await copiar(o); } }));
    token = pagina.IsTruncated ? pagina.NextContinuationToken : undefined;
  } while (token);
  console.log(`${nome}: ${total} objetos, ${novos} copiados agora (${(bytes / 1048576).toFixed(1)} MB)`);

  async function copiar(o: { Key?: string; Size?: number; ETag?: string; LastModified?: Date }) {
    {
      const ja = await destino.head(o.Key!);
      const etag = (o.ETag ?? '').replace(/"/g, '');
      if (ja && ja.size === o.Size && ja.etag === etag) return;
      const g = await s3.send(new GetObjectCommand({ Bucket: nome, Key: o.Key! }));
      const corpo = await g.Body!.transformToByteArray();
      await destino.put(o.Key!, corpo, {
        httpMetadata: {
          contentType: g.ContentType, contentDisposition: g.ContentDisposition, contentEncoding: g.ContentEncoding,
          contentLanguage: g.ContentLanguage, cacheControl: g.CacheControl,
        },
        customMetadata: g.Metadata && Object.keys(g.Metadata).length ? g.Metadata : undefined,
        uploaded: o.LastModified,
      });
      novos++;
      bytes += corpo.byteLength;
    }
  }
}
