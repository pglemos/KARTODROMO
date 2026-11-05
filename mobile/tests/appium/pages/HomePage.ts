import { BasePage } from './BasePage';

export class HomePage extends BasePage {
  public locators = {
    screen: 'screen-home',
    btnReservar: 'Reservar horário na agenda',
    btnCockpit: 'Abrir cockpit ao vivo',
    btnEntrar: 'Entrar na conta, Forward',
    tabInicio: 'tab-início',
    tabAgenda: 'tab-agenda',
    tabReservas: 'tab-reservas',
    tabAoVivo: 'tab-ao vivo',
    tabCarreira: 'tab-carreira',
  };

  async isLoaded(): Promise<boolean> {
    const hasScreen = await this.isElementDisplayed(this.locators.screen, 5000);
    const hasReservar = await this.isElementDisplayed(this.locators.btnReservar, 3000);
    const hasTabInicio = await this.isElementDisplayed(this.locators.tabInicio, 3000);
    return hasScreen || hasReservar || hasTabInicio;
  }

  async openAgenda(): Promise<void> {
    await this.click(this.locators.tabAgenda);
  }

  async switchTab(tab: 'tab-início' | 'tab-agenda' | 'tab-reservas' | 'tab-ao vivo' | 'tab-carreira'): Promise<void> {
    await this.click(tab);
  }
}
