/* Usuários e acessos: criar, editar, excluir usuários e escolher quais telas cada perfil enxerga/altera.
   Usa as rotas do servidor da operação: /cad/usuarios, /cad/perfis e /permissoes (Modulo "Admin Web", uma linha por tela). */
'use strict';

TELAS.usuarios = async (tela) => {
  if (!S.usuario?.admin) {
    tela.innerHTML = `${cabecalho('Sistema', 'Usuários e acessos')}<main class="principal"><section class="cartao"><div class="vazio"><b>Só o administrador entra aqui</b><span>Peça a um administrador para criar ou mudar usuários.</span></div></section></main>`;
    return;
  }
  const TELAS_PERM = NAV.flatMap((g) => g.itens.map(([id, nome]) => ({ id, nome, grupo: g.t }))).filter((t) => t.id !== 'usuarios' && t.id !== 'ajuda');
  const U = { usuarios: [], perfis: [], aba: 'usuarios', q: '', perfilSel: null, matriz: null, sujo: false };
  const dataCurta = (s) => (s ? esc(s.slice(8, 10) + '/' + s.slice(5, 7) + ' ' + s.slice(11, 16)) : 'nunca');
  const nPerfil = (id) => U.usuarios.filter((u) => u.perfilId === id).length;

  tela.innerHTML = `${cabecalho('Sistema · quem entra e o que vê', 'Usuários e acessos', '<button class="btn prim" id="btnNovo"></button>')}
    <main class="principal">
      <div role="tablist" style="display: flex; gap: var(--kib-espaco-meio); margin-bottom: var(--kib-espaco-denso-12)">
        <button class="btn peq" role="tab" data-aba="usuarios">Usuários</button>
        <button class="btn peq" role="tab" data-aba="perfis">Perfis e telas liberadas</button>
      </div>
      <section class="cartao" id="corpo"><div class="esqueleto" style="height: 260px; margin: var(--kib-espaco-2)"></div></section>
    </main>`;

  const carregar = async () => {
    [U.usuarios, U.perfis] = await Promise.all([office('/cad/usuarios'), office('/cad/perfis')]);
    if (!U.perfilSel || !U.perfis.some((p) => p.id === U.perfilSel)) U.perfilSel = U.perfis[0]?.id ?? null;
  };

  const abas = () => {
    tela.querySelectorAll('[data-aba]').forEach((b) => {
      const on = b.dataset.aba === U.aba;
      b.className = 'btn peq ' + (on ? 'prim' : 'sec');
      b.setAttribute('aria-selected', on);
    });
    $('#btnNovo').textContent = U.aba === 'usuarios' ? 'Novo usuário' : 'Novo perfil';
  };

  // ---------------------------------------------------------------- aba usuários
  const pintarUsuarios = () => {
    const q = U.q.trim().toLowerCase();
    const lista = U.usuarios.filter((u) => !q || (u.nome + ' ' + u.login + ' ' + (u.perfil || '')).toLowerCase().includes(q));
    const g = 'minmax(0, 1.3fr) minmax(0, 1.1fr) minmax(0, 1fr) 120px 80px 150px';
    $('#corpo').innerHTML = `<div class="cartaoCab"><span class="col"><h2>${U.usuarios.length} usuários</h2><span class="sub">os mesmos logins do programa Recepção e deste painel</span></span>
        <input class="entrada" id="busca" placeholder="Buscar nome, login ou perfil" value="${esc(U.q)}" style="max-width: 260px; margin-left: auto"></div>
      <div class="rolagemX"><div style="min-width: 760px"><div class="cabTabela" style="grid-template-columns: ${g}"><span>Nome</span><span>Login</span><span>Perfil</span><span>Último acesso</span><span>Ativo</span><span></span></div>
      ${lista.map((u) => `<div class="linhaTabela" style="grid-template-columns: ${g}; ${u.ativo ? '' : 'opacity: .55'}">
        <b class="trunc">${esc(u.nome)}${u.admin ? ' <span class="chip azul">admin</span>' : ''}${u.id === S.usuario.id ? ' <span class="chip">você</span>' : ''}</b>
        <span class="mono trunc t-pequeno">${esc(u.login)}</span>
        <span class="trunc">${u.perfil ? esc(u.perfil) : '<span class="peq">sem perfil</span>'}</span>
        <span class="peq">${dataCurta(u.ultimoAcesso)}</span>
        <button role="switch" aria-checked="${!!u.ativo}" aria-label="Ativo" data-ativo="${u.id}" style="border: 0; background: transparent; padding: 0"><span class="chave ${u.ativo ? 'on' : ''}"></span></button>
        <span style="display: flex; gap: var(--kib-espaco-meio); justify-content: flex-end"><button class="btn sec peq" data-editar="${u.id}">Editar</button><button class="btn sec peq risco" data-excluir="${u.id}">Excluir</button></span>
      </div>`).join('') || '<div class="vazio"><b>Nenhum usuário encontrado</b></div>'}</div></div>`;
    const b = $('#busca');
    b.addEventListener('input', () => { U.q = b.value; const pos = b.value.length; pintarUsuarios(); const n = $('#busca'); n.focus(); n.setSelectionRange(pos, pos); });
  };

  const formUsuario = (u) => {
    const novo = !u;
    const m = modal(`<div class="modalTopo" style="background: linear-gradient(160deg, var(--kib-cor-borda-sutil), var(--kib-cor-fundo-app))"><span class="col gap-meio"><span class="t-titulo-grande peso-negrito">${novo ? 'Novo usuário' : 'Editar usuário'}</span><span class="peq">${novo ? 'Entra no programa Recepção e neste painel' : esc(u.login)}</span></span></div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: var(--kib-espaco-denso-12); padding: var(--kib-espaco-2) var(--kib-espaco-2)">
        <label class="campo"><span>Nome</span><input class="entrada" id="fNome" autocomplete="off" value="${esc(u?.nome || '')}"></label>
        <label class="campo"><span>Login (sem espaços)</span><input class="entrada" id="fLogin" autocomplete="off" value="${esc(u?.login || '')}"></label>
        <label class="campo"><span>Perfil (telas liberadas)</span><select class="entrada" id="fPerfil"><option value="">Sem perfil</option>${U.perfis.filter((p) => p.ativo || p.id === u?.perfilId).map((p) => `<option value="${p.id}" ${p.id === u?.perfilId ? 'selected' : ''}>${esc(p.descricao)}</option>`).join('')}</select></label>
        <label class="campo"><span>${novo ? 'Senha (mínimo 6)' : 'Nova senha (vazio = não muda)'}</span><input class="entrada" id="fSenha" type="password" autocomplete="new-password"></label>
        <label style="display: flex; gap: var(--kib-espaco-1); align-items: center; font-size: var(--kib-fonte-tamanho-corpo)"><input type="checkbox" id="fAdmin" ${u?.admin ? 'checked' : ''} style="accent-color: var(--verde)">Administrador (vê tudo e gerencia usuários)</label>
        <label style="display: flex; gap: var(--kib-espaco-1); align-items: center; font-size: var(--kib-fonte-tamanho-corpo)"><input type="checkbox" id="fAtivo" ${!u || u.ativo ? 'checked' : ''} style="accent-color: var(--verde)">Ativo (pode entrar)</label>
      </div><p class="erroMsg" id="fErro" style="padding: 0 var(--kib-espaco-2)"></p>
      <div class="modalRodape"><button class="btn sec empurra" data-acao="fechar">Cancelar</button><button class="btn prim" id="fSalvar">${novo ? 'Criar usuário' : 'Salvar'}</button></div>`);
    m.style.maxWidth = '640px';
    $('#fSalvar').onclick = async () => {
      const nome = $('#fNome').value.trim(); const login = $('#fLogin').value.trim().toLowerCase(); const senha = $('#fSenha').value;
      const erro = (t) => { $('#fErro').textContent = t; };
      if (!nome) return erro('Informe o nome.');
      if (!login || /\s/.test(login)) return erro('Informe o login, sem espaços.');
      if (novo && senha.length < 6) return erro('A senha precisa ter pelo menos 6 caracteres.');
      if (senha && senha.length < 6) return erro('A senha precisa ter pelo menos 6 caracteres.');
      const corpo = { nome, login, perfilId: Number($('#fPerfil').value) || null, admin: $('#fAdmin').checked, ativo: $('#fAtivo').checked };
      if (senha) corpo.senha = senha;
      const btn = $('#fSalvar'); btn.disabled = true;
      try {
        await office(novo ? '/cad/usuarios' : `/cad/usuarios/${u.id}`, { method: novo ? 'POST' : 'PUT', body: corpo });
        toast(novo ? 'Usuário criado' : 'Usuário salvo'); fecharCamada(); await carregar(); pintar();
      } catch (e) { erro(e.message); btn.disabled = false; }
    };
    $('#fNome').focus();
  };

  const excluirUsuario = (u) => {
    const m = modal(`<div style="padding: var(--kib-espaco-denso-20) var(--kib-espaco-denso-20)"><b class="t-titulo">Excluir ${esc(u.nome)}?</b>
      <p style="line-height: 1.5; margin: var(--kib-espaco-1) 0 0">O login <b>${esc(u.login)}</b> deixa de existir. Se ele já tem caixa, vendas ou registros, o sistema não apaga o histórico: só <b>desativa</b> o usuário, que não entra mais.</p>
      <p class="erroMsg" id="xErro"></p></div>
      <div class="modalRodape"><button class="btn sec empurra" data-acao="fechar">Cancelar</button><button class="btn prim perigo-solido" id="xOk">Excluir usuário</button></div>`);
    m.style.maxWidth = '520px';
    $('#xOk').onclick = async () => {
      $('#xOk').disabled = true;
      try {
        const r = await office(`/cad/usuarios/${u.id}`, { method: 'DELETE' });
        toast(r.desativado ? 'Tinha histórico: ficou desativado, não entra mais' : 'Usuário excluído'); fecharCamada(); await carregar(); pintar();
      } catch (e) { $('#xErro').textContent = e.message; $('#xOk').disabled = false; }
    };
  };

  // ---------------------------------------------------------------- aba perfis e telas
  const carregarMatriz = async () => {
    if (!U.perfilSel) { U.matriz = null; return; }
    const r = await office(`/permissoes?perfilId=${U.perfilSel}`);
    const por = Object.fromEntries((r.itens || []).filter((i) => i.modulo === 'Admin Web').map((i) => [i.funcao, i]));
    const configurado = Object.keys(por).length > 0;
    U.matriz = {
      acessoTotal: !!r.perfil.acessoTotal,
      configurado,
      telas: Object.fromEntries(TELAS_PERM.map((t) => [t.id, { ver: configurado ? !!por[t.id]?.acessar : true, alt: configurado ? !!por[t.id]?.alterar : true }])),
    };
    U.sujo = false;
  };

  const pintarPerfis = () => {
    const p = U.perfis.find((x) => x.id === U.perfilSel);
    const m = U.matriz;
    const grupos = [...new Set(TELAS_PERM.map((t) => t.grupo))];
    $('#corpo').innerHTML = `<div style="display: grid; grid-template-columns: minmax(200px, 260px) minmax(0, 1fr); gap: 0" class="gradePerfis">
      <div style="border-right: 1px solid var(--linha); padding: var(--kib-espaco-denso-12); display: flex; flex-direction: column; gap: var(--kib-espaco-meio)">
        ${U.perfis.map((x) => `<button class="navItem hov ${x.id === U.perfilSel ? 'atual' : ''}" data-perfil="${x.id}" style="text-align: left; border: 0; width: 100%"><span class="trunc cresce">${esc(x.descricao)}${x.ativo ? '' : ' (inativo)'}</span><span class="peq">${nPerfil(x.id)}</span></button>`).join('') || '<span class="peq">Nenhum perfil. Crie o primeiro.</span>'}
      </div>
      <div class="pad-2">${!p ? '<div class="vazio"><b>Crie um perfil para escolher as telas</b></div>' : `
        <div style="display: flex; align-items: center; gap: var(--kib-espaco-1); flex-wrap: wrap"><b class="t-titulo">${esc(p.descricao)}</b><span class="chip">${nPerfil(p.id)} usuário(s)</span>
          <span style="margin-left: auto; display: flex; gap: var(--kib-espaco-meio)"><button class="btn sec peq" data-renomear>Renomear</button><button class="btn sec peq risco" data-excluir-perfil>Excluir perfil</button></span></div>
        <label style="display: flex; gap: var(--kib-espaco-1); align-items: flex-start; margin: var(--kib-espaco-denso-12) 0 var(--kib-espaco-meio); font-size: var(--kib-fonte-tamanho-corpo); line-height: 1.4"><input type="checkbox" id="mTotal" ${m.acessoTotal ? 'checked' : ''} style="accent-color: var(--verde); margin-top: 2px"><span><b>Acesso total</b> · libera todas as telas deste painel e tudo no programa Recepção</span></label>
        ${m.configurado ? '' : '<p class="peq" style="margin: 0 0 var(--kib-espaco-1); line-height: 1.5">Este perfil ainda não tem telas escolhidas: hoje os usuários dele veem todas as telas, menos Usuários e acessos. Ao salvar, vale só o que estiver marcado.</p>'}
        <div class="rolagemX" style="${m.acessoTotal ? 'opacity: .45; pointer-events: none' : ''}"><div style="min-width: 420px">
          <div class="cabTabela" style="grid-template-columns: minmax(0, 1fr) 90px 150px"><span>Tela</span><span>Ver</span><span>Criar, editar, excluir</span></div>
          ${grupos.map((gr) => `<div class="peq" style="padding: var(--kib-espaco-1) var(--kib-espaco-denso-12) 2px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em">${esc(gr)}</div>${TELAS_PERM.filter((t) => t.grupo === gr).map((t) => `
            <div class="linhaTabela" style="grid-template-columns: minmax(0, 1fr) 90px 150px"><b>${esc(t.nome)}</b>
              <input type="checkbox" data-ver="${t.id}" ${m.telas[t.id].ver ? 'checked' : ''} aria-label="Ver ${esc(t.nome)}" style="accent-color: var(--verde); width: 18px; height: 18px">
              <input type="checkbox" data-alt="${t.id}" ${m.telas[t.id].alt ? 'checked' : ''} ${m.telas[t.id].ver ? '' : 'disabled'} aria-label="Alterar ${esc(t.nome)}" style="accent-color: var(--verde); width: 18px; height: 18px"></div>`).join('')}`).join('')}
        </div></div>
        <p class="peq" style="line-height: 1.5; margin: var(--kib-espaco-denso-12) 0 0">Usuários e acessos é sempre só para administradores. Sem “Criar, editar, excluir”, a tela abre apenas para consulta.</p>
        <p class="erroMsg" id="pErro"></p>
        <div style="display: flex; gap: var(--kib-espaco-1); margin-top: var(--kib-espaco-1); flex-wrap: wrap"><button class="btn sec peq" data-tudo="1">Marcar tudo</button><button class="btn sec peq" data-tudo="0">Limpar</button><button class="btn prim empurra" id="pSalvar">Salvar telas deste perfil</button></div>`}
      </div></div>`;
  };

  const salvarMatriz = async () => {
    const p = U.perfis.find((x) => x.id === U.perfilSel); const m = U.matriz;
    const itens = TELAS_PERM.map((t) => { const v = m.telas[t.id]; const alt = v.ver && v.alt; return { modulo: 'Admin Web', funcao: t.id, acessar: v.ver, incluir: alt, alterar: alt, excluir: alt, exportar: v.ver, importar: alt }; });
    $('#pSalvar').disabled = true;
    try {
      await office('/permissoes', { method: 'PUT', body: { perfilId: p.id, acessoTotal: m.acessoTotal, itens } });
      toast('Telas do perfil salvas'); await carregarMatriz(); pintarPerfis();
      if (S.perm?.perfilId === p.id) { S.perm = null; await carregarPermissoes(); }
    } catch (e) { $('#pErro').textContent = e.message; $('#pSalvar').disabled = false; }
  };

  const formPerfil = (p) => {
    const novo = !p;
    const m = modal(`<div style="padding: var(--kib-espaco-denso-20) var(--kib-espaco-denso-20)"><b class="t-titulo">${novo ? 'Novo perfil' : 'Renomear perfil'}</b>
      <label class="campo" style="margin-top: var(--kib-espaco-denso-12)"><span>Nome do perfil</span><input class="entrada" id="nPerfil" maxlength="60" value="${esc(p?.descricao || '')}" autocomplete="off"></label>
      <p class="erroMsg" id="nErro"></p></div>
      <div class="modalRodape"><button class="btn sec empurra" data-acao="fechar">Cancelar</button><button class="btn prim" id="nOk">${novo ? 'Criar perfil' : 'Salvar'}</button></div>`);
    m.style.maxWidth = '460px';
    $('#nPerfil').focus();
    $('#nOk').onclick = async () => {
      const descricao = $('#nPerfil').value.trim();
      if (!descricao) return ($('#nErro').textContent = 'Informe o nome do perfil.');
      $('#nOk').disabled = true;
      try {
        const r = await office(novo ? '/cad/perfis' : `/cad/perfis/${p.id}`, { method: novo ? 'POST' : 'PUT', body: { descricao, ativo: true, acessoTotal: !!p?.acessoTotal } });
        if (novo) U.perfilSel = r.id;
        toast(novo ? 'Perfil criado' : 'Perfil renomeado'); fecharCamada(); await carregar(); await carregarMatriz(); pintar();
      } catch (e) { $('#nErro').textContent = e.message; $('#nOk').disabled = false; }
    };
  };

  const excluirPerfil = (p) => {
    const m = modal(`<div style="padding: var(--kib-espaco-denso-20) var(--kib-espaco-denso-20)"><b class="t-titulo">Excluir o perfil ${esc(p.descricao)}?</b>
      <p style="line-height: 1.5; margin: var(--kib-espaco-1) 0 0">As telas marcadas neste perfil serão apagadas. Só é possível se nenhum usuário usar o perfil.</p><p class="erroMsg" id="xErro"></p></div>
      <div class="modalRodape"><button class="btn sec empurra" data-acao="fechar">Cancelar</button><button class="btn prim perigo-solido" id="xOk">Excluir perfil</button></div>`);
    m.style.maxWidth = '500px';
    $('#xOk').onclick = async () => {
      $('#xOk').disabled = true;
      try {
        const r = await office(`/cad/perfis/${p.id}`, { method: 'DELETE' });
        toast(r.desativado ? 'Perfil em uso no histórico: ficou inativo' : 'Perfil excluído'); fecharCamada(); U.perfilSel = null; await carregar(); await carregarMatriz(); pintar();
      } catch (e) { $('#xErro').textContent = e.message; $('#xOk').disabled = false; }
    };
  };

  const pintar = () => { abas(); U.aba === 'usuarios' ? pintarUsuarios() : pintarPerfis(); };

  tela.addEventListener('click', async (e) => {
    const t = e.target;
    const aba = t.closest('[data-aba]');
    if (aba) {
      if (U.aba === 'perfis' && U.sujo && aba.dataset.aba !== 'perfis' && !confirm('Há mudanças nas telas deste perfil que não foram salvas. Sair mesmo assim?')) return;
      U.aba = aba.dataset.aba; try { if (U.aba === 'perfis') await carregarMatriz(); } catch (er) { falhou(er); } return pintar();
    }
    if (t.closest('#btnNovo')) return U.aba === 'usuarios' ? formUsuario(null) : formPerfil(null);
    const ed = t.closest('[data-editar]'); if (ed) return formUsuario(U.usuarios.find((u) => u.id === +ed.dataset.editar));
    const ex = t.closest('[data-excluir]'); if (ex) return excluirUsuario(U.usuarios.find((u) => u.id === +ex.dataset.excluir));
    const at = t.closest('[data-ativo]');
    if (at) {
      const u = U.usuarios.find((x) => x.id === +at.dataset.ativo);
      try { await office(`/cad/usuarios/${u.id}`, { method: 'PUT', body: { ativo: !u.ativo } }); u.ativo = !u.ativo; pintarUsuarios(); toast(u.ativo ? 'Usuário ativado' : 'Usuário desativado: não entra mais'); } catch (er) { falhou(er); }
      return;
    }
    const pf = t.closest('[data-perfil]');
    if (pf) {
      if (U.sujo && !confirm('Há mudanças nas telas deste perfil que não foram salvas. Trocar de perfil mesmo assim?')) return;
      U.perfilSel = +pf.dataset.perfil; try { await carregarMatriz(); } catch (er) { falhou(er); } return pintarPerfis();
    }
    if (t.closest('[data-renomear]')) return formPerfil(U.perfis.find((p) => p.id === U.perfilSel));
    if (t.closest('[data-excluir-perfil]')) return excluirPerfil(U.perfis.find((p) => p.id === U.perfilSel));
    const tudo = t.closest('[data-tudo]');
    if (tudo) { const v = tudo.dataset.tudo === '1'; for (const id of Object.keys(U.matriz.telas)) U.matriz.telas[id] = { ver: v, alt: v }; U.sujo = true; return pintarPerfis(); }
    if (t.closest('#pSalvar')) return salvarMatriz();
  });
  tela.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'mTotal') { U.matriz.acessoTotal = t.checked; U.sujo = true; return pintarPerfis(); }
    if (t.dataset.ver) { const v = U.matriz.telas[t.dataset.ver]; v.ver = t.checked; if (!t.checked) v.alt = false; U.sujo = true; return pintarPerfis(); }
    if (t.dataset.alt) { U.matriz.telas[t.dataset.alt].alt = t.checked; U.sujo = true; }
  });

  try { await carregar(); } catch (e) { $('#corpo').innerHTML = `<p class="erroMsg" style="padding: var(--kib-espaco-2)">${esc(e.message)}</p>`; abas(); return; }
  pintar();
};
