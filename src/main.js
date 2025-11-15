#!/usr/bin/env node

require('dotenv').config();
const Persona = require('./services/persona');
const ProxyManager = require('./services/proxy');
const InstagramReelsScraper = require('./core/scraper');
const CSVStorage = require('./storage/csv-storage');
const { createLogger } = require('./utils/logger');
const logger = createLogger('Main');
const { checkIPAndLocation, logIPInfo } = require('./utils/ip-checker');
const HashtagExtractor = require('./utils/hashtag-extractor');
const defaults = require('./config/defaults');
const { AccountSuspendedError } = require('./services/login-flow');

/**
 * Parse and validate block-media CLI argument
 * @param {string} blockMediaArg - Comma-separated media types or 'all' or 'none'
 * @returns {Array|null} Array of resource types to block, or null for default
 */
function parseBlockMediaTypes(blockMediaArg) {
  if (!blockMediaArg) {
    return null; // Use default
  }

  const normalized = blockMediaArg.toLowerCase().trim();

  if (normalized === 'none') {
    return []; // Block nothing
  }

  if (normalized === 'all') {
    // Return all commonly blockable types
    return ['image', 'stylesheet', 'font', 'media'];
  }

  // Parse comma-separated list
  const types = normalized.split(',').map(t => t.trim()).filter(t => t.length > 0);
  
  // Validate resource types
  const validTypes = ['image', 'stylesheet', 'font', 'media', 'script', 'document', 'xhr', 'fetch', 'websocket', 'manifest', 'texttrack', 'other'];
  const invalidTypes = types.filter(t => !validTypes.includes(t));
  
  if (invalidTypes.length > 0) {
    logger.error(`Invalid resource types: ${invalidTypes.join(', ')}`);
    logger.info(`Valid types are: ${validTypes.join(', ')}`);
    throw new Error(`Invalid resource types: ${invalidTypes.join(', ')}`);
  }

  return types;
}

/**
 * Scrape Instagram Reels for a specific persona
 * @param {string} personaId - The persona ID to scrape with
 * @param {boolean} headless - Whether to run in headless mode (default: from config)
 * @param {boolean} useProxy - Whether to use proxy (default: from config, respects persona config)
 * @param {Array|null} blockMediaTypes - Array of resource types to block, or null for default
 * @returns {Promise<void>}
 */
async function scrapePersona(personaId, headless = defaults.browser.headless, useProxy = defaults.proxy.enabled, blockMediaTypes = null) {
  // Startup banner showing configuration
  logger.info('');
  logger.info('═══════════════════════════════════════════════════════════');
  logger.info('🚀 Instagram Reels Scraper - Service Initialization');
  logger.info('═══════════════════════════════════════════════════════════');
  logger.info(`Persona ID: ${personaId}`);
  logger.info(`Headless Mode: ${headless ? 'enabled' : 'disabled'}`);
  logger.info(`Proxy: ${useProxy ? 'enabled' : 'disabled'}`);
  logger.info(`Media Blocking: ${blockMediaTypes === null ? 'default (' + defaults.bandwidth.blockMediaTypes.join(', ') + ')' : blockMediaTypes.length === 0 ? 'disabled (none)' : blockMediaTypes.join(', ')}`);
  logger.info('');
  logger.info('Initializing Services:');
  logger.info('  ✓ PersonaLoader - Loading persona configuration');
  
  const personaLoader = new Persona();
  const proxyManager = new ProxyManager();
  logger.info('  ✓ ProxyManager - Proxy configuration manager');
  
  const storage = new CSVStorage();
  logger.info('  ✓ CSVStorage - Data persistence layer');

  let scraper = null;

  try {
    // Load persona configuration
    logger.info(`Loading persona: ${personaId}`);
    const persona = personaLoader.loadPersona(personaId);
    logger.debug(`Persona loaded: ${JSON.stringify({ id: persona.persona_id, region: persona.region, spectrum: persona.political_spectrum })}`);

    // Get proxy configuration (only if useProxy is true)
    let proxyConfig = null;
    if (useProxy) {
      proxyConfig = proxyManager.getProxyForPersona(persona);
    if (proxyConfig) {
      logger.debug(`Proxy configured: ${proxyConfig.server}`);
    } else {
      logger.debug('No proxy configured, running without proxy');
      }
    } else {
      logger.info('Proxy disabled via --no-proxy flag');
    }

    // Check and log IP/location
    logger.info('========== Connection Information ==========');
    const ipInfo = await checkIPAndLocation(proxyConfig);
    if (ipInfo) {
      logIPInfo(ipInfo, proxyConfig ? 'Via Proxy' : 'Direct');
      
      // Verify proxy is routing through correct country
      if (proxyConfig && persona.proxy.country_code) {
        if (ipInfo.countryCode.toLowerCase() === persona.proxy.country_code.toLowerCase()) {
          logger.info(`✓ Proxy routing confirmed: ${ipInfo.countryCode} matches target ${persona.proxy.country_code}`);
        } else {
          logger.warn(`⚠ Proxy routing mismatch: Got ${ipInfo.countryCode}, expected ${persona.proxy.country_code}`);
        }
      }
    } else {
      logger.warn('Could not verify IP/location');
    }
    logger.info('============================================');

    // Initialize scraper with headless option and blockMediaTypes
    logger.debug(`Initializing browser (headless: ${headless})...`);
    logger.info('  ✓ BrowserFactory - Creating browser instance');
    scraper = new InstagramReelsScraper(persona, proxyConfig, storage, headless, blockMediaTypes);
    await scraper.initialize();
    logger.info('  ✓ Scraper - Main orchestrator initialized');
    logger.info('═══════════════════════════════════════════════════════════');
    logger.info('');
    logger.debug('Browser initialized successfully');

    // Login to Instagram
    logger.info('Attempting Instagram login...');
    await scraper.login();
    logger.info('Login successful');

    // Scrape reels feed
    logger.info('========== Starting reels feed collection ==========');
    const sessionStart = Date.now();
    let reelsCollected = 0;
    let likesPerformed = 0;

    try {
      logger.debug('Navigating to reels feed...');
      const reels = await scraper.scrapeReelsFeed(defaults.scraping.reelsPerSession);
      reelsCollected = reels.length;
      logger.debug(`Reels feed: collected ${reelsCollected} reels`);

      const duration = Math.floor((Date.now() - sessionStart) / 1000);

      // Save session summary
      logger.debug(`Saving session data to CSV...`);
      storage.saveSession(persona, 'reels', {
        posts_collected: reelsCollected,
        likes_performed: likesPerformed,
        duration_seconds: duration
      });

      logger.info(`✓ Session completed: ${reelsCollected} reels collected in ${duration}s`);

      // Generate hashtag statistics
      logger.info('========== Generating Hashtag Statistics ==========');
      try {
        const allPosts = storage.getAllPosts();
        const personaPosts = allPosts.filter(p => p.persona_id === personaId);
        
        if (personaPosts.length > 0) {
          const stats = HashtagExtractor.generateStatistics(personaPosts);
          
          logger.info(`   Hashtag Statistics for ${personaId}:`);
          logger.info(`   Total posts: ${stats.total_posts}`);
          logger.info(`   Posts with hashtags: ${stats.posts_with_hashtags}`);
          logger.info(`   Posts without hashtags: ${stats.posts_without_hashtags}`);
          logger.info(`   Unique hashtags: ${stats.total_unique_hashtags}`);
          logger.info(`   Total hashtag occurrences: ${stats.total_hashtag_occurrences}`);
          logger.info(`   Average hashtags per post: ${stats.average_hashtags_per_post}`);
          
          if (stats.top_hashtags.length > 0) {
            logger.info(`\n   Top 10 Hashtags:`);
            stats.top_hashtags.slice(0, 10).forEach((item, index) => {
              logger.info(`   ${index + 1}. #${item.hashtag} (${item.count} times, ${item.percentage}%)`);
            });
          }
        } else {
          logger.info('No posts found for hashtag analysis');
        }
      } catch (error) {
        logger.warn(`Failed to generate hashtag statistics: ${error.message}`);
      }
      logger.info('==================================================');
    } catch (error) {
      logger.error(`✗ Session failed: ${error.message}`);
      logger.debug(`Error stack: ${error.stack}`);
    }

    logger.info(`Scraping completed for ${personaId}`);
  } catch (error) {
      logger.error(`Failed to scrape persona ${personaId}: ${error.message}`);
      
      // Handle account suspension with cooldown
      if (error instanceof AccountSuspendedError || error.isSuspension) {
        logger.error('');
        logger.error('═══════════════════════════════════════════════════════════');
        logger.error('🚫 ACCOUNT SUSPENDED');
        logger.error('═══════════════════════════════════════════════════════════');
        logger.error(`Account for persona ${personaId} has been suspended.`);
        logger.error(`Skipping this persona and moving to the next one.`);
        logger.error('═══════════════════════════════════════════════════════════');
        logger.error('');
        // Don't rethrow - let it continue to next persona
        return; // Exit early, skip cooldown for single persona runs
      }
      
      throw error;
    } finally {
    if (scraper) {
      await scraper.close();
    }
  }
}

/**
 * Scrape Instagram Reels for all configured personas
 * @param {boolean} headless - Whether to run in headless mode (default: from config)
 * @param {boolean} useProxy - Whether to use proxy (default: from config, respects persona config)
 * @param {Array|null} blockMediaTypes - Array of resource types to block, or null for default
 * @returns {Promise<void>}
 */
async function scrapeAllPersonas(headless = defaults.browser.headless, useProxy = defaults.proxy.enabled, blockMediaTypes = null) {
  const personaLoader = new Persona();
  const personas = personaLoader.loadAllPersonas();

  logger.info(`\n${'='.repeat(60)}`);
  logger.info(`Found ${personas.length} personas to scrape`);
  logger.info(`${'='.repeat(60)}\n`);

  for (let i = 0; i < personas.length; i++) {
    const persona = personas[i];
    logger.info(`\n[${'='.repeat(10)} Persona ${i + 1}/${personas.length} ${'='.repeat(10)}]`);
    
    try {
      await scrapePersona(persona.persona_id, headless, useProxy, blockMediaTypes);
      
      // Delay between personas
      if (i < personas.length - 1) {
        const delaySeconds = Math.floor(defaults.scraping.delayBetweenPersonas / 1000);
        logger.info(`Waiting ${delaySeconds}s before next persona...`);
        await new Promise(resolve => setTimeout(resolve, defaults.scraping.delayBetweenPersonas));
      }
    } catch (error) {
      // Handle account suspension with cooldown
      if (error instanceof AccountSuspendedError || error.isSuspension) {
        logger.error('');
        logger.error('═══════════════════════════════════════════════════════════');
        logger.error('🚫 ACCOUNT SUSPENDED');
        logger.error('═══════════════════════════════════════════════════════════');
        logger.error(`Account for persona ${persona.persona_id} has been suspended.`);
        logger.error(`Cooldown period: ${Math.floor(defaults.scraping.suspensionCooldown / 1000)}s`);
        logger.error('Skipping this persona and moving to the next one after cooldown.');
        logger.error('═══════════════════════════════════════════════════════════');
        logger.error('');
        
        // Apply cooldown before moving to next persona
        if (i < personas.length - 1) {
          const cooldownSeconds = Math.floor(defaults.scraping.suspensionCooldown / 1000);
          logger.info(`⏳ Suspension cooldown: Waiting ${cooldownSeconds}s before next persona...`);
          await new Promise(resolve => setTimeout(resolve, defaults.scraping.suspensionCooldown));
        }
        
        // Continue with next persona (don't rethrow)
        continue;
      }
      
      logger.error(`Failed to process persona ${persona.persona_id}: ${error.message}`);
      // Continue with next persona for other errors too
    }
  }

  logger.info(`\n${'='.repeat(60)}`);
  logger.info('All personas processed');
  logger.info(`${'='.repeat(60)}\n`);

  // Generate overall hashtag statistics
  logger.info('========== Overall Hashtag Statistics ==========');
  try {
    const storage = new CSVStorage();
    const allPosts = storage.getAllPosts();
    
    if (allPosts.length > 0) {
      const stats = HashtagExtractor.generateStatistics(allPosts);
      
      logger.info(`   Overall Statistics:`);
      logger.info(`   Total posts: ${stats.total_posts}`);
      logger.info(`   Posts with hashtags: ${stats.posts_with_hashtags}`);
      logger.info(`   Unique hashtags: ${stats.total_unique_hashtags}`);
      logger.info(`   Total hashtag occurrences: ${stats.total_hashtag_occurrences}`);
      logger.info(`   Average hashtags per post: ${stats.average_hashtags_per_post}`);
      
      if (stats.top_hashtags.length > 0) {
        logger.info(`\n   Top 20 Hashtags:`);
        stats.top_hashtags.slice(0, 20).forEach((item, index) => {
          logger.info(`   ${index + 1}. #${item.hashtag} (${item.count} times, ${item.percentage}%)`);
        });
      }
    } else {
      logger.info('No posts found for hashtag analysis');
    }
  } catch (error) {
    logger.warn(`Failed to generate overall hashtag statistics: ${error.message}`);
  }
  logger.info('================================================');
}

/**
 * Main entry point - parses command-line arguments and runs scraper
 * @returns {Promise<void>}
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Parse headless/head mode flags
  let headless = defaults.browser.headless; // Default from config
  if (args.includes('--head')) {
    headless = false;
  } else if (args.includes('--headless')) {
    headless = true;
  }
  
  // Parse --no-proxy flag
  const useProxy = args.includes('--no-proxy') ? false : defaults.proxy.enabled;
  
  // Parse --block-media flag
  let blockMediaTypes = null;
  if (args.includes('--block-media')) {
    const blockMediaIndex = args.indexOf('--block-media');
    const blockMediaArg = args[blockMediaIndex + 1];
    
    if (!blockMediaArg || blockMediaArg.startsWith('--')) {
      logger.error('Please specify media types to block: --block-media <types>');
      logger.info('Examples: --block-media image,media  or  --block-media all  or  --block-media none');
      process.exit(1);
    }
    
    try {
      blockMediaTypes = parseBlockMediaTypes(blockMediaArg);
      if (blockMediaTypes && blockMediaTypes.length > 0) {
        logger.info(`Media blocking configured: ${blockMediaTypes.join(', ')}`);
      } else if (blockMediaTypes && blockMediaTypes.length === 0) {
        logger.info('Media blocking disabled: all resources will be loaded');
      }
    } catch (error) {
      logger.error(`Failed to parse --block-media: ${error.message}`);
      process.exit(1);
    }
  }
  
  if (args.includes('--persona')) {
    const personaIndex = args.indexOf('--persona');
    const personaId = args[personaIndex + 1];
    
    if (!personaId) {
      logger.error('Please specify persona ID: --persona <persona_id>');
      process.exit(1);
    }

    await scrapePersona(personaId, headless, useProxy, blockMediaTypes);
  } else {
    await scrapeAllPersonas(headless, useProxy, blockMediaTypes);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    logger.error(`Scraper failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { scrapePersona, scrapeAllPersonas };

