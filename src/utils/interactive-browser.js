#!/usr/bin/env node

require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const ProxyManager = require('../services/proxy');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

class InteractiveBrowser {
  constructor(countryCode = 'US') {
    this.countryCode = countryCode;
    this.browser = null;
    this.page = null;
    this.proxyManager = new ProxyManager();
    this.screenshotDir = './screenshots';
  }

  async start() {
    console.log('\n' + '='.repeat(60));
    console.log('🌐 Interactive Headless Browser with Proxy');
    console.log('='.repeat(60) + '\n');

    // Create screenshots directory
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }

    // Get proxy config
    const proxyConfig = this.proxyManager.getProxyConfig(this.countryCode);
    if (!proxyConfig) {
      console.error('❌ Proxy not configured. Check your .env file.\n');
      process.exit(1);
    }

    console.log('Proxy Configuration:');
    console.log(`  Country: ${this.countryCode}`);
    console.log(`  Server: ${proxyConfig.server}\n`);

    // Launch browser
    console.log('🚀 Launching browser in headless mode...');
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        `--proxy-server=${proxyConfig.server}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1280, height: 800 });
    await this.page.authenticate({
      username: proxyConfig.username,
      password: proxyConfig.password
    });

    console.log('✓ Browser launched and ready!\n');

    // Show commands
    this.showHelp();

    // Start interactive prompt
    await this.startPrompt();
  }

  showHelp() {
    console.log('Available Commands:');
    console.log('==================');
    console.log('  goto <url>              - Navigate to URL');
    console.log('  screenshot [name]       - Take screenshot (saved to ./screenshots/)');
    console.log('  click <selector>        - Click element (CSS selector)');
    console.log('  type <selector> <text>  - Type text into element');
    console.log('  content                 - Get page content (first 500 chars)');
    console.log('  title                   - Get page title');
    console.log('  url                     - Get current URL');
    console.log('  eval <code>             - Execute JavaScript on page');
    console.log('  ip                      - Check current IP');
    console.log('  wait <ms>               - Wait for milliseconds');
    console.log('  help                    - Show this help');
    console.log('  exit                    - Close browser and exit');
    console.log('');
  }

  async startPrompt() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '🌐 > '
    });

    rl.prompt();

    rl.on('line', async (line) => {
      const command = line.trim();
      
      if (!command) {
        rl.prompt();
        return;
      }

      try {
        await this.handleCommand(command);
      } catch (error) {
        console.error(`❌ Error: ${error.message}`);
      }

      if (command !== 'exit') {
        rl.prompt();
      }
    });

    rl.on('close', async () => {
      console.log('\n👋 Closing browser...');
      if (this.browser) {
        await this.browser.close();
      }
      process.exit(0);
    });
  }

  async handleCommand(command) {
    const parts = command.split(' ');
    const cmd = parts[0].toLowerCase();

    switch (cmd) {
      case 'goto':
        await this.goto(parts.slice(1).join(' '));
        break;

      case 'screenshot':
        await this.screenshot(parts[1] || `screenshot-${Date.now()}`);
        break;

      case 'click':
        await this.click(parts.slice(1).join(' '));
        break;

      case 'type':
        if (parts.length < 3) {
          console.log('Usage: type <selector> <text>');
          break;
        }
        await this.typeText(parts[1], parts.slice(2).join(' '));
        break;

      case 'content':
        await this.getContent();
        break;

      case 'title':
        await this.getTitle();
        break;

      case 'url':
        console.log(`Current URL: ${this.page.url()}`);
        break;

      case 'eval':
        await this.evaluate(parts.slice(1).join(' '));
        break;

      case 'ip':
        await this.checkIP();
        break;

      case 'wait':
        const ms = parseInt(parts[1]) || 1000;
        console.log(`⏳ Waiting ${ms}ms...`);
        await new Promise(resolve => setTimeout(resolve, ms));
        console.log('✓ Done');
        break;

      case 'help':
        this.showHelp();
        break;

      case 'exit':
        console.log('\n👋 Goodbye!');
        if (this.browser) {
          await this.browser.close();
        }
        process.exit(0);
        break;

      default:
        console.log(`Unknown command: ${cmd}. Type 'help' for available commands.`);
    }
  }

  async goto(url) {
    if (!url) {
      console.log('Usage: goto <url>');
      return;
    }

    // Add https:// if no protocol specified
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    console.log(`📱 Navigating to ${url}...`);
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`✓ Loaded: ${this.page.url()}`);
  }

  async screenshot(name) {
    const filename = name.endsWith('.png') ? name : `${name}.png`;
    const filepath = path.join(this.screenshotDir, filename);
    
    console.log(`📸 Taking screenshot...`);
    await this.page.screenshot({ path: filepath, fullPage: true });
    console.log(`✓ Screenshot saved: ${filepath}`);
  }

  async click(selector) {
    if (!selector) {
      console.log('Usage: click <selector>');
      return;
    }

    console.log(`🖱️  Clicking: ${selector}`);
    await this.page.waitForSelector(selector, { timeout: 5000 });
    await this.page.click(selector);
    console.log('✓ Clicked');
  }

  async typeText(selector, text) {
    console.log(`⌨️  Typing into ${selector}...`);
    await this.page.waitForSelector(selector, { timeout: 5000 });
    await this.page.type(selector, text);
    console.log('✓ Text entered');
  }

  async getContent() {
    const content = await this.page.content();
    const preview = content.substring(0, 500);
    console.log('Page Content (first 500 chars):');
    console.log('-'.repeat(60));
    console.log(preview);
    console.log('-'.repeat(60));
    console.log(`Total length: ${content.length} characters`);
  }

  async getTitle() {
    const title = await this.page.title();
    console.log(`Page Title: ${title}`);
  }

  async evaluate(code) {
    if (!code) {
      console.log('Usage: eval <javascript code>');
      return;
    }

    console.log(`⚙️  Executing: ${code}`);
    const result = await this.page.evaluate(code);
    console.log('Result:', result);
  }

  async checkIP() {
    console.log('🔍 Checking IP...');
    const currentUrl = this.page.url();
    
    await this.page.goto('https://api.ipify.org?format=json', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    
    const ipInfo = await this.page.evaluate(() => document.body.innerText);
    const ipData = JSON.parse(ipInfo);
    console.log(`✓ IP: ${ipData.ip}`);
    
    // Get geolocation
    await this.page.goto(`http://ip-api.com/json/${ipData.ip}`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    
    const geoInfo = await this.page.evaluate(() => document.body.innerText);
    const geoData = JSON.parse(geoInfo);
    
    if (geoData.status === 'success') {
      console.log(`✓ Country: ${geoData.country} (${geoData.countryCode})`);
      console.log(`✓ City: ${geoData.city}, ${geoData.regionName}`);
    }
    
    // Go back to previous URL if it wasn't empty
    if (currentUrl && currentUrl !== 'about:blank') {
      await this.page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      console.log(`✓ Returned to: ${currentUrl}`);
    }
  }
}

// Main
if (require.main === module) {
  const args = process.argv.slice(2);
  let countryCode = 'US';

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-c' || args[i] === '--country') {
      countryCode = args[++i];
    } else if (args[i] === '-h' || args[i] === '--help') {
      console.log(`
Interactive Headless Browser with Proxy

Usage: node src/utils/interactive-browser.js [options]

Options:
  -c, --country <CODE>   Country code for proxy (default: US)
  -h, --help            Show this help

Examples:
  node src/utils/interactive-browser.js
  node src/utils/interactive-browser.js -c DE

Once started, you can interact with the browser using commands.
Type 'help' to see all available commands.
      `);
      process.exit(0);
    }
  }

  const browser = new InteractiveBrowser(countryCode);
  browser.start().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
}

module.exports = InteractiveBrowser;

