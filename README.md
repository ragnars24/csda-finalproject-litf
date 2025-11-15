# Instagram Reels Scraper

A Node.js-based Instagram Reels scraper with proxy support for collecting reel data for sentiment and bias analysis. Designed for research purposes with support for multiple personas and geographic routing.

## Overview

This tool navigates Instagram Reels feeds and collects reel data including captions, hashtags, engagement metrics, and metadata. It supports multiple personas with different geographic locations and political spectrums, making it suitable for comparative research studies.

## Quick Start for Code Reviewers

For instructors and code reviewers, see **[QUICK_START_POC.md](QUICK_START_POC.md)** for a minimal 10-minute setup guide.

## Architecture Documentation

- **[EXTRACTION_FLOW.md](EXTRACTION_FLOW.md)** - Detailed documentation of the extraction module architecture and data flow

## Features

- **Multi-Persona Support**: Run scrapers with different personas (geographic regions, political spectrums)
- **Proxy Integration**: Automatic proxy routing based on persona configuration (iproyal support)
- **Data Collection**: Collects reels data including captions, hashtags, likes, comments, views
- **CSV Storage**: Stores collected data in CSV format for easy analysis
- **Headless/Visible Modes**: Run in headless mode for production or visible browser for debugging
- **Comprehensive Logging**: Configurable logging levels with file and console output
- **Component-Specific Logging**: Each module logs with its component name (e.g., `[BandwidthOptimizer]`, `[GraphQLHandler]`) for easy debugging
- **Service Initialization Visibility**: Startup banner shows all services being initialized before login
- **Cookie Session Tracking**: Captures and logs cookies at key session points (login, scraping) for analysis
- **Dual Extraction Methods**: Primary GraphQL extraction with DOM fallback for reliability
- **Media Blocking**: Configurable resource blocking to optimize bandwidth
- **Docker Support**: Full Docker Compose support with concurrent persona execution

## Prerequisites

- **Node.js**: Version 14.0.0 or higher
- **npm**: Comes with Node.js
- **Instagram Accounts**: Configured persona accounts with credentials
- **Proxy Service** (optional but recommended): iproyal or compatible proxy service

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd csda-finalproject-litf
npm run setup
```

The setup script will:
- Install dependencies
- Create necessary directories
- Validate your configuration

### 2. Configure Environment

```bash
cp env.example .env
# Edit .env with your credentials
```

Minimum required configuration:
- At least one persona's credentials (USERNAME, PASSWORD, EMAIL)
- Proxy credentials (if using proxy)

### 3. Add Persona Configuration

Create YAML files in `personas/active/` directory. See `personas/templates/` for examples.

Example persona file (`personas/active/persona_de_right_001.yaml`):
```yaml
persona_id: persona_de_right_001
region: DE
political_spectrum: right
credentials:
  username: your_username
  password: your_password
proxy:
  country_code: DE
```

### 4. Run the Scraper

```bash
# Scrape all personas
npm run scrape

# Scrape specific persona
npm run scrape:persona persona_de_right_001

# Or use Makefile
make scrape
make scrape-persona PERSONA=persona_de_right_001
```

## Installation

### Standard Installation

```bash
# Install dependencies
npm install

# Create required directories
mkdir -p data logs personas/templates personas/active

# Validate setup
npm run validate
```

### Docker Installation

```bash
# Build the image
docker build -t instagram-scraper .

# Run with docker-compose
docker-compose up -d

# Or run directly
docker run --env-file .env -v $(pwd)/data:/app/data -v $(pwd)/logs:/app/logs instagram-scraper
```

## Configuration

### Environment Variables

See `env.example` for complete configuration options. Key variables:

**Required:**
- `PERSONA_*_USERNAME`: Instagram username for each persona
- `PERSONA_*_PASSWORD`: Instagram password for each persona
- `PERSONA_*_EMAIL`: Email address for each persona

**Optional:**
- `IPROYAL_USERNAME`: Proxy username (if using proxy)
- `IPROYAL_PASSWORD`: Proxy password (if using proxy)
- `IPROYAL_HOST`: Proxy host (default: proxy.iproyal.com)
- `IPROYAL_PORT`: Proxy port (default: 12321)
- `LOG_LEVEL`: Logging level - 'error', 'warn', 'info', 'debug' (default: 'info')

**Note:** Proxy defaults (enabled/disabled) are configured in `src/config/defaults.js` (proxy.enabled). The docker-compose generation script reads from this file to set default behavior.

### Persona Configuration

Persona YAML files define the scraper's behavior for each account:

```yaml
persona_id: persona_de_right_001
region: DE
political_spectrum: right
age: 35
gender: male
credentials:
  username: ${PERSONA_DE_RIGHT_001_USERNAME}
  password: ${PERSONA_DE_RIGHT_001_PASSWORD}
proxy:
  country_code: DE
  sticky_session: true
```

Place persona files in `personas/active/` directory.

### Media Blocking Configuration

Media blocking can be configured via:
1. **Command-line:** `--block-media image,media` or `--block-media none`
2. **Environment variable:** `BLOCK_MEDIA=image,media` (for Docker)
3. **Default config:** `src/config/defaults.js` (bandwidth.blockMediaTypes)

**Valid types:** `image`, `stylesheet`, `font`, `media`, `script`, `document`, `xhr`, `fetch`, `websocket`, `manifest`, `texttrack`, `other`

**Special values:**
- `none` - Disable blocking (load all resources)
- `all` - Block common types (image, stylesheet, font, media)

## Usage

### Basic Commands

```bash
# Scrape all configured personas
npm run scrape

# Scrape specific persona
npm run scrape:persona <persona_id>

# Test proxy connection
npm run test-proxy

# Launch interactive browser (for debugging)
npm run browser:interactive
```

### Makefile Commands

```bash
# Setup project
make install

# Scrape all personas (headless)
make scrape

# Scrape specific persona
make scrape PERSONA=persona_de_right_001

# Scrape with visible browser
make scrape PERSONA=persona_de_right_001 HEADLESS=false

# Scrape without proxy
make scrape NO_PROXY=true

# Scrape with custom media blocking
make scrape BLOCK_MEDIA=image,media
make scrape BLOCK_MEDIA=none  # Disable blocking
make scrape BLOCK_MEDIA=all    # Block all media types

# Test proxy
make test-proxy-country COUNTRY=DE

# Launch interactive browser
make interactive-browser COUNTRY=DE

# Docker commands
make docker-generate-personas              # Generate docker-compose.personas.yml
make docker-build FILE=docker-compose.personas.yml  # Build images
make docker-up FILE=docker-compose.personas.yml     # Start containers
make docker-up-interactive                # Run all personas interactively
make docker-run-interactive PERSONA=persona-br-right-male-001  # Run specific persona interactively

# Clean temporary files
make clean
```

### Command-Line Options

```bash
# Headless mode (default)
node src/main.js --persona <persona_id> --headless

# Visible browser mode
node src/main.js --persona <persona_id> --head

# Disable proxy
node src/main.js --persona <persona_id> --no-proxy

# Block specific media types
node src/main.js --persona <persona_id> --block-media image,media
node src/main.js --persona <persona_id> --block-media none   # Disable blocking
node src/main.js --persona <persona_id> --block-media all    # Block all media types

# Valid media types for --block-media:
# image, stylesheet, font, media, script, document, xhr, fetch, websocket, manifest, texttrack, other

# Scrape all personas
node src/main.js
```

## Output

### Data Files

- **`data/posts.csv`**: Collected reel data
  - Columns: timestamp, persona_id, region, political_spectrum, feed_type, post_id, author_username, caption, likes_count, comments_count, view_count, hashtags, created_at, media_type

- **`data/sessions.csv`**: Scraping session summaries
  - Columns: timestamp, persona_id, region, political_spectrum, feed_type, posts_collected, likes_performed, duration_seconds

- **`data/raw/`**: Raw intercepted network packets (JSONL format)

- **`data/cookies/`**: Cookie session data (CSV format)
  - Files: `cookies_<persona_id>.csv`
  - Columns: timestamp, persona_id, stage, cookie_name, cookie_value, domain, path, expires, httpOnly, secure, sameSite
  - Stages: pre-login, post-login, pre-scraping, post-scraping, error

### Logs

- **`logs/error.log`**: Error messages only
- **`logs/debug.log`**: Debug level and above
- **`logs/combined.log`**: All log messages

## Deployment

### Docker Deployment

#### Single Container (Sequential Scraping)

1. **Build the image:**
   ```bash
   docker build -t instagram-scraper .
   ```

2. **Configure environment:**
   ```bash
   cp env.example .env
   # Edit .env with your credentials
   ```

3. **Run with docker compose (scrapes all personas sequentially):**
   ```bash
   docker compose up -d
   ```

4. **View logs:**
   ```bash
   docker compose logs -f scraper
   ```

5. **Stop the service:**
   ```bash
   docker compose down
   ```

#### Multiple Containers (Concurrent Scraping)

To run multiple personas **concurrently** in separate containers:

1. **Generate docker-compose configuration for all personas:**
   ```bash
   node scripts/generate-docker-compose-personas.js
   # Or use Makefile:
   make docker-generate-personas
   ```
   This creates `docker-compose.personas.yml` with one service per persona YAML file in `personas/active/`.
   
   **Note:** The script reads proxy defaults from `src/config/defaults.js` (proxy.enabled). To change the default, edit that file and regenerate.

2. **Run all personas concurrently:**
   ```bash
   docker compose -f docker-compose.personas.yml up -d
   ```

3. **Run all personas interactively (for verification prompts):**
   ```bash
   make docker-up-interactive
   ```
   **Important:** When verification prompts appear, type the code and press Enter. Do NOT set `VERIFICATION_CODE` as an environment variable - it invalidates the session.

4. **Run specific persona interactively:**
   ```bash
   make docker-run-interactive PERSONA=persona-br-right-male-001
   ```

5. **Run specific personas:**
   ```bash
   # Run only specific persona(s)
   docker compose -f docker-compose.personas.yml up scraper-persona-persona-test-001
   
   # Run multiple specific personas
   docker compose -f docker-compose.personas.yml up scraper-persona-persona-test-001 scraper-persona-persona-de-right-001
   ```

6. **Environment Variables:**
   ```bash
   # Disable proxy for all containers
   USE_PROXY=false docker compose -f docker-compose.personas.yml up
   
   # Customize media blocking
   BLOCK_MEDIA=image,media docker compose -f docker-compose.personas.yml up
   BLOCK_MEDIA=none docker compose -f docker-compose.personas.yml up  # Disable blocking
   BLOCK_MEDIA=all docker compose -f docker-compose.personas.yml up   # Block all media types
   ```

7. **View logs:**
   ```bash
   # All containers
   docker compose -f docker-compose.personas.yml logs -f
   
   # Specific container
   docker compose -f docker-compose.personas.yml logs -f scraper-persona-persona-test-001
   ```

8. **Stop all services:**
   ```bash
   docker compose -f docker-compose.personas.yml down
   ```

**Note:** Each persona runs in its own container with separate browser instances. All containers share the same `data/` and `logs/` directories, so collected data is aggregated in the same CSV files.

**Service Visibility:** The scraper now shows a startup banner listing all services being initialized (BrowserFactory, GraphQLHandler, BandwidthOptimizer, etc.) with component-specific logging for easier debugging.

### Production Considerations

- Set `LOG_LEVEL=info` for minimal terminal output
- Use headless mode (`--headless`) for production
- Configure proper resource limits in docker-compose.yml
- Ensure `.env` file is secure and not committed to version control
- Monitor disk space for data and logs directories
- Consider rate limiting to avoid Instagram detection

### Scaling

For multiple concurrent scrapers:

1. Use different proxy endpoints for each instance
2. Distribute personas across instances
3. Use container orchestration (Kubernetes, Docker Swarm) for multiple instances
4. Monitor resource usage and adjust limits accordingly

## Project Structure

```
.
├── src/
│   ├── browser/                      # Browser interaction and navigation
│   │   ├── browser-factory.js        # Browser launch and configuration
│   │   ├── browser-lifecycle.js      # Browser lifecycle management
│   │   ├── clicking.js               # Clicking utilities
│   │   ├── navigation-strategies.js  # Navigation strategy implementations
│   │   ├── page-navigator.js        # General page navigation
│   │   ├── reel-navigator.js        # Reel-specific navigation
│   │   ├── screenshot-handler.js     # Screenshot functionality
│   │   ├── scrolling.js             # Scrolling utilities
│   │   └── typing.js                # Typing utilities
│   ├── config/                       # Configuration
│   │   └── puppeteer-options.js      # Puppeteer launch options
│   ├── core/                         # Core scraper logic
│   │   └── scraper.js                # Main scraper orchestrator
│   ├── extraction/                   # Data extraction logic
│   │   ├── dom-extractor.js          # DOM-based extraction
│   │   ├── graphql-extractor.js     # GraphQL response extraction
│   │   ├── hashtag-extractor.js     # Hashtag extraction utilities
│   │   ├── reel-collector.js        # Reel data collection manager
│   │   └── reel-data-transformer.js # Data transformation utilities
│   ├── network/                      # Network interception
│   │   ├── bandwidth-optimizer.js   # Bandwidth optimization
│   │   ├── graphql-handler.js       # GraphQL response handler
│   │   ├── packet-storage.js        # Packet storage wrapper
│   │   └── request-interceptor.js   # Network request interception
│   ├── services/                     # Business logic services
│   │   ├── auth-utils.js            # Authentication utilities
│   │   ├── cookie-handler.js        # Cookie banner handling
│   │   ├── engagement-strategy.js  # Engagement decision logic
│   │   ├── like-handler.js          # Like functionality
│   │   ├── login-flow.js            # Login flow orchestration
│   │   ├── persona.js               # Persona loading and management
│   │   ├── proxy.js                 # Proxy manager wrapper
│   │   └── verification-handler.js # 2FA/verification handling
│   ├── storage/                     # Data storage
│   │   └── csv-storage.js           # CSV data storage
│   ├── utils/                       # Utility functions
│   │   ├── cli.js                   # CLI utilities
│   │   ├── ip-checker.js            # IP/location checking
│   │   ├── launch-browser.js        # Browser launch utility
│   │   ├── logger.js                # Logging configuration
│   │   ├── random.js                # Random delay utilities
│   │   └── test-proxy.js            # Proxy testing utility
│   └── main.js                      # Main entry point
├── proxy/
│   └── proxy-manager.js             # Proxy configuration manager
├── personas/
│   ├── active/                      # Active persona configurations
│   └── templates/                   # Persona templates
├── data/                            # Collected data (CSV files)
├── logs/                            # Log files
├── scripts/
│   └── validate-setup.js           # Setup validation script
├── Dockerfile                       # Docker image definition
├── docker-compose.yml               # Docker Compose configuration
├── package.json                     # Node.js dependencies
└── env.example                      # Environment variables template
```

## Troubleshooting

### Common Issues

**1. Login Failures**
- Verify credentials in `.env` file
- Check if Instagram requires 2FA (verification code)
- **For Docker:** Run interactively (`make docker-run-interactive`) and enter verification code when prompted
- **Important:** Do NOT set `VERIFICATION_CODE` as environment variable - it invalidates the session
- Ensure proxy is working correctly
- Try running in visible browser mode (`--head`) to see what's happening

**2. Proxy Connection Issues**
- Verify proxy credentials in `.env`
- Test proxy connection: `npm run test-proxy`
- Check proxy service status
- Ensure country code matches persona configuration
- **Default proxy setting:** Check `src/config/defaults.js` (proxy.enabled)

**3. No Reels Collected**
- Check if persona YAML files are in `personas/active/`
- Verify Instagram account has access to Reels
- Check logs for errors: `tail -f logs/error.log`
- Try visible browser mode to debug navigation
- Check component logs - look for `[GraphQLExtractor]` or `[DOMExtractor]` to see which extraction method is being used

**4. Media Blocking Not Working**
- Check logs for `[BandwidthOptimizer]` component - should show what's being blocked
- Verify `--block-media` flag is being passed correctly
- For Docker: Ensure `BLOCK_MEDIA` env var is set before container starts
- Check `src/config/defaults.js` for default blocking configuration
- Use `BLOCK_MEDIA=none` to disable blocking, `BLOCK_MEDIA=all` to block all media types

**5. High Memory Usage**
- Reduce number of concurrent scrapers
- Adjust resource limits in docker-compose.yml
- Clear old log files: `make clean`
- Disable media blocking: `BLOCK_MEDIA=none`

**6. Rate Limiting**
- Add delays between requests
- Use different proxies for different personas
- Reduce scraping frequency

### Debug Mode

Enable verbose logging:
```bash
LOG_LEVEL=debug npm run scrape
```

Or run with visible browser:
```bash
npm run scrape:persona <persona_id> -- --head
```

## Development

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Development Mode

Set `NODE_ENV=development` for debug logging:
```bash
NODE_ENV=development npm run scrape
```

## Contributing

1. Follow existing code style
2. Add JSDoc comments for new functions
3. Update documentation for new features
4. Test changes thoroughly before submitting

## License

MIT License - See LICENSE file for details

## Acknowledgments

- Reykjavík University - CSDA
- Built with Puppeteer, Winston, and other open-source tools

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review logs in `logs/` directory
3. Validate setup: `npm run validate`
4. Check USAGE.md for detailed usage instructions

