const { createLogger } = require('../utils/logger');
const logger = createLogger('AppPromptHandler');
const { randomDelay } = require('../utils/random');
const Clicking = require('../browser/clicking');

/**
 * AppPromptHandler - Handles Instagram's "Use the app" prompts
 * Instagram shows these prompts when it detects automation or wants users to use mobile app
 */
class AppPromptHandler {
  /**
   * Check if page shows "Use the app" prompt
   * @param {Object} page - Puppeteer page object
   * @returns {Promise<boolean>} True if prompt detected
   */
  static async checkForAppPrompt(page) {
    try {
      const hasPrompt = await page.evaluate(() => {
        const bodyText = (document.body.innerText || '').toLowerCase();
        const pageHTML = document.documentElement.innerHTML.toLowerCase();
        
        // Check for common "use app" prompt text
        const promptKeywords = [
          'use the app',
          'use app',
          'download the app',
          'install the app',
          'view all comments',
          'discover more reels',
          'get the app',
          'open in app'
        ];

        for (const keyword of promptKeywords) {
          if (bodyText.includes(keyword) || pageHTML.includes(keyword)) {
            return true;
          }
        }

        // Check for common button text
        const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
        for (const button of buttons) {
          const buttonText = (button.textContent || '').toLowerCase();
          if (buttonText.includes('not now') || 
              buttonText.includes('maybe later') ||
              buttonText.includes('skip') ||
              buttonText.includes('continue')) {
            // Check if it's near app-related text
            const parentText = (button.closest('div')?.textContent || '').toLowerCase();
            if (promptKeywords.some(kw => parentText.includes(kw))) {
              return true;
            }
          }
        }

        return false;
      });

      if (hasPrompt) {
        logger.debug('App prompt detected on page');
        return true;
      }
    } catch (e) {
      logger.debug(`Error checking for app prompt: ${e.message}`);
    }

    return false;
  }

  /**
   * Dismiss "Use the app" prompt by clicking dismiss button
   * @param {Object} page - Puppeteer page object
   * @returns {Promise<boolean>} True if prompt was dismissed
   */
  static async dismissAppPrompt(page) {
    try {
      logger.info('Attempting to dismiss "Use the app" prompt...');
      
      // Wait a moment for prompt to fully render
      await randomDelay(1000, 2000);

      // Try multiple strategies to dismiss the prompt
      const dismissed = await page.evaluate(() => {
        // Strategy 1: Look for "Not Now" button
        const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
        for (const button of buttons) {
          const buttonText = (button.textContent || '').toLowerCase().trim();
          if (buttonText === 'not now' || 
              buttonText === 'maybe later' ||
              buttonText === 'skip' ||
              buttonText === 'continue browsing' ||
              buttonText.includes('not now')) {
            button.click();
            return true;
          }
        }

        // Strategy 2: Look for close/X button
        const closeButtons = Array.from(document.querySelectorAll(
          'svg[aria-label="Close"], button[aria-label*="Close"], button[aria-label*="close"], [aria-label*="Close"]'
        ));
        for (const button of closeButtons) {
          const parentText = (button.closest('div')?.textContent || '').toLowerCase();
          if (parentText.includes('app') || parentText.includes('download')) {
            button.click();
            return true;
          }
        }

        // Strategy 3: Look for any dismissible modal/dialog
        const modals = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"]'));
        for (const modal of modals) {
          const modalText = (modal.textContent || '').toLowerCase();
          if (modalText.includes('app') || modalText.includes('download')) {
            // Look for close button within modal
            const closeBtn = modal.querySelector('button, [role="button"]');
            if (closeBtn) {
              closeBtn.click();
              return true;
            }
            // Try ESC key simulation
            return false; // Will try ESC key below
          }
        }

        return false;
      });

      if (dismissed) {
        logger.info('✓ App prompt dismissed by clicking button');
        await randomDelay(1000, 2000);
        return true;
      }

      // Strategy 4: Try pressing ESC key
      logger.debug('Button click failed, trying ESC key...');
      await page.keyboard.press('Escape');
      await randomDelay(1000, 2000);
      
      // Verify prompt is gone
      const stillPresent = await this.checkForAppPrompt(page);
      if (!stillPresent) {
        logger.info('✓ App prompt dismissed with ESC key');
        return true;
      }

      // Strategy 5: Try clicking outside the modal (backdrop click)
      logger.debug('ESC failed, trying backdrop click...');
      const backdropDismissed = await page.evaluate(() => {
        // Find modal backdrop
        const backdrops = Array.from(document.querySelectorAll('div[style*="background"], div[style*="backdrop"]'));
        for (const backdrop of backdrops) {
          const style = backdrop.getAttribute('style') || '';
          if (style.includes('position') && (style.includes('fixed') || style.includes('absolute'))) {
            backdrop.click();
            return true;
          }
        }
        return false;
      });

      if (backdropDismissed) {
        await randomDelay(1000, 2000);
        const stillPresent = await this.checkForAppPrompt(page);
        if (!stillPresent) {
          logger.info('✓ App prompt dismissed by clicking backdrop');
          return true;
        }
      }

      logger.warn('Could not dismiss app prompt - it may still be visible');
      return false;
    } catch (error) {
      logger.debug(`Error dismissing app prompt: ${error.message}`);
      return false;
    }
  }

  /**
   * Handle app prompt if present (check and dismiss)
   * @param {Object} page - Puppeteer page object
   * @returns {Promise<boolean>} True if prompt was handled
   */
  static async handleAppPrompt(page) {
    const hasPrompt = await this.checkForAppPrompt(page);
    if (hasPrompt) {
      logger.warn('⚠️  Instagram "Use the app" prompt detected');
      const dismissed = await this.dismissAppPrompt(page);
      if (dismissed) {
        logger.info('App prompt successfully dismissed');
        return true;
      } else {
        logger.warn('Failed to dismiss app prompt - continuing anyway');
        return false;
      }
    }
    return false;
  }
}

module.exports = AppPromptHandler;

