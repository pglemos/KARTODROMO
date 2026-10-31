import type { Browser } from 'webdriverio';
import { AppiumDriverManager } from '../helpers/driver';

export abstract class BasePage {
  protected get driver(): Browser {
    return AppiumDriverManager.getDriver();
  }

  /**
   * Locator Priority #1: Accessibility ID (~id)
   * Cross-platform (iOS accessibilityIdentifier/label and Android testID/content-desc)
   */
  async findByAccessibilityId(accessibilityId: string) {
    return this.driver.$(`~${accessibilityId}`);
  }

  /**
   * Waits explicitly for element to be visible
   */
  async waitForVisible(accessibilityId: string, timeoutMs: number = 15000) {
    const el = await this.findByAccessibilityId(accessibilityId);
    await el.waitForDisplayed({
      timeout: timeoutMs,
      timeoutMsg: `Element "~${accessibilityId}" was not visible after ${timeoutMs}ms`,
    });
    return el;
  }

  /**
   * Clicks an element once it is displayed on screen
   */
  async click(accessibilityId: string, timeoutMs: number = 15000) {
    const el = await this.waitForVisible(accessibilityId, timeoutMs);
    await el.click();
  }

  /**
   * Types text into an element
   */
  async typeText(accessibilityId: string, text: string, timeoutMs: number = 15000) {
    const el = await this.waitForVisible(accessibilityId, timeoutMs);
    await el.setValue(text);
  }

  /**
   * Checks if element is currently displayed, waiting up to timeoutMs
   */
  async isElementDisplayed(accessibilityId: string, timeoutMs: number = 3000): Promise<boolean> {
    try {
      const el = await this.findByAccessibilityId(accessibilityId);
      await el.waitForDisplayed({ timeout: timeoutMs });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Capture screenshot for test reporting
   */
  async takeScreenshot(filename: string): Promise<string> {
    const path = `tests/appium/screenshots/${filename}.png`;
    await this.driver.saveScreenshot(path);
    return path;
  }
}
