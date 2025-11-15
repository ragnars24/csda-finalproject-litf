const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const { createLogger } = require('../utils/logger');
const logger = createLogger('PersonaLoader');

class Persona {
  constructor(personasDir = path.join(process.cwd(), 'personas', 'active')) {
    this.personasDir = personasDir;
  }

  /**
   * Load a specific persona by ID
   * @param {string} personaId - The persona ID to load
   * @returns {Object} Parsed persona configuration
   */
  loadPersona(personaId) {
    const personaPath = path.join(this.personasDir, `${personaId}.yaml`);
    
    if (!fs.existsSync(personaPath)) {
      throw new Error(`Persona file not found: ${personaPath}`);
    }

    try {
      const fileContents = fs.readFileSync(personaPath, 'utf8');
      const persona = yaml.parse(fileContents);
      
      // Replace environment variable placeholders
      this.replaceEnvVariables(persona);
      
      // Validate persona structure
      this.validatePersona(persona);
      
      logger.info(`Loaded persona: ${personaId}`);
      return persona;
    } catch (error) {
      logger.error(`Failed to load persona ${personaId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load all personas from the active directory
   * @returns {Array} Array of persona configurations
   */
  loadAllPersonas() {
    if (!fs.existsSync(this.personasDir)) {
      logger.warn(`Personas directory not found: ${this.personasDir}`);
      return [];
    }

    const files = fs.readdirSync(this.personasDir)
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

    return files.map(file => {
      const personaId = path.basename(file, path.extname(file));
      return this.loadPersona(personaId);
    });
  }

  /**
   * Replace environment variable placeholders in persona config
   * @param {Object} obj - Object to process
   */
  replaceEnvVariables(obj) {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        // Match ${VAR_NAME} pattern
        const match = obj[key].match(/^\$\{(.+)\}$/);
        if (match) {
          const envVar = match[1];
          if (!process.env[envVar]) {
            throw new Error(`Environment variable ${envVar} not found`);
          }
          obj[key] = process.env[envVar];
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.replaceEnvVariables(obj[key]);
      }
    }
  }

  /**
   * Validate persona configuration structure
   * @param {Object} persona - Persona configuration to validate
   */
  validatePersona(persona) {
    const required = [
      'persona_id',
      'region',
      'political_spectrum',
      'demographics',
      'credentials',
      'proxy',
      'political_figures'
    ];

    for (const field of required) {
      if (!persona[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate credentials
    if (!persona.credentials.username || !persona.credentials.password) {
      throw new Error('Missing username or password in credentials');
    }

    // Validate political figures
    if (!persona.political_figures.follows || persona.political_figures.follows.length === 0) {
      throw new Error('No political figures specified');
    }

    logger.debug(`Validated persona: ${persona.persona_id}`);
  }

  /**
   * Get personas by filter criteria
   * @param {Object} filter - Filter criteria (region, political_spectrum, etc.)
   * @returns {Array} Filtered personas
   */
  getPersonasBy(filter) {
    const allPersonas = this.loadAllPersonas();
    
    return allPersonas.filter(persona => {
      for (const key in filter) {
        if (persona[key] !== filter[key]) {
          return false;
        }
      }
      return true;
    });
  }
}

// For backward compatibility
class PersonaLoader extends Persona {}

module.exports = Persona;
module.exports.PersonaLoader = PersonaLoader;
