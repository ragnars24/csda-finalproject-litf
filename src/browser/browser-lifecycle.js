const { createLogger } = require('../utils/logger');
const logger = createLogger('BrowserLifecycle');

/**
 * BrowserLifecycle - Manages browser lifecycle operations
 */
class BrowserLifecycle {
  constructor(browser, page) {
    this.browser = browser;
    this.page = page;
  }

  /**
   * Close the browser instance
   * @returns {Promise<void>}
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      logger.info('Browser closed');
    }
  }

  /**
   * Check if browser is still connected
   * @returns {boolean}
   */
  isConnected() {
    return this.browser && this.browser.isConnected();
  }

  /**
   * Get the current page instance
   * @returns {Object} Puppeteer page object
   */
  getPage() {
    return this.page;
  }

  /**
   * Get the browser instance
   * @returns {Object} Puppeteer browser object
   */
  getBrowser() {
    return this.browser;
  }
}

module.exports = BrowserLifecycle;

