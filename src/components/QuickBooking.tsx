import { MYLAPTIME_BOOKING_URL } from '../config/booking';

type QuickBookingProps = {
  surface?: 'home' | 'page';
};

/**
 * Agendamento oficial via MyLapTime — link direto (nova aba), sem clonar a interface deles sob
 * nosso dominio.
 *
 * Ate 2026-07-02 esse widget carregava `tools.mylaptime.com.br` num iframe proxeado pelo nosso
 * servidor (`lib/mylaptime-proxy.ts`), reescrevendo os headers/JS deles pra burlar a protecao
 * anti-personificacao de marca que a Sisecom (fabricante do LapTime/MyLapTime) tem na propria
 * pagina. A Sisecom abriu uma denuncia formal de abuso no Cloudflare por isso (personificacao de
 * marca / violacao de marca registrada / coleta de PII), e o Cloudflare passou a bloquear
 * `kartodromodebetim.com.br/` e `/booking` como "Suspected Phishing" — depois a mesma coisa
 * comecou a acontecer em `www.kartodromodebetim.com.br/booking`. Nao e' um bloqueio de URL, e' do
 * PADRAO (clonar a pagina deles), entao mudar de dominio/rota nao resolve — so para de clonar
 * resolve. Por isso o proxy inteiro (`lib/mylaptime-proxy.ts`, `app/api/mylaptime-proxy/*`, os
 * rewrites em `next.config.ts`) foi removido, e este componente agora so' linka pro dominio
 * oficial deles.
 */
const QuickBooking = ({ surface = 'home' }: QuickBookingProps) => {
  const HeadingTag = surface === 'page' ? 'h1' : 'h2';

  return (
    <section
      id="agendamento"
      className="scroll-mt-28 border-t border-zinc-200 bg-[#efefef] py-16 md:scroll-mt-24 md:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 text-center">
        <HeadingTag className="font-sans text-[34px] font-normal tracking-tight text-zinc-900 md:text-[44px]">
          Consulte e <span className="font-extrabold text-primary-700">agende seu horário</span>
        </HeadingTag>

        <div aria-hidden="true" className="mx-auto mt-8 grid w-10 grid-cols-2 gap-1 opacity-80">
          <span className="h-2.5 w-2.5 skew-x-[-12deg] bg-zinc-300" />
          <span className="h-2.5 w-2.5 skew-x-[-12deg] bg-primary-600" />
          <span className="h-2.5 w-2.5 skew-x-[-12deg] bg-primary-600" />
          <span className="h-2.5 w-2.5 skew-x-[-12deg] bg-zinc-300" />
        </div>

        <p className="mx-auto mt-8 max-w-5xl text-center text-xl leading-8 text-zinc-800 md:text-2xl md:leading-9">
          Após 10 corridas, você conquista a <strong className="font-black">CARTEIRA de PILOTO</strong> e pode correr no Super Kart.
        </p>

        <p className="mx-auto mt-8 max-w-4xl text-center text-xl font-medium leading-tight text-zinc-900 md:text-2xl">
          Preço normal <span className="font-black text-primary-700">R$ 175,00</span>, mas reserve agora e pague antecipado com
          super desconto, saindo por apenas <span className="font-black text-primary-700">R$ 145,00</span>. (Promoção por tempo
          limitado) <span className="font-black text-primary-700">APROVEITE!!</span>
        </p>

        <div className="mx-auto mt-12 max-w-2xl rounded-lg border border-zinc-200 bg-white px-6 py-12 shadow-sm md:px-16 md:py-16">
          <p className="text-lg font-medium text-zinc-700 md:text-xl">
            A consulta de horários e a reserva são feitas na plataforma oficial de agendamento.
          </p>
          <a
            href={MYLAPTIME_BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center justify-center rounded bg-primary-600 px-10 py-4 text-lg font-bold uppercase tracking-wide text-white transition-colors hover:bg-primary-700"
          >
            Consultar horários e agendar
          </a>
          <p className="mt-4 text-sm text-zinc-500">
            Abre em uma nova aba, no site oficial de reservas.
          </p>
        </div>
      </div>

      {surface === 'page' && (
        <div className="mx-auto mt-10 max-w-5xl rounded border border-zinc-200 bg-white px-5 py-6 text-left shadow-sm md:px-8">
          <h2 className="text-lg font-black uppercase tracking-[0.08em] text-zinc-900">
            Política de Cancelamento e Extorno
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-700 md:text-base">
            <p>
              O cancelamento de reservas deve ser solicitado com antecedência mínima de 24 horas em relação ao horário
              agendado.
            </p>
            <p>
              Solicitações realizadas dentro desse prazo poderão ser reagendadas conforme disponibilidade da agenda. Em
              caso de solicitação de extorno, a devolução será processada pelo mesmo meio de pagamento utilizado na
              compra, respeitando os prazos da operadora ou instituição financeira.
            </p>
            <p>
              Em caso de não comparecimento ou solicitação fora do prazo, o valor pago não será reembolsado.
            </p>
          </div>
        </div>
      )}
    </section>
  );
};

export default QuickBooking;
