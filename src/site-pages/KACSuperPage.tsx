import { Award, Gauge, RefreshCcw, ShieldAlert, Trophy, Users } from 'lucide-react';
import ChampionshipDetailLayout from '../components/ChampionshipDetailLayout';

const KACSuperPage = () => {
  return (
    <ChampionshipDetailLayout
      eyebrow="Campeonato oficial · SUPER KART"
      titleLine1="KAC"
      titleLine2="Super Kart"
      lead="Um campeonato anual disputado na categoria Super Kart com 9 etapas, sendo uma corrida por mês, para pilotos experientes."
      logo="/championships/4.png"
      logoAlt="Logo KAC Super Kart"
      watermark="SUPER"
      watermarkCaption="temporada 2026"
      specs={[
        ['Etapas', '9 no ano'],
        ['Peso mínimo', '100 kg'],
        ['Formato', 'Mensal'],
        ['Temporada', '2026'],
      ]}
      primaryAction={{ kind: 'form', championshipId: 'kac-super-kart', label: 'Inscrição do Piloto' }}
      regulationPdf="/regulamentos/kac-super-kart-2026.pdf"
      rulesTitle="Regra clara. Disputa limpa."
      rules={[
        { icon: Trophy, title: 'Temporada anual', text: 'Nove etapas ao longo do ano, uma corrida por mês, com pontuação acumulada.' },
        { icon: Gauge, title: 'Peso mínimo', text: '100 kg com equipamentos, usando lastro adicional quando necessário.' },
        { icon: RefreshCcw, title: 'Troca de kart', text: 'Uma troca após a tomada de tempo; segunda somente por quebra mecânica.' },
        { icon: Users, title: 'Convidados', text: 'Até três convidados por corrida, largando nas últimas posições.' },
        { icon: ShieldAlert, title: 'Punições', text: 'Advertências, posições e pontos conforme gravidade da infração.' },
        { icon: Award, title: 'Premiação', text: 'Os cinco primeiros ficam na zona principal de premiação.' },
      ]}
      ctaTitleLine1="Entrar no KAC Super Kart"
      ctaTitleLine2="em 2026"
      ctaText="Confirme vagas, inscrição, lastro e detalhes diretamente com a organização."
    />
  );
};

export default KACSuperPage;
