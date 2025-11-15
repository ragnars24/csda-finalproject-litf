const { createLogger } = require('../src/utils/logger');
const logger = createLogger('ProxyManager');

/**
 * Proxy Manager class for handling proxy configuration and routing
 * Supports iproyal proxy service with country-based routing
 */
class ProxyManager {
  /**
   * Initialize ProxyManager with configuration
   * @param {Object} config - Configuration object (optional, uses env vars if not provided)
   * @param {string} config.provider - Proxy provider name
   * @param {string} config.username - Proxy username
   * @param {string} config.password - Proxy password
   * @param {string} config.host - Proxy host
   * @param {string} config.port - Proxy port
   */
  constructor(config = {}) {
    this.provider = config.provider || process.env.IPROYAL_USERNAME ? 'iproyal' : null;
    this.username = config.username || process.env.IPROYAL_USERNAME;
    this.password = config.password || process.env.IPROYAL_PASSWORD;
    this.host = config.host || process.env.IPROYAL_HOST || 'geo.iproyal.com';
    this.port = config.port || process.env.IPROYAL_PORT || '12321';
    
    if (!this.username || !this.password) {
      logger.warn('Proxy credentials not configured. Scraper will run without proxy.');
    }
  }

  /**
   * Get proxy configuration for a specific country
   * @param {string} countryCode - ISO country code (US, DE, BR, etc.)
   * @param {string} city - Optional city name
   * @param {boolean} stickySession - Whether to use sticky session
   * @returns {Object} Proxy configuration for Puppeteer
   */
  getProxyConfig(countryCode, city = null, stickySession = true) {
    if (!this.username || !this.password) {
      return null;
    }

    // iproyal format: password_country-{country}_session-{random}_lifetime-168h
    // Example: geo.iproyal.com:12321@USERNAME:PASSWORD_country-us_session-XYZ_lifetime-168h
    let password = this.password;
    
    if (countryCode) {
      password += `_country-${countryCode.toLowerCase()}`;
    }
    
    if (stickySession) {
      // Generate or use session ID for sticky sessions
      const sessionId = this._generateSessionId(countryCode);
      password += `_session-${sessionId}`;
      password += '_lifetime-168h';
    }

    const proxyUrl = `http://${this.username}:${password}@${this.host}:${this.port}`;

    logger.info(`Configured proxy for ${countryCode}${city ? ` (${city})` : ''}`);

    return {
      server: `http://${this.host}:${this.port}`,
      username: this.username,
      password: password,
      url: proxyUrl
    };
  }

  /**
   * Get proxy configuration for a persona
   * @param {Object} persona - Persona configuration
   * @returns {Object} Proxy configuration
   */
  getProxyForPersona(persona) {
    const proxyConfig = persona.proxy || {};
    
    // If persona has direct proxy config (username, password, host, port), use it directly
    if (proxyConfig.username && proxyConfig.password && proxyConfig.host && proxyConfig.port) {
      const proxyUrl = `http://${proxyConfig.username}:${proxyConfig.password}@${proxyConfig.host}:${proxyConfig.port}`;
      
      logger.info(`Using proxy from persona config: ${proxyConfig.host}:${proxyConfig.port}`);
      
      return {
        server: `http://${proxyConfig.host}:${proxyConfig.port}`,
        username: proxyConfig.username,
        password: proxyConfig.password,
        url: proxyUrl
      };
    }
    
    // Fallback to country_code-based configuration (for backward compatibility)
    return this.getProxyConfig(
      proxyConfig.country_code,
      proxyConfig.city,
      proxyConfig.sticky_session !== false
    );
  }

  /**
   * Generate a consistent session ID for sticky sessions
   * @param {string} identifier - Identifier for the session (e.g., country code)
   * @returns {string} Session ID
   */
  _generateSessionId(identifier) {
    // Use identifier to create consistent session ID
    // In production, you might want to store this per persona
    const hash = identifier.split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0);
    
    return `sess${hash}${Date.now().toString(36)}`;
  }

  /**
   * Test proxy connection for a specific country
   * @param {string} countryCode - ISO country code to test (e.g., 'US', 'DE')
   * @returns {Promise<boolean>} True if proxy connection is successful, false otherwise
   */
  async testProxy(countryCode) {
    const axios = require('axios');
    const proxyConfig = this.getProxyConfig(countryCode);
    
    if (!proxyConfig) {
      logger.warn('No proxy configured, skipping test');
      return false;
    }

    try {
      const response = await axios.get('https://api.ipify.org?format=json', {
        proxy: {
          host: this.host,
          port: parseInt(this.port),
          auth: {
            username: proxyConfig.username,
            password: proxyConfig.password
          }
        },
        timeout: 10000
      });

      logger.info(`Proxy test successful for ${countryCode}. IP: ${response.data.ip}`);
      return true;
    } catch (error) {
      logger.error(`Proxy test failed for ${countryCode}: ${error.message}`);
      return false;
    }
  }
}

module.exports = ProxyManager;

