import { AppiumDriverManager } from './helpers/driver';
import { HomePage } from './pages/HomePage';
import { RankingPage } from './pages/RankingPage';
import { APPIUM_HOST, APPIUM_PORT } from './config/capabilities';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

function checkAppiumServer(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://${APPIUM_HOST}:${APPIUM_PORT}/status`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
}

async function runSuite() {
  console.log('\n======================================================');
  console.log('🏁 INICIANDO SUITE DE TESTES E2E COM APPIUM');
  console.log('======================================================\n');

  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. Verificar Servidor Appium
  console.log(`📡 Verificando Appium Server em http://${APPIUM_HOST}:${APPIUM_PORT}...`);
  const isUp = await checkAppiumServer();
  if (!isUp) {
    console.error(`❌ Servidor Appium não está respondendo em http://${APPIUM_HOST}:${APPIUM_PORT}`);
    console.error(`Inicie o servidor com: npx appium --address 127.0.0.1 --port 4723`);
    process.exit(1);
  }
  console.log('✅ Servidor Appium ativo e pronto para sessões.\n');

  // 2. Inicializar Driver
  console.log('📱 Conectando sessão XCUITest no iOS Simulator...');
  const platform = (process.env.TEST_PLATFORM as 'ios' | 'android') || 'ios';
  const startTime = Date.now();
  let driver;
  try {
    driver = await AppiumDriverManager.initDriver({ platform });
    console.log(`✅ Sessão iniciada com sucesso em ${Date.now() - startTime}ms!\n`);
  } catch (err: any) {
    console.error('❌ Falha ao iniciar sessão Appium:', err.message);
    process.exit(1);
  }

  const results: TestResult[] = [];
  const homePage = new HomePage();
  const rankingPage = new RankingPage();

  async function executeTest(name: string, fn: () => Promise<void>) {
    process.stdout.write(`  ⏳ ${name}... `);
    const t0 = Date.now();
    try {
      await fn();
      const dur = Date.now() - t0;
      console.log(`✅ PASSOU (${dur}ms)`);
      results.push({ name, passed: true, durationMs: dur });
    } catch (err: any) {
      const dur = Date.now() - t0;
      console.log(`❌ FALHOU (${dur}ms)`);
      console.error(`     Erro: ${err.message}`);
      const cleanName = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      try {
        await homePage.takeScreenshot(cleanName);
        console.log(`     📸 Screenshot salvo em tests/appium/screenshots/${cleanName}.png`);
      } catch {}
      results.push({ name, passed: false, durationMs: dur, error: err.message });
    }
  }

  try {
    // Garantir rota Home
    console.log('🧭 Navegando para a rota Home (kartodromo:///(tabs))...');
    await driver.url('kartodromo:///(tabs)');

    console.log('\n📋 EXECUTANDO CENÁRIOS DE TESTE:');

    // TC01: Carregamento da Home
    await executeTest('TC01 - Renderização da Home e Elementos Principais', async () => {
      const isHome = await homePage.isLoaded();
      if (!isHome) {
        throw new Error('A tela inicial não carregou os elementos esperados');
      }
      await homePage.takeScreenshot('tc01_home_screen');
    });

    // TC02: Navegação na Floating Tab Bar
    await executeTest('TC02 - Alternar Abas na Floating Tab Bar (Agenda -> Início)', async () => {
      await homePage.switchTab('tab-agenda');
      await homePage.takeScreenshot('tc02_agenda_tab');
      await homePage.switchTab('tab-início');
      await homePage.takeScreenshot('tc02_inicio_tab');
    });

    // TC03: Gestos de Scroll Nativo com W3C Actions API
    await executeTest('TC03 - Gestos de Scroll Nativo com W3C Actions API (Swipe Up / Down)', async () => {
      await AppiumDriverManager.swipe('up', 600);
      await homePage.takeScreenshot('tc03_scrolled_up');
      await AppiumDriverManager.swipe('down', 600);
      await homePage.takeScreenshot('tc03_scrolled_down');
    });

    // TC04: Navegação para a Tela de Ranking
    await executeTest('TC04 - Navegar para a Tela de Ranking de Pilotos', async () => {
      await driver.url('kartodromo:///ranking');
      const isRanking = await rankingPage.isLoaded();
      if (!isRanking) {
        throw new Error('Tela de Ranking não carregou os elementos esperados');
      }
      await rankingPage.takeScreenshot('tc04_ranking_screen');
    });

    // TC05: Interação com Filtros de Período no Ranking
    await executeTest('TC05 - Alternar Filtros de Período (Mês / Geral / Semana)', async () => {
      await rankingPage.selectPeriod('Mês');
      await rankingPage.selectPeriod('Geral');
      await rankingPage.selectPeriod('Semana');
      await rankingPage.takeScreenshot('tc05_ranking_periods');
    });

    // TC06: Busca de Pilotos no Ranking
    await executeTest('TC06 - Busca de Piloto por Nome e Manipulação do Teclado', async () => {
      await rankingPage.searchDriver('Gabriel');
      await rankingPage.takeScreenshot('tc06_ranking_search');
    });

    // TC07: Retorno para a Home via Botão Voltar
    await executeTest('TC07 - Retornar da Tela de Ranking para a Home via Botão Voltar', async () => {
      await rankingPage.goBack();
      const isHome = await homePage.isLoaded();
      if (!isHome) {
        throw new Error('Não retornou para a Home após clicar no botão Voltar');
      }
      await homePage.takeScreenshot('tc07_returned_home');
    });

  } finally {
    console.log('\n🧹 Encerrando sessão Appium...');
    await AppiumDriverManager.quitDriver();
    console.log('✅ Sessão finalizada com segurança.');
  }

  // Resumo
  console.log('\n======================================================');
  console.log('📊 RESUMO DA EXECUÇÃO APPIUM');
  console.log('======================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total de Testes: ${total}`);
  console.log(`✅ Passaram:      ${passed}`);
  console.log(`❌ Falharam:      ${failed}`);
  console.log(`Duração Total:   ${results.reduce((a, b) => a + b.durationMs, 0)}ms`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
