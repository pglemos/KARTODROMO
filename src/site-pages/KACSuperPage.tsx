import { Award, ClipboardList, Coins, Gauge, ShieldAlert, Trophy } from 'lucide-react';
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
        ['Formato', 'Mensal'],
        ['Temporada', '2026'],
        ['Valores', 'Via WhatsApp'],
      ]}
      primaryAction={{ kind: 'form', championshipId: 'kac-super-kart', label: 'Inscrição do Piloto' }}
      rulesTitle="Dados necessários para inscrição"
      rules={[
        { icon: Trophy, title: 'Temporada anual', text: 'Nove etapas ao longo do ano, uma corrida por mês, com pontuação acumulada.' },
        { icon: Gauge, title: 'Categoria Super Kart', text: 'Disputado com os karts de alta performance Honda GX390 13HP, para pilotos experientes.' },
        { icon: Coins, title: 'Taxa de inscrição', text: 'Taxa única de inscrição no campeonato, mais pagamento individual de cada etapa corrida.' },
        { icon: ClipboardList, title: 'Inscrição do piloto', text: 'Nome completo e dados do piloto informados no ato da inscrição.' },
        { icon: ShieldAlert, title: 'Regulamento', text: 'Regras de pontuação, punições e premiação são detalhadas pela organização via WhatsApp.' },
        { icon: Award, title: 'Premiação', text: 'Classificação acumulada ao longo das 9 etapas da temporada.' },
      ]}
      ctaTitleLine1="Entrar no KAC Super Kart"
      ctaTitleLine2="em 2026"
      ctaText="Confirme vagas, inscrição e valores diretamente com a organização."
    />
  );
};

export default KACSuperPage;
