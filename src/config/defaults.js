/**
 * Default Settings Configuration
 * 
 * Centralized location for all default settings used throughout the application.
 * Modify these values to change default behavior.
 */

module.exports = {
  /**
   * Browser Settings
   */
  browser: {
    /**
     * Default headless mode
     * - true: Run browser in headless mode (no visible window)
     * - false: Run browser with visible window
     */
    headless: true,

    /**
     * Default viewport dimensions
     */
    viewport: {
      width: 1280,
      height: 800
    }
  },

  /**
   * Proxy Settings
   */
  proxy: {
    /**
     * Default proxy usage
     * - true: Use proxy if configured in persona
     * - false: Disable proxy usage
     */
    enabled: false
  },

  /**
   * Bandwidth Optimization Settings
   */
  bandwidth: {
    /**
     * Default media types to block for bandwidth optimization
     * Set to null to use default blocking, empty array [] to block nothing
     * 
     * Valid resource types:
     * - 'image': Images
     * - 'stylesheet': CSS files
     * - 'font': Font files
     * - 'media': Video/audio files
     * - 'script': JavaScript files (use with caution)
     * - 'document': HTML documents (use with caution)
     * - 'xhr': XMLHttpRequest
     * - 'fetch': Fetch requests
     * - 'websocket': WebSocket connections
     * - 'manifest': Web app manifests
     * - 'texttrack': Video text tracks
     * - 'other': Other resource types
     */
    blockMediaTypes: []
  },

  /**
   * Scraping Settings
   */
  scraping: {
    /**
     * Default number of reels to scrape per session
     */
    reelsPerSession: 30,

    /**
     * Delay between personas (in milliseconds)
     */
    delayBetweenPersonas: 60000, // 1 minute

    /**
     * Cooldown period after account suspension (in milliseconds)
     * When an account is suspended, wait this long before moving to next persona
     */
    suspensionCooldown: 300000 // 5 minutes
  },

  /**
   * Verification Settings
   */
  verification: {
    /**
     * Timeout for verification code input (in milliseconds)
     */
    inputTimeout: 2000,

    /**
     * Timeout for submit button detection (in milliseconds)
     */
    submitTimeout: 2000,

    /**
     * Timeout for navigation after verification (in milliseconds)
     */
    navigationTimeout: 30000
  }
};

