import { Award, ClipboardList, Gauge, ShieldAlert, Trophy, Users } from 'lucide-react';
import ChampionshipDetailLayout from '../components/ChampionshipDetailLayout';

const FiveHundredMilesPage = () => {
  return (
    <ChampionshipDetailLayout
      eyebrow="ULTRA ENDURANCE"
      titleLine1="500"
      titleLine2="Milhas de Betim"
      lead="O maior desafio do calendário, com alto nível de competitividade e emoção. Uma corrida com 12 horas de duração que exige preparo físico, mental e estratégia apurada das equipes."
      logo="/championships/1.png"
      logoAlt="Logo 500 Milhas de Betim"
      watermark="500"
      watermarkCaption="inscrições abertas · 22/08/2026"
      specs={[
        ['Data', '22/08/2026'],
        ['Duração', '12 horas'],
        ['Formato', 'Equipe'],
        ['Valores', 'Via WhatsApp'],
      ]}
      primaryAction={{ kind: 'form', championshipId: '500-milhas', label: 'Inscrever equipe' }}
      rulesTitle="Dados necessários para inscrição"
      rules={[
        { icon: ClipboardList, title: 'Nome da equipe', text: 'Informe o nome oficial da equipe no ato da inscrição.' },
        { icon: Users, title: 'Chefe de equipe', text: 'Indique o responsável pela equipe durante o campeonato.' },
        { icon: Gauge, title: 'Pilotos e peso', text: 'Nome de cada piloto e peso individual em kg.' },
        { icon: Award, title: 'Quantidade de karts', text: 'Informe quantos karts a equipe vai inscrever na prova.' },
        { icon: ShieldAlert, title: 'Regulamento', text: 'Valores, regras de boxes e critérios completos são enviados pela organização via WhatsApp.' },
        { icon: Trophy, title: 'Inscrição', text: 'Vaga confirmada conforme retorno da organização.' },
      ]}
      ctaTitleLine1="Inscrever equipe"
      ctaTitleLine2="agora"
      ctaText="Fale com a organização para confirmar vaga, valores e próximos passos."
    />
  );
};

export default FiveHundredMilesPage;
