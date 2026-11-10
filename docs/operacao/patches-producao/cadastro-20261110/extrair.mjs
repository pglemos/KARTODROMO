// tira o index.js do multipart baixado do worker no ar (script.raw) sem mexer em mais nada
import { readFileSync, writeFileSync } from 'node:fs';
const raw = readFileSync('script.raw', 'latin1');
const fronteira = raw.split('\r\n')[0];
const partes = raw.split(fronteira).filter((p) => p.includes('Content-Disposition'));
if (partes.length !== 1) throw new Error('esperava 1 parte, veio ' + partes.length);
const js = Buffer.from(partes[0].slice(partes[0].indexOf('\r\n\r\n') + 4).replace(/\r\n--\s*$/, '').replace(/\r\n$/, ''), 'latin1').toString('utf8');
writeFileSync('index.js', js);
console.log('ok', js.length);
