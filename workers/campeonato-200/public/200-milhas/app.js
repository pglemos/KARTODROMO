'use strict';
/* Inscrição das 200 Milhas: formulário, busca do piloto (documento + nascimento), envio e página da inscrição. */
const $ = (s, el = document) => el.querySelector(s);
const API = '/200-milhas/api';
const VALOR = 280000, MAX_PILOTOS = 10, MIN_PILOTOS = 2;
const brl = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dig = (v) => String(v ?? '').replace(/\D/g, '');

async function chamar(caminho, corpo) {
  const r = await fetch(API + caminho, corpo ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) } : {});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Nosso sistema não respondeu agora. Tente de novo em instantes.');
  return j;
}
function mascarar(el) {
  const d = dig(el.value);
  if (el.dataset.mascara === 'cpf') el.value = d.slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  if (el.dataset.mascara === 'tel') el.value = d.slice(0, 11).replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4,5})(\d{4})$/, '$1-$2');
}
function cpfValido(v) {
  const c = dig(v);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (const n of [9, 10]) { let s = 0; for (let i = 0; i < n; i++) s += +c[i] * (n + 1 - i); if (((s * 10) % 11) % 10 !== +c[n]) return false; }
  return true;
}

// ---------------------------------------------------------------- formulário
const karts = () => Number($('#karts').value);
function htmlPiloto() {
  return `<div class="piloto">
    <div class="piloto-top"><b class="tit"></b><span><button type="button" class="mini" data-chefe>É o chefe de equipe</button> <button type="button" class="mini perigo" data-tirar>Remover</button></span></div>
    <div class="grade3c">
      <label class="campo">CPF<input data-c="cpf" inputmode="numeric" maxlength="14" autocomplete="off" placeholder="000.000.000-00" data-mascara="cpf"></label>
      <label class="campo">E-mail <small>(opcional)</small><input data-c="email" type="email" maxlength="200" autocomplete="off"></label>
      <label class="campo">Nascimento<input data-c="nascimento" type="date" autocomplete="off"></label>
    </div>
    <p class="achado" role="status"></p>
    <label class="campo">Nome completo<input data-c="nome" maxlength="150" autocomplete="off"></label>
    <div class="grade-peq">
      <label class="campo">Altura (m)<input data-c="altura" inputmode="decimal" maxlength="4" placeholder="1,75"></label>
      <label class="campo">Peso (kg)<input data-c="peso" inputmode="decimal" maxlength="6" placeholder="80"></label>
    </div>
    <input type="hidden" data-c="telefone">
  </div>`;
}
function montarKarts() {
  const caixa = $('#pilotos'), alvo = karts();
  while (caixa.children.length > alvo) caixa.lastElementChild.remove();
  while (caixa.children.length < alvo) {
    const k = caixa.children.length + 1;
    caixa.insertAdjacentHTML('beforeend', `<section class="kart" data-kart="${k}"><h3>Kart ${k} <small class="cont"></small></h3><div class="lista-p">${htmlPiloto()}${htmlPiloto()}</div><button type="button" class="mini" data-mais>Adicionar piloto</button></section>`);
  }
  atualizar();
}
function atualizar() {
  document.querySelectorAll('.kart').forEach((k) => {
    const ps = k.querySelectorAll('.piloto');
    ps.forEach((p, i) => { $('.tit', p).textContent = `Piloto ${i + 1}`; $('[data-tirar]', p).hidden = ps.length <= MIN_PILOTOS; });
    $('.cont', k).textContent = `${ps.length} pilotos`;
    $('[data-mais]', k).hidden = ps.length >= MAX_PILOTOS;
  });
  const total = karts() * VALOR;
  $('#rKarts').textContent = karts();
  $('#rPilotos').textContent = document.querySelectorAll('.piloto').length;
  $('#rTotal').textContent = brl(total);
  const parc = $('#parcelas'), atual = parc.value || '5';
  parc.innerHTML = [1, 2, 3, 4, 5].map((n) => `<option value="${n}">${n}x de ${brl(Math.round(total / n))} sem juros</option>`).join('');
  parc.value = atual;
  const cartao = $('[name=forma]:checked').value === 'cartao';
  $('#campoParcelas').hidden = !cartao;
  $('#rParcela').textContent = cartao ? `${parc.value}x de ${brl(Math.round(total / Number(parc.value)))} no cartão, sem juros` : 'À vista no Pix';
}

/** Busca automática quando há documento e nascimento completos. */
async function buscar(documento, nascimento, saida, aplicar) {
  if (!nascimento || !(cpfValido(documento) || documento.includes('@'))) return;
  saida.className = 'achado neutro'; saida.textContent = 'Procurando cadastro…';
  try {
    const r = await chamar('/piloto', { documento: documento.includes('@') ? documento : dig(documento), nascimento });
    if (r.encontrado) { aplicar(r); saida.className = 'achado'; saida.textContent = `Cadastro encontrado: ${r.nome}. Confira os dados.`; }
    else { saida.className = 'achado neutro'; saida.textContent = 'Não achamos esse cadastro. Sem problema: preencha abaixo.'; }
  } catch (e) { saida.className = 'achado neutro'; saida.textContent = e.message; }
}
const preencher = (el, v) => { if (el && v != null && v !== '' && !el.value.trim()) { el.value = v; if (el.dataset.mascara) mascarar(el); el.removeAttribute('aria-invalid'); } };
function buscarChefe() {
  const f = $('#form');
  buscar(f.chefeCpf.value, f.chefeNasc.value, $('#chefeAchado'), (r) => {
    preencher(f.chefeNome, r.nome); preencher(f.chefeTelefone, dig(r.telefone).replace(/^55(?=\d{10,11}$)/, '')); preencher(f.chefeEmail, r.email); preencher(f.cidade, r.cidade);
  });
}
function buscarPiloto(p) {
  const c = (n) => $(`[data-c=${n}]`, p);
  const doc = c('cpf').value.trim() || c('email').value.trim();
  buscar(doc, c('nascimento').value, $('.achado', p), (r) => {
    preencher(c('nome'), r.nome); preencher(c('cpf'), r.cpf); preencher(c('email'), r.email); preencher(c('telefone'), r.telefone);
    if (r.peso) preencher(c('peso'), String(r.peso).replace('.', ','));
  });
}
function usarChefe(p) {
  const f = $('#form'), c = (n) => $(`[data-c=${n}]`, p);
  c('cpf').value = f.chefeCpf.value; c('nascimento').value = f.chefeNasc.value; c('nome').value = f.chefeNome.value; c('email').value = f.chefeEmail.value; c('telefone').value = f.chefeTelefone.value;
  buscarPiloto(p);
}

function validar() {
  const f = $('#form'), erros = [];
  document.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
  const ruim = (el, msg) => { el.setAttribute('aria-invalid', 'true'); erros.push(msg); };
  if (f.equipe.value.trim().length < 2) ruim(f.equipe, 'Informe o nome da equipe.');
  if (!cpfValido(f.chefeCpf.value)) ruim(f.chefeCpf, 'Confira o CPF do chefe de equipe.');
  if (f.chefeNome.value.trim().split(/\s+/).length < 2) ruim(f.chefeNome, 'Informe nome e sobrenome do chefe de equipe.');
  if (dig(f.chefeTelefone.value).length < 10) ruim(f.chefeTelefone, 'Informe o WhatsApp com DDD.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.chefeEmail.value.trim())) ruim(f.chefeEmail, 'Confira o e-mail do chefe de equipe.');
  const cpfs = new Set();
  document.querySelectorAll('.kart').forEach((k) => k.querySelectorAll('.piloto').forEach((p, i) => {
    const c = (n) => $(`[data-c=${n}]`, p), rot = `Kart ${k.dataset.kart}, piloto ${i + 1}`;
    if (c('nome').value.trim().split(/\s+/).length < 2) ruim(c('nome'), `${rot}: informe nome e sobrenome.`);
    if (!cpfValido(c('cpf').value)) ruim(c('cpf'), `${rot}: confira o CPF.`);
    else if (cpfs.has(dig(c('cpf').value))) ruim(c('cpf'), `${rot}: este CPF já está em outro piloto.`);
    else cpfs.add(dig(c('cpf').value));
    const nasc = c('nascimento').value;
    if (!nasc) ruim(c('nascimento'), `${rot}: informe o nascimento.`);
    else if (nasc > '2015-01-30') ruim(c('nascimento'), `${rot}: a idade mínima é 12 anos na data da prova.`);
    if (!(Number(c('altura').value.replace(',', '.')) > 1.5)) ruim(c('altura'), `${rot}: a altura precisa ser maior que 1,50 m.`);
    if (!(Number(c('peso').value.replace(',', '.')) > 50)) ruim(c('peso'), `${rot}: o peso precisa ser maior que 50 kg.`);
  }));
  if (!f.aceiteRegulamento.checked) ruim(f.aceiteRegulamento, 'Aceite o regulamento para continuar.');
  if (!f.aceiteRequisitos.checked) ruim(f.aceiteRequisitos, 'Confirme os requisitos dos pilotos.');
  return erros;
}
function mostrarErros(lista) {
  const box = $('#erros');
  box.hidden = false;
  box.innerHTML = `<b>${lista.length === 1 ? 'Falta um ajuste' : `Faltam ${lista.length} ajustes`} para continuar</b><ul>${lista.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`;
  box.focus();
  box.scrollIntoView({ block: 'center' });
}
async function enviar(ev) {
  ev.preventDefault();
  const erros = validar();
  if (erros.length) return mostrarErros(erros);
  $('#erros').hidden = true;
  const f = $('#form'), botao = $('#enviar'), original = botao.textContent;
  const pilotos = [...document.querySelectorAll('.kart')].flatMap((k) => [...k.querySelectorAll('.piloto')].map((p) => {
    const c = (n) => $(`[data-c=${n}]`, p).value.trim();
    return { kart: Number(k.dataset.kart), nome: c('nome'), cpf: dig(c('cpf')), nascimento: c('nascimento'), email: c('email'), telefone: dig(c('telefone')), altura: c('altura'), peso: c('peso') };
  }));
  botao.disabled = true; botao.textContent = 'Registrando a inscrição…';
  try {
    const r = await chamar('/inscricoes', {
      site: f.site.value, equipe: f.equipe.value, chefeNome: f.chefeNome.value, chefeCpf: dig(f.chefeCpf.value), chefeTelefone: dig(f.chefeTelefone.value), chefeEmail: f.chefeEmail.value, cidade: f.cidade.value,
      karts: karts(), pilotos, forma: f.forma.value, parcelas: Number(f.parcelas.value), observacao: f.observacao.value, autorizaImagem: f.autorizaImagem.checked,
    });
    location.assign(`/200-milhas/inscricao/${r.token}`);
  } catch (e) {
    mostrarErros([e.message]);
    botao.disabled = false; botao.textContent = original;
  }
}

function iniciarFormulario() {
  const f = $('#form');
  montarKarts();
  f.addEventListener('input', (e) => { if (e.target.dataset.mascara) mascarar(e.target); if (e.target.getAttribute('aria-invalid')) e.target.removeAttribute('aria-invalid'); });
  f.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'karts') return montarKarts();
    if (t.name === 'forma' || t.id === 'parcelas') return atualizar();
    if (t.name === 'chefeCpf' || t.name === 'chefeNasc') return buscarChefe();
    const p = t.closest('.piloto');
    if (p && ['cpf', 'email', 'nascimento'].includes(t.dataset.c)) buscarPiloto(p);
  });
  f.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.mais !== undefined) { const k = b.closest('.kart'); $('.lista-p', k).insertAdjacentHTML('beforeend', htmlPiloto()); atualizar(); $('.piloto:last-child input', k).focus(); }
    if (b.dataset.tirar !== undefined) { b.closest('.piloto').remove(); atualizar(); }
    if (b.dataset.chefe !== undefined) usarChefe(b.closest('.piloto'));
  });
  f.addEventListener('submit', enviar);
  chamar('').then((i) => {
    if (i.aberta) return;
    $('#prazo').textContent = Date.now() < Date.parse(i.abre) ? 'As inscrições ainda não abriram.' : 'As inscrições estão encerradas.';
    $('#inscricao').innerHTML = '<div><h2>Inscrições encerradas</h2><p>Fale com a organização: <a href="https://wa.me/5531998842898">(31) 99884-2898</a>.</p></div>';
    $('#inscricao').className = 'bloco caixa';
    document.querySelectorAll('a[href$="#inscricao"]').forEach((a) => a.remove());
  }).catch(() => undefined);
  $('#calendario')?.addEventListener('click', () => {
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kartodromo de Betim//200 Milhas//PT', 'BEGIN:VEVENT', 'UID:200-milhas-2027@kartodromodebetim.com.br', 'DTSTAMP:20261031T120000Z', 'DTSTART:20270130T100000Z', 'DTEND:20270130T170000Z', 'SUMMARY:200 Milhas de Betim', 'LOCATION:Kartódromo Internacional de Betim\\, Betim/MG', 'DESCRIPTION:Tomada de tempo em 29/01 às 21h. Largada às 8h.', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = '200-milhas-de-betim.ics';
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

// ---------------------------------------------------------------- página da inscrição (link da equipe)
async function paginaStatus(token) {
  $('#paginaEvento').hidden = true;
  const box = $('#paginaStatus');
  box.hidden = false;
  document.title = 'Sua inscrição | 200 Milhas de Betim';
  
  box.innerHTML = '<p>Carregando sua inscrição…</p>';
  let timer;
  const desenhar = async () => {
    let i;
    try { i = await chamar(`/inscricoes/${token}`); } catch (e) { box.innerHTML = `<h1>Não encontramos</h1><p>${esc(e.message)}</p><a class="btn" href="/200-milhas">Voltar às 200 Milhas</a>`; return; }
    const selo = { paga: ['ok', 'Vaga garantida'], parcial: ['ag', 'Pagamento parcial'], pendente: ['ag', 'Aguardando pagamento'], cancelada: ['no', 'Inscrição cancelada'] }[i.situacao];
    const aberto = i.situacao === 'pendente' || i.situacao === 'parcial';
    const whats = `https://wa.me/5531998842898?text=${encodeURIComponent(`Olá! Sobre a inscrição ${i.protocolo} da equipe ${i.equipe} nas 200 Milhas.`)}`;
    const opcoes = [1, 2, 3, 4, 5].map((n) => `<option value="${n}">${n}x de ${brl(Math.round(i.falta / n))} sem juros</option>`).join('');
    box.innerHTML = `<a href="/200-milhas" style="display:inline-block;margin-bottom:18px"><img src="/media/championships/200-milhas-logo.png" alt="Voltar às 200 Milhas de Betim" width="84" height="84"></a><br><span class="selo ${selo[0]}">${selo[1]}</span><h1>${esc(i.equipe)}</h1>
      <p>${i.situacao === 'paga' ? 'Pagamento confirmado. Nos vemos em 29 de janeiro, às 21h, na tomada de tempo.' : aberto ? 'Sua inscrição está registrada. A vaga fica garantida quando o pagamento for confirmado. Guarde este link: ele é o acesso da sua equipe.' : 'Fale com a organização se isso for um engano.'}</p>
      ${aberto ? `<div class="painel"><h2>Pagar ${brl(i.falta)}</h2>
        ${i.link ? `<a class="btn cheio" href="${esc(i.link)}" target="_blank" rel="noopener">Pagar agora ${i.forma === 'cartao' ? `no cartão (${i.parcelas}x)` : 'com Pix'}</a><p class="dica centro">A confirmação aparece aqui sozinha, em alguns minutos depois do pagamento.</p>` : '<p class="dica">Escolha como pagar para gerar sua fatura.</p>'}
        <details ${i.link ? '' : 'open'}><summary>${i.link ? 'Pagar de outra forma' : 'Forma de pagamento'}</summary>
          <p><button type="button" class="mini" data-pagar="pix">Pagar com Pix à vista</button></p>
          <label class="campo">Cartão de crédito<select id="parc">${opcoes}</select></label>
          <p><button type="button" class="mini" data-pagar="cartao">Pagar no cartão</button></p><p class="achado neutro" id="msgPagar" role="status"></p>
        </details></div>` : ''}
      <div class="painel"><dl><div><dt>Protocolo</dt><dd>${esc(i.protocolo)}</dd></div><div><dt>Karts</dt><dd>${i.karts}</dd></div><div><dt>Total</dt><dd>${brl(i.valor)}</dd></div><div><dt>Pago</dt><dd>${brl(i.pago)}</dd></div><div><dt>Pilotos</dt><dd>${i.pilotos.map((p) => esc(p.nome)).join('<br>')}</dd></div></dl></div>
      <p><a href="${whats}" target="_blank" rel="noopener">Falar com a organização no WhatsApp</a></p>`;
    box.querySelectorAll('[data-pagar]').forEach((b) => b.addEventListener('click', async () => {
      const msg = $('#msgPagar'); msg.textContent = 'Gerando sua fatura…';
      try {
        const r = await chamar(`/inscricoes/${token}/pagar`, { forma: b.dataset.pagar, parcelas: Number($('#parc').value) });
        location.href = r.link;
      } catch (e) { msg.textContent = e.message; }
    }));
    clearTimeout(timer);
    if (aberto) timer = setTimeout(function repetir() { if (box.querySelector('details[open]') || document.visibilityState !== 'visible') timer = setTimeout(repetir, 30000); else desenhar(); }, 30000);
  };
  desenhar();
}

const rota = location.pathname.match(/^\/200-milhas\/inscricao\/([\w-]{20,40})/);
if (rota) paginaStatus(rota[1]); else iniciarFormulario();
