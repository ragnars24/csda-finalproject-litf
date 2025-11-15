const { createLogger } = require('../utils/logger');
const logger = createLogger('BandwidthOptimizer');
const defaults = require('../config/defaults');

/**
 * BandwidthOptimizer - Optimizes bandwidth by blocking non-essential resources
 */
class BandwidthOptimizer {
  constructor(page, blockMediaTypes = null) {
    this.page = page;
    this.blockMediaTypes = blockMediaTypes;
  }

  /**
   * Set up bandwidth optimization by blocking specified resource types
   * @param {Array|null} blockMediaTypes - Array of resource types to block, or null for default
   * Blocks images, stylesheets, fonts, and media while allowing essential API requests
   */
  setup() {
    this.page.setRequestInterception(true);
    
    // Determine which types to block
    let blockedTypes;
    if (this.blockMediaTypes === null || this.blockMediaTypes === undefined) {
      // Use default blocking from config
      blockedTypes = defaults.bandwidth.blockMediaTypes;
      logger.debug(`blockMediaTypes is null/undefined, using defaults: ${JSON.stringify(blockedTypes)}`);
    } else if (Array.isArray(this.blockMediaTypes) && this.blockMediaTypes.length === 0) {
      // Empty array means block nothing
      blockedTypes = [];
      logger.debug('blockMediaTypes is empty array [], blocking disabled');
    } else {
      // Use provided types
      blockedTypes = this.blockMediaTypes;
      logger.debug(`Using provided blockMediaTypes: ${JSON.stringify(blockedTypes)}`);
    }
    
    this.page.on('request', (request) => {
      const resourceType = request.resourceType();
      const url = request.url();
      
      // If blocking is disabled (empty array), allow all requests
      if (blockedTypes.length === 0) {
        request.continue();
        return;
      }
      
      // Block specified resource types
      if (blockedTypes.includes(resourceType)) {
        request.abort();
        return;
      }
      
      // Always allow essential requests:
      // - Main document (HTML)
      // - Scripts (needed for page functionality and data extraction)
      // - GraphQL API requests
      // - AJAX requests
      // - XHR/Fetch requests
      if (resourceType === 'document' || 
          resourceType === 'script' ||
          url.includes('/graphql/query') ||
          url.includes('/ajax/') ||
          resourceType === 'xhr' ||
          resourceType === 'fetch') {
        request.continue();
        return;
      }
      
      // Block everything else (if not in blockedTypes, it's an unknown type)
      request.abort();
    });
    
    if (blockedTypes.length === 0) {
      logger.info('Bandwidth optimization disabled - all resources will be loaded');
    } else {
      logger.info(`Bandwidth optimization enabled - blocking: ${blockedTypes.join(', ')}`);
    }
  }
}

module.exports = BandwidthOptimizer;

