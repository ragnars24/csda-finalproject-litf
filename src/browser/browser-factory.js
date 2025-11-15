const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createLogger } = require('../utils/logger');
const logger = createLogger('BrowserFactory');
const { getPuppeteerLaunchOptions, getDefaultViewport, getUserAgent } = require('../config/puppeteer-options');

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

/**
 * BrowserFactory - Creates and configures Puppeteer browser instances
 */
class BrowserFactory {
  /**
   * Launch a new browser instance with configuration
   * @param {Object} options - Browser configuration options
   * @param {Object} options.persona - Persona configuration
   * @param {Object} options.proxyConfig - Proxy configuration
   * @param {boolean} options.headless - Whether to run in headless mode
   * @returns {Promise<Object>} Object with browser and page instances
   */
  static async launch({ persona, proxyConfig = null, headless = true } = {}) {
    logger.info(`Initializing browser for ${persona?.persona_id || 'unknown'}`);
    logger.debug(`Persona details: region=${persona?.region || 'unknown'}, spectrum=${persona?.political_spectrum || 'unknown'}`);

    const launchOptions = getPuppeteerLaunchOptions({ headless, proxyConfig });

    logger.debug('Launching browser with stealth plugin...');
    const browser = await puppeteer.launch(launchOptions);
    logger.debug('Browser launched');
    
    const page = await browser.newPage();
    logger.debug('New page created');

    // Set viewport and user agent
    const viewport = getDefaultViewport();
    await page.setViewport(viewport);
    
    const userAgent = getUserAgent(persona?.region);
    await page.setUserAgent(userAgent);

    // Remove webdriver property to avoid detection
    await page.evaluateOnNewDocument(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      
      // Override permissions API
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
      
      // Add Chrome object
      window.chrome = {
        runtime: {},
      };
      
      // Override plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });

    // Authenticate proxy if needed
    if (proxyConfig && proxyConfig.username) {
      await page.authenticate({
        username: proxyConfig.username,
        password: proxyConfig.password
      });
      logger.debug('Proxy authentication configured');
    }

    logger.info('Browser initialized successfully');
    
    return { browser, page };
  }
}

module.exports = BrowserFactory;

