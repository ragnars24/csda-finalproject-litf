const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Determine log level based on environment
// Production defaults to 'info', development can use 'debug'
const getLogLevel = () => {
  if (process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL;
  }
  // Default to 'info' for production-like behavior (minimal terminal output)
  return process.env.NODE_ENV === 'development' ? 'debug' : 'info';
};

const logger = winston.createLogger({
  level: getLogLevel(),
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    // Custom format to ensure child logger service name overrides parent
    winston.format((info) => {
      // If component is set, always use it as service name (override parent defaultMeta)
      if (info.component) {
        info.service = info.component;
      }
      return info;
    })(),
    winston.format.json()
  ),
  defaultMeta: { service: 'instagram-scraper' },
  transports: [
    // Write all logs to file
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log') 
    }),
    new winston.transports.File({ 
      filename: path.join(logsDir, 'debug.log'),
      level: 'debug'
    })
  ]
});

// Always log to console with clear format
logger.add(new winston.transports.Console({
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
      return `${timestamp} [${level}]: ${message} ${metaStr}`;
    })
  )
}));

/**
 * Create a component-specific logger
 * @param {string} componentName - Name of the component/service
 * @returns {winston.Logger} Logger instance with component metadata
 */
function createLogger(componentName = 'instagram-scraper') {
  // Create child logger - Winston will merge metadata
  // The custom format function will ensure component name becomes service name
  return logger.child({ 
    component: componentName
  });
}

// Export both default logger and factory function
module.exports = logger;
module.exports.createLogger = createLogger;

