import { Flag, Fuel, Gauge, ShieldAlert, Trophy, Users } from 'lucide-react';
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
      watermarkCaption="edição 07/02/2026 realizada"
      specs={[
        ['Última edição', '07/02/2026'],
        ['Status', 'Já aconteceu'],
        ['Duração', '5 horas'],
        ['Formato', 'Equipe'],
      ]}
      primaryAction={{
        kind: 'whatsapp',
        text: 'Olá! Quero ser avisado sobre a próxima edição das 200 Milhas de Betim.',
        label: 'Avisem-me da próxima edição',
      }}
      regulationPdf="/regulamentos/200-milhas-de-betim-2026.pdf"
      rulesTitle="Controle, ritmo e disciplina"
      rules={[
        { icon: Users, title: 'Equipe e revezamento', text: 'Pilotos dividem a prova e cumprem janelas e procedimentos de troca.' },
        { icon: Gauge, title: 'Peso e lastro', text: 'A prova aplica critérios de peso definidos no regulamento oficial.' },
        { icon: Fuel, title: 'Abastecimento e boxes', text: 'Entrada, velocidade e operação de boxes seguem fiscalização.' },
        { icon: Flag, title: 'Bandeiras', text: 'Sinalização de pista deve ser obedecida imediatamente.' },
        { icon: ShieldAlert, title: 'Punições', text: 'Condutas irregulares geram advertência, tempo ou posições.' },
        { icon: Trophy, title: 'Resultado', text: 'Vence a equipe que completa a distância nas condições oficiais.' },
      ]}
      ctaTitleLine1="Avisem-me da próxima edição"
      ctaTitleLine2="agora"
      ctaText="Fale com a organização para confirmar vaga, documentos e próximos passos quando a próxima edição for anunciada."
    />
  );
};

export default TwoHundredMilesPage;
