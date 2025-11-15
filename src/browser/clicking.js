const { randomDelay } = require('../utils/random');
const { createLogger } = require('../utils/logger');
const logger = createLogger('Clicking');

/**
 * Clicking utilities for simulating human-like clicking behavior
 */
class Clicking {
  /**
   * Click an element by selector
   * @param {Object} page - Puppeteer page object
   * @param {string} selector - CSS selector
   * @param {Object} options - Click options
   * @returns {Promise<void>}
   */
  static async click(page, selector, options = {}) {
    await page.click(selector, options);
    await randomDelay(200, 500);
  }

  /**
   * Click button by exact text match
   * @param {Object} page - Puppeteer page object
   * @param {string} text - Button text to match
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<boolean>} True if button was found and clicked
   */
  static async clickButtonByExactText(page, text, timeout = 5000) {
    try {
      const button = await page.evaluate((buttonText) => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn => btn.textContent.trim() === buttonText);
      }, text);

      if (button) {
        await page.evaluate((buttonText) => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const btn = buttons.find(b => b.textContent.trim() === buttonText);
          if (btn) btn.click();
        }, text);
        await randomDelay(500, 1000);
        return true;
      }
      return false;
    } catch (error) {
      logger.debug(`Failed to click button with text "${text}": ${error.message}`);
      return false;
    }
  }

  /**
   * Click an element and wait for navigation
   * @param {Object} page - Puppeteer page object
   * @param {string} selector - CSS selector
   * @param {Object} options - Navigation wait options
   * @returns {Promise<void>}
   */
  static async clickAndWaitForNavigation(page, selector, options = {}) {
    await Promise.all([
      page.waitForNavigation(options),
      page.click(selector)
    ]);
    await randomDelay(500, 1000);
  }

  /**
   * Double click an element
   * @param {Object} page - Puppeteer page object
   * @param {string} selector - CSS selector
   * @returns {Promise<void>}
   */
  static async doubleClick(page, selector) {
    await page.click(selector, { clickCount: 2 });
    await randomDelay(300, 600);
  }

  /**
   * Right click an element
   * @param {Object} page - Puppeteer page object
   * @param {string} selector - CSS selector
   * @returns {Promise<void>}
   */
  static async rightClick(page, selector) {
    await page.click(selector, { button: 'right' });
    await randomDelay(300, 600);
  }
}

module.exports = Clicking;

