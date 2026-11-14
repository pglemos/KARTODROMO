// Versão em inglês do site de reservas. A interface é escrita em português; com o idioma "en", um observador troca os
// textos da tela (nós de texto e atributos de acessibilidade) pelo dicionário abaixo e pelas regras com números/datas.
// Os valores digitados nos campos nunca são tocados.

export type Idioma = 'pt' | 'en';

export function idiomaInicial(): Idioma {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'en' || q === 'pt') return q;
  try { const s = localStorage.getItem('kib-idioma'); if (s === 'en' || s === 'pt') return s; } catch { /* ok */ }
  return 'pt';
}
export function trocarIdioma(i: Idioma) {
  try { localStorage.setItem('kib-idioma', i); } catch { /* ok */ }
  const u = new URL(location.href); u.searchParams.delete('lang');
  location.replace(u.toString());
}

const D: Record<string, string> = {
  'Grupos que você organiza': 'Groups you organize', 'Mandar o link do grupo': 'Send the group link', 'Cada um paga': 'Everyone pays',
  'Como vocês vão pagar?': 'How will you pay?', 'Eu pago tudo agora': 'I pay for everyone now', 'Cada um paga o seu': 'Everyone pays their own',
  'Você paga só a sua vaga agora e manda o link do grupo para os amigos.': 'You pay only your spot now and send the group link to your friends.',
  'Você paga 1 vaga de garantia agora e manda o link do grupo para os amigos.': 'You pay 1 spot as a deposit now and send the group link to your friends.',
  'Só para baterias com 24h ou mais de antecedência.': 'Only for sessions 24h or more away.', 'Sua vaga, agora': 'Your spot, now', '1 vaga de garantia, agora': '1 deposit spot, now',
  'Agora chame o grupo': 'Now invite your group', 'Enviar no WhatsApp': 'Send on WhatsApp', 'Copiar link': 'Copy link', 'Ver quem já entrou e pagou': 'See who joined and paid',
  'Mande o link para os amigos. Cada um faz o próprio cadastro e paga a vaga dele. Quem não pagar até 24h antes da bateria perde a vaga.': 'Send the link to your friends. Each one signs up and pays their own spot. Anyone who has not paid 24h before the session loses the spot.',
  'Preparando o link do seu grupo. Ele aparece aqui em instantes.': 'Preparing your group link. It will show up here in a moment.', 'Agora': 'Now', 'Cada amigo paga a própria vaga pelo link.': 'Each friend pays their own spot through the link.',
  'Pular para a reserva': 'Skip to booking', 'Cheguei! Fazer check-in': 'I am here! Check in', 'Conferindo sua localização…': 'Checking your location…',
  'Check-in feito! O termo de cada piloto já está indo para a impressora da recepção: no balcão, é só conferir e assinar.': 'Checked in! Each driver’s waiver is being printed at the front desk: just review and sign it there.',
  'Este aparelho não informa a localização. Faça o check-in no totem.': 'This device does not share location. Check in at the kiosk.', 'Permita o acesso à localização para fazer o check-in (ou use o totem).': 'Allow location access to check in (or use the kiosk).',
  'Não foi possível obter sua localização. Tente de novo em um lugar aberto.': 'We could not get your location. Try again outdoors.', 'O check-in abre 2 horas antes da largada.': 'Check-in opens 2 hours before the start.',
  'Pague a reserva antes do check-in.': 'Pay for the booking before checking in.', 'A localização está imprecisa. Tente de novo em um lugar aberto.': 'Your location is imprecise. Try again outdoors.',
  'O horário de check-in desta bateria terminou. Fale com a recepção.': 'Check-in for this session has closed. Contact the front desk.', '(1 hora antes)': '(1 hour before)', '1 hora antes': '1 hour before', 'Minhas': 'Bookings', 'reservas': '', 'Voltar ao site': 'Back to website', 'Precisa de ajuda?': 'Need help?', 'Ajuda': 'Help',
  'Como chegar': 'Directions', 'WhatsApp da recepção': 'Front desk WhatsApp', 'Conexão segura': 'Secure connection',
  'Kartódromo de Betim · Reserva online': 'Betim Kart Track · Online booking', 'Betim, MG': 'Betim, Brazil',
  'Esse horário não está mais disponível.': 'This time slot is no longer available.', 'Escolher outro horário': 'Choose another time',
  'Consultando horários disponíveis…': 'Checking available times…', 'Não foi possível carregar a agenda': 'We could not load the schedule', 'Tentar de novo': 'Try again',
  'Sem horários disponíveis agora': 'No times available right now', 'Novos horários abrem com frequência. Fale com a recepção para grupos e eventos.': 'New times open often. Contact the front desk for groups and events.',
  'Falar com a recepção': 'Contact the front desk', 'Data e horário': 'Date and time', 'Os horários abaixo têm vagas disponíveis.': 'The times below have open spots.',
  'Horários de largada': 'Start times', 'Compartilhar data': 'Share date', 'Nenhum horário nesse período. Troque o filtro ou o dia.': 'No times in this period. Change the filter or the day.',
  'Planeje chegar uma hora antes.': 'Plan to arrive one hour early.', 'É o tempo do cadastro no totem, preparação e orientações de segurança.': 'That is the time for check-in at the kiosk, gear-up and the safety briefing.',
  'Requisitos e orientações para pilotar': 'Requirements and guidance for drivers', 'Não precisa de experiência nem de equipamento próprio.': 'No experience or own gear needed.',
  'Use calçado fechado. Gestantes não podem pilotar.': 'Wear closed-toe shoes. Pregnant women cannot drive.', 'O termo de responsabilidade é assinado no kartódromo, antes da corrida.': 'The liability waiver is signed at the track, before the race.',
  'Menores de 18 anos precisam do responsável no dia para assinar o termo.': 'Drivers under 18 need a parent or guardian on the day to sign the waiver.',
  'Pilotos': 'Drivers', 'Todos correm juntos na mesma bateria.': 'Everyone races together in the same session.', 'Quantos pilotos?': 'How many drivers?',
  'Você também vai pilotar?': 'Will you drive too?', 'Sim, vou correr': 'Yes, I will race', 'Uma das vagas é minha.': 'One of the spots is mine.',
  'Não, só vou reservar': 'No, I am only booking', 'Reservo e pago para outras pessoas.': 'I book and pay for other people.',
  'Cada vaga é de uma pessoa diferente. Na próxima etapa você informa nome, CPF e nascimento de cada piloto.': 'Each spot is for a different person. In the next step you enter each driver’s name, CPF and date of birth.',
  'Voltar': 'Back', 'Continuar': 'Continue', '(opcional)': '(optional)', 'Cadastro': 'Details', 'Com esses dados o totem encontra cada piloto pelo CPF no dia.': 'With these details the kiosk finds each driver by CPF on the day.',
  'Seus dados são usados só para a reserva, o cadastro no totem e o resultado da bateria (LGPD). Menores de 18 anos assinam o termo com o responsável no dia.': 'Your data is used only for the booking, kiosk check-in and race results (Brazilian data protection law). Drivers under 18 sign the waiver with a guardian on the day.',
  'Pagamento': 'Payment', 'Bateria': 'Session', 'Chegada': 'Arrival', 'Quem reserva': 'Booked by', 'Como você quer pagar?': 'How do you want to pay?', 'Pix': 'Pix (Brazil)',
  'Aprovação na hora. QR code na próxima tela.': 'Instant approval. QR code on the next screen.', 'Cartão de crédito': 'Credit card', 'Página segura da Asaas.': 'Secure Asaas payment page.',
  'Cupom de desconto': 'Discount code', 'com cupom': 'with code', 'Ler a política': 'Read the policy',
  'Não conseguimos confirmar se o pedido chegou. Para não pagar duas vezes,': 'We could not confirm that your order arrived. To avoid paying twice,', 'fale com a recepção': 'contact the front desk', 'antes de tentar de novo.': 'before trying again.',
  'Carregando…': 'Loading…', 'Fechar': 'Close', 'Li e aceito': 'I have read and accept', 'Kart de aluguel': 'Rental karting', 'Sua corrida': 'Your race', 'Dia': 'Day', 'Largada': 'Start', 'Total': 'Total',
  'Pix ou cartão pela Asaas': 'Pix or card via Asaas', 'Carregando sua reserva…': 'Loading your booking…', 'Tudo certo para a corrida': 'All set for the race', 'Reserva confirmada': 'Booking confirmed',
  'Código da reserva': 'Booking code', 'Guarde o código: com ele e o CPF você acessa': 'Keep this code: with it and your CPF you can open', 'Minhas reservas': 'My bookings', 'para remarcar ou cancelar.': 'to reschedule or cancel.',
  'Chegue às': 'Arrive at', ', uma hora antes da largada.': ', one hour before the start.', 'No totem, informe o': 'At the kiosk, enter the', 'CPF de quem reservou': 'CPF of the person who booked', 'e confira os dados.': 'and check the details.',
  'O termo de responsabilidade é assinado na recepção.': 'The liability waiver is signed at the front desk.', 'Salvar na agenda': 'Add to calendar', 'Fazer outra reserva': 'Make another booking',
  'Pague com Pix': 'Pay with Pix', 'Pix copia e cola': 'Pix copy-and-paste code', 'Copiar código Pix': 'Copy Pix code', 'Confira o valor no banco antes de confirmar. A confirmação aparece aqui sozinha.': 'Check the amount in your bank app before confirming. The confirmation appears here automatically.',
  'Pague com cartão': 'Pay by card', 'Abrir pagamento seguro': 'Open secure payment', 'Pagamento processado pela Asaas. Volte para esta página: a confirmação aparece aqui.': 'Payment processed by Asaas. Come back to this page: the confirmation appears here.',
  'Preparando seu pagamento': 'Preparing your payment', 'Verificando a disponibilidade e gerando a cobrança. Leva alguns segundos.': 'Checking availability and creating the charge. This takes a few seconds.',
  'Pagamento recebido': 'Payment received', 'Falta confirmar sua reserva': 'Your booking is being confirmed', 'Estamos lançando as vagas no sistema do kartódromo. Não faça outro pagamento.': 'We are entering your spots in the track’s system. Do not pay again.',
  'O prazo de pagamento terminou': 'The payment deadline has passed', 'As vagas foram liberadas. Se você pagou agora há pouco, fale com a recepção.': 'The spots were released. If you just paid, contact the front desk.',
  'Reserva não encontrada': 'Booking not found', 'Confira o link ou fale com a recepção.': 'Check the link or contact the front desk.', 'Fazer uma reserva': 'Make a booking',
  'Atualização interrompida. Confira a conexão: a página tenta de novo sozinha.': 'Updates paused. Check your connection: the page will retry automatically.', 'Você pode voltar a esta página pelo mesmo link.': 'You can come back to this page with the same link.',
  'Veja suas reservas, pague o que ficou pendente, cancele ou peça remarcação.': 'See your bookings, pay what is pending, cancel or request a reschedule.', 'Cancelar reserva': 'Cancel booking', 'Sim, cancelar': 'Yes, cancel', 'Manter reserva': 'Keep booking', 'Cancelando…': 'Cancelling…', 'Cancelada': 'Cancelled', 'Reserva cancelada. Você recebe a confirmação por e-mail.': 'Booking cancelled. You will get a confirmation by e-mail.', 'Faltam menos de 48 horas para a bateria: pela política não há reembolso. As vagas voltam para venda. Não dá para desfazer.': 'Less than 48 hours before the race: per the policy there is no refund. The spots go back on sale. This cannot be undone.', 'Pedir cancelamento': 'Request cancellation',
  'Minhas corridas': 'My races', 'Carregando seu histórico…': 'Loading your race history…', 'melhor volta': 'best lap',
  'Cancelamentos e remarcações são confirmados pela recepção no WhatsApp, como prevê a política. Reservas feitas no balcão ou por grupo não aparecem aqui.': 'Cancellations and reschedules are confirmed by the front desk on WhatsApp, as the policy states. Bookings made at the desk or through a group do not show here.',
  'Buscar outro CPF': 'Search another CPF', 'Corrida': 'Race', 'Escolha quando correr.': 'Choose when to race.', 'Quem vai para a pista?': 'Who is going on track?', 'Dados de quem reserva e dos pilotos.': 'Booker and driver details.',
  'Confira e finalize.': 'Review and finish.', 'Selecione o dia e o horário da sua bateria.': 'Pick the day and time of your session.', 'Reserve as vagas do seu grupo na mesma bateria.': 'Book your group’s spots in the same session.',
  'A reserva deve ser feita por um adulto, que pode ou não pilotar.': 'The booking must be made by an adult, who may or may not drive.', 'Revise sua corrida e escolha como pagar.': 'Review your race and choose how to pay.',
  'Link da data copiado': 'Date link copied', 'Todos': 'All', 'Antes das 18h': 'Before 6 pm', 'A partir das 18h': 'From 6 pm',
  'Informe nome e sobrenome.': 'Enter first and last name.', 'Confira os 11 números do CPF.': 'Check the 11 digits of the CPF.', 'Confira o endereço de e-mail.': 'Check the email address.',
  'Informe seu e-mail (o recibo e o resultado vão para ele).': 'Enter your email (receipt and results are sent there).', 'Informe um celular com DDD.': 'Enter a mobile number with area code.', 'Use uma data válida: DD/MM/AAAA.': 'Use a valid date: DD/MM/YYYY.',
  'A reserva deve ser feita por um adulto de 18 anos ou mais. Confira a data.': 'The booking must be made by an adult aged 18 or over. Check the date.',
  'Informe seu Instagram (o @usuário). Ele sai junto com seu nome no resultado da bateria.': 'Enter your Instagram (@username). It appears next to your name in the race results.',
  'Informe seu peso (kg). Ele é usado para equilibrar os karts.': 'Enter your weight (kg). It is used to balance the karts.', 'Cada piloto precisa de um CPF diferente (cada vaga é de uma pessoa).': 'Each driver needs a different CPF (each spot is one person).',
  'Confira o e-mail.': 'Check the email.', 'Informe o e-mail.': 'Enter the email.', 'Informe o celular com DDD.': 'Enter the mobile number with area code.', 'Informe um peso entre 20 e 250 kg.': 'Enter a weight between 20 and 250 kg.',
  'Informe o peso (kg).': 'Enter the weight (kg).', 'Confira o Instagram: só o @usuário, ou deixe em branco.': 'Check the Instagram: just the @username, or leave it blank.', 'Confira o Instagram: só o @usuário (ex.: @andre.silva).': 'Check the Instagram: just the @username (e.g. @andre.silva).',
  'Informe o endereço (rua e número).': 'Enter the address (street and number).', 'Informe o bairro.': 'Enter the neighborhood.', 'Informe a cidade.': 'Enter the city.',
  'Você (quem reserva e pilota)': 'You (booking and driving)', 'Você (quem reserva)': 'You (booking)', 'Confira o código do cupom.': 'Check the discount code.',
  'O kartódromo não respondeu agora. Tente de novo em instantes ou finalize sem cupom.': 'The track did not respond. Try again shortly or finish without a code.', 'Para reservar, aceite a política de cancelamento.': 'To book, accept the cancellation policy.',
  'Pagamento online indisponível. Fale com a recepção.': 'Online payment unavailable. Contact the front desk.', 'Não foi possível verificar o número do pedido.': 'We could not verify the order number.',
  'Conferindo…': 'Checking…', 'Aplicado': 'Applied', 'Aplicar': 'Apply', 'Li e aceito a Política de Cancelamento, Reagendamento e Reembolso.': 'I have read and accept the Cancellation, Rescheduling and Refund Policy.',
  'Separando suas vagas…': 'Holding your spots…', 'Política de Cancelamento': 'Cancellation policy', 'Selecione na agenda': 'Pick on the calendar', 'Código copiado': 'Code copied', 'Código Pix copiado': 'Pix code copied',
  'Selecione e copie o código no campo acima.': 'Select and copy the code in the field above.', 'Seu pagamento precisa de atendimento': 'Your payment needs attention', 'Esse horário ficou indisponível': 'This time slot became unavailable',
  'Não foi possível gerar o pagamento': 'We could not create the payment', 'A disponibilidade mudou antes da confirmação. A recepção resolve com você: troca de horário ou reembolso.': 'Availability changed before confirmation. The front desk will sort it out with you: a new time or a refund.',
  'Escolha outro horário para continuar.': 'Choose another time to continue.', 'Confirmada': 'Confirmed', 'Aguardando pagamento': 'Awaiting payment', 'Em processamento': 'Processing', 'Prazo de pagamento encerrado': 'Payment deadline passed',
  'Não confirmada': 'Not confirmed', 'Precisa de atendimento': 'Needs attention', 'Erro no pagamento': 'Payment error', 'Bateria já realizada.': 'Session already took place.',
  'Faltam menos de 48 horas: pela política não há reembolso. A recepção pode avaliar um voucher para outra data em casos excepcionais.': 'Less than 48 hours to go: under the policy there is no refund. The front desk may consider a voucher for another date in exceptional cases.',
  'Confira os 11 números do CPF de quem reservou.': 'Check the 11 digits of the booker’s CPF.', 'O código da reserva tem 6 letras e números (está na confirmação e no WhatsApp).': 'The booking code has 6 letters and digits (it is on the confirmation and on WhatsApp).',
  'Não foi possível carregar o histórico agora.': 'We could not load your history right now.', 'Buscando…': 'Searching…', 'Ver minhas reservas': 'See my bookings', 'Esta é a sua reserva online.': 'This is your online booking.',
  'Data a confirmar': 'Date to be confirmed', 'Pagar agora': 'Pay now', 'Ver detalhes': 'See details', 'Remarcar': 'Reschedule', 'Falar sobre remarcar': 'Ask about rescheduling',
  'Ainda não há corridas no seu CPF. Depois da primeira bateria, seus tempos aparecem aqui e no app.': 'No races on your CPF yet. After your first session, your times show up here and in the app.',
  'Nome completo': 'Full name', 'CPF': 'CPF (Brazilian ID)', 'Data de nascimento': 'Date of birth', 'Celular (WhatsApp)': 'Mobile (WhatsApp)', 'E-mail': 'Email', 'Instagram': 'Instagram', 'Peso (kg)': 'Weight (kg)',
  'CEP': 'Postal code (CEP)', 'Endereço (rua e número)': 'Address (street and number)', 'Bairro': 'Neighborhood', 'Cidade': 'City', 'Sai com o nome no resultado da bateria.': 'Shown with your name in the race results.',
  'Usado para equilibrar os karts.': 'Used to balance the karts.', 'Preenche o endereço.': 'Fills in the address.', 'Código de uma reserva': 'A booking code',
  'Está na tela de confirmação e na mensagem do WhatsApp.': 'It is on the confirmation screen and in the WhatsApp message.', 'Etapas da reserva': 'Booking steps', 'Resumo da reserva': 'Booking summary',
  'Atualizar horários': 'Refresh times', 'Mês anterior': 'Previous month', 'Próximo mês': 'Next month', 'Dias com horários disponíveis': 'Days with available times', 'Período': 'Period',
  'Menos um piloto': 'One fewer driver', 'Mais um piloto': 'One more driver', 'Copiar código': 'Copy code', 'Fechar janela': 'Close', 'QR code do Pix desta reserva': 'Pix QR code for this booking',
  'Kart em ação na pista de Betim': 'Kart in action on the Betim track', 'Pronto para correr': 'Ready to race', 'Não foi possível concluir agora.': 'We could not finish right now.',
  'Sem conexão com o servidor. Confira a internet e tente de novo.': 'No connection to the server. Check your internet and try again.', 'O servidor demorou para responder. Confira a conexão e tente de novo.': 'The server took too long to respond. Check your connection and try again.',
  'O servidor está com instabilidade. Tente de novo em instantes.': 'The server is unstable. Try again in a moment.', 'Voucher não encontrado.': 'Discount code not found.', 'Voucher expirado.': 'Discount code expired.', 'Voucher já utilizado.': 'Discount code already used.',
  'Não achamos reserva com esse CPF e código. Confira os dados ou fale com a recepção.': 'We could not find a booking with this CPF and code. Check the details or contact the front desk.',
  'Esse horário não está mais disponível. Escolha outro.': 'This time slot is no longer available. Choose another.', 'Esse horário lotou. Escolha outro.': 'This session is full. Choose another.',
};

const DIAS: Record<string, string> = { domingo: 'Sunday', segunda: 'Monday', terça: 'Tuesday', quarta: 'Wednesday', quinta: 'Thursday', sexta: 'Friday', sábado: 'Saturday' };
const DIAS_C: Record<string, string> = { 'dom.': 'Sun', 'seg.': 'Mon', 'ter.': 'Tue', 'qua.': 'Wed', 'qui.': 'Thu', 'sex.': 'Fri', 'sáb.': 'Sat' };
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const mes = (m: string) => { const i = MESES.findIndex((x) => x === m || x.slice(0, 3) === m.replace('.', '')); return i < 0 ? m : MONTHS[i]; };

const REGRAS: [RegExp, (...m: string[]) => string][] = [
  [/^(domingo|segunda|terça|quarta|quinta|sexta|sábado), (\d{1,2}) de ([a-zç]+)(.*)$/, (_, d, n, m, r) => `${DIAS[d]}, ${mes(m)} ${n}${traduzir(r)}`],
  [/^(dom\.|seg\.|ter\.|qua\.|qui\.|sex\.|sáb\.), (\d{1,2}) de ([a-zç]+)\.?$/, (_, d, n, m) => `${DIAS_C[d]}, ${mes(m).slice(0, 3)} ${n}`],
  [/^· largada (\d\d:\d\d) · (\d+) (piloto|pilotos)(.*)$/, (_, h, n, p, r) => `· start ${h} · ${n} ${p === 'piloto' ? 'driver' : 'drivers'}${r}`],
    [/^([A-ZÁÉ][a-zç]+) (\d{4})$/, (_, m, a) => `${mes(m.toLowerCase())} ${a}`],
  [/^(\d+) vagas$/, (_, n) => `${n} spots`], [/^Últimas (\d+)$/, (_, n) => `Last ${n}`], [/^Chegue às (\d\d:\d\d)$/, (_, h) => `Arrive at ${h}`],
  [/^Ver todos os horários \((\d+)\)$/, (_, n) => `See all times (${n})`], [/^máx\. (\d+) (vaga|vagas) neste horário$/, (_, n) => `max. ${n} spots in this session`],
  [/^Piloto (\d+)$/, (_, n) => `Driver ${n}`], [/^Faltam (\d+) (campo|campos)\. Confira os destacados\.$/, (_, n) => `${n} field(s) missing. Check the highlighted ones.`],
  [/^Falta 1 campo\. Confira os destacados\.$/, () => '1 field missing. Check the highlighted one.'],
  [/^As vagas ficam separadas por (\d+) minutos enquanto você paga\.$/, (_, n) => `Your spots are held for ${n} minutes while you pay.`],
  [/^(\d\d:\d\d) \(1 hora antes\)$/, (_, h) => `${h} (1 hour before)`], [/^Reservar e pagar (.+)$/, (_, v) => `Book and pay ${v}`],
  [/^Vagas separadas por (\d+:\d\d)$/, (_, t) => `Spots held for ${t}`], [/^Cupom ([A-Z0-9_-]+): desconto de (.+)\.$/, (_, c, v) => `Code ${c}: ${v} off.`],
  [/^Reserva ([A-Z0-9]{6}) · (\d+) (piloto|pilotos)(.*)$/, (_, c, n, p, r) => `Booking ${c} · ${n} ${p === 'piloto' ? 'driver' : 'drivers'}${r}`],
  [/^Olá, (.+)! Estas são as suas (\d+) reservas online\.$/, (_, n, q) => `Hi, ${n}! These are your ${q} online bookings.`], [/^Olá, (.+)! Esta é a sua reserva online\.$/, (_, n) => `Hi, ${n}! This is your online booking.`],
  [/^(.+) · kart (.+) · (\d+) voltas$/, (_, d, k, v) => `${d} · kart ${k} · ${v} laps`],
  [/^Dentro do prazo: cancelando agora, o reembolso é de (.+) \(5% de taxa administrativa\)\. Remarcar não tem custo\.$/, (_, v) => `Within the deadline: if you cancel now, the refund is ${v} (5% admin fee). Rescheduling is free.`],
  [/^Primeira vez no Kartódromo de Betim\? Nesse horário, cada piloto estreante paga (.+)\. O desconto é conferido pelo CPF e aparece no total da próxima tela\.$/, (_, v) => `First time at Betim Kart Track? In this session each first-timer pays ${v}. The discount is checked by CPF and shown in the total on the next screen.`],
  [/^Estreantes pagam (.+) neste horário: o desconto é conferido pelo CPF e já vem no valor do Pix\/cartão\.$/, (_, v) => `First-timers pay ${v} in this session: the discount is checked by CPF and already included in the Pix/card amount.`],
  [/^Idade mínima de (\d+) anos e altura mín\. 1,50 m\.$/, (_, n) => `Minimum age ${n} and minimum height 1.50 m.`],
  [/^Esse horário tem só (\d+) (vaga|vagas)\.(.*)$/, (_, n, _v, r) => `This session has only ${n} spot(s) left.${traduzir(r)}`],
  [/^(.+), (\d+) vagas, (.+) por piloto$/, (_, h, n, v) => `${h}, ${n} spots, ${v} per driver`],
  [/^Cancelar a reserva ([A-Z0-9]{6})\?$/, (_, c) => `Cancel booking ${c}?`],
  [/^Você recebe (.+) de volta \(5% de taxa administrativa\), na mesma forma de pagamento\. Não dá para desfazer\.$/, (_, v) => `You get ${v} back (5% admin fee), to the same payment method. This cannot be undone.`],
  [/^Reserva cancelada\. O estorno de (.+) já foi pedido e você recebe a confirmação por e-mail\.$/, (_, v) => `Booking cancelled. The ${v} refund has been requested and you will get a confirmation by e-mail.`],
  [/^Check-in feito às (\d\d:\d\d)\. Seu termo está na recepção para assinar\.$/, (_, h) => `Checked in at ${h}. Your waiver is at the front desk to sign.`],
  [/^Você está a (.+) km do kartódromo\. O check-in libera quando você chegar\.$/, (_, d) => `You are ${d.replace(',', '.')} km from the track. Check-in opens when you arrive.`],
  [/^(\d+) × (.+)$/, (_, n, v) => `${n} × ${v}`],
];

export function traduzir(s: string): string {
  if (!s) return s;
  const lead = s.match(/^\s*/)![0], trail = s.match(/\s*$/)![0], core = s.trim();
  if (!core) return s;
  if (D[core] !== undefined) return lead + D[core] + trail;
  for (const [re, f] of REGRAS) { const m = core.match(re); if (m) return lead + f(...m) + trail; }
  return s;
}

const ATRIBUTOS = ['aria-label', 'title', 'placeholder', 'alt'];
const original = new WeakMap<Node, string>();

function traduzirNo(n: Node) {
  if (n.nodeType === Node.TEXT_NODE) {
    const p = n.parentElement;
    if (!p || p.closest('textarea,script,style,[data-sem-traducao]')) return;
    const atual = n.nodeValue ?? '';
    const t = traduzir(atual);
    if (t !== atual) { original.set(n, atual); n.nodeValue = t; }
    return;
  }
  if (n.nodeType !== Node.ELEMENT_NODE) return;
  const el = n as Element;
  for (const a of ATRIBUTOS) { const v = el.getAttribute(a); if (v) { const t = traduzir(v); if (t !== v) el.setAttribute(a, t); } }
  for (const c of Array.from(el.childNodes)) traduzirNo(c);
}

export function ligarIngles() {
  document.documentElement.lang = 'en';
  document.title = 'Book your race | Betim Kart Track';
  const raiz = document.getElementById('root')!;
  const obs = new MutationObserver((ms) => {
    obs.disconnect();
    for (const m of ms) {
      if (m.type === 'characterData') traduzirNo(m.target);
      else if (m.type === 'attributes') traduzirNo(m.target);
      else m.addedNodes.forEach(traduzirNo);
    }
    obs.observe(raiz, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATRIBUTOS });
  });
  traduzirNo(raiz);
  obs.observe(raiz, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATRIBUTOS });
  // toasts e diálogos ficam fora do #root
  new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach(traduzirNo))).observe(document.body, { childList: true });
}
