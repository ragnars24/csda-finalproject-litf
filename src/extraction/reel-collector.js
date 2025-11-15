const { createLogger } = require('../utils/logger');
const logger = createLogger('ReelCollector');

/**
 * ReelCollector - Collects and manages reel data from network interception
 */
class ReelCollector {
  constructor() {
    this.collectedReels = new Map(); // Store reels by post_id
    this.networkReels = []; // Accumulate reels from GraphQL responses
  }

  /**
   * Add a reel to the collection
   * @param {Object} reelData - Reel data object
   */
  addReel(reelData) {
    if (!reelData || !reelData.post_id) {
      return;
    }

    if (!this.collectedReels.has(reelData.post_id)) {
      this.collectedReels.set(reelData.post_id, reelData);
      this.networkReels.push(reelData);
      logger.info(`  Captured reel from network: ${reelData.post_id} by @${reelData.author_username || 'unknown'}`);
    } else {
      logger.debug(` Reel ${reelData.post_id} already in cache, skipping`);
    }
  }

  /**
   * Get reel by post_id
   * @param {string} postId - Post ID
   * @returns {Object|null} Reel data or null
   */
  getReel(postId) {
    return this.collectedReels.get(postId) || null;
  }

  /**
   * Check if reel exists in collection
   * @param {string} postId - Post ID
   * @returns {boolean}
   */
  hasReel(postId) {
    return this.collectedReels.has(postId);
  }

  /**
   * Get all collected reels
   * @returns {Array} Array of reel data objects
   */
  getAllReels() {
    return Array.from(this.collectedReels.values());
  }

  /**
   * Get network-captured reels
   * @returns {Array} Array of reel data objects
   */
  getNetworkReels() {
    return this.networkReels;
  }

  /**
   * Clear all collected reels
   */
  clear() {
    this.collectedReels.clear();
    this.networkReels = [];
  }

  /**
   * Get collection size
   * @returns {number}
   */
  size() {
    return this.collectedReels.size;
  }
}

module.exports = ReelCollector;

