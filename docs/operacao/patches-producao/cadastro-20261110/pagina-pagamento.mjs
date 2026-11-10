// pagina-base.html (a página que estava no ar em 10/11/2026) + link do grupo (?r=): etapa de pagamento, progresso,
// validação ao sair do campo e acessibilidade. CSS em pagina-extra.css, JS em pagina-extra.js.
import { readFileSync, writeFileSync } from 'node:fs';
let h = readFileSync('pagina-base.html', 'utf8');
const css = readFileSync('pagina-extra.css', 'utf8');
const js = readFileSync('pagina-extra.js', 'utf8');
const troca = (de, para) => { if (!h.includes(de)) throw new Error('não achei: ' + de.slice(0, 80)); h = h.replace(de, () => para); };

troca('</style>', css + '</style>');

// cabeçalho e progresso
troca('<div class="passos"><span>1 · Cadastro aqui</span>', '<div class="passos" id="passos"><span>1 · Cadastro aqui</span>');
troca('<main>\n  <div class="banner-grupo"', '<main>\n  <div class="progresso" id="progresso"><div class="trilho" role="progressbar" aria-label="Preenchimento do cadastro" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="progBarra"></i></div><span id="progTxt">Faltam 14 itens</span><button type="button" class="progir" id="progIr">Ver o que falta</button></div>\n  <div class="banner-grupo"');
troca('<strong>Reserva em grupo vinculada!</strong>', '<strong id="grupoTitulo">Reserva em grupo vinculada!</strong>');
troca('<span>Preencha seus dados completos. Sua vaga será confirmada e o termo de responsabilidade sairá impresso com todos os dados na recepção.</span>', '<span id="grupoTexto">Preencha seus dados completos. O termo de responsabilidade sai impresso na recepção.</span>');
troca('<div class="erro" id="erro" role="alert"></div>', '<div class="erro" id="erro" role="alert"></div>\n    <p class="legenda"><span class="obrig" aria-hidden="true">*</span> campo obrigatório</p>');

// textos curtos
troca('Celular e e-mail obrigatórios para avisos da reserva e envio do resultado com seus tempos.', 'Para avisos da reserva e o resultado com seus tempos.');
troca('Data de nascimento e peso obrigatórios para segurança na pista e equilíbrio dos karts.', 'Segurança na pista e equilíbrio dos karts.');
troca('Obrigatório para o termo de responsabilidade impresso na recepção. Digite o CEP para preencher automaticamente.', 'Para o termo impresso. Digite o CEP e o resto se preenche.');

// campos: UF com largura útil, teclado e preenchimento automático
troca('<div class="c3"><label for="bairro">Bairro <span class="obrig">*</span></label><input id="bairro" placeholder="Bairro" required>', '<div class="c2"><label for="bairro">Bairro <span class="obrig">*</span></label><input id="bairro" autocomplete="address-level3" placeholder="Bairro" required>');
troca('<div class="c1" style="grid-column: span 1">', '<div class="c2">');
troca('<input id="peso" inputmode="decimal" placeholder="Ex.: 72" required>', '<input id="peso" inputmode="decimal" autocomplete="off" enterkeyhint="next" placeholder="Ex.: 72" required>');
troca('<input id="numero" inputmode="numeric" placeholder="Número ou S/N" required>', '<input id="numero" inputmode="text" autocomplete="off" enterkeyhint="next" placeholder="Número ou S/N" required>');
troca('<input id="instagram" name="instagram" autocomplete="off"', '<input id="instagram" name="instagram" enterkeyhint="next" autocomplete="off"');

// tela final: corrigir dados e ajuda
troca('    </div>\n  </section>\n</main>', `    </div>
    <section class="dia" id="diaCorrida" aria-labelledby="diaTitulo">
      <h3 id="diaTitulo">No dia da corrida</h3>
      <ul>
        <li><b>Chegue pelo menos 1 hora antes</b> do horário da sua bateria.</li>
        <li><b>Calçado fechado</b> é obrigatório.</li>
        <li><b>Para correr:</b> idade mínima de 14 anos, altura acima de 1,50 m e peso acima de 50 kg.</li>
        <li><b>Menor de idade:</b> traga o documento do menor e do responsável. O responsável assina o termo.</li>
      </ul>
      <p class="end">Avenida Adutora Várzea das Flores, 477 · Itacolomi, Betim - MG, 32672-586</p>
      <a class="secundario" href="https://maps.app.goo.gl/PvXUGXEMDeXDYKJBA" target="_blank" rel="noopener">Como chegar</a>
    </section>
    <button type="button" class="corrigir" id="corrigir">Corrigir meus dados</button>
    <details id="ajudaPag" hidden><summary>Problema com o pagamento?</summary>
      <p>Se a página de pagamento não abrir ou o Pix não confirmar, fale com a recepção. Seu cadastro já está salvo.</p>
      <a class="secundario" href="https://wa.me/5531998842898" rel="noopener">WhatsApp (31) 99884-2898</a>
    </details>
  </section>
</main>`);
troca('<p id="prontoSub">Seu cadastro foi recebido.</p>', '<p id="prontoSub">Seu cadastro foi recebido.</p>\n    <div class="pagar" id="pagarCaixa" hidden></div>');

// script: grupo, pagamento, progresso e validação ao sair do campo
troca("    if (banner) banner.style.display = 'flex';\n  }", "    if (banner) banner.style.display = 'flex';\n  }\n" + js);

// consistência do termo, busca por CPF só com CPF válido e cadastro localizado
troca('<p class="rodape">O termo de responsabilidade é assinado no kartódromo, no dia da corrida.</p>', '<p class="rodape">Você assina o termo de responsabilidade na recepção, no dia da corrida, já com seus dados impressos.<br>Dúvidas? <a href="https://wa.me/5531998842898" rel="noopener">WhatsApp (31) 99884-2898</a></p>');
troca('<span>Li e concordo com o Termo de Consentimento para Tratamento de Dados Pessoais.</span>', '<span>Li e concordo com o Termo de Consentimento para Tratamento de Dados Pessoais. <span class="obrig">*</span></span>');
troca('<label for="peso">Peso (kg) <span class="obrig">*</span></label>', '<label for="peso">Peso (kg) <span class="obrig">*</span> <span class="op">(20 a 250)</span></label>');
troca('3. Confira seus dados e retire seu termo completo na recepção.', '3. Confira seus dados e assine o termo na recepção.');
troca("if (isEmail ? raw.length < 5 : (d.length < 5 && raw.length < 5)) return;", "if (isEmail ? raw.length < 5 : (d.length < 5 && raw.length < 5)) return;\n    if (!isEmail && tipo === 'CPF' && !cpfOk(raw)) return;");
troca("<strong>Cadastro localizado!</strong>\n        <span>Dados de <b>${c.nome || 'piloto'}</b> preenchidos automaticamente. Você pode alterar qualquer informação antes de concluir.</span>", "<strong>Você já tem cadastro aqui</strong>\n        <span>Preenchemos seus dados. Confira e altere o que precisar antes de concluir.</span><button type=\"button\" class=\"nao-sou\">Não sou eu: limpar</button>");
troca("if (!iso(nasc.value)) return erro('Informe a data de nascimento completa (DD/MM/AAAA).', nasc);", "if (!dataOk(nasc.value)) return erro('Informe uma data de nascimento válida, como 25/12/1990.', nasc);");
troca('<h2><span class="n">5</span>Menores que vão correr com você</h2>', '<h2><span class="n">5</span>Menores com você</h2>');
troca('<div class="oculto" aria-hidden="true">', '<div class="oculto" aria-hidden="true" inert>');
// envio
troca("    if (!$('lgpd').checked)", "    if (grupo && grupo.aCobrarCentavos > 0 && tipo !== 'CPF') return erro('Para pagar pelo link do grupo, use o CPF.', doc);\n    if (!$('lgpd').checked)");
troca("      $('form').style.display = 'none';\n", "      $('form').style.display = 'none';\n      $('progresso').style.display = 'none';\n");
troca(`      if (tokenReserva) {
        $('prontoSub').textContent = 'Seu cadastro foi recebido e vinculado à sua reserva em grupo.';`, `      if (j.pagamento) mostrarPagamento(j.pagamento, j.grupo);
      if (tokenReserva && !(j.pagamento && !j.pagamento.pago)) {
        $('prontoSub').textContent = 'Seu cadastro foi recebido e vinculado ao grupo' + (j.grupo ? ' de ' + j.grupo.responsavel + ' · ' + j.grupo.bateria + ' · ' + quando(j.grupo.inicio) : '') + '.';`);
troca("3. Sua vaga está garantida e seu termo sairá completo na recepção!';", "3. Você assina o termo na recepção.';\n      }\n      if (tokenReserva && j.pagamento && !j.pagamento.pago) {\n        $('prontoSub').textContent = 'Seu cadastro já foi recebido. Pague para garantir a vaga.';\n        $('prontoInstrucao').innerHTML = '1. Pague acima por Pix ou cartão.<br>2. No kartódromo, digite seu <b>' + (tipo === 'Passaporte' ? 'passaporte' : tipo) + '</b> no totem.<br>3. Você assina o termo na recepção.';");
troca("btn.disabled = false; btn.textContent = 'Concluir cadastro';", "btn.disabled = false; btn.textContent = rotuloEnviar;");
troca("window.scrollTo({ top: 0, behavior: 'smooth' });\n    } catch", "if (j.pagamento && !j.pagamento.pago) $('pagarCaixa').scrollIntoView({ behavior: 'smooth', block: 'center' }); else window.scrollTo({ top: 0, behavior: 'smooth' });\n    } catch");
writeFileSync('pagina-grupo.html', h);
console.log('ok', h.length);
