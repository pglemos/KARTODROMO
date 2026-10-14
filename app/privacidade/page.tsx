import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacidade do app | Kartódromo Internacional de Betim',
  description: 'Como o app do Kartódromo Internacional de Betim trata dados pessoais e localização.',
};

const sections = [
  {
    title: 'Dados tratados',
    content: (
      <>
        <p>Para criar e proteger uma conta, tratamos Nome, CPF, e-mail e telefone, além da senha convertida em um verificador criptográfico. O e-mail precisa ser confirmado para habilitar a conta e recuperar o acesso.</p>
        <p>Para reservas e pagamentos, usamos horário escolhido, quantidade e nomes dos pilotos, data de nascimento do responsável, cupom informado, valor, forma e situação do pagamento. O checkout é processado pelo Asaas; o app não armazena dados completos de cartão.</p>
        <p>Resultados oficiais podem mostrar nome de exibição, evento e data, posição, kart, voltas e melhor volta depois que a operação publicar a sessão. O histórico pessoal só é associado após a recepção validar o vínculo.</p>
      </>
    ),
  },
  {
    title: 'Localização e treinos pessoais',
    content: (
      <p>Quando a função GPS estiver habilitada após a medição e aprovação do traçado, ela coleta localização precisa, horário e precisão somente durante um treino iniciado por você, com o app aberto em primeiro plano e após seu consentimento. Os pontos e voltas ficam somente neste aparelho, não são enviados aos servidores do kartódromo e podem ser excluídos por você. A função permanece desabilitada até a geometria da pista ser aprovada; o app não coleta localização em segundo plano.</p>
    ),
  },
  {
    title: 'Uso e compartilhamento',
    content: (
      <p>Usamos os dados para autenticação, recuperação de conta, agenda, reservas, cupons, confirmação de pagamento e apresentação de resultados publicados. Os dados necessários passam pelo serviço de reservas do kartódromo e por provedores de infraestrutura (Cloudflare), mensagens de conta (Resend) e pagamento (Asaas). Não vendemos dados pessoais.</p>
    ),
  },
  {
    title: 'Retenção e exclusão',
    content: (
      <>
        <p>Você pode apagar treinos GPS no próprio app. O prazo de retenção ainda precisa ser confirmado pelo responsável do kartódromo para dados de conta, reserva, pagamento e resultados; essa confirmação é obrigatória antes da publicação nas lojas.</p>
        <p>Para solicitar acesso, correção ou exclusão de dados, use o canal geral <a className="underline underline-offset-4" href="mailto:contato@kartodromodebetim.com.br">contato@kartodromodebetim.com.br</a>. O responsável deve confirmar que esse canal também atenderá solicitações relacionadas à LGPD e informar os prazos aplicáveis.</p>
      </>
    ),
  },
  {
    title: 'Seus direitos',
    content: (
      <p>Você pode pedir confirmação do tratamento, acesso, correção, informação sobre compartilhamento, anonimização ou exclusão quando aplicável, além de revogar consentimentos. O responsável pelo tratamento, sua razão social e o canal dedicado à privacidade ainda precisam ser confirmados antes do lançamento.</p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#07110f] px-5 py-12 text-[#f2f5ed] sm:px-8 sm:py-16">
      <article className="mx-auto max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#c9f36a]">Kartódromo Internacional de Betim</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Política de privacidade</h1>
        <p className="mt-4 text-sm text-[#a5b2a8]">App Kartódromo de Betim · Atualizada em 13 de outubro de 2026</p>

        <aside className="mt-8 rounded-2xl border border-[#80651f] bg-[#261f0e] p-5 text-sm leading-6 text-[#f5e5b3]">
          Esta é uma minuta em revisão. A razão social do controlador, o canal LGPD e os prazos de retenção ainda precisam de confirmação pelo responsável do kartódromo. Não liberar o app nas lojas antes dessa validação.
        </aside>

        <p className="mt-8 text-base leading-7 text-[#d8e0d7]">Esta página descreve os dados pessoais usados para operar o app, suas reservas e os treinos GPS pessoais. Tratamos apenas os dados necessários para essas finalidades e para as obrigações do kartódromo.</p>

        <div className="mt-8 space-y-8">
          {sections.map((section) => (
            <section key={section.title} className="border-t border-[#273b32] pt-6">
              <h2 className="text-xl font-bold text-[#c9f36a]">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-[#d8e0d7]">{section.content}</div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
