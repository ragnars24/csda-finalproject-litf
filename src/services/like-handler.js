const { createLogger } = require('../utils/logger');
const logger = createLogger('LikeHandler');
const { randomDelay } = require('../utils/random');
const EngagementStrategy = require('./engagement-strategy');

/**
 * LikeHandler - Handles liking reels/posts
 */
class LikeHandler {
  constructor(page, persona) {
    this.page = page;
    this.persona = persona;
  }

  /**
   * Like current reel
   * @returns {Promise<void>}
   */
  async likeReel() {
    try {
      await randomDelay(500, 1000);
      
      // Find and click like button
      logger.debug('Puppeteer: Looking for like button...');
      const likeButton = await this.page.$('button[aria-label*="Like"], svg[aria-label*="Like"]');
      if (likeButton) {
        logger.debug('Puppeteer: Clicking like button...');
        await likeButton.click();
        logger.debug(' Liked reel');
        
        // Use engagement delay if available, otherwise default to 2-5 seconds
        const delayMin = (this.persona.engagement?.likes?.delay_seconds?.min || 2) * 1000;
        const delayMax = (this.persona.engagement?.likes?.delay_seconds?.max || 5) * 1000;
        await randomDelay(delayMin, delayMax);
      }
    } catch (error) {
      logger.error(`Failed to like reel: ${error.message}`);
    }
  }

  /**
   * Determine if reel should be liked based on persona engagement settings
   * @returns {boolean} True if reel should be liked
   */
  shouldLikePost() {
    return EngagementStrategy.shouldLike(this.persona);
  }
}

module.exports = LikeHandler;

