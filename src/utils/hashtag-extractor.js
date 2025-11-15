const { createLogger } = require('./logger');
const logger = createLogger('HashtagExtractor');

/**
 * Hashtag extraction and analysis utilities
 */
class HashtagExtractor {
  /**
   * Extract hashtags from text using regex
   * @param {string} text - Text to extract hashtags from
   * @returns {Array<string>} Array of hashtag names (without #)
   */
  static extractFromText(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const hashtagMatches = text.match(/#[\w]+/g);
    if (!hashtagMatches) {
      return [];
    }

    return hashtagMatches.map(match => match.slice(1).toLowerCase());
  }

  /**
   * Normalize hashtags (lowercase, remove duplicates, validate)
   * @param {Array<string>} hashtags - Array of hashtag strings
   * @returns {Array<string>} Normalized and deduplicated hashtags
   */
  static normalize(hashtags) {
    if (!Array.isArray(hashtags)) {
      return [];
    }

    const normalized = new Set();
    
    hashtags.forEach(tag => {
      if (!tag || typeof tag !== 'string') {
        return;
      }

      // Remove # if present and normalize
      const cleaned = tag.replace(/^#/, '').toLowerCase().trim();
      
      // Validate: must be alphanumeric/underscore, 1-100 chars
      if (cleaned.length > 0 && cleaned.length <= 100 && /^[\w]+$/.test(cleaned)) {
        normalized.add(cleaned);
      }
    });

    return Array.from(normalized);
  }

  /**
   * Extract hashtags from GraphQL response structure
   * @param {Object} items - GraphQL items object
   * @returns {Object} Object with hashtags array and metadata array
   */
  static extractFromGraphQL(items) {
    const hashtags = new Set();
    const metadata = [];

    // Method 1: edge_media_to_hashtag edges
    if (items?.edge_media_to_hashtag?.edges && Array.isArray(items.edge_media_to_hashtag.edges)) {
      items.edge_media_to_hashtag.edges.forEach((edge, index) => {
        const node = edge.node;
        if (node) {
          const hashtagName = node.name || node.hashtag;
          if (hashtagName) {
            const normalized = hashtagName.toLowerCase().replace(/^#/, '');
            hashtags.add(normalized);
            metadata.push({
              hashtag: normalized,
              hashtag_id: node.id || null,
              post_count: node.edge_hashtag_to_media?.count || node.media_count || null,
              position: index + 1,
              extraction_method: 'graphql_edge'
            });
          }
        }
      });
    }

    // Method 2: Direct hashtags array
    if (items?.hashtags && Array.isArray(items.hashtags)) {
      items.hashtags.forEach((tag, index) => {
        const hashtagName = typeof tag === 'string' ? tag : (tag.name || tag.hashtag);
        if (hashtagName) {
          const normalized = hashtagName.toLowerCase().replace(/^#/, '');
          hashtags.add(normalized);
          if (!metadata.find(m => m.hashtag === normalized)) {
            metadata.push({
              hashtag: normalized,
              hashtag_id: typeof tag === 'object' ? tag.id : null,
              post_count: typeof tag === 'object' ? tag.media_count : null,
              position: index + 1,
              extraction_method: 'graphql_array'
            });
          }
        }
      });
    }

    // Method 3: Caption object hashtags
    if (items?.caption?.hashtags && Array.isArray(items.caption.hashtags)) {
      items.caption.hashtags.forEach((tag, index) => {
        const hashtagName = typeof tag === 'string' ? tag : (tag.name || tag.hashtag);
        if (hashtagName) {
          const normalized = hashtagName.toLowerCase().replace(/^#/, '');
          hashtags.add(normalized);
          if (!metadata.find(m => m.hashtag === normalized)) {
            metadata.push({
              hashtag: normalized,
              hashtag_id: typeof tag === 'object' ? tag.id : null,
              post_count: null,
              position: index + 1,
              extraction_method: 'caption_object'
            });
          }
        }
      });
    }

    return {
      hashtags: Array.from(hashtags),
      metadata: metadata
    };
  }

  /**
   * Extract hashtags from DOM elements
   * @param {Object} page - Puppeteer page object
   * @returns {Promise<Object>} Object with hashtags array and metadata
   */
  static async extractFromDOM(page) {
    try {
      const result = await page.evaluate(() => {
        const hashtags = new Set();
        const metadata = [];

        // Method 1: Find hashtag links
        const hashtagLinks = document.querySelectorAll('a[href*="/explore/tags/"]');
        hashtagLinks.forEach((link, index) => {
          const href = link.getAttribute('href');
          const match = href.match(/\/explore\/tags\/([^\/\?]+)/);
          if (match) {
            const hashtagName = match[1].toLowerCase();
            hashtags.add(hashtagName);
            metadata.push({
              hashtag: hashtagName,
              hashtag_id: null,
              post_count: null,
              position: index + 1,
              extraction_method: 'dom_link'
            });
          }
        });

        // Method 2: Extract from caption text
        const captionElements = document.querySelectorAll('h1, span[dir="auto"]');
        for (const elem of captionElements) {
          const text = elem.innerText || elem.textContent;
          if (text && text.length > 10) {
            const hashtagMatches = text.match(/#[\w]+/g);
            if (hashtagMatches) {
              hashtagMatches.forEach((match, index) => {
                const hashtagName = match.slice(1).toLowerCase();
                hashtags.add(hashtagName);
                if (!metadata.find(m => m.hashtag === hashtagName)) {
                  metadata.push({
                    hashtag: hashtagName,
                    hashtag_id: null,
                    post_count: null,
                    position: index + 1,
                    extraction_method: 'dom_caption'
                  });
                }
              });
            }
            break;
          }
        }

        return {
          hashtags: Array.from(hashtags),
          metadata: metadata
        };
      });

      return result;
    } catch (error) {
      logger.debug(`DOM hashtag extraction failed: ${error.message}`);
      return { hashtags: [], metadata: [] };
    }
  }

  /**
   * Calculate hashtag frequency from posts
   * @param {Array<Object>} posts - Array of post objects with hashtags
   * @returns {Object} Frequency statistics
   */
  static calculateFrequency(posts) {
    const frequency = {};
    let totalHashtags = 0;

    posts.forEach(post => {
      const hashtags = post.hashtags || [];
      hashtags.forEach(tag => {
        const normalized = tag.toLowerCase().replace(/^#/, '');
        frequency[normalized] = (frequency[normalized] || 0) + 1;
        totalHashtags++;
      });
    });

    // Convert to sorted array
    const sorted = Object.entries(frequency)
      .map(([hashtag, count]) => ({
        hashtag,
        count,
        percentage: totalHashtags > 0 ? (count / totalHashtags * 100).toFixed(2) : 0
      }))
      .sort((a, b) => b.count - a.count);

    return {
      total_unique: sorted.length,
      total_occurrences: totalHashtags,
      frequency_map: frequency,
      sorted_frequency: sorted,
      top_hashtags: sorted.slice(0, 20) // Top 20
    };
  }

  /**
   * Generate hashtag statistics report
   * @param {Array<Object>} posts - Array of post objects
   * @returns {Object} Statistics report
   */
  static generateStatistics(posts) {
    const frequency = this.calculateFrequency(posts);
    
    // Calculate average hashtags per post
    const postsWithHashtags = posts.filter(p => p.hashtags && p.hashtags.length > 0);
    const avgHashtagsPerPost = posts.length > 0 
      ? (frequency.total_occurrences / posts.length).toFixed(2)
      : 0;

    return {
      total_posts: posts.length,
      posts_with_hashtags: postsWithHashtags.length,
      posts_without_hashtags: posts.length - postsWithHashtags.length,
      total_unique_hashtags: frequency.total_unique,
      total_hashtag_occurrences: frequency.total_occurrences,
      average_hashtags_per_post: parseFloat(avgHashtagsPerPost),
      top_hashtags: frequency.top_hashtags,
      frequency_distribution: frequency.sorted_frequency
    };
  }

  /**
   * Validate hashtag format
   * @param {string} hashtag - Hashtag to validate
   * @returns {boolean} True if valid
   */
  static validate(hashtag) {
    if (!hashtag || typeof hashtag !== 'string') {
      return false;
    }

    const cleaned = hashtag.replace(/^#/, '').trim();
    return cleaned.length > 0 && 
           cleaned.length <= 100 && 
           /^[\w]+$/.test(cleaned);
  }

  /**
   * Merge hashtags from multiple sources (GraphQL, DOM, text)
   * @param {Array<Object>} sources - Array of {hashtags: [], metadata: []} objects
   * @returns {Object} Merged hashtags and metadata
   */
  static merge(sources) {
    const mergedHashtags = new Set();
    const mergedMetadata = [];
    const seenHashtags = new Set();

    sources.forEach(source => {
      const hashtags = source.hashtags || [];
      const metadata = source.metadata || [];

      hashtags.forEach(tag => {
        const normalized = tag.toLowerCase().replace(/^#/, '');
        if (!seenHashtags.has(normalized)) {
          mergedHashtags.add(normalized);
          seenHashtags.add(normalized);

          // Find corresponding metadata
          const tagMetadata = metadata.find(m => m.hashtag === normalized);
          if (tagMetadata) {
            mergedMetadata.push(tagMetadata);
          } else {
            mergedMetadata.push({
              hashtag: normalized,
              hashtag_id: null,
              post_count: null,
              position: mergedMetadata.length + 1,
              extraction_method: 'merged'
            });
          }
        }
      });
    });

    return {
      hashtags: Array.from(mergedHashtags),
      metadata: mergedMetadata
    };
  }
}

module.exports = HashtagExtractor;

