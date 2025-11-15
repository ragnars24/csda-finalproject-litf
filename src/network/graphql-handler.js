const { createLogger } = require('../utils/logger');
const logger = createLogger('GraphQLHandler');
const GraphQLExtractor = require('../extraction/graphql-extractor');

/**
 * GraphQLHandler - Processes GraphQL responses to extract reel data
 */
class GraphQLHandler {
  constructor(storage, persona, reelCollector) {
    this.storage = storage;
    this.persona = persona;
    this.reelCollector = reelCollector;
  }

  /**
   * Process a GraphQL response and extract reel data
   * @param {Object} parsedData - Parsed GraphQL response data
   * @param {string} url - Request URL
   * @param {string} method - HTTP method
   */
  processGraphQLResponse(parsedData, url, method) {
    if (!parsedData || !parsedData.data) {
      return;
    }

    // Structure 1: Reels feed connection (multiple reels)
    if (parsedData.data.xdt_api__v1__clips__home__connection_v2) {
      const edges = parsedData.data.xdt_api__v1__clips__home__connection_v2.edges || [];
      
      for (const edge of edges) {
        const media = edge.node?.media;
        if (media) {
          // Save raw data packet for analysis
          if (this.storage) {
            this.storage.saveRawPacket(this.persona, url, method, media);
          }
          
          const reelData = GraphQLExtractor.extractReelFromGraphQLItem(media);
          
          if (reelData && reelData.post_id) {
            if (this.reelCollector) {
              this.reelCollector.addReel(reelData);
            }
          }
        }
      }
    }
    // Structure 2: Single reel via shortcode (when viewing individual reel)
    else if (parsedData.data.xdt_shortcode_media || parsedData.data.shortcode_media) {
      const mediaItem = parsedData.data.xdt_shortcode_media || parsedData.data.shortcode_media;
      
      // Save raw data packet for analysis
      if (this.storage && mediaItem) {
        this.storage.saveRawPacket(this.persona, url, method, mediaItem);
      }
      
      const reelData = GraphQLExtractor.extractReelFromGraphQL(parsedData);
      if (reelData && reelData.post_id) {
        if (this.reelCollector) {
          this.reelCollector.addReel(reelData);
        }
      }
    }
    // Structure 3: Check for any nested media objects with XDTMediaDict type
    else if (parsedData.data && typeof parsedData.data === 'object') {
      // Deep search for media objects (Instagram may nest them differently)
      const mediaObjects = this.findMediaObjects(parsedData.data);
      
      for (const media of mediaObjects) {
        if (this.storage) {
          this.storage.saveRawPacket(this.persona, url, method, media);
        }
        
        const reelData = GraphQLExtractor.extractReelFromGraphQLItem(media);
        
        if (reelData && reelData.post_id) {
          if (this.reelCollector) {
            this.reelCollector.addReel(reelData);
          }
        }
      }
    }
  }

  /**
   * Deep search for media objects in nested GraphQL structure
   * @param {Object} obj - Object to search
   * @param {number} depth - Current recursion depth
   * @returns {Array} Array of media objects found
   */
  findMediaObjects(obj, depth = 0) {
    if (depth > 5) return []; // Limit recursion depth
    if (!obj || typeof obj !== 'object') return [];
    
    const results = [];
    
    // Check if this is a media object
    if (obj.__typename === 'XDTMediaDict' || obj.code || obj.shortcode || obj.pk) {
      if (obj.product_type === 'clips' || obj.media_type === 2) {
        results.push(obj);
      }
    }
    
    // Recursively search nested objects
    for (const key in obj) {
      if (Array.isArray(obj[key])) {
        obj[key].forEach(item => {
          results.push(...this.findMediaObjects(item, depth + 1));
        });
      } else if (obj[key] && typeof obj[key] === 'object') {
        results.push(...this.findMediaObjects(obj[key], depth + 1));
      }
    }
    
    return results;
  }
}

module.exports = GraphQLHandler;

