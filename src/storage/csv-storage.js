const fs = require('fs');
const path = require('path');
const { createLogger } = require('../utils/logger');
const logger = createLogger('CSVStorage');

/**
 * CSV Storage class for persisting scraped Instagram Reels data
 * Handles CSV file creation, data appending, and schema migration
 */
class CSVStorage {
  /**
   * Initialize CSV storage with data directory
   * @param {string|null} dataDir - Directory path for storing CSV files (default: ./data)
   */
  constructor(dataDir = null) {
    this.dataDir = dataDir || path.join(process.cwd(), 'data');
    
    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    this.postsFile = path.join(this.dataDir, 'posts.csv');
    this.sessionsFile = path.join(this.dataDir, 'sessions.csv');
    this.rawDataDir = path.join(this.dataDir, 'raw');
    this.rawDataFile = path.join(this.rawDataDir, 'intercepted_packets.jsonl');
    
    // Ensure raw data directory exists
    if (!fs.existsSync(this.rawDataDir)) {
      fs.mkdirSync(this.rawDataDir, { recursive: true });
    }
    
    this.initializeFiles();
    
    // Cache existing post IDs for duplicate detection (lazy-loaded)
    this._existingPostIdsCache = null;
    this._cacheValid = false;
    
    logger.info(`CSV storage initialized at ${this.dataDir}`);
  }

  /**
   * Get Set of existing post IDs from CSV (for duplicate detection)
   * Uses caching for performance
   * @returns {Set<string>} Set of post IDs
   */
  getExistingPostIds() {
    if (this._existingPostIdsCache && this._cacheValid) {
      return this._existingPostIdsCache;
    }

    const postIds = new Set();
    
    if (!fs.existsSync(this.postsFile)) {
      this._existingPostIdsCache = postIds;
      this._cacheValid = true;
      return postIds;
    }

    try {
      const content = fs.readFileSync(this.postsFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      // Skip header
      const dataLines = lines.slice(1);
      
      for (const line of dataLines) {
        const parts = this.parseCSVLine(line);
        // post_id is at index 7 in current schema (17 fields)
        // Handle different schema versions
        let postId = null;
        if (parts.length >= 8) {
          // Current schema: post_id is at index 7
          postId = parts[7];
        } else if (parts.length >= 6) {
          // Older schema: post_id is at index 5
          postId = parts[5];
        }
        
        if (postId && postId.trim()) {
          postIds.add(postId.trim());
        }
      }
      
      this._existingPostIdsCache = postIds;
      this._cacheValid = true;
      logger.debug(`Loaded ${postIds.size} existing post IDs for duplicate detection`);
      return postIds;
    } catch (error) {
      logger.warn(`Failed to load existing post IDs: ${error.message}`);
      this._existingPostIdsCache = new Set();
      this._cacheValid = true;
      return this._existingPostIdsCache;
    }
  }

  /**
   * Check if a post already exists in CSV
   * @param {string} postId - Post ID to check
   * @returns {boolean} True if post exists
   */
  hasPost(postId) {
    if (!postId) {
      return false;
    }
    const existingIds = this.getExistingPostIds();
    return existingIds.has(postId.trim());
  }

  /**
   * Invalidate the post IDs cache (call after saving new posts)
   */
  _invalidateCache() {
    this._cacheValid = false;
  }

  /**
   * Initialize CSV files with headers if they don't exist
   */
  initializeFiles() {
    // Posts CSV - check if file exists and needs migration
    if (fs.existsSync(this.postsFile)) {
      // Check if file has old schema (with video_url/thumbnail_url or without view_count/gender/age)
      const content = fs.readFileSync(this.postsFile, 'utf8');
      const firstLine = content.split('\n')[0];
      const hasVideoUrl = firstLine.includes('video_url');
      const hasViewCount = firstLine.includes('view_count');
      const hasGender = firstLine.includes('gender');
      const hasAge = firstLine.includes('age');
      
      // Check if schema needs migration (missing required fields or has deprecated fields)
      const hasScreenshotPath = firstLine.includes('screenshot_path');
      const needsMigration = hasVideoUrl || !hasViewCount || !hasGender || !hasAge || !hasScreenshotPath;
      
      if (needsMigration) {
        // Migrate old CSV to new schema (removing video_url/thumbnail_url, adding gender/age if missing, normalizing newlines)
        logger.info('Migrating posts.csv to new schema (removing video_url/thumbnail_url, adding gender/age if missing, normalizing newlines)...');
        this.migratePostsCSV();
      }
    } else {
      // Create new file with full schema (removed video_url and thumbnail_url, added screenshot_path)
      const postsHeader = [
        'timestamp',
        'persona_id',
        'gender',
        'age',
        'region',
        'political_spectrum',
        'feed_type',
        'post_id',
        'author_username',
        'caption',
        'likes_count',
        'comments_count',
        'view_count',
        'hashtags',
        'created_at',
        'media_type',
        'screenshot_path'
      ].join(',') + '\n';
      
      fs.writeFileSync(this.postsFile, postsHeader);
      logger.info('Created posts.csv with enhanced schema');
    }

    // Sessions CSV
    if (!fs.existsSync(this.sessionsFile)) {
      const sessionsHeader = [
        'timestamp',
        'persona_id',
        'gender',
        'age',
        'region',
        'political_spectrum',
        'feed_type',
        'posts_collected',
        'likes_performed',
        'duration_seconds'
      ].join(',') + '\n';
      
      fs.writeFileSync(this.sessionsFile, sessionsHeader);
      logger.info('Created sessions.csv');
    }
  }

  /**
   * Save raw intercepted packet (all network requests)
   * This stores the complete raw response data for analysis
   * @param {Object} persona - Persona configuration
   * @param {string} url - Request URL
   * @param {string} method - HTTP method
   * @param {string} contentType - Response content type
   * @param {string} rawData - Raw response data as string
   */
  saveRawInterceptedPacket(persona, url, method, contentType, rawData) {
    try {
      // Truncate very large data to prevent memory/JSON issues
      // Keep first 500KB of data for analysis
      const maxDataLength = 500 * 1024;
      const truncatedData = typeof rawData === 'string' && rawData.length > maxDataLength
        ? rawData.substring(0, maxDataLength) + '...[truncated]'
        : rawData;

      const packet = {
        timestamp: new Date().toISOString(),
        persona_id: persona?.persona_id || 'unknown',
        gender: persona?.demographics?.gender || persona?.gender || 'unknown',
        age: persona?.demographics?.age || persona?.age || 'unknown',
        region: persona?.region || 'unknown',
        political_spectrum: persona?.political_spectrum || 'unknown',
        request_url: url,
        request_method: method,
        content_type: contentType || 'unknown',
        data: truncatedData // Store raw string data exactly as received (truncated if too large)
      };

      // Use async appendFile to avoid blocking (fire and forget)
      const packetLine = JSON.stringify(packet) + '\n';
      fs.appendFile(this.rawDataFile, packetLine, (err) => {
        if (err) {
          logger.debug(`Failed to save raw intercepted packet (async): ${err.message}`);
        }
      });
      
      // Only log debug for important requests to reduce log noise
      if (url.includes('/graphql/query') || url.includes('/ajax/')) {
        logger.debug(`Saved raw intercepted packet: ${method} ${url.substring(0, 50)}...`);
      }
    } catch (error) {
      // Don't throw - just log and continue
      logger.debug(`Failed to save raw intercepted packet: ${error.message}`);
    }
  }

  /**
   * Save raw media data packet (extracted from GraphQL)
   * This stores the parsed media object for reel analysis
   * @param {Object} persona - Persona configuration
   * @param {string} url - Request URL
   * @param {string} method - HTTP method
   * @param {Object} rawData - Complete raw data packet (media object)
   */
  saveRawPacket(persona, url, method, rawData) {
    try {
      const packet = {
        timestamp: new Date().toISOString(),
        persona_id: persona?.persona_id || 'unknown',
        region: persona?.region || 'unknown',
        political_spectrum: persona?.political_spectrum || 'unknown',
        request_url: url,
        request_method: method,
        data: rawData // Complete media object
      };

      // Create separate file for parsed media objects
      const mediaPacketsFile = path.join(this.rawDataDir, 'media_packets.jsonl');
      fs.appendFileSync(mediaPacketsFile, JSON.stringify(packet) + '\n');
      logger.debug(`Saved raw media packet for reel: ${rawData.code || rawData.shortcode || 'unknown'}`);
    } catch (error) {
      logger.error(`Failed to save raw media packet: ${error.message}`);
    }
  }

  /**
   * Get all raw intercepted packets for analysis
   * @returns {Array} Array of raw intercepted packet objects
   */
  getAllRawPackets() {
    return this._readJSONLFile(this.rawDataFile);
  }

  /**
   * Get all raw media packets (parsed media objects) for analysis
   * @returns {Array} Array of raw media packet objects
   */
  getAllRawMediaPackets() {
    const mediaPacketsFile = path.join(this.rawDataDir, 'media_packets.jsonl');
    return this._readJSONLFile(mediaPacketsFile);
  }

  /**
   * Helper method to read JSONL files
   * @private
   */
  _readJSONLFile(filePath) {
    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      return lines.map(line => {
        try {
          return JSON.parse(line);
        } catch (error) {
          logger.debug(`Failed to parse JSONL line: ${error.message}`);
          return null;
        }
      }).filter(packet => packet !== null);
    } catch (error) {
      logger.error(`Failed to read JSONL file: ${error.message}`);
      return [];
    }
  }

  /**
   * Migrate old CSV schema to new schema (remove video_url/thumbnail_url, normalize newlines)
   */
  migratePostsCSV() {
    try {
      const content = fs.readFileSync(this.postsFile, 'utf8');
      
      // Backup old file
      const backupFile = this.postsFile + '.backup';
      fs.copyFileSync(this.postsFile, backupFile);
      logger.info(`Backed up old CSV to ${backupFile}`);
      
      // Write new header (without video_url and thumbnail_url, with screenshot_path)
      const newHeader = [
        'timestamp',
        'persona_id',
        'gender',
        'age',
        'region',
        'political_spectrum',
        'feed_type',
        'post_id',
        'author_username',
        'caption',
        'likes_count',
        'comments_count',
        'view_count',
        'hashtags',
        'created_at',
        'media_type',
        'screenshot_path'
      ].join(',') + '\n';
      
      // Parse all rows properly, handling multi-line CSV entries
      const lines = [];
      let currentLine = '';
      let inQuotedField = false;
      
      for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const nextChar = content[i + 1];
        
        if (char === '"') {
          if (inQuotedField && nextChar === '"') {
            // Escaped quote - keep both
            currentLine += '""';
            i++; // Skip next quote
          } else {
            // Toggle quoted field state
            inQuotedField = !inQuotedField;
            currentLine += char;
          }
        } else if (char === '\n' && !inQuotedField) {
          // End of line (not inside quoted field)
          if (currentLine.trim()) {
            lines.push(currentLine);
          }
          currentLine = '';
        } else {
          currentLine += char;
        }
      }
      
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      
      if (lines.length === 0) {
        // Empty file, just write new header
        fs.writeFileSync(this.postsFile, newHeader);
        return;
      }
      
      // Migrate data rows
      const dataLines = lines.slice(1); // Skip header
      const migratedRows = dataLines.map(line => {
        const parts = this.parseCSVLine(line);
        
        // Handle different schema versions:
        // - 12 fields: old schema without view_count, video_url, thumbnail_url, created_at, gender, age
        // - 14 fields: has view_count, created_at but no video_url/thumbnail_url, gender, age (already migrated)
        // - 16 fields: current schema with gender/age OR old schema with video_url/thumbnail_url
        // - 17 fields: current schema with gender/age AND screenshot_path (already correct)
        // - 18 fields: old schema with video_url/thumbnail_url AND gender/age
        
        // Check if this is the current schema (16 fields with gender/age) or old schema (16 fields with video_url/thumbnail_url)
        // We can detect by checking if the header has gender/age columns
        const headerLine = lines[0];
        const hasGenderAge = headerLine.includes('gender') && headerLine.includes('age');
        const hasVideoUrl = headerLine.includes('video_url');
        const hasScreenshotPath = headerLine.includes('screenshot_path');
        
        if (parts.length === 17 && hasGenderAge && hasScreenshotPath && !hasVideoUrl) {
          // Current schema with gender/age and screenshot_path (already correct, just normalize caption)
          return [
            parts[0],  // timestamp
            parts[1],  // persona_id
            parts[2],  // gender
            parts[3],  // age
            parts[4],  // region
            parts[5],  // political_spectrum
            parts[6],  // feed_type
            parts[7],  // post_id
            parts[8],  // author_username
            this.escapeCSV(parts[9]), // caption (normalize newlines)
            parts[10], // likes_count
            parts[11], // comments_count
            parts[12], // view_count
            parts[13], // hashtags
            parts[14], // created_at
            parts[15], // media_type
            parts[16]  // screenshot_path (keep existing)
          ].join(',');
        } else if (parts.length === 18) {
          // Old schema with video_url/thumbnail_url AND gender/age - remove video_url (index 12) and thumbnail_url (index 13)
          return [
            parts[0],  // timestamp
            parts[1],  // persona_id
            parts[2],  // gender
            parts[3],  // age
            parts[4],  // region
            parts[5],  // political_spectrum
            parts[6],  // feed_type
            parts[7],  // post_id
            parts[8],  // author_username
            this.escapeCSV(parts[9]), // caption (normalize newlines)
            parts[10], // likes_count
            parts[11], // comments_count
            parts[12], // view_count
            parts[13], // hashtags
            parts[16], // created_at (skip video_url and thumbnail_url)
            parts[17], // media_type
            ''         // screenshot_path (new)
          ].join(',');
        } else if (parts.length === 16 && hasGenderAge && !hasVideoUrl) {
          // Current schema with gender/age (already correct, just normalize caption and add screenshot_path)
          return [
            parts[0],  // timestamp
            parts[1],  // persona_id
            parts[2],  // gender
            parts[3],  // age
            parts[4],  // region
            parts[5],  // political_spectrum
            parts[6],  // feed_type
            parts[7],  // post_id
            parts[8],  // author_username
            this.escapeCSV(parts[9]), // caption (normalize newlines)
            parts[10], // likes_count
            parts[11], // comments_count
            parts[12], // view_count
            parts[13], // hashtags
            parts[14], // created_at
            parts[15], // media_type
            ''         // screenshot_path (new)
          ].join(',');
        } else if (parts.length === 16 && hasVideoUrl) {
          // Old schema with video_url/thumbnail_url but no gender/age - remove video_url (index 12) and thumbnail_url (index 13), add gender/age
          return [
            parts[0],  // timestamp
            parts[1],  // persona_id
            '',        // gender (new)
            '',        // age (new)
            parts[2],  // region
            parts[3],  // political_spectrum
            parts[4],  // feed_type
            parts[5],  // post_id
            parts[6],  // author_username
            this.escapeCSV(parts[7]), // caption (normalize newlines)
            parts[8],  // likes_count
            parts[9],  // comments_count
            parts[10], // view_count
            parts[11], // hashtags
            parts[14], // created_at (skip video_url and thumbnail_url)
            parts[15], // media_type
            ''         // screenshot_path (new)
          ].join(',');
        } else if (parts.length === 14) {
          // Schema without gender/age (already migrated, add gender/age)
          return [
            parts[0],  // timestamp
            parts[1],  // persona_id
            '',        // gender (new)
            '',        // age (new)
            parts[2],  // region
            parts[3],  // political_spectrum
            parts[4],  // feed_type
            parts[5],  // post_id
            parts[6],  // author_username
            this.escapeCSV(parts[7]), // caption (normalize newlines)
            parts[8],  // likes_count
            parts[9],  // comments_count
            parts[10], // view_count
            parts[11], // hashtags
            parts[12], // created_at
            parts[13], // media_type
            ''         // screenshot_path (new)
          ].join(',');
        } else if (parts.length === 12) {
          // Old schema without view_count, video_url, thumbnail_url, created_at, gender, age
          return [
            parts[0],  // timestamp
            parts[1],  // persona_id
            '',        // gender (new)
            '',        // age (new)
            parts[2],  // region
            parts[3],  // political_spectrum
            parts[4],  // feed_type
            parts[5],  // post_id
            parts[6],  // author_username
            this.escapeCSV(parts[7]), // caption (normalize newlines)
            parts[8],  // likes_count
            parts[9],  // comments_count
            '',        // view_count (new)
            parts[10], // hashtags
            '',        // created_at (new)
            parts[11], // media_type
            ''         // screenshot_path (new)
          ].join(',');
        }
        
        // Unknown schema - try to keep as-is but normalize caption
        logger.warn(`Unknown CSV schema with ${parts.length} fields, attempting to process...`);
        return line;
      });
      
      fs.writeFileSync(this.postsFile, newHeader + migratedRows.join('\n') + '\n');
      logger.info('Migration completed successfully - removed video_url/thumbnail_url, normalized newlines');
    } catch (error) {
      logger.error(`CSV migration failed: ${error.message}`);
      logger.error(`Stack trace: ${error.stack}`);
      throw error;
    }
  }

  /**
   * Escape CSV field and normalize newlines
   */
  escapeCSV(field) {
    if (field === null || field === undefined) {
      return '';
    }
    
    let str = String(field);
    
    // Replace newlines and carriage returns with spaces to keep CSV clean
    // This prevents multi-line CSV rows that can corrupt the file
    str = str.replace(/\r\n/g, ' ').replace(/\r/g, ' ').replace(/\n/g, ' ');
    
    // Remove multiple consecutive spaces (from newline replacements)
    str = str.replace(/\s+/g, ' ').trim();
    
    // Escape quotes and wrap in quotes if contains comma or quote
    if (str.includes(',') || str.includes('"')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    
    return str;
  }

  /**
   * Save a scraped post/reel to CSV file
   * @param {Object} persona - Persona configuration object
   * @param {string} feedType - Type of feed (e.g., 'reels', 'explore')
   * @param {Object} postData - Post data object containing post_id, author_username, caption, hashtags, etc.
   * @param {boolean} skipDuplicateCheck - If true, skip duplicate check (default: false)
   * @returns {boolean} True if post was saved, false if duplicate or error
   */
  savePost(persona, feedType, postData, skipDuplicateCheck = false) {
    try {
      if (!postData || !postData.post_id) {
        logger.warn(`Cannot save post: missing post_id. Data: ${JSON.stringify(postData).substring(0, 100)}`);
        return false;
      }

      // Check for duplicates unless explicitly skipped
      if (!skipDuplicateCheck && this.hasPost(postData.post_id)) {
        logger.debug(`⏭ Skipping duplicate post: ${postData.post_id} by @${postData.author_username || 'unknown'}`);
        return false;
      }

      const row = [
        new Date().toISOString(),
        this.escapeCSV(persona?.persona_id || 'unknown'),
        this.escapeCSV(persona?.demographics?.gender || persona?.gender || 'unknown'),
        this.escapeCSV(persona?.demographics?.age || persona?.age || 'unknown'),
        this.escapeCSV(persona?.region || 'unknown'),
        this.escapeCSV(persona?.political_spectrum || 'unknown'),
        this.escapeCSV(feedType),
        this.escapeCSV(postData.post_id || ''),
        this.escapeCSV(postData.author_username || ''),
        this.escapeCSV(postData.caption || ''), // Newlines normalized to spaces by escapeCSV
        postData.likes_count || 0,
        postData.comments_count || 0,
        postData.view_count || 0,
        this.escapeCSV((postData.hashtags || []).join('|')),
        postData.created_at ? (typeof postData.created_at === 'number' ? new Date(postData.created_at * 1000).toISOString() : postData.created_at) : '',
        this.escapeCSV(postData.media_type || 'reel'),
        this.escapeCSV(postData.screenshot_path || '')
      ].join(',') + '\n';

      fs.appendFileSync(this.postsFile, row);
      
      // Invalidate cache so next check includes this new post
      this._invalidateCache();
      
      logger.info(`Saved to CSV: ${postData.post_id} by @${postData.author_username || 'unknown'}`);
      return true;
    } catch (error) {
      logger.error(`Failed to save post to CSV: ${error.message}`);
      logger.error(`Post data: ${JSON.stringify(postData).substring(0, 200)}`);
      return false;
    }
  }

  /**
   * Save a scraping session summary to CSV
   * @param {Object} persona - Persona configuration object
   * @param {string} feedType - Type of feed scraped (e.g., 'reels')
   * @param {Object} stats - Session statistics (posts_collected, likes_performed, duration_seconds)
   */
  saveSession(persona, feedType, stats) {
    const row = [
      new Date().toISOString(),
      this.escapeCSV(persona.persona_id),
      this.escapeCSV(persona?.demographics?.gender || persona?.gender || 'unknown'),
      this.escapeCSV(persona?.demographics?.age || persona?.age || 'unknown'),
      this.escapeCSV(persona.region),
      this.escapeCSV(persona.political_spectrum),
      this.escapeCSV(feedType),
      stats.posts_collected || 0,
      stats.likes_performed || 0,
      stats.duration_seconds || 0
    ].join(',') + '\n';

    fs.appendFileSync(this.sessionsFile, row);
    logger.info(`Session saved: ${persona.persona_id} - ${feedType} - ${stats.posts_collected} posts`);
  }

  /**
   * Get all posts from CSV file for analysis
   * @returns {Array<Object>} Array of post objects with all fields
   */
  getAllPosts() {
    if (!fs.existsSync(this.postsFile)) {
      return [];
    }

    const content = fs.readFileSync(this.postsFile, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    // Skip header
    const dataLines = lines.slice(1);
    
    return dataLines.map(line => {
      const parts = this.parseCSVLine(line);
      // Handle different schema versions:
      // - 12 fields: old schema without view_count, created_at, gender, age
      // - 14 fields: schema without gender/age (without video_url/thumbnail_url)
      // - 16 fields: current schema with gender/age OR old schema with video_url/thumbnail_url
      // - 18 fields: old schema with video_url/thumbnail_url AND gender/age
      
      if (parts.length === 17) {
        // Current schema with gender, age, and screenshot_path: timestamp, persona_id, gender, age, region, political_spectrum, feed_type, post_id, author_username, caption, likes_count, comments_count, view_count, hashtags, created_at, media_type, screenshot_path
        return {
          timestamp: parts[0],
          persona_id: parts[1],
          gender: parts[2],
          age: parts[3],
          region: parts[4],
          political_spectrum: parts[5],
          feed_type: parts[6],
          post_id: parts[7],
          author_username: parts[8],
          caption: parts[9],
          likes_count: parseInt(parts[10]) || 0,
          comments_count: parseInt(parts[11]) || 0,
          view_count: parseInt(parts[12]) || 0,
          hashtags: parts[13] ? parts[13].split('|') : [],
          created_at: parts[14] || '',
          media_type: parts[15] || 'reel',
          screenshot_path: parts[16] || ''
        };
      } else if (parts.length === 16) {
        // Schema with gender and age but without screenshot_path: timestamp, persona_id, gender, age, region, political_spectrum, feed_type, post_id, author_username, caption, likes_count, comments_count, view_count, hashtags, created_at, media_type
        return {
          timestamp: parts[0],
          persona_id: parts[1],
          gender: parts[2],
          age: parts[3],
          region: parts[4],
          political_spectrum: parts[5],
          feed_type: parts[6],
          post_id: parts[7],
          author_username: parts[8],
          caption: parts[9],
          likes_count: parseInt(parts[10]) || 0,
          comments_count: parseInt(parts[11]) || 0,
          view_count: parseInt(parts[12]) || 0,
          hashtags: parts[13] ? parts[13].split('|') : [],
          created_at: parts[14] || '',
          media_type: parts[15] || 'reel',
          screenshot_path: ''
        };
      } else if (parts.length === 14) {
        // Schema without gender/age: timestamp, persona_id, region, political_spectrum, feed_type, post_id, author_username, caption, likes_count, comments_count, view_count, hashtags, created_at, media_type
        return {
          timestamp: parts[0],
          persona_id: parts[1],
          gender: 'unknown',
          age: 'unknown',
          region: parts[2],
          political_spectrum: parts[3],
          feed_type: parts[4],
          post_id: parts[5],
          author_username: parts[6],
          caption: parts[7],
          likes_count: parseInt(parts[8]) || 0,
          comments_count: parseInt(parts[9]) || 0,
          view_count: parseInt(parts[10]) || 0,
          hashtags: parts[11] ? parts[11].split('|') : [],
          created_at: parts[12] || '',
          media_type: parts[13] || 'reel',
          screenshot_path: ''
        };
      } else if (parts.length === 12) {
        // Very old schema without view_count, created_at, gender, age
        return {
          timestamp: parts[0],
          persona_id: parts[1],
          gender: 'unknown',
          age: 'unknown',
          region: parts[2],
          political_spectrum: parts[3],
          feed_type: parts[4],
          post_id: parts[5],
          author_username: parts[6],
          caption: parts[7],
          likes_count: parseInt(parts[8]) || 0,
          comments_count: parseInt(parts[9]) || 0,
          view_count: 0,
          hashtags: parts[10] ? parts[10].split('|') : [],
          created_at: '',
          media_type: parts[11] || 'reel',
          screenshot_path: ''
        };
      }
      
      // Unknown schema - return empty object
      logger.warn(`Unknown CSV schema with ${parts.length} fields, skipping row`);
      return null;
    }).filter(post => post !== null);
  }

  /**
   * Parse CSV line handling quoted fields
   */
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"' && inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    
    return result;
  }

  /**
   * Get posts by persona
   */
  getPostsByPersona(personaId) {
    const allPosts = this.getAllPosts();
    return allPosts.filter(post => post.persona_id === personaId);
  }

  /**
   * Get posts by region
   */
  getPostsByRegion(region) {
    const allPosts = this.getAllPosts();
    return allPosts.filter(post => post.region === region);
  }

  /**
   * Get posts by political spectrum
   */
  getPostsBySpectrum(spectrum) {
    const allPosts = this.getAllPosts();
    return allPosts.filter(post => post.political_spectrum === spectrum);
  }

  /**
   * Get statistics
   */
  getStats() {
    const posts = this.getAllPosts();
    const personas = [...new Set(posts.map(p => p.persona_id))];
    const genders = [...new Set(posts.map(p => p.gender))];
    const ages = [...new Set(posts.map(p => p.age))];
    const regions = [...new Set(posts.map(p => p.region))];
    const spectrums = [...new Set(posts.map(p => p.political_spectrum))];

    return {
      total_posts: posts.length,
      personas: personas.length,
      regions: regions.length,
      political_spectrums: spectrums.length,
      posts_by_persona: personas.map(id => ({
        persona_id: id,
        count: posts.filter(p => p.persona_id === id).length
      }))
    };
  }
}

module.exports = CSVStorage;

