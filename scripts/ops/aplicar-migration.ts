/** Aplica uma migration do KartodromoOps (lotes separados por GO). Uso: npx tsx scripts/ops/aplicar-migration.ts migrations/ops/0014_endurance.sql */
import { readFileSync } from 'node:fs';
import { getPool } from '../../lib/ops/db';

const arquivo = process.argv[2];
if (!arquivo) { console.error('Informe o arquivo .sql'); process.exit(1); }
const pool = await getPool();
for (const lote of readFileSync(arquivo, 'utf8').split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)) await pool.request().batch(lote);
console.log(`ok: ${arquivo}`);
await pool.close();
