export const BOOKING = "https://reservas.kartodromodebetim.com.br";
export const WA = "https://wa.me/5531998842898";
export const whatsapp = (message) =>
  `${WA}?text=${encodeURIComponent(message)}`;
export const money = (value) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
export const championships = [
  {
    id: "100-milhas-light",
    name: "100 Milhas Light",
    type: "Kart Light",
    day: "25",
    month: "OUT",
    year: "2026",
    date: "25/10/2026",
    description: "2h30 de corrida. De 1 a 3 pilotos por kart.",
    price: 900,
    team: true,
    minPilots: 1,
    maxPilots: 3,
    minAge: 14,
    opens: "2026-09-01T00:00:00-03:00",
    deadline: "2026-10-15T23:59:59-03:00",
    duration: "2h30 + 1 volta",
    stops: "3 paradas de 7 min",
    pdf: "100-milhas-light-de-betim-2026.pdf",
    logo: "100-milhas-light-logo.png",
    intro:
      "Estratégia, resistência e adrenalina. Monte sua equipe e viva um endurance com os karts light de locação do kartódromo.",
    schedule: [
      ["08:30", "Recepção das equipes"],
      ["09:00", "Briefing e sorteio dos karts"],
      ["09:50", "Tomada de tempo"],
      ["10:00", "Largada estilo Le Mans"],
      ["12:30", "Bandeirada e pesagem"],
      ["13:00", "Resultado e pódio"],
    ],
  },
  {
    id: "200-milhas",
    name: "200 Milhas de Betim",
    type: "Endurance",
    day: "30",
    month: "JAN",
    year: "2027",
    date: "30/01/2027",
    description: "5 horas de estratégia em equipe.",
    price: 2800,
    team: true,
    minPilots: 2,
    maxPilots: 10,
    minAge: 12,
    opens: "2026-10-05T10:00:00-03:00",
    deadline: "2027-01-10T23:59:59-03:00",
    duration: "5h + 1 volta",
    stops: "5 paradas de 7 min",
    pdf: "200-milhas-de-betim-2027.pdf",
    logo: "200-milhas-logo.png",
    intro:
      "Uma prova decidida em cada detalhe. Ritmo, trocas e trabalho de equipe do primeiro briefing até a bandeirada.",
    schedule: [
      ["29/01 · 21:00", "Tomada de tempo — 10 minutos"],
      ["30/01 · 07:00", "Café da manhã e inscrição dos pilotos"],
      ["07:30", "Briefing e sorteio dos karts"],
      ["08:00", "Largada"],
      ["13:00", "Encerramento"],
      ["13:30", "Resultado oficial e premiação"],
    ],
  },
  {
    id: "kac",
    apiId: "kac-iniciantes",
    name: "KAC Iniciantes",
    type: "Kart Light",
    day: "MENSAL",
    date: "Mensal · 2026",
    description: "Uma temporada para evoluir na pista.",
    team: false,
    minAge: 14,
    duration: "Mensal",
    stops: "Kart Light",
    pdf: "kac-iniciantes-betim-2026.pdf",
    logo: "kac-iniciantes-logo.png",
    intro:
      "Seu primeiro campeonato começa aqui. Aprenda a manter o ritmo, a escolher o momento da ultrapassagem e a disputar cada ponto.",
  },
  {
    id: "kac-super",
    apiId: "kac-super-kart",
    name: "KAC Super Kart",
    type: "Super Kart",
    day: "FEV–NOV",
    date: "Fevereiro a novembro · 2026",
    description: "Dez etapas de competição.",
    team: false,
    minAge: 14,
    duration: "10 etapas",
    stops: "9 resultados válidos",
    pdf: "kac-super-kart-2026.pdf",
    logo: "kac-super-kart-logo.png",
    intro:
      "Uma temporada inteira em busca do próximo pódio. Dez etapas, pontuação acumulada e os nove melhores resultados para decidir o campeonato.",
  },
  {
    id: "500-milhas",
    name: "500 Milhas de Betim",
    type: "Endurance",
    day: "29",
    month: "AGO",
    year: "2026",
    date: "29/08/2026",
    description: "Edição realizada.",
    price: 6800,
    team: true,
    past: true,
    duration: "12 horas",
    stops: "Ultra endurance",
    pdf: "500-milhas-de-betim-2026.pdf",
    logo: "500-milhas-logo.png",
    intro:
      "A prova mais longa do calendário. Uma história de resistência, preparação e decisões compartilhadas a cada volta. A edição de 2026 aconteceu em 29 de agosto.",
  },
];
export function registrationStatus(c, now = Date.now()) {
  if (c.past) return "past";
  if (c.opens && now < Date.parse(c.opens)) return "soon";
  if (c.deadline && now > Date.parse(c.deadline)) return "closed";
  return "open";
}
export const faq = [
  {
    cat: "Locação",
    q: "Preciso ter experiência para correr?",
    a: "Não. O kart de locação atende iniciantes e pilotos habituais. Todos recebem um briefing de segurança e orientação sobre o kart antes de entrar na pista.",
  },
  {
    cat: "Locação",
    q: "Quanto custa e quanto tempo dura a corrida?",
    a: "A bateria tem 30 minutos. O valor normal é R$ 175 por piloto. Com pagamento antecipado na reserva online, o valor informado é R$ 145. Consulte a agenda para confirmar as condições do horário escolhido.",
  },
  {
    cat: "Reservas",
    q: "Como faço a minha reserva?",
    a: "Acesse a agenda online, escolha o dia e o horário e faça o pagamento por Pix ou cartão. A confirmação é feita na plataforma de reservas. Para grupos e eventos, fale com a equipe pelo WhatsApp.",
  },
  {
    cat: "Segurança",
    q: "Qual é a idade, altura e peso mínimos?",
    a: "Para o kart de locação, os requisitos informados são 14 anos, 1,50 m de altura e 50 kg de peso. Campeonatos podem ter regras específicas. Menores de idade devem estar acompanhados de um responsável. Consulte a equipe antes de reservar em caso de dúvida.",
  },
  {
    cat: "Segurança",
    q: "O equipamento está incluído?",
    a: "Capacete com viseira, macacão emprestado e briefing estão incluídos. Use calçado fechado e roupas confortáveis. Evite acessórios soltos e prenda os cabelos conforme a orientação da equipe.",
  },
  {
    cat: "Reservas",
    q: "Com quanto tempo de antecedência devo chegar?",
    a: "Chegue com 1 hora de antecedência para cadastro, pesagem, retirada dos equipamentos e briefing. Nos campeonatos, siga o cronograma do regulamento de cada prova.",
  },
  {
    cat: "Eventos",
    q: "Posso fechar uma bateria só para o meu grupo?",
    a: "Sim. De terça a sexta, o mínimo é de 25 pilotos. Em finais de semana e feriados, o mínimo é de 30 pilotos, conforme disponibilidade. Peça um orçamento para organizar a sua turma.",
  },
  {
    cat: "Eventos",
    q: "O kartódromo recebe aniversários e empresas?",
    a: "Sim. Os eventos podem incluir baterias de kart, ranking, pódio, gastronomia e apoio da equipe. O Salão Inferior recebe até 100 convidados e o Espaço Gourmet, até 150.",
  },
  {
    cat: "Campeonatos",
    q: "Como me inscrevo em um campeonato?",
    a: "Escolha a prova no calendário, leia o regulamento e envie seus dados pelo formulário. A organização confirma a inscrição e orienta o pagamento. A vaga só fica garantida depois da confirmação.",
  },
  {
    cat: "Reservas",
    q: "Quais são os horários de funcionamento?",
    a: "Terça a sexta, das 16h às 22h. Sábado e domingo, das 08h às 19h. Segunda-feira é destinada à manutenção. Consulte a disponibilidade de feriados e eventos com a equipe.",
  },
  {
    cat: "Segurança",
    q: "Posso escolher qualquer traçado para correr?",
    a: "Nas baterias de lazer, treinos e eventos, utiliza-se o traçado definido pelo kartódromo. Alterações de sentido e configurações com chicane são exclusivas para campeonatos, conforme o calendário oficial.",
  },
  {
    cat: "Clube",
    q: "O Clube de Vantagens já está disponível?",
    a: "O programa está em implantação. Cadastro, consulta de pontos e resgates serão liberados após a integração com o sistema real de corridas. A equipe pode esclarecer as regras previstas.",
  },
];
export const clubNav = [
  ["painel", "Meu painel"],
  ["pontuacao", "Minha pontuação"],
  ["corridas", "Histórico de corridas"],
  ["catalogo", "Catálogo"],
  ["resgates", "Meus resgates"],
  ["campanhas", "Campanhas"],
  ["perfil", "Meu perfil"],
  ["regulamento", "Regulamento"],
];
export const clubRules = [
  [
    "1. O programa",
    [
      "O Clube de Vantagens é o programa oficial de relacionamento do Kartódromo Internacional de Betim, criado para reconhecer e recompensar os clientes que fazem parte da nossa história.",
      "A adesão prevista é gratuita. A liberação do cadastro depende da integração com o sistema de corridas.",
    ],
  ],
  [
    "2. Pontuação",
    [
      "Corridas de terça a sexta-feira geram 20 pontos.",
      "Corridas aos sábados, domingos e feriados geram 10 pontos.",
      "O crédito automático após a confirmação de cada corrida depende da liberação da integração.",
    ],
  ],
  [
    "3. Resgates",
    [
      "Os pontos poderão ser trocados por produtos, experiências e benefícios do catálogo.",
      "O catálogo pode ser atualizado conforme disponibilidade de estoque e campanhas promocionais.",
      "Resgates aprovados não poderão ser cancelados ou convertidos novamente em pontos. O fluxo de resgates ainda está em implantação.",
    ],
  ],
  [
    "4. Campanhas especiais",
    [
      "O programa poderá oferecer bônus de aniversário, campanhas de indicação e promoções em datas comemorativas.",
      "As condições e o período de cada campanha serão divulgados no lançamento.",
    ],
  ],
  [
    "5. Disposições gerais",
    [
      "O kartódromo pode alterar este regulamento mediante aviso prévio aos participantes.",
      "Dúvidas sobre o programa podem ser esclarecidas pelos canais de atendimento oficiais.",
    ],
  ],
];
export const trackNumbers = [1, 2, 3, 4, 5, 6, 9, 10, 11, 12];
export const trackVariants = [
  ["normal", "Normal"],
  ["invertido", "Invertido"],
  ["invertido-chicane", "Invertido + chicane"],
];
