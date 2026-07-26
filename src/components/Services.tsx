import { CreditCard, MessageCircle, Star, ArrowRight, ShieldCheck, CheckCircle, Gauge, Zap } from 'lucide-react';
import { SITE_BOOKING_ANCHOR } from '../config/booking';
import SectionHeading from './site-ui/SectionHeading';

const Services = () => {
  return (
    <section id="servicos" className="border-t border-white/10 bg-ink-950 py-16 md:py-24">
      <div className="container mx-auto px-4">
        <SectionHeading
          align="center"
          eyebrow="Compare e escolha"
          title={
            <>
              Nossas <span className="text-primary-400">Modalidades</span>
            </>
          }
        />
        <p className="mx-auto mt-6 max-w-3xl text-center text-lg font-light leading-relaxed text-white/70">
          Compare as categorias disponíveis e escolha a opção adequada ao seu nível de experiência.
        </p>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Kart Light */}
          <div className="flex flex-col justify-between border border-white/10 bg-ink-900 [clip-path:polygon(3%_0,100%_0,97%_100%,0_100%)]">
            <div>
              <div className="border-b border-white/10 p-8">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center border border-primary-400/30 bg-white/5">
                    <Gauge className="h-7 w-7 text-primary-400" aria-hidden="true" />
                  </div>
                  <span className="border border-primary-400/40 bg-primary-400/10 px-3 py-1 font-race text-[11px] italic font-bold uppercase tracking-widest text-primary-400">
                    Aberto ao Público
                  </span>
                </div>
                <h3 className="font-display text-2xl italic uppercase text-white">Kart Light</h3>
                <p className="mt-2 text-sm font-light text-white/65">Ideal para iniciantes, grupos de amigos, aniversários e lazer geral.</p>
              </div>

              <div className="space-y-6 p-8">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="border border-primary-400/30 bg-ink-950 p-5">
                    <div className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase text-primary-400">
                      <CreditCard className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                      Pix ou cartão de crédito
                    </div>
                    <div className="mb-1 font-race text-xs italic font-bold uppercase tracking-wider text-white/60">Antecipado Online</div>
                    <div className="font-display text-3xl italic tracking-tight text-primary-400">R$ 145,00</div>
                    <div className="mt-1 text-xs font-semibold text-primary-300">Economize R$ 30,00</div>
                  </div>

                  <div className="border border-white/10 bg-ink-950 p-5">
                    <div className="mb-1 font-race text-xs italic font-bold uppercase tracking-wider text-white/60">No Balcão / Local</div>
                    <div className="font-display text-3xl italic tracking-tight text-white">R$ 175,00</div>
                    <div className="mt-1 text-xs text-white/50">Crédito, Débito ou Pix</div>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <h4 className="mb-2 flex items-center font-race text-sm italic font-bold uppercase tracking-wider text-white">
                    <ShieldCheck className="mr-1.5 h-4 w-4 text-primary-400" />
                    Regras e Requisitos
                  </h4>
                  <ul className="space-y-2 text-sm font-light text-white/70">
                    <li className="flex items-start">
                      <CheckCircle className="mr-2 mt-0.5 h-4 w-4 flex-shrink-0 text-primary-400" />
                      <span>Bateria de <strong className="text-white">30 min</strong> (5m tomada de tempo, 5m formação de grid, 20m corrida).</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="mr-2 mt-0.5 h-4 w-4 flex-shrink-0 text-primary-400" />
                      <span>Idade mínima de <strong className="text-white">14 anos completos</strong>.</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="mr-2 mt-0.5 h-4 w-4 flex-shrink-0 text-primary-400" />
                      <span>Altura mínima de <strong className="text-white">1,50 m</strong> e peso mínimo de <strong className="text-white">50 kg</strong>.</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="mr-2 mt-0.5 h-4 w-4 flex-shrink-0 text-primary-400" />
                      <span>Obrigatório o uso de <strong className="text-white">calçado fechado</strong> (tênis).</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 p-8">
              <a
                href={SITE_BOOKING_ANCHOR}
                className="flex w-full items-center justify-center gap-2 border border-white/15 bg-white/5 px-4 py-3.5 font-race text-sm italic font-bold uppercase tracking-wider text-white transition-all hover:border-primary-400/50"
              >
                <span>Reservar Kart Light</span>
                <ArrowRight className="h-4 w-4 text-primary-400" />
              </a>
            </div>
          </div>

          {/* Super Kart */}
          <div className="flex flex-col justify-between border border-white/10 bg-ink-900 [clip-path:polygon(3%_0,100%_0,97%_100%,0_100%)]">
            <div>
              <div className="border-b border-white/10 p-8">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center border border-yellow-500/30 bg-yellow-500/10">
                    <Zap className="h-7 w-7 text-yellow-400" aria-hidden="true" />
                  </div>
                  <span className="border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 font-race text-[11px] italic font-bold uppercase tracking-widest text-yellow-400">
                    Pilotos Experientes
                  </span>
                </div>
                <h3 className="font-display text-2xl italic uppercase text-white">Super Kart</h3>
                <p className="mt-2 text-sm font-light text-white/65">Reservado para pilotos frequentes, filiados, treinos avulsos e campeonatos.</p>
              </div>

              <div className="space-y-6 p-8">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="border border-white/10 bg-ink-950 p-5">
                    <div className="mb-1 font-race text-xs italic font-bold uppercase tracking-wider text-white/60">Valor Balcão Regular</div>
                    <div className="font-display text-3xl italic tracking-tight text-white">R$ 200,00</div>
                    <div className="mt-1 text-xs text-white/50">Crédito, Débito ou Pix</div>
                  </div>

                  <div className="relative border border-yellow-500/30 bg-ink-950 p-5">
                    <div className="absolute right-2 top-2 flex items-center text-xs font-semibold text-yellow-400">
                      <Star className="mr-0.5 h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      CLUBE
                    </div>
                    <div className="mb-1 font-race text-xs italic font-bold uppercase tracking-wider text-white/60">Com Carteirinha</div>
                    <div className="font-display text-3xl italic tracking-tight text-yellow-400">R$ 185,00</div>
                    <div className="mt-1 text-xs font-semibold text-yellow-300">Desconto de R$ 15,00</div>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <h4 className="mb-2 flex items-center font-race text-sm italic font-bold uppercase tracking-wider text-white">
                    <ShieldCheck className="mr-1.5 h-4 w-4 text-yellow-400" />
                    Regras e Requisitos
                  </h4>
                  <ul className="space-y-2 text-sm font-light text-white/70">
                    <li className="flex items-start">
                      <CheckCircle className="mr-2 mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-400" />
                      <span>Karts de alta performance equipados com motores <strong className="text-white">Honda GX390 de 13HP (400cc)</strong>.</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="mr-2 mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-400" />
                      <span>Desconto de R$ 15,00 é válido apenas em baterias abertas e treinos avulsos de Super Kart.</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="mr-2 mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-400" />
                      <span>Necessário apresentar a carteirinha oficial do Super Kart no balcão de atendimento.</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="mr-2 mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-400" />
                      <span>Mesmos critérios de segurança básica e indumentária obrigatória da categoria Light.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 p-8">
              <a
                href="https://wa.me/5531998842898?text=Ol%C3%A1!%20Gostaria%20de%20saber%20sobre%20os%20hor%C3%A1rios%20dispon%C3%ADveis%20para%20o%20Super%20Kart."
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 border border-white/15 bg-white/5 px-4 py-3.5 font-race text-sm italic font-bold uppercase tracking-wider text-white transition-all hover:border-yellow-500/50"
              >
                <span>Falar com Atendimento Super Kart</span>
                <ArrowRight className="h-4 w-4 text-yellow-400" />
              </a>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-16 flex max-w-5xl flex-col items-center justify-between gap-6 border border-white/10 bg-ink-900 p-8 md:flex-row">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="font-display text-xl italic uppercase tracking-tight text-white">Deseja uma bateria exclusiva para seu grupo?</h3>
            <p className="max-w-xl text-sm font-light text-white/65">
              Terça a sexta-feira: mínimo de 25 pilotos para fechamento de bateria. Finais de semana e feriados: mínimo de 30 pilotos.
              Para grupos menores, agendamos baterias mistas.
            </p>
          </div>
          <a
            href="https://wa.me/5531998842898"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-gradient-to-br from-primary-400 to-primary-600 px-6 py-3.5 font-race text-xs italic font-bold uppercase tracking-wider text-ink-950 [clip-path:polygon(7%_0,100%_0,93%_100%,0_100%)]"
          >
            <MessageCircle className="h-4 w-4" />
            Reservar via WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
};

export default Services;
