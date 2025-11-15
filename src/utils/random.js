/**
 * Random delay utilities for simulating human behavior
 */
class Delays {
  /**
   * Random delay to simulate human behavior
   * @param {number} min - Minimum delay in milliseconds
   * @param {number} max - Maximum delay in milliseconds
   * @returns {Promise<void>}
   */
  static async randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Short delay (100-500ms)
   * @returns {Promise<void>}
   */
  static async shortDelay() {
    return this.randomDelay(100, 500);
  }

  /**
   * Medium delay (500-2000ms)
   * @returns {Promise<void>}
   */
  static async mediumDelay() {
    return this.randomDelay(500, 2000);
  }

  /**
   * Long delay (2000-5000ms)
   * @returns {Promise<void>}
   */
  static async longDelay() {
    return this.randomDelay(2000, 5000);
  }

  /**
   * Delay based on persona engagement settings
   * @param {Object} persona - Persona configuration
   * @param {string} action - Action type (e.g., 'likes', 'comments')
   * @returns {Promise<void>}
   */
  static async engagementDelay(persona, action) {
    const delayConfig = persona?.engagement?.[action]?.delay_seconds;
    if (delayConfig) {
      const min = (delayConfig.min || 2) * 1000;
      const max = (delayConfig.max || 5) * 1000;
      return this.randomDelay(min, max);
    }
    // Default delay
    return this.randomDelay(2000, 5000);
  }
}

// Export both the class and a convenience function
module.exports = Delays;
module.exports.randomDelay = Delays.randomDelay.bind(Delays);


