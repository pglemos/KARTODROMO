/**
 * PORTAL DE RESULTADOS OFICIAIS - KARTÓDROMO INTERNACIONAL DE BETIM
 * Aplicação Interativa do Cliente (SPA)
 * Padrão UI/UX Pro Max: Zero Emojis, Ícones SVG Nativos, Folha A4 Integrada
 */

(function () {
  'use strict';

  // --- Ícones SVG Nativos (Zero Emoji) ---
  const ICONS = {
    trophy: '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-2.34"/><path d="M14 14.66V17c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-2.34"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
    timer: '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    calendar: '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    user: '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    flag: '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
    zap: '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    file: '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    eye: '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    printer: '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
    medal: '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>',
    chevronRight: '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>',
  };

  // --- Estado da Aplicação ---
  const state = {
    data: '',
    datasDisponiveis: [],
    tipoFiltro: 'all',
    buscaTexto: '',
    baterias: [],
    bateriaAtual: null,
    kartSelecionado: null,
    identificacao: null,
  };

  // --- Elementos do DOM ---
  const el = {
    // Views
    viewBaterias: document.getElementById('viewBaterias'),
    viewBateriaDetalhe: document.getElementById('viewBateriaDetalhe'),
    viewVoltaAVolta: document.getElementById('viewVoltaAVolta'),

    // Top Bar & Datas
    brandHomeBtn: document.getElementById('brandHomeBtn'),
    btnDateToday: document.getElementById('btnDateToday'),
    btnDateYesterday: document.getElementById('btnDateYesterday'),
    btnDateCalendar: document.getElementById('btnDateCalendar'),
    inputCalendarDate: document.getElementById('inputCalendarDate'),
    labelCalendarDate: document.getElementById('labelCalendarDate'),
    badgeActiveDate: document.getElementById('badgeActiveDate'),

    // Busca & Filtros
    searchInput: document.getElementById('searchInput'),
    searchClearBtn: document.getElementById('searchClearBtn'),
    searchSpinner: document.getElementById('searchSpinner'),
    filterBtns: document.querySelectorAll('.chip-btn[data-filter]'),
    identBanner: document.getElementById('identBanner'),
    identAvatar: document.getElementById('identAvatar'),
    identTitle: document.getElementById('identTitle'),
    identSub: document.getElementById('identSub'),
    identCloseBtn: document.getElementById('identCloseBtn'),
    identBateriasList: document.getElementById('identBateriasList'),

    // Lista de Baterias
    bateriasGrid: document.getElementById('bateriasGrid'),
    bateriasLoading: document.getElementById('bateriasLoading'),
    bateriasEmpty: document.getElementById('bateriasEmpty'),
    bateriasCountLabel: document.getElementById('bateriasCountLabel'),

    // Detalhe da Bateria
    btnBackToBaterias: document.getElementById('btnBackToBaterias'),
    detailTitle: document.getElementById('detailTitle'),
    detailDate: document.getElementById('detailDate'),
    detailBadgeType: document.getElementById('detailBadgeType'),
    detailTrack: document.getElementById('detailTrack'),
    detailCriterio: document.getElementById('detailCriterio'),
    detailPilotosCount: document.getElementById('detailPilotosCount'),
    detailPoleBanner: document.getElementById('detailPoleBanner'),
    detailPoleDriver: document.getElementById('detailPoleDriver'),
    detailPoleKart: document.getElementById('detailPoleKart'),
    detailPoleTime: document.getElementById('detailPoleTime'),
    standingsTableBody: document.getElementById('standingsTableBody'),
    inSessionSearch: document.getElementById('inSessionSearch'),
    btnPreviewBateriaSheet: document.getElementById('btnPreviewBateriaSheet'),
    btnDownloadBateriaPdf: document.getElementById('btnDownloadBateriaPdf'),
    btnPrintBateria: document.getElementById('btnPrintBateria'),
    btnShareQr: document.getElementById('btnShareQr'),

    // Volta a Volta
    btnBackToDetail: document.getElementById('btnBackToDetail'),
    telKartBadge: document.getElementById('telKartBadge'),
    telDriverName: document.getElementById('telDriverName'),
    telBateriaName: document.getElementById('telBateriaName'),
    telBestLap: document.getElementById('telBestLap'),
    telAvgLap: document.getElementById('telAvgLap'),
    telLapCount: document.getElementById('telLapCount'),
    lapsTableBody: document.getElementById('lapsTableBody'),
    btnPreviewDriverSheet: document.getElementById('btnPreviewDriverSheet'),
    btnDownloadDriverPdf: document.getElementById('btnDownloadDriverPdf'),
    btnPrintDriver: document.getElementById('btnPrintDriver'),

    // Modal Sheet Preview (A4 Vertical)
    sheetModal: document.getElementById('sheetModal'),
    sheetModalTitle: document.getElementById('sheetModalTitle'),
    sheetModalIframe: document.getElementById('sheetModalIframe'),
    sheetModalCloseBtn: document.getElementById('sheetModalCloseBtn'),
    btnSheetModalPrint: document.getElementById('btnSheetModalPrint'),
    linkSheetModalExternal: document.getElementById('linkSheetModalExternal'),

    // Modal QR Code
    qrModal: document.getElementById('qrModal'),
    qrModalCloseBtn: document.getElementById('qrModalCloseBtn'),
    qrCodeContainer: document.getElementById('qrCodeContainer'),
    btnCopyShareUrl: document.getElementById('btnCopyShareUrl'),
    btnCopyShareLabel: document.getElementById('btnCopyShareLabel'),
  };

  // --- Utilitários de Formatação ---
  function formatIsoDateToBr(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    const parts = iso.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function getTodayIso() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function getYesterdayIso() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function escHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // --- Navegação entre Views ---
  function showView(viewName) {
    el.viewBaterias.classList.remove('active');
    el.viewBateriaDetalhe.classList.remove('active');
    el.viewVoltaAVolta.classList.remove('active');

    if (viewName === 'detalhe') {
      el.viewBateriaDetalhe.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (viewName === 'volta') {
      el.viewVoltaAVolta.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      el.viewBaterias.classList.add('active');
    }
  }

  // --- Modal da Folha A4 Oficial ---
  function abrirModalFolhaA4(url, titulo) {
    if (!el.sheetModal) return;
    el.sheetModalTitle.textContent = titulo;
    el.sheetModalIframe.src = url;
    el.linkSheetModalExternal.href = url;
    el.sheetModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function fecharModalFolhaA4() {
    if (!el.sheetModal) return;
    el.sheetModal.classList.remove('active');
    el.sheetModalIframe.src = 'about:blank';
    document.body.style.overflow = '';
  }

  // --- Inicialização e Parâmetros de URL (QR Code) ---
  async function init() {
    setupEventListeners();

    const params = new URLSearchParams(window.location.search);
    const sessionParam = params.get('session')?.trim();
    const kartParam = params.get('kart')?.trim();
    const qParam = params.get('q') || params.get('cpf') || params.get('email');
    const dataParam = params.get('data')?.trim();

    state.data = dataParam || getTodayIso();

    await carregarBaterias(state.data);

    if (sessionParam) {
      await abrirBateria(sessionParam, kartParam, false, Boolean(kartParam));
    } else if (qParam) {
      el.searchInput.value = qParam;
      el.searchClearBtn.classList.add('visible');
      executarBuscaIdentificacao(qParam);
    }
  }

  // --- Event Listeners ---
  function setupEventListeners() {
    // Suporte a Navegação do Navegador (Voltar / Avançar / Swipe Mobile)
    window.addEventListener('popstate', (e) => {
      const s = e.state;
      if (!s) {
        showView('baterias');
        return;
      }
      if (s.kart && s.sessionId) {
        if (!state.bateriaAtual || state.bateriaAtual.sessionId !== s.sessionId) {
          abrirBateria(s.sessionId, s.kart, false, true);
        } else {
          abrirVoltaAVolta(s.kart, false);
        }
      } else if (s.sessionId) {
        abrirBateria(s.sessionId, null, false, false);
      } else {
        showView('baterias');
      }
    });

    el.brandHomeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      history.pushState(null, '', window.location.pathname);
      showView('baterias');
    });

    el.btnDateToday.addEventListener('click', () => {
      definirData(getTodayIso());
    });

    el.btnDateYesterday.addEventListener('click', () => {
      definirData(getYesterdayIso());
    });

    el.btnDateCalendar.addEventListener('click', () => {
      el.inputCalendarDate.showPicker ? el.inputCalendarDate.showPicker() : el.inputCalendarDate.click();
    });

    el.inputCalendarDate.addEventListener('change', (e) => {
      if (e.target.value) {
        definirData(e.target.value);
      }
    });

    el.filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        el.filterBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.tipoFiltro = btn.getAttribute('data-filter') || 'all';
        renderizarGridBaterias();
      });
    });

    let debounceTimer = null;
    el.searchInput.addEventListener('input', (e) => {
      const valor = e.target.value.trim();
      state.buscaTexto = valor.toLowerCase();
      el.searchClearBtn.classList.toggle('visible', Boolean(valor));

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (valor.length >= 2) {
          executarBuscaIdentificacao(valor);
        } else {
          state.identificacao = null;
          if (el.identBateriasList) el.identBateriasList.innerHTML = '';
          el.identBanner.classList.remove('active');
          renderizarGridBaterias();
        }
      }, 300);
    });

    el.searchClearBtn.addEventListener('click', () => {
      el.searchInput.value = '';
      state.buscaTexto = '';
      state.identificacao = null;
      if (el.identBateriasList) el.identBateriasList.innerHTML = '';
      el.searchClearBtn.classList.remove('visible');
      el.identBanner.classList.remove('active');
      renderizarGridBaterias();
      el.searchInput.focus();
    });

    el.identCloseBtn.addEventListener('click', () => {
      el.identBanner.classList.remove('active');
      state.identificacao = null;
      if (el.identBateriasList) el.identBateriasList.innerHTML = '';
      renderizarGridBaterias();
    });

    el.btnBackToBaterias.addEventListener('click', () => {
      history.pushState(null, '', window.location.pathname + (state.data ? `?data=${state.data}` : ''));
      showView('baterias');
    });

    el.btnBackToDetail.addEventListener('click', () => {
      if (state.bateriaAtual) {
        const novaUrl = `${window.location.pathname}?session=${encodeURIComponent(state.bateriaAtual.sessionId)}`;
        history.pushState({ sessionId: state.bateriaAtual.sessionId }, '', novaUrl);
        showView('detalhe');
      } else {
        history.pushState(null, '', window.location.pathname + (state.data ? `?data=${state.data}` : ''));
        showView('baterias');
      }
    });

    el.inSessionSearch.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      filtrarTabelaClassificacao(q);
    });

    // --- Modal da Folha A4 ---
    if (el.btnPreviewBateriaSheet) {
      el.btnPreviewBateriaSheet.addEventListener('click', () => {
        if (!state.bateriaAtual) return;
        abrirModalFolhaA4(
          `/api/pdf/bateria/${encodeURIComponent(state.bateriaAtual.sessionId)}`,
          `Folha A4 Oficial · ${state.bateriaAtual.nome}`
        );
      });
    }

    if (el.btnPreviewDriverSheet) {
      el.btnPreviewDriverSheet.addEventListener('click', () => {
        if (!state.bateriaAtual || !state.kartSelecionado) return;
        abrirModalFolhaA4(
          `/api/pdf/piloto/${encodeURIComponent(state.bateriaAtual.sessionId)}/${encodeURIComponent(state.kartSelecionado)}`,
          `Folha A4 Volta a Volta · Kart #${state.kartSelecionado}`
        );
      });
    }

    if (el.sheetModalCloseBtn) {
      el.sheetModalCloseBtn.addEventListener('click', fecharModalFolhaA4);
    }

    if (el.sheetModal) {
      el.sheetModal.addEventListener('click', (e) => {
        if (e.target === el.sheetModal) fecharModalFolhaA4();
      });
    }

    if (el.btnSheetModalPrint) {
      el.btnSheetModalPrint.addEventListener('click', () => {
        try {
          el.sheetModalIframe.contentWindow?.print();
        } catch {
          window.open(el.sheetModalIframe.src + '?print=1', '_blank');
        }
      });
    }

    // PDFs da Bateria
    el.btnDownloadBateriaPdf.addEventListener('click', () => {
      if (!state.bateriaAtual) return;
      window.open(`/api/pdf/bateria/${encodeURIComponent(state.bateriaAtual.sessionId)}`, '_blank');
    });

    el.btnPrintBateria.addEventListener('click', () => {
      if (!state.bateriaAtual) return;
      window.open(`/api/pdf/bateria/${encodeURIComponent(state.bateriaAtual.sessionId)}?print=1`, '_blank');
    });

    // PDFs do Piloto
    el.btnDownloadDriverPdf.addEventListener('click', () => {
      if (!state.bateriaAtual || !state.kartSelecionado) return;
      window.open(`/api/pdf/piloto/${encodeURIComponent(state.bateriaAtual.sessionId)}/${encodeURIComponent(state.kartSelecionado)}`, '_blank');
    });

    el.btnPrintDriver.addEventListener('click', () => {
      if (!state.bateriaAtual || !state.kartSelecionado) return;
      window.open(`/api/pdf/piloto/${encodeURIComponent(state.bateriaAtual.sessionId)}/${encodeURIComponent(state.kartSelecionado)}?print=1`, '_blank');
    });

    // Modal QR Code
    el.btnShareQr.addEventListener('click', () => {
      abrirModalQr();
    });

    el.qrModalCloseBtn.addEventListener('click', () => {
      el.qrModal.classList.remove('active');
    });

    el.qrModal.addEventListener('click', (e) => {
      if (e.target === el.qrModal) el.qrModal.classList.remove('active');
    });

    el.btnCopyShareUrl.addEventListener('click', () => {
      const url = window.location.href;
      navigator.clipboard.writeText(url).then(() => {
        if (el.btnCopyShareLabel) el.btnCopyShareLabel.textContent = 'Link Copiado!';
        setTimeout(() => {
          if (el.btnCopyShareLabel) el.btnCopyShareLabel.textContent = 'Copiar Link Direto';
        }, 2200);
      });
    });

    // Tecla ESC fecha modais
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (el.sheetModal?.classList.contains('active')) fecharModalFolhaA4();
        if (el.qrModal?.classList.contains('active')) el.qrModal.classList.remove('active');
      }
    });
  }

  // --- Troca de Data ---
  async function definirData(novaData) {
    state.data = novaData;
    const today = getTodayIso();
    const yesterday = getYesterdayIso();

    el.btnDateToday.classList.toggle('active', novaData === today);
    el.btnDateYesterday.classList.toggle('active', novaData === yesterday);
    el.btnDateCalendar.classList.toggle('active', novaData !== today && novaData !== yesterday);

    if (novaData !== today && novaData !== yesterday) {
      el.labelCalendarDate.textContent = formatIsoDateToBr(novaData);
    } else {
      el.labelCalendarDate.textContent = 'Outra data';
    }

    el.badgeActiveDate.textContent = novaData === today ? 'Hoje' : (novaData === yesterday ? 'Ontem' : formatIsoDateToBr(novaData));

    await carregarBaterias(novaData);
  }

  // --- Chamadas de API ---
  async function carregarBaterias(dataIso) {
    el.bateriasLoading.style.display = 'flex';
    el.bateriasGrid.style.display = 'none';
    el.bateriasEmpty.style.display = 'none';
    el.bateriasCountLabel.textContent = 'Consultando cronometragem...';

    try {
      const resp = await fetch(`/api/baterias?data=${encodeURIComponent(dataIso)}`);
      if (!resp.ok) throw new Error('Falha ao obter baterias.');

      const dados = await resp.json();
      state.baterias = dados.baterias || [];
      state.datasDisponiveis = dados.datasDisponiveis || [];

      if (!state.baterias.length && state.datasDisponiveis.length && dataIso === getTodayIso()) {
        const ultimaDisponivel = state.datasDisponiveis[0];
        if (ultimaDisponivel && ultimaDisponivel !== dataIso) {
          return definirData(ultimaDisponivel);
        }
      }

      renderizarGridBaterias();
    } catch (err) {
      el.bateriasLoading.style.display = 'none';
      el.bateriasEmpty.style.display = 'block';
      el.bateriasEmpty.innerHTML = `<h3>Falha na conexão</h3><p>${escHtml(err.message)}</p>`;
    }
  }

  function renderizarGridBaterias() {
    el.bateriasLoading.style.display = 'none';

    let lista = state.baterias;

    if (state.tipoFiltro === 'tomada') {
      lista = lista.filter((b) => b.tipo === 'classificacao');
    } else if (state.tipoFiltro === 'corrida') {
      lista = lista.filter((b) => b.tipo === 'corrida');
    }

    if (state.buscaTexto) {
      lista = lista.filter((b) => {
        const nomeMatch = b.nome.toLowerCase().includes(state.buscaTexto);
        const kartMatch = b.podio?.some((p) => String(p.kart).includes(state.buscaTexto));
        const pilotoMatch = b.podio?.some((p) => p.piloto.toLowerCase().includes(state.buscaTexto));
        let identMatch = false;
        if (state.identificacao && Array.isArray(state.identificacao.baterias)) {
          identMatch = state.identificacao.baterias.some((ib) => ib.sessionId === b.sessionId);
        }
        return nomeMatch || kartMatch || pilotoMatch || identMatch;
      });
    }

    el.bateriasCountLabel.textContent = `${lista.length} ${lista.length === 1 ? 'bateria' : 'baterias'}`;

    if (!lista.length) {
      el.bateriasGrid.style.display = 'none';
      el.bateriasEmpty.style.display = 'block';
      return;
    }

    el.bateriasEmpty.style.display = 'none';
    el.bateriasGrid.style.display = 'grid';

    el.bateriasGrid.innerHTML = lista.map((b) => {
      const isCorrida = b.tipo === 'corrida';
      const identBateria = state.identificacao?.baterias?.find((ib) => ib.sessionId === b.sessionId);

      const seuResultadoHtml = identBateria ? `
        <div class="card-seu-resultado">
          <span class="badge-seu-resultado">${ICONS.medal} Seu Resultado</span>
          <span class="card-seu-resultado-pos">${identBateria.posicao ? `${identBateria.posicao}º Lugar` : 'Classificado'}</span>
          <span class="card-seu-resultado-kart">Kart #${escHtml(identBateria.kart)}</span>
          ${identBateria.melhorVoltaFmt ? `<span class="card-seu-resultado-time">${escHtml(identBateria.melhorVoltaFmt)}</span>` : ''}
        </div>
      ` : '';

      const podioHtml = (b.podio || []).map((p) => {
        const classeP = p.posicao === 1 ? 'p1' : (p.posicao === 2 ? 'p2' : 'p3');
        return `
          <div class="podium-mini-pill ${classeP}">
            <div class="podium-mini-pos">${ICONS.medal} ${p.posicao}º LUGAR</div>
            <div class="podium-mini-name" title="${escHtml(p.piloto)}">${escHtml(p.piloto)}</div>
            <div class="podium-mini-kart">Kart #${escHtml(p.kart)} · ${escHtml(p.tempoFmt)}</div>
          </div>
        `;
      }).join('');

      const bestLapHtml = b.melhorVolta ? `
        <div class="card-best-lap">
          <div>
            <div class="card-best-lap-label">${ICONS.zap} Melhor Volta</div>
            <div class="card-best-lap-time">${escHtml(b.melhorVolta.tempoFmt)}</div>
          </div>
          <div class="card-best-lap-driver">
            <b>${escHtml(b.melhorVolta.piloto)}</b><br>
            <span>Kart #${escHtml(b.melhorVolta.kart)}</span>
          </div>
        </div>
      ` : '';

      return `
        <div class="bateria-card" data-session-id="${escHtml(b.sessionId)}" data-kart="${identBateria ? escHtml(identBateria.kart) : ''}">
          <div class="bateria-card-top">
            <span class="bateria-time-badge">${escHtml(b.horario || 'PROVA')}</span>
            <span class="bateria-status-badge">
              ${isCorrida ? ICONS.trophy : ICONS.timer}
              ${isCorrida ? 'Corrida Oficial' : 'Tomada de Tempo'}
            </span>
          </div>

          <h3 class="bateria-title">${escHtml(b.nome)}</h3>

          <div class="bateria-meta-row">
            <span>${ICONS.calendar} ${formatIsoDateToBr(b.data)}</span>
            <span>${ICONS.user} ${b.totalPilotos} pilotos</span>
            <span>${ICONS.flag} Traçado Oficial</span>
          </div>

          ${seuResultadoHtml}
          ${bestLapHtml}

          <div class="card-podium">
            ${podioHtml}
          </div>

          <div class="card-actions">
            <button type="button" class="btn btn-primary btn-open-bateria" data-id="${escHtml(b.sessionId)}" data-kart="${identBateria ? escHtml(identBateria.kart) : ''}">
              Ver Classificação ${ICONS.chevronRight}
            </button>
            <button type="button" class="btn btn-pdf btn-preview-card" data-id="${escHtml(b.sessionId)}" data-nome="${escHtml(b.nome)}" title="Visualizar Folha A4 Oficial">
              ${ICONS.file} A4
            </button>
          </div>
        </div>
      `;
    }).join('');

    el.bateriasGrid.querySelectorAll('.bateria-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-preview-card')) {
          e.stopPropagation();
          const sId = card.getAttribute('data-session-id');
          const title = card.querySelector('.bateria-title')?.textContent || 'Bateria';
          if (sId) abrirModalFolhaA4(`/api/pdf/bateria/${encodeURIComponent(sId)}`, `Folha A4 Oficial · ${title}`);
          return;
        }
        const sId = card.getAttribute('data-session-id');
        const kartDestaque = card.getAttribute('data-kart') || card.querySelector('.btn-open-bateria')?.getAttribute('data-kart') || null;
        if (sId) abrirBateria(sId, kartDestaque);
      });
    });
  }

  // --- Identificação do Piloto ---
  async function executarBuscaIdentificacao(termo) {
    if (el.searchSpinner) el.searchSpinner.style.display = 'block';

    try {
      const resp = await fetch('/api/identificar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identificador: termo }),
      });

      if (!resp.ok) return;

      const data = await resp.json();
      state.identificacao = data;

      if (data.total > 0) {
        el.identBanner.classList.add('active');
        if (data.tipo === 'cliente' && data.piloto) {
          el.identAvatar.textContent = data.piloto.nome.charAt(0).toUpperCase();
          el.identTitle.textContent = data.piloto.nome;
          el.identSub.textContent = `Encontramos ${data.total} ${data.total === 1 ? 'bateria' : 'baterias'} no seu histórico recente.`;
        } else if (data.tipo === 'kart') {
          el.identAvatar.textContent = `#${data.kart}`;
          el.identTitle.textContent = `Kart #${data.kart}`;
          el.identSub.textContent = `Participou de ${data.total} ${data.total === 1 ? 'bateria' : 'baterias'}.`;
        } else {
          el.identAvatar.textContent = termo.charAt(0).toUpperCase();
          el.identTitle.textContent = `Resultados para "${termo}"`;
          el.identSub.textContent = `${data.total} registros encontrados.`;
        }

        if (el.identBateriasList && data.baterias?.length) {
          el.identBateriasList.innerHTML = data.baterias.map((ib) => `
            <button type="button" class="btn-ident-bateria" data-session-id="${escHtml(ib.sessionId)}" data-kart="${escHtml(ib.kart)}">
              <span>${ICONS.flag} <b>${escHtml(ib.nome)}</b> · Kart #${escHtml(ib.kart)}${ib.posicao ? ` (${ib.posicao}º)` : ''}</span>
              ${ICONS.chevronRight}
            </button>
          `).join('');

          el.identBateriasList.querySelectorAll('.btn-ident-bateria').forEach((btn) => {
            btn.addEventListener('click', () => {
              const sId = btn.getAttribute('data-session-id');
              const kart = btn.getAttribute('data-kart');
              if (sId) abrirBateria(sId, kart);
            });
          });
          el.identBateriasList.style.display = 'flex';
        } else if (el.identBateriasList) {
          el.identBateriasList.style.display = 'none';
        }
      } else {
        el.identBanner.classList.remove('active');
        if (el.identBateriasList) el.identBateriasList.style.display = 'none';
      }

      renderizarGridBaterias();
    } catch {
      // falha silenciosa
    } finally {
      if (el.searchSpinner) el.searchSpinner.style.display = 'none';
    }
  }

  // --- Abrir Detalhe da Bateria ---
  async function abrirBateria(sessionId, kartDestaque = null, pushHistory = true, abrirDiretoVoltas = false) {
    el.bateriasLoading.style.display = 'flex';
    showView('detalhe');

    try {
      const resp = await fetch(`/api/bateria/${encodeURIComponent(sessionId)}`);
      if (!resp.ok) throw new Error('Não foi possível carregar a bateria.');

      const bateria = await resp.json();
      state.bateriaAtual = bateria;

      if (pushHistory) {
        const novaUrl = `${window.location.pathname}?session=${encodeURIComponent(sessionId)}${kartDestaque ? `&kart=${encodeURIComponent(kartDestaque)}` : ''}`;
        history.pushState({ sessionId, kart: kartDestaque || undefined }, '', novaUrl);
      }

      el.detailTitle.textContent = bateria.nome;
      el.detailDate.textContent = formatIsoDateToBr(bateria.data);
      el.detailBadgeType.textContent = bateria.tipoRotulo;
      el.detailCriterio.textContent = bateria.criterio;
      el.detailPilotosCount.textContent = bateria.totalPilotos;

      if (bateria.melhorVoltaSessao) {
        el.detailPoleBanner.style.display = 'flex';
        el.detailPoleDriver.textContent = bateria.melhorVoltaSessao.piloto;
        el.detailPoleKart.textContent = `Kart #${bateria.melhorVoltaSessao.kart}`;
        el.detailPoleTime.textContent = bateria.melhorVoltaSessao.tempoFmt;
      } else {
        el.detailPoleBanner.style.display = 'none';
      }

      renderizarTabelaClassificacao(bateria.classificacao, kartDestaque);

      if (abrirDiretoVoltas && kartDestaque) {
        abrirVoltaAVolta(kartDestaque, pushHistory);
      }
    } catch (err) {
      alert(`Erro: ${err.message}`);
      showView('baterias');
    } finally {
      el.bateriasLoading.style.display = 'none';
    }
  }

  function renderizarTabelaClassificacao(classificacao, kartDestaque = null) {
    el.standingsTableBody.innerHTML = classificacao.map((r) => {
      const isDestaque = kartDestaque && String(r.kart) === String(kartDestaque);
      let posBadge = `${r.posicao}º`;
      if (r.posicao === 1) posBadge = `<span class="pos-badge pos-1">1</span>`;
      else if (r.posicao === 2) posBadge = `<span class="pos-badge pos-2">2</span>`;
      else if (r.posicao === 3) posBadge = `<span class="pos-badge pos-3">3</span>`;

      return `
        <tr class="${isDestaque ? 'highlighted' : ''}" data-kart="${escHtml(r.kart)}" data-driver="${escHtml(r.piloto.toLowerCase())}">
          <td class="col-pos">${posBadge}</td>
          <td class="col-kart"><span class="kart-tag">#${escHtml(r.kart)}</span></td>
          <td class="col-driver"><b>${escHtml(r.piloto)}</b></td>
          <td class="col-num">${r.voltas}</td>
          <td class="col-best-lap ${r.isMelhorVoltaSessao ? 'overall-best' : ''}">
            ${escHtml(r.melhorVoltaFmt)}
          </td>
          <td class="col-num">${escHtml(r.difLider)}</td>
          <td class="col-num">${escHtml(r.difAnterior)}</td>
          <td class="col-num">${escHtml(r.velocidadeKmh)}</td>
          <td class="row-actions-cell">
            <button type="button" class="row-btn btn-view-laps" data-kart="${escHtml(r.kart)}" title="Ver telemetria volta a volta">
              ${ICONS.timer} Voltas
            </button>
            <button type="button" class="row-btn btn-view-driver-pdf" data-kart="${escHtml(r.kart)}" title="Visualizar folha A4 deste piloto">
              ${ICONS.file} A4
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Toque na linha inteira abre o volta a volta do piloto (UX tátil no mobile)
    el.standingsTableBody.querySelectorAll('tr[data-kart]').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.btn-view-driver-pdf') || e.target.closest('.btn-view-laps')) return;
        const kart = row.getAttribute('data-kart');
        if (kart) abrirVoltaAVolta(kart);
      });
    });

    el.standingsTableBody.querySelectorAll('.btn-view-laps').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const kart = btn.getAttribute('data-kart');
        abrirVoltaAVolta(kart);
      });
    });

    el.standingsTableBody.querySelectorAll('.btn-view-driver-pdf').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const kart = btn.getAttribute('data-kart');
        if (!state.bateriaAtual) return;
        abrirModalFolhaA4(
          `/api/pdf/piloto/${encodeURIComponent(state.bateriaAtual.sessionId)}/${encodeURIComponent(kart)}`,
          `Folha A4 Volta a Volta · Kart #${kart}`
        );
      });
    });

    if (kartDestaque) {
      const rowDest = el.standingsTableBody.querySelector(`tr[data-kart="${kartDestaque}"]`);
      if (rowDest) {
        setTimeout(() => rowDest.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
      }
    }
  }

  function filtrarTabelaClassificacao(termo) {
    const rows = el.standingsTableBody.querySelectorAll('tr');
    rows.forEach((row) => {
      const kart = row.getAttribute('data-kart') || '';
      const driver = row.getAttribute('data-driver') || '';
      const bateu = !termo || kart.includes(termo) || driver.includes(termo);
      row.style.display = bateu ? '' : 'none';
    });
  }

  // --- Abrir Telemetria Volta a Volta ---
  async function abrirVoltaAVolta(kart, pushHistory = true) {
    if (!state.bateriaAtual) return;
    state.kartSelecionado = kart;

    if (pushHistory) {
      const novaUrl = `${window.location.pathname}?session=${encodeURIComponent(state.bateriaAtual.sessionId)}&kart=${encodeURIComponent(kart)}`;
      history.pushState({ sessionId: state.bateriaAtual.sessionId, kart }, '', novaUrl);
    }

    showView('volta');
    el.lapsTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px;"><div class="spinner" style="margin:0 auto 10px;"></div>Carregando telemetria volta a volta do Kart #${escHtml(kart)}...</td></tr>`;

    const pilotoInfo = state.bateriaAtual.classificacao.find((r) => String(r.kart) === String(kart));
    el.telKartBadge.textContent = `#${kart}`;
    el.telDriverName.textContent = pilotoInfo?.piloto || `Piloto Kart #${kart}`;
    el.telBateriaName.textContent = `${state.bateriaAtual.nome} · Traçado Oficial`;

    try {
      const resp = await fetch(`/api/bateria/${encodeURIComponent(state.bateriaAtual.sessionId)}/voltas?kart=${encodeURIComponent(kart)}`);
      if (!resp.ok) throw new Error('Não foi possível carregar as voltas.');

      const dados = await resp.json();
      const kData = dados.pilotos?.[0];

      if (!kData || !kData.voltas?.length) {
        el.lapsTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px;">Nenhuma volta registrada para este kart.</td></tr>`;
        return;
      }

      el.telBestLap.textContent = kData.melhorVoltaFmt || '—';
      el.telAvgLap.textContent = kData.mediaVoltaFmt || '—';
      el.telLapCount.textContent = kData.totalVoltas || '0';

      el.lapsTableBody.innerHTML = kData.voltas.map((l) => {
        const rowClass = l.isPersonalBest ? 'lap-best-row' : '';
        const timeClass = l.isSessionBest ? 'lap-session-best' : (l.isPersonalBest ? 'lap-best-time' : '');

        return `
          <tr class="${rowClass}">
            <td class="col-pos">${l.volta}</td>
            <td class="col-best-lap ${timeClass}">${escHtml(l.tempoFmt)}</td>
            <td class="col-num">${escHtml(l.dmv)}</td>
            <td class="col-num">${escHtml(l.dlcat)}</td>
            <td class="col-num">${escHtml(l.velocidadeKmh)}</td>
            <td class="col-num" style="text-align:center;">${escHtml(l.hora)}</td>
            <td>${l.anulada ? '<span style="color:#d9534f;font-weight:bold;">Anulada</span>' : (l.penalidade ? escHtml(l.penalidade) : 'Regular')}</td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      el.lapsTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:#d9534f;">Erro ao buscar voltas: ${escHtml(err.message)}</td></tr>`;
    }
  }

  // --- Modal QR Code ---
  function abrirModalQr() {
    el.qrCodeContainer.innerHTML = '';
    const url = window.location.href;

    const qrImg = document.createElement('img');
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=030504&margin=4`;
    qrImg.alt = 'QR Code do Resultado';
    qrImg.style.width = '220px';
    qrImg.style.height = '220px';
    qrImg.style.display = 'block';

    el.qrCodeContainer.appendChild(qrImg);
    el.qrModal.classList.add('active');
  }

  // Inicializa quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
