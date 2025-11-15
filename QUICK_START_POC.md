# Quick Start Guide - Proof of Concept (PoC)

This guide helps instructors and code reviewers quickly set up and run the Instagram Reels Scraper for demonstration purposes.

## Prerequisites

- Docker and Docker Compose installed
- 10 minutes of setup time
- One Instagram test account (credentials)

## Quick Setup (5 Steps)

### Step 1: Clone and Navigate

```bash
cd csda-finalproject-litf
```

### Step 2: Configure Environment

```bash
cp env.example .env
```

Edit `.env` and add **minimum required** configuration:

```bash
# Add ONE test persona (replace with your test account)
PERSONA_TEST_001_USERNAME=your_test_username
PERSONA_TEST_001_PASSWORD=your_test_password
PERSONA_TEST_001_EMAIL=your_test_email@example.com

# Optional: Proxy (can skip for PoC)
# IPROYAL_USERNAME=your_proxy_username
# IPROYAL_PASSWORD=your_proxy_password
```

### Step 3: Create Test Persona

Create `personas/active/persona_test_001.yaml`:

```yaml
persona_id: persona_test_001
region: US
political_spectrum: neutral
credentials:
  username: ${PERSONA_TEST_001_USERNAME}
  password: ${PERSONA_TEST_001_PASSWORD}
  email: ${PERSONA_TEST_001_EMAIL}
proxy:
  country_code: US
```

### Step 4: Generate Docker Compose

```bash
make docker-generate-personas
```

This creates `docker-compose.personas.yml` with services for all personas.

### Step 5: Run in Interactive Mode

```bash
make docker-run-interactive PERSONA=persona-test-001
```

**Note:** When verification prompts appear, type the code and press Enter. Do NOT set `VERIFICATION_CODE` as env var - it invalidates the session.

## Expected Output

You should see:

1. **Startup Banner:**
   ```
   🚀 Instagram Reels Scraper - Service Initialization
   Persona ID: persona_test_001
   Headless Mode: enabled
   Proxy: enabled/disabled
   Media Blocking: default (image, stylesheet, font, media)
   
   Initializing Services:
     ✓ PersonaLoader - Loading persona configuration
     ✓ ProxyManager - Proxy configuration manager
     ✓ CSVStorage - Data persistence layer
     ✓ BrowserFactory - Creating browser instance
     ✓ Scraper - Main orchestrator initialized
   ```

2. **Service Initialization Logs** (with component names):
   ```
   [BandwidthOptimizer]: Bandwidth optimization enabled - blocking: image, stylesheet, font, media
   [GraphQLHandler]: Processing GraphQL response...
   [ReelCollector]: Captured reel from network: ABC123 by @username
   ```

3. **Collection Summary:**
   ```
   📊 Collection Summary:
      - Network interception captured: 5 reels
      - Total reels collected: 5 reels
      - Network cache size: 5 unique reels
   ```

4. **Cookie Statistics:**
   ```
   Cookie Session Statistics:
     Total cookies captured: 15
     Unique cookie names: 8
     Session cookies: 5
     Persistent cookies: 10
   ```

## Verify It Worked

Check output files:

```bash
# Check collected data
cat data/posts.csv

# Check session summary
cat data/sessions.csv

# Check cookies (if captured)
ls data/cookies/
cat data/cookies/cookies_persona_test_001.csv
```

## Troubleshooting PoC Issues

### Issue: "No persona YAML files found"
**Solution:** Ensure `personas/active/persona_test_001.yaml` exists

### Issue: "Login failed"
**Solution:** 
- Verify credentials in `.env`
- Check if account requires 2FA (enter code when prompted)
- Try running with visible browser: `make scrape PERSONA=persona_test_001 HEADLESS=false`

### Issue: "Verification code required"
**Solution:** 
- Run interactively: `make docker-run-interactive PERSONA=persona-test-001`
- When prompt appears, type the 6-digit code and press Enter
- Do NOT set `VERIFICATION_CODE` env var beforehand

### Issue: "No reels collected"
**Solution:**
- Check logs: `docker compose -f docker-compose.personas.yml logs`
- Verify Instagram account has access to Reels
- Check if account is logged in successfully

### Issue: "Docker build fails"
**Solution:**
- Ensure Docker is running: `docker ps`
- Check Dockerfile exists: `ls Dockerfile`
- Try rebuilding: `make docker-rebuild FILE=docker-compose.personas.yml`

## Quick Commands Reference

```bash
# Generate compose file
make docker-generate-personas

# Run interactively (for verification)
make docker-run-interactive PERSONA=persona-test-001

# Run in background
docker compose -f docker-compose.personas.yml up -d

# View logs
docker compose -f docker-compose.personas.yml logs -f

# Stop containers
docker compose -f docker-compose.personas.yml down
```

## What to Show Reviewers

1. **Component Logging:** Show logs with component names (`[BandwidthOptimizer]`, `[GraphQLHandler]`, etc.)
2. **Service Initialization:** Show startup banner with all services
3. **Data Collection:** Show `data/posts.csv` with collected reels
4. **Cookie Tracking:** Show `data/cookies/` directory with session cookies
5. **Extraction Flow:** Reference `EXTRACTION_FLOW.md` for architecture

## Time Estimate

- **Setup:** 5-10 minutes
- **First Run:** 2-5 minutes (depending on verification)
- **Data Collection:** 1-2 minutes per reel
- **Total PoC:** ~15 minutes

## Next Steps

After PoC verification:
1. Review `EXTRACTION_FLOW.md` for architecture details
2. Check `README.md` for full documentation
3. Review `src/` code structure
4. Examine collected data in `data/posts.csv`

