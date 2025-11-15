## System Overview

This document provides a concise, report-friendly overview of the Instagram Reels scraper, summarizing the main flow, key components, and data outputs. For full details, see `SYSTEM_FLOW_DIAGRAM.md`, `EXTRACTION_FLOW.md`, `QUICK_START_POC.md`, and `DATA_COLLECTION_AND_ETHICS.md`.

### End-to-End Flow (High Level)

1. **Persona selection**
   - Personas are defined as YAML files in `personas/active/` (see templates in `personas/templates/`).
   - Each persona specifies region, political spectrum, demographics, credentials, proxy settings, and political figures to follow.
   - `src/services/persona.js` loads and validates persona configs, resolving environment-variable placeholders from `.env`.

2. **Proxy and connection setup**
   - `proxy/proxy-manager.js` (wrapped by `src/services/proxy.js`) builds proxy endpoints based on persona region and base proxy credentials (`IPROYAL_*` in `.env`).
   - `src/utils/ip-checker.js` verifies current IP and geographic location (direct or via proxy) and logs whether it matches the persona’s target country.

3. **Browser initialization**
   - `src/main.js` creates an `InstagramReelsScraper` from `src/core/scraper.js` with the selected persona, proxy configuration, storage, and media-blocking options.
   - `src/browser/browser-factory.js` launches a Puppeteer browser (with stealth plugin), applies proxy settings, and sets viewport/user-agent.
   - `src/browser/browser-lifecycle.js` manages clean shutdown and error handling for the browser/page.

4. **Network interception and bandwidth control**
   - `src/network/request-interceptor.js` attaches to page requests/responses, intercepts GraphQL and related traffic, and forwards data to Node.
   - `src/network/graphql-handler.js` parses intercepted responses and forwards reel-like payloads to the extraction layer.
   - `src/network/bandwidth-optimizer.js` configures resource blocking (`image`, `media`, etc.) based on defaults plus CLI/ENV overrides (see `src/config/defaults.js` and `BLOCK_MEDIA`).
   - `src/network/packet-storage.js` cooperates with `src/storage/csv-storage.js` to persist raw packet information.

5. **Login and verification**
   - `src/services/login-flow.js` drives the complete login sequence:
     - Navigates to `/accounts/login/`.
     - Handles cookie banner via `src/services/cookie-handler.js`.
     - Types credentials using `src/browser/typing.js` and clicks the login button.
     - Detects account suspension and throws a dedicated `AccountSuspendedError` if needed.
     - Detects 2FA/verification flows and delegates to `src/services/verification-handler.js` for code entry, screenshots, and retry logic.
     - Handles post-login dialogs (e.g., “Save Login Info”, “Turn on Notifications”) and navigates to `/reels/`.
   - `src/services/auth-utils.js` logs current site/context snapshots for debugging.

6. **Cookie session tracking**
   - `src/services/cookie-session-capture.js` captures cookies at key stages:
     - `pre-login`, `post-login`, `pre-scraping`, `post-scraping`, and error conditions.
   - Cookie data is stored in `data/cookies/cookies_<persona_id>.csv` with columns:
     - `timestamp, persona_id, stage, cookie_name, cookie_value, domain, path, expires, httpOnly, secure, sameSite`.
   - The service can compute summary stats (total cookies, unique names, session vs persistent, secure/HttpOnly ratios).

7. **Reels navigation and scraping loop**
   - `src/core/scraper.js` orchestrates the reels scraping loop using:
     - `src/browser/reel-navigator.js` to navigate to the reels feed, click/open the first reel, detect whether the current page is a reel, and step through reels (keyboard navigation).
     - `src/browser/screenshot-handler.js` to capture screenshots for each processed reel and store them under `screenshots/`.
     - `src/utils/random.js` to inject human-like delays and randomized watch durations.
   - During the loop, the scraper:
     - Ensures it remains on a reel page and attempts recovery if not.
     - Waits for network activity and extraction caches to populate.
     - Triggers fallback DOM extraction when needed.
     - Optionally likes reels based on engagement strategy.

8. **App prompt handling**
   - `src/services/app-prompt-handler.js` detects “Use the app” style prompts that can block interaction.
   - It tries multiple strategies (buttons like “Not Now”, close icons, ESC key, backdrop clicks) to dismiss prompts.
   - The handler is invoked both during login (after navigating to `/reels/`) and periodically during scraping to keep the UI clear.

9. **Engagement and liking**
   - `src/services/engagement-strategy.js` decides whether a reel should be liked based on persona configuration and probabilistic parameters (e.g., default 15% like probability).
   - `src/services/like-handler.js` performs the actual like interaction using the page DOM, keeping track of successful and failed attempts.

10. **Extraction and data normalization**
    - `src/extraction/graphql-extractor.js` is the primary extractor:
      - Handles multiple GraphQL response shapes (`xdt_shortcode_media`, `shortcode_media`, feed-style responses with `xdt_api__v1__clips__home__connection_v2` / `xdt_api__v1__clips__user__connection_v2`, and array-based payloads).
      - Extracts `post_id`, `author_username`, `caption`, `likes_count`, `comments_count`, `view_count`, `media_type`, `created_at`, plus `video_url` / `thumbnail_url` (used for analysis but not persisted in the CSV schema).
      - Uses `src/utils/hashtag-extractor.js` to derive hashtags and hashtag metadata from GraphQL structures.
    - `src/extraction/dom-extractor.js` is the fallback extractor:
      - Scrapes reel data from visible DOM when network-based extraction fails.
      - Extracts IDs from URLs, author handles, captions, and engagement counts from aria labels, then runs hashtag extraction over caption text and DOM links.
    - `src/extraction/reel-collector.js` keeps an in-memory deduplicated cache of reels (keyed by `post_id`) to avoid duplicates and provide quick lookups.
    - `src/extraction/reel-data-transformer.js` normalizes and merges data from GraphQL and DOM sources into a consistent shape for storage and analysis.

11. **Storage and logging**
    - `src/storage/csv-storage.js` is responsible for persistent CSV and JSONL outputs:
      - **Posts CSV** (`data/posts.csv`) schema:
        - `timestamp, persona_id, gender, age, region, political_spectrum, feed_type, post_id, author_username, caption, likes_count, comments_count, view_count, hashtags, created_at, media_type, screenshot_path`.
      - **Sessions CSV** (`data/sessions.csv`) schema:
        - `timestamp, persona_id, gender, age, region, political_spectrum, feed_type, posts_collected, likes_performed, duration_seconds`.
      - **Raw intercepted packets** (`data/raw/intercepted_packets.jsonl`):
        - Truncated network responses with metadata (URL, method, content type, persona metadata).
      - **Media packets** (`data/raw/media_packets.jsonl`):
        - Parsed media objects from GraphQL responses, suitable for offline analysis.
      - The class also performs automatic schema migration if it finds older CSV headers (e.g., with `video_url`/`thumbnail_url`).
    - `src/utils/hashtag-extractor.js` can compute hashtag statistics across posts, and `src/main.js` uses it to log summary statistics after a session (total posts, posts with/without hashtags, top hashtags).
    - Logging across the system is handled by `src/utils/logger.js` (Winston-based), with component-specific loggers for easy tracing (e.g., `[BandwidthOptimizer]`, `[GraphQLHandler]`, `[ReelCollector]`, `[LoginFlow]`, `[CookieSessionCapture]`).

12. **CLI, scripts, and Docker**
    - Entry point:
      - `src/main.js` (used by `npm run scrape`, `npm run scrape:persona`, `make scrape`, etc.).
    - CLI utilities:
      - `src/utils/cli.js` (general CLI helpers).
      - `src/utils/interactive-browser.js` (opens a browser session for manual inspection via `npm run browser:interactive`).
      - `src/utils/test-proxy.js` (used by `npm run test-proxy` / `make test-proxy-country`).
    - Configuration:
      - `src/config/defaults.js` defines defaults for headless mode, proxy usage, scraping counts, and bandwidth blocking.
      - `src/config/puppeteer-options.js` encapsulates Puppeteer launch options.
    - Scripts and Docker:
      - `scripts/validate-setup.js` ensures environment, personas, and directories are correctly configured.
      - `scripts/generate-docker-compose-personas.js` emits `docker-compose.personas.yml` with one service per active persona.
      - `scripts/clean-docker.sh` helps resolve Docker Desktop/containerd issues (see `DOCKER_TROUBLESHOOTING.md`).
      - `Dockerfile`, `docker-compose.yml`, and `docker-compose.personas.yml` support sequential and concurrent persona scraping, including interactive verification flows.

### Key Data Outputs (Summary)

- **Collected posts** – `data/posts.csv`
  - One row per unique reel (per persona, feed type).
  - Includes persona demographics, basic engagement counts, hashtags, timestamps, and a screenshot path.

- **Session summaries** – `data/sessions.csv`
  - One row per scraping session, capturing duration, posts collected, and likes performed, with persona metadata.

- **Raw network data** – `data/raw/intercepted_packets.jsonl`, `data/raw/media_packets.jsonl`
  - JSONL logs of intercepted HTTP traffic and parsed media objects, for offline inspection and method validation.

- **Cookies** – `data/cookies/cookies_<persona_id>.csv`
  - Detailed cookie snapshots across multiple stages, suitable for understanding session management and tracking behavior.

### Where to Learn More

- **Full system flow** – `SYSTEM_FLOW_DIAGRAM.md`
- **Extraction internals** – `EXTRACTION_FLOW.md`
- **Quick PoC setup** – `QUICK_START_POC.md`
- **Ethics and data collection** – `DATA_COLLECTION_AND_ETHICS.md`
- **Docker-specific issues** – `DOCKER_TROUBLESHOOTING.md`


