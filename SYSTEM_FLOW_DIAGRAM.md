# Instagram Reels Scraper - System Flow Diagram

This document provides a detailed flowchart visualization of the complete Instagram Reels scraper system flow from initialization to data storage.

## Overview

The system orchestrates multiple components to scrape Instagram Reels data while maintaining stealth behavior and proper error handling. The flow includes persona management, proxy configuration, browser automation, network interception, data extraction, and storage.

## Quick Navigation

- [Complete System Flow](#complete-system-flow) - Full end-to-end diagram
- [Subsystem Diagrams](#subsystem-diagrams) - Focused component interactions
  - [Initialization & Configuration](#1-initialization--configuration)
  - [Browser & Proxy Setup](#2-browser--proxy-setup)
  - [Login Flow & Authentication](#3-login-flow--authentication)
  - [Network Interception](#4-network-interception)
  - [Scraping Loop](#5-scraping-loop)
  - [Data Extraction & Storage](#6-data-extraction--storage)
- [Roadblocks & Error Handling](#roadblocks--error-handling)
- [Key Components Reference](#key-components-reference)

## Complete System Flow

```mermaid
flowchart TD
    Start([User runs npm run scrape]) --> ParseArgs[Parse CLI Arguments<br/>--persona, --head/--headless]
    ParseArgs --> CheckMode{Single persona<br/>or all?}
    
    CheckMode -->|Single| LoadPersona[Load Persona Configuration<br/>src/services/persona.js]
    CheckMode -->|All| LoadAllPersonas[Load All Personas<br/>from personas/active/]
    
    LoadAllPersonas --> PersonaLoop{For each<br/>persona}
    PersonaLoop -->|Next| LoadPersona
    
    LoadPersona --> ParseYAML[Parse YAML File<br/>Replace env variables<br/>Validate structure]
    ParseYAML --> GetProxy[Get Proxy Config<br/>src/services/proxy.js<br/>Match region to proxy]
    
    GetProxy --> CheckIP[Verify IP & Location<br/>src/utils/ip-checker.js<br/>Confirm proxy routing]
    
    CheckIP --> InitBrowser[Initialize Browser<br/>src/browser/browser-factory.js]
    InitBrowser --> LaunchPuppeteer[Launch Puppeteer<br/>+ Stealth Plugin<br/>Configure proxy auth<br/>Set viewport & user agent]
    
    LaunchPuppeteer --> SetupInterception[Setup Network Interception<br/>src/network/request-interceptor.js]
    SetupInterception --> InjectFetch[Inject fetch/XHR overrides<br/>Expose sendDataToNode<br/>Initialize ReelCollector]
    
    InjectFetch --> SetupGraphQL[Setup GraphQL Handler<br/>src/network/graphql-handler.js]
    SetupGraphQL --> SetupBandwidth[Setup Bandwidth Optimizer<br/>Block images/media]
    
    SetupBandwidth --> Login[Login Flow<br/>src/services/login-flow.js]
    Login --> NavLogin[Navigate to /accounts/login/]
    NavLogin --> HandleCookie[Handle Cookie Banner<br/>src/services/cookie-handler.js]
    
    HandleCookie --> TypeCreds[Type Username & Password<br/>Human-like delays<br/>src/browser/typing.js]
    TypeCreds --> SubmitLogin[Submit Login Form]
    
    SubmitLogin --> Check2FA{2FA/Verification<br/>required?}
    Check2FA -->|Yes| Handle2FA[Handle Verification<br/>src/services/verification-handler.js]
    Check2FA -->|No| PostLoginDialogs
    Handle2FA --> PostLoginDialogs[Dismiss Post-Login Dialogs<br/>Save Login Info, Notifications]
    
    PostLoginDialogs --> NavReels[Navigate to /reels/]
    
    NavReels --> InitScrape[Initialize Scraping Session<br/>src/core/scraper.js]
    InitScrape --> CheckReelPage{Already on<br/>reel page?}
    
    CheckReelPage -->|No| NavToFeed[Navigate to Reels Feed]
    NavToFeed --> ClickFirst[Click First Reel<br/>src/browser/reel-navigator.js]
    CheckReelPage -->|Yes| FocusVideo
    ClickFirst --> FocusVideo[Focus Video Element]
    
    FocusVideo --> ClearCache[Clear ReelCollector Cache]
    ClearCache --> ReelLoop{Reels collected<br/>< target?}
    
    ReelLoop -->|Yes| WaitLoad[Wait for Reel to Load<br/>2-3 second delay]
    WaitLoad --> VerifyPage{Still on<br/>reel page?}
    
    VerifyPage -->|No| Recovery[Attempt Recovery<br/>Navigate back to feed]
    Recovery --> ReelLoop
    
    VerifyPage -->|Yes| ExtractID[Extract Reel ID from URL<br/>Get current reel shortcode]
    ExtractID --> WaitNetwork[Wait for Network Interception<br/>Check ReelCollector cache<br/>Max 10 attempts x 300-1000ms]
    
    WaitNetwork --> TakeScreenshot[Take Screenshot<br/>src/browser/screenshot-handler.js<br/>Save to screenshots/]
    
    TakeScreenshot --> CheckCache{Reel data in<br/>network cache?}
    
    CheckCache -->|Yes| GetFromCache[Get Data from ReelCollector<br/>src/extraction/reel-collector.js]
    CheckCache -->|No| DOMExtract[DOM Fallback Extraction<br/>src/extraction/dom-extractor.js<br/>Query page elements]
    
    GetFromCache --> ProcessData
    DOMExtract --> ProcessData[Process Reel Data<br/>post_id, author, caption,<br/>likes, comments, views,<br/>hashtags, screenshot_path]
    
    ProcessData --> SaveCSV[Save to CSV<br/>src/storage/csv-storage.js<br/>data/posts.csv]
    SaveCSV --> SaveRaw[Save Raw Packets<br/>data/raw/*.jsonl]
    
    SaveRaw --> CheckLike{Should like<br/>reel?}
    CheckLike -->|Yes| LikeReel[Like Reel<br/>src/services/like-handler.js<br/>Based on engagement strategy]
    CheckLike -->|No| WatchDuration
    LikeReel --> WatchDuration[Simulate Watch Duration<br/>src/services/engagement-strategy.js<br/>Random delay 3-8 seconds]
    
    WatchDuration --> NavNext[Navigate to Next Reel<br/>Keyboard Arrow Down<br/>src/browser/reel-navigator.js]
    
    NavNext --> CheckNavSuccess{Navigation<br/>successful?}
    CheckNavSuccess -->|Yes| ReelLoop
    CheckNavSuccess -->|No| RetryNav[Retry with Exponential Backoff<br/>Max 3 consecutive failures]
    RetryNav --> CheckRetryFail{Max retries<br/>exceeded?}
    CheckRetryFail -->|No| NavNext
    CheckRetryFail -->|Yes| EndScrape
    
    ReelLoop -->|No| EndScrape[End Scraping Session]
    
    EndScrape --> CalcSession[Calculate Session Stats<br/>Duration, reels collected,<br/>likes performed]
    CalcSession --> SaveSession[Save Session Summary<br/>data/sessions.csv]
    
    SaveSession --> GenHashtags[Generate Hashtag Statistics<br/>src/utils/hashtag-extractor.js<br/>Top hashtags, frequencies]
    
    GenHashtags --> CloseBrowser[Close Browser<br/>src/browser/browser-lifecycle.js]
    
    CloseBrowser --> CheckMorePersonas{More personas<br/>to scrape?}
    CheckMorePersonas -->|Yes| WaitDelay[Wait 60 seconds]
    WaitDelay --> PersonaLoop
    
    CheckMorePersonas -->|No| GenOverallStats[Generate Overall Statistics<br/>Aggregate all personas]
    GenOverallStats --> End([Complete])
    
    style Start fill:#90EE90
    style End fill:#FFB6C1
    style Login fill:#FFE4B5
    style ReelLoop fill:#E6E6FA
    style SaveCSV fill:#FFD700
    style CheckNavSuccess fill:#FFA07A
```

## Flow Phases Explained

### Phase 1: Entry Point & Initialization
**File**: `src/main.js`

- Parses command-line arguments (`--persona`, `--head`, `--headless`)
- Determines whether to scrape a single persona or all configured personas
- Initializes the main orchestration loop

### Phase 2: Configuration Loading
**Files**: `src/services/persona.js`, `src/services/proxy.js`

- Loads persona YAML configuration from `personas/active/` directory
- Replaces environment variable placeholders (e.g., `${PERSONA_DE_RIGHT_001_USERNAME}`)
- Validates persona structure (credentials, demographics, proxy config)
- Retrieves proxy configuration matching the persona's region

### Phase 3: Connection Verification
**File**: `src/utils/ip-checker.js`

- Checks IP address and geographic location via proxy
- Verifies proxy routing matches the target country code
- Logs connection information for debugging

### Phase 4: Browser Initialization
**Files**: `src/browser/browser-factory.js`, `src/core/scraper.js`

- Launches Puppeteer browser with stealth plugin (anti-detection)
- Configures proxy authentication if proxy is enabled
- Sets viewport size and user agent based on persona region
- Creates new page instance

### Phase 5: Network Interception Setup
**Files**: `src/network/request-interceptor.js`, `src/network/graphql-handler.js`, `src/network/bandwidth-optimizer.js`

- Injects JavaScript to override `window.fetch` and `XMLHttpRequest` in browser context
- Exposes `sendDataToNode` function for browser-to-Node.js communication
- Sets up bandwidth optimizer to block images/media (saves bandwidth)
- Initializes GraphQL response handler
- Creates ReelCollector cache for storing intercepted reel data

### Phase 6: Login Flow
**File**: `src/services/login-flow.js`

- Navigates to Instagram login page (`/accounts/login/`)
- Handles cookie consent banner if present
- Types username and password with human-like typing delays
- Submits login form
- Handles 2FA/verification code if required
- Dismisses post-login dialogs (Save Login Info, Turn on Notifications)
- Navigates to Instagram Reels page (`/reels/`)

### Phase 7: Reels Scraping Loop
**Files**: `src/core/scraper.js`, `src/browser/reel-navigator.js`

The main scraping loop continues until the target number of reels is collected:

1. **Navigation**: Navigate to reels feed or detect if already on a reel page
2. **First Reel**: Click first reel if on feed page
3. **For Each Reel**:
   - Wait for content to load (2-3 second delay)
   - Verify still on reel page (recovery if not)
   - Extract reel ID from URL
   - Wait for network interception to capture data (up to 10 attempts)
   - Take screenshot of current reel
   - Retrieve reel data from network cache or DOM fallback
   - Save data to CSV
   - Optionally like the reel (based on engagement strategy)
   - Simulate watching duration (3-8 seconds)
   - Navigate to next reel using keyboard arrow down
   - Handle navigation failures with exponential backoff retry

### Phase 8: Data Extraction
**Files**: `src/extraction/graphql-extractor.js`, `src/extraction/dom-extractor.js`, `src/extraction/reel-collector.js`

**Primary Method - Network Interception**:
- Intercepts GraphQL API responses (`/graphql/query`)
- Parses reel feed connections (`xdt_api__v1__clips__home__connection_v2`) or individual reel data
- Extracts: `post_id`, `author_username`, `caption`, `likes_count`, `comments_count`, `view_count`, `hashtags`, `created_at`
- Stores data in ReelCollector in-memory cache

**Fallback Method - DOM Extraction**:
- Queries page DOM elements if network interception fails
- Extracts same fields from HTML structure
- Used when network data is not available

### Phase 9: Data Storage
**File**: `src/storage/csv-storage.js`

**Posts CSV** (`data/posts.csv`):
- Saves each reel with columns: `timestamp`, `persona_id`, `gender`, `age`, `region`, `political_spectrum`, `feed_type`, `post_id`, `author_username`, `caption`, `likes_count`, `comments_count`, `view_count`, `hashtags`, `created_at`, `media_type`, `screenshot_path`
- Escapes special characters and normalizes newlines in captions

**Raw Packets** (`data/raw/intercepted_packets.jsonl`):
- Saves all intercepted network requests as JSONL (JSON Lines format)
- Includes request URL, method, content type, and response data

**Media Packets** (`data/raw/media_packets.jsonl`):
- Saves parsed GraphQL media objects for detailed analysis

**Screenshots** (`screenshots/`):
- Saves reel screenshots as PNG files
- Filename format: `{persona_id}_{reel_id}_{timestamp}.png`

### Phase 10: Session Summary
**Files**: `src/storage/csv-storage.js`, `src/utils/hashtag-extractor.js`

- Calculates session duration (start to end time)
- Counts total reels collected and likes performed
- Saves session summary to `data/sessions.csv`
- Generates hashtag statistics (top hashtags, frequencies, percentages)

### Phase 11: Cleanup & Next Persona
**Files**: `src/core/scraper.js`, `src/main.js`

- Closes browser instance cleanly
- Waits 60 seconds before processing next persona (rate limiting)
- Repeats entire flow for all configured personas
- Generates overall statistics aggregating all personas

---

## Subsystem Diagrams

The following diagrams break down the system into focused components for easier understanding and report integration.

### 1. Initialization & Configuration

**Purpose**: Parse CLI arguments, load persona configurations, and set up proxy routing.

**Files**: `src/main.js`, `src/services/persona.js`, `src/services/proxy.js`

```mermaid
flowchart TD
    Start([npm run scrape]) --> ParseCLI[Parse CLI Arguments<br/>--persona, --head, --no-proxy]
    ParseCLI --> CheckMode{Single or<br/>All personas?}
    
    CheckMode -->|Single| LoadOne[Load Single Persona]
    CheckMode -->|All| LoadAll[Load All from<br/>personas/active/]
    
    LoadAll --> PersonaLoop{For each}
    PersonaLoop -->|Next| LoadOne
    
    LoadOne --> ParseYAML[Parse YAML<br/>Replace ENV_VARS<br/>Validate structure]
    ParseYAML --> GetProxy[Get Proxy Config<br/>Match region to proxy]
    GetProxy --> VerifyIP[Verify IP & Location<br/>Confirm proxy routing]
    
    VerifyIP --> CheckIP{IP matches<br/>target region?}
    CheckIP -->|Yes| InitBrowser[Initialize Browser]
    CheckIP -->|No| LogWarning[⚠️ Log Warning<br/>Continue anyway]
    LogWarning --> InitBrowser
    
    InitBrowser --> Ready([Ready for Login])
    
    style Start fill:#90EE90
    style Ready fill:#FFD700
    style CheckIP fill:#FFA07A
```

**Key Data Flow**:
- **Input**: CLI args, YAML persona files, proxy credentials (env vars)
- **Output**: Persona object with credentials, proxy config, browser instance
- **Roadblocks**: Missing env vars, invalid YAML, proxy connection failures

---

### 2. Browser & Proxy Setup

**Purpose**: Launch Puppeteer with stealth plugins and configure proxy authentication.

**Files**: `src/browser/browser-factory.js`, `proxy/proxy-manager.js`

```mermaid
flowchart TD
    Init[Initialize Browser] --> CheckProxy{Use proxy?}
    
    CheckProxy -->|Yes| BuildAuth[Build Proxy Auth<br/>username:password_country-XX]
    CheckProxy -->|No| LaunchDirect[Launch without proxy]
    
    BuildAuth --> LaunchProxy[Launch Puppeteer<br/>+ Stealth Plugin<br/>+ Proxy auth]
    LaunchDirect --> SetViewport
    LaunchProxy --> SetViewport[Set Viewport & User Agent<br/>Region-specific]
    
    SetViewport --> CreatePage[Create New Page]
    CreatePage --> SetupLifecycle[Setup Lifecycle Manager]
    SetupLifecycle --> Ready([Browser Ready])
    
    style Init fill:#FFE4B5
    style Ready fill:#FFD700
    style CheckProxy fill:#E6E6FA
```

**Proxy Configuration** (`ProxyManager`):
- **Provider**: IPRoyal (geo.iproyal.com:12321)
- **Format**: `username:password_country-{code}_session-{id}_lifetime-168h`
- **Sticky Sessions**: 168h (7 days) session lifetime
- **Roadblocks**: Invalid credentials, suspended proxies (402 Payment Required)

---

### 3. Login Flow & Authentication

**Purpose**: Authenticate with Instagram, handle 2FA, and navigate to reels feed.

**Files**: `src/services/login-flow.js`, `src/services/verification-handler.js`, `src/services/cookie-handler.js`

```mermaid
flowchart TD
    Start([Login Flow Start]) --> NavLogin[Navigate to<br/>/accounts/login/]
    NavLogin --> HandleCookie[Handle Cookie Banner<br/>Accept/Decline]
    
    HandleCookie --> TypeCreds[Type Username & Password<br/>Human-like delays]
    TypeCreds --> Submit[Click Submit]
    
    Submit --> WaitResp[Wait for Response]
    WaitResp --> CheckSusp{Account<br/>suspended?}
    
    CheckSusp -->|Yes| ThrowSusp[❌ Throw AccountSuspendedError<br/>Screenshot + Skip persona]
    CheckSusp -->|No| Check2FA
    
    Check2FA{2FA/Verification<br/>required?} -->|Yes| Handle2FA[Handle Verification<br/>Prompt user for code]
    Check2FA -->|No| PostLogin
    
    Handle2FA --> CheckCode{Code valid?}
    CheckCode -->|No| Retry2FA[Retry or Skip]
    Retry2FA --> Handle2FA
    CheckCode -->|Yes| PostLogin
    
    PostLogin[Dismiss Post-Login Dialogs<br/>Save Login Info: Not Now<br/>Notifications: Not Now]
    PostLogin --> NavReels[Navigate to /reels/]
    
    NavReels --> CheckAppPrompt{App prompt<br/>detected?}
    CheckAppPrompt -->|Yes| DismissPrompt[Dismiss Use the App]
    CheckAppPrompt -->|No| CheckSuspReels
    DismissPrompt --> CheckSuspReels
    
    CheckSuspReels{Suspended<br/>after navigation?}
    CheckSuspReels -->|Yes| ThrowSusp
    CheckSuspReels -->|No| Success([✅ Login Complete])
    
    style Start fill:#90EE90
    style Success fill:#FFD700
    style ThrowSusp fill:#FF6B6B
    style Check2FA fill:#FFA07A
    style CheckSusp fill:#FF6B6B
    style CheckSuspReels fill:#FF6B6B
```

**Authentication Challenges**:
1. **Account Suspension**: Detected via URL (`/accounts/suspended/`) or page content
2. **2FA/Verification**: Code sent to email/phone or authenticator app
3. **Cookie Consent**: GDPR banner must be handled before form interaction
4. **Rate Limiting**: Too many login attempts trigger temporary lockout
5. **App Prompts**: "Use the App" dialog can block interaction

---

### 4. Network Interception

**Purpose**: Intercept GraphQL API responses to capture reel data without relying on DOM.

**Files**: `src/network/request-interceptor.js`, `src/network/graphql-handler.js`, `src/extraction/reel-collector.js`

```mermaid
flowchart TD
    Start([Setup Network Interception]) --> InjectOverride[Inject fetch/XHR Override<br/>evaluateOnNewDocument]
    InjectOverride --> ExposeFunc[Expose sendDataToNode<br/>Browser → Node.js bridge]
    
    ExposeFunc --> SetupHandler[Setup GraphQL Handler]
    SetupHandler --> SetupCollector[Initialize ReelCollector<br/>In-memory cache]
    
    SetupCollector --> Ready([Interception Active])
    
    Ready --> OnRequest[On Network Request]
    OnRequest --> CloneResp[Clone Response]
    CloneResp --> SendToNode[sendDataToNode]
    
    SendToNode --> CheckGraphQL{Is GraphQL<br/>query?}
    CheckGraphQL -->|No| SaveRaw[Save Raw Packet<br/>JSONL]
    CheckGraphQL -->|Yes| ProcessGQL
    
    ProcessGQL[Process GraphQL Response<br/>Clean 'for (;;);' prefix<br/>Parse JSON] --> ExtractReels[Extract Reel Data<br/>xdt_api__v1__clips__home_<br/>connection_v2]
    
    ExtractReels --> AddToCache[Add to ReelCollector<br/>In-memory Map by post_id]
    AddToCache --> SaveMedia[Save Media Packet<br/>media_packets.jsonl]
    
    SaveRaw --> Continue[Continue Request]
    SaveMedia --> Continue
    
    style Start fill:#FFE4B5
    style Ready fill:#FFD700
    style CheckGraphQL fill:#E6E6FA
```

**Network Interception Strategy**:
- **Fetch Override**: Proxy `window.fetch` to intercept responses
- **XHR Override**: Proxy `XMLHttpRequest` for legacy AJAX
- **Fire & Forget**: Async packet saving to avoid blocking page rendering
- **GraphQL Structures**:
  - `xdt_api__v1__clips__home__connection_v2` (reels feed)
  - `xdt_shortcode_media` (individual reel)
  - `shortcode_media` (legacy structure)

---

### 5. Scraping Loop

**Purpose**: Navigate through reels, extract data, and handle navigation failures.

**Files**: `src/core/scraper.js`, `src/browser/reel-navigator.js`, `src/services/like-handler.js`

```mermaid
flowchart TD
    Start([Begin Scraping]) --> CheckOnReel{Already on<br/>reel page?}
    CheckOnReel -->|No| NavFeed[Navigate to Reels Feed<br/>Click first reel]
    CheckOnReel -->|Yes| FocusVideo
    NavFeed --> FocusVideo[Focus Video Element]
    
    FocusVideo --> ClearCache[Clear ReelCollector Cache]
    ClearCache --> Loop{Reels < target?}
    
    Loop -->|Yes| WaitLoad[Wait 2-3s for Load]
    Loop -->|No| EndScrape
    
    WaitLoad --> VerifyPage{Still on<br/>reel page?}
    VerifyPage -->|No| CheckSusp{Account<br/>suspended?}
    CheckSusp -->|Yes| ThrowSusp[❌ Throw Suspension Error]
    CheckSusp -->|No| Recovery[Attempt Recovery<br/>Navigate back]
    Recovery --> Loop
    
    VerifyPage -->|Yes| ExtractID[Extract Reel ID from URL]
    ExtractID --> WaitNetwork[Wait for Network Data<br/>Max 10 attempts x 300-1000ms]
    
    WaitNetwork --> TakeScreenshot[Take Screenshot<br/>screenshots/persona_id/]
    TakeScreenshot --> CheckCache{Data in<br/>cache?}
    
    CheckCache -->|Yes| GetCache[Get from ReelCollector]
    CheckCache -->|No| DOMFallback[DOM Extraction Fallback]
    
    GetCache --> ProcessData
    DOMFallback --> ProcessData[Process & Validate Reel Data]
    
    ProcessData --> CheckDuplicate{Duplicate in<br/>CSV?}
    CheckDuplicate -->|Yes| SkipSave[Skip save, don't count]
    CheckDuplicate -->|No| SaveCSV[Save to posts.csv]
    
    SkipSave --> NavNext
    SaveCSV --> CheckLike{Should like<br/>reel?}
    CheckLike -->|Yes| LikeReel[Like Reel<br/>Based on persona strategy]
    CheckLike -->|No| WatchDuration
    
    LikeReel --> WatchDuration[Simulate Watch<br/>3-8 seconds]
    WatchDuration --> NavNext[Navigate to Next<br/>Keyboard Arrow Down]
    
    NavNext --> CheckNav{Navigation<br/>success?}
    CheckNav -->|Yes| Loop
    CheckNav -->|No| RetryNav[Retry with<br/>Exponential Backoff]
    
    RetryNav --> CheckRetries{Max retries<br/>exceeded?}
    CheckRetries -->|No| NavNext
    CheckRetries -->|Yes| EndScrape
    
    EndScrape([End Scraping<br/>Generate stats])
    
    style Start fill:#90EE90
    style EndScrape fill:#FFD700
    style ThrowSusp fill:#FF6B6B
    style CheckCache fill:#E6E6FA
    style CheckNav fill:#FFA07A
```

**Scraping Strategy**:
- **Navigation**: Keyboard arrow down for natural interaction
- **Wait Times**: 2-3s for load, 3-8s for watch duration
- **Retry Logic**: Exponential backoff (max 3 consecutive failures)
- **Duplicate Detection**: Check both in-memory and CSV before saving
- **Engagement**: Probabilistic liking based on persona political spectrum

---

### 6. Data Extraction & Storage

**Purpose**: Extract reel data from network/DOM and persist to CSV/JSONL files.

**Files**: `src/extraction/graphql-extractor.js`, `src/extraction/dom-extractor.js`, `src/storage/csv-storage.js`

```mermaid
flowchart TD
    Start([Data Available]) --> CheckSource{Data source?}
    
    CheckSource -->|Network| ExtractGQL[GraphQL Extractor<br/>Parse API response]
    CheckSource -->|DOM| ExtractDOM[DOM Extractor<br/>Query page elements]
    
    ExtractGQL --> ParseStructure[Parse GraphQL Structure<br/>xdt_api__v1__clips_home_<br/>connection_v2]
    ParseStructure --> ExtractFields
    
    ExtractDOM --> QuerySelectors[Query DOM Selectors<br/>article, video, span, a]
    QuerySelectors --> ExtractFields
    
    ExtractFields[Extract Fields:<br/>post_id, author, caption,<br/>likes, comments, views,<br/>hashtags, created_at]
    
    ExtractFields --> Transform[Transform Data<br/>Clean caption, parse hashtags<br/>Normalize counts]
    
    Transform --> Validate{Data valid?}
    Validate -->|No| Discard[Discard & Log]
    Validate -->|Yes| SavePosts[Save to posts.csv<br/>Append with persona metadata]
    
    SavePosts --> SaveRawPackets[Save Raw Packets<br/>intercepted_packets.jsonl]
    SaveRawPackets --> SaveMediaPackets[Save Media Packets<br/>media_packets.jsonl]
    
    SaveMediaPackets --> Complete([✅ Data Saved])
    Discard --> Complete
    
    style Start fill:#FFE4B5
    style Complete fill:#FFD700
    style Validate fill:#E6E6FA
```

**Data Storage Schema**:

**posts.csv**:
- `timestamp`, `persona_id`, `gender`, `age`, `region`, `political_spectrum`
- `feed_type`, `post_id`, `author_username`, `caption`
- `likes_count`, `comments_count`, `view_count`
- `hashtags` (comma-separated), `created_at`, `media_type`, `screenshot_path`

**Raw Packets** (`data/raw/intercepted_packets.jsonl`):
- All intercepted network requests (JSON Lines format)
- Includes URL, method, content-type, response data

**Media Packets** (`data/raw/media_packets.jsonl`):
- Parsed GraphQL media objects for detailed analysis

---

## Roadblocks & Error Handling

### Critical Roadblocks

The system encounters several roadblocks during operation that require specific error handling:

#### 1. Account Suspension 🚫

**Detection**:
- URL pattern: `/accounts/suspended/`
- Page content: "your account has been suspended", "account suspended", "we suspended your account"

**Handling** (`src/services/login-flow.js`, `src/main.js`):
```javascript
class AccountSuspendedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AccountSuspendedError';
    this.isSuspension = true;
  }
}
```

**Recovery**:
- Throw `AccountSuspendedError`
- Take screenshot for debugging
- Skip current persona
- Apply cooldown (5 minutes) before next persona
- Continue with remaining personas

**Impact**: Persona cannot be used until suspension is lifted (manual Instagram appeal required)

---

#### 2. Proxy Errors (402 Payment Required) 💳

**Common Proxy Issues**:

| Error Code | Cause | Solution |
|------------|-------|----------|
| `402 Payment Required` | Proxy subscription expired or suspended | Renew proxy subscription |
| `407 Proxy Authentication Required` | Invalid credentials | Verify `IPROYAL_USERNAME` and `IPROYAL_PASSWORD` |
| `Connection Refused` | Proxy server down or wrong host/port | Check proxy provider status |
| `Timeout` | Slow proxy or network issues | Increase timeout or switch proxy |

**Detection** (`proxy/proxy-manager.js`):
- IP verification fails: `checkIPAndLocation()` returns null
- IP doesn't match target country: Warning logged but continues

**Recovery**:
- Log warning and continue without proxy (if `--no-proxy` allowed)
- Manual intervention required: Check proxy provider dashboard
- Verify proxy credentials in `.env`

**Proxy Configuration**:
```bash
# IPRoyal Residential Proxies
IPROYAL_USERNAME=your_username
IPROYAL_PASSWORD=your_password_base
IPROYAL_HOST=geo.iproyal.com
IPROYAL_PORT=12321
```

---

#### 3. Verification Challenges (2FA) 🔐

**Triggers**:
- New IP address or location
- Suspicious login pattern
- Instagram security check

**Detection** (`src/services/login-flow.js`):
- URL: `/challenge/` or `/auth_platform/codeentry/`
- Page content: "verification code", "security code", "confirm it's you"
- Input fields: `input[name="verificationCode"]`, `input[autocomplete="one-time-code"]`

**Handling** (`src/services/verification-handler.js`):
1. Take screenshot: `verification_detected.png`
2. Prompt user for code (CLI input)
3. Find input field using multiple selector strategies
4. Type code with human-like delays
5. Find and click submit button (handles both `<button>` and `<div role="button">`)
6. Wait for navigation or URL change

**User Options**:
- Enter code: Continue normally
- Press Enter (skip): Treat as false positive and continue
- Invalid code: Retry or manual intervention required

---

#### 4. Navigation Failures ⚠️

**Causes**:
- Network latency
- Instagram layout changes
- Reel not loading
- Page crash or detachment

**Detection** (`src/browser/reel-navigator.js`, `src/core/scraper.js`):
- URL doesn't contain `/reel/` after navigation
- `isOnReelPage()` returns false
- Navigation timeout (15s)

**Recovery Strategy**:
```javascript
consecutiveNavigationFailures = 0;
maxConsecutiveNavigationFailures = 3;
maxFailures = 5;

// Exponential backoff
baseDelay = 2000ms
exponentialDelay = baseDelay * 2^(failures-1)
maxDelay = 15000ms
finalDelay = min(exponentialDelay, maxDelay) + random(0, 2000ms)
```

**Actions**:
1. Attempt recovery: Navigate back to reels feed
2. Retry navigation with exponential backoff
3. After 3 consecutive failures: Stop scraping
4. After 5 total failures: End session

---

#### 5. Cookie Consent Banner 🍪

**Trigger**: First visit to Instagram (GDPR compliance)

**Detection** (`src/services/cookie-handler.js`):
- Button text: "Allow all cookies", "Accept", "Allow"
- Modal overlay present

**Handling**:
- Click accept button before interacting with login form
- Wait for modal to disappear (2-3s)
- If not handled, form interaction may fail

---

#### 6. "Use the App" Prompt 📱

**Trigger**: Instagram encourages mobile app usage

**Detection** (`src/services/app-prompt-handler.js`):
- Modal/dialog with "Use the App" text
- Appears periodically during scraping

**Handling**:
- Click "Not Now" or "Cancel"
- Check every 5 reels during scraping
- Non-blocking: Continue if not found

---

#### 7. Rate Limiting & Throttling 🐌

**Symptoms**:
- Login page stays on login URL after submit
- "Please wait a few minutes before you try again"
- Slow page loading

**Handling**:
- Human-like delays between actions
- Random watch duration (3-8s)
- Delay between personas (60s)
- Extended cooldown after suspension (5 minutes)

---

### Error Handling Flow Diagram

```mermaid
flowchart TD
    Error[Error Detected] --> CheckType{Error Type?}
    
    CheckType -->|Account Suspended| HandleSusp[Take Screenshot<br/>Throw AccountSuspendedError]
    HandleSusp --> SkipPersona[Skip Persona<br/>Apply 5min cooldown]
    
    CheckType -->|Proxy Error| HandleProxy[Log Warning<br/>Check IP verification]
    HandleProxy --> CheckContinue{Continue<br/>without proxy?}
    CheckContinue -->|Yes| Continue
    CheckContinue -->|No| Abort
    
    CheckType -->|2FA Challenge| Handle2FA[Prompt User<br/>Take Screenshot]
    Handle2FA --> UserAction{User provides<br/>code?}
    UserAction -->|Yes| SubmitCode[Submit & Verify]
    UserAction -->|No Skip| Continue
    SubmitCode --> CodeValid{Code valid?}
    CodeValid -->|Yes| Continue
    CodeValid -->|No| RetryOrAbort
    
    CheckType -->|Navigation Fail| HandleNav[Exponential Backoff<br/>Retry navigation]
    HandleNav --> CheckRetries{Retries < max?}
    CheckRetries -->|Yes| Retry[Retry with delay]
    CheckRetries -->|No| EndSession[End Session<br/>Save partial data]
    
    CheckType -->|Cookie Banner| HandleCookie[Click Accept/Decline]
    HandleCookie --> Continue
    
    CheckType -->|App Prompt| HandleApp[Click Not Now]
    HandleApp --> Continue
    
    CheckType -->|Rate Limit| HandleRate[Extended Wait<br/>Random delay]
    HandleRate --> Continue
    
    CheckType -->|Unknown| LogError[Log Error<br/>Take Screenshot]
    LogError --> Abort[Abort Operation]
    
    Continue[Continue Operation]
    Retry --> Continue
    RetryOrAbort --> Abort
    SkipPersona --> NextPersona[Process Next Persona]
    EndSession --> NextPersona
    
    style HandleSusp fill:#FF6B6B
    style HandleProxy fill:#FFA07A
    style Handle2FA fill:#FFD700
    style Continue fill:#90EE90
```

---

### Monitoring & Debugging

**Log Files** (`logs/`):
- `combined.log`: All log levels
- `error.log`: Errors and warnings only
- `debug.log`: Verbose debugging info

**Screenshots** (Automatic):
- `verification_detected.png`: 2FA challenge detected
- `verification_detected_after_reels.png`: Challenge after navigation
- `login_error.png`: Login failure
- `screenshots/{persona_id}/{reel_id}.png`: Reel screenshots

**Session Tracking** (`data/sessions.csv`):
- Session duration, reels collected, likes performed
- Useful for identifying rate limiting or performance issues

---

## Service Diagrams

Detailed diagrams for each service component showing their internal logic and interactions.

### Service 1: Persona Loader

**Purpose**: Load and validate persona configurations from YAML files with environment variable substitution.

**File**: `src/services/persona.js`

```mermaid
flowchart TD
    Start([loadPersona/loadAllPersonas]) --> CheckDir{Directory<br/>exists?}
    CheckDir -->|No| Throw[❌ Throw Error]
    CheckDir -->|Yes| ReadFiles[Read YAML Files<br/>from personas/active/]
    
    ReadFiles --> ParseYAML[Parse YAML Content]
    ParseYAML --> ReplaceEnv[Replace Environment Variables<br/>VAR_NAME to process.env value]
    
    ReplaceEnv --> CheckEnv{All env vars<br/>found?}
    CheckEnv -->|No| ThrowEnv[❌ Throw Missing Env Error]
    CheckEnv -->|Yes| Validate[Validate Persona Structure]
    
    Validate --> CheckRequired{Required fields<br/>present?}
    CheckRequired -->|No| ThrowValid[❌ Throw Validation Error]
    CheckRequired -->|Yes| CheckCreds{Credentials<br/>valid?}
    
    CheckCreds -->|No| ThrowCreds[❌ Missing username/password]
    CheckCreds -->|Yes| CheckFigures{Political figures<br/>configured?}
    
    CheckFigures -->|No| ThrowFigures[❌ No figures specified]
    CheckFigures -->|Yes| Success([✅ Return Persona Object])
    
    style Start fill:#90EE90
    style Success fill:#FFD700
    style Throw fill:#FF6B6B
    style ThrowEnv fill:#FF6B6B
    style ThrowValid fill:#FF6B6B
    style ThrowCreds fill:#FF6B6B
    style ThrowFigures fill:#FF6B6B
```

**Key Methods**:
- `loadPersona(personaId)`: Load single persona by ID
- `loadAllPersonas()`: Load all personas from active directory
- `replaceEnvVariables(obj)`: Recursively replace env var placeholders with actual values
- `validatePersona(persona)`: Validate required fields and structure
- `getPersonasBy(filter)`: Filter personas by criteria (region, spectrum)

**Required Fields**:
- `persona_id`, `region`, `political_spectrum`, `demographics`
- `credentials` (username, password, email)
- `proxy` (country_code, city, sticky_session)
- `political_figures` (follows array)

---

### Service 2: Proxy Manager

**Purpose**: Configure and manage proxy routing with country-specific sessions.

**File**: `proxy/proxy-manager.js`

```mermaid
flowchart TD
    Start([getProxyForPersona]) --> CheckPersona{Persona has<br/>direct proxy?}
    
    CheckPersona -->|Yes| UsePersonaProxy[Use Direct Config<br/>username, password, host, port]
    CheckPersona -->|No| UseCountry[Use Country-based Config]
    
    UseCountry --> BuildPassword[Build Password String<br/>base_password_country-XX]
    BuildPassword --> CheckSticky{Sticky session<br/>enabled?}
    
    CheckSticky -->|Yes| AddSession[Add Session ID<br/>_session-{id}_lifetime-168h]
    CheckSticky -->|No| NoSession[Use rotating IPs]
    
    AddSession --> BuildURL
    NoSession --> BuildURL[Build Proxy URL<br/>http://user:pass@host:port]
    
    UsePersonaProxy --> BuildURL
    BuildURL --> TestIP[Test IP & Location<br/>Optional verification]
    
    TestIP --> CheckMatch{IP matches<br/>target country?}
    CheckMatch -->|Yes| Success[✅ Return Proxy Config]
    CheckMatch -->|No| LogWarn[⚠️ Log Warning]
    LogWarn --> Success
    
    style Start fill:#90EE90
    style Success fill:#FFD700
    style CheckMatch fill:#FFA07A
```

**Key Methods**:
- `getProxyConfig(countryCode, city, stickySession)`: Get proxy config for country
- `getProxyForPersona(persona)`: Get proxy from persona config
- `testProxy(countryCode)`: Test proxy connection and verify IP
- `_generateSessionId(identifier)`: Generate consistent session ID

**Proxy Format** (IPRoyal):
```text
username:password_country-us_session-sess12345_lifetime-168h@geo.iproyal.com:12321
```

**Configuration**:
- Sticky sessions: 168h (7 days)
- Country codes: US, DE, BR, etc.
- Optional city targeting

---

### Service 3: Login Flow

**Purpose**: Handle complete Instagram login process including 2FA and post-login dialogs.

**File**: `src/services/login-flow.js`

```mermaid
flowchart TD
    Start([handleLogin]) --> Nav[Navigate to /accounts/login/]
    Nav --> Cookie[Handle Cookie Banner]
    Cookie --> WaitForm[Wait for Login Form]
    
    WaitForm --> TypeUser[Type Username<br/>Human-like delays]
    TypeUser --> TypePass[Type Password<br/>Human-like delays]
    TypePass --> Submit[Click Submit Button]
    
    Submit --> WaitResp[Wait for Response]
    WaitResp --> CheckSusp{Suspension<br/>detected?}
    
    CheckSusp -->|Yes| TakeScreenshot[Take Screenshot]
    TakeScreenshot --> ThrowSusp[❌ Throw AccountSuspendedError]
    
    CheckSusp -->|No| CheckChallenge{Challenge/2FA<br/>detected?}
    CheckChallenge -->|Yes| Handle2FA[Handle Verification<br/>See Verification Handler]
    CheckChallenge -->|No| CheckError
    
    Handle2FA --> CheckError{Still on<br/>login page?}
    CheckError -->|Yes| DetectError[Detect Error Message]
    DetectError --> ThrowError[❌ Throw Login Error]
    
    CheckError -->|No| Dialogs[Handle Post-Login Dialogs<br/>Save Info: Not Now<br/>Notifications: Not Now]
    
    Dialogs --> NavReels[Navigate to /reels/]
    NavReels --> CheckApp{App prompt<br/>detected?}
    CheckApp -->|Yes| DismissApp[Dismiss Use the App]
    CheckApp -->|No| CheckSuspReels
    DismissApp --> CheckSuspReels
    
    CheckSuspReels{Suspension<br/>after nav?}
    CheckSuspReels -->|Yes| ThrowSusp
    CheckSuspReels -->|No| Success([✅ Login Complete])
    
    style Start fill:#90EE90
    style Success fill:#FFD700
    style ThrowSusp fill:#FF6B6B
    style ThrowError fill:#FF6B6B
    style CheckSusp fill:#FF6B6B
    style CheckSuspReels fill:#FF6B6B
```

**Key Methods**:
- `handleLogin(page, persona)`: Main login orchestration
- `checkForSuspension(page)`: Detect account suspension
- `checkForChallenge(page)`: Detect 2FA/verification requirements
- `handleLoginErrors(page)`: Parse and throw login errors
- `handlePostLoginDialogs(page)`: Dismiss save info and notification prompts
- `takeLoginErrorScreenshot(page)`: Capture debug screenshots

**Error Detection**:
- Suspension: URL `/accounts/suspended/` or text patterns
- Invalid credentials: "password was incorrect", "username doesn't belong"
- Rate limiting: "Please wait a few minutes"

---

### Service 4: Verification Handler

**Purpose**: Handle 2FA and verification code entry with multiple selector strategies.

**File**: `src/services/verification-handler.js`

```mermaid
flowchart TD
    Start([handleVerificationCode]) --> Prompt[Prompt User for Code<br/>CLI input]
    Prompt --> CheckSkip{User pressed<br/>Enter skip?}
    
    CheckSkip -->|Yes| Skip[Skip verification<br/>Continue as false positive]
    CheckSkip -->|No| ValidateCode{Code length<br/>6-8 digits?}
    
    ValidateCode -->|No| LogWarn[⚠️ Log Warning]
    LogWarn --> Proceed
    ValidateCode -->|Yes| Proceed[Find Input Field<br/>Multiple selector strategies]
    
    Proceed --> TrySelectors[Try Selectors:<br/>1. input[name=verificationCode]<br/>2. input[autocomplete=one-time-code]<br/>3. input[maxlength=6-8]<br/>4. Dynamic evaluation]
    
    TrySelectors --> FoundInput{Input found?}
    FoundInput -->|No| ScreenshotInput[Screenshot: input_not_found]
    ScreenshotInput --> ThrowInput[❌ Throw Error]
    
    FoundInput -->|Yes| TypeCode[Type Code<br/>Human-like delays]
    TypeCode --> FindSubmit[Find Submit Button<br/>button or div[role=button]]
    
    FindSubmit --> FoundSubmit{Button found?}
    FoundSubmit -->|No| TryDirect[Try Direct Click<br/>Evaluate & click element]
    FoundSubmit -->|Yes| ClickSubmit[Click Submit]
    
    TryDirect --> CheckClicked{Clicked?}
    CheckClicked -->|No| ScreenshotSubmit[Screenshot: submit_not_found]
    ScreenshotSubmit --> ThrowSubmit[❌ Throw Error]
    
    CheckClicked -->|Yes| WaitNav
    ClickSubmit --> WaitNav[Wait for Navigation]
    
    WaitNav --> CheckURL{Still on<br/>challenge page?}
    CheckURL -->|Yes| ScreenshotFail[Screenshot: verification_failed]
    ScreenshotFail --> ThrowFail[❌ Code incorrect/expired]
    
    CheckURL -->|No| Success([✅ Verification Success])
    Skip --> Success
    
    style Start fill:#90EE90
    style Success fill:#FFD700
    style ThrowInput fill:#FF6B6B
    style ThrowSubmit fill:#FF6B6B
    style ThrowFail fill:#FF6B6B
```

**Key Methods**:
- `handleVerificationCode(page, persona)`: Main verification handler
- `findVerificationInput(page)`: Find code input using multiple strategies
- `findSubmitButton(page)`: Find submit button (handles `<button>` and `<div>`)
- `takeScreenshot(page, filename)`: Save debug screenshots to data/

**Selector Strategies**:
1. Standard: `input[name="verificationCode"]`
2. Autocomplete: `input[autocomplete="one-time-code"]`
3. Maxlength: `input[maxlength="6"]` or `[maxlength="7"]`
4. Dynamic evaluation: Search by text content and attributes

**User Options**:
- Enter code: Submit and continue
- Press Enter: Skip (treat as false positive)

---

### Service 5: Cookie Handler

**Purpose**: Dismiss GDPR cookie consent banner before form interaction.

**File**: `src/services/cookie-handler.js`

```mermaid
flowchart TD
    Start([handleCookieBanner]) --> Wait[Wait 1-2s<br/>for banner to appear]
    Wait --> Search[Search for Cookie Button<br/>button text contains:<br/>'Allow all cookies'<br/>'Allow essential and optional']
    
    Search --> Found{Button found?}
    Found -->|No| NoBanner[No banner detected<br/>Continue]
    Found -->|Yes| Click[Click Button]
    
    Click --> WaitDismiss[Wait 2-3s<br/>for dismissal]
    WaitDismiss --> Verify[Verify banner gone]
    
    Verify --> StillExists{Banner still<br/>visible?}
    StillExists -->|Yes| LogWarn[⚠️ Log Warning<br/>Banner still visible]
    StillExists -->|No| LogSuccess[✅ Banner dismissed]
    
    LogWarn --> Done
    LogSuccess --> Done([Done])
    NoBanner --> Done
    
    style Start fill:#90EE90
    style Done fill:#FFD700
```

**Key Methods**:
- `handleCookieBanner(page)`: Main handler (static method)

**Detection**:
- Button text: "Allow all cookies", "Allow essential and optional cookies"
- Uses `page.evaluate()` for direct DOM manipulation

**Timing**:
- Must run BEFORE interacting with login form
- Banner can block form elements if not dismissed

---

### Service 6: App Prompt Handler

**Purpose**: Detect and dismiss Instagram's "Use the app" prompts during scraping.

**File**: `src/services/app-prompt-handler.js`

```mermaid
flowchart TD
    Start([handleAppPrompt]) --> Check[Check for App Prompt<br/>Search for keywords:<br/>'use the app', 'download', 'install']
    
    Check --> Detected{Prompt<br/>detected?}
    Detected -->|No| NoPrompt([No prompt - Continue])
    
    Detected -->|Yes| Dismiss[Attempt Dismissal]
    Dismiss --> Strategy1[Strategy 1: Click Button<br/>'Not Now', 'Maybe Later', 'Skip']
    
    Strategy1 --> Success1{Clicked?}
    Success1 -->|Yes| Verify1[Verify dismissed]
    Success1 -->|No| Strategy2
    
    Strategy2[Strategy 2: Close/X Button<br/>svg[aria-label='Close']]
    Strategy2 --> Success2{Clicked?}
    Success2 -->|Yes| Verify1
    Success2 -->|No| Strategy3
    
    Strategy3[Strategy 3: ESC Key<br/>page.keyboard.press]
    Strategy3 --> Verify2[Verify dismissed]
    Verify2 --> Success3{Dismissed?}
    Success3 -->|Yes| LogSuccess
    Success3 -->|No| Strategy4
    
    Strategy4[Strategy 4: Backdrop Click<br/>Click modal background]
    Strategy4 --> Verify3[Verify dismissed]
    Verify3 --> Success4{Dismissed?}
    Success4 -->|Yes| LogSuccess
    Success4 -->|No| LogFail
    
    Verify1 --> LogSuccess[✅ Prompt dismissed]
    LogFail[⚠️ Could not dismiss<br/>Continue anyway]
    
    LogSuccess --> Done([Done])
    LogFail --> Done
    
    style Start fill:#90EE90
    style Done fill:#FFD700
    style NoPrompt fill:#FFD700
```

**Key Methods**:
- `checkForAppPrompt(page)`: Detect prompt presence
- `dismissAppPrompt(page)`: Try multiple dismissal strategies
- `handleAppPrompt(page)`: Check and dismiss if present

**Detection Keywords**:
- "use the app", "download the app", "install the app"
- "view all comments", "discover more reels", "get the app"

**Dismissal Strategies** (in order):
1. Click "Not Now" / "Maybe Later" / "Skip" button
2. Click Close/X button (SVG with aria-label)
3. Press ESC key
4. Click modal backdrop

**Usage**: Called periodically every 5 reels during scraping

---

### Service 7: Like Handler

**Purpose**: Handle reel liking based on engagement strategy probability.

**File**: `src/services/like-handler.js`

```mermaid
flowchart TD
    Start([shouldLikePost]) --> CheckEnabled{Likes enabled<br/>in persona?}
    CheckEnabled -->|No| ReturnFalse([Return false])
    
    CheckEnabled -->|Yes| GetProb[Get Like Probability<br/>Default: 0.15 15%]
    GetProb --> CheckProb{Probability?}
    
    CheckProb -->|0| ReturnFalse
    CheckProb -->|1| ReturnTrue([Return true])
    CheckProb -->|0-1| Random[Generate Random Number]
    
    Random --> Compare{random <<br/>probability?}
    Compare -->|Yes| ReturnTrue
    Compare -->|No| ReturnFalse
    
    ReturnTrue --> LikeReel[likeReel Called]
    LikeReel --> Wait[Wait 500-1000ms]
    Wait --> FindButton[Find Like Button<br/>button[aria-label*='Like']<br/>svg[aria-label*='Like']]
    
    FindButton --> FoundBtn{Button found?}
    FoundBtn -->|No| LogError[Log Error]
    FoundBtn -->|Yes| Click[Click Like Button]
    
    Click --> Delay[Delay 2-5s<br/>Based on persona config]
    Delay --> Done([Done])
    LogError --> Done
    
    style Start fill:#90EE90
    style Done fill:#FFD700
    style ReturnTrue fill:#90EE90
    style ReturnFalse fill:#FFA07A
```

**Key Methods**:
- `shouldLikePost()`: Determine if reel should be liked (probabilistic)
- `likeReel()`: Execute like action with delays

**Configuration** (Persona YAML):
```yaml
engagement:
  likes:
    enabled: true/false
    probability: 0.0 - 1.0  # 0.15 = 15% chance
    delay_seconds:
      min: 2
      max: 5
```

**Logic**:
- `enabled: false` → Never like
- `probability: 0` → Never like
- `probability: 1` → Always like
- `probability: 0.15` → 15% chance (default)

---

### Service 8: Engagement Strategy

**Purpose**: Determine engagement actions (like, comment, share) and watch duration.

**File**: `src/services/engagement-strategy.js`

```mermaid
flowchart TD
    Start([Engagement Decision]) --> Type{Action type?}
    
    Type -->|Like| CheckLike[Check persona.engagement.likes]
    Type -->|Comment| CheckComment[Check persona.engagement.comments]
    Type -->|Share| CheckShare[Check persona.engagement.shares]
    Type -->|Watch Duration| GetWatch[Get watch duration]
    
    CheckLike --> GetLikeProb[Get Probability<br/>Default: 0.15]
    GetLikeProb --> LikeRandom{Random < prob?}
    LikeRandom -->|Yes| LikeTrue([Return true])
    LikeRandom -->|No| LikeFalse([Return false])
    
    CheckComment --> GetCommentProb[Get Probability<br/>Default: 0.05]
    GetCommentProb --> CommentRandom{Random < prob?}
    CommentRandom -->|Yes| CommentTrue([Return true])
    CommentRandom -->|No| CommentFalse([Return false])
    
    CheckShare --> GetShareProb[Get Probability<br/>Default: 0.02]
    GetShareProb --> ShareRandom{Random < prob?}
    ShareRandom -->|Yes| ShareTrue([Return true])
    ShareRandom -->|No| ShareFalse([Return false])
    
    GetWatch --> CheckConfig{Watch config<br/>exists?}
    CheckConfig -->|Yes| UseConfig[Use persona config<br/>min-max seconds]
    CheckConfig -->|No| UseDefault[Use default<br/>4-6 seconds]
    
    UseConfig --> CalcRandom[Calculate Random Duration<br/>min + random * max-min]
    UseDefault --> CalcRandom
    CalcRandom --> ReturnDuration([Return duration ms])
    
    style Start fill:#90EE90
    style LikeTrue fill:#FFD700
    style CommentTrue fill:#FFD700
    style ShareTrue fill:#FFD700
    style ReturnDuration fill:#FFD700
    style LikeFalse fill:#FFA07A
    style CommentFalse fill:#FFA07A
    style ShareFalse fill:#FFA07A
```

**Key Methods**:
- `shouldLike(persona)`: Determine if post should be liked
- `shouldComment(persona)`: Determine if post should be commented on
- `shouldShare(persona)`: Determine if post should be shared
- `getWatchDuration(persona)`: Calculate watch duration in milliseconds

**Default Probabilities**:
- Like: 15% (0.15)
- Comment: 5% (0.05)
- Share: 2% (0.02)

**Watch Duration**:
- Default: 4-6 seconds (4000-6000ms)
- Configurable per persona: `engagement.watch.duration_seconds.min/max`

---

### Service 9: Cookie Session Capture

**Purpose**: Capture and track cookies throughout the scraping session for analysis.

**File**: `src/services/cookie-session-capture.js`

```mermaid
flowchart TD
    Start([captureCookies]) --> GetCookies[Get Cookies from Page<br/>page.cookies]
    GetCookies --> Process[Process Cookie Data<br/>Extract: name, value, domain,<br/>expires, httpOnly, secure]
    
    Process --> Truncate[Truncate Long Values<br/>Max 100 chars]
    Truncate --> AddStage[Add Stage Metadata<br/>e.g. 'pre-login', 'post-scraping']
    
    AddStage --> Store[Store in Memory<br/>this.sessionCookies array]
    Store --> SaveCSV[Save to CSV File<br/>data/cookies/cookies_{persona}.csv]
    
    SaveCSV --> Done([Cookies Captured])
    
    Done --> Stats[getCookieStats Called?]
    Stats --> Analyze[Analyze Session Cookies:<br/>- Total captured<br/>- Unique cookie names<br/>- Session vs persistent<br/>- Secure cookies<br/>- HttpOnly cookies]
    
    Analyze --> Report([Return Statistics])
    
    style Start fill:#90EE90
    style Done fill:#FFD700
    style Report fill:#FFD700
```

**Key Methods**:
- `captureCookies(page, stage)`: Capture cookies at specific stage
- `saveCookiesToCSV(cookieData)`: Save to CSV file
- `getCookieStats()`: Calculate session statistics
- `logCookieStats()`: Log statistics to console
- `clear()`: Clear session cookies from memory

**Capture Stages**:
- `pre-login`: Before authentication
- `post-login`: After successful login
- `pre-scraping`: Before starting scraping loop
- `post-scraping`: After scraping completes
- `error`: On error occurrence

**CSV Schema**:
```text
timestamp, persona_id, stage, cookie_name, cookie_value, domain, path, expires, httpOnly, secure, sameSite
```

**Statistics Tracked**:
- Total cookies captured across all stages
- Unique cookie names
- Session cookies (no expiry)
- Persistent cookies (with expiry)
- Secure cookies (HTTPS only)
- HttpOnly cookies (not accessible via JavaScript)

---

### Service 10: Auth Utils

**Purpose**: Utility functions for authentication flow debugging and logging.

**File**: `src/services/auth-utils.js`

```mermaid
flowchart TD
    Start([logCurrentSite]) --> GetURL[Get Current URL<br/>page.url]
    GetURL --> Format[Format Log Message<br/>📍 Action Current site: URL]
    Format --> Log[Log to Console<br/>Info level]
    Log --> Done([Done])
    
    style Start fill:#90EE90
    style Done fill:#FFD700
```

**Key Methods**:
- `logCurrentSite(page, action)`: Log current page URL with context

**Purpose**: Simple utility for debugging authentication flow by logging URL changes.

**Usage**:
```javascript
await logCurrentSite(page, 'Navigated to login page');
await logCurrentSite(page, 'After clicking submit');
```

---

## Key Components Reference

| Component | File Path | Purpose |
|-----------|-----------|---------|
| **Entry Point** | `src/main.js` | Main orchestration, CLI parsing |
| **Persona Loading** | `src/services/persona.js` | Load and validate persona configs |
| **Proxy Management** | `src/services/proxy.js`, `proxy/proxy-manager.js` | Proxy configuration and routing |
| **Browser Factory** | `src/browser/browser-factory.js` | Browser instance creation |
| **Network Interception** | `src/network/request-interceptor.js` | Intercept fetch/XHR requests |
| **GraphQL Handler** | `src/network/graphql-handler.js` | Process GraphQL responses |
| **Login Flow** | `src/services/login-flow.js` | Complete Instagram login process |
| **Scraper Core** | `src/core/scraper.js` | Main scraping orchestration |
| **Reel Navigation** | `src/browser/reel-navigator.js` | Navigate between reels |
| **Data Extraction** | `src/extraction/graphql-extractor.js`, `src/extraction/dom-extractor.js` | Extract reel data from GraphQL/DOM |
| **Data Collection** | `src/extraction/reel-collector.js` | In-memory cache for reel data |
| **Storage** | `src/storage/csv-storage.js` | Persist data to CSV/JSONL files |
| **Screenshot Handler** | `src/browser/screenshot-handler.js` | Capture reel screenshots |
| **Like Handler** | `src/services/like-handler.js` | Like reels based on strategy |
| **Engagement Strategy** | `src/services/engagement-strategy.js` | Determine watch duration, like probability |

## Data Flow Summary

1. **Configuration Flow**: 
   - Personas YAML + Proxy CSV → Memory (Persona objects)

2. **Network Request Flow**: 
   - Browser → Network Interceptor → GraphQL Handler → ReelCollector Cache

3. **Reel Data Flow**: 
   - ReelCollector Cache → CSV Storage → File System (`data/posts.csv`)

4. **Raw Packet Flow**: 
   - Network Interceptor → JSONL Files → File System (`data/raw/intercepted_packets.jsonl`)

5. **Media Packet Flow**: 
   - GraphQL Handler → JSONL Files → File System (`data/raw/media_packets.jsonl`)

6. **Screenshot Flow**: 
   - Screenshot Handler → PNG Files → File System (`screenshots/`)

## Error Handling & Recovery

The system includes several error handling mechanisms:

- **Navigation Failures**: Exponential backoff retry (max 3 consecutive failures)
- **Network Interception Timeouts**: Falls back to DOM extraction
- **Page Recovery**: Detects when no longer on reel page and navigates back to feed
- **Login Errors**: Screenshot capture and detailed error logging
- **Proxy Verification**: Warns if proxy routing doesn't match expected country

## Performance Optimizations

- **Bandwidth Optimization**: Blocks images/media to reduce data usage
- **Network Interception**: Captures data without waiting for DOM rendering
- **In-Memory Caching**: ReelCollector stores data to avoid duplicate processing
- **Parallel Processing**: Multiple personas can run concurrently (Docker mode)

## Usage

To view this diagram:

1. **GitHub/GitLab**: The Mermaid diagram will render automatically in markdown viewers
2. **VS Code**: Install "Markdown Preview Mermaid Support" extension
3. **Online**: Copy the mermaid code block to [mermaid.live](https://mermaid.live)
4. **Documentation**: Include in project documentation or README

## Related Documentation

- `README.md` - Project overview and setup instructions
- `USAGE.md` - Detailed usage instructions
- `DATA_COLLECTION_AND_ETHICS.md` - Ethics and data collection guidelines

