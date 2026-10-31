'use strict';
/* 200 Milhas: inscrições do site, equipes, pilotos, contatos e quem pagou. Depende de app.js. */
NAV.find((g) => g.t === 'Competições').itens.unshift(['inscricoes', '200 Milhas · Inscrições', IC.camp, G('#00C853', '#007E33')]);

TELAS.inscricoes = async (tela) => {
  const F = S.i200 || (S.i200 = { aba: 'equipes', filtro: 'todas', q: '' });
  let D = await office('/campeonato-inscricoes?evento=200-milhas');
  const zap = (t) => { const d = String(t || '').replace(/\D/g, ''); return d ? `https://wa.me/${d.length <= 11 ? '55' + d : d}` : ''; };
  const data = (s) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '');
  const SELO = { paga: ['verde', 'Paga'], parcial: ['amarelo', 'Parcial'], pendente: ['amarelo', 'Falta pagar'], cancelada: ['vermelho', 'Cancelada'] };
  const seloDe = (i) => `<span class="i2-selo ${SELO[i.situacao][0]}">${SELO[i.situacao][1]}</span>`;
  const link = (i) => `https://kartodromodebetim.com.br/200-milhas/inscricao/${i.token}`;

  function desenhar() {
    const ativas = D.inscricoes.filter((i) => i.situacao !== 'cancelada');
    const soma = (f) => ativas.reduce((s, i) => s + f(i), 0);
    const nPag = ativas.filter((i) => i.situacao === 'paga').length;
    const cont = (s) => (s === 'todas' ? D.inscricoes.length : D.inscricoes.filter((i) => i.situacao === s).length);
    tela.innerHTML = `${cabecalho('Competições · inscrições pelo site', '200 Milhas de Betim', `<a class="btn sec" href="https://kartodromodebetim.com.br/200-milhas" target="_blank" rel="noopener">Ver a página</a><button class="btn sec" data-csv>Exportar planilha</button>`)}
    <main class="principal">
      <section class="i2-num">
        <div class="cartao"><span>Equipes</span><b>${ativas.length}</b><small>mínimo do regulamento: 20</small></div>
        <div class="cartao"><span>Karts</span><b>${soma((i) => i.karts)}</b><small>${soma((i) => i.pilotos.length)} pilotos</small></div>
        <div class="cartao"><span>Recebido</span><b>${brlCurto(soma((i) => Math.min(i.pago, i.valor)))}</b><small>${nPag} de ${ativas.length} equipes pagas</small></div>
        <div class="cartao"><span>Falta receber</span><b>${brlCurto(soma((i) => i.falta))}</b><small>prazo: 10/01/2027</small></div>
      </section>
      <nav class="ev-abas" aria-label="Partes"><button data-aba="equipes" class="${F.aba === 'equipes' ? 'atual' : ''}">Equipes e pagamentos</button><button data-aba="contatos" class="${F.aba === 'contatos' ? 'atual' : ''}">Contatos</button></nav>
      <div class="i2-filtros"><input class="entrada" id="i2q" type="search" placeholder="Buscar equipe, piloto, CPF ou telefone" aria-label="Buscar" value="${esc(F.q)}">
        ${F.aba === 'equipes' ? ['todas', 'pendente', 'parcial', 'paga', 'cancelada'].map((s) => `<button class="i2-f ${F.filtro === s ? 'atual' : ''}" data-f="${s}">${{ todas: 'Todas', pendente: 'Falta pagar', parcial: 'Parcial', paga: 'Pagas', cancelada: 'Canceladas' }[s]} (${cont(s)})</button>`).join('') : ''}
      </div>
      <section class="cartao" id="i2lista"></section>
    </main>`;
    lista();
  }
  const achou = (i, q) => { if (!q) return true; const t = q.toLowerCase(), d = t.replace(/\D/g, ''); return [i.equipe, i.chefeNome, i.protocolo, ...i.pilotos.map((p) => p.nome)].some((x) => String(x).toLowerCase().includes(t)) || (d.length >= 3 && [i.chefeCpf, i.chefeTelefone, ...i.pilotos.flatMap((p) => [p.cpf, p.telefone])].some((x) => String(x || '').includes(d))); };
  function lista() {
    const box = $('#i2lista', tela);
    if (F.aba === 'contatos') {
      const linhas = D.inscricoes.filter((i) => i.situacao !== 'cancelada' && achou(i, F.q)).flatMap((i) => [{ nome: i.chefeNome, papel: 'Chefe', equipe: i.equipe, tel: i.chefeTelefone, email: i.chefeEmail }, ...i.pilotos.filter((p) => p.cpf !== i.chefeCpf).map((p) => ({ nome: p.nome, papel: `Piloto · kart ${p.kart}`, equipe: i.equipe, tel: p.telefone, email: p.email }))]);
      box.innerHTML = linhas.length ? `<div class="i2-rolar"><table class="i2-t"><thead><tr><th>Nome</th><th>Função</th><th>Equipe</th><th>WhatsApp</th><th>E-mail</th></tr></thead><tbody>${linhas.map((c) => `<tr><td><b>${esc(c.nome)}</b></td><td>${esc(c.papel)}</td><td>${esc(c.equipe)}</td><td>${c.tel ? `<a href="${zap(c.tel)}" target="_blank" rel="noopener">${esc(c.tel)}</a>` : '<span class="i2-m">sem telefone</span>'}</td><td>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '<span class="i2-m">sem e-mail</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="vazio"><b>Nenhum contato ainda</b><span>Os contatos aparecem quando as equipes se inscreverem.</span></div>';
      return;
    }
    const itens = D.inscricoes.filter((i) => (F.filtro === 'todas' || i.situacao === F.filtro) && achou(i, F.q));
    box.innerHTML = itens.length ? `<div class="i2-rolar"><table class="i2-t"><thead><tr><th>Equipe</th><th>Chefe</th><th>Karts</th><th>Pilotos</th><th>Total</th><th>Falta</th><th>Situação</th><th>Inscrita em</th></tr></thead><tbody>${itens.map((i) => `<tr class="i2-l" tabindex="0" data-id="${i.id}"><td><b>${esc(i.equipe)}</b><br><small class="i2-m">${esc(i.protocolo)}</small></td><td>${esc(i.chefeNome)}</td><td>${i.karts}</td><td>${i.pilotos.length}</td><td>${brlCurto(i.valor)}</td><td>${i.falta ? brlCurto(i.falta) : '—'}</td><td>${seloDe(i)}</td><td>${data(i.criadoEm)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="vazio"><b>${D.inscricoes.length ? 'Nada neste filtro' : 'Nenhuma equipe inscrita ainda'}</b><span>${D.inscricoes.length ? 'Troque o filtro ou a busca.' : 'As inscrições feitas no site aparecem aqui na hora.'}</span></div>`;
  }
  const trocar = (n) => { D.inscricoes = D.inscricoes.map((x) => (x.id === n.id ? n : x)); desenhar(); detalhe(n.id); };
  const agir = async (fn, ok) => { try { const r = await fn(); if (ok) toast(ok); return r; } catch (e) { toast(e.message, true); return null; } };

  function detalhe(id) {
    const i = D.inscricoes.find((x) => x.id === id); if (!i) return;
    const base = `/campeonato-inscricoes/${id}`;
    const aberta = i.falta && i.situacao !== 'cancelada';
    const texto = encodeURIComponent(`Olá, ${i.chefeNome.split(' ')[0]}! Inscrição da equipe ${i.equipe} nas 200 Milhas de Betim: falta pagar ${brl(i.falta)}. Prazo: 10/01/2027. Pague por aqui: ${link(i)}`);
    const g = gaveta(`<div class="i2-g"><div class="i2-gc"><div>${seloDe(i)}<h2>${esc(i.equipe)}</h2><small class="i2-m">Protocolo ${esc(i.protocolo)} · ${i.karts} kart(s) · origem ${esc(i.origem)}</small></div><button class="btn sec" data-fechar>Fechar</button></div>
      <h3>Pagamento</h3><p>Total ${brl(i.valor)} · pago ${brl(i.pago)} · <b>falta ${brl(i.falta)}</b></p>
      <div class="i2-acoes">${aberta ? `<a class="btn" href="${zap(i.chefeTelefone)}?text=${texto}" target="_blank" rel="noopener">Cobrar no WhatsApp</a><button class="btn sec" data-copiar>Copiar link da equipe</button>` : ''}</div>
      ${aberta ? `<form class="i2-pg" data-pg><b>Lançar pagamento recebido por fora</b><div class="i2-lin"><input class="entrada" name="valor" inputmode="decimal" required aria-label="Valor" value="${(i.falta / 100).toFixed(2).replace('.', ',')}"><select class="entrada" name="forma" aria-label="Forma"><option>Pix</option><option>Transferência</option><option>Cartão</option><option>Dinheiro</option><option>Cortesia</option></select></div><input class="entrada" name="obs" placeholder="Observação (opcional)" aria-label="Observação" maxlength="300"><button class="btn">Lançar</button></form>` : ''}
      ${i.pagamentos.length ? `<ul class="i2-ul">${i.pagamentos.map((p) => `<li><span>${data(p.em)} · ${esc(p.forma)} · <b>${brl(p.valor)}</b>${p.observacao ? ` · ${esc(p.observacao)}` : ''}</span>${p.origem === 'manual' ? `<button class="i2-x" data-delpg="${p.id}">Excluir</button>` : ''}</li>`).join('')}</ul>` : '<p class="i2-m">Nenhum pagamento lançado.</p>'}
      ${i.cobrancas.filter((c) => c.status === 'aguardando').map((c) => `<p class="i2-m">Fatura em aberto: ${brl(c.valor)} · ${c.forma === 'pix' ? 'Pix' : `cartão ${c.parcelas}x`} · <a href="${esc(c.link)}" target="_blank" rel="noopener">abrir fatura</a></p>`).join('')}
      <h3>Chefe de equipe</h3><p><b>${esc(i.chefeNome)}</b><br>CPF ${esc(i.chefeCpf)}<br><a href="${zap(i.chefeTelefone)}" target="_blank" rel="noopener">${esc(i.chefeTelefone)}</a> · <a href="mailto:${esc(i.chefeEmail)}">${esc(i.chefeEmail)}</a>${i.cidade ? `<br>${esc(i.cidade)}` : ''}</p>
      <h3>Pilotos (${i.pilotos.length})</h3><ul class="i2-ul">${i.pilotos.map((p) => `<li><span>Kart ${p.kart} · <b>${esc(p.nome)}</b><br><small class="i2-m">CPF ${esc(p.cpf)} · nasc. ${data(p.nascimento)} · ${(p.alturaCm / 100).toFixed(2).replace('.', ',')} m · ${p.pesoKg} kg${p.clienteId ? ' · com cadastro' : ' · sem cadastro no sistema'}</small></span><button class="i2-x" data-delpi="${p.id}">Remover</button></li>`).join('')}</ul>
      <form class="i2-pg" data-pi><b>Adicionar piloto</b><input class="entrada" id="i2busca" placeholder="Buscar no cadastro: CPF, e-mail ou nome" aria-label="Buscar piloto no cadastro"><div id="i2achou"></div><input class="entrada" name="nome" placeholder="Nome completo" aria-label="Nome" required><div class="i2-lin"><input class="entrada" name="cpf" placeholder="CPF" aria-label="CPF" required><input class="entrada" name="nascimento" type="date" aria-label="Nascimento" required></div><div class="i2-lin"><input class="entrada" name="altura" placeholder="Altura (1,75)" aria-label="Altura" required><input class="entrada" name="peso" placeholder="Peso (kg)" aria-label="Peso" required><input class="entrada" name="kart" type="number" min="1" max="${i.karts}" value="1" aria-label="Kart"></div><input type="hidden" name="telefone"><input type="hidden" name="email"><button class="btn sec">Adicionar</button></form>
      ${i.observacao ? `<h3>Observação da equipe</h3><p>${esc(i.observacao)}</p>` : ''}
      <h3>Anotações internas</h3><textarea class="entrada" id="i2obs" rows="3" maxlength="1000" aria-label="Anotações internas" style="height:auto">${esc(i.obsInterna)}</textarea><button class="btn sec" data-obs>Salvar anotação</button>
      <div class="i2-fim">${i.situacao === 'cancelada' ? '<button class="btn sec" data-reativar>Reativar inscrição</button>' : '<button class="i2-x" data-cancelar>Cancelar inscrição</button>'}</div></div>`);
    g.addEventListener('click', async (e) => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.fechar !== undefined) return fecharCamada();
      if (t.dataset.copiar !== undefined) { await navigator.clipboard.writeText(link(i)).catch(() => undefined); return toast('Link copiado.'); }
      if (t.dataset.delpg) { if (!confirm('Excluir este pagamento lançado?')) return; const n = await agir(() => office(`${base}/pagamentos/${t.dataset.delpg}`, { method: 'DELETE' }), 'Pagamento excluído.'); if (n) trocar(n); }
      if (t.dataset.delpi) { if (!confirm('Remover este piloto da equipe?')) return; const n = await agir(() => office(`${base}/pilotos/${t.dataset.delpi}`, { method: 'DELETE' }), 'Piloto removido.'); if (n) trocar(n); }
      if (t.dataset.obs !== undefined) { const n = await agir(() => office(base, { method: 'PUT', body: { equipe: i.equipe, chefeNome: i.chefeNome, chefeTelefone: i.chefeTelefone, chefeEmail: i.chefeEmail, cidade: i.cidade, obsInterna: $('#i2obs').value } }), 'Anotação salva.'); if (n) trocar(n); }
      if (t.dataset.cancelar !== undefined) { if (!confirm(`Cancelar a inscrição da equipe ${i.equipe}? A fatura em aberto também será cancelada. Valores já pagos precisam ser devolvidos à parte.`)) return; const n = await agir(() => office(`${base}/cancelar`, { method: 'POST', body: {} }), 'Inscrição cancelada.'); if (n) trocar(n); }
      if (t.dataset.reativar !== undefined) { const n = await agir(() => office(`${base}/reativar`, { method: 'POST', body: {} }), 'Inscrição reativada.'); if (n) trocar(n); }
    });
    g.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      if (f.dataset.pg !== undefined) {
        const valor = Math.round(Number(f.valor.value.replace(/\./g, '').replace(',', '.')) * 100);
        const n = await agir(() => office(`${base}/pagamentos`, { method: 'POST', body: { valorCentavos: valor, forma: f.forma.value, observacao: f.obs.value } }), 'Pagamento lançado.');
        if (n) trocar(n);
      }
      if (f.dataset.pi !== undefined) {
        const n = await agir(() => office(`${base}/pilotos`, { method: 'POST', body: { nome: f.nome.value, cpf: f.cpf.value, nascimento: f.nascimento.value, altura: f.altura.value, peso: f.peso.value, kart: f.kart.value, telefone: f.telefone.value, email: f.email.value } }), 'Piloto adicionado.');
        if (n) trocar(n);
      }
    });
    let espera;
    $('#i2busca', g).addEventListener('input', (e) => {
      clearTimeout(espera);
      espera = setTimeout(async () => {
        const r = await agir(() => office(`/campeonato-inscricoes/buscar-piloto?q=${encodeURIComponent(e.target.value)}`));
        $('#i2achou', g).innerHTML = (r || []).map((c, k) => `<button type="button" class="i2-sug" data-k="${k}">${esc(c.nome)} · ${esc(c.cpf || 'sem CPF')}</button>`).join('');
        $('#i2achou', g).querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => {
          const c = r[Number(b.dataset.k)], f = $('[data-pi]', g);
          f.nome.value = c.nome || ''; f.cpf.value = c.cpf || ''; f.nascimento.value = c.nascimento || ''; f.peso.value = c.peso || ''; f.telefone.value = c.telefone || ''; f.email.value = c.email || '';
          $('#i2achou', g).innerHTML = '';
        }));
      }, 300);
    });
  }
  function csv() {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const din = (c) => (c / 100).toFixed(2).replace('.', ',');
    const linhas = [['Protocolo', 'Equipe', 'Situação', 'Total', 'Pago', 'Falta', 'Kart', 'Função', 'Nome', 'CPF', 'Nascimento', 'WhatsApp', 'E-mail', 'Altura', 'Peso']];
    for (const i of D.inscricoes) {
      linhas.push([i.protocolo, i.equipe, i.situacao, din(i.valor), din(i.pago), din(i.falta), '', 'Chefe', i.chefeNome, i.chefeCpf, '', i.chefeTelefone, i.chefeEmail, '', '']);
      for (const p of i.pilotos) linhas.push([i.protocolo, i.equipe, i.situacao, '', '', '', p.kart, 'Piloto', p.nome, p.cpf, data(p.nascimento), p.telefone, p.email, (p.alturaCm / 100).toFixed(2).replace('.', ','), String(p.pesoKg).replace('.', ',')]);
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + linhas.map((l) => l.map(q).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = '200-milhas-inscricoes.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  tela.addEventListener('click', (e) => {
    const b = e.target.closest('[data-aba],[data-f],[data-csv],[data-id]'); if (!b) return;
    if (b.dataset.aba) { F.aba = b.dataset.aba; desenhar(); }
    else if (b.dataset.f) { F.filtro = b.dataset.f; desenhar(); }
    else if (b.dataset.csv !== undefined) csv();
    else if (b.dataset.id) detalhe(Number(b.dataset.id));
  });
  tela.addEventListener('keydown', (e) => { const l = e.target.closest?.('[data-id]'); if (l && e.key === 'Enter') detalhe(Number(l.dataset.id)); });
  tela.addEventListener('input', (e) => { if (e.target.id === 'i2q') { F.q = e.target.value; lista(); } });
  desenhar();
};
