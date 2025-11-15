const { randomDelay } = require('../utils/random');

/**
 * Typing utilities for simulating human-like typing behavior
 */
class Typing {
  /**
   * Type text with human-like delays
   * @param {Object} page - Puppeteer page object
   * @param {string} selector - CSS selector for the input field
   * @param {string} text - Text to type
   * @returns {Promise<void>}
   */
  static async humanTypeText(page, selector, text) {
    await page.click(selector);
    for (const char of text) {
      await page.keyboard.type(char);
      await randomDelay(50, 150);
    }
  }

  /**
   * Type text slowly with configurable delay
   * @param {Object} page - Puppeteer page object
   * @param {string} selector - CSS selector for the input field
   * @param {string} text - Text to type
   * @param {number} minDelay - Minimum delay between characters (ms)
   * @param {number} maxDelay - Maximum delay between characters (ms)
   * @returns {Promise<void>}
   */
  static async slowType(page, selector, text, minDelay = 100, maxDelay = 300) {
    await page.click(selector);
    for (const char of text) {
      await page.keyboard.type(char);
      await randomDelay(minDelay, maxDelay);
    }
  }

  /**
   * Type text quickly (faster than human-like)
   * @param {Object} page - Puppeteer page object
   * @param {string} selector - CSS selector for the input field
   * @param {string} text - Text to type
   * @returns {Promise<void>}
   */
  static async fastType(page, selector, text) {
    await page.click(selector);
    await page.type(selector, text);
  }
}

module.exports = Typing;

