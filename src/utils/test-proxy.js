#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const Persona = require('../services/persona');

/**
 * Test a single proxy by country code (backward compatibility)
 * @param {string} countryCode - ISO country code
 */
async function testSingleProxy(countryCode = 'US') {
  console.log(`\n${'='.repeat(60)}`);
  console.log('iproyal Residential Proxy Test');
  console.log(`${'='.repeat(60)}\n`);

  // Get proxy credentials from environment
  const username = process.env.IPROYAL_USERNAME;
  const password = process.env.IPROYAL_PASSWORD;
  const host = process.env.IPROYAL_HOST || 'geo.iproyal.com';
  const port = process.env.IPROYAL_PORT || '12321';

  if (!username || !password) {
    console.error('❌ Error: Proxy credentials not found in .env file');
    console.error('   Please set IPROYAL_USERNAME and IPROYAL_PASSWORD\n');
    process.exit(1);
  }

  console.log('Proxy Configuration:');
  console.log(`  Host: ${host}`);
  console.log(`  Port: ${port}`);
  console.log(`  Username: ${username}`);
  console.log(`  Target Country: ${countryCode}`);

  // Build proxy URL with country routing
  const sessionId = `test${Date.now()}`;
  const fullPassword = `${password}_country-${countryCode.toLowerCase()}_session-${sessionId}_lifetime-168h`;
  const proxyUrl = `http://${username}:${fullPassword}@${host}:${port}`;

  const proxy = {
    name: `Country Proxy (${countryCode})`,
    username: username,
    password: fullPassword,
    host: host,
    port: port,
    country_code: countryCode
  };

  const result = await testProxy(proxy);
  
  console.log(`\nTesting proxy connection...\n`);
  
  if (result.success) {
    console.log(`   ✓ IP: ${result.ip}`);
    if (result.geo) {
      console.log(`   ✓ Country: ${result.geo.country} (${result.geo.countryCode})`);
      console.log(`   ✓ Location: ${result.geo.city}, ${result.geo.region}`);
      console.log(`   ✓ ISP: ${result.geo.isp}`);
      console.log(`   ✓ Type: ${result.isResidential ? 'Residential' : 'Datacenter'}`);
      
      if (result.geo.countryCode.toLowerCase() === countryCode.toLowerCase()) {
        console.log(`\n✅ SUCCESS: Proxy is routing through ${result.geo.country}`);
      } else {
        console.log(`\n⚠️  WARNING: Expected ${countryCode} but got ${result.geo.countryCode}`);
      }
    }
    console.log(`\n${'='.repeat(60)}`);
    console.log('Proxy Test Complete');
    console.log(`${'='.repeat(60)}\n`);
  } else {
    console.error(`\n❌ Proxy test failed: ${result.error}`);
    process.exit(1);
  }
}

/**
 * Parse CSV file and return array of proxy configurations
 * @param {string} csvPath - Path to proxies.csv file
 * @returns {Array<Object>} Array of proxy configurations
 */
function parseProxiesCSV(csvPath) {
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Error: proxies.csv not found at ${csvPath}`);
    console.error('   Please create proxies.csv with the following format:');
    console.error('   name,username,password,host,port,country_code');
    console.error('   Example:');
    console.error('   BR Proxy,Jk798w814bQGpNtA,tHDiBLhCwNXTYikm_country-br_session-xyz_lifetime-59m,geo.iproyal.com,12321,BR');
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  
  if (lines.length < 2) {
    console.error('❌ Error: proxies.csv must have at least a header row and one data row');
    process.exit(1);
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const proxies = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length !== headers.length) {
      console.warn(`⚠️  Skipping row ${i + 1}: incorrect number of columns`);
      continue;
    }

    const proxy = {};
    headers.forEach((header, index) => {
      proxy[header] = values[index];
    });

    // Validate required fields
    if (!proxy.username || !proxy.password || !proxy.host || !proxy.port) {
      console.warn(`⚠️  Skipping row ${i + 1}: missing required fields`);
      continue;
    }

    proxies.push(proxy);
  }

  return proxies;
}

/**
 * Extract proxies from persona YAML files
 * @returns {Array<Object>} Array of proxy configurations
 */
function extractProxiesFromPersonas() {
  const personaLoader = new Persona();
  const personas = personaLoader.loadAllPersonas();
  const proxies = [];

  personas.forEach(persona => {
    if (persona.proxy && persona.proxy.username && persona.proxy.password) {
      proxies.push({
        name: `${persona.persona_id} (${persona.region})`,
        username: persona.proxy.username,
        password: persona.proxy.password,
        host: persona.proxy.host || 'geo.iproyal.com',
        port: persona.proxy.port || '12321',
        country_code: persona.region || 'Unknown',
        persona_id: persona.persona_id
      });
    }
  });

  return proxies;
}

/**
 * Test a single proxy configuration
 * @param {Object} proxy - Proxy configuration object
 * @returns {Promise<Object>} Test result object
 */
async function testProxy(proxy) {
  const result = {
    name: proxy.name || 'Unknown',
    username: proxy.username,
    host: proxy.host,
    port: proxy.port,
    country_code: proxy.country_code || 'Unknown',
    success: false,
    ip: null,
    geo: null,
    error: null,
    isResidential: null
  };

  const proxyUrl = `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;

  try {
    // Create proxy agent
    const agent = new HttpsProxyAgent(proxyUrl);

    // Test 1: Get IP address through proxy
    const ipResponse = await axios.get('https://api.ipify.org?format=json', {
      httpsAgent: agent,
      timeout: 15000
    });

    result.ip = ipResponse.data.ip;

    // Test 2: Get geolocation of proxy IP
    const geoResponse = await axios.get(`http://ip-api.com/json/${result.ip}`, {
      timeout: 10000
    });

    const geo = geoResponse.data;
    if (geo.status === 'success') {
      result.geo = {
        country: geo.country,
        countryCode: geo.countryCode,
        region: geo.regionName,
        city: geo.city,
        isp: geo.isp,
        timezone: geo.timezone
      };

      // Check if residential
      result.isResidential = !geo.isp.toLowerCase().includes('datacenter') && 
                             !geo.isp.toLowerCase().includes('hosting');
    }

    result.success = true;
  } catch (error) {
    result.error = error.message;
    if (error.code) {
      result.error = `${error.code}: ${result.error}`;
    }
  }

  return result;
}

/**
 * Test all proxies from CSV file
 */
async function testAllProxies() {
  const csvPath = path.join(process.cwd(), 'proxies.csv');
  
  // Try to read from CSV, if not found, extract from personas
  let proxies;
  if (fs.existsSync(csvPath)) {
    console.log('📄 Reading proxies from proxies.csv...\n');
    proxies = parseProxiesCSV(csvPath);
  } else {
    console.log('📄 proxies.csv not found. Extracting proxies from persona files...\n');
    proxies = extractProxiesFromPersonas();
    
    if (proxies.length === 0) {
      console.error('❌ No proxies found in persona files');
      console.error('   Please create proxies.csv or ensure personas have proxy configurations');
      process.exit(1);
    }
  }

  console.log(`${'='.repeat(80)}`);
  console.log(`Testing ${proxies.length} Proxy Configuration(s)`);
  console.log(`${'='.repeat(80)}\n`);

  const results = [];
  
  for (let i = 0; i < proxies.length; i++) {
    const proxy = proxies[i];
    console.log(`[${i + 1}/${proxies.length}] Testing: ${proxy.name || proxy.persona_id || 'Unknown'}`);
    console.log(`   Host: ${proxy.host}:${proxy.port}`);
    console.log(`   Username: ${proxy.username}`);
    console.log(`   Expected Country: ${proxy.country_code || 'Unknown'}`);
    
    const result = await testProxy(proxy);
    results.push(result);

    if (result.success) {
      console.log(`   ✓ IP: ${result.ip}`);
      if (result.geo) {
        console.log(`   ✓ Country: ${result.geo.country} (${result.geo.countryCode})`);
        console.log(`   ✓ Location: ${result.geo.city}, ${result.geo.region}`);
        console.log(`   ✓ ISP: ${result.geo.isp}`);
        console.log(`   ✓ Type: ${result.isResidential ? 'Residential' : 'Datacenter'}`);
        
        // Verify country matches
        if (proxy.country_code && result.geo.countryCode.toLowerCase() !== proxy.country_code.toLowerCase()) {
          console.log(`   ⚠️  WARNING: Expected ${proxy.country_code} but got ${result.geo.countryCode}`);
        } else {
          console.log(`   ✅ Country match verified`);
        }
      }
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
    }
    
    console.log('');
    
    // Small delay between tests
    if (i < proxies.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Summary
  console.log(`${'='.repeat(80)}`);
  console.log('Test Summary');
  console.log(`${'='.repeat(80)}`);
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`Total Proxies: ${results.length}`);
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('');

  if (successful > 0) {
    console.log('Successful Proxies:');
    results.filter(r => r.success).forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.name} - ${r.ip} (${r.geo?.country || 'Unknown'})`);
    });
    console.log('');
  }

  if (failed > 0) {
    console.log('Failed Proxies:');
    results.filter(r => !r.success).forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.name} - ${r.error}`);
    });
    console.log('');
  }

  console.log(`${'='.repeat(80)}\n`);

  // Exit with error code if any failed
  if (failed > 0) {
    process.exit(1);
  }
}

// Check if running in single-proxy mode (backward compatibility)
const args = process.argv.slice(2);
if (args.length > 0 && args[0].match(/^[A-Z]{2}$/i)) {
  // Single country code provided - use old behavior
  testSingleProxy(args[0]).catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
} else {
  // Test all proxies from CSV or personas
  testAllProxies().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}
