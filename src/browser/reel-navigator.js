const { createLogger } = require('../utils/logger');
const logger = createLogger('ReelNavigator');
const { randomDelay } = require('../utils/random');
const { logCurrentSite } = require('../services/auth-utils');

/**
 * ReelNavigator - Handles navigation between reels in Instagram
 */
class ReelNavigator {
  constructor(page) {
    this.page = page;
  }

  /**
   * Navigate to the reels feed page
   * @returns {Promise<void>}
   */
  async navigateToReelsFeed() {
    logger.debug('Puppeteer: Navigating to reels feed page...');
    await this.page.goto('https://www.instagram.com/reels/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    logger.info(' Reels page loaded successfully');
    await logCurrentSite(this.page, 'Navigated to reels feed');
    await randomDelay(2000, 4000);
  }

  /**
   * Click on the first reel to open the viewer
   * @returns {Promise<boolean>} True if successful
   */
  async clickFirstReel() {
    logger.debug('Looking for first reel to open...');
    const firstReel = await this.page.$('a[href*="/reel/"], a[href*="/reels/"]');
    
    if (!firstReel) {
      logger.warn('No reels found on the page');
      // Wait a bit more - Instagram might be loading reels dynamically
      await randomDelay(3000, 5000);
      const retryReel = await this.page.$('a[href*="/reel/"], a[href*="/reels/"]');
      if (!retryReel) {
        logger.warn('Still no reels found after waiting');
        return false;
      }
      logger.debug('Found reel after waiting, clicking...');
      await retryReel.click();
      await randomDelay(2000, 3000);
      await logCurrentSite(this.page, 'Clicked first reel');
      return true;
    } else {
      logger.debug('Puppeteer: Clicking first reel element...');
      await firstReel.click();
      await randomDelay(2000, 3000);
      await logCurrentSite(this.page, 'Clicked first reel');
      return true;
    }
  }

  /**
   * Check if currently on a reel page
   * @returns {Promise<boolean>}
   */
  async isOnReelPage() {
    try {
      const currentUrl = this.page.url();
      return currentUrl.includes('instagram.com') && 
        (currentUrl.includes('/reel/') || 
         (currentUrl.includes('/reels/') && currentUrl.match(/\/reels\/[^\/]+/)));
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current reel ID from URL
   * @returns {string|null}
   */
  getCurrentReelId() {
    try {
      const url = this.page.url();
      const match = url.match(/\/(?:reels?)\/([^\/\?]+)/);
      return match ? match[1] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Navigate to next reel using multiple strategies
   * @param {number} maxRetries - Maximum number of retries per strategy
   * @returns {Promise<boolean>} True if navigation succeeded
   */
  async navigateToNextReel(maxRetries = 3) {
    const currentReelId = this.getCurrentReelId();
    if (!currentReelId) {
      logger.warn('Could not extract current reel ID from URL - may not be on a reel page');
      return false;
    }
    
    logger.debug(`Navigating from reel: ${currentReelId}`);

    // Try different navigation strategies
    const strategies = [
      () => this.navigateWithArrowDown(currentReelId, maxRetries),
      () => this.navigateWithArrowRight(currentReelId, maxRetries),
      () => this.navigateWithButtonClick(currentReelId, maxRetries),
      () => this.navigateWithSwipe(currentReelId),
      () => this.navigateWithPageDown(currentReelId)
    ];

    for (const strategy of strategies) {
      try {
        const success = await strategy();
        if (success) {
          return true;
        }
      } catch (error) {
        logger.debug(`Navigation strategy failed: ${error.message}`);
      }
    }

    logger.warn(`Failed to navigate to next reel after ${maxRetries} attempts with all methods`);
    return false;
  }

  /**
   * Navigate using ArrowDown key
   */
  async navigateWithArrowDown(currentReelId, maxRetries) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`[Attempt ${attempt}/${maxRetries}] Pressing ArrowDown key...`);
        
        await this.page.focus('body');
        await randomDelay(100, 200);
        await this.page.keyboard.press('ArrowDown');
        
        if (await this.verifyNavigation(currentReelId)) {
          await logCurrentSite(this.page, 'Navigated to next reel (ArrowDown)');
          return true;
        }
        
        if (attempt < maxRetries) {
          await randomDelay(1000, 2000);
        }
      } catch (error) {
        logger.debug(`ArrowDown attempt ${attempt} error: ${error.message}`);
        if (attempt < maxRetries) {
          await randomDelay(1000, 2000);
        }
      }
    }
    return false;
  }

  /**
   * Navigate using ArrowRight key
   */
  async navigateWithArrowRight(currentReelId, maxRetries) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`[Attempt ${attempt}/${maxRetries}] Pressing ArrowRight key...`);
        
        await this.page.focus('body');
        await randomDelay(100, 200);
        await this.page.keyboard.press('ArrowRight');
        
        if (await this.verifyNavigation(currentReelId)) {
          await logCurrentSite(this.page, 'Navigated to next reel (ArrowRight)');
          return true;
        }
        
        if (attempt < maxRetries) {
          await randomDelay(1000, 2000);
        }
      } catch (error) {
        logger.debug(`ArrowRight attempt ${attempt} error: ${error.message}`);
        if (attempt < maxRetries) {
          await randomDelay(1000, 2000);
        }
      }
    }
    return false;
  }

  /**
   * Navigate using Next button click
   */
  async navigateWithButtonClick(currentReelId, maxRetries) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`[Attempt ${attempt}/${maxRetries}] Looking for Next button...`);
        
        const buttonSelectors = [
          'button[aria-label*="Next"]',
          'button[aria-label*="next"]',
          'button[aria-label*="Next reel"]',
          'button[aria-label*="next reel"]',
          'svg[aria-label*="Next"]',
          'div[role="button"][aria-label*="Next"]'
        ];
        
        let nextButton = null;
        for (const selector of buttonSelectors) {
          try {
            nextButton = await this.page.$(selector);
            if (nextButton) {
              logger.debug(`Found Next button with selector: ${selector}`);
              break;
            }
          } catch (e) {
            continue;
          }
        }
        
        if (nextButton) {
          await nextButton.scrollIntoView();
          await randomDelay(200, 400);
          await nextButton.click();
          
          if (await this.verifyNavigation(currentReelId)) {
            await logCurrentSite(this.page, 'Navigated to next reel (button click)');
            return true;
          }
        } else {
          logger.debug('Next button not found');
        }
        
        if (attempt < maxRetries) {
          await randomDelay(1500, 2500);
        }
      } catch (error) {
        logger.debug(`Button click attempt ${attempt} error: ${error.message}`);
        if (attempt < maxRetries) {
          await randomDelay(1500, 2500);
        }
      }
    }
    return false;
  }

  /**
   * Navigate using swipe gesture
   */
  async navigateWithSwipe(currentReelId) {
    try {
      const videoEl = await this.page.$('video');
      if (videoEl) {
        const box = await videoEl.boundingBox();
        if (box) {
          const startX = box.x + box.width / 2;
          const startY = box.y + box.height / 2;
          const endY = box.y + box.height * 0.2; // Swipe up
          
          logger.debug('Performing swipe gesture...');
          await this.page.mouse.move(startX, startY);
          await this.page.mouse.down();
          await randomDelay(100, 200);
          await this.page.mouse.move(startX, endY, { steps: 10 });
          await randomDelay(100, 200);
          await this.page.mouse.up();
          
          if (await this.verifyNavigation(currentReelId)) {
            await logCurrentSite(this.page, 'Navigated to next reel (swipe)');
            return true;
          }
        }
      }
    } catch (error) {
      logger.debug(`Swipe gesture error: ${error.message}`);
    }
    return false;
  }

  /**
   * Navigate using PageDown key
   */
  async navigateWithPageDown(currentReelId) {
    try {
      await this.page.focus('body');
      await randomDelay(100, 200);
      await this.page.keyboard.press('PageDown');
      
      if (await this.verifyNavigation(currentReelId, 6000)) {
        await logCurrentSite(this.page, 'Navigated to next reel (PageDown)');
        return true;
      }
    } catch (error) {
      logger.debug(`PageDown error: ${error.message}`);
    }
    return false;
  }

  /**
   * Verify navigation succeeded by checking URL change
   */
  async verifyNavigation(currentReelId, maxWaitTime = 8000) {
    const checkInterval = 300;
    let waitedTime = 0;
    
    while (waitedTime < maxWaitTime) {
      await randomDelay(checkInterval, checkInterval + 100);
      waitedTime += checkInterval;
      
      const newReelId = this.getCurrentReelId();
      
      // Success: we're on a different reel
      if (newReelId && newReelId !== currentReelId) {
        logger.debug(` Navigation verified: ${currentReelId} → ${newReelId} (took ${waitedTime}ms)`);
        return true;
      }
      
      // Check page state - ensure video is playing/loaded
      try {
        const videoEl = await this.page.$('video[src], video[srcset]');
        if (videoEl && waitedTime > 2000) {
          if (waitedTime > maxWaitTime * 0.7) {
            logger.debug(`Video detected but URL unchanged after ${waitedTime}ms, treating as navigation`);
            return true;
          }
        }
      } catch (e) {
        // Ignore video check errors
      }
    }
    
    return false;
  }
}

module.exports = ReelNavigator;

