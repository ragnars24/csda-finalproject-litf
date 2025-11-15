# Instagram Reels Scraper - Dockerfile
# Explicitly target linux/amd64 for Puppeteer Chrome compatibility
# (Puppeteer Chrome binaries are primarily available for x86_64)
FROM --platform=linux/amd64 node:18-slim

# Install dependencies for Puppeteer (needed for downloaded Chrome)
# Added missing dependencies: libxshmfence1, libxss1 for better compatibility
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxshmfence1 \
    libxss1 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Set Puppeteer cache directory before installing dependencies
# This ensures Chrome is downloaded to a location accessible by the node user
ENV PUPPETEER_CACHE_DIR=/home/node/.cache/puppeteer

# Create Puppeteer cache directory with proper permissions
RUN mkdir -p /home/node/.cache/puppeteer && \
    chown -R node:node /home/node/.cache

# Copy package files
COPY package*.json ./

# Install dependencies as root (Puppeteer will download Chrome here)
# This happens during build, so Chrome is baked into the image
RUN npm ci --only=production

# Explicitly ensure Chrome is downloaded with proper error handling
# Remove || true to surface any installation errors
# Use PUPPETEER_CACHE_DIR to ensure Chrome is installed to the correct location
# Install Chrome for the target platform architecture
RUN PUPPETEER_CACHE_DIR=/home/node/.cache/puppeteer npx puppeteer browsers install chrome

# Verify Chrome installation - check that the binary exists
# Check both possible locations (PUPPETEER_CACHE_DIR and default)
RUN CHROME_PATH=$(PUPPETEER_CACHE_DIR=/home/node/.cache/puppeteer node -e "console.log(require('puppeteer').executablePath())") && \
    if [ ! -f "$CHROME_PATH" ]; then \
        echo "ERROR: Chrome binary not found at $CHROME_PATH"; \
        echo "Checking alternative locations..."; \
        ROOT_CHROME=$(find /root/.cache/puppeteer -name "chrome" -type f 2>/dev/null | head -1) && \
        if [ -n "$ROOT_CHROME" ] && [ -f "$ROOT_CHROME" ]; then \
            echo "Found Chrome in /root/.cache, copying to node user cache"; \
            mkdir -p /home/node/.cache/puppeteer && \
            cp -r /root/.cache/puppeteer/* /home/node/.cache/puppeteer/ 2>/dev/null || true && \
            chown -R node:node /home/node/.cache/puppeteer && \
            echo "✓ Chrome copied successfully"; \
        else \
            echo "ERROR: Chrome not found in any location"; \
            exit 1; \
        fi; \
    else \
        echo "✓ Chrome binary verified at: $CHROME_PATH"; \
        ls -lh "$CHROME_PATH"; \
    fi

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p data logs personas/templates personas/active

# Set environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info
# Force headless mode in Docker (no display available)
ENV FORCE_HEADLESS=true
# Ensure Puppeteer uses the correct cache directory for node user
ENV PUPPETEER_CACHE_DIR=/home/node/.cache/puppeteer

# Run as non-root user
# Change ownership of app directory and ensure Puppeteer cache is accessible
RUN chown -R node:node /app && \
    chown -R node:node /home/node/.cache && \
    chown -R node:node /root/.cache 2>/dev/null || true

USER node

# Default command
CMD ["node", "src/main.js"]
