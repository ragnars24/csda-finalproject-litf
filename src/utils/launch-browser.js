#!/usr/bin/env node

require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const ProxyManager = require('../services/proxy');
const { createLogger } = require('./logger');
const logger = createLogger('LaunchBrowser');

puppeteer.use(StealthPlugin());

/**
 * Launch a browser with residential proxy for testing and verification
 * @param {Object} options - Configuration options
 * @param {string} options.countryCode - Country code (US, DE, BR, etc.)
 * @param {string} options.startUrl - URL to navigate to on launch
 * @param {boolean} options.showIP - Whether to show IP check page first
 * @param {boolean} options.headless - Use headless mode (required for proxy to work)
 */
async function launchBrowserWithProxy(options = {}) {
  const {
    countryCode = 'US',
    startUrl = 'https://www.instagram.com',
    showIP = true,
    headless = false
  } = options;

  console.log('\n' + '='.repeat(60));
  console.log('🌐 Launching Browser with Residential Proxy');
  console.log('='.repeat(60) + '\n');

  // Initialize proxy manager
  const proxyManager = new ProxyManager();
  const proxyConfig = proxyManager.getProxyConfig(countryCode);

  if (!proxyConfig) {
    console.error('❌ Error: Proxy not configured');
    console.error('   Please set IPROYAL_USERNAME and IPROYAL_PASSWORD in .env\n');
    process.exit(1);
  }

  console.log('Proxy Configuration:');
  console.log(`  Country: ${countryCode}`);
  console.log(`  Server: ${proxyConfig.server}`);
  console.log(`  Username: ${proxyConfig.username}`);
  console.log('');

  let browser, page;
  
  try {
    // Launch browser with proxy (same approach as instagram-scraper.js)
    if (!headless) {
      console.log('⚠️  NOTE: Proxy authentication works best in headless mode.');
      console.log('   GUI mode may fail due to Chrome background services.');
      console.log('   Use --headless flag if you encounter issues.\n');
    }
    
    console.log('🚀 Launching browser...');
    
    const launchOptions = {
      headless: headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--lang=en-US'
      ]
    };

    // Add proxy configuration
    if (proxyConfig) {
      launchOptions.args.push(`--proxy-server=${proxyConfig.server}`);
    }

    browser = await puppeteer.launch(launchOptions);
    console.log('✓ Browser launched\n');

    page = await browser.newPage();
    
    // Set viewport and timeouts
    await page.setViewport({ width: 1280, height: 800 });
    page.setDefaultNavigationTimeout(90000);
    page.setDefaultTimeout(90000);

    // Authenticate proxy if configured
    if (proxyConfig && proxyConfig.username) {
      console.log('⚙️  Authenticating with proxy...');
      await page.authenticate({
        username: proxyConfig.username,
        password: proxyConfig.password
      });
      console.log('✓ Proxy authentication configured\n');
    }

    // Show IP verification page first if requested
    if (showIP) {
      console.log('🔍 Verifying IP address...');
      
      try {
        await page.goto('https://api.ipify.org?format=json', { 
          waitUntil: 'domcontentloaded',
          timeout: 60000 
        });

        // Wait a moment for the JSON to display
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Get the IP info
        const ipInfo = await page.evaluate(() => {
          return document.body.innerText;
        });

        try {
          const ipData = JSON.parse(ipInfo);
          console.log(`✓ Proxy IP: ${ipData.ip}\n`);

          // Navigate to geolocation check
          console.log('🌍 Checking geolocation...');
          await page.goto(`http://ip-api.com/json/${ipData.ip}`, { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
          });

          await new Promise(resolve => setTimeout(resolve, 2000));

          const geoInfo = await page.evaluate(() => {
            return document.body.innerText;
          });

          const geoData = JSON.parse(geoInfo);
          if (geoData.status === 'success') {
            console.log(`✓ Country: ${geoData.country} (${geoData.countryCode})`);
            console.log(`✓ Region: ${geoData.regionName}`);
            console.log(`✓ City: ${geoData.city}`);
            console.log(`✓ ISP: ${geoData.isp}`);
            console.log(`✓ Timezone: ${geoData.timezone}\n`);

            if (geoData.countryCode.toLowerCase() === countryCode.toLowerCase()) {
              console.log(`✅ SUCCESS: Proxy is routing through ${geoData.country}\n`);
            } else {
              console.log(`⚠️  WARNING: Expected ${countryCode} but got ${geoData.countryCode}\n`);
            }
          }
        } catch (err) {
          console.log('⚠️  Could not parse IP/geo information');
          console.log(`   ${err.message}\n`);
        }
      } catch (navError) {
        console.log('⚠️  Could not load IP verification page');
        console.log(`   ${navError.message}`);
        console.log('   Continuing to target URL...\n');
      }
    }

    // Navigate to start URL
    console.log(`📱 Navigating to ${startUrl}...`);
    try {
      await page.goto(startUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 90000 
      });
    } catch (navError) {
      console.log(`⚠️  Navigation took longer than expected, but page may have loaded`);
      console.log(`   You can continue testing manually\n`);
    }

    console.log('✓ Ready for testing!\n');
    console.log('='.repeat(60));
    if (headless) {
      console.log('Browser is running in headless mode with proxy configured.');
      console.log('Keeping browser open for 60 seconds for testing...');
      console.log('Press Ctrl+C to exit early.');
      console.log('='.repeat(60) + '\n');
      
      // Keep alive for testing
      await new Promise(resolve => setTimeout(resolve, 60000));
      await browser.close();
      console.log('\n✓ Browser closed\n');
    } else {
      console.log('Browser is now open with proxy configured.');
      console.log('You can manually test and verify the connection.');
      console.log('Close the browser window when done.');
      console.log('='.repeat(60) + '\n');

      // Wait for browser to close
      await new Promise(resolve => {
        browser.on('disconnected', () => {
          console.log('\n👋 Browser closed. Exiting...\n');
          resolve();
        });
      });
    }

  } catch (error) {
    console.error('\n❌ Error launching browser:');
    if (error.message.includes('timeout')) {
      console.error('   Connection timed out. The proxy may be slow or the page is taking too long to load.');
    } else if (error.message.includes('ERR_PROXY_CONNECTION_FAILED')) {
      console.error('   Proxy connection failed. Check your credentials and proxy configuration.');
    } else {
      console.error(`   ${error.message}`);
    }
    console.error('\nTroubleshooting:');
    console.error('  1. Verify IPROYAL_USERNAME and IPROYAL_PASSWORD in .env');
    console.error('  2. Check if your iproyal subscription is active');
    console.error('  3. Ensure the country code is supported by your plan');
    console.error('  4. Try running: node src/utils/test-proxy.js [COUNTRY_CODE]\n');
    process.exit(1);
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--country' || arg === '-c') {
      options.countryCode = args[++i];
    } else if (arg === '--url' || arg === '-u') {
      options.startUrl = args[++i];
    } else if (arg === '--no-ip-check') {
      options.showIP = false;
    } else if (arg === '--headless') {
      options.headless = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: node src/utils/launch-browser.js [options]

Options:
  -c, --country <CODE>    Country code for proxy (default: US)
                         Examples: US, DE, BR, UK, FR, etc.
  
  -u, --url <URL>        URL to navigate to after launch
                         Default: https://www.instagram.com
  
  --headless             Run in headless mode (RECOMMENDED for proxy)
                         GUI mode may fail due to Chrome background services
  
  --no-ip-check          Skip IP verification on launch
  
  -h, --help             Show this help message

Examples:
  # Launch with US proxy in headless mode (RECOMMENDED)
  node src/utils/launch-browser.js -c US --headless
  
  # Launch with German proxy and custom URL
  node src/utils/launch-browser.js -c DE -u https://www.google.com --headless
  
  # Launch without IP verification
  node src/utils/launch-browser.js -c BR --no-ip-check --headless

Note: Proxy authentication works best in headless mode. GUI mode may fail
      due to Chrome trying to connect to update services during startup.
      `);
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      // First non-flag argument is country code
      options.countryCode = arg;
    }
  }

  launchBrowserWithProxy(options).catch(err => {
    logger.error('Failed to launch browser with proxy', { error: err.message });
    process.exit(1);
  });
}

module.exports = launchBrowserWithProxy;

