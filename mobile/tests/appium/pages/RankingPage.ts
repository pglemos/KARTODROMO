import { BasePage } from './BasePage';

export class RankingPage extends BasePage {
  public locators = {
    header: 'Ranking',
    btnBack: 'Voltar',
    btnRules: 'Como funciona o ranking',
    filterSemana: 'Semana',
    filterMes: 'Mês',
    filterGeral: 'Geral',
    searchInput: 'Buscar piloto',
  };

  async isLoaded(): Promise<boolean> {
    const hasHeader = await this.isElementDisplayed(this.locators.header, 5000);
    const hasBack = await this.isElementDisplayed(this.locators.btnBack, 3000);
    const hasSearch = await this.isElementDisplayed(this.locators.searchInput, 3000);
    return hasHeader || hasBack || hasSearch;
  }

  async searchDriver(name: string): Promise<void> {
    await this.typeText(this.locators.searchInput, name);
    try {
      if (await this.driver.isKeyboardShown()) {
        await this.driver.hideKeyboard();
      }
    } catch {}
  }

  async selectPeriod(period: 'Semana' | 'Mês' | 'Geral'): Promise<void> {
    await this.click(this.locators[`filter${period === 'Semana' ? 'Semana' : period === 'Mês' ? 'Mes' : 'Geral'}`]);
  }

  async goBack(): Promise<void> {
    await this.click(this.locators.btnBack);
  }
}
