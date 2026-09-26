/* Recepcao — pecas reutilizaveis: API, janelas, grade, menu de contexto, mensagens, mascaras. */
'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

// ---------- formatos
const fmt = {
  money: (c) => (c == null || c === '' ? '' : (Number(c) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })),
  brl: (c) => (c == null ? '' : (Number(c) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })),
  dmy: (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : ''),
  dmyhm: (s) => (s ? `${fmt.dmy(s)} ${String(s).slice(11, 16)}` : ''),
  hm: (s) => (s ? String(s).slice(11, 16) : ''),
  bool: (v) => `<span class="chk ${v ? 'on' : ''}"></span>`,
  simnao: (v) => (v ? 'Sim' : 'Não'),
};
const hoje = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
/** "1.234,56" / "145" -> centavos */
const toCents = (s) => { if (s == null || String(s).trim() === '') return 0; const n = Number(String(s).replace(/\s|R\$/g, '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };
const idade = (n) => { if (!n) return null; const [y, m, d] = n.split('-').map(Number); const t = new Date(); let a = t.getFullYear() - y; if (t.getMonth() + 1 < m || (t.getMonth() + 1 === m && t.getDate() < d)) a--; return a; };

// ---------- mascaras
const mask = {
  cpf: (v) => { const d = v.replace(/\D/g, '').slice(0, 11); return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); },
  fone: (v) => { const d = v.replace(/\D/g, '').slice(0, 11); if (d.length <= 2) return d.length ? `(${d}` : ''; if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`; if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`; return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`; },
  cep: (v) => { const d = v.replace(/\D/g, '').slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; },
};
function bindMask(input, kind) { input.addEventListener('input', () => { const p = input.selectionStart === input.value.length; input.value = mask[kind](input.value); if (p) input.selectionStart = input.selectionEnd = input.value.length; }); }

// ---------- API
const Sess = {
  get token() { try { return sessionStorage.getItem('opsToken') || ''; } catch { return ''; } },
  set token(v) { try { v ? sessionStorage.setItem('opsToken', v) : sessionStorage.removeItem('opsToken'); } catch { /* sem storage */ } },
  user: null,
};
let busyCount = 0;
function busy(on) { busyCount += on ? 1 : -1; let el = $('#busy'); if (busyCount > 0 && !el) document.body.appendChild(h('<div id="busy" class="busy"></div>')); if (busyCount <= 0 && el) el.remove(); }
async function api(path, opts = {}) {
  busy(true);
  try {
    const r = await fetch(path, { method: opts.method || (opts.body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', authorization: 'Bearer ' + Sess.token }, body: opts.body ? JSON.stringify(opts.body) : undefined });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && !opts.noRelogin) { Sess.token = ''; location.reload(); throw new Error('sessão'); }
    if (!r.ok) { if (!opts.quiet) await msg(data.error || `Erro ${r.status}`, { tipo: 'e', titulo: 'Atenção!' }); const e = new Error(data.error); e.handled = true; throw e; }
    return data;
  } finally { busy(false); }
}
function openReport(path) { const sep = path.includes('?') ? '&' : '?'; window.open(`${path}${sep}t=${encodeURIComponent(Sess.token)}`, '_blank', 'width=1000,height=760'); }

// ---------- mensagens (MessageBox do Windows)
function msg(texto, { tipo = 'ok', titulo = 'Kartódromo - Módulo Recepção', botoes = ['OK'] } = {}) {
  return new Promise((resolve) => {
    const back = h(`<div class="msg-back"><div class="msgbox"><div class="t">${esc(titulo)}</div>
      <div class="b"><div class="i ${tipo}">${tipo === 'q' ? '?' : tipo === 'e' ? '✕' : tipo === 'w' ? '!' : 'i'}</div><div>${esc(texto).replace(/\n/g, '<br>')}</div></div>
      <div class="f">${botoes.map((b, i) => `<button data-i="${i}">${esc(b)}</button>`).join('')}</div></div></div>`);
    document.body.appendChild(back);
    const btns = $$('button', back);
    btns[0].focus();
    btns.forEach((b) => (b.onclick = () => { back.remove(); resolve(Number(b.dataset.i)); }));
    back.addEventListener('keydown', (e) => { if (e.key === 'Escape') { back.remove(); resolve(btns.length - 1); } });
  });
}
const confirmar = async (texto, titulo = 'Atenção!') => (await msg(texto, { tipo: 'q', titulo, botoes: ['Sim', 'Não'] })) === 0;
const info = (texto) => msg(texto, { tipo: 'ok' });
function pedir(texto, valor = '', titulo = 'Kartódromo') {
  return new Promise((resolve) => {
    const w = janela({ titulo, largura: 380, corpo: `<div class="fg"><div><label>${esc(texto)}</label><input id="pv" value="${esc(valor)}"></div></div>`,
      botoes: [['Cancelar', () => { w.fechar(); resolve(null); }], ['OK', () => { const v = $('#pv', w.el).value; w.fechar(); resolve(v); }, true]] });
    const i = $('#pv', w.el); i.focus(); i.select(); i.onkeydown = (e) => { if (e.key === 'Enter') { const v = i.value; w.fechar(); resolve(v); } };
  });
}

// ---------- janelas (Form do WinForms)
let zTop = 40;
function janela({ titulo, largura = 600, altura, corpo = '', botoes = [], aoFechar, semFechar }) {
  const back = h(`<div class="win-back"><div class="win" style="width:${largura}px;${altura ? `height:${altura}px;` : ''}">
    <div class="tt"><span class="lg">🏁 Kartódromo</span><span class="tl">${esc(titulo)}</span>${semFechar ? '' : '<span class="x" title="Fechar">✕</span>'}</div>
    <div class="bd"></div>${botoes.length ? '<div class="ft"></div>' : ''}</div></div>`);
  back.style.zIndex = ++zTop;
  const win = $('.win', back);
  const bd = $('.bd', back);
  if (typeof corpo === 'string') bd.innerHTML = corpo; else bd.appendChild(corpo);
  const api_ = { el: bd, win, fechar: () => { back.remove(); document.removeEventListener('keydown', onKey); aoFechar && aoFechar(); } };
  botoes.forEach(([rot, fn, pri]) => { const b = h(`<button${pri ? ' class="pri"' : ''}>${esc(rot)}</button>`); b.onclick = fn; $('.ft', back).appendChild(b); });
  const x = $('.x', back); if (x) x.onclick = api_.fechar;
  const onKey = (e) => { if (e.key === 'Escape' && back.style.zIndex == zTop && !$('.msg-back') && !semFechar) api_.fechar(); };
  document.addEventListener('keydown', onKey);
  // arrastar pela barra de titulo
  const tt = $('.tt', back); let dx = 0, dy = 0, drag = false;
  tt.onmousedown = (e) => { if (e.target.classList.contains('x')) return; drag = true; const r = win.getBoundingClientRect(); dx = e.clientX - r.left; dy = e.clientY - r.top; win.style.position = 'fixed'; win.style.margin = 0; };
  document.addEventListener('mousemove', (e) => { if (!drag) return; win.style.left = e.clientX - dx + 'px'; win.style.top = e.clientY - dy + 'px'; });
  document.addEventListener('mouseup', () => (drag = false));
  document.body.appendChild(back);
  return api_;
}

// ---------- menu de contexto
function ctxMenu(x, y, itens) {
  $$('.ctx').forEach((c) => c.remove());
  const m = h(`<div class="ctx"></div>`);
  for (const it of itens) {
    if (it === '-') { m.appendChild(h('<div class="sep"></div>')); continue; }
    const el = h(`<div class="it${it.dis ? ' dis' : ''}">${esc(it.label)}</div>`);
    if (!it.dis) el.onclick = () => { m.remove(); it.fn(); };
    m.appendChild(el);
  }
  document.body.appendChild(m);
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(x, innerWidth - r.width - 4) + 'px';
  m.style.top = Math.min(y, innerHeight - r.height - 4) + 'px';
  setTimeout(() => document.addEventListener('mousedown', function f(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', f); } }), 0);
}

// ---------- grade (SfDataGrid)
/**
 * columns: [{ key, label, fmt?: fn|string, cls?: 'r'|'c', html?: bool, w? }]
 * opts: { multi, onDbl(row), onCtx(rows, ev), rowClass(row), onSel(rows) }
 */
function grade(container, columns, rows, opts = {}) {
  const st = { rows, sort: opts.sort || null, dir: 1, filtros: {}, sel: new Set(), last: null };
  const get = (r, c) => (typeof c.val === 'function' ? c.val(r) : r[c.key]);
  const cell = (r, c) => { const v = get(r, c); const f = typeof c.fmt === 'string' ? fmt[c.fmt] : c.fmt; return f ? f(v, r) : esc(v); };
  function visiveis() {
    let list = st.rows.filter((r) => Object.entries(st.filtros).every(([k, q]) => { const c = columns.find((x) => x.key === k); return String(get(r, c) ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q); }));
    if (st.sort) { const c = columns.find((x) => x.key === st.sort); list = [...list].sort((a, b) => { const x = get(a, c), y = get(b, c); return (x == null ? -1 : y == null ? 1 : typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR')) * st.dir; }); }
    return list;
  }
  function render() {
    const list = visiveis();
    st.view = list;
    container.innerHTML = '';
    const t = h(`<table class="grid"><thead><tr>${opts.multi ? '<th style="width:26px;padding-right:6px"></th>' : ''}${columns.map((c) => `<th data-k="${c.key}"${c.w ? ` style="min-width:${c.w}px"` : ''}>${esc(c.label)}${st.sort === c.key ? `<span class="so">${st.dir > 0 ? '↑' : '↓'}</span>` : ''}${c.nofilter ? '' : `<span class="fi${st.filtros[c.key] ? ' on' : ''}" title="Filtrar">⛉</span>`}</th>`).join('')}</tr></thead><tbody></tbody></table>`);
    const tb = $('tbody', t);
    list.forEach((r, i) => {
      const tr = document.createElement('tr');
      tr.dataset.i = i;
      const rc = opts.rowClass && opts.rowClass(r);
      if (rc) tr.className = rc;
      if (st.sel.has(r)) tr.classList.add('sel');
      tr.innerHTML = (opts.multi ? `<td class="c">${fmt.bool(st.sel.has(r))}</td>` : '') + columns.map((c) => `<td${c.cls ? ` class="${c.cls}"` : ''}>${cell(r, c)}</td>`).join('');
      tb.appendChild(tr);
    });
    container.appendChild(t);
    if (!list.length) container.appendChild(h(`<div class="grid-empty">${opts.vazio || 'Nenhum registro.'}</div>`));
    $$('th[data-k]', t).forEach((th) => {
      th.onclick = (e) => {
        const k = th.dataset.k;
        if (e.target.classList.contains('fi')) {
          pedir(`Filtrar "${columns.find((c) => c.key === k).label}" contendo:`, st.filtros[k] || '').then((v) => { if (v === null) return; if (v.trim()) st.filtros[k] = v.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); else delete st.filtros[k]; render(); opts.onFilter && opts.onFilter(visiveis()); });
          return;
        }
        if (st.sort === k) st.dir = -st.dir; else { st.sort = k; st.dir = 1; }
        render();
      };
    });
    tb.onclick = (e) => {
      const tr = e.target.closest('tr'); if (!tr) return;
      const r = list[tr.dataset.i];
      if (opts.multi && (e.target.closest('td') === tr.firstElementChild || e.ctrlKey)) { st.sel.has(r) ? st.sel.delete(r) : st.sel.add(r); }
      else if (e.shiftKey && st.last != null) { const a = Math.min(st.last, +tr.dataset.i), b = Math.max(st.last, +tr.dataset.i); st.sel = new Set(list.slice(a, b + 1)); }
      else if (e.ctrlKey) { st.sel.has(r) ? st.sel.delete(r) : st.sel.add(r); }
      else { st.sel = new Set([r]); }
      st.last = +tr.dataset.i;
      render();
      opts.onSel && opts.onSel([...st.sel]);
    };
    tb.ondblclick = (e) => { const tr = e.target.closest('tr'); if (tr && opts.onDbl) opts.onDbl(list[tr.dataset.i]); };
    tb.oncontextmenu = (e) => {
      if (!opts.onCtx) return;
      e.preventDefault();
      const tr = e.target.closest('tr');
      if (tr) { const r = list[tr.dataset.i]; if (!st.sel.has(r)) { st.sel = new Set([r]); render(); } }
      opts.onCtx([...st.sel], e);
    };
  }
  render();
  return {
    set(rows_) { const ids = new Set([...st.sel].map((r) => r.id)); st.rows = rows_; st.sel = new Set(rows_.filter((r) => ids.has(r.id))); render(); },
    sel: () => [...st.sel],
    visiveis: () => st.view || visiveis(),
    todos: () => st.rows,
    selectAll(on) { st.sel = on ? new Set(visiveis()) : new Set(); render(); },
    selecionar(fn) { st.sel = new Set(st.rows.filter(fn)); render(); },
  };
}

/** Exportar para Excel: CSV com ; e BOM (abre direto no Excel em pt-BR). */
function exportarExcel(nome, columns, rows) {
  const val = (r, c) => { const v = typeof c.val === 'function' ? c.val(r) : r[c.key]; if (c.fmt === 'money' || c.fmt === 'brl') return fmt.money(v); if (c.fmt === 'dmyhm') return fmt.dmyhm(v); if (c.fmt === 'dmy') return fmt.dmy(v); if (c.fmt === 'bool') return v ? 'Sim' : 'Não'; return v ?? ''; };
  const linhas = [columns.map((c) => c.label), ...rows.map((r) => columns.map((c) => val(r, c)))].map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(';'));
  const blob = new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${nome}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Preenche/le um formulario pelos atributos name (checkbox -> bool). */
function formSet(root, data) { $$('[name]', root).forEach((el) => { const v = data[el.name]; if (el.type === 'checkbox') el.checked = Boolean(v); else el.value = v ?? ''; }); }
function formGet(root) { const o = {}; $$('[name]', root).forEach((el) => { o[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim(); }); return o; }
