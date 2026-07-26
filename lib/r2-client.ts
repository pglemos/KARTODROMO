import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET_NAME;

export function hasR2Store(): boolean {
  return Boolean(accountId && accessKeyId && secretAccessKey && bucket);
}

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
    });
  }
  return client;
}

export async function getR2Json<T>(key: string): Promise<T | null> {
  if (!hasR2Store()) return null;

  try {
    const res = await getClient().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const text = await res.Body!.transformToString();
    return JSON.parse(text) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'NoSuchKey') return null;
    throw error;
  }
}

export async function putR2Json(key: string, value: unknown): Promise<void> {
  if (!hasR2Store()) throw new Error('R2 not configured');

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: `${JSON.stringify(value, null, 2)}\n`,
      ContentType: 'application/json',
    })
  );
}
