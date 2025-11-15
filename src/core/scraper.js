const { createLogger } = require('../utils/logger');
const logger = createLogger('Scraper');
const { randomDelay } = require('../utils/random');
const BrowserFactory = require('../browser/browser-factory');
const BrowserLifecycle = require('../browser/browser-lifecycle');
const NetworkInterceptor = require('../network/request-interceptor');
const GraphQLHandler = require('../network/graphql-handler');
const BandwidthOptimizer = require('../network/bandwidth-optimizer');
const ReelNavigator = require('../browser/reel-navigator');
const DOMExtractor = require('../extraction/dom-extractor');
const ReelCollector = require('../extraction/reel-collector');
const LoginFlow = require('../services/login-flow');
const AppPromptHandler = require('../services/app-prompt-handler');
const LikeHandler = require('../services/like-handler');
const EngagementStrategy = require('../services/engagement-strategy');
const ScreenshotHandler = require('../browser/screenshot-handler');
const CookieSessionCapture = require('../services/cookie-session-capture');
const { logCurrentSite } = require('../services/auth-utils');
const { AccountSuspendedError } = require('../services/login-flow');

/**
 * InstagramReelsScraper - Main scraper orchestrator
 * Coordinates all components to scrape Instagram Reels
 */
class InstagramReelsScraper {
  constructor(persona, proxyConfig = null, storage = null, headless = true, blockMediaTypes = null) {
    this.persona = persona;
    this.proxyConfig = proxyConfig;
    this.storage = storage;
    this.headless = headless;
    this.blockMediaTypes = blockMediaTypes;
    this.browser = null;
    this.page = null;
    this.lifecycle = null;
    this.reelCollector = new ReelCollector();
    this.reelNavigator = null;
    this.likeHandler = null;
    this.screenshotHandler = null;
    this.cookieCapture = null;
    this.screenshotDir = './screenshots';
  }

  /**
   * Initialize browser with stealth and proxy configuration
   */
  async initialize() {
    logger.info(`Initializing scraper for ${this.persona.persona_id}`);
    logger.debug(`Persona details: region=${this.persona.region}, spectrum=${this.persona.political_spectrum}`);

    logger.info('  → BrowserFactory - Launching browser...');
    const { browser, page } = await BrowserFactory.launch({
      persona: this.persona,
      proxyConfig: this.proxyConfig,
      headless: this.headless
    });

    this.browser = browser;
    this.page = page;
    logger.info('  ✓ BrowserFactory - Browser launched');
    
    logger.info('  → BrowserLifecycle - Initializing lifecycle manager...');
    this.lifecycle = new BrowserLifecycle(browser, page);
    logger.info('  ✓ BrowserLifecycle - Lifecycle manager ready');
    
    logger.info('  → ReelNavigator - Initializing navigation handler...');
    this.reelNavigator = new ReelNavigator(page);
    logger.info('  ✓ ReelNavigator - Navigation handler ready');
    
    logger.info('  → LikeHandler - Initializing engagement handler...');
    this.likeHandler = new LikeHandler(page, this.persona);
    logger.info('  ✓ LikeHandler - Engagement handler ready');
    
    logger.info('  → ScreenshotHandler - Initializing screenshot handler...');
    this.screenshotHandler = new ScreenshotHandler(page, this.persona, this.screenshotDir);
    logger.info('  ✓ ScreenshotHandler - Screenshot handler ready');

    // Set up cookie capture
    logger.info('  → CookieSessionCapture - Initializing cookie tracking...');
    this.cookieCapture = new CookieSessionCapture(this.persona);
    logger.info('  ✓ CookieSessionCapture - Cookie tracking ready');

    // Set up network interception
    logger.info('  → GraphQLHandler - Initializing GraphQL response processor...');
    const graphqlHandler = new GraphQLHandler(this.storage, this.persona, this.reelCollector);
    logger.info('  ✓ GraphQLHandler - GraphQL processor ready');
    
    logger.info('  → RequestInterceptor - Setting up network interception...');
    const networkInterceptor = new NetworkInterceptor(page, this.storage, this.persona, graphqlHandler);
    networkInterceptor.setup();
    logger.info('  ✓ RequestInterceptor - Network interception active');

    // Set up bandwidth optimization
    logger.info('  → BandwidthOptimizer - Configuring resource blocking...');
    const bandwidthOptimizer = new BandwidthOptimizer(page, this.blockMediaTypes);
    logger.debug(`BandwidthOptimizer initialized with blockMediaTypes: ${this.blockMediaTypes === null ? 'null (using defaults)' : JSON.stringify(this.blockMediaTypes)}`);
    bandwidthOptimizer.setup();
    logger.info('  ✓ BandwidthOptimizer - Resource blocking configured');

    logger.info('Browser initialized successfully');
    await logCurrentSite(this.page, 'Browser initialized');
  }

  /**
   * Login to Instagram using the login flow module
   */
  async login() {
    // Capture cookies before login
    if (this.cookieCapture) {
      await this.cookieCapture.captureCookies(this.page, 'pre-login');
    }
    
    const result = await LoginFlow.handleLogin(this.page, this.persona);
    
    // Capture cookies after login
    if (this.cookieCapture) {
      await this.cookieCapture.captureCookies(this.page, 'post-login');
    }
    
    return result;
  }

  /**
   * Scrape reels feed with retry logic and auto pagination
   * @param {number} reelsToCollect - Number of reels to collect
   * @returns {Promise<Array>} Array of collected reel data
   */
  async scrapeReelsFeed(reelsToCollect = 100) {
    logger.info(`Scraping reels feed (target: ${reelsToCollect} reels)`);

    // Capture cookies before scraping
    if (this.cookieCapture) {
      await this.cookieCapture.captureCookies(this.page, 'pre-scraping');
    }

    try {
      // Check if we're already on a reel page
      let currentUrl = this.page.url();
      let isAlreadyOnReel = currentUrl.includes('/reel/') || 
                           (currentUrl.includes('/reels/') && currentUrl !== 'https://www.instagram.com/reels/');
      
      if (!isAlreadyOnReel) {
        await this.reelNavigator.navigateToReelsFeed();
        currentUrl = this.page.url();
        isAlreadyOnReel = currentUrl.includes('/reel/') || 
                         (currentUrl.includes('/reels/') && currentUrl !== 'https://www.instagram.com/reels/');
      } else {
        logger.debug('Already on a reel page from previous navigation, skipping reels feed navigation');
        await logCurrentSite(this.page, 'Already viewing reel');
        await randomDelay(3000, 5000);
      }
      
      // If we're on a reel page, proceed directly to extraction
      if (!isAlreadyOnReel) {
        const clicked = await this.reelNavigator.clickFirstReel();
        if (!clicked) {
          logger.warn('No reels found on the page');
          return [];
        }
      } else {
        logger.debug('Already on a reel page, proceeding directly to extraction');
      }

      // Ensure focus is on the reel viewer
      try {
        const videoEl = await this.page.$('video');
        if (videoEl) {
          await videoEl.click();
        } else {
          await this.page.focus('body');
        }
        await randomDelay(200, 400);
      } catch (e) {
        logger.debug('Could not explicitly focus reel viewer');
      }
      
      const reels = [];
      let reelsCollected = 0;
      let navigationFailures = 0;
      let consecutiveNavigationFailures = 0;
      const maxFailures = 5;
      const maxConsecutiveNavigationFailures = 3;
      
      // Reset network collection tracking
      this.reelCollector.clear();

      // Scrape reels by navigating through them
      while (reelsCollected < reelsToCollect && 
             navigationFailures < maxFailures && 
             consecutiveNavigationFailures < maxConsecutiveNavigationFailures) {
        try {
          logger.debug(`Processing reel ${reelsCollected + 1}/${reelsToCollect}...`);
          
          // Wait for reel content to load
          await randomDelay(2000, 3000);
          
          // Verify we're still on a reel page
          const isOnReelPage = await this.reelNavigator.isOnReelPage();
          if (!isOnReelPage) {
            // Check for "Use the app" prompt first
            await AppPromptHandler.handleAppPrompt(this.page);
            
            // Check for suspension before attempting recovery
            const isSuspended = await LoginFlow.checkForSuspension(this.page);
            if (isSuspended) {
              const suspensionUrl = this.page.url();
              logger.error(`⚠️  Account suspended detected during scraping: ${suspensionUrl}`);
              throw new AccountSuspendedError(`Account suspended during scraping: ${suspensionUrl}`);
            }
            
            logger.warn(`No longer on a reel page, attempting recovery...`);
            try {
              await this.reelNavigator.navigateToReelsFeed();
              await randomDelay(3000, 5000);
              consecutiveNavigationFailures++;
              continue;
            } catch (recoveryError) {
              logger.error(`Failed to recover to reels page: ${recoveryError.message}`);
              navigationFailures++;
              break;
            }
          }
          
          // Check for app prompt periodically during scraping
          if (reelsCollected % 5 === 0) {
            await AppPromptHandler.handleAppPrompt(this.page);
          }
          
          // Check if we have new reel data from network interception
          const currentReelId = this.reelNavigator.getCurrentReelId();
          logger.debug(`Current reel ID from URL: ${currentReelId || 'none'}`);
          logger.debug(`Network cache has ${this.reelCollector.size()} reels stored`);
          
          let reelData = null;
          
          // Wait for network interception to capture data
          if (currentReelId && !this.reelCollector.hasReel(currentReelId)) {
            logger.debug('Waiting for network interception to capture reel data...');
            for (let i = 0; i < 10; i++) {
              const waitTime = Math.min(300 + (i * 100), 1000);
              await randomDelay(waitTime, waitTime + 200);
              if (this.reelCollector.hasReel(currentReelId)) {
                logger.debug(` Network data captured after ${((i + 1) * waitTime).toFixed(0)}ms`);
                break;
              }
            }
          }
          
          // Wait before taking screenshot
          const screenshotDelay = 1500 + Math.random() * 1500;
          logger.debug(`Waiting ${(screenshotDelay / 1000).toFixed(1)}s before taking screenshot...`);
          await randomDelay(screenshotDelay, screenshotDelay + 200);
          
          // Take screenshot of current reel
          let screenshotPath = null;
          if (currentReelId) {
            try {
              screenshotPath = await this.screenshotHandler.takeReelScreenshot(currentReelId);
              if (screenshotPath) {
                logger.debug(`Screenshot captured: ${screenshotPath}`);
              }
            } catch (screenshotError) {
              logger.warn(`Failed to take screenshot: ${screenshotError.message}`);
            }
          }
          
          // Get reel data from network or DOM
          if (currentReelId && this.reelCollector.hasReel(currentReelId)) {
            reelData = this.reelCollector.getReel(currentReelId);
            logger.debug(` Reel data from network: ${reelData.post_id} by @${reelData.author_username || 'unknown'}`);
          } else {
            logger.debug('Network data not available for current URL, falling back to DOM extraction...');
            try {
              reelData = await DOMExtractor.extractReelData(this.page);
              if (reelData && reelData.post_id) {
                logger.debug(` Reel data from DOM: ${reelData.post_id}`);
                this.reelCollector.addReel(reelData);
              }
            } catch (extractError) {
              logger.debug(`DOM extraction failed: ${extractError.message}`);
            }
          }
          
          // Add screenshot path to reel data
          if (reelData && screenshotPath) {
            reelData.screenshot_path = screenshotPath;
          } else if (reelData) {
            reelData.screenshot_path = '';
          }
          
          // Process any network-captured reels that haven't been saved yet
          if (this.reelCollector.size() > 0 && reelsCollected < reelsToCollect) {
            const unsavedReels = [];
            for (const capturedReel of this.reelCollector.getAllReels()) {
              if (!reels.find(r => r.post_id === capturedReel.post_id)) {
                unsavedReels.push(capturedReel);
              }
            }
            
            const maxUnsavedToProcess = Math.min(3, reelsToCollect - reelsCollected);
            if (unsavedReels.length > 0 && unsavedReels.length <= maxUnsavedToProcess) {
              logger.debug(`Processing ${unsavedReels.length} unsaved network-captured reel(s)...`);
              for (const unsavedReel of unsavedReels) {
                if (this.storage && unsavedReel.post_id && reelsCollected < reelsToCollect) {
                  try {
                    if (!unsavedReel.screenshot_path) {
                      unsavedReel.screenshot_path = '';
                    }
                    const saved = this.storage.savePost(this.persona, 'reels', unsavedReel);
                    if (saved) {
                      reels.push(unsavedReel);
                      reelsCollected++;
                      logger.info(` Saved network-captured reel: ${unsavedReel.post_id} by @${unsavedReel.author_username || 'unknown'}`);
                    } else {
                      logger.debug(` Skipped duplicate network-captured reel: ${unsavedReel.post_id}`);
                    }
                  } catch (saveError) {
                    logger.debug(`Failed to save network-captured reel ${unsavedReel.post_id}: ${saveError.message}`);
                  }
                }
              }
            }
          }
          
          if (reelData && reelData.post_id) {
            // Avoid duplicates (check both in-memory and CSV)
            if (!reels.find(r => r.post_id === reelData.post_id)) {
              reels.push(reelData);
              logger.info(` Reel collected: ${reelData.post_id} by @${reelData.author_username || 'unknown'}`);
              
              // Save to CSV (will check for duplicates in CSV)
              let saved = false;
              if (this.storage) {
                try {
                  saved = this.storage.savePost(this.persona, 'reels', reelData);
                  if (saved) {
                    logger.debug(` CSV save completed for reel ${reelData.post_id}`);
                  } else {
                    logger.debug(` Skipped duplicate in CSV: ${reelData.post_id}`);
                  }
                } catch (saveError) {
                  logger.error(`Failed to save reel ${reelData.post_id} to CSV: ${saveError.message}`);
                }
              }
              
              // Only count and process if actually saved (not a duplicate)
              if (saved) {
                // Maybe like the reel
                if (this.likeHandler.shouldLikePost()) {
                  logger.debug(`Liking reel ${reelData.post_id}`);
                  await this.likeHandler.likeReel();
                }
                
                reelsCollected++;
                navigationFailures = 0;
                consecutiveNavigationFailures = 0;
                
                // Simulate watching the reel
                const watchDuration = EngagementStrategy.getWatchDuration(this.persona);
                logger.debug(`Watching reel (${(watchDuration / 1000).toFixed(1)}s)...`);
                await randomDelay(watchDuration, watchDuration + 500);
              } else {
                // Duplicate found in CSV - still count as processed but don't increment collection count
                logger.debug(`Duplicate post ${reelData.post_id} already in CSV, skipping processing`);
                navigationFailures = 0; // Don't count as failure
              }
            } else {
              logger.debug(`Reel ${reelData.post_id} already collected in this session, skipping`);
            }
          } else {
            logger.warn(`Failed to extract reel data for URL: ${currentReelId || 'unknown'}`);
            navigationFailures++;
          }
          
          // Navigate to next reel
          if (reelsCollected < reelsToCollect) {
            logger.debug('Navigating to next reel...');
            const navigated = await this.reelNavigator.navigateToNextReel(3);
            
            if (!navigated) {
              logger.warn('Failed to navigate to next reel - will retry with backoff');
              consecutiveNavigationFailures++;
              navigationFailures++;
              
              if (consecutiveNavigationFailures < maxConsecutiveNavigationFailures) {
                const baseDelay = 2000;
                const exponentialDelay = baseDelay * Math.pow(2, consecutiveNavigationFailures - 1);
                const maxDelay = 15000;
                const delay = Math.min(exponentialDelay, maxDelay);
                const jitter = Math.random() * 2000;
                const finalDelay = delay + jitter;
                
                logger.debug(`Retrying navigation after ${(finalDelay / 1000).toFixed(1)}s...`);
                await randomDelay(finalDelay, finalDelay + 1000);
                
                const retryNavigated = await this.reelNavigator.navigateToNextReel(5);
                if (retryNavigated) {
                  logger.info(` Navigation succeeded after retry`);
                  consecutiveNavigationFailures = 0;
                  navigationFailures = Math.max(0, navigationFailures - 1);
                  await randomDelay(3000, 5000);
                }
              }
            } else {
              consecutiveNavigationFailures = 0;
              await randomDelay(2000, 3500);
            }
          }
        } catch (error) {
          logger.error(`Error processing reel: ${error.message}`);
          navigationFailures++;
          consecutiveNavigationFailures++;
          
          if (consecutiveNavigationFailures < maxConsecutiveNavigationFailures) {
            logger.debug('Attempting navigation recovery after error...');
            try {
              await this.reelNavigator.navigateToNextReel(2);
              await randomDelay(2000, 3000);
            } catch (navError) {
              logger.debug(`Navigation recovery failed: ${navError.message}`);
            }
          }
          
          if (navigationFailures < maxFailures) {
            await randomDelay(2000, 4000);
          }
        }
      }
      
      // Log summary
      logger.info(`📊 Collection Summary:`);
      logger.info(`   - Network interception captured: ${this.reelCollector.getNetworkReels().length} reels`);
      logger.info(`   - Total reels collected: ${reels.length}`);
      logger.info(`   - Network cache size: ${this.reelCollector.size()} unique reels`);
      
      if (navigationFailures >= maxFailures) {
        logger.warn(`Stopped scraping after ${maxFailures} consecutive failures`);
      }
      
      // Capture cookies after scraping
      if (this.cookieCapture) {
        await this.cookieCapture.captureCookies(this.page, 'post-scraping');
        this.cookieCapture.logCookieStats();
      }
      
      logger.info(` Collected ${reels.length} reels from reels feed`);
      return reels;
    } catch (error) {
      // Capture cookies even on error
      if (this.cookieCapture) {
        try {
          await this.cookieCapture.captureCookies(this.page, 'error');
        } catch (cookieError) {
          logger.debug(`Failed to capture cookies on error: ${cookieError.message}`);
        }
      }
      logger.error(`Reels feed scraping failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close browser
   */
  async close() {
    if (this.lifecycle) {
      await this.lifecycle.close();
    }
  }
}

module.exports = InstagramReelsScraper;

