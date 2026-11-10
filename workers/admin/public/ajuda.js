'use strict';
/* Ajuda e tutorial: tour de boas-vindas (abre sozinho no primeiro acesso de cada usuário) e a tela "Ajuda e tutorial".
   Depende de app.js (carregado antes). Nada vai para o servidor: só lembramos neste navegador que o tour já foi visto. */

const AJUDA_IC = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.2a2.6 2.6 0 1 1 3.6 2.4c-.7.4-1.1.9-1.1 1.7M12 17h.01';
NAV.find((g) => g.t === 'Sistema').itens.push(['ajuda', 'Ajuda e tutorial', AJUDA_IC, G('var(--kib-cor-categoria-azul-topo)', 'var(--kib-cor-estado-info-solido)')]);

const TOUR = [
  { t: 'Bem-vindo ao painel do kartódromo', d: 'Aqui você agenda, confirma pagamentos e acompanha tudo. É a mesma agenda da Recepção, dos totens e do site: o que você muda aparece em todos na hora.', pontos: ['Dá para usar no computador ou no celular.', 'Este tour leva 1 minuto. Para rever depois: menu Ajuda e tutorial.'] },
  { t: 'O menu à esquerda', d: 'Cada item é uma parte da operação.', pontos: ['Visão geral: o que precisa de você agora.', 'Agenda: horários, reservas e quem já pagou.', 'Recepção: quem chegou, caixa e pagamentos do dia.', 'Pilotos e Reservas online: cadastros e pedidos de clientes.'] },
  { t: 'Agendar uma reserva por telefone', d: 'Na Agenda, toque em Nova reserva (ou aperte N).', pontos: ['1. Escolha o dia, o horário e quantos pilotos.', '2. Busque o responsável pelo nome, CPF ou telefone.', '3. Marque como o cliente chegou: WhatsApp, Telefone, Recepção ou Site.', '4. Preencha o que souber dos outros pilotos e salve.'] },
  { t: 'Como o grupo vai pagar', d: 'Cada reserva tem um modo de pagamento, que você escolhe ao salvar.', pontos: ['O responsável paga tudo: um link Pix/cartão com o valor do grupo.', 'Cada um paga o seu: cada piloto recebe o próprio link.', 'Sinal agora, resto na recepção: o responsável paga uma parte.', 'O pagamento cai sozinho na reserva (confere a cada minuto).'] },
  { t: 'Confirmar pagamentos', d: 'Abra a bateria na Agenda e veja cada piloto.', pontos: ['Cobrar: envia o link de pagamento pelo WhatsApp.', 'Recebi: use quando o cliente pagou por fora (Pix direto, dinheiro).', 'A Agenda mostra em R$ quanto falta receber em cada horário.'] },
  { t: 'Cadastros e acompanhamento', d: 'Cada piloto precisa de cadastro com documento, peso e telefone para usar o totem.', pontos: ['Reenviar link: manda o cadastro individual pelo WhatsApp.', 'Reservas online: pedidos do site, para aprovar ou resolver.', 'O contato com o cliente continua no Kommo; aqui os botões abrem o WhatsApp com a mensagem pronta.'] },
  { t: 'Pronto! Onde achar ajuda', d: 'A tela Ajuda e tutorial tem o passo a passo de cada tarefa, atalhos e respostas para as dúvidas comuns.', pontos: ['Aperte ? em qualquer tela para abrir a ajuda.', 'Esc fecha janelas e gavetas.'] },
];

const lembrete = {
  chave: () => 'kib-tour-' + ((S.usuario && S.usuario.login) || (S.usuario && S.usuario.nome) || 'x'),
  visto() { try { return !!localStorage.getItem(this.chave()); } catch { return true; } },
  marcar() { try { localStorage.setItem(this.chave(), '1'); } catch { /* sem armazenamento: o tour só reaparece no próximo acesso */ } },
};

function abrirTour(i = 0) {
  const passo = TOUR[i], ultimo = i === TOUR.length - 1;
  const m = modal(`<div style="padding: var(--kib-espaco-3) var(--kib-espaco-3) var(--kib-espaco-2); display: flex; flex-direction: column; gap: var(--kib-espaco-denso-12); max-width: 520px; margin: 0 auto">
      <span class="peq" style="font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--verde)">Passo ${i + 1} de ${TOUR.length}</span>
      <h2 id="tourTitulo" style="margin: 0; font-size: var(--kib-fonte-tamanho-titulo-grande); letter-spacing: -0.02em">${esc(passo.t)}</h2>
      <p style="margin: 0; font-size: var(--kib-fonte-tamanho-subtitulo); line-height: 1.5; color: var(--tinta2)">${esc(passo.d)}</p>
      <ul style="margin: 0; padding-left: var(--kib-espaco-2); display: flex; flex-direction: column; gap: var(--kib-espaco-meio); font-size: var(--kib-fonte-tamanho-corpo); line-height: 1.45">${passo.pontos.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      <div style="display: flex; gap: var(--kib-espaco-meio); justify-content: center" aria-hidden="true">${TOUR.map((_, k) => `<span style="width: ${k === i ? 20 : 7}px; height: 7px; border-radius: var(--kib-raio-chip); background: ${k === i ? 'var(--verde)' : 'var(--kib-cor-borda-sutil)'}"></span>`).join('')}</div>
      <div class="linha gap-1">
        <button class="btn sec" data-tour="pular">${ultimo ? 'Fechar' : 'Pular tour'}</button>
        <span class="cresce"></span>
        ${i > 0 ? '<button class="btn sec" data-tour="voltar">Voltar</button>' : ''}
        <button class="btn prim" data-tour="${ultimo ? 'fim' : 'proximo'}">${ultimo ? 'Começar a usar' : 'Próximo'}</button>
      </div></div>`);
  m.setAttribute('aria-labelledby', 'tourTitulo');
  m.style.maxWidth = '560px';
  m.querySelector('[data-tour="proximo"], [data-tour="fim"]').focus();
  m.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tour]'); if (!b) return;
    const a = b.dataset.tour;
    if (a === 'proximo') abrirTour(i + 1);
    else if (a === 'voltar') abrirTour(i - 1);
    else { lembrete.marcar(); fecharCamada(); if (a === 'fim') { location.hash = '#/visao'; } }
  });
}

// primeiro acesso: o tour abre sozinho assim que o painel aparece (também logo depois de entrar, sem recarregar)
new MutationObserver(() => {
  if (S.token && document.querySelector('.app') && !S.tourChecado) {
    S.tourChecado = true;
    if (!lembrete.visto() && !$('#camada').innerHTML) setTimeout(() => abrirTour(0), 600);
  } else if (!document.querySelector('.app')) S.tourChecado = false;
}).observe(document.getElementById('raiz'), { childList: true });

document.addEventListener('keydown', (e) => {
  if (e.key !== '?' || !S.token || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (/^#\/agenda/.test(location.hash)) return; // na agenda a tecla ? abre a ajuda da própria agenda
  location.hash = '#/ajuda';
});

// ------------------------------------------------------------------ tela Ajuda e tutorial
const GUIAS = [
  { id: 'comecar', t: 'Primeiros passos', corpo: () => `
    <p>O painel mostra a mesma agenda da Recepção, do site e dos totens. Tudo que você muda aqui aparece nos outros na hora.</p>
    <ol><li>Entre com seu usuário e senha e aceite os termos.</li><li>Comece pela <b>Visão geral</b>: o quadro “Precisa de você agora” lista o que está pendente.</li><li>Use a <b>Agenda</b> para ver e criar reservas.</li><li>Troque sua senha com a administração se achar que alguém a viu.</li></ol>
    <button class="btn prim" data-rever-tour="1">Rever o tour de boas-vindas</button>` },
  { id: 'agendar', t: 'Agendar por telefone', corpo: () => `
    <ol><li>Agenda → <b>Nova reserva</b> (ou tecla N).</li><li>Escolha o dia, o horário e a quantidade de pilotos. Só aparecem horários com vagas para o grupo inteiro.</li><li>Busque o <b>responsável</b> por nome, CPF ou telefone. Se não existir, ele faz o cadastro pelo link e aparece na busca.</li><li>Marque <b>Chegou por</b>: WhatsApp, Telefone, Recepção ou Site. Isso ajuda a medir de onde vêm as reservas.</li><li>Preencha os outros pilotos (nome e WhatsApp, se souber). Quem ficar sem nome completa pelo próprio link.</li><li>Marque pilotos <b>Menores</b> como “Menor”.</li><li>Escolha como o grupo vai pagar e salve. Deixe ligado “mostrar os links de cadastro” para mandar no WhatsApp.</li></ol>
    <p class="peq">Para mudar um horário já reservado, abra a bateria na Agenda e use as opções da reserva.</p>` },
  { id: 'pagamentos', t: 'Confirmar pagamentos', corpo: () => `
    <p>Há três modos, definidos ao salvar a reserva:</p>
    <ul><li><b>O responsável paga tudo</b>: um link Asaas (Pix ou cartão) com o valor do grupo.</li><li><b>Cada um paga o seu</b>: cada piloto recebe o próprio link.</li><li><b>Sinal agora, resto na recepção</b>: o responsável paga uma parte e o resto é acertado ao chegar.</li></ul>
    <p>Na reserva aberta, cada piloto tem:</p>
    <ul><li><b>Cobrar</b>: manda o link de pagamento pelo WhatsApp.</li><li><b>Recebi</b>: registra pagamento feito por fora (Pix direto, dinheiro, cartão na maquininha).</li><li><b>Estornar</b>: desfaz um pagamento lançado errado.</li></ul>
    <p>Quando o pagamento cai no Asaas, a reserva se atualiza sozinha em até 1 minuto. Na Agenda, “A receber” soma quanto falta em R$.</p>` },
  { id: 'cadastros', t: 'Cadastros e acompanhamento', corpo: () => `
    <p>Para usar o totem, o piloto precisa de documento, peso e telefone cadastrados.</p>
    <ul><li><b>Link de cadastro</b>: cada piloto do grupo tem o seu. Use “Enviar link” ou “Reenviar link”.</li><li><b>Pilotos</b>: busca por nome ou CPF, histórico e dados da carreira.</li><li><b>Reservas online</b>: pedidos feitos no site. Aprove ou resolva um a um.</li></ul>
    <p>O follow-up com o cliente (conversa, remarcação, lembrete) continua no <b>Kommo</b>. O painel não envia mensagens sozinho: os botões abrem o WhatsApp com o texto pronto e você envia.</p>` },
  { id: 'atalhos', t: 'Atalhos do teclado', corpo: () => `
    <table class="tabelaAjuda"><tbody>
      <tr><td><kbd>N</kbd></td><td>Nova reserva (na Agenda)</td></tr><tr><td><kbd>T</kbd></td><td>Voltar para hoje</td></tr>
      <tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>Dia ou semana anterior e seguinte</td></tr><tr><td><kbd>D</kbd> <kbd>S</kbd> <kbd>L</kbd></td><td>Vista Dia, Semana ou Lista</td></tr>
      <tr><td><kbd>Esc</kbd></td><td>Fechar janela ou gaveta</td></tr><tr><td><kbd>?</kbd></td><td>Abrir esta ajuda</td></tr></tbody></table>` },
  { id: 'duvidas', t: 'Dúvidas frequentes', corpo: () => `
    <details><summary>“Sua sessão terminou”</summary><p>Entre de novo com seu usuário e senha. Isso acontece depois de um tempo sem uso.</p></details>
    <details><summary>Não achei um horário na lista da Nova reserva</summary><p>Só aparecem horários com vagas para o grupo inteiro. Reduza a quantidade de pilotos ou escolha outro horário. Segunda-feira o kartódromo não abre.</p></details>
    <details><summary>O cliente pagou e não apareceu pago</summary><p>Espere até 1 minuto. Se continuar, confira se o pagamento foi no link certo e use <b>Recebi</b> para lançar à mão.</p></details>
    <details><summary>“O servidor do kartódromo não respondeu”</summary><p>Veja o quadro de conexão no rodapé do menu. Se o servidor ou a cronometragem (indicadas ali) estiverem sem resposta, avise a administração.</p></details>
    <details><summary>O piloto não consegue usar o totem</summary><p>Confira se ele tem documento, peso e telefone cadastrados. Mande o link de cadastro de novo.</p></details>` },
];

TELAS.ajuda = async (tela) => {
  const A = S.ajuda || (S.ajuda = { guia: 'comecar' });
  const pintar = () => {
    const g = GUIAS.find((x) => x.id === A.guia) || GUIAS[0];
    tela.innerHTML = `${cabecalho('Passo a passo para a equipe', 'Ajuda e tutorial')}
      <main class="principal"><div class="cartao" style="padding: var(--kib-espaco-1) var(--kib-espaco-1) var(--kib-espaco-denso-20)">
        <div role="tablist" aria-label="Assuntos da ajuda" class="seg" style="margin: var(--kib-espaco-1); flex-wrap: wrap">${GUIAS.map((x) => `<button type="button" role="tab" aria-selected="${x.id === g.id}" data-guia="${x.id}" class="${x.id === g.id ? 'sel' : ''}">${x.t}</button>`).join('')}</div>
        <div role="tabpanel" class="textoAjuda" style="padding: var(--kib-espaco-1) var(--kib-espaco-2); max-width: 760px; font-size: var(--kib-fonte-tamanho-subtitulo); line-height: 1.55"><h2 style="margin: var(--kib-espaco-meio) 0 var(--kib-espaco-1); font-size: var(--kib-fonte-tamanho-titulo-grande)">${g.t}</h2>${g.corpo()}</div>
      </div></main>`;
  };
  tela.addEventListener('click', (e) => {
    const b = e.target.closest('[data-guia]'); if (b) { A.guia = b.dataset.guia; pintar(); return; }
    if (e.target.closest('[data-rever-tour]')) abrirTour(0);
  });
  pintar();
};
