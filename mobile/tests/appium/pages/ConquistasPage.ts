import { BasePage } from './BasePage';

export class ConquistasPage extends BasePage {
  private locators = {
    screen: 'screen-conquistas',
    btnBack: 'btn-back-conquistas',
    filterTodas: 'badge-filter-todas',
    filterCorrida: 'badge-filter-corrida',
    filterTempo: 'badge-filter-tempo',
    badgesList: 'badges-full-list',
  };

  async isLoaded(): Promise<boolean> {
    return this.isElementDisplayed(this.locators.screen, 8000);
  }

  async filterByCategory(category: 'todas' | 'corrida' | 'tempo'): Promise<void> {
    const map = {
      todas: this.locators.filterTodas,
      corrida: this.locators.filterCorrida,
      tempo: this.locators.filterTempo,
    };
    await this.click(map[category]);
  }

  async goBack(): Promise<void> {
    await this.click(this.locators.btnBack);
  }
}
