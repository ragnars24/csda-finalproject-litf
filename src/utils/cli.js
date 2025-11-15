const readline = require('readline');
const fs = require('fs');
const { createLogger } = require('./logger');
const logger = createLogger('CLI');

/**
 * Check if running in Docker/container environment
 * @returns {boolean} True if running in Docker
 */
function isDockerEnvironment() {
  try {
    return process.env.FORCE_HEADLESS === 'true' ||
           !!process.env.PUPPETEER_EXECUTABLE_PATH || 
           fs.existsSync('/.dockerenv') || 
           (fs.existsSync('/proc/1/cgroup') && fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker'));
  } catch (e) {
    return false;
  }
}

/**
 * Prompts the user for input in the console.
 * @param {string} query The question to ask the user.
 * @returns {Promise<string>} The user's input.
 */
function promptUser(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

/**
 * Prompts the user for a 2FA/MFA code.
 * In Docker environments, checks for environment variable or auto-skips after timeout.
 * @param {Object} options - Options for the prompt
 * @param {string} options.email - Email address to check
 * @param {string} options.username - Username for email login
 * @param {string} options.password - Password for email login
 * @returns {Promise<string|null>} The verification code, or null if user pressed Enter to skip.
 */
async function promptForCode(options = {}) {
  const { email, username, password } = options;
  const isDocker = isDockerEnvironment();
  
  // Enhanced visibility prompt
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📱 VERIFICATION CODE INPUT');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Please enter your verification code.');
  console.log('This may be:');
  console.log('  • A 6-digit code from your authenticator app (2FA)');
  console.log('  • A security code sent to your email or phone');
  console.log('');
  
  if (isDocker) {
    console.log('🐳 Docker environment detected.');
    console.log('   Screenshot has been saved for review.');
    console.log('   To provide verification code:');
    console.log('   1. Review the screenshot in the mounted volume');
    console.log('   2. Set VERIFICATION_CODE environment variable and restart');
    console.log('   3. Or run container interactively: docker compose run --rm -it <service>');
    console.log('');
    console.log('   Auto-skipping verification (treating as false positive)...');
    console.log('   If verification is actually required, set VERIFICATION_CODE env var.');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    
    // Check for environment variable first
    if (process.env.VERIFICATION_CODE) {
      const envCode = process.env.VERIFICATION_CODE.trim();
      logger.info(`Using verification code from VERIFICATION_CODE environment variable`);
      return envCode;
    }
    
    // In Docker without interactive mode, auto-skip
    logger.warn('Docker environment: No VERIFICATION_CODE env var set, skipping verification');
    return null;
  }
  
  console.log('💡 Tip: If this is a false positive, press Enter to skip.');
  console.log('═══════════════════════════════════════════════════════════');
  
  // If email credentials are provided, show instructions to check email
  if (email && username && password) {
    // Extract domain from email
    const domain = email.includes('@') ? email.split('@')[1] : null;
    
    if (domain) {
      console.log('');
      console.log('📧 To check your email for the verification code:');
      console.log(`   Please navigate to https://${domain} and login with:`);
      console.log(`   User: ${username}`);
      console.log(`   Password: ${password}`);
      console.log('');
    }
  }
  
  const code = await promptUser('Enter verification code (or press Enter to skip): ');
  
  console.log('');
  
  const trimmedCode = code.trim();
  
  // If user pressed Enter without entering anything, return null to skip
  if (trimmedCode.length === 0) {
    console.log('⏭️  Skipping verification (false positive detected)');
    return null;
  }
  
  return trimmedCode;
}

module.exports = {
  promptUser,
  promptForCode,
  isDockerEnvironment,
};
