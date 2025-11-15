const { randomDelay } = require('../utils/random');

/**
 * Scrolling utilities for simulating human-like scrolling behavior
 */
class Scrolling {
  /**
   * Scroll to an element
   * @param {Object} page - Puppeteer page object
   * @param {string} selector - CSS selector
   * @returns {Promise<void>}
   */
  static async scrollToElement(page, selector) {
    await page.evaluate((sel) => {
      const element = document.querySelector(sel);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, selector);
    await randomDelay(500, 1000);
  }

  /**
   * Scroll page down by pixels
   * @param {Object} page - Puppeteer page object
   * @param {number} pixels - Number of pixels to scroll
   * @returns {Promise<void>}
   */
  static async scrollDown(page, pixels = 500) {
    await page.evaluate((px) => {
      window.scrollBy(0, px);
    }, pixels);
    await randomDelay(300, 600);
  }

  /**
   * Scroll page up by pixels
   * @param {Object} page - Puppeteer page object
   * @param {number} pixels - Number of pixels to scroll
   * @returns {Promise<void>}
   */
  static async scrollUp(page, pixels = 500) {
    await page.evaluate((px) => {
      window.scrollBy(0, -px);
    }, pixels);
    await randomDelay(300, 600);
  }

  /**
   * Scroll to bottom of page
   * @param {Object} page - Puppeteer page object
   * @returns {Promise<void>}
   */
  static async scrollToBottom(page) {
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await randomDelay(1000, 2000);
  }

  /**
   * Scroll to top of page
   * @param {Object} page - Puppeteer page object
   * @returns {Promise<void>}
   */
  static async scrollToTop(page) {
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await randomDelay(500, 1000);
  }

  /**
   * Smooth scroll with multiple steps (simulates human scrolling)
   * @param {Object} page - Puppeteer page object
   * @param {number} totalPixels - Total pixels to scroll
   * @param {number} steps - Number of scroll steps
   * @returns {Promise<void>}
   */
  static async smoothScroll(page, totalPixels, steps = 5) {
    const stepSize = totalPixels / steps;
    for (let i = 0; i < steps; i++) {
      await this.scrollDown(page, stepSize);
      await randomDelay(100, 300);
    }
  }
}

module.exports = Scrolling;

