const { createLogger } = require('../utils/logger');
const logger = createLogger('GraphQLExtractor');
const HashtagExtractor = require('../utils/hashtag-extractor');

/**
 * GraphQLExtractor - Extracts reel data from GraphQL API responses
 */
class GraphQLExtractor {
  /**
   * Extract reel data directly from a media item object
   * @param {Object} items - Media item object from GraphQL
   * @returns {Object|null} Extracted reel data or null
   */
  static extractReelFromGraphQLItem(items) {
    if (!items) {
      return null;
    }
    return this.extractReelDataFromItem(items);
  }

  /**
   * Extract reel data from a single item object
   * This is the core extraction logic shared by both methods
   * @param {Object} items - Media item object
   * @returns {Object|null} Extracted reel data or null
   */
  static extractReelDataFromItem(items) {
    try {
      const reelData = {
        post_id: items.shortcode || items.code || null,
        author_username: items.owner?.username || items.user?.username || null,
        caption: items.edge_media_to_caption?.edges?.[0]?.node?.text || 
                 items.caption?.text || 
                 items.caption || null,
        hashtags: [],
        hashtag_metadata: [],
        likes_count: items.edge_media_preview_like?.count || 
                    items.like_count || 
                    items.edge_liked_by?.count || 0,
        comments_count: items.edge_media_to_comment?.count || 
                       items.comment_count || 0,
        view_count: items.video_view_count || 
                   items.video_play_count || 
                   items.view_count || 
                   items.play_count || 0,
        media_type: 'reel',
        video_url: items.video_versions?.[0]?.url || items.video_url || null,
        thumbnail_url: items.thumbnail_src || 
                       items.display_url || 
                       items.image_versions2?.candidates?.[0]?.url ||
                       items.display_resources?.[0]?.src || null,
        created_at: items.taken_at_timestamp || items.taken_at || null
      };

      // Enhanced hashtag extraction from multiple GraphQL structures
      const hashtagResult = HashtagExtractor.extractFromGraphQL(items);
      reelData.hashtags = hashtagResult.hashtags;
      reelData.hashtag_metadata = hashtagResult.metadata;

      return reelData.post_id ? reelData : null;
    } catch (error) {
      logger.debug(`Failed to extract reel from item: ${error.message}`);
      return null;
    }
  }

  /**
   * Extract reel data from GraphQL API response
   * Based on Instagram's GraphQL structure for reels
   * @param {Object} data - GraphQL response data
   * @returns {Object|null} Extracted reel data or null
   */
  static extractReelFromGraphQL(data) {
    try {
      // Try different GraphQL response structures for reels
      let items = null;
      
      // Structure 1: xdt_shortcode_media (GraphQL v2) - single reel
      if (data?.data?.xdt_shortcode_media) {
        items = data.data.xdt_shortcode_media;
      }
      // Structure 2: shortcode_media (GraphQL v1) - single reel
      else if (data?.data?.shortcode_media) {
        items = data.data.shortcode_media;
      }
      // Structure 3: clips home connection (reels feed)
      else if (data?.data?.xdt_api__v1__clips__home__connection_v2?.edges) {
        const edges = data.data.xdt_api__v1__clips__home__connection_v2.edges;
        if (edges.length > 0 && edges[0].node?.media) {
          items = edges[0].node.media;
        }
      }
      // Structure 4: clips user connection (user reels)
      else if (data?.data?.xdt_api__v1__clips__user__connection_v2?.edges) {
        const edges = data.data.xdt_api__v1__clips__user__connection_v2.edges;
        if (edges.length > 0 && edges[0].node?.media) {
          items = edges[0].node.media;
        }
      }
      // Structure 5: items array (feed responses)
      else if (data?.items && Array.isArray(data.items)) {
        items = data.items[0];
      }
      // Structure 6: nested items
      else if (data?.data?.items && Array.isArray(data.data.items)) {
        items = data.data.items[0];
      }

      if (!items) {
        return null;
      }

      // Use the shared extraction method
      return this.extractReelDataFromItem(items);
    } catch (error) {
      logger.debug(`Failed to extract reel from GraphQL: ${error.message}`);
      return null;
    }
  }
}

module.exports = GraphQLExtractor;

