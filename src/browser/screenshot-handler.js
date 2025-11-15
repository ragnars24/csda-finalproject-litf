const fs = require('fs');
const path = require('path');
const { createLogger } = require('../utils/logger');
const logger = createLogger('ScreenshotHandler');
const { randomDelay } = require('../utils/random');

/**
 * ScreenshotHandler - Handles taking screenshots of reels
 */
class ScreenshotHandler {
  constructor(page, persona, screenshotDir = './screenshots') {
    this.page = page;
    this.persona = persona;
    // Resolve to absolute path to avoid issues with working directory changes
    this.screenshotDir = path.isAbsolute(screenshotDir) 
      ? screenshotDir 
      : path.resolve(process.cwd(), screenshotDir);
  }

  /**
   * Take a screenshot of the current reel
   * @param {string} reelId - The reel ID (shortcode)
   * @returns {Promise<string|null>} Relative path to screenshot file, or null if failed
   */
  async takeReelScreenshot(reelId) {
    if (!reelId) {
      logger.warn('Cannot take screenshot: missing reel ID');
      return null;
    }

    try {
      // Check if page is still attached and available
      if (!this.page) {
        logger.warn(`Cannot take screenshot: page is not available`);
        return null;
      }

      // Try to access page properties to verify it's still attached
      let currentUrl;
      try {
        currentUrl = this.page.url();
      } catch (urlError) {
        if (urlError.message.includes('Target closed') || urlError.message.includes('Session closed') || urlError.message.includes('Not attached')) {
          logger.warn(`Cannot take screenshot: page is detached`);
          return null;
        }
        throw urlError;
      }

      // Verify we're still on a reel page before taking screenshot
      if (!currentUrl.includes('instagram.com') || (!currentUrl.includes('/reel/') && !currentUrl.includes('/reels/'))) {
        logger.warn(`Cannot take screenshot: not on a reel page (URL: ${currentUrl})`);
        return null;
      }

      // Create persona-specific screenshot directory
      const personaScreenshotDir = path.join(this.screenshotDir, this.persona.persona_id);
      try {
        if (!fs.existsSync(personaScreenshotDir)) {
          fs.mkdirSync(personaScreenshotDir, { recursive: true });
          logger.debug(`Created screenshot directory: ${personaScreenshotDir}`);
        }
      } catch (dirError) {
        logger.error(`Failed to create screenshot directory ${personaScreenshotDir}: ${dirError.message}`);
        return null;
      }

      // Generate screenshot filename
      const screenshotFilename = `${reelId}.png`;
      const screenshotPath = path.join(personaScreenshotDir, screenshotFilename);
      
      logger.debug(`Attempting to take screenshot: ${screenshotPath}`);

      // Take full-page screenshot with timeout
      try {
        await Promise.race([
          this.page.screenshot({
            path: screenshotPath,
            fullPage: true
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Screenshot timeout')), 10000)
          )
        ]);
      } catch (screenshotError) {
        logger.error(`Screenshot capture failed for ${reelId}: ${screenshotError.message}`);
        throw screenshotError; // Re-throw to be caught by outer catch
      }

      // Verify the screenshot file was actually created
      if (!fs.existsSync(screenshotPath)) {
        logger.error(`Screenshot file was not created at ${screenshotPath} (absolute: ${path.resolve(screenshotPath)})`);
        return null;
      }

      // Verify the file has content (not empty)
      let stats;
      try {
        stats = fs.statSync(screenshotPath);
      } catch (statError) {
        logger.error(`Failed to stat screenshot file ${screenshotPath}: ${statError.message}`);
        return null;
      }
      
      if (stats.size === 0) {
        logger.error(`Screenshot file is empty at ${screenshotPath}`);
        try {
          fs.unlinkSync(screenshotPath); // Remove empty file
        } catch (unlinkError) {
          logger.debug(`Failed to remove empty screenshot file: ${unlinkError.message}`);
        }
        return null;
      }

      // Return relative path for CSV storage
      const relativePath = `screenshots/${this.persona.persona_id}/${screenshotFilename}`;
      logger.info(`✓ Screenshot saved successfully: ${relativePath} (${(stats.size / 1024).toFixed(1)}KB)`);
      return relativePath;
    } catch (error) {
      if (error.message.includes('Not attached') || error.message.includes('Target closed') || error.message.includes('Session closed')) {
        logger.warn(`Failed to take screenshot for reel ${reelId}: page was detached or closed`);
      } else {
        logger.warn(`Failed to take screenshot for reel ${reelId}: ${error.message}`);
      }
      return null;
    }
  }
}

module.exports = ScreenshotHandler;

