const { createLogger } = require('../utils/logger');
const logger = createLogger('DOMExtractor');
const HashtagExtractor = require('../utils/hashtag-extractor');

/**
 * DOMExtractor - Extracts reel data from DOM elements
 */
class DOMExtractor {
  /**
   * Extract data from current reel (DOM fallback method)
   * @param {Object} page - Puppeteer page object
   * @returns {Promise<Object|null>} Extracted reel data or null
   */
  static async extractReelData(page) {
    try {
      logger.debug('Puppeteer: Executing page.evaluate() to extract reel data...');
      const domData = await page.evaluate(() => {
        const reelData = {
          post_id: null,
          author_username: null,
          caption: null,
          hashtags: [],
          likes_count: 0,
          comments_count: 0,
          media_type: 'reel'
        };
        
        // Extract post ID from URL (supports both /reel/ and /reels/ formats)
        const urlMatch = window.location.href.match(/\/(?:reels?)\/([^\/\?]+)/);
        if (urlMatch) {
          reelData.post_id = urlMatch[1];
        }
        
        // Get author username (look for profile link in reel)
        const authorLink = document.querySelector('a[href^="/"][href*="/"]');
        if (authorLink) {
          const href = authorLink.getAttribute('href');
          const username = href.split('/').filter(p => p)[0];
          if (username && !username.includes('reel')) {
            reelData.author_username = username;
          }
        }
        
        // Get caption (look for text content)
        const captionElements = document.querySelectorAll('h1, span[dir="auto"]');
        for (const elem of captionElements) {
          const text = elem.innerText;
          if (text && text.length > 10 && !text.includes('Follow') && !text.includes('Like')) {
            reelData.caption = text;
            break;
          }
        }
        
        // Get likes count (look for like button)
        const likeButtons = document.querySelectorAll('button[aria-label*="like"], span[aria-label*="like"]');
        for (const button of likeButtons) {
          const label = button.getAttribute('aria-label');
          if (label) {
            const likeMatch = label.match(/([\d,]+)\s*like/i);
            if (likeMatch) {
              reelData.likes_count = parseInt(likeMatch[1].replace(/,/g, ''));
              break;
            }
          }
        }
        
        // Get comments count
        const commentButtons = document.querySelectorAll('button[aria-label*="comment"], span[aria-label*="comment"]');
        for (const button of commentButtons) {
          const label = button.getAttribute('aria-label');
          if (label) {
            const commentMatch = label.match(/([\d,]+)\s*comment/i);
            if (commentMatch) {
              reelData.comments_count = parseInt(commentMatch[1].replace(/,/g, ''));
              break;
            }
          }
        }
        
        return reelData.post_id ? reelData : null;
      });

      if (!domData) {
        return null;
      }

      // Use HashtagExtractor to extract hashtags from DOM
      logger.debug('Extracting hashtags from DOM using HashtagExtractor...');
      const domHashtags = await HashtagExtractor.extractFromDOM(page);
      
      // Merge hashtags from caption text and DOM links
      const captionHashtags = domData.caption ? HashtagExtractor.extractFromText(domData.caption) : [];
      const allHashtags = HashtagExtractor.merge([
        { hashtags: domHashtags.hashtags, metadata: domHashtags.metadata },
        { hashtags: captionHashtags, metadata: [] }
      ]);

      // Combine results
      return {
        ...domData,
        hashtags: allHashtags.hashtags,
        hashtag_metadata: allHashtags.metadata
      };
    } catch (error) {
      logger.error(`Failed to extract reel data: ${error.message}`);
      return null;
    }
  }
}

module.exports = DOMExtractor;

