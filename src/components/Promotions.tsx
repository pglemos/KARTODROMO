import { Gift, Users, AlertTriangle, Check, MessageCircle } from 'lucide-react';
import SectionHeading from './site-ui/SectionHeading';

const Promotions = () => {
  return (
    <section id="promocoes" className="border-t border-white/10 bg-ink-900 py-16 md:py-24">
      <div className="container mx-auto px-4">
        <SectionHeading
          align="center"
          eyebrow="Aproveite agora"
          title={
            <>
              Nossas <span className="text-primary-400">Promoções</span>
            </>
          }
        />
        <p className="mx-auto mt-6 max-w-3xl text-center text-lg font-light leading-relaxed text-white/70">
          Aproveite nossos descontos especiais e traga sua turma para correr pagando menos!
        </p>

        <div className="mx-auto mb-16 mt-16 grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Aniversariante */}
          <div className="flex flex-col justify-between border border-white/10 bg-ink-950 p-8">
            <div>
              <div className="mb-6 flex items-center space-x-4">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center border border-primary-400/30 bg-white/5 text-primary-400">
                  <Gift className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="font-display text-xl italic uppercase tracking-tight text-white">Aniversariante do Mês</h3>
                  <p className="font-race text-xs italic font-bold uppercase tracking-wider text-primary-400">Corrida com Preço Especial</p>
                </div>
              </div>

              <div className="mb-6 border border-white/10 bg-ink-900 p-5">
                <p className="mb-3 text-sm font-light leading-relaxed text-white/70">
                  Trazendo um grupo de no mínimo <strong className="text-white">10 amigos pagantes</strong>, a bateria do aniversariante sai por apenas:
                </p>
                <div className="flex items-baseline space-x-2">
                  <span className="font-display text-4xl italic text-primary-400">R$ 90,00</span>
                  <span className="text-xs text-white/55">para o aniversariante</span>
                </div>
                <p className="mt-2 text-xs text-white/55">
                  Os convidados pagam o valor promocional antecipado de <strong className="text-white/80">R$ 145,00</strong> cada.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="mb-2 flex items-center font-race text-xs italic font-bold uppercase tracking-wider text-white">
                  <AlertTriangle className="mr-1 h-4 w-4 text-primary-400" />
                  Regras e Condições
                </h4>
                <ul className="space-y-2 text-xs font-light text-white/65">
                  <li className="flex items-start">
                    <Check className="mr-2 mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary-400" />
                    <span>Válido para baterias exclusivas de <strong className="text-white">Kart Light</strong> durante todo o mês de aniversário.</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="mr-2 mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary-400" />
                    <span>Necessário solicitar a promoção no ato da reserva e agendamento prévio de no mínimo <strong className="text-white">3 dias</strong>.</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="mr-2 mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary-400" />
                    <span>Mínimo de <strong className="text-white">11 pilotos no total</strong> (aniversariante + 10 amigos) presentes no dia.</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="mr-2 mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary-400" />
                    <span>Necessário apresentar documento original com foto no balcão para validação.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-8">
              <a
                href="https://wa.me/553135112373?text=Ol%C3%A1!%20Gostaria%20de%20agendar%20minha%20corrida%20de%20aniversariante%20do%20m%C3%AAs."
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-14 w-full items-center justify-center gap-2 bg-gradient-to-br from-primary-400 to-primary-600 px-5 py-3.5 font-race text-xs italic font-black uppercase tracking-wider text-ink-950 [clip-path:polygon(7%_0,100%_0,93%_100%,0_100%)]"
              >
                <MessageCircle className="h-5 w-5" />
                Agendar Bateria de Aniversário
              </a>
            </div>
          </div>

          {/* Compra Coletiva */}
          <div className="flex flex-col justify-between border border-white/10 bg-ink-950 p-8">
            <div>
              <div className="mb-6 flex items-center space-x-4">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center border border-yellow-500/30 bg-yellow-500/10 text-yellow-400">
                  <Users className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="font-display text-xl italic uppercase tracking-tight text-white">Compra Coletiva</h3>
                  <p className="font-race text-xs italic font-bold uppercase tracking-wider text-yellow-400">Desconto para Grupos</p>
                </div>
              </div>

              <div className="mb-6 border border-white/10 bg-ink-900 p-5">
                <p className="mb-3 text-sm font-light leading-relaxed text-white/70">
                  Para grupos fechados, organizando o pagamento de forma única via Pix ou transferência com antecedência:
                </p>
                <div className="flex items-baseline space-x-2">
                  <span className="font-display text-4xl italic text-yellow-400">R$ 145,00</span>
                  <span className="text-xs text-white/55">por pessoa</span>
                </div>
                <p className="mt-2 text-xs text-white/55">
                  Economia garantida de R$ 30,00 por piloto sobre o preço de balcão (R$ 175,00).
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="mb-2 flex items-center font-race text-xs italic font-bold uppercase tracking-wider text-white">
                  <AlertTriangle className="mr-1 h-4 w-4 text-yellow-400" />
                  Regras e Condições
                </h4>
                <ul className="space-y-2 text-xs font-light text-white/65">
                  <li className="flex items-start">
                    <Check className="mr-2 mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-yellow-400" />
                    <span>Aplicável apenas para agendamento prévio na categoria de <strong className="text-white">Kart Light</strong>.</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="mr-2 mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-yellow-400" />
                    <span>O pagamento total deve ser feito pelo organizador em uma transação única até <strong className="text-white">7 dias antes</strong> da corrida.</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="mr-2 mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-yellow-400" />
                    <span>Mínimo de <strong className="text-white">10 pilotos</strong> no grupo pagante para validar a promoção.</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="mr-2 mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-yellow-400" />
                    <span>Pilotos adicionais avulsos que pagarem no local no dia perdem o benefício e pagam preço cheio de balcão.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-8">
              <a
                href="https://wa.me/553135112373?text=Ol%C3%A1!%20Gostaria%20de%20solicitar%20a%20promo%C3%A7%C3%A3o%20de%20compra%20coletiva%20para%20meu%20grupo."
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-14 w-full items-center justify-center gap-2 bg-yellow-400 px-5 py-3.5 font-race text-xs italic font-black uppercase tracking-wider text-ink-950 [clip-path:polygon(7%_0,100%_0,93%_100%,0_100%)] transition-colors hover:bg-yellow-300"
              >
                <MessageCircle className="h-5 w-5" />
                Agendar Compra Coletiva
              </a>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-5xl border border-white/10 bg-ink-950 p-6 md:p-8">
          <div className="mb-4 flex items-center space-x-3">
            <AlertTriangle className="h-6 w-6 flex-shrink-0 text-primary-400" />
            <h4 className="font-race text-base italic font-bold uppercase tracking-wider text-white">Atenção ao Reservar Exclusividade</h4>
          </div>
          <div className="grid grid-cols-1 gap-6 text-xs font-light text-white/65 md:grid-cols-2">
            <div className="space-y-2">
              <p>• <strong className="uppercase text-white">Promoções Não Cumulativas:</strong> Os descontos de Aniversariante e Compra Coletiva não podem ser associados a outras ofertas vigentes.</p>
              <p>• <strong className="uppercase text-white">Baterias Fechadas:</strong> Ao reservar uma bateria exclusiva, o grupo garante a pista inteira somente para si, necessitando honrar o pagamento das cotas mínimas acordadas na contratação.</p>
            </div>
            <div className="space-y-2">
              <p>• <strong className="uppercase text-white">Política de Não Reembolso:</strong> Não haverá estornos caso compareçam menos participantes no dia do que o número de vagas previamente contratado.</p>
              <p>• <strong className="uppercase text-white">Limite de Karts:</strong> A pista suporta o máximo de até 35 karts rodando simultaneamente por bateria para total integridade física dos competidores.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Promotions;
