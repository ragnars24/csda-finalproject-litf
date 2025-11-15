/**
 * EngagementStrategy - Determines engagement actions based on persona configuration
 */
class EngagementStrategy {
  /**
   * Determine if post should be liked
   * Supports configuration via persona.engagement.likes.enabled (boolean) or
   * persona.engagement.likes.probability (0.0 to 1.0)
   * @param {Object} persona - Persona configuration
   * @returns {boolean} True if post should be liked
   */
  static shouldLike(persona) {
    // Check if liking is explicitly disabled in persona config
    if (persona.engagement?.likes?.enabled === false) {
      return false;
    }
    
    // Use configured probability if provided, otherwise default to 15%
    const probability = persona.engagement?.likes?.probability ?? 
                        (persona.engagement?.likes?.enabled === true ? 1.0 : 0.15);
    
    // If probability is 0, never like. If 1, always like. Otherwise random.
    if (probability === 0) return false;
    if (probability === 1) return true;
    return Math.random() < probability;
  }

  /**
   * Determine if post should be commented on
   * @param {Object} persona - Persona configuration
   * @returns {boolean} True if post should be commented on
   */
  static shouldComment(persona) {
    if (persona.engagement?.comments?.enabled === false) {
      return false;
    }
    
    const probability = persona.engagement?.comments?.probability ?? 
                        (persona.engagement?.comments?.enabled === true ? 1.0 : 0.05);
    
    if (probability === 0) return false;
    if (probability === 1) return true;
    return Math.random() < probability;
  }

  /**
   * Determine if post should be shared
   * @param {Object} persona - Persona configuration
   * @returns {boolean} True if post should be shared
   */
  static shouldShare(persona) {
    if (persona.engagement?.shares?.enabled === false) {
      return false;
    }
    
    const probability = persona.engagement?.shares?.probability ?? 
                        (persona.engagement?.shares?.enabled === true ? 1.0 : 0.02);
    
    if (probability === 0) return false;
    if (probability === 1) return true;
    return Math.random() < probability;
  }

  /**
   * Get watch duration for a reel based on persona settings
   * @param {Object} persona - Persona configuration
   * @returns {number} Watch duration in milliseconds
   */
  static getWatchDuration(persona) {
    const watchConfig = persona.engagement?.watch?.duration_seconds;
    if (watchConfig) {
      const min = (watchConfig.min || 4) * 1000;
      const max = (watchConfig.max || 6) * 1000;
      return min + Math.random() * (max - min);
    }
    // Default: 4-6 seconds
    return 4000 + Math.random() * 2000;
  }
}

module.exports = EngagementStrategy;

