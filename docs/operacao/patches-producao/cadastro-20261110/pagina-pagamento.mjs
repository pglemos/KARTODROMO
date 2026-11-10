// pagina-base.html (a página que estava no ar em 10/11/2026) + etapa de pagamento no link do grupo (?r=)
import { readFileSync, writeFileSync } from 'node:fs';
let h = readFileSync('pagina-base.html', 'utf8');
const troca = (de, para) => { if (!h.includes(de)) throw new Error('não achei: ' + de.slice(0, 80)); h = h.replace(de, para); };

troca('</style>', `  .pagar { margin: 16px auto 18px; max-width: 460px; padding: 16px 18px; border: 1px solid var(--verde); border-radius: var(--raio); background: var(--verde-fundo); text-align: left; }
  .pagar[hidden] { display: none; }
  .pagar p { margin: 0 0 10px; color: var(--texto); }
  .pagar b { color: var(--verde); }
  .pagar .valor { font: 400 38px/1.1 var(--titulo); color: var(--texto); }
  .pagar a.botao { display: block; text-align: center; padding: 15px 18px; background: var(--verde); color: var(--tinta); font: 400 20px/1.1 var(--titulo); text-transform: uppercase; text-decoration: none; border-radius: var(--raio); }
  .pagar .estado { margin: 10px 0 0; font-size: 15px; color: var(--suave); }
</style>`);

troca('<span>Preencha seus dados completos. Sua vaga será confirmada e o termo de responsabilidade sairá impresso com todos os dados na recepção.</span>',
      '<span id="grupoTexto">Preencha seus dados completos. Sua vaga será confirmada e o termo de responsabilidade sairá impresso com todos os dados na recepção.</span>');

troca('<p id="prontoSub">Seu cadastro foi recebido.</p>', '<p id="prontoSub">Seu cadastro foi recebido.</p>\n    <div class="pagar" id="pagarCaixa" hidden></div>');

troca(`    if (banner) banner.style.display = 'flex';
  }`, `    if (banner) banner.style.display = 'flex';
  }
  const esc = (s) => String(s ?? '').replace(/[<>&"]/g, '');
  const brl = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const quando = (s) => { const d = new Date(String(s).slice(0, 16) + ':00-03:00'); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }) + ' às ' + String(s).slice(11, 16); };
  let grupo = null;
  if (tokenReserva) fetch('/api/grupo?r=' + encodeURIComponent(tokenReserva)).then((r) => r.ok ? r.json() : null).then((g) => {
    if (!g || !g.responsavel) return;
    grupo = g;
    const paga = g.aCobrarCentavos > 0;
    const t = $('grupoTexto');
    if (t) t.innerHTML = 'Grupo do(a) <b>' + esc(g.responsavel) + '</b> · ' + esc(g.bateria || 'Bateria') + ' · ' + quando(g.inicio) + '. ' +
      (g.souResponsavel && paga ? 'Você é o responsável: preencha o seu cadastro e, no final, pague ' + (g.modo === 'sinal' ? 'o sinal' : 'o grupo todo') + ' (<b>' + brl(g.aCobrarCentavos) + '</b>) por Pix ou cartão. Os convidados só preenchem o cadastro.'
        : g.souResponsavel ? 'Você é o responsável e o pagamento do grupo já está em dia. Preencha o seu cadastro completo.'
        : paga ? 'Preencha seu cadastro completo e, no final, pague a sua vaga (<b>' + brl(g.aCobrarCentavos) + '</b>) por Pix ou cartão.'
        : g.modo !== 'individual' ? 'O pagamento é feito pelo responsável do grupo. Você só precisa preencher o seu cadastro completo.'
        : g.livres <= 0 ? 'Todas as vagas do grupo já têm dono. Faça o cadastro e fale com quem reservou.'
        : 'Preencha seus dados completos. Sua vaga já está reservada e o termo de responsabilidade sairá impresso na recepção.');
  }).catch(() => {});
  const mostrarPagamento = (pg, g) => {
    const c = $('pagarCaixa');
    const quem = g && g.responsavel ? ' no grupo do(a) <b>' + esc(g.responsavel) + '</b>' : '';
    const oQue = grupo && grupo.souResponsavel ? (grupo.modo === 'sinal' ? 'o sinal do grupo' : 'o grupo todo') : 'a sua vaga';
    if (pg.pago) { c.innerHTML = '<p><b>Pagamento confirmado!</b> Sua vaga' + quem + ' está garantida.</p>'; c.hidden = false; return; }
    c.innerHTML = '<p>Falta pagar ' + oQue + quem + ':</p><p class="valor">' + brl(pg.valorCentavos) + '</p>' +
      '<a class="botao" href="' + encodeURI(pg.link) + '" target="_blank" rel="noopener">Pagar agora · Pix ou cartão</a>' +
      '<p class="estado" id="pagarEstado">Depois de pagar, esta tela confirma sozinha.</p>';
    c.hidden = false;
    const t = setInterval(async () => {
      try {
        const s = await (await fetch('/api/grupo/pagamento?id=' + encodeURIComponent(pg.id))).json();
        if (s.pago) { clearInterval(t); c.innerHTML = '<p><b>Pagamento confirmado!</b> Sua vaga' + quem + ' está garantida. No kartódromo, é só digitar seu CPF no totem.</p>'; }
      } catch {}
    }, 6000);
  };`);

troca(`    if (!$('lgpd').checked)`, `    if (grupo && grupo.aCobrarCentavos > 0 && tipo !== 'CPF') return erro('Para pagar pelo link do grupo, use o CPF.', doc);
    if (!$('lgpd').checked)`);

troca(`      if (tokenReserva) {
        $('prontoSub').textContent = 'Seu cadastro foi recebido e vinculado à sua reserva em grupo.';`, `      if (j.pagamento) mostrarPagamento(j.pagamento, j.grupo);
      if (tokenReserva) {
        $('prontoSub').textContent = j.pagamento && !j.pagamento.pago ? 'Seu cadastro foi recebido. Falta só pagar a sua vaga para garanti-la.' : 'Seu cadastro foi recebido e vinculado à sua reserva em grupo.';`);
troca(`3. Sua vaga está garantida e seu termo sairá completo na recepção!';`, `3. ' + (j.pagamento && !j.pagamento.pago ? 'Pague a sua vaga acima para garanti-la; o termo sairá completo na recepção.' : 'Sua vaga está garantida e seu termo sairá completo na recepção!');`);
writeFileSync('pagina-grupo.html', h);
console.log('ok', h.length);
