import { Clock3, ShieldCheck } from 'lucide-react';
import Header from '../Header';
import Footer from '../Footer';
import AngledButton from '../site-ui/AngledButton';

const WHATSAPP_CLUB_URL = 'https://wa.me/5531998842898?text=Ol%C3%A1!%20Quero%20receber%20um%20aviso%20quando%20o%20Clube%20de%20Vantagens%20estiver%20dispon%C3%ADvel.';

type ClubPortalUnavailableProps = {
  title: string;
};

export default function ClubPortalUnavailable({ title }: ClubPortalUnavailableProps) {
  return (
    <div className="min-h-screen bg-ink-950 text-white">
      <Header />
      <main className="px-4 pb-24 pt-32 md:pb-32 md:pt-40">
        <section className="mx-auto max-w-4xl border border-white/10 bg-ink-900 p-6 sm:p-10 md:p-14">
          <div className="flex flex-wrap items-center gap-3 text-primary-400">
            <Clock3 aria-hidden="true" className="h-6 w-6" />
            <p className="font-race text-xs font-bold uppercase tracking-[0.18em]">Portal em implantação</p>
          </div>

          <h1 className="mt-6 font-display text-4xl uppercase leading-none sm:text-5xl md:text-7xl">
            {title}
          </h1>

          <p className="mt-6 max-w-3xl text-base leading-7 text-white/70 md:text-lg md:leading-8">
            Esta área será liberada somente depois da integração segura com o cadastro de pilotos, as corridas e a pontuação real. Nenhum cadastro, saldo, alteração de perfil ou resgate é processado nesta página neste momento.
          </p>

          <div className="mt-8 grid gap-4 border border-primary-400/20 bg-primary-400/5 p-5 sm:grid-cols-[auto_1fr] sm:items-start">
            <ShieldCheck aria-hidden="true" className="h-7 w-7 text-primary-400" />
            <div>
              <h2 className="font-display text-xl uppercase">Seus dados primeiro</h2>
              <p className="mt-2 text-sm leading-6 text-white/65">
                O portal não exibirá dados de demonstração como se fossem informações verdadeiras. A abertura acontecerá com autenticação, persistência e histórico auditável.
              </p>
            </div>
          </div>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <AngledButton href={WHATSAPP_CLUB_URL} external>
              Receber aviso no WhatsApp
            </AngledButton>
            <AngledButton href="/clube-vantagens" variant="outline">
              Conhecer o programa
            </AngledButton>
            <AngledButton href="/clube-regulamento" variant="outline">
              Ver regulamento
            </AngledButton>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
