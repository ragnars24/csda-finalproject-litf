const fs = require('fs');
const { createLogger } = require('../utils/logger');
const logger = createLogger('PuppeteerOptions');
const defaults = require('./defaults');

/**
 * Generate Puppeteer launch options based on environment and configuration
 * @param {Object} options - Configuration options
 * @param {boolean} options.headless - Whether to run in headless mode (default: from config)
 * @param {Object} options.proxyConfig - Proxy configuration object
 * @returns {Object} Puppeteer launch options
 */
function getPuppeteerLaunchOptions({ headless = defaults.browser.headless, proxyConfig = null } = {}) {
  // Force headless mode in Docker/container environments (no display available)
  let isDocker = false;
  try {
    isDocker = process.env.FORCE_HEADLESS === 'true' ||
               !!process.env.PUPPETEER_EXECUTABLE_PATH || 
               fs.existsSync('/.dockerenv') || 
               (fs.existsSync('/proc/1/cgroup') && fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker'));
  } catch (e) {
    // If we can't check, assume not Docker
    isDocker = false;
  }
  
  const shouldBeHeadless = isDocker ? true : headless;
  
  if (isDocker && !shouldBeHeadless) {
    logger.warn('Docker environment detected: forcing headless mode (no display available)');
  }

  const launchOptions = {
    headless: shouldBeHeadless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--lang=en-US'
    ]
  };
  
  // Additional headless-specific args for Docker
  if (shouldBeHeadless) {
    launchOptions.args.push(
      '--headless=new',  // Use new headless mode
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-client-side-phishing-detection',
      '--disable-default-apps',
      '--disable-features=TranslateUI',
      '--disable-hang-monitor',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-sync',
      '--metrics-recording-only',
      '--no-first-run',
      '--safebrowsing-disable-auto-update',
      // REMOVED: --enable-automation (this flag tells sites we're automated!)
      '--password-store=basic',
      '--use-mock-keychain',
      // Additional stealth flags
      '--disable-blink-features=AutomationControlled',  // Hide automation
      '--exclude-switches=enable-automation',  // Remove automation flag
      '--disable-dev-shm-usage'
    );
  } else {
    // Non-headless mode also needs stealth flags
    launchOptions.args.push(
      '--disable-blink-features=AutomationControlled',
      '--exclude-switches=enable-automation'
    );
  }

  // Add proxy if configured
  if (proxyConfig) {
    launchOptions.args.push(`--proxy-server=${proxyConfig.server}`);
    logger.info(`Using proxy: ${proxyConfig.server}`);
    logger.debug(`Proxy details: ${JSON.stringify({ server: proxyConfig.server, username: proxyConfig.username })}`);
  } else {
    logger.debug('No proxy configured for this session');
  }

  return launchOptions;
}

/**
 * Get default viewport configuration
 * @returns {Object} Viewport configuration
 */
function getDefaultViewport() {
  return defaults.browser.viewport;
}

/**
 * Get user agent strings based on persona region
 * @param {string} region - Persona region (optional)
 * @returns {string} User agent string
 */
function getUserAgent(region = null) {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ];

  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

module.exports = {
  getPuppeteerLaunchOptions,
  getDefaultViewport,
  getUserAgent
};

