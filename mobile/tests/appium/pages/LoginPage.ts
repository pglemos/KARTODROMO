import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  private locators = {
    header: 'Entre para continuar',
    fieldIdentifier: 'E-mail ou CPF',
    fieldPassword: 'Senha',
    btnEntrar: 'Entrar',
    btnBack: 'BackButton',
    btnBackFallback: 'Back',
    linkRecuperar: 'Esqueci minha senha',
  };

  async isLoaded(): Promise<boolean> {
    const hasHeader = await this.isElementDisplayed(this.locators.header, 5000);
    const hasField = await this.isElementDisplayed(this.locators.fieldIdentifier, 5000);
    return hasHeader || hasField;
  }

  async enterCredentials(identifier: string, pass: string): Promise<void> {
    await this.typeText(this.locators.fieldIdentifier, identifier);
    await this.typeText(this.locators.fieldPassword, pass);
  }

  async submit(): Promise<void> {
    await this.click(this.locators.btnEntrar);
  }

  async goBack(): Promise<void> {
    const isBackPresent = await this.isElementDisplayed(this.locators.btnBack, 3000);
    if (isBackPresent) {
      await this.click(this.locators.btnBack);
    } else {
      await this.click(this.locators.btnBackFallback);
    }
  }
}
