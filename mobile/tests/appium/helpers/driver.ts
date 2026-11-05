import { remote, type Browser } from 'webdriverio';
import { getCapabilities, APPIUM_HOST, APPIUM_PORT, type AppiumCapabilitiesConfig } from '../config/capabilities';

export class AppiumDriverManager {
  private static driver: Browser | null = null;

  static async initDriver(config: AppiumCapabilitiesConfig): Promise<Browser> {
    if (this.driver) {
      return this.driver;
    }

    const capabilities = getCapabilities(config);

    this.driver = await remote({
      protocol: 'http',
      hostname: APPIUM_HOST,
      port: APPIUM_PORT,
      path: '/',
      capabilities,
      logLevel: 'warn',
    });

    return this.driver;
  }

  static getDriver(): Browser {
    if (!this.driver) {
      throw new Error('Appium driver is not initialized. Call initDriver() first.');
    }
    return this.driver;
  }

  static async quitDriver(): Promise<void> {
    if (this.driver) {
      try {
        await this.driver.deleteSession();
      } catch (err) {
        console.warn('Error closing Appium session:', err);
      } finally {
        this.driver = null;
      }
    }
  }

  /**
   * Performs swipe gesture using W3C Actions API
   * Follows Appium Skill guideline: "Use W3C Actions API, not deprecated TouchAction"
   */
  static async swipe(
    direction: 'up' | 'down' | 'left' | 'right',
    durationMs: number = 600
  ): Promise<void> {
    const driver = this.getDriver();
    const windowSize = await driver.getWindowSize();
    const width = windowSize.width;
    const height = windowSize.height;

    let startX = Math.floor(width / 2);
    let startY = Math.floor(height * 0.7);
    let endX = startX;
    let endY = Math.floor(height * 0.3);

    if (direction === 'down') {
      startY = Math.floor(height * 0.3);
      endY = Math.floor(height * 0.7);
    } else if (direction === 'left') {
      startX = Math.floor(width * 0.8);
      endX = Math.floor(width * 0.2);
      startY = Math.floor(height / 2);
      endY = startY;
    } else if (direction === 'right') {
      startX = Math.floor(width * 0.2);
      endX = Math.floor(width * 0.8);
      startY = Math.floor(height / 2);
      endY = startY;
    }

    await driver.action('pointer', {
      parameters: { pointerType: 'touch' }
    })
      .move({ duration: 0, x: startX, y: startY })
      .down({ button: 0 })
      .pause(100)
      .move({ duration: durationMs, x: endX, y: endY })
      .up({ button: 0 })
      .perform();
  }
}
