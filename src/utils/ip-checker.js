const axios = require('axios');
const { createLogger } = require('./logger');
const logger = createLogger('IPChecker');

/**
 * Check current public IP and location
 * @param {Object} proxyConfig - Optional proxy configuration to test
 * @returns {Object} IP and location information
 */
async function checkIPAndLocation(proxyConfig = null) {
  try {
    let requestConfig = { timeout: 10000 };

    // If proxy is configured, use it for the request
    if (proxyConfig) {
      const { HttpsProxyAgent } = require('https-proxy-agent');
      const agent = new HttpsProxyAgent(proxyConfig.url);
      requestConfig.httpsAgent = agent;
    }

    // Get IP address
    const ipResponse = await axios.get('https://api.ipify.org?format=json', requestConfig);
    const ip = ipResponse.data.ip;

    // Get geolocation
    const geoResponse = await axios.get(`http://ip-api.com/json/${ip}`, { timeout: 10000 });
    const geo = geoResponse.data;

    if (geo.status === 'success') {
      return {
        ip: ip,
        country: geo.country,
        countryCode: geo.countryCode,
        region: geo.regionName,
        city: geo.city,
        isp: geo.isp,
        timezone: geo.timezone
      };
    } else {
      return {
        ip: ip,
        country: 'Unknown',
        countryCode: 'Unknown',
        region: 'Unknown',
        city: 'Unknown',
        isp: 'Unknown',
        timezone: 'Unknown'
      };
    }
  } catch (error) {
    logger.error(`Failed to check IP/location: ${error.message}`);
    return null;
  }
}

/**
 * Log IP and location information
 * @param {Object} ipInfo - IP information object
 * @param {string} context - Context message (e.g., "Direct connection", "Through proxy")
 */
function logIPInfo(ipInfo, context = '') {
  if (!ipInfo) {
    logger.warn('Could not determine IP/location information');
    return;
  }

  const prefix = context ? `[${context}] ` : '';
  logger.info(`${prefix}Public IP: ${ipInfo.ip}`);
  logger.info(`${prefix}Country: ${ipInfo.country} (${ipInfo.countryCode})`);
  logger.info(`${prefix}Location: ${ipInfo.city}, ${ipInfo.region}`);
  logger.info(`${prefix}ISP: ${ipInfo.isp}`);
  logger.debug(`${prefix}Timezone: ${ipInfo.timezone}`);
}

module.exports = {
  checkIPAndLocation,
  logIPInfo
};

