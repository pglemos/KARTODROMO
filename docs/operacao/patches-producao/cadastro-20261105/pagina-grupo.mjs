// página de pré-cadastro: todos os campos obrigatórios + link único do grupo (?r=) com pagamento Asaas no fim
import { readFileSync, writeFileSync } from 'node:fs';
let h = readFileSync('pagina.html', 'utf8');
const troca = (de, para) => { if (!h.includes(de)) throw new Error('não achei: ' + de.slice(0, 80)); h = h.replace(de, para); };

// rótulos: nada mais é opcional, só complemento e CEP
troca('E-mail <span class="op">(para receber o resultado da corrida)</span>', 'E-mail <span class="op">(recebe o resultado da corrida)</span>');
troca('Peso (kg) <span class="op">(opcional)</span>', 'Peso (kg) <span class="op">(equilibra os karts)</span>');
troca('<h2><span class="n">4</span>Endereço <span class="op">(opcional)</span></h2>', '<h2><span class="n">4</span>Endereço</h2>');
h = h.replace(/<p class="sub">Pode pular\.[^<]*<\/p>/, '<p class="sub">Digite o CEP e o resto se preenche sozinho.</p>');

// faixa do grupo (aparece só com ?r=) e caixa de pagamento
troca('<form id="form" novalidate autocomplete="on">', `<section class="cartao grupo" id="grupoFaixa" hidden aria-live="polite"></section>
  <form id="form" novalidate autocomplete="on">`);
troca('<h2 id="prontoTitulo">Tudo certo!</h2>', `<h2 id="prontoTitulo">Tudo certo!</h2>
    <div class="pagar" id="pagarCaixa" hidden></div>`);
troca('</style>', `  .grupo { border-color: var(--verde); background: var(--verde-fundo); }
  .grupo h2 { margin: 0 0 6px; font-family: var(--titulo); font-weight: 400; letter-spacing: .02em; font-size: 26px; line-height: 1.15; }
  .grupo p { margin: 0; color: var(--suave); }
  .grupo b, .pagar b { color: var(--verde); }
  .pagar { margin: 14px 0 18px; padding: 16px 18px; border: 1px solid var(--verde); border-radius: var(--raio); background: var(--verde-fundo); text-align: left; }
  .pagar p { margin: 0 0 10px; }
  .pagar .valor { font-family: var(--titulo); font-size: 34px; color: var(--texto); line-height: 1.1; }
  .pagar a.botao { display: block; text-align: center; padding: 14px 18px; background: var(--verde); color: var(--tinta); font-weight: 700; font-size: 19px; text-decoration: none; border-radius: var(--raio); }
  .pagar .estado { margin: 10px 0 0; font-size: 15px; color: var(--suave); }
</style>`);

// script: grupo, obrigatórios, envio com o código e pagamento
troca("  let tipo = 'CPF';", `  let tipo = 'CPF';
  const reserva = /^[A-Za-z0-9]{10,24}$/.test(new URLSearchParams(location.search).get('r') || '') ? new URLSearchParams(location.search).get('r') : '';
  const brl = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const quando = (s) => { const d = new Date(String(s).slice(0, 16) + ':00-03:00'); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }) + ' às ' + String(s).slice(11, 16); };
  let grupo = null;
  if (reserva) fetch('/api/grupo?r=' + reserva).then((r) => r.ok ? r.json() : null).then((g) => {
    if (!g || !g.responsavel) return;
    grupo = g;
    const f = $('grupoFaixa');
    const paga = g.modo === 'individual' && g.precoCentavos > 0;
    f.innerHTML = '<h2>Grupo do(a) ' + g.responsavel.replace(/[<>&]/g, '') + '</h2><p>' + (g.bateria || 'Bateria').replace(/[<>&]/g, '') + ' · ' + quando(g.inicio) + '. ' +
      (g.livres > 0 ? (paga ? 'Preencha seu cadastro completo e, no final, pague a sua vaga (<b>' + brl(g.precoCentavos) + '</b>) por Pix ou cartão.' : 'Preencha seu cadastro completo: sua vaga no grupo já fica no seu nome.')
        : 'Todas as vagas do grupo já têm dono. Faça o cadastro e fale com quem reservou.') + '</p>';
    f.hidden = false;
  }).catch(() => {});`);
troca("    if (!iso(nasc.value)) return erro('Informe a data de nascimento (DD/MM/AAAA).', nasc);", `    if (!iso(nasc.value)) return erro('Informe a data de nascimento (DD/MM/AAAA).', nasc);
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(email.value.trim())) return erro('Informe seu e-mail.', email);
    const kg = Number($('peso').value.replace(',', '.'));
    if (!(kg >= 20 && kg <= 250)) return erro('Informe seu peso em kg (entre 20 e 250).', $('peso'));
    if (!$('endereco').value.trim()) return erro('Informe a rua do seu endereço.', $('endereco'));
    if (!$('numero').value.trim()) return erro('Informe o número do endereço.', $('numero'));
    if (!$('bairro').value.trim()) return erro('Informe o bairro.', $('bairro'));
    if (!$('cidade').value.trim()) return erro('Informe a cidade.', $('cidade'));
    if (reserva && grupo && grupo.modo === 'individual' && tipo !== 'CPF') return erro('Para pagar a vaga pelo link do grupo, use o CPF.', doc);`);
troca('menores: menores.map(({ el, ...m }) => m), lgpd: true,', 'menores: menores.map(({ el, ...m }) => m), lgpd: true, reserva,');
troca("      $('pronto').style.display = 'block';", `      $('pronto').style.display = 'block';
      if (j.pagamento) mostrarPagamento(j.pagamento, j.grupo);`);
troca('  $(\'form\').addEventListener(\'submit\', async (ev) => {', `  function mostrarPagamento(pg, g) {
    const c = $('pagarCaixa');
    const quem = g && g.responsavel ? ' no grupo do(a) <b>' + g.responsavel.replace(/[<>&]/g, '') + '</b>' : '';
    if (pg.pago) { c.innerHTML = '<p><b>Pagamento confirmado!</b> Sua vaga' + quem + ' está garantida.</p>'; c.hidden = false; return; }
    c.innerHTML = '<p>Falta pagar a sua vaga' + quem + ':</p><p class="valor">' + brl(pg.valorCentavos) + '</p>' +
      '<a class="botao" href="' + encodeURI(pg.link) + '" target="_blank" rel="noopener">Pagar agora · Pix ou cartão</a>' +
      '<p class="estado" id="pagarEstado">Depois de pagar, esta tela confirma sozinha.</p>';
    c.hidden = false;
    const t = setInterval(async () => {
      try {
        const s = await (await fetch('/api/grupo/pagamento?id=' + encodeURIComponent(pg.id))).json();
        if (s.pago) { clearInterval(t); c.innerHTML = '<p><b>Pagamento confirmado!</b> Sua vaga' + quem + ' está garantida. No kartódromo, é só digitar seu CPF no totem.</p>'; }
      } catch {}
    }, 6000);
  }

  $('form').addEventListener('submit', async (ev) => {`);
writeFileSync('pagina-grupo.html', h);
console.log('ok', h.length);
