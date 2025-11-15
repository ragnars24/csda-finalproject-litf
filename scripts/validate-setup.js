#!/usr/bin/env node

/**
 * Setup Validation Script
 * Validates the environment and setup before running the scraper
 */

const fs = require('fs');
const path = require('path');

const errors = [];
const warnings = [];

// Check Node.js version (require >= 14.0.0)
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
if (majorVersion < 14) {
  errors.push(`Node.js version ${nodeVersion} is too old. Requires >= 14.0.0`);
} else {
  console.log(`✓ Node.js version: ${nodeVersion}`);
}

// Check if .env file exists
const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  warnings.push('.env file not found. Copy env.example to .env and configure it.');
} else {
  console.log('✓ .env file found');
  
  // Check for required environment variables
  require('dotenv').config();
  
  // Check for at least one persona configuration
  const hasPersona = Object.keys(process.env).some(key => 
    key.startsWith('PERSONA_') && key.endsWith('_USERNAME')
  );
  
  if (!hasPersona) {
    warnings.push('No persona credentials found in .env. Configure at least one persona.');
  } else {
    console.log('✓ Persona credentials found');
  }
  
  // Check proxy configuration (optional but recommended)
  if (!process.env.IPROYAL_USERNAME || !process.env.IPROYAL_PASSWORD) {
    warnings.push('Proxy credentials not configured. Scraper will run without proxy.');
  } else {
    console.log('✓ Proxy credentials found');
  }
}

// Check if node_modules exists
const nodeModulesPath = path.join(process.cwd(), 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
  errors.push('node_modules not found. Run "npm install" first.');
} else {
  console.log('✓ Dependencies installed');
}

// Check required directories
const requiredDirs = ['data', 'logs', 'personas/active', 'personas/templates'];
requiredDirs.forEach(dir => {
  const dirPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(dirPath)) {
    warnings.push(`Directory "${dir}" does not exist. It will be created automatically.`);
  }
});

// Check if persona YAML files exist
const personasDir = path.join(process.cwd(), 'personas', 'active');
if (fs.existsSync(personasDir)) {
  const personaFiles = fs.readdirSync(personasDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  if (personaFiles.length === 0) {
    warnings.push('No persona YAML files found in personas/active/. Add persona configuration files.');
  } else {
    console.log(`✓ Found ${personaFiles.length} persona file(s)`);
  }
} else {
  warnings.push('personas/active/ directory does not exist.');
}

// Print results
console.log('\n' + '='.repeat(60));
if (errors.length === 0 && warnings.length === 0) {
  console.log('✓ Setup validation passed!');
  process.exit(0);
} else {
  if (errors.length > 0) {
    console.log('✗ ERRORS:');
    errors.forEach(err => console.log(`  - ${err}`));
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠ WARNINGS:');
    warnings.forEach(warn => console.log(`  - ${warn}`));
  }
  
  if (errors.length > 0) {
    console.log('\nPlease fix the errors above before running the scraper.');
    process.exit(1);
  } else {
    console.log('\nSetup is mostly complete. Warnings can be addressed but are not critical.');
    process.exit(0);
  }
}

