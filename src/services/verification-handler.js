const { createLogger } = require('../utils/logger');
const logger = createLogger('VerificationHandler');
const { randomDelay } = require('../utils/random');
const Typing = require('../browser/typing');
const { promptForCode } = require('../utils/cli');
const defaults = require('../config/defaults');

/**
 * VerificationHandler - Handles 2FA/verification code input
 */
class VerificationHandler {
  /**
   * Find verification input field using multiple selector strategies
   * @param {Object} page - Puppeteer page object
   * @returns {Promise<string|null>} Selector if found, null otherwise
   */
  static async findVerificationInput(page) {
    const selectors = [
      'input[name="verificationCode"]',
      'input[autocomplete="one-time-code"]',
      'input[type="text"][maxlength="6"]',
      'input[type="text"][maxlength="7"]', // Some codes might be 7 digits
      'input[type="text"]', // Fallback
    ];

    // Try each selector with a short timeout
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: defaults.verification.inputTimeout });
        logger.debug(`Found verification input using selector: ${selector}`);
        return selector;
      } catch (e) {
        // Continue to next selector
        continue;
      }
    }

    // Last resort: try to find any input field that might be for codes
    try {
      const foundSelector = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
        for (const input of inputs) {
          const name = (input.name || '').toLowerCase();
          const placeholder = (input.placeholder || '').toLowerCase();
          const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
          const maxLength = parseInt(input.maxLength) || 0;
          
          if (
            name.includes('code') ||
            name.includes('verification') ||
            placeholder.includes('code') ||
            placeholder.includes('verification') ||
            ariaLabel.includes('code') ||
            ariaLabel.includes('verification') ||
            (maxLength >= 6 && maxLength <= 8)
          ) {
            // Return a unique selector for this input
            if (input.id) return `#${input.id}`;
            if (input.name) return `input[name="${input.name}"]`;
            if (input.className) {
              const classes = input.className.split(' ').filter(c => c).join('.');
              if (classes) return `input.${classes}`;
            }
          }
        }
        return null;
      });

      if (foundSelector) {
        logger.debug(`Found verification input using fallback selector: ${foundSelector}`);
        return foundSelector;
      }
    } catch (e) {
      logger.debug('Fallback input search failed:', e.message);
    }

    return null;
  }

  /**
   * Find submit button using multiple selector strategies
   * Instagram often uses divs instead of buttons for submit actions
   * @param {Object} page - Puppeteer page object
   * @returns {Promise<string|null>} Selector if found, null otherwise
   */
  static async findSubmitButton(page) {
    // First try standard selectors
    const selectors = [
      'button[type="submit"]',
    ];

    // Try each selector
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: defaults.verification.submitTimeout });
        logger.debug(`Found submit button using selector: ${selector}`);
        return selector;
      } catch (e) {
        // Continue to next selector
        continue;
      }
    }

    // Fallback: find button OR div by text content using evaluate
    try {
      const foundSelector = await page.evaluate(() => {
        // First try buttons
        const buttons = Array.from(document.querySelectorAll('button'));
        for (const button of buttons) {
          const text = (button.textContent || '').toLowerCase().trim();
          const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
          
          if (
            text.includes('confirm') ||
            text.includes('submit') ||
            text.includes('continue') ||
            text.includes('next') ||
            ariaLabel.includes('confirm') ||
            ariaLabel.includes('submit') ||
            ariaLabel.includes('continue')
          ) {
            // Try to create a unique selector
            if (button.id) return `#${button.id}`;
            if (button.name) return `button[name="${button.name}"]`;
            if (button.className) {
              const classes = button.className.split(' ').filter(c => c && !c.includes('_')).slice(0, 2).join('.');
              if (classes) return `button.${classes}`;
            }
            // Return button by position as last resort
            const allButtons = Array.from(document.querySelectorAll('button'));
            const index = allButtons.indexOf(button);
            return `button:nth-of-type(${index + 1})`;
          }
        }

        // If no button found, try divs and other clickable elements
        // Instagram often uses divs with role="button" or clickable divs containing "Continue"
        const clickableElements = Array.from(document.querySelectorAll('div[role="button"], div[role="none"], a, [tabindex="0"]'));
        for (const element of clickableElements) {
          const text = (element.textContent || '').toLowerCase().trim();
          const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
          
          // Check if it contains "Continue", "Confirm", "Submit", "Next"
          if (
            text === 'continue' ||
            text === 'confirm' ||
            text === 'submit' ||
            text === 'next' ||
            text.includes('continue') ||
            text.includes('confirm') ||
            text.includes('submit') ||
            ariaLabel.includes('confirm') ||
            ariaLabel.includes('submit') ||
            ariaLabel.includes('continue')
          ) {
            // Check if any child span contains the exact text
            const spans = element.querySelectorAll('span');
            let hasContinueText = false;
            for (const span of spans) {
              const spanText = (span.textContent || '').toLowerCase().trim();
              if (spanText === 'continue' || spanText === 'confirm' || spanText === 'submit' || spanText === 'next') {
                hasContinueText = true;
                break;
              }
            }
            
            if (hasContinueText || text.includes('continue') || text.includes('confirm')) {
              // Try to create a unique selector
              if (element.id) return `#${element.id}`;
              
              // Try using parent container if element has specific classes
              if (element.className) {
                const classes = element.className.split(' ').filter(c => c && c.length > 0).slice(0, 3).join('.');
                if (classes) return `div.${classes}`;
              }
              
              // Try finding by the span text and getting parent
              const continueSpan = Array.from(spans).find(s => {
                const sText = (s.textContent || '').toLowerCase().trim();
                return sText === 'continue' || sText === 'confirm';
              });
              
              if (continueSpan) {
                // Get the clickable parent (usually 2-3 levels up)
                let parent = continueSpan.parentElement;
                let levels = 0;
                while (parent && levels < 3) {
                  if (parent.tagName === 'DIV' && parent.className) {
                    const classes = parent.className.split(' ').filter(c => c && c.length > 0).slice(0, 2).join('.');
                    if (classes) return `div.${classes}`;
                  }
                  parent = parent.parentElement;
                  levels++;
                }
              }
            }
          }
        }
        
        return null;
      });

      if (foundSelector) {
        // Verify the selector works
        try {
          await page.waitForSelector(foundSelector, { timeout: defaults.verification.submitTimeout });
          logger.debug(`Found submit element using fallback selector: ${foundSelector}`);
          return foundSelector;
        } catch (e) {
          logger.debug(`Fallback selector ${foundSelector} did not work, trying direct click...`);
          // Will fall through to direct click in main handler
        }
      }
    } catch (e) {
      logger.debug('Fallback button search failed:', e.message);
    }

    return null;
  }

  /**
   * Take screenshot for debugging
   * Screenshots are saved to the data directory (mounted volume in Docker)
   * @param {Object} page - Puppeteer page object
   * @param {string} filename - Filename for screenshot
   */
  static async takeScreenshot(page, filename) {
    try {
      // Save screenshots to data directory which is mounted in Docker
      const path = require('path');
      const fs = require('fs');
      
      // Use data directory if it exists, otherwise current directory
      let screenshotPath = filename;
      try {
        const dataDir = path.join(process.cwd(), 'data');
        if (fs.existsSync(dataDir)) {
          screenshotPath = path.join(dataDir, filename);
        } else {
          screenshotPath = filename;
        }
      } catch (e) {
        // Fallback to filename if path check fails
        screenshotPath = filename;
      }
      
      await page.screenshot({ path: screenshotPath, fullPage: true });
      logger.info(`Screenshot saved: ${screenshotPath} (check data/ directory if running in Docker)`);
    } catch (error) {
      if (error.message.includes('Not attached') || error.message.includes('Target closed')) {
        logger.debug('Cannot take screenshot: page was detached');
      } else {
        logger.debug(`Failed to take screenshot: ${error.message}`);
      }
    }
  }

  /**
   * Handle verification code prompt (2FA or suspicious login)
   * @param {Object} page - Puppeteer page object
   * @param {Object} persona - Persona configuration (optional, for email instructions)
   * @returns {Promise<void>}
   */
  static async handleVerificationCode(page, persona = null) {
    try {
      logger.info('');
      logger.info('═══════════════════════════════════════════════════════════');
      logger.info('🔐 VERIFICATION CODE REQUIRED');
      logger.info('═══════════════════════════════════════════════════════════');
      logger.info('Instagram requires a verification code to continue.');
      logger.info('This may be a 2FA code from your authenticator app or');
      logger.info('a security code sent to your email/phone.');
      logger.info('═══════════════════════════════════════════════════════════');
      logger.info('');

      // Prepare credentials for prompt if persona is provided
      let promptOptions = {};
      if (persona && persona.credentials) {
        promptOptions = {
          email: persona.credentials.email,
          username: persona.credentials.username || persona.credentials.email,
          password: persona.credentials.password
        };
      }

      // Prompt user FIRST before waiting for page elements
      // This gives user time to prepare while page loads
      logger.info('Please prepare your verification code...');
      const code = await promptForCode(promptOptions);
      
      // If user pressed Enter to skip (false positive), return early
      if (code === null || code.trim().length === 0) {
        logger.info('');
        logger.info('⏭️  Skipping verification - treating as false positive');
        logger.info('Continuing with normal flow...');
        logger.info('');
        return; // Exit early, don't attempt verification
      }

      const trimmedCode = code.trim();
      if (trimmedCode.length < 6 || trimmedCode.length > 8) {
        logger.warn(`Warning: Code length is ${trimmedCode.length} characters. Expected 6-8 digits.`);
        logger.warn('Proceeding anyway...');
      }

      logger.info('');
      logger.info(`Waiting for verification code input field (code ready: ${trimmedCode.length} digits)...`);
      
      // Wait for page to be ready and find input field
      await randomDelay(1000, 2000);
      
      // Try to find the verification input field with multiple strategies
      const inputSelector = await this.findVerificationInput(page);
      
      if (!inputSelector) {
        await this.takeScreenshot(page, 'verification_input_not_found.png');
        throw new Error('Could not find verification code input field. Screenshot saved: verification_input_not_found.png');
      }

      logger.info(`Found verification input field. Entering code...`);
      logger.debug(`Using selector: ${inputSelector}`);
      
      // Type the code
      await Typing.humanTypeText(page, inputSelector, trimmedCode);
      await randomDelay(500, 1000);

      // Find and click submit button
      logger.debug('Looking for submit button...');
      const submitSelector = await this.findSubmitButton(page);
      
      if (!submitSelector) {
        // Try generic element click as last resort (handles divs that act as buttons)
        logger.warn('Could not find specific submit button, trying direct click on element with matching text...');
        try {
          const clicked = await page.evaluate(() => {
            // First try buttons
            const buttons = Array.from(document.querySelectorAll('button'));
            let submitElement = buttons.find(btn => {
              const text = (btn.textContent || '').toLowerCase().trim();
              const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
              return (
                text.includes('confirm') ||
                text.includes('submit') ||
                text.includes('continue') ||
                text.includes('next') ||
                ariaLabel.includes('confirm') ||
                ariaLabel.includes('submit') ||
                ariaLabel.includes('continue')
              );
            });
            
            // If no button found, try divs and other clickable elements
            if (!submitElement) {
              const clickableElements = Array.from(document.querySelectorAll('div[role="button"], div[role="none"], a, [tabindex="0"]'));
              submitElement = clickableElements.find(el => {
                const text = (el.textContent || '').toLowerCase().trim();
                const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
                
                // Check for exact match or contains
                if (text === 'continue' || text === 'confirm' || text === 'submit' || text === 'next') {
                  return true;
                }
                
                // Check child spans for exact text
                const spans = el.querySelectorAll('span');
                for (const span of spans) {
                  const spanText = (span.textContent || '').toLowerCase().trim();
                  if (spanText === 'continue' || spanText === 'confirm' || spanText === 'submit' || spanText === 'next') {
                    return true;
                  }
                }
                
                return (
                  text.includes('continue') ||
                  text.includes('confirm') ||
                  text.includes('submit') ||
                  text.includes('next') ||
                  ariaLabel.includes('confirm') ||
                  ariaLabel.includes('submit') ||
                  ariaLabel.includes('continue')
                );
              });
            }
            
            if (submitElement) {
              // Scroll into view first to ensure element is visible
              submitElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              
              // Click the element
              submitElement.click();
              
              return true;
            }
            return false;
          });
          
          if (!clicked) {
            await this.takeScreenshot(page, 'verification_submit_not_found.png');
            throw new Error('Could not find submit button. Screenshot saved: verification_submit_not_found.png');
          }
          logger.info('Clicked submit element using direct method');
          // Wait for click to register and scroll to complete
          await randomDelay(500, 1000);
        } catch (e) {
          if (e.message.includes('Could not find submit button') || e.message.includes('Could not click submit button')) {
            throw e;
          }
          await this.takeScreenshot(page, 'verification_submit_error.png');
          throw new Error(`Failed to click submit button: ${e.message}. Screenshot saved: verification_submit_error.png`);
        }
      } else {
        logger.debug(`Clicking submit element using selector: ${submitSelector}`);
        // Scroll into view first
        await page.evaluate((selector) => {
          const element = document.querySelector(selector);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, submitSelector);
        await randomDelay(300, 500);
        await page.click(submitSelector);
      }

      // Wait for navigation after verification
      logger.info('Waiting for verification to complete...');
      try {
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: defaults.verification.navigationTimeout });
      } catch (navError) {
        // Navigation might not happen, check URL instead
        logger.debug('Navigation wait timeout, checking URL...');
        await randomDelay(2000, 3000);
      }

      const currentUrl = page.url();
      if (currentUrl.includes('/challenge/') || 
          currentUrl.includes('/auth_platform/codeentry/')) {
        await this.takeScreenshot(page, 'verification_failed.png');
        throw new Error('Verification failed. Code may be incorrect or expired. Screenshot saved: verification_failed.png');
      }

      logger.info('');
      logger.info('✅ Verification successful!');
      logger.info('');
    } catch (error) {
      logger.error('');
      logger.error('═══════════════════════════════════════════════════════════');
      logger.error('❌ VERIFICATION FAILED');
      logger.error('═══════════════════════════════════════════════════════════');
      logger.error(`Error: ${error.message}`);
      logger.error('═══════════════════════════════════════════════════════════');
      logger.error('');
      throw error;
    }
  }
}

module.exports = VerificationHandler;
