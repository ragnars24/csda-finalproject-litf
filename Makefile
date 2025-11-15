.PHONY: help install clean scrape browser interactive-browser test-proxy test-proxy-country proxy-help test lint dev docker-build docker-rebuild docker-up docker-generate-personas docker-up-interactive docker-run-interactive

# Default target
help:
	@echo "Instagram Reels Scraper - Makefile Commands"
	@echo "==========================================="
	@echo ""
	@echo "Setup & Maintenance:"
	@echo "  install              - Install Node.js dependencies"
	@echo "  clean                - Remove temporary files and logs"
	@echo ""
	@echo "Scraping Commands:"
	@echo "  scrape               - Run scraper (all personas, headless, with proxy by default)"
	@echo "                         Options: PERSONA=name HEADLESS=false NO_PROXY=true BLOCK_MEDIA=types"
	@echo ""
	@echo "Browser Commands:"
	@echo "  browser              - Launch browser with proxy (default: US, use COUNTRY=DE)"
	@echo "  interactive-browser - Launch interactive browser (RECOMMENDED, use COUNTRY=DE)"
	@echo ""
	@echo "Proxy Commands:"
	@echo "  test-proxy           - Test all proxies from proxies.csv"
	@echo "  test-proxy-country   - Test proxy for specific country (use COUNTRY=DE)"
	@echo "  proxy-help           - Show proxy setup information"
	@echo ""
	@echo "Development:"
	@echo "  test                 - Run test suite"
	@echo "  lint                 - Run linter"
	@echo "  dev                  - Run in development mode"
	@echo ""
	@echo "Docker Commands:"
	@echo "  docker-build         - Build Docker images (use FILE=docker-compose.personas.yml)"
	@echo "  docker-rebuild       - Force rebuild without cache (use FILE=docker-compose.personas.yml)"
	@echo "  docker-up            - Build and start containers (use FILE=docker-compose.personas.yml)"
	@echo "  docker-up-interactive - Run all containers interactively (enter verification codes when prompted)"
	@echo "  docker-run-interactive - Run specific persona interactively (use PERSONA=name)"
	@echo "                         Enter verification codes manually when prompts appear"
	@echo "  docker-generate-personas - Generate docker-compose.personas.yml from active personas"
	@echo ""
	@echo "Examples:"
	@echo "  # Scraping:"
	@echo "  make scrape                                    # All personas, headless, with proxy"
	@echo "  make scrape PERSONA=persona_de_right_001      # Single persona"
	@echo "  make scrape PERSONA=persona_de_right_001 HEADLESS=false  # Visible browser"
	@echo "  make scrape NO_PROXY=true                     # Without proxy"
	@echo "  make scrape BLOCK_MEDIA=image,media           # Block media types"
	@echo "  make scrape PERSONA=persona_de_right_001 NO_PROXY=true BLOCK_MEDIA=none  # Combined options"
	@echo ""
	@echo "  # Browser:"
	@echo "  make interactive-browser                      # Interactive browser (US proxy)"
	@echo "  make interactive-browser COUNTRY=DE            # Interactive browser (German proxy)"
	@echo "  make browser COUNTRY=DE                        # Launch browser (German proxy)"
	@echo ""
	@echo "  # Docker:"
	@echo "  make docker-build                              # Build default docker-compose.yml"
	@echo "  make docker-build FILE=docker-compose.personas.yml  # Build personas compose file"
	@echo "  make docker-up FILE=docker-compose.personas.yml    # Start personas containers"
	@echo "  make docker-up-interactive                    # Run all personas interactively (enter codes when prompted)"
	@echo "  make docker-run-interactive PERSONA=persona-br-right-male-001  # Run specific persona interactively"
	@echo "  make docker-generate-personas                  # Generate personas compose file"
	@echo ""
	@echo "  # Proxy:"
	@echo "  make test-proxy-country COUNTRY=DE            # Test German proxy"

# Install dependencies
install:
	@npm install
	@mkdir -p data logs personas/templates personas/active

# Clean temporary files
clean:
	@rm -rf logs/*.log tmp/ .browser/
	@rm -f data/raw/*.jsonl data/raw/*.json
	@echo "Cleaned temporary files, logs, browser cache, and raw data files"

# Unified scrape command with optional flags
scrape:
	@SCRAPE_ARGS=""; \
	if [ -n "$(PERSONA)" ]; then \
		SCRAPE_ARGS="$$SCRAPE_ARGS --persona $(PERSONA)"; \
	fi; \
	if [ "$(HEADLESS)" = "false" ]; then \
		SCRAPE_ARGS="$$SCRAPE_ARGS --head"; \
	else \
		SCRAPE_ARGS="$$SCRAPE_ARGS --headless"; \
	fi; \
	if [ "$(NO_PROXY)" = "true" ]; then \
		SCRAPE_ARGS="$$SCRAPE_ARGS --no-proxy"; \
	fi; \
	if [ -n "$(BLOCK_MEDIA)" ]; then \
		SCRAPE_ARGS="$$SCRAPE_ARGS --block-media $(BLOCK_MEDIA)"; \
	fi; \
	node src/main.js $$SCRAPE_ARGS

# Launch browser with proxy (default US)
browser:
ifdef URL
	@node src/utils/launch-browser.js -c $(or $(COUNTRY),US) -u $(URL) --headless
else
	@node src/utils/launch-browser.js -c $(or $(COUNTRY),US) --headless
endif

# Launch interactive browser (RECOMMENDED)
interactive-browser:
	@node src/utils/interactive-browser.js -c $(or $(COUNTRY),US)

# Test all proxies from proxies.csv
test-proxy:
	@node src/utils/test-proxy.js

# Test proxy for specific country
test-proxy-country:
ifndef COUNTRY
	@echo "Error: COUNTRY variable required. Example: make test-proxy-country COUNTRY=DE"
	@exit 1
endif
	@node src/utils/test-proxy.js $(COUNTRY)

# Show proxy setup information
proxy-help:
	@echo "Proxy Configuration Help"
	@echo "========================"
	@echo ""
	@echo "Proxy settings are configured via environment variables in .env file:"
	@echo "  - IPROYAL_USERNAME: Your proxy service username"
	@echo "  - IPROYAL_PASSWORD: Your proxy service password"
	@echo "  - IPROYAL_HOST: Proxy host (default: proxy.iproyal.com)"
	@echo "  - IPROYAL_PORT: Proxy port (default: 12321)"
	@echo ""
	@echo "Persona YAML files specify the country code for proxy routing:"
	@echo "  proxy:"
	@echo "    country_code: DE  # Use proxy from Germany"
	@echo ""
	@echo "Test your proxy configuration:"
	@echo "  make test-proxy-country COUNTRY=DE"
	@echo ""
	@echo "For more information, see README.md and USAGE.md"

# Run tests
test:
	@npm test

# Run linter
lint:
	@npm run lint

# Development: Watch for changes
dev:
	@npm run dev

# Docker: Build images (default: docker-compose.yml)
docker-build:
	@echo "Building Docker images..."
	@docker compose -f $(or $(FILE),docker-compose.yml) build

# Docker: Force rebuild without cache (default: docker-compose.yml)
docker-rebuild:
	@echo "Rebuilding Docker images without cache..."
	@docker compose -f $(or $(FILE),docker-compose.yml) build --no-cache

# Docker: Build and start containers (default: docker-compose.yml)
docker-up:
	@echo "Building and starting Docker containers..."
	@docker compose -f $(or $(FILE),docker-compose.yml) up --build

# Docker: Run all containers interactively (one at a time, for verification prompts)
# Note: Enter verification codes manually when prompts appear during runtime.
# Setting VERIFICATION_CODE as env var invalidates the session - codes must be entered interactively.
docker-up-interactive:
	@echo "Running all Docker containers interactively..."
	@echo "This will run each persona container interactively, one at a time."
	@echo ""
	@echo "⚠️  IMPORTANT: When verification prompts appear, type the code and press Enter."
	@echo "   Do NOT set VERIFICATION_CODE as env var - it invalidates the session."
	@echo "   Press Ctrl+C to skip to the next persona, or wait for completion."
	@echo ""
	@FILE=$(or $(FILE),docker-compose.personas.yml); \
	if [ ! -f "$$FILE" ]; then \
		echo "Error: $$FILE not found. Generating it now..."; \
		make docker-generate-personas; \
	fi; \
	SERVICES=$$(docker compose -f $$FILE config --services 2>/dev/null | grep -E '^scraper-persona-' || echo ""); \
	if [ -z "$$SERVICES" ]; then \
		echo "Error: No persona services found in $$FILE"; \
		echo "Run 'make docker-generate-personas' first to generate the compose file."; \
		exit 1; \
	fi; \
	for service in $$SERVICES; do \
		echo ""; \
		echo "========================================="; \
		echo "Running $$service interactively..."; \
		echo "========================================="; \
		docker compose -f $$FILE run --rm -it $$service || echo "Service $$service completed or was interrupted"; \
	done; \
	echo ""; \
	echo "All interactive sessions completed."

# Docker: Run specific persona container interactively
# Note: Enter verification codes manually when prompts appear during runtime.
# Setting VERIFICATION_CODE as env var invalidates the session - codes must be entered interactively.
docker-run-interactive:
ifndef PERSONA
	@echo "Error: PERSONA variable required."
	@echo "Example: make docker-run-interactive PERSONA=persona-br-right-male-001"
	@echo ""
	@echo "⚠️  IMPORTANT: When verification prompts appear, type the code and press Enter."
	@echo "   Do NOT set VERIFICATION_CODE as env var - it invalidates the session."
	@echo ""
	@echo "Available personas (sanitized names):"
	@FILE=$(or $(FILE),docker-compose.personas.yml); \
	if [ -f "$$FILE" ]; then \
		docker compose -f $$FILE config --services 2>/dev/null | grep -E '^scraper-persona-' | sed 's/^scraper-persona-//' || echo "  (run 'make docker-generate-personas' first)"; \
	else \
		echo "  (run 'make docker-generate-personas' first)"; \
	fi
	@exit 1
endif
	@echo "Running persona interactively..."
	@echo "⚠️  When verification prompts appear, type the code and press Enter."
	@echo "   Do NOT set VERIFICATION_CODE as env var - it invalidates the session."
	@echo ""
	@FILE=$(or $(FILE),docker-compose.personas.yml); \
	if [ ! -f "$$FILE" ]; then \
		echo "Error: $$FILE not found. Generating it now..."; \
		make docker-generate-personas; \
	fi; \
	SERVICE_NAME="scraper-persona-$$(echo $(PERSONA) | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g')"; \
	echo "Starting $$SERVICE_NAME..."; \
	docker compose -f $$FILE run --rm -it $$SERVICE_NAME

# Docker: Generate docker-compose.personas.yml from active personas
docker-generate-personas:
	@echo "Generating docker-compose.personas.yml from personas in personas/active/..."
	@node scripts/generate-docker-compose-personas.js
