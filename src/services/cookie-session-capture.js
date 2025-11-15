const { createLogger } = require('../utils/logger');
const logger = createLogger('CookieSessionCapture');
const fs = require('fs');
const path = require('path');

/**
 * CookieSessionCapture - Captures and logs cookies for each persona session
 * Tracks cookies at key points: login, navigation, scraping
 */
class CookieSessionCapture {
  constructor(persona, dataDir = './data') {
    this.persona = persona;
    this.dataDir = dataDir;
    this.cookiesDir = path.join(dataDir, 'cookies');
    this.sessionCookies = [];
    this.ensureCookiesDirectory();
  }

  /**
   * Ensure cookies directory exists
   */
  ensureCookiesDirectory() {
    if (!fs.existsSync(this.cookiesDir)) {
      fs.mkdirSync(this.cookiesDir, { recursive: true });
      logger.debug(`Created cookies directory: ${this.cookiesDir}`);
    }
  }

  /**
   * Capture cookies from page
   * @param {Object} page - Puppeteer page object
   * @param {string} stage - Stage of session (e.g., 'login', 'post-login', 'pre-scraping', 'post-scraping')
   * @returns {Promise<Array>} Array of cookie objects
   */
  async captureCookies(page, stage = 'unknown') {
    try {
      const cookies = await page.cookies();
      const timestamp = new Date().toISOString();
      
      const cookieData = cookies.map(cookie => ({
        timestamp,
        persona_id: this.persona.persona_id,
        stage,
        cookie_name: cookie.name,
        cookie_value: cookie.value.substring(0, 100), // Truncate long values
        domain: cookie.domain || '',
        path: cookie.path || '/',
        expires: cookie.expires ? new Date(cookie.expires * 1000).toISOString() : 'session',
        httpOnly: cookie.httpOnly || false,
        secure: cookie.secure || false,
        sameSite: cookie.sameSite || 'None'
      }));

      // Store in memory
      this.sessionCookies.push(...cookieData);

      logger.debug(`Captured ${cookies.length} cookies at stage: ${stage}`);
      
      // Save to CSV file
      await this.saveCookiesToCSV(cookieData);

      return cookieData;
    } catch (error) {
      logger.error(`Failed to capture cookies at stage ${stage}: ${error.message}`);
      return [];
    }
  }

  /**
   * Save cookies to CSV file
   * @param {Array} cookieData - Array of cookie objects
   */
  async saveCookiesToCSV(cookieData) {
    const csvFile = path.join(this.cookiesDir, `cookies_${this.persona.persona_id}.csv`);
    const headers = 'timestamp,persona_id,stage,cookie_name,cookie_value,domain,path,expires,httpOnly,secure,sameSite\n';
    
    // Create file with headers if it doesn't exist
    if (!fs.existsSync(csvFile)) {
      fs.writeFileSync(csvFile, headers);
    }

    // Append cookie data
    const csvLines = cookieData.map(cookie => {
      return [
        cookie.timestamp,
        cookie.persona_id,
        cookie.stage,
        `"${cookie.cookie_name}"`,
        `"${cookie.cookie_value.replace(/"/g, '""')}"`, // Escape quotes in CSV
        cookie.domain,
        cookie.path,
        cookie.expires,
        cookie.httpOnly,
        cookie.secure,
        cookie.sameSite
      ].join(',');
    }).join('\n') + '\n';

    fs.appendFileSync(csvFile, csvLines);
  }

  /**
   * Get cookie statistics for this session
   * @returns {Object} Cookie statistics
   */
  getCookieStats() {
    const uniqueCookies = new Set(this.sessionCookies.map(c => c.cookie_name));
    const sessionCookies = this.sessionCookies.filter(c => c.expires === 'session').length;
    const persistentCookies = this.sessionCookies.filter(c => c.expires !== 'session').length;
    const secureCookies = this.sessionCookies.filter(c => c.secure).length;
    const httpOnlyCookies = this.sessionCookies.filter(c => c.httpOnly).length;

    return {
      total_captured: this.sessionCookies.length,
      unique_cookies: uniqueCookies.size,
      session_cookies: sessionCookies,
      persistent_cookies: persistentCookies,
      secure_cookies: secureCookies,
      httpOnly_cookies: httpOnlyCookies
    };
  }

  /**
   * Log cookie statistics
   */
  logCookieStats() {
    const stats = this.getCookieStats();
    logger.info('Cookie Session Statistics:');
    logger.info(`  Total cookies captured: ${stats.total_captured}`);
    logger.info(`  Unique cookie names: ${stats.unique_cookies}`);
    logger.info(`  Session cookies: ${stats.session_cookies}`);
    logger.info(`  Persistent cookies: ${stats.persistent_cookies}`);
    logger.info(`  Secure cookies: ${stats.secure_cookies}`);
    logger.info(`  HttpOnly cookies: ${stats.httpOnly_cookies}`);
  }

  /**
   * Clear session cookies from memory
   */
  clear() {
    this.sessionCookies = [];
  }
}

module.exports = CookieSessionCapture;

