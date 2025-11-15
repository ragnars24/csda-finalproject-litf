const { createLogger } = require('../utils/logger');
const logger = createLogger('PageNavigator');
const { randomDelay } = require('../utils/random');

/**
 * PageNavigator - Handles general page navigation operations
 */
class PageNavigator {
  constructor(page) {
    this.page = page;
  }

  /**
   * Navigate to a URL
   * @param {string} url - URL to navigate to
   * @param {Object} options - Navigation options
   * @returns {Promise<void>}
   */
  async goto(url, options = {}) {
    const defaultOptions = {
      waitUntil: 'networkidle2',
      timeout: 30000
    };
    
    await this.page.goto(url, { ...defaultOptions, ...options });
  }

  /**
   * Wait for a selector to appear
   * @param {string} selector - CSS selector
   * @param {Object} options - Wait options
   * @returns {Promise<void>}
   */
  async waitForSelector(selector, options = {}) {
    await this.page.waitForSelector(selector, options);
  }

  /**
   * Wait for navigation
   * @param {Object} options - Navigation wait options
   * @returns {Promise<void>}
   */
  async waitForNavigation(options = {}) {
    const defaultOptions = {
      waitUntil: 'networkidle2',
      timeout: 15000
    };
    
    try {
      await this.page.waitForNavigation({ ...defaultOptions, ...options });
    } catch (error) {
      // Navigation timeout is okay - we'll check URL manually
      logger.debug('Navigation wait timeout, checking page state manually...');
    }
  }

  /**
   * Get current URL
   * @returns {string}
   */
  getCurrentUrl() {
    return this.page.url();
  }

  /**
   * Reload the page
   * @param {Object} options - Reload options
   * @returns {Promise<void>}
   */
  async reload(options = {}) {
    await this.page.reload(options);
  }

  /**
   * Go back in browser history
   * @returns {Promise<void>}
   */
  async goBack() {
    await this.page.goBack();
    await randomDelay(1000, 2000);
  }

  /**
   * Go forward in browser history
   * @returns {Promise<void>}
   */
  async goForward() {
    await this.page.goForward();
    await randomDelay(1000, 2000);
  }
}

module.exports = PageNavigator;

