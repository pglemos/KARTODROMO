import {
  ALL_BADGES_CATALOG,
  BETIM_LOCAL_TOP_DRIVERS,
  BETIM_TRACK_PARTNER,
  MOCK_AGENDA_SLOTS,
  MOCK_COCKPIT_HUD_STATE,
  MOCK_DRIVERS,
  MOCK_LIVE_SESSION,
  MOCK_NEWS_ARTICLES,
  NELSON_CASTRO_CAREER_STATS,
  calculateGridMultiplier,
  calculateRating,
  calculateSessionXP,
  formatCurrencyCentavos,
  getCategoryColor,
  getDriverById,
  getDriversByCategory,
  isQualifiedSession,
  searchDrivers,
} from '../src/mock/kart-data';

describe('Kart Racing Data Layer (Milestone 1)', () => {
  describe('Drivers Database & Ranking', () => {
    it('posiciona Nelson Castro em 1º lugar com status Lenda e dados de referência', () => {
      const nelson = MOCK_DRIVERS[0];
      expect(nelson.name).toBe('NELSON CASTRO');
      expect(nelson.initials).toBe('NC');
      expect(nelson.category).toBe('LENDA');
      expect(nelson.rankPosition).toBe(1);
      expect(nelson.xp).toBe(61251);
      expect(nelson.points).toBe(13112);
      expect(nelson.flag).toBe('MG');
      expect(nelson.badges.length).toBeGreaterThan(0);
    });

    it('contém o Top 5 de pilotos da categoria Lenda na ordem correta', () => {
      const top5Names = MOCK_DRIVERS.slice(0, 5).map((d) => d.name);
      expect(top5Names).toEqual([
        'NELSON CASTRO',
        'TONI SIQUEIRA',
        'MURILO PERLY',
        'YAGO BRANDÃO',
        'LEONARDO BRUNO MARTINS',
      ]);
      MOCK_DRIVERS.slice(0, 5).forEach((d, idx) => {
        expect(d.rankPosition).toBe(idx + 1);
        expect(d.category).toBe('LENDA');
      });
    });

    it('cobre todas as categorias de pilotos obrigatórias', () => {
      const categories = ['LENDA', 'PROFISSIONAL', 'SEMI-PRO', 'AMADOR', 'NOVATO'] as const;
      categories.forEach((cat) => {
        const drivers = getDriversByCategory(cat);
        expect(drivers.length).toBeGreaterThan(0);
        drivers.forEach((d) => expect(d.category).toBe(cat));
      });
    });

    it('busca pilotos por nome e filtra por categoria', () => {
      const foundNelson = searchDrivers('Nelson');
      expect(foundNelson.length).toBe(1);
      expect(foundNelson[0].id).toBe('driver-nelson-castro');

      const foundNovatos = searchDrivers('Felipe', 'NOVATO');
      expect(foundNovatos.length).toBe(1);
      expect(foundNovatos[0].name).toBe('FELIPE MORAIS');

      const notFound = searchDrivers('PilotoInexistente');
      expect(notFound.length).toBe(0);
    });

    it('recupera piloto por ID', () => {
      const driver = getDriverById('driver-toni-siqueira');
      expect(driver).toBeDefined();
      expect(driver?.name).toBe('TONI SIQUEIRA');
      expect(driver?.rankPosition).toBe(2);

      const invalid = getDriverById('non-existent');
      expect(invalid).toBeUndefined();
    });

    it('contém a lista dos Top 5 pilotos locais do Kartódromo de Betim', () => {
      expect(BETIM_LOCAL_TOP_DRIVERS.length).toBe(5);
      expect(BETIM_LOCAL_TOP_DRIVERS[0].name).toBe('LUIZ CARLOS RODRIGUES ELOI');
      expect(BETIM_LOCAL_TOP_DRIVERS[1].name).toBe('AGENOR JÚNIOR');
      expect(BETIM_LOCAL_TOP_DRIVERS[2].name).toBe('ANDRÉ FELISBERTO');
      expect(BETIM_LOCAL_TOP_DRIVERS[3].name).toBe('FLAVIO VICTOR CÂMARA');
      expect(BETIM_LOCAL_TOP_DRIVERS[4].name).toBe('GEGELA');
    });
  });

  describe('News Articles Feed', () => {
    it('contém notícias com fotos de alta resolução, textos completos e datas válidas', () => {
      expect(MOCK_NEWS_ARTICLES.length).toBeGreaterThanOrEqual(3);
      MOCK_NEWS_ARTICLES.forEach((article) => {
        expect(article.id).toBeDefined();
        expect(article.title.length).toBeGreaterThan(15);
        expect(article.summary.length).toBeGreaterThan(20);
        expect(article.content.length).toBeGreaterThan(50);
        expect(article.imageUrl).toMatch(/^https?:\/\//);
        expect(article.date).toBeDefined();
        expect(article.author).toBeDefined();
        expect(article.readTime).toMatch(/min de leitura/);
      });
    });
  });

  describe('Kartódromo de Betim Track Partner', () => {
    it('possui dados completos de contato, endereço e facilidades', () => {
      expect(BETIM_TRACK_PARTNER.phone).toBe('(31)99884-2898');
      expect(BETIM_TRACK_PARTNER.socials.whatsapp).toBe('https://wa.me/5531998842898');
      expect(BETIM_TRACK_PARTNER.stats.trackLengthMeters).toBe(1110);
      expect(BETIM_TRACK_PARTNER.facilities.length).toBeGreaterThanOrEqual(6);
      expect(BETIM_TRACK_PARTNER.isFavorite).toBe(true);
    });
  });

  describe('LiveTime Telemetry & Cockpit HUD', () => {
    it('LiveSession possui bandeira verde, tempo decorrido e pelo menos 10 competidores', () => {
      expect(MOCK_LIVE_SESSION.status).toBe('GREEN');
      expect(MOCK_LIVE_SESSION.elapsedTime).toBe('0:17:54.548');
      expect(MOCK_LIVE_SESSION.competitors.length).toBeGreaterThanOrEqual(10);
      expect(isQualifiedSession(MOCK_LIVE_SESSION.competitors.length)).toBe(true);
    });

    it('LiveSession destaca a volta mais rápida com competidor #16 e tempo 0:38.775', () => {
      expect(MOCK_LIVE_SESSION.fastestLap).toBeDefined();
      expect(MOCK_LIVE_SESSION.fastestLap?.competitorNumber).toBe('#16');
      expect(MOCK_LIVE_SESSION.fastestLap?.time).toBe('0:38.775');
      expect(MOCK_LIVE_SESSION.fastestLap?.lapNumber).toBe(5);

      const p1 = MOCK_LIVE_SESSION.competitors[0];
      expect(p1.kartNumber).toBe('#16');
      expect(p1.isFastestLap).toBe(true);
      expect(p1.bestLapTime).toBe('0:38.775');
      expect(p1.bestLapNumber).toBe(5);
    });

    it('Cockpit HUD inicial reflete posição P1, cronômetro 0:05.8 e delta em tempo real', () => {
      expect(MOCK_COCKPIT_HUD_STATE.currentPosition).toBe('P1');
      expect(MOCK_COCKPIT_HUD_STATE.currentLapTime).toBe('0:05.8');
      expect(MOCK_COCKPIT_HUD_STATE.realtimeDelta.value).toBe('+0:30.121');
      expect(MOCK_COCKPIT_HUD_STATE.realtimeDelta.trend).toBe('faster');
      expect(MOCK_COCKPIT_HUD_STATE.lastLap.time).toBe('0:32.878');
      expect(MOCK_COCKPIT_HUD_STATE.bestLap.time).toBe('0:29.182');
      expect(MOCK_COCKPIT_HUD_STATE.deltaBest.value).toBe('+3.696');
      expect(MOCK_COCKPIT_HUD_STATE.deltaBest.isImprovement).toBe(false);
      expect(MOCK_COCKPIT_HUD_STATE.driverInfo.kartNumber).toBe('#07');
    });
  });

  describe('Agenda Sessions & Slots', () => {
    it('contém horários das 11:00 às 14:30 com valor R$ 110,00', () => {
      expect(MOCK_AGENDA_SLOTS.length).toBe(8);
      const times = MOCK_AGENDA_SLOTS.map((s) => s.time);
      expect(times).toEqual([
        '11:00',
        '11:30',
        '12:00',
        '12:30',
        '13:00',
        '13:30',
        '14:00',
        '14:30',
      ]);

      MOCK_AGENDA_SLOTS.forEach((slot) => {
        expect(slot.priceCentavos).toBe(11000);
        expect(slot.priceFormatted).toBe('R$ 110,00');
        expect(slot.sportType).toBe('KARTING');
      });

      // Bateria das 12:00 está esgotada
      const slot1200 = MOCK_AGENDA_SLOTS.find((s) => s.time === '12:00');
      expect(slot1200?.isSoldOut).toBe(true);
      expect(slot1200?.availableSlots).toBe(0);

      // Bateria das 11:00 possui 12 vagas
      const slot1100 = MOCK_AGENDA_SLOTS.find((s) => s.time === '11:00');
      expect(slot1100?.isSoldOut).toBe(false);
      expect(slot1100?.availableSlots).toBe(12);
    });
  });

  describe('Career Stats (Nelson Castro)', () => {
    it('estatísticas de eficiência correspondem exatamente às referências visuais', () => {
      const { efficiency, qualifiedStats, allStats } = NELSON_CASTRO_CAREER_STATS;

      expect(efficiency.winRate).toBe(22);
      expect(efficiency.podiumRate).toBe(43);
      expect(efficiency.overallEfficiency).toBe(35);
      expect(efficiency.polesRate).toBe(0);
      expect(efficiency.bestLapsRate).toBe(25);
      expect(efficiency.validRacesRate).toBe(92);

      expect(qualifiedStats.completedRaces).toBe(309);
      expect(qualifiedStats.wins).toBe(70);
      expect(qualifiedStats.podiums).toBe(133);
      expect(qualifiedStats.poles).toBe(100);
      expect(qualifiedStats.bestLaps).toBe(78);
      expect(qualifiedStats.qualifyingSessions).toBe(0);

      expect(allStats.totalRaces).toBe(347);
      expect(allStats.completedRaces).toBe(339);
      expect(allStats.wins).toBe(81);
      expect(allStats.podiums).toBe(155);
      expect(allStats.poles).toBe(120);
      expect(allStats.bestLaps).toBe(97);
      expect(allStats.qualifyingSessions).toBe(365);
    });

    it('catálogo de badges contém 12 conquistas estruturadas por categoria', () => {
      expect(ALL_BADGES_CATALOG.length).toBe(12);
      const expBadges = ALL_BADGES_CATALOG.filter((b) => b.category === 'experiencia');
      const desafioBadges = ALL_BADGES_CATALOG.filter((b) => b.category === 'desafio');
      const especialBadges = ALL_BADGES_CATALOG.filter((b) => b.category === 'especial');

      expect(expBadges.length).toBe(4);
      expect(desafioBadges.length).toBe(6);
      expect(especialBadges.length).toBe(2);
    });
  });

  describe('Fórmulas Matemáticas de Ranking e XP', () => {
    it('calcula rating com pesos de 50/20/20/10 com precisão', () => {
      // Nelson Castro: 35% eff, 70 wins, 61251 xp, 309 races
      const rating = calculateRating(0.35, 70, 61251, 309);
      // effPoints = 3500 * 0.50 = 1750
      // winPoints = (70/100) * 10000 * 0.20 = 7000 * 0.20 = 1400
      // xpPoints = min(10000, (61251/60000)*10000) * 0.20 = 10000 * 0.20 = 2000
      // racePoints = min(10000, (309/300)*10000) * 0.10 = 10000 * 0.10 = 1000
      // Total = 1750 + 1400 + 2000 + 1000 = 6150
      expect(rating).toBe(6150);
    });

    it('aceita eficiência tanto em formato decimal (0.35) quanto percentual inteiro (35)', () => {
      const decimalRating = calculateRating(0.35, 70, 61251, 309);
      const percentRating = calculateRating(35, 70, 61251, 309);

      expect(decimalRating).toBe(6150);
      expect(percentRating).toBe(6150);
      expect(decimalRating).toBe(percentRating);

      // Teto máximo com ambos os formatos
      expect(calculateRating(1.0, 100, 60000, 300)).toBe(10000);
      expect(calculateRating(100, 100, 60000, 300)).toBe(10000);
    });

    it('garante imunidade a valores negativos, overflow e sanitização de NaN em calculateRating', () => {
      // Entradas com eficiência negativa não geram rating negativo
      const negativeRating = calculateRating(-0.5, 10, 1000, 10);
      expect(negativeRating).toBe(267);
      expect(negativeRating).toBeGreaterThanOrEqual(0);

      // Todas as entradas negativas são clampeadas para 0
      const allNegative = calculateRating(-1, -50, -10000, -100);
      expect(allNegative).toBe(0);

      // Entradas NaN não geram NaN e retornam 0
      const nanRating = calculateRating(NaN, NaN, NaN, NaN);
      expect(nanRating).toBe(0);
      expect(Number.isNaN(nanRating)).toBe(false);

      // Overflow extremo é clampeado em 10000
      const overflowRating = calculateRating(150, 200, 150000, 800);
      expect(overflowRating).toBe(10000);
    });

    it('ignora acúmulo de XP para sessões com menos de 10 competidores', () => {
      const xpUnder10 = calculateSessionXP(true, true, true, true, true, 9);
      expect(xpUnder10).toBe(0);
    });

    it('zera ganho de XP se a corrida não for concluída (DNF), independentemente de bônus ou tamanho do grid', () => {
      // 1. DNF sem bônus em grid de 10 carros
      expect(calculateSessionXP(false, false, false, false, false, 10)).toBe(0);

      // 2. DNF sem bônus em grid de 20 carros
      expect(calculateSessionXP(false, false, false, false, false, 20)).toBe(0);

      // 3. DNF com Pole Position em grid de 10 e 20 carros
      expect(calculateSessionXP(false, false, false, true, false, 10)).toBe(0);
      expect(calculateSessionXP(false, false, false, true, false, 20)).toBe(0);

      // 4. DNF com Melhor Volta em grid de 10 e 20 carros
      expect(calculateSessionXP(false, false, false, false, true, 10)).toBe(0);
      expect(calculateSessionXP(false, false, false, false, true, 20)).toBe(0);

      // 5. DNF com Pole + Melhor Volta no grid máximo (20 competidores)
      expect(calculateSessionXP(false, false, false, true, true, 20)).toBe(0);

      // 6. DNF com flags de vitória ou pódio anômalas
      expect(calculateSessionXP(false, true, true, true, true, 20)).toBe(0);

      // 7. DNF em sessão não-qualificada (< 10 competidores)
      expect(calculateSessionXP(false, true, true, true, true, 8)).toBe(0);
    });

    it('calcula multiplicador de grid corretamente para grids abaixo de 10, no limiar e acima de 20', () => {
      expect(calculateGridMultiplier(0)).toBe(0);
      expect(calculateGridMultiplier(9)).toBe(0);
      expect(calculateGridMultiplier(10)).toBe(1.0);
      expect(calculateGridMultiplier(15)).toBe(1.5);
      expect(calculateGridMultiplier(20)).toBe(2.0);
      expect(calculateGridMultiplier(25)).toBe(2.0);
    });

    it('calcula ganho de XP com multiplicador de grid para 10 a 20+ competidores', () => {
      // Grid com 10 competidores: multiplicador 1.0x
      // Completou (50) + Vitória (100) + Pole (50) + Melhor Volta (50) = 250 * 1.0 = 250
      const xp10 = calculateSessionXP(true, false, true, true, true, 10);
      expect(xp10).toBe(250);

      // Grid com 20 competidores: multiplicador 2.0x
      // 250 * 2.0 = 500
      const xp20 = calculateSessionXP(true, false, true, true, true, 20);
      expect(xp20).toBe(500);

      // Apenas completar com 15 competidores: base 50, multiplicador 1.5x => 75
      const xp15Complete = calculateSessionXP(true, false, false, false, false, 15);
      expect(xp15Complete).toBe(75);
    });

    it('formata valores monetários em centavos para Real brasileiro', () => {
      expect(formatCurrencyCentavos(11000)).toBe('R$ 110,00');
      expect(formatCurrencyCentavos(22550)).toBe('R$ 225,50');
      expect(formatCurrencyCentavos(0)).toBe('R$ 0,00');
    });

    it('retorna a cor correta para cada categoria de piloto', () => {
      expect(getCategoryColor('LENDA')).toBe('#F59E0B');
      expect(getCategoryColor('PROFISSIONAL')).toBe('#8B5CF6');
      expect(getCategoryColor('SEMI-PRO')).toBe('#3B82F6');
      expect(getCategoryColor('AMADOR')).toBe('#22C55E');
      expect(getCategoryColor('NOVATO')).toBe('#9CA3AF');
      expect(getCategoryColor('TODOS')).toBe('#4D80EE');
    });
  });
});
