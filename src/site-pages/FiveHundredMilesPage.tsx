import { Coins, Fuel, Gauge, ShieldAlert, Trophy, Users } from 'lucide-react';
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
        ['Valor', 'R$ 6.800 / equipe'],
        ['Duração', '12 horas'],
        ['Formato', 'Equipe'],
      ]}
      primaryAction={{ kind: 'form', championshipId: '500-milhas', label: 'Inscrever equipe' }}
      regulationPdf="/regulamentos/500-milhas-de-betim-2026.pdf"
      rulesTitle="Controle, ritmo e disciplina"
      rules={[
        { icon: Coins, title: 'Valor único', text: 'R$ 6.800 por equipe, independentemente do número de pilotos.' },
        { icon: Users, title: 'Operação de equipe', text: 'Estratégia de revezamento, ritmo e decisões de box.' },
        { icon: Gauge, title: 'Peso e lastro', text: 'Critérios definidos para equilibrar o desempenho.' },
        { icon: Fuel, title: 'Procedimento de boxes', text: 'Velocidade, parada e trocas monitoradas pela direção.' },
        { icon: ShieldAlert, title: 'Punições', text: 'Tempo, posições ou exclusão conforme gravidade.' },
        { icon: Trophy, title: 'Inscrição', text: 'Vaga confirmada conforme pagamento e documentação.' },
      ]}
      ctaTitleLine1="Inscrever equipe"
      ctaTitleLine2="agora"
      ctaText="Fale com a organização para confirmar vaga, documentos e próximos passos."
    />
  );
};

export default FiveHundredMilesPage;
