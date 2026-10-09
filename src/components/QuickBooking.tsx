import { RESERVA_ONLINE_URL } from '../config/booking';
import AngledButton from './site-ui/AngledButton';
import PoliticaCancelamento from './site-ui/PoliticaCancelamento';
import SectionHeading from './site-ui/SectionHeading';

type QuickBookingProps = {
  surface?: 'home' | 'page';
};

/**
 * Agendamento: desde 01/10/2026 abre a reserva online propria (reservas.kartodromodebetim.com.br, worker
 * workers/pre-cadastro, pagamento Asaas). Antes linkava o MyLapTime, que ficou sem horarios com o LapTime desligado.
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
  return (
    <section
      id="agendamento"
      className="scroll-mt-28 border-t border-white/10 bg-ink-900 py-16 md:scroll-mt-24 md:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 text-center">
        <SectionHeading
          align="center"
          eyebrow="Agendamento"
          title={
            <>
              Consulte e <span className="text-primary-400">agende seu horário</span>
            </>
          }
        />

        <p className="mx-auto mt-8 max-w-5xl text-center text-xl leading-8 text-white/75 md:text-2xl md:leading-9">
          Após 10 corridas, você conquista a <strong className="font-black text-white">CARTEIRA de PILOTO</strong> e pode correr no Super Kart.
        </p>

        <p className="mx-auto mt-8 max-w-4xl text-center text-xl font-medium leading-tight text-white/85 md:text-2xl">
          Preço normal <span className="font-black text-primary-400">R$ 175,00</span>, mas reserve agora e pague antecipado com
          super desconto, saindo por apenas <span className="font-black text-primary-400">R$ 145,00</span>. (Promoção por tempo
          limitado) <span className="font-black text-primary-400">APROVEITE!!</span>
        </p>

        <div className="mx-auto mt-12 max-w-2xl border border-white/10 bg-ink-950 px-6 py-12 md:px-16 md:py-16">
          <p className="text-lg font-medium text-white/75 md:text-xl">
            Escolha o dia e o horário, pague no Pix ou no cartão e receba a confirmação na hora.
          </p>
          <div className="mt-8 flex justify-center">
            <AngledButton href={RESERVA_ONLINE_URL} external>
              Consultar horários e agendar
            </AngledButton>
          </div>
          <p className="mt-4 text-sm text-white/50">
            Abre em uma nova aba a página de reservas do kartódromo.
          </p>
          <p className="mt-2 text-sm text-white/60">
            A reserva só é concluída depois de aceitar a{' '}
            <a className="font-semibold text-primary-400 underline underline-offset-4" href={surface === 'page' ? '#politica-cancelamento' : '/reservas#politica-cancelamento'}>
              Política de Cancelamento, Reagendamento e Reembolso
            </a>
            .
          </p>
        </div>
      </div>

      {surface === 'page' && <PoliticaCancelamento className="mx-auto mt-10 max-w-5xl" />}
    </section>
  );
};

export default QuickBooking;
