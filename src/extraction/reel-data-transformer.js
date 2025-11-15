/**
 * ReelDataTransformer - Transforms and normalizes reel data from different sources
 */
class ReelDataTransformer {
  /**
   * Transform reel data to standard format
   * @param {Object} reelData - Raw reel data
   * @param {string} source - Data source ('graphql', 'dom', 'network')
   * @returns {Object} Transformed reel data
   */
  static transform(reelData, source = 'unknown') {
    if (!reelData) {
      return null;
    }

    return {
      post_id: reelData.post_id || null,
      author_username: reelData.author_username || null,
      caption: reelData.caption || null,
      hashtags: Array.isArray(reelData.hashtags) ? reelData.hashtags : [],
      hashtag_metadata: Array.isArray(reelData.hashtag_metadata) ? reelData.hashtag_metadata : [],
      likes_count: parseInt(reelData.likes_count) || 0,
      comments_count: parseInt(reelData.comments_count) || 0,
      view_count: parseInt(reelData.view_count) || 0,
      media_type: reelData.media_type || 'reel',
      video_url: reelData.video_url || null,
      thumbnail_url: reelData.thumbnail_url || null,
      created_at: reelData.created_at || null,
      screenshot_path: reelData.screenshot_path || '',
      source: source,
      extracted_at: new Date().toISOString()
    };
  }

  /**
   * Merge reel data from multiple sources (prioritize GraphQL over DOM)
   * @param {Object} graphqlData - Data from GraphQL
   * @param {Object} domData - Data from DOM
   * @returns {Object} Merged reel data
   */
  static merge(graphqlData, domData) {
    // Prioritize GraphQL data, fallback to DOM data
    const merged = {
      ...domData,
      ...graphqlData,
      // Merge hashtags from both sources
      hashtags: [...new Set([
        ...(graphqlData?.hashtags || []),
        ...(domData?.hashtags || [])
      ])],
      // Merge hashtag metadata
      hashtag_metadata: [
        ...(graphqlData?.hashtag_metadata || []),
        ...(domData?.hashtag_metadata || [])
      ]
    };

    return this.transform(merged, 'merged');
  }

  /**
   * Validate reel data structure
   * @param {Object} reelData - Reel data to validate
   * @returns {boolean} True if valid
   */
  static validate(reelData) {
    if (!reelData) {
      return false;
    }

    // Must have post_id
    if (!reelData.post_id) {
      return false;
    }

    // Validate counts are numbers
    if (typeof reelData.likes_count !== 'number' || 
        typeof reelData.comments_count !== 'number' ||
        typeof reelData.view_count !== 'number') {
      return false;
    }

    return true;
  }
}

module.exports = ReelDataTransformer;

