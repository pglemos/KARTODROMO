import { Award, ClipboardList, Gauge, ShieldAlert, Trophy, Users } from 'lucide-react';
import ChampionshipDetailLayout from '../components/ChampionshipDetailLayout';

const TwoHundredMilesPage = () => {
  return (
    <ChampionshipDetailLayout
      eyebrow="ENDURANCE"
      titleLine1="200"
      titleLine2="Milhas de Betim"
      lead="Prova com duração de 5 horas que desafia estratégia, resistência e trabalho em equipe. Uma das corridas mais tradicionais do kartismo regional, reunindo pilotos em uma disputa intensa do início ao fim."
      logo="/championships/2.png"
      logoAlt="Logo 200 Milhas de Betim"
      watermark="200"
      watermarkCaption="edição 07/02/2026 · inscrições encerradas"
      specs={[
        ['Última edição', '07/02/2026'],
        ['Status', 'Inscrições encerradas'],
        ['Duração', '5 horas'],
        ['Formato', 'Equipe'],
      ]}
      primaryAction={{
        kind: 'whatsapp',
        text: 'Olá! Quero ser avisado sobre a próxima edição das 200 Milhas de Betim.',
        label: 'Avisem-me da próxima edição',
      }}
      rulesTitle="Como era a inscrição"
      rules={[
        { icon: ClipboardList, title: 'Nome da equipe', text: 'Nome oficial da equipe informado no ato da inscrição.' },
        { icon: Users, title: 'Chefe de equipe', text: 'Responsável pela equipe durante o campeonato.' },
        { icon: Gauge, title: 'Pilotos e peso', text: 'Nome de cada piloto e peso individual em kg.' },
        { icon: Award, title: 'Quantidade de karts', text: 'Karts participantes inscritos pela equipe.' },
        { icon: ShieldAlert, title: 'Próxima edição', text: 'Data, valores e regulamento da próxima edição serão anunciados pela organização.' },
        { icon: Trophy, title: 'Tradição regional', text: 'Uma das provas de endurance mais tradicionais do kartismo de Minas Gerais.' },
      ]}
      ctaTitleLine1="Avisem-me da"
      ctaTitleLine2="próxima edição"
      ctaText="Fale com a organização para ser avisado assim que a próxima edição for anunciada."
    />
  );
};

export default TwoHundredMilesPage;
