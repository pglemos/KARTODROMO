// Política de Cancelamento, Reagendamento e Reembolso — texto OFICIAL (enviado pelo kartódromo em 09/10/2026).
// Fonte única: site (/reservas), página de reserva online e o comprovante de aceite gravado em cada pedido.
// Mudou o texto? Troque também POLITICA_VERSAO: cada reserva guarda a versão que o cliente aceitou.

export const POLITICA_VERSAO = '2026-10-09';
export const POLITICA_TITULO = 'Política de Cancelamento, Reagendamento e Reembolso';
export const POLITICA_ACEITE = 'Li e aceito a Política de Cancelamento, Reagendamento e Reembolso.';

export type SecaoPolitica = {
  titulo: string;
  paragrafos?: string[];
  itens?: string[];
  subsecoes?: { titulo: string; paragrafos: string[] }[];
};

export const POLITICA_SECOES: SecaoPolitica[] = [
  {
    titulo: '1. Objetivo',
    paragrafos: [
      'Esta Política define as regras para cancelamento, reagendamento e reembolso de reservas realizadas em nossa plataforma. Ao concluir a reserva, o cliente declara estar ciente e de acordo com os termos.',
    ],
  },
  {
    titulo: '2. Cancelamento pelo Cliente',
    subsecoes: [
      {
        titulo: '2.1 Prazo para Cancelamento',
        paragrafos: [
          'O cancelamento pode ser solicitado com até 48 horas de antecedência da data e horário agendados.',
          'Nessa condição, o valor pago será reembolsado com desconto de 5% referente à taxa administrativa.',
        ],
      },
      {
        titulo: '2.2 Cancelamento Fora do Prazo',
        paragrafos: [
          'Solicitações com menos de 48 horas de antecedência, bem como o não comparecimento (no-show), não dão direito a reembolso.',
          'Em casos excepcionais, analisados individualmente, poderá ser concedido um voucher para utilização em outra data.',
        ],
      },
    ],
  },
  {
    titulo: '3. Reembolsos',
    subsecoes: [
      {
        titulo: '3.1 Cartão de Crédito ou Débito',
        paragrafos: ['O estorno será solicitado em até 7 dias úteis após o cancelamento.', 'O prazo para crédito depende da operadora do cartão.'],
      },
      {
        titulo: '3.2 PIX',
        paragrafos: ['O reembolso será realizado em até 7 dias úteis após o cancelamento.', 'A devolução será feita exclusivamente para conta de titularidade do cliente.'],
      },
    ],
  },
  {
    titulo: '4. Reagendamento',
    paragrafos: ['O reagendamento pode ser solicitado sem custo, desde que realizado com no mínimo 48 horas de antecedência e sujeito à disponibilidade.'],
  },
  {
    titulo: '5. Cancelamento pelo Kartódromo Internacional de Betim',
    paragrafos: ['O kartódromo poderá cancelar reservas por motivos operacionais ou de força maior, garantindo reembolso integral ao cliente.'],
  },
  {
    titulo: '6. Disposições Gerais',
    itens: ['Cancelamentos devem ser feitos pelos canais oficiais;', 'A confirmação será enviada via WhatsApp;', 'Promoções podem ter regras específicas.'],
  },
  {
    titulo: '7. Aceitação',
    paragrafos: ['Ao realizar a reserva, o cliente declara que leu e aceita integralmente esta Política.'],
  },
];

/** Texto corrido (e-mail, impressão, cadastro da empresa na recepção). */
export function politicaTexto() {
  const linhas = [POLITICA_TITULO];
  for (const s of POLITICA_SECOES) {
    linhas.push(s.titulo);
    for (const p of s.paragrafos ?? []) linhas.push(p);
    for (const sub of s.subsecoes ?? []) linhas.push(sub.titulo, ...sub.paragrafos);
    for (const i of s.itens ?? []) linhas.push(`• ${i}`);
  }
  return linhas.join('\n');
}
