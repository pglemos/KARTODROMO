import { Bell, Gift, ShieldCheck, Sparkles } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import AngledButton from '../components/site-ui/AngledButton';
import ClubPortalUnavailable from '../components/club/ClubPortalUnavailable';

export type ClubPageKey =
  | 'vantagens'
  | 'cadastro'
  | 'consulta'
  | 'painel'
  | 'corridas'
  | 'pontuacao'
  | 'catalogo'
  | 'resgates'
  | 'perfil'
  | 'regulamento'
  | 'campanhas';

const WHATSAPP_CLUB_URL = 'https://wa.me/5531998842898?text=Ol%C3%A1!%20Quero%20receber%20um%20aviso%20quando%20o%20Clube%20de%20Vantagens%20estiver%20dispon%C3%ADvel.';

const unavailableTitles: Record<Exclude<ClubPageKey, 'vantagens' | 'regulamento'>, string> = {
  cadastro: 'Cadastro do clube',
  consulta: 'Consulta de pontos',
  painel: 'Meu painel',
  corridas: 'Histórico de corridas',
  pontuacao: 'Minha pontuação',
  catalogo: 'Catálogo de recompensas',
  resgates: 'Histórico de resgates',
  perfil: 'Meu perfil',
  campanhas: 'Campanhas especiais',
};

function ClubLanding() {
  const benefits = [
    {
      icon: Gift,
      title: 'Recompensas reais',
      text: 'Produtos e experiências serão exibidos com saldo, disponibilidade e regras de retirada confirmadas.',
    },
    {
      icon: ShieldCheck,
      title: 'Dados protegidos',
      text: 'O acesso será liberado com autenticação e histórico vinculado ao piloto correto.',
    },
    {
      icon: Sparkles,
      title: 'Campanhas especiais',
      text: 'Bônus e condições promocionais serão publicados com período, critérios e regulamento próprios.',
    },
  ];

  return (
    <div className="min-h-screen bg-ink-950 text-white">
      <Header />
      <main>
        <section className="relative overflow-hidden px-4 pb-24 pt-36 md:pb-32 md:pt-44">
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,rgba(0,230,118,.18),transparent_38%)]" />
          <div className="relative mx-auto max-w-6xl">
            <div className="inline-flex items-center gap-2 border border-primary-400/30 bg-primary-400/10 px-4 py-2 text-primary-400">
              <Bell aria-hidden="true" className="h-4 w-4" />
              <span className="font-race text-xs font-bold uppercase tracking-[0.16em]">Programa em implantação</span>
            </div>

            <h1 className="mt-7 max-w-4xl font-display text-6xl uppercase leading-[0.82] sm:text-7xl md:text-8xl">
              Clube de <span className="text-primary-400">Vantagens</span>
            </h1>

            <p className="mt-8 max-w-3xl text-lg leading-8 text-white/70 md:text-xl">
              O programa está sendo integrado ao cadastro de pilotos e às corridas reais. A área de conta será aberta somente quando cadastro, pontuação, resgate e histórico funcionarem de forma persistente e segura.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <AngledButton href={WHATSAPP_CLUB_URL} external>
                Receber aviso no WhatsApp
              </AngledButton>
              <AngledButton href="/clube-regulamento" variant="outline">
                Consultar regulamento preliminar
              </AngledButton>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-ink-900 px-4 py-20 md:py-28">
          <div className="mx-auto max-w-6xl">
            <p className="font-race text-xs font-bold uppercase tracking-[0.18em] text-primary-400">Compromisso de lançamento</p>
            <h2 className="mt-4 max-w-3xl font-display text-4xl uppercase leading-none sm:text-5xl md:text-6xl">
              Primeiro funcionar.<br />Depois prometer.
            </h2>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {benefits.map(({ icon: Icon, title, text }) => (
                <article className="border border-white/10 bg-ink-950 p-6" key={title}>
                  <Icon aria-hidden="true" className="h-7 w-7 text-primary-400" />
                  <h3 className="mt-5 font-display text-2xl uppercase">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/65">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function ClubRegulation() {
  const sections = [
    {
      title: '1. Situação do programa',
      items: [
        'O Clube de Vantagens encontra-se em implantação técnica.',
        'Cadastro, consulta de pontos, resgates e edição de perfil não estão disponíveis enquanto a integração segura não estiver concluída.',
      ],
    },
    {
      title: '2. Ativação',
      items: [
        'A abertura será comunicada nos canais oficiais do Kartódromo Internacional de Betim.',
        'No lançamento, serão publicados a versão vigente do regulamento, a política de privacidade, as regras de pontuação e a validade dos pontos.',
      ],
    },
    {
      title: '3. Dados e autenticação',
      items: [
        'Informações pessoais somente serão coletadas quando houver finalidade definida, armazenamento persistente e canal para atualização ou exclusão.',
        'Nenhum saldo ou histórico exibido antes do lançamento deve ser tratado como informação de cliente.',
      ],
    },
    {
      title: '4. Recompensas e campanhas',
      items: [
        'Catálogo, estoque, retirada, validade e condições de campanhas serão informados de forma clara antes de qualquer confirmação de resgate.',
        'Nenhum resgate é processado nas páginas atuais do site.',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-ink-950 text-white">
      <Header />
      <main className="px-4 pb-24 pt-32 md:pb-32 md:pt-40">
        <div className="mx-auto max-w-4xl">
          <p className="font-race text-xs font-bold uppercase tracking-[0.18em] text-primary-400">Versão preliminar · 20 de julho de 2026</p>
          <h1 className="mt-4 font-display text-4xl uppercase leading-none sm:text-5xl md:text-7xl">Regulamento do clube</h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-white/70 md:text-lg">
            Este documento descreve o estado de implantação. A versão operacional será publicada antes da abertura de contas e substituirá este texto preliminar.
          </p>

          <div className="mt-12 grid gap-8">
            {sections.map((section) => (
              <section className="border-t border-white/10 pt-6" key={section.title}>
                <h2 className="font-display text-2xl uppercase text-primary-400">{section.title}</h2>
                <div className="mt-4 grid gap-3">
                  {section.items.map((item) => (
                    <p className="text-base leading-7 text-white/70" key={item}>{item}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <AngledButton href={WHATSAPP_CLUB_URL} external>
              Receber aviso no lançamento
            </AngledButton>
            <AngledButton href="/clube-vantagens" variant="outline">
              Voltar ao clube
            </AngledButton>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function ClubPage({ page }: { page: ClubPageKey }) {
  if (page === 'vantagens') return <ClubLanding />;
  if (page === 'regulamento') return <ClubRegulation />;

  return <ClubPortalUnavailable title={unavailableTitles[page]} />;
}
