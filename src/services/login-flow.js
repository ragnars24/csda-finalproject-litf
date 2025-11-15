const { createLogger } = require('../utils/logger');
const logger = createLogger('LoginFlow');
const { randomDelay } = require('../utils/random');
const CookieHandler = require('./cookie-handler');
const VerificationHandler = require('./verification-handler');
const AppPromptHandler = require('./app-prompt-handler');
const Typing = require('../browser/typing');
const Clicking = require('../browser/clicking');
const { logCurrentSite } = require('./auth-utils');

/**
 * Custom error class for account suspension
 */
class AccountSuspendedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AccountSuspendedError';
    this.isSuspension = true;
  }
}

/**
 * LoginFlow - Handles the complete Instagram login flow
 */
class LoginFlow {
  /**
   * Main login function - handles the complete Instagram login flow
   * @param {Object} page - Puppeteer page object
   * @param {Object} persona - Persona configuration with credentials
   * @returns {Promise<boolean>} True if login successful
   */
  static async handleLogin(page, persona) {
    logger.info(`Logging in as ${persona.credentials.username}`);
    logger.debug('Navigating to Instagram login page...');

    try {
      logger.debug('Puppeteer: Executing page.goto() to login page...');
      await page.goto('https://www.instagram.com/accounts/login/', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      logger.debug('Login page loaded');
      await logCurrentSite(page, 'Navigated to login page');

      // Wait for page to fully render
      await randomDelay(3000, 4000);

      // Handle cookie banner if it appears (do this FIRST before interacting with form)
      logger.debug('Checking for cookie banner...');
      await CookieHandler.handleCookieBanner(page);

      // Extra wait to ensure cookie banner modal is completely gone
      await randomDelay(2000, 3000);

      // Wait for login form to be fully interactable
      logger.debug('Puppeteer: Waiting for login form selectors...');
      await page.waitForSelector('input[name="username"]', { timeout: 15000 });
      await page.waitForSelector('input[name="password"]', { timeout: 15000 });
      logger.debug('Login form found and ready');

      // Type username with human-like delays
      logger.debug('Puppeteer: Typing username into input field...');
      await Typing.humanTypeText(page, 'input[name="username"]', persona.credentials.username);
      await randomDelay(500, 1500);

      // Type password
      logger.debug('Puppeteer: Typing password into input field...');
      await Typing.humanTypeText(page, 'input[name="password"]', persona.credentials.password);
      await randomDelay(1000, 2000);

      // Click login button
      logger.debug('Puppeteer: Clicking submit button...');
      await page.click('button[type="submit"]');

      // Wait for login response
      logger.debug('Waiting for login response...');
      let navigationHappened = false;
      
      try {
        await Promise.race([
          page.waitForNavigation({ 
            waitUntil: 'networkidle2', 
            timeout: 15000 
          }).then(() => { navigationHappened = true; }),
          page.waitForSelector('svg[aria-label="Home"], a[href*="/direct/"], nav[role="navigation"]', { 
            timeout: 15000 
          }).then(() => { navigationHappened = true; })
        ]);
      } catch (navError) {
        logger.debug('Navigation wait timeout, checking page state manually...');
      }

      // Additional wait to ensure page is stable
      await randomDelay(2000, 3000);

      // Check current URL to determine next step
      const currentUrl = page.url();
      logger.debug(`Current URL after login: ${currentUrl}`);

      // Check for account suspension FIRST (before other checks)
      const isSuspended = await this.checkForSuspension(page);
      if (isSuspended) {
        const suspensionUrl = page.url();
        logger.error(`⚠️  Account suspended detected: ${suspensionUrl}`);
        await this.takeLoginErrorScreenshot(page);
        throw new AccountSuspendedError(`Account suspended: ${suspensionUrl}`);
      }

      // Check if we need 2FA/verification code (check both URL and content)
      const needsVerification = await this.checkForChallenge(page);
      if (needsVerification) {
        logger.info('Instagram requires verification code');
        // Take screenshot for assessment
        await VerificationHandler.takeScreenshot(page, 'verification_detected.png');
        logger.info('Screenshot saved: verification_detected.png - Please review to confirm verification is needed');
        
        // Store the current URL before verification attempt
        const urlBeforeVerification = page.url();
        
        // Attempt verification (user can skip by pressing Enter)
        await VerificationHandler.handleVerificationCode(page, persona);
        
        // After verification attempt (or skip), check if we're past it
        await randomDelay(2000, 3000);
        const stillNeedsVerification = await this.checkForChallenge(page);
        const currentUrlAfterVerification = page.url();
        
        // If challenge is still present but URL changed, it might have navigated away
        // If challenge is gone, we're good
        if (stillNeedsVerification && currentUrlAfterVerification === urlBeforeVerification) {
          logger.warn('Challenge page still present - verification may be required');
          // Don't throw error - let the flow continue and see what happens
        } else {
          logger.info('Verification challenge resolved - continuing with login flow');
        }
      } else if (currentUrl.includes('/accounts/login/')) {
        // Still on login page - check for error messages
        await this.handleLoginErrors(page);
      } else {
        // Successfully navigated away from login page
        logger.info('Login successful! Navigated away from login page.');
      }
      
      // Handle post-login dialogs
      await this.handlePostLoginDialogs(page);

      // Navigate to reels page
      logger.info('Login successful! Navigating to Instagram Reels...');
      logger.debug('Puppeteer: Executing page.goto() to reels page...');
      await page.goto('https://www.instagram.com/reels/', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      logger.info('Successfully navigated to Instagram Reels');
      await logCurrentSite(page, 'Navigated to reels page');

      // Check again for challenge AFTER navigating to reels (Instagram sometimes shows it here)
      await randomDelay(2000, 3000);
      
      // Check for "Use the app" prompt and dismiss it
      await AppPromptHandler.handleAppPrompt(page);
      
      // Check for suspension after navigating to reels
      const isSuspendedAfterReels = await this.checkForSuspension(page);
      if (isSuspendedAfterReels) {
        const suspensionUrl = page.url();
        logger.error(`⚠️  Account suspended detected after navigating to reels: ${suspensionUrl}`);
        await this.takeLoginErrorScreenshot(page);
        throw new AccountSuspendedError(`Account suspended: ${suspensionUrl}`);
      }
      
      const challengeAfterReels = await this.checkForChallenge(page);
      if (challengeAfterReels) {
        logger.warn('Challenge page detected after navigating to reels - handling verification...');
        // Take screenshot for assessment
        await VerificationHandler.takeScreenshot(page, 'verification_detected_after_reels.png');
        logger.info('Screenshot saved: verification_detected_after_reels.png - Please review to confirm verification is needed');
        
        // Store URL before verification
        const urlBeforeReelsVerification = page.url();
        
        // Attempt verification (user can skip by pressing Enter)
        await VerificationHandler.handleVerificationCode(page, persona);
        
        // Wait and check if challenge resolved
        await randomDelay(2000, 3000);
        const stillNeedsReelsVerification = await this.checkForChallenge(page);
        
        // Only re-navigate if challenge is resolved or URL changed
        if (!stillNeedsReelsVerification || page.url() !== urlBeforeReelsVerification) {
          await page.goto('https://www.instagram.com/reels/', {
            waitUntil: 'networkidle2',
            timeout: 30000
          });
          logger.info('Re-navigated to Instagram Reels after verification');
        } else {
          logger.warn('Challenge still present after verification attempt - continuing anyway');
        }
      }

      return true;
    } catch (error) {
      logger.error(`Login failed: ${error.message}`);
      await this.takeLoginErrorScreenshot(page);
      throw error;
    }
  }

  /**
   * Check if account is suspended
   * @param {Object} page - Puppeteer page object
   * @returns {Promise<boolean>} True if suspension detected
   */
  static async checkForSuspension(page) {
    const currentUrl = page.url();
    
    // Check URL for suspension indicator
    if (currentUrl.includes('/accounts/suspended/')) {
      logger.debug(`Suspension detected in URL: ${currentUrl}`);
      return true;
    }

    // Check page content for suspension indicators
    try {
      const hasSuspension = await page.evaluate(() => {
        const bodyText = (document.body.innerText || '').toLowerCase();
        const pageHTML = document.documentElement.innerHTML.toLowerCase();
        
        // Check for suspension-related text
        const suspensionKeywords = [
          'your account has been suspended',
          'account suspended',
          'suspended account',
          'we suspended your account',
          'this account has been suspended'
        ];

        for (const keyword of suspensionKeywords) {
          if (bodyText.includes(keyword) || pageHTML.includes(keyword)) {
            return true;
          }
        }

        return false;
      });

      if (hasSuspension) {
        logger.debug('Suspension detected in page content');
        return true;
      }
    } catch (e) {
      logger.debug(`Error checking for suspension: ${e.message}`);
    }

    return false;
  }

  /**
   * Check if page requires verification/challenge code
   * Checks both URL and page content for challenge indicators
   * @param {Object} page - Puppeteer page object
   * @returns {Promise<boolean>} True if challenge detected
   */
  static async checkForChallenge(page) {
    const currentUrl = page.url();
    
    // Check URL first - Instagram uses multiple paths for verification
    if (currentUrl.includes('/challenge/') || 
        currentUrl.includes('/auth_platform/codeentry/')) {
      logger.debug(`Challenge detected in URL: ${currentUrl}`);
      return true;
    }

    // Check page content for challenge indicators
    try {
      const hasChallenge = await page.evaluate(() => {
        // Check for common challenge/verification indicators
        const bodyText = (document.body.innerText || '').toLowerCase();
        const pageHTML = document.documentElement.innerHTML.toLowerCase();
        
        // Look for verification code input fields
        const verificationInputs = document.querySelectorAll('input[type="text"]');
        for (const input of verificationInputs) {
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
            (maxLength >= 6 && maxLength <= 8 && (name || placeholder || ariaLabel))
          ) {
            return true;
          }
        }

        // Check for challenge-related text
        const challengeKeywords = [
          'verification code',
          'security code',
          'enter code',
          'confirm it\'s you',
          'help us confirm',
          'two-factor',
          '2fa',
          'authentication code'
        ];

        for (const keyword of challengeKeywords) {
          if (bodyText.includes(keyword) || pageHTML.includes(keyword)) {
            return true;
          }
        }

        // Check for React component indicators (from auth-code-example.txt and actual URL pattern)
        if (pageHTML.includes('authplatformcodeentryview') || 
            pageHTML.includes('authplatformcodeentryroot') ||
            pageHTML.includes('auth_platform/codeentry')) {
          return true;
        }

        return false;
      });

      if (hasChallenge) {
        logger.debug('Challenge detected in page content');
        return true;
      }
    } catch (e) {
      logger.debug(`Error checking for challenge: ${e.message}`);
    }

    return false;
  }

  /**
   * Handle login errors when still on login page
   */
  static async handleLoginErrors(page) {
    logger.debug('Still on login page, checking for error messages...');
    
    // Take screenshot for debugging
    try {
      const testUrl = page.url();
      await page.screenshot({ path: 'login_debug_still_on_page.png', fullPage: true });
      logger.debug('Screenshot saved: login_debug_still_on_page.png');
    } catch (screenshotError) {
      if (screenshotError.message.includes('Not attached') || screenshotError.message.includes('Target closed')) {
        logger.debug('Cannot take debug screenshot: page was detached');
      }
    }
    
    await randomDelay(2000, 3000);
    
    const errorMessage = await page.evaluate(() => {
      const errorSelectors = [
        '[role="alert"]',
        'div[role="alert"]',
        'p[id*="error"]',
        'div[id*="error"]',
        'span[role="alert"]'
      ];
      
      for (const selector of errorSelectors) {
        const errorElement = document.querySelector(selector);
        if (errorElement && errorElement.textContent.trim()) {
          return errorElement.textContent.trim();
        }
      }
      
      const pageText = document.body.innerText || '';
      if (pageText.includes('Sorry, your password was incorrect')) {
        return 'Incorrect password';
      }
      if (pageText.includes('The username you entered doesn\'t belong to an account')) {
        return 'Username not found';
      }
      if (pageText.includes('Please wait a few minutes before you try again')) {
        return 'Too many login attempts. Please wait.';
      }
      
      return null;
    });
    
    if (errorMessage) {
      logger.error(`Login error detected: ${errorMessage}`);
      throw new Error(`Login failed: ${errorMessage}`);
    } else {
      // Check if page is actually loading
      const isLoading = await page.evaluate(() => {
        return document.querySelector('svg[aria-label="Loading"]') !== null ||
               document.querySelector('[aria-busy="true"]') !== null;
      });
      
      if (isLoading) {
        logger.debug('Page appears to be loading, waiting longer...');
        await randomDelay(5000, 7000);
        const finalUrl = page.url();
        if (!finalUrl.includes('/accounts/login/')) {
          logger.info('Login succeeded after additional wait');
        } else {
          throw new Error('Login failed: Still on login page after extended wait. Check credentials or try again later.');
        }
      } else {
        throw new Error('Login failed: Still on login page. Check credentials.');
      }
    }
  }

  /**
   * Handle post-login dialogs (Save Login Info, Notifications)
   */
  static async handlePostLoginDialogs(page) {
    // Handle "Save Your Login Info" dialog
    logger.debug('Checking for "Save Login Info" dialog...');
    await randomDelay(2000, 3000);
    try {
      const clicked = await Clicking.clickButtonByExactText(page, 'Not Now', 5000);
      if (clicked) {
        logger.debug('Clicked "Not Now" on Save Login Info dialog');
        await randomDelay(1000, 2000);
      }
    } catch (e) {
      logger.debug('No "Save Login Info" dialog found');
    }

    // Handle "Turn on Notifications" dialog
    logger.debug('Checking for "Turn on Notifications" dialog...');
    try {
      const clickedNotif = await Clicking.clickButtonByExactText(page, 'Not Now', 5000);
      if (clickedNotif) {
        logger.debug('Clicked "Not Now" on Notifications dialog');
        await randomDelay(1000, 2000);
      }
    } catch (e) {
      logger.debug('No Notifications dialog found');
    }
  }

  /**
   * Take screenshot on login error
   */
  static async takeLoginErrorScreenshot(page) {
    try {
      const testUrl = page.url();
      await page.screenshot({ path: 'login_error.png', fullPage: true });
      logger.error('Screenshot saved to login_error.png');
    } catch (screenshotError) {
      if (screenshotError.message.includes('Not attached') || screenshotError.message.includes('Target closed')) {
        logger.debug('Cannot take login error screenshot: page was detached');
      }
    }
  }
}

module.exports = LoginFlow;
module.exports.AccountSuspendedError = AccountSuspendedError;

