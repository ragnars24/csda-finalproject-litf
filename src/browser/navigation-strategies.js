/**
 * NavigationStrategies - Collection of navigation strategy implementations
 * This module provides reusable navigation strategies that can be used
 * by ReelNavigator and other navigation components
 */
class NavigationStrategies {
  /**
   * Create a keyboard navigation strategy
   * @param {Object} page - Puppeteer page object
   * @param {string} key - Key to press (e.g., 'ArrowDown', 'ArrowRight')
   * @returns {Function} Navigation function
   */
  static createKeyboardStrategy(page, key) {
    return async (currentReelId, verifyFn) => {
      await page.focus('body');
      await page.keyboard.press(key);
      return await verifyFn(currentReelId);
    };
  }

  /**
   * Create a button click navigation strategy
   * @param {Object} page - Puppeteer page object
   * @param {Array<string>} selectors - Array of CSS selectors to try
   * @returns {Function} Navigation function
   */
  static createButtonClickStrategy(page, selectors) {
    return async (currentReelId, verifyFn) => {
      for (const selector of selectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            await button.scrollIntoView();
            await button.click();
            return await verifyFn(currentReelId);
          }
        } catch (e) {
          continue;
        }
      }
      return false;
    };
  }

  /**
   * Create a swipe gesture navigation strategy
   * @param {Object} page - Puppeteer page object
   * @returns {Function} Navigation function
   */
  static createSwipeStrategy(page) {
    return async (currentReelId, verifyFn) => {
      const videoEl = await page.$('video');
      if (videoEl) {
        const box = await videoEl.boundingBox();
        if (box) {
          const startX = box.x + box.width / 2;
          const startY = box.y + box.height / 2;
          const endY = box.y + box.height * 0.2; // Swipe up
          
          await page.mouse.move(startX, startY);
          await page.mouse.down();
          await page.mouse.move(startX, endY, { steps: 10 });
          await page.mouse.up();
          
          return await verifyFn(currentReelId);
        }
      }
      return false;
    };
  }
}

module.exports = NavigationStrategies;

