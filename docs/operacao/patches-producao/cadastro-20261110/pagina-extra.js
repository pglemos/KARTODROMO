  const esc = (s) => String(s == null ? '' : s).replace(/[<>&"]/g, '');
  const brl = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const quando = (s) => { const d = new Date(String(s).slice(0, 16) + ':00-03:00'); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }) + ' às ' + String(s).slice(11, 16); };
  const de = (g) => g.modo === 'individual' ? 'da sua vaga' : g.modo === 'sinal' ? 'do sinal do grupo' : 'do grupo todo';
  const oque = (g) => g.modo === 'individual' ? 'a sua vaga' : g.modo === 'sinal' ? 'o sinal do grupo' : 'o grupo todo';
  let rotuloEnviar = 'Concluir cadastro';
  let grupo = null;
  let pagamentoAtual = null;
  const chaveSalva = 'pag:' + tokenReserva;
  const salvar = (v) => { try { if (v) localStorage.setItem(chaveSalva, JSON.stringify(v)); else localStorage.removeItem(chaveSalva); } catch (e) {} };
  const lerSalvo = () => { try { return JSON.parse(localStorage.getItem(chaveSalva) || 'null'); } catch (e) { return null; } };
  const topo = { h1: document.querySelector('.topo h1'), p: document.querySelector('.topo p'), passos: $('passos') };
  const topoOriginal = { h1: topo.h1.innerHTML, p: topo.p.innerHTML, passos: topo.passos.innerHTML };
  const topoFormulario = () => {
    if ($('pronto').style.display === 'block') return;
    topo.h1.innerHTML = topoOriginal.h1;
    topo.p.innerHTML = grupo && grupo.aCobrarCentavos > 0 ? 'Preencha uma vez aqui e pague no final.' : topoOriginal.p;
    if (grupo && grupo.aCobrarCentavos > 0) marcarPassos(1); else topo.passos.innerHTML = topoOriginal.passos;
  };
  const icone = (relogio) => { const ok = document.querySelector('#pronto .ok'); ok.classList.toggle('relogio', relogio); ok.innerHTML = relogio ? '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>' : '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#00e676" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'; };
  const marcarPassos = (atual, rotulos) => {
    const nomes = rotulos || ['1 · Cadastro aqui', '2 · Pagamento', '3 · Pista!'];
    topo.passos.innerHTML = nomes.map((n, i) => '<span class="' + (i + 1 < atual ? 'feito' : i + 1 === atual ? 'atual' : '') + '"' + (i + 1 === atual ? ' aria-current="step"' : '') + '>' + n + '</span>').join('');
  };

  // ---- progresso do preenchimento ----
  const campos = ['documento', 'nome', 'telefone', 'email', 'instagram', 'nascimento', 'peso', 'cep', 'endereco', 'numero', 'bairro', 'cidade', 'estado'];
  const val = (id) => $(id).value.trim();
  const dataOk = (dmy) => { const t = iso(dmy); if (!t) return false; const d = new Date(t + 'T12:00:00'); const hoje = new Date(); return !isNaN(d) && d.toISOString().slice(0, 10) === t && d <= hoje && hoje.getFullYear() - d.getFullYear() <= 110; };
  const regras = {
    documento: [() => tipo === 'CPF' ? cpfOk(val('documento')) : val('documento').replace(/[^a-zA-Z0-9]/g, '').length >= 5, () => tipo === 'CPF' ? 'CPF inválido. Confira os números.' : 'Informe o ' + (tipo === 'Passaporte' ? 'passaporte' : tipo) + '.'],
    nome: [() => val('nome').split(/\s+/).length >= 2, () => 'Informe o nome completo (nome e sobrenome).'],
    telefone: [() => dig(val('telefone')).length >= 10, () => 'Informe o celular com DDD.'],
    email: [() => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('email')), () => 'E-mail inválido. Confira o endereço.'],
    instagram: [() => { const ig = val('instagram').replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i, '').replace(/[\/?#].*$/, '').replace(/^@/, '').toLowerCase(); return !!ig && /^[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?$/.test(ig) && ig.indexOf('..') < 0; }, () => 'Informe o @usuário do Instagram (ex.: @andre.silva).'],
    nascimento: [() => dataOk(val('nascimento')), () => 'Informe uma data válida, como 25/12/1990.'],
    peso: [() => { const p = Number(val('peso').replace(',', '.')); return Number.isFinite(p) && p >= 20 && p <= 250; }, () => 'Informe o peso em kg, entre 20 e 250 (ex.: 72).'],
    cep: [() => dig(val('cep')).length === 8, () => 'Informe o CEP com 8 dígitos.'],
    endereco: [() => !!val('endereco'), () => 'Informe a rua ou avenida.'],
    numero: [() => !!val('numero'), () => 'Informe o número (ou S/N).'],
    bairro: [() => !!val('bairro'), () => 'Informe o bairro.'],
    cidade: [() => !!val('cidade'), () => 'Informe a cidade.'],
    estado: [() => val('estado').length === 2, () => 'Informe a UF com 2 letras (ex.: MG).'],
  };
  const mostrarMsg = (id, texto) => {
    const el = $(id); let m = $('m-' + id);
    if (!texto) { if (m) m.remove(); el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); return; }
    if (!m) { m = document.createElement('p'); m.className = 'msg-campo'; m.id = 'm-' + id; m.setAttribute('role', 'alert'); el.insertAdjacentElement('afterend', m); }
    m.textContent = texto; el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', 'm-' + id);
  };
  const conferir = (id) => { const r = regras[id]; const ok = r[0](); mostrarMsg(id, ok ? '' : r[1]()); return ok; };
  for (const id of campos) {
    $(id).addEventListener('blur', () => conferir(id));
    $(id).addEventListener('input', () => { if ($('m-' + id) && regras[id][0]()) mostrarMsg(id, ''); });
  }
  const atualizarProgresso = () => {
    const feitos = campos.filter((id) => regras[id][0]()).length + ($('lgpd').checked ? 1 : 0);
    const total = campos.length + 1;
    const falta = total - feitos;
    const pct = Math.round(feitos / total * 100);
    $('progBarra').style.width = pct + '%'; $('progBarra').parentNode.setAttribute('aria-valuenow', String(pct));
    $('progIr').hidden = falta === 0;
    const comErro = document.querySelectorAll('.msg-campo').length;
    $('progTxt').textContent = falta === 0 ? 'Tudo pronto: toque em Concluir' : (falta === 1 ? 'Falta 1 item' : 'Faltam ' + falta + ' itens') + (comErro ? ' · ' + comErro + ' com erro' : '');
    const bt = $('enviar'); if (!bt.disabled) bt.textContent = falta === 0 ? rotuloEnviar : 'Ver o que falta (' + falta + ')';
  };
  $('form').addEventListener('input', atualizarProgresso);
  $('form').addEventListener('change', atualizarProgresso);
  const primeiroQueFalta = () => { for (const id of campos) { if (!regras[id][0]()) return id; } return $('lgpd').checked ? null : 'lgpd'; };
  $('progIr').addEventListener('click', () => { const id = primeiroQueFalta(); if (!id) return; const el = $(id); if (id !== 'lgpd') conferir(id); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus({ preventScroll: true }); });
  setInterval(() => {
    atualizarProgresso();
    for (const id of campos) { const el = $(id); if (el.classList.contains('campo-animado') && val(id) && document.activeElement !== el && !regras[id][0]() && !$('m-' + id)) conferir(id); }
  }, 1000);
  // CPF apagado ou alterado: some o aviso de cadastro localizado
  $('documento').addEventListener('input', () => { const b = $('statusBusca'); if (tipo === 'CPF' && b.classList.contains('sucesso') && !cpfOk($('documento').value)) b.style.display = 'none'; });
  // 'Não sou eu': limpa o que foi preenchido pela busca
  $('statusBusca').addEventListener('click', (e) => {
    if (!e.target.closest('.nao-sou')) return;
    for (const id of campos) if (id !== 'documento') { $(id).value = ''; mostrarMsg(id, ''); }
    $('menores').innerHTML = ''; $('statusBusca').style.display = 'none'; cadastroEncontrado = false; atualizarProgresso(); $('nome').focus();
  });
  // teclado do celular
  for (const id of ['email', 'instagram']) { const el = $(id); el.setAttribute('autocapitalize', 'none'); el.setAttribute('autocorrect', 'off'); el.setAttribute('spellcheck', 'false'); }
  for (const id of ['bairro', 'endereco', 'cidade']) $(id).setAttribute('autocapitalize', 'words');
  atualizarProgresso();

  // tipo de documento: estado para leitor de tela
  $('tipoDoc').setAttribute('role', 'group'); $('tipoDoc').setAttribute('aria-label', 'Tipo de documento');
  const pressionar = () => { for (const x of $('tipoDoc').children) x.setAttribute('aria-pressed', x.classList.contains('sel') ? 'true' : 'false'); };
  $('tipoDoc').addEventListener('click', pressionar); pressionar();

  // ---- grupo ----
  const aplicarGrupo = (g) => {
    grupo = g;
    const paga = g.aCobrarCentavos > 0;
    const sou = g.souResponsavel;
    $('grupoTitulo').textContent = sou ? 'Você é o responsável pelo grupo' : 'Você está no grupo de ' + g.responsavel;
    const t = $('grupoTexto');
    t.innerHTML = esc(g.bateria || 'Bateria') + ' · ' + quando(g.inicio) + '. ' +
      (sou && paga ? 'Preencha seu cadastro e, no final, pague ' + oque(g) + ' (' + brl(g.aCobrarCentavos) + ') por Pix ou cartão.' + (g.modo === 'individual' ? '' : ' Os convidados só fazem o cadastro.')
        : sou ? 'O pagamento do grupo já está em dia. Preencha o seu cadastro.'
        : paga ? 'Preencha seu cadastro e, no final, pague a sua vaga (' + brl(g.aCobrarCentavos) + ') por Pix ou cartão.'
        : g.modo !== 'individual' ? 'Quem reservou paga pelo grupo. Você só preenche o seu cadastro.'
        : g.livres <= 0 ? 'Todas as vagas do grupo já têm dono. Faça o cadastro e fale com quem reservou.'
        : 'Preencha seu cadastro. Sua vaga já está reservada.') +
      (sou ? '' : ' Não é o(a) ' + esc(g.responsavel) + '? Peça o link certo a quem reservou.');
    if (paga) {
      rotuloEnviar = 'Concluir e ir para o pagamento';
      $('enviar').textContent = rotuloEnviar;
      const previa = document.createElement('div');
      previa.className = 'pagar previa'; previa.id = 'pagarPrevia';
      previa.innerHTML = '<p><b>Etapa final · Pagamento ' + de(g) + ': ' + brl(g.aCobrarCentavos) + (g.modo === 'individual' ? ' por piloto' : '') + '</b></p><p class="estado">Na próxima tela você escolhe Pix ou cartão. Use o seu CPF no cadastro.</p>';
      $('enviar').parentNode.insertBefore(previa, $('enviar'));
      topoFormulario();
    }
  };
  if (tokenReserva) fetch('/api/grupo?r=' + encodeURIComponent(tokenReserva)).then((r) => r.ok ? r.json() : null).then((g) => { if (g && g.responsavel) aplicarGrupo(g); }).catch(() => {});

  // ---- pagamento ----
  let timerPag = null;
  const verificar = async (pg, g) => {
    try {
      const s = await (await fetch('/api/grupo/pagamento?id=' + encodeURIComponent(pg.id))).json();
      if (s.pago) { clearInterval(timerPag); confirmarPago(pg, g); return true; }
      const e = $('pagarEstado'); if (e) e.textContent = 'Verificado às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '. Ainda não recebemos o pagamento; assim que cair, esta tela atualiza sozinha.';
    } catch (e) { /* sem rede: tenta de novo no próximo ciclo */ }
    return false;
  };
  const confirmarPago = (pg, g) => {
    const c = $('pagarCaixa'); const gg = Object.assign({}, g || {}, grupo || {});
    $('bannerGrupo').style.display = 'none';
    $('pronto').classList.remove('pagando');
    icone(false);
    $('prontoTitulo').textContent = gg.bateria ? esc(gg.bateria) : 'Pagamento confirmado';
    $('prontoSub').textContent = (gg.inicio ? quando(gg.inicio) + '. ' : '') + 'Pagamento confirmado.';
    if (gg.inicio && !$('calendario')) {
      const ini = new Date(String(gg.inicio).slice(0, 16) + ':00-03:00');
      if (!isNaN(ini)) {
        const f = (d) => d.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
        const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kartodromo de Betim//cadastro//PT', 'BEGIN:VEVENT', 'UID:' + (pg && pg.id ? pg.id : 'bateria') + '@kartodromodebetim.com.br', 'DTSTAMP:' + f(new Date()), 'DTSTART:' + f(ini), 'SUMMARY:' + (gg.bateria || 'Bateria') + ' no Kartódromo Internacional de Betim', 'LOCATION:Kartódromo Internacional de Betim', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
        const a = document.createElement('a'); a.id = 'calendario'; a.className = 'secundario'; a.textContent = 'Adicionar ao calendário';
        a.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics); a.download = 'bateria-kartodromo.ics';
        $('pagarCaixa').insertAdjacentElement('afterend', a);
      }
    }
    c.hidden = true; $('corrigir').hidden = true; document.querySelectorAll('#corrigirNota').forEach((x) => x.remove());
    if ($('ajudaPag')) { $('ajudaPag').hidden = false; $('ajudaPag').open = false; $('ajudaPag').querySelector('summary').textContent = 'Precisa corrigir algum dado ou de ajuda?'; $('ajudaPag').querySelector('p').textContent = 'Para corrigir um dado depois do pagamento ou tirar uma dúvida, fale com a recepção.'; }
    topo.h1.innerHTML = 'Vaga <em>garantida</em>'; topo.p.textContent = 'Nos vemos na pista!'; marcarPassos(3);
    salvar({ pg, g: { responsavel: gg.responsavel, bateria: gg.bateria, inicio: gg.inicio, modo: gg.modo, souResponsavel: gg.souResponsavel }, pago: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const mostrarPagamento = (pg, g) => {
    pagamentoAtual = pg;
    if (pg.pago) { confirmarPago(pg, g); return; }
    const c = $('pagarCaixa'); const gg = Object.assign({}, g || {}, grupo || {});
    $('bannerGrupo').style.display = 'none';
    $('pronto').classList.add('pagando');
    icone(true);
    $('prontoTitulo').textContent = 'Falta pagar';
    $('prontoSub').textContent = 'Seu cadastro já foi recebido. Pague para garantir a vaga.';
    const nome1 = (gg.nome || val('nome')).split(/\s+/)[0];
    $('corrigir').textContent = 'Corrigir meus dados';
    if (!$('corrigirNota')) { const n = document.createElement('p'); n.id = 'corrigirNota'; n.className = 'nota'; n.textContent = 'Corrigir não altera o valor a pagar.'; $('corrigir').insertAdjacentElement('afterend', n); }
    topo.h1.innerHTML = 'Quase <em>lá</em>'; topo.p.textContent = 'Leva menos de um minuto.'; marcarPassos(2);
    const quem = gg.souResponsavel ? '' : (gg.responsavel ? ' no grupo de ' + esc(gg.responsavel) : '');
    c.innerHTML = (gg.bateria ? '<p class="contexto">' + esc(gg.bateria) + ' · ' + quando(gg.inicio) + (nome1 ? ' · cadastro de ' + esc(nome1) : '') + '</p>' : '') + '<p>Pagamento d' + (gg.modo ? (gg.modo === 'individual' ? 'a sua vaga' : gg.modo === 'sinal' ? 'o sinal do grupo' : 'o grupo todo') : 'a sua vaga') + quem + '</p><p class="valor">' + brl(pg.valorCentavos) + '</p>' +
      '<a class="botao" href="' + encodeURI(pg.link) + '" target="_blank" rel="noopener">Pagar agora · Pix ou cartão</a>' +
      '<ol><li>Toque no botão: abre a página de pagamento segura da Asaas.</li><li>Escolha Pix (copie o código) ou cartão.</li><li>Volte aqui: a confirmação aparece sozinha.</li></ol>' +
      '<p class="estado" id="pagarEstado" role="status">Aguardando o pagamento.</p><button type="button" class="link" id="jaPaguei">Já paguei: verificar agora</button>';
    c.hidden = false;
    if ($('ajudaPag')) { $('ajudaPag').hidden = false; $('ajudaPag').open = true; }
    $('jaPaguei').addEventListener('click', () => verificar(pg, gg));
    clearInterval(timerPag); timerPag = setInterval(() => verificar(pg, gg), 5000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) verificar(pg, gg); });
    salvar({ pg, g: { responsavel: gg.responsavel, bateria: gg.bateria, inicio: gg.inicio, modo: gg.modo, souResponsavel: gg.souResponsavel, nome: nome1 }, pago: false });
  };
  $('corrigir').addEventListener('click', () => {
    clearInterval(timerPag);
    $('pronto').style.display = 'none'; $('pronto').classList.remove('pagando'); $('pagarCaixa').hidden = true; $('form').style.display = ''; $('progresso').style.display = ''; $('bannerGrupo').style.display = 'flex';
    icone(false); $('corrigir').textContent = 'Corrigir meus dados'; $('corrigir').hidden = false; document.querySelectorAll('#corrigirNota').forEach((x) => x.remove()); document.querySelectorAll('#calendario').forEach((x) => x.remove()); topoFormulario();
    salvar(null); window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  // voltou do app do banco com a aba suspensa: retoma o pagamento em aberto
  const salvo = tokenReserva ? lerSalvo() : null;
  if (salvo && salvo.pg && salvo.pg.id) {
    $('form').style.display = 'none'; $('progresso').style.display = 'none'; $('pronto').style.display = 'block';
    mostrarPagamento(Object.assign({}, salvo.pg, { pago: Boolean(salvo.pago) }), salvo.g);
    if (!salvo.pago) verificar(salvo.pg, salvo.g);
  }
