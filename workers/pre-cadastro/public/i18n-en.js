// Versão em inglês do cadastro e do painel do grupo (13/11/2026, paridade com o Granja Viana). As páginas são escritas
// em português; com o idioma "en" (botão EN, ?lang=en ou escolha salva), um observador troca os textos da tela (nós de
// texto e atributos de acessibilidade/placeholder) pelo dicionário e pelas regras abaixo. Valores digitados não mudam.
// O texto jurídico do termo continua em português (vale o original).
(function () {
  var q = new URLSearchParams(location.search).get('lang');
  var lang = q === 'en' || q === 'pt' ? q : null;
  try { if (!lang) lang = localStorage.getItem('kib-idioma'); } catch (e) { /* ok */ }
  if (lang !== 'en') lang = 'pt';
  try { if (q) localStorage.setItem('kib-idioma', lang); } catch (e) { /* ok */ }

  var D = {
    'Faça seu cadastro': 'Register', 'antes de chegar': 'before you arrive',
    'Preencha uma vez aqui. No kartódromo, é só digitar seu CPF no totem de autoatendimento e escolher a bateria.': 'Fill this in once. At the track, just type your ID number at the self-service kiosk and choose your session.',
    '1 · Cadastro aqui': '1 · Register here', '2 · CPF no totem': '2 · ID at the kiosk', '3 · Pista!': '3 · Race!',
    'Ver o que falta': 'See what is missing', 'Reserva em grupo vinculada!': 'Group booking linked!',
    'Preencha seus dados completos. O termo de responsabilidade sai impresso na recepção.': 'Fill in all your details. The liability waiver is printed at the front desk.',
    'Já chegou? Faça o check-in': 'Already here? Check in',
    'Cadastro já feito? Informe seu CPF: o termo vai direto para a impressora da recepção, é só conferir e assinar no balcão.': 'Already registered? Enter your CPF: the waiver goes straight to the front desk printer, just check it and sign at the counter.',
    'Seu CPF': 'Your CPF', 'Cheguei! Fazer check-in': 'I am here! Check in', 'campo obrigatório': 'required field',
    'Documento': 'Document', 'É com ele que o totem encontra seu cadastro.': 'The kiosk finds your registration with it.',
    'RG': 'ID card (RG)', 'Passaporte': 'Passport', 'Nome completo': 'Full name', 'Contato': 'Contact',
    'Para avisos da reserva e o resultado com seus tempos.': 'For booking notices and your lap times.',
    'Celular (WhatsApp)': 'Mobile (WhatsApp)', 'Sobre você': 'About you', 'Segurança na pista e equilíbrio dos karts.': 'Track safety and kart balance.',
    'Data de nascimento': 'Date of birth', 'Peso (kg)': 'Weight (kg)', '(20 a 250)': '(20 to 250)',
    'Endereço completo': 'Full address', 'Para o termo impresso. Digite o CEP e o resto se preenche.': 'For the printed waiver. Type the postal code (CEP) and the rest fills in.',
    'CEP': 'Postal code (CEP)', 'Rua / Endereço': 'Street / Address', 'Número': 'Number', 'Complemento': 'Address line 2', '(opcional)': '(optional)',
    'Bairro': 'District', 'Cidade': 'City', 'UF': 'State',
    'Menores com você': 'Minors with you', 'Opcional. Filhos ou menores sob sua responsabilidade.': 'Optional. Children or minors in your care.',
    '+ Adicionar menor': '+ Add a minor', 'Nome completo do menor': 'Minor’s full name',
    'Termo de responsabilidade': 'Liability waiver', 'Leia e aceite agora. No dia, a recepção só confere e você assina o impresso.': 'Read and accept it now. On the day, the front desk just checks it and you sign the printed copy.',
    'Li e aceito o Termo de Responsabilidade.': 'I have read and accept the Liability Waiver.',
    'Não autorizo o uso da minha imagem em fotos e vídeos do kartódromo.': 'I do not authorize the use of my image in the track’s photos and videos.',
    'Li e concordo com o Termo de Consentimento para Tratamento de Dados Pessoais.': 'I have read and agree to the Personal Data Processing Consent.',
    'Ler o termo': 'Read the waiver (in Portuguese)',
    'Ao se cadastrar, você autoriza o Kartódromo Internacional de Betim a tratar seus dados pessoais (nome, documento, contato, data de nascimento, peso e endereço) para identificar você nas baterias e corridas, emitir o termo de responsabilidade, registrar tempos e resultados, cumprir obrigações legais e entrar em contato sobre suas reservas.': 'By registering, you authorize Kartódromo Internacional de Betim to process your personal data (name, document, contact, date of birth, weight and address) to identify you in sessions and races, issue the liability waiver, record times and results, meet legal obligations and contact you about your bookings.',
    'Os dados ficam armazenados nos sistemas do kartódromo e não são vendidos a terceiros. Você pode pedir a qualquer momento, na recepção, acesso, correção ou exclusão dos seus dados, nos termos da Lei nº 13.709/2018 (LGPD).': 'Your data is stored in the track’s systems and is never sold. You may ask the front desk at any time to access, correct or delete your data, under Brazilian Law 13.709/2018 (LGPD).',
    'Cupom de desconto': 'Discount coupon', 'Tem um cupom? O desconto já sai no valor da sua vaga.': 'Have a coupon? The discount comes off your spot price.',
    'Código do cupom': 'Coupon code', 'Concluir cadastro': 'Finish registration', 'Concluir e ir para o pagamento': 'Finish and go to payment',
    'No dia da corrida, a recepção confere seus dados e você assina o termo impresso.': 'On race day, the front desk checks your details and you sign the printed waiver.',
    'Dúvidas?': 'Questions?', 'Tudo certo!': 'All set!', 'Seu cadastro foi recebido.': 'Your registration was received.',
    'Quando chegar ao kartódromo:': 'When you arrive at the track:', '1. Vá ao totem de autoatendimento ou à recepção.': '1. Go to the self-service kiosk or the front desk.',
    '2. Digite seu': '2. Type your', '(ou e-mail).': '(or e-mail).', '3. Confira seus dados e assine o termo na recepção.': '3. Check your details and sign the waiver at the front desk.',
    'No dia da corrida': 'On race day', 'Chegue pelo menos 1 hora antes': 'Arrive at least 1 hour early', 'do horário da sua bateria.': 'before your session.',
    'Calçado fechado': 'Closed-toe shoes', 'é obrigatório.': 'are required.', 'Para correr:': 'To race:',
    'idade mínima de 14 anos, altura acima de 1,50 m e peso acima de 50 kg.': 'minimum age 14, height over 1.50 m and weight over 50 kg.',
    'Menor de idade:': 'Minors:', 'traga o documento do menor e do responsável. O responsável assina o termo.': 'bring the minor’s and the guardian’s ID. The guardian signs the waiver.',
    'Como chegar': 'Directions', 'Corrigir meus dados': 'Fix my details', 'Problema com o pagamento?': 'Problem with the payment?',
    'Se a página de pagamento não abrir ou o Pix não confirmar, fale com a recepção. Seu cadastro já está salvo.': 'If the payment page does not open or Pix does not confirm, contact the front desk. Your registration is already saved.',
    'Preenchimento do cadastro': 'Registration progress', 'Como no documento': 'As on your document', 'Nome da rua ou avenida': 'Street or avenue name',
    'Número ou S/N': 'Number or S/N', 'Apto, bloco, etc.': 'Apt, block, etc.', 'Ex.: 72': 'E.g. 72', 'DD/MM/AAAA': 'DD/MM/YYYY',
    'Texto do termo de responsabilidade': 'Liability waiver text', 'Número do passaporte': 'Passport number', 'Tipo de documento': 'Document type',
    'Buscando cadastro no kartódromo…': 'Looking up your registration…', 'Primeira vez aqui? Complete seus dados abaixo para continuar.': 'First time here? Fill in your details below to continue.',
    'Não sou eu': 'Not me', 'Preencha uma vez aqui e pague no final.': 'Fill this in once and pay at the end.',
    'CPF inválido. Confira os números.': 'Invalid CPF. Check the numbers.', 'E-mail inválido. Confira o endereço.': 'Invalid e-mail. Check the address.',
    'Informe o @usuário do Instagram (ex.: @andre.silva).': 'Enter your Instagram @username (e.g. @andre.silva).',
    'Informe uma data válida, como 25/12/1990.': 'Enter a valid date, like 25/12/1990.', 'Informe a rua ou avenida.': 'Enter the street or avenue.',
    'Informe o número (ou S/N).': 'Enter the number (or S/N).', 'Informe o bairro.': 'Enter the district.', 'Informe a cidade.': 'Enter the city.',
    'Informe o nome completo (nome e sobrenome).': 'Enter your full name (first and last).', 'Informe o celular (WhatsApp) com DDD.': 'Enter your mobile (WhatsApp) with area code.',
    'Informe seu e-mail.': 'Enter your e-mail.', 'E-mail inválido. Confira o endereço digitado.': 'Invalid e-mail. Check what you typed.',
    'Informe seu Instagram (o @usuário).': 'Enter your Instagram (@username).', 'Informe uma data de nascimento válida, como 25/12/1990.': 'Enter a valid date of birth, like 25/12/1990.',
    'Informe seu peso em kg (entre 20 e 250 kg).': 'Enter your weight in kg (20 to 250 kg).', 'Informe o CEP com 8 dígitos.': 'Enter the 8-digit postal code (CEP).',
    'Informe a rua/endereço.': 'Enter the street/address.', 'Informe o número do endereço (ou S/N).': 'Enter the address number (or S/N).',
    'Informe a UF (estado com 2 letras, ex.: MG).': 'Enter the state (2 letters, e.g. MG).', 'Informe o nome completo de cada menor.': 'Enter each minor’s full name.',
    'Informe os 11 números do CPF.': 'Enter the 11 digits of the CPF.', 'Não foi possível enviar agora. Tente de novo.': 'Could not send now. Please try again.',
    'Este aparelho não informa a localização. Faça o check-in no totem.': 'This device does not share its location. Check in at the kiosk.',
    'Não foi possível fazer o check-in. Use o totem.': 'Could not check in. Use the kiosk.',
    'Check-in feito! Seu termo está indo para a impressora da recepção: no balcão, é só conferir e assinar.': 'Checked in! Your waiver is going to the front desk printer: just check it and sign at the counter.',
    'Permita o acesso à localização para fazer o check-in (ou use o totem).': 'Allow location access to check in (or use the kiosk).',
    'Não foi possível obter sua localização. Tente de novo em um lugar aberto.': 'Could not get your location. Try again outdoors.',
    'Pagamento confirmado.': 'Payment confirmed.', 'Nos vemos na pista!': 'See you on the track!', 'Leva menos de um minuto.': 'Takes less than a minute.',
    'O pagamento do grupo já está em dia. Preencha o seu cadastro.': 'The group payment is up to date. Fill in your registration.',
    'Quem reservou paga pelo grupo. Você só preenche o seu cadastro.': 'The organizer pays for the group. You just fill in your registration.',
    'Todas as vagas do grupo já têm dono. Faça o cadastro e fale com quem reservou.': 'All the group spots are taken. Register and talk to the organizer.',
    'Preencha seu cadastro. Sua vaga já está reservada.': 'Fill in your registration. Your spot is already reserved.',
    'Os convidados só fazem o cadastro.': 'Guests only need to register.',
    'Na próxima tela você escolhe Pix ou cartão. Use o seu CPF no cadastro.': 'On the next screen you choose Pix or card. Use your own CPF.',
    'Pagar com Pix': 'Pay with Pix', 'Pagar com cartão': 'Pay by card', 'Aguardando o pagamento.': 'Waiting for payment.', 'Já paguei: verificar agora': 'I have paid: check now',
    'Toque em Pix ou cartão: abre a página de pagamento segura da Asaas.': 'Tap Pix or card: it opens Asaas’s secure payment page.',
    'No Pix, copie o código no app do banco.': 'For Pix, paste the code in your bank app.', 'Volte aqui: a confirmação aparece sozinha.': 'Come back here: the confirmation shows up by itself.',
    'Adicionar à agenda': 'Add to calendar',
    // painel do grupo
    'Carregando seu grupo…': 'Loading your group…', 'Copie o link:': 'Copy the link:', 'Cadastro ok': 'Registered', 'Termo aceito': 'Waiver accepted',
    'Termo na recepção': 'Waiver at the front desk', 'Liberando a vaga… atualiza em até 1 minuto.': 'Freeing the spot… updates within 1 minute.',
    'Falta 1 piloto': '1 driver missing', 'Eles não pagam nada: o pagamento do grupo é com você.': 'They pay nothing: the group payment is on you.',
    'Não foi possível liberar agora.': 'Could not free the spot now.', 'Pedido enviado: a vaga é liberada em até 1 minuto': 'Request sent: the spot is freed within 1 minute',
    'Painel não encontrado.': 'Panel not found.', 'Liberar vaga': 'Free spot', 'Pronto para correr': 'Ready to race', 'Completar meu cadastro': 'Complete my registration',
    'Mandar no WhatsApp': 'Send on WhatsApp', 'Copiar link': 'Copy link', 'Pilotos prontos': 'Drivers ready', 'Link do grupo copiado': 'Group link copied',
    'Grid de largada': 'Starting grid', 'Não deu para abrir o painel': 'Could not open the panel', 'Falar com a recepção': 'Talk to the front desk',
    'Termos': 'Waivers', 'Pagamentos': 'Payments', 'Pagamento': 'Payment', 'Em dia': 'Up to date', 'Sinal': 'Deposit', 'Pendente': 'Pending', 'você': 'you',
    'Cadastros': 'Registrations', 'Aguardando cadastro': 'Waiting for registration', 'Vaga aberta': 'Open spot',
    'Este grupo ainda não tem vagas na bateria. A recepção está ajustando a reserva; fale com ela se precisar.': 'This group has no spots in the session yet. The front desk is adjusting the booking; contact them if needed.',
  };
  var R = [
    [/^Faltam (\d+) itens$/, function (_, n) { return n + ' items left'; }],
    [/^Falta 1 item$/, function () { return '1 item left'; }],
    [/^Faltam (\d+) pilotos$/, function (_, n) { return n + ' drivers missing'; }],
    [/^faltam (\d+) dias$/, function (_, n) { return n + ' days to go'; }],
    [/^(\d+) de (\d+) pilotos prontos$/, function (_, a, b) { return a + ' of ' + b + ' drivers ready'; }],
    [/^Tudo certo, (.*)!$/, function (_, n) { return 'All set, ' + n + '!'; }],
    [/^Grupo de (.+?)( · Kartódromo de Betim)?$/, function (_, n, k) { return n + '’s group' + (k || ''); }],
    [/^Vaga (\d+)$/, function (_, n) { return 'Spot ' + n; }],
    [/^Falta (.+)$/, function (_, n) { return 'Missing: ' + n; }],
    [/^Não foi liberada: (.+)\.$/, function (_, e) { return 'Not freed: ' + e + '.'; }],
    [/^Link da vaga P(\d+) copiado$/, function (_, n) { return 'Spot P' + n + ' link copied'; }],
    [/^Copiar link da vaga (\d+)$/, function (_, n) { return 'Copy spot ' + n + ' link'; }],
    [/^Lembrar (.+) pelo WhatsApp$/, function (_, n) { return 'Remind ' + n + ' on WhatsApp'; }],
    [/^Liberar a vaga de (.+)\? A pessoa sai do grupo e a vaga fica aberta para outra pessoa entrar pelo link\.$/, function (_, n) { return 'Free ' + n + '’s spot? They leave the group and the spot opens for someone else to join through the link.'; }],
    [/^Você está no grupo de (.+?)\.?$/, function (_, n) { return 'You are in ' + n + '’s group.'; }],
    [/^Informe o (.+)\.$/, function (_, n) { return 'Enter the ' + n + '.'; }],
  ];
  function tr(t) {
    var s = t.trim();
    if (!s) return null;
    if (D[s]) return t.replace(s, D[s]);
    for (var i = 0; i < R.length; i++) { var m = s.match(R[i][0]); if (m) return t.replace(s, s.replace(R[i][0], R[i][1])); }
    return null;
  }
  var ATTR = ['placeholder', 'aria-label', 'title'];
  function varrer(raiz) {
    if (raiz.nodeType === 3) { var n = tr(raiz.nodeValue); if (n !== null && n !== raiz.nodeValue) raiz.nodeValue = n; return; }
    if (raiz.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA)$/.test(raiz.nodeName) || (raiz.closest && raiz.closest('[data-sem-traducao]'))) return;
    for (var a = 0; a < ATTR.length; a++) { var v = raiz.getAttribute && raiz.getAttribute(ATTR[a]); if (v) { var t = tr(v); if (t !== null && t !== v) raiz.setAttribute(ATTR[a], t); } }
    var w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    var x; while ((x = w.nextNode())) { if (x !== raiz) { if (x.nodeType === 1) { if (/^(SCRIPT|STYLE|TEXTAREA)$/.test(x.nodeName)) continue; for (var b = 0; b < ATTR.length; b++) { var vv = x.getAttribute(ATTR[b]); if (vv) { var tt = tr(vv); if (tt !== null && tt !== vv) x.setAttribute(ATTR[b], tt); } } } else { var nn = tr(x.nodeValue); if (nn !== null && nn !== x.nodeValue) x.nodeValue = nn; } } }
  }
  var origConfirm = window.confirm;
  function botao() {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'troca-idioma'; b.setAttribute('aria-label', lang === 'en' ? 'Ver em português' : 'View in English');
    b.textContent = lang === 'en' ? 'PT' : 'EN';
    b.style.cssText = 'position:fixed;top:10px;right:10px;z-index:50;font:700 13px/1 system-ui,sans-serif;letter-spacing:.06em;padding:9px 12px;min-height:36px;border-radius:4px;border:1px solid rgba(255,255,255,.25);background:rgba(3,5,4,.85);color:#f7faf6;cursor:pointer';
    b.onclick = function () { try { localStorage.setItem('kib-idioma', lang === 'en' ? 'pt' : 'en'); } catch (e) { /* ok */ } var u = new URL(location.href); u.searchParams.delete('lang'); location.replace(u.toString()); };
    document.body.appendChild(b);
  }
  function iniciar() {
    botao();
    if (lang !== 'en') return;
    document.documentElement.lang = 'en';
    window.confirm = function (m) { var t = tr(String(m)); return origConfirm.call(window, t === null ? m : t); };
    varrer(document.body);
    document.title = tr(document.title) || document.title.replace('Kartódromo Internacional de Betim', 'Betim International Kart Track');
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        if (m.type === 'characterData') varrer(m.target);
        else if (m.type === 'attributes') varrer(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) varrer(m.addedNodes[j]);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
