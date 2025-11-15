# Extraction Module Flow Documentation

This document explains the logic and responsibilities of each extraction module in the Instagram Reels scraper.

## Overview

The extraction system uses a **dual-source approach**: primary extraction from GraphQL API responses (intercepted network traffic) with DOM extraction as a fallback. Data flows through four main modules, each with distinct responsibilities.

## Module Responsibilities

### 1. GraphQLExtractor (`src/extraction/graphql-extractor.js`)

**Purpose:** Primary extraction method - extracts reel data from intercepted GraphQL API responses.

**How it works:**
- Handles **6 different GraphQL response structures** from Instagram's API:
  1. `xdt_shortcode_media` (GraphQL v2 - single reel)
  2. `shortcode_media` (GraphQL v1 - single reel)
  3. `xdt_api__v1__clips__home__connection_v2` (reels feed)
  4. `xdt_api__v1__clips__user__connection_v2` (user reels)
  5. `items` array (feed responses)
  6. Nested `data.items` structures

**Extracts:**
- `post_id` (shortcode)
- `author_username`
- `caption` (with fallback to multiple caption fields)
- `likes_count`, `comments_count`, `view_count`
- `video_url`, `thumbnail_url`
- `created_at` timestamp
- Hashtags (via `HashtagExtractor.extractFromGraphQL()`)

**When used:** Automatically when GraphQL responses are intercepted by `RequestInterceptor` and processed by `GraphQLHandler`.

**Advantages:**
- ✅ Most complete data (includes view counts, video URLs)
- ✅ Fast (no DOM parsing needed)
- ✅ Reliable (structured API data)

---

### 2. DOMExtractor (`src/extraction/dom-extractor.js`)

**Purpose:** Fallback extraction method - extracts reel data from rendered DOM when GraphQL fails.

**How it works:**
- Uses `page.evaluate()` to scrape visible page elements
- Extracts data from:
  - URL patterns (`/reel/` or `/reels/`)
  - Author links (`<a>` tags)
  - Caption text (`<h1>`, `span[dir="auto"]`)
  - Like/comment buttons (aria-labels)
- Uses `HashtagExtractor` for both DOM links and caption text

**Extracts:**
- `post_id` (from URL)
- `author_username` (from profile links)
- `caption` (from text content)
- `likes_count`, `comments_count` (from aria-labels)
- Hashtags (from DOM links and caption)

**When used:** Fallback when GraphQL data is not available for current reel.

**Limitations:**
- ❌ No view counts (not in DOM)
- ❌ No video URLs (not in DOM)
- ❌ Slower (requires DOM parsing)
- ❌ Less reliable (depends on page structure)

---

### 3. ReelCollector (`src/extraction/reel-collector.js`)

**Purpose:** In-memory cache and deduplication manager - stores extracted reels and prevents duplicates.

**How it works:**
- Uses a `Map` keyed by `post_id` for O(1) lookup
- Maintains two arrays:
  - `collectedReels` (Map) - for deduplication
  - `networkReels` (Array) - for sequential access

**Key Methods:**
- `addReel(reelData)` - Adds reel if not already collected
- `getReel(postId)` - Retrieves reel by ID
- `hasReel(postId)` - Checks if reel exists
- `getAllReels()` - Returns all unique reels
- `getNetworkReels()` - Returns network-captured reels

**When used:** 
- Automatically by `GraphQLHandler` when processing GraphQL responses
- By `Scraper` to check if reel was already collected

**Does NOT extract data** - only stores and manages extracted data.

---

### 4. ReelDataTransformer (`src/extraction/reel-data-transformer.js`)

**Purpose:** Normalizes and validates data from different sources into a standard format.

**How it works:**
- Transforms raw data to standard schema
- Merges data from multiple sources (prioritizes GraphQL over DOM)
- Validates data structure
- Adds metadata: `source`, `extracted_at` timestamp

**Key Methods:**
- `transform(reelData, source)` - Normalizes single reel data
- `merge(graphqlData, domData)` - Combines GraphQL + DOM data
- `validate(reelData)` - Validates data structure

**When used:** 
- By `Scraper` to normalize data before saving
- To merge GraphQL and DOM data when both are available

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Network Interception                      │
│              (RequestInterceptor + GraphQLHandler)           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │  GraphQL Response      │
            │  (Instagram API)       │
            └───────────┬─────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │   GraphQLExtractor             │
        │   - Parses 6 GraphQL structures│
        │   - Extracts all reel metadata │
        └───────────┬───────────────────┘
                    │
                    ▼
        ┌───────────────────────────────┐
        │   ReelCollector                │
        │   - Stores in Map (dedup)     │
        │   - Tracks network reels      │
        └───────────┬───────────────────┘
                    │
                    ▼
        ┌───────────────────────────────┐
        │   Scraper checks cache         │
        │   - If found: use cached data  │
        │   - If not: try DOM extraction │
        └───────────┬───────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌───────────────┐      ┌───────────────┐
│ GraphQL Data  │      │  DOM Data     │
│ (from cache)  │      │  (fallback)   │
└───────┬───────┘      └───────┬───────┘
        │                       │
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────────────┐
        │   ReelDataTransformer          │
        │   - Merges GraphQL + DOM       │
        │   - Normalizes format           │
        │   - Validates structure        │
        └───────────┬───────────────────┘
                    │
                    ▼
        ┌───────────────────────────────┐
        │   CSVStorage                   │
        │   - Saves to posts.csv         │
        └───────────────────────────────┘
```

## Redundancy Analysis

**✅ No redundancy found** - Each module has a distinct, non-overlapping responsibility:

1. **GraphQLExtractor** = Primary data extraction (GraphQL)
2. **DOMExtractor** = Fallback data extraction (DOM)
3. **ReelCollector** = Storage/cache (not extraction)
4. **ReelDataTransformer** = Normalization (not extraction)

**Separation of Concerns:**
- Extraction modules extract data
- Collector stores data
- Transformer normalizes data

## Usage Patterns

### Typical Flow (GraphQL Available)
1. User navigates to reel
2. `RequestInterceptor` intercepts GraphQL response
3. `GraphQLHandler` processes response
4. `GraphQLExtractor` extracts reel data
5. `ReelCollector.addReel()` stores it
6. `Scraper` finds data in cache
7. `ReelDataTransformer.transform()` normalizes
8. `CSVStorage` saves to file

### Fallback Flow (GraphQL Unavailable)
1. User navigates to reel
2. No GraphQL response intercepted
3. `Scraper` checks `ReelCollector` - not found
4. `DOMExtractor.extractReelData()` scrapes DOM
5. `ReelDataTransformer.transform()` normalizes
6. `CSVStorage` saves to file

### Merged Flow (Both Available)
1. GraphQL data captured and stored
2. DOM data also extracted
3. `ReelDataTransformer.merge()` combines both
4. GraphQL data takes priority
5. DOM data fills gaps (if any)

## Metrics Tracking

The system should track:
- How many reels extracted from GraphQL vs DOM
- Cache hit rate (reels found in cache)
- Extraction success rate per method

**Future Enhancement:** Add extraction source metrics to `ReelCollector` or `Scraper`.

## Component Logging

With the updated logger system, each module now logs with its component name:
- `GraphQLExtractor` logs show `"service":"GraphQLExtractor"`
- `DOMExtractor` logs show `"service":"DOMExtractor"`
- `ReelCollector` logs show `"service":"ReelCollector"`
- `ReelDataTransformer` logs show `"service":"ReelDataTransformer"`

This makes it easy to see which extraction method is being used in logs.

