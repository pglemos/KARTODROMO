const base = 'https://reservas.kartodromodebetim.com.br';
const ag = await (await fetch(base + '/api/agenda')).json().catch(() => null);
const h = ag?.horarios?.find((x) => x.livres >= 2);
console.log('horarios', ag?.horarios?.length, h?.id, h?.inicio);
const cpf = (b) => { const d = b.split('').map(Number); for (const n of [9, 10]) { let s = 0; for (let i = 0; i < n; i++) s += d[i] * (n + 1 - i); d.push((s * 10) % 11 % 10); } return d.join(''); };
const corpo = {
  nome: 'Teste Validacao Sistema', documento: cpf('529982247'), nascimento: '1990-01-01', email: 'teste.validacao@example.com', telefone: '31999990000',
  peso: '80', endereco: 'Rua Teste 1', bairro: 'Centro', cidade: 'Betim', instagram: '@teste.validacao', cep: '',
  bateriaId: h?.id, quantidade: 2, compradorPilota: true, forma: 'pix', politica: true, lgpd: true, site: '', t: Date.now() - 60000,
  acompanhantes: [{ nome: 'Outro Piloto Teste', documento: cpf('111444777'), nascimento: '1995-02-02' }],
};
const r = await fetch(base + '/api/reservas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
console.log(r.status, (await r.text()).slice(0, 300));
