const { createLogger } = require('../utils/logger');
const logger = createLogger('CookieHandler');
const { randomDelay } = require('../utils/random');

/**
 * CookieHandler - Handles cookie banner dismissal
 */
class CookieHandler {
  /**
   * Handle cookie banner if it appears
   * @param {Object} page - Puppeteer page object
   * @returns {Promise<void>}
   */
  static async handleCookieBanner(page) {
    try {
      // Wait a moment for cookie banner to appear
      await randomDelay(1000, 2000);
      
      // Try to find and click the "Allow all cookies" button using page.evaluate
      const buttonClicked = await page.evaluate(() => {
        // Look for button with text "Allow all cookies"
        const buttons = Array.from(document.querySelectorAll('button'));
        const cookieButton = buttons.find(button => 
          button.textContent.includes('Allow all cookies') ||
          button.textContent.includes('Allow essential and optional cookies')
        );
        
        if (cookieButton) {
          cookieButton.click();
          return true;
        }
        return false;
      });
      
      if (buttonClicked) {
        logger.info('Cookie banner found and clicked "Allow all cookies"');
        await randomDelay(2000, 3000);
        
        // Verify banner is gone by checking again
        const bannerStillExists = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          return buttons.some(button => 
            button.textContent.includes('Allow all cookies') ||
            button.textContent.includes('Allow essential and optional cookies')
          );
        });
        
        if (bannerStillExists) {
          logger.warn('Cookie banner still visible after clicking');
        } else {
          logger.info('Cookie banner successfully dismissed');
        }
      } else {
        logger.debug('No cookie banner found');
      }
    } catch (error) {
      logger.debug(`Cookie banner handling: ${error.message}`);
    }
  }
}

module.exports = CookieHandler;

