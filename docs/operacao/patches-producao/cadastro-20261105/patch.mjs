// tira o index.js do multipart baixado do worker no ar e exige os campos do totem dos outros pilotos
import { readFileSync, writeFileSync } from 'node:fs';
const raw = readFileSync('script.raw', 'latin1');
const fronteira = raw.split('\r\n')[0];
const partes = raw.split(fronteira).filter((p) => p.includes('Content-Disposition'));
if (partes.length !== 1) throw new Error('esperava 1 parte, veio ' + partes.length);
let js = Buffer.from(partes[0].slice(partes[0].indexOf('\r\n\r\n') + 4).replace(/\r\n--\s*$/, '').replace(/\r\n$/, ''), 'latin1').toString('utf8');
const velho = `    const instagram = String(a?.instagram ?? "").trim();
    if (instagram && erroInstagramCliente(instagram)) return { ok: false, erro: \`Instagram inv\\xE1lido do piloto \${n} (\${nome}). Informe o @usu\\xE1rio (ex.: @andre.silva) ou deixe em branco.\` };
    acompanhantes.push({ nome, documento, nascimento, ...instagram ? { instagram: normalizarInstagram(instagram) } : {} });`;
const novo = `    // os mesmos campos obrigatórios do totem para cada piloto (antes só nome/CPF/nascimento chegavam ao kartódromo)
    const quem = \`do piloto \${n} (\${nome})\`;
    const instagram = String(a?.instagram ?? "").trim();
    if (!instagram) return { ok: false, erro: \`Informe o Instagram \${quem}.\` };
    if (erroInstagramCliente(instagram)) return { ok: false, erro: \`Instagram inválido \${quem}. Informe o @usuário (ex.: @andre.silva).\` };
    const email = txt(a?.email, 120).toLowerCase();
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(email)) return { ok: false, erro: \`Informe um e-mail válido \${quem}.\` };
    const telefone = digitos(a?.telefone);
    if (telefone.length < 10 || telefone.length > 13) return { ok: false, erro: \`Informe o celular com DDD \${quem}.\` };
    const peso = txt(a?.peso, 6).replace(",", ".");
    if (!(Number(peso) >= 20 && Number(peso) <= 250)) return { ok: false, erro: \`Informe o peso \${quem} (entre 20 e 250 kg).\` };
    const endereco = txt(a?.endereco, 150);
    if (!endereco) return { ok: false, erro: \`Informe o endereço (rua e número) \${quem}.\` };
    const bairro = txt(a?.bairro, 80);
    if (!bairro) return { ok: false, erro: \`Informe o bairro \${quem}.\` };
    const cidade = txt(a?.cidade, 80);
    if (!cidade) return { ok: false, erro: \`Informe a cidade \${quem}.\` };
    acompanhantes.push({ nome, documento, nascimento, instagram: normalizarInstagram(instagram), email, telefone, peso,
      cep: digitos(a?.cep).slice(0, 8), endereco, complemento: txt(a?.complemento, 80), bairro, cidade });`;
if (!js.includes(velho)) throw new Error('trecho não encontrado');
js = js.replace(velho, novo);
for (const f of ['var txt =', 'var digitos =', 'function erroInstagramCliente']) if (!js.includes(f)) throw new Error('falta ' + f);
writeFileSync('index.js', js);
console.log('ok', js.length);

