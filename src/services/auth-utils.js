const { createLogger } = require('../utils/logger');
const logger = createLogger('AuthUtils');

/**
 * Authentication utilities
 */
class AuthUtils {
  /**
   * Log current site URL with action context
   * @param {Object} page - Puppeteer page object
   * @param {string} action - Action description
   * @returns {Promise<void>}
   */
  static async logCurrentSite(page, action) {
    try {
      const url = page ? page.url() : 'N/A';
      logger.info(`📍 [${action}] Current site: ${url}`);
    } catch (error) {
      logger.debug(`Could not get current URL: ${error.message}`);
    }
  }
}

module.exports = AuthUtils;
module.exports.logCurrentSite = AuthUtils.logCurrentSite;

