# Split Lease Search Page

A modern, high-performance property search application for flexible shared accommodations with weekly scheduling. Built with vanilla JavaScript and React islands architecture, powered by Supabase and Google Maps.

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Usage Guide](#usage-guide)
- [Architecture](#architecture)
- [Technologies](#technologies)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Overview

Split Lease Search is a progressive web application that enables users to find and filter shared accommodations across NYC and New Jersey with flexible weekly scheduling. The platform features advanced filtering, dynamic pricing based on stay duration, interactive maps, and AI-powered market research.

### What Makes It Special

- **100% Database-Driven Filtering**: All location data loaded dynamically from Supabase—no hardcoded values
- **Intelligent Pricing**: Real-time price calculations based on selected nights (2-7 nights)
- **Advanced Schedule Selector**: React-powered UI with contiguous day validation
- **Lazy Loading**: Fast initial page load with progressive content rendering (6 listings per batch)
- **Offline Capability**: IndexedDB backup for resilient performance
- **Mobile-First Design**: Fully responsive across all device sizes

---

## ✨ Key Features

### 🔍 Advanced Filtering System

**6 Filter Groups**:
1. **Borough Filter** - Select from 7 NYC/NJ boroughs (database-driven)
2. **Neighborhood Filter** - Multi-select from 293+ neighborhoods with real-time search
3. **Week Pattern Filter** - Choose rental patterns (every week, alternating weeks, etc.)
4. **Price Tier Filter** - Select price ranges (<$200 to $500+)
5. **Sort Options** - Recommended, price, views, or recent additions
6. **Schedule Selector** - Interactive 7-day picker with 2-5 contiguous day constraint

### 🗺️ Interactive Mapping

- **Google Maps Integration** with custom price markers
- **Property Clustering** for high-density areas
- **Info Windows** with listing previews on marker click
- **Synchronized Updates** - map markers reflect current filters
- **Street/Satellite Views** with zoom controls

### 💰 Dynamic Pricing

- **Real-Time Calculations** based on selected nights
- **Per-Night Rates** for 2, 3, 4, 5, and 7-night stays
- **Instant Updates** when schedule changes
- **Transparent Pricing** - see exactly what you'll pay per night

### 🤖 AI Market Research

- **Deep Research Feature** - Get personalized market insights
- **Smart Extraction** - Automatically parses email/phone from freeform text
- **Auto-Correction** - Fixes common email typos (gmial → gmail)
- **Multi-Step Wizard** - Guided experience with Lottie animations
- **Instant Reports** - AI-generated market research delivered to email

### 📱 Contact & Messaging

- **Direct Host Contact** - Message property owners through modal interface
- **Form Validation** - Email format and required field checks
- **Bubble.io Integration** - Reliable message delivery via workflow API
- **Loading States** - Clear feedback during submission

### ⚡ Performance Features

- **Lazy Loading** - Load 6 listings at a time for instant initial render
- **Batch Photo Fetching** - Single database query for all images
- **Optimized Queries** - Efficient PostgREST filters with proper indexing
- **Script Cache-Busting** - Version parameters ensure latest code
- **Intersection Observer** - Native browser API for scroll detection

---

## 🚀 Quick Start

### Prerequisites

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Python 3.x (for local development server) OR any HTTP server
- API keys (see [Detailed Setup](#detailed-setup))

### 5-Minute Setup

```bash
# 1. Clone the repository
git clone <repository-url>
cd search-page-2

# 2. Create configuration file
# Create js/config.local.js with your API keys:
cat > js/config.local.js << 'EOF'
window.ENV = window.ENV || {};
window.ENV.SUPABASE_ANON_KEY = 'your_supabase_anon_key_here';
window.ENV.GOOGLE_MAPS_API_KEY = 'your_google_maps_key_here';
window.ENV.BUBBLE_API_KEY = 'your_bubble_api_key_here';
EOF

# 3. Start local server
python -m http.server 8000

# 4. Open in browser
# Navigate to http://localhost:8000
```

**Note**: You'll need to replace the placeholder API keys with actual values. See [Detailed Setup](#detailed-setup) for how to obtain them.

---

## 🛠️ Detailed Setup

### 1. Environment Configuration

Create `js/config.local.js` in the project root (this file is git-ignored):

```javascript
window.ENV = window.ENV || {};

// Supabase Configuration
window.ENV.SUPABASE_URL = 'https://qcfifybkaddcoimjroca.supabase.co';
window.ENV.SUPABASE_ANON_KEY = 'your_actual_supabase_anon_key';

// Google Maps API
window.ENV.GOOGLE_MAPS_API_KEY = 'your_google_maps_api_key';

// Bubble.io Configuration (optional for contact features)
window.ENV.BUBBLE_API_KEY = 'your_bubble_api_key';
window.ENV.BUBBLE_API_BASE_URL = 'https://app.split.lease/api/1.1';
window.ENV.BUBBLE_MESSAGING_ENDPOINT = 'https://app.split.lease/api/1.1/wf/core-contact-host-send-message';
```

### 2. Obtain API Keys

#### Supabase Setup

1. Create account at [supabase.com](https://supabase.com)
2. Create new project or use existing
3. Go to **Settings → API**
4. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon/public key** → `SUPABASE_ANON_KEY`

**Important**: The anon key is safe for frontend use and has Row Level Security (RLS) policies applied.

#### Google Maps API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable APIs:
   - **Maps JavaScript API**
   - **Places API**
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. **Restrict the key** (recommended):
   - Application restrictions: HTTP referrers
   - Add your domain(s)
   - API restrictions: Select only Maps JavaScript API and Places API

#### Bubble.io Setup (Optional)

**For Read-Only Features**: No setup needed—existing endpoints work out of the box.

**For Contact/Messaging Features**: Contact Split Lease team for API key.

### 3. Database Setup

The application connects to an existing Supabase database. If you need to set up your own:

#### Required Tables

1. **`listing`** - Main property listings (111 columns)
2. **`listing_photo`** - Photo URLs linked to listings
3. **`zat_geo_borough_toplevel`** - Borough lookup table
4. **`zat_geo_hood_mediumlevel`** - Neighborhood lookup table
5. **`zat_features_listingtype`** - Space type lookup (Entire Place, Private Room)
6. **`informationaltexts`** - Dynamic tooltip content

See [TECHNICAL_REFERENCE.md](./TECHNICAL_REFERENCE.md) for complete schema details.

### 4. Install Dependencies (Optional)

For React component development:

```bash
npm install
```

**Dependencies**:
- `react@18.2.0` - React library
- `react-dom@18.2.0` - React DOM renderer
- `styled-components@6.1.0` - CSS-in-JS styling
- `playwright@1.55.1` - Testing framework

### 5. Build React Components (Optional)

If modifying the Schedule Selector or other React components:

```bash
# One-time build
npm run build:components

# Watch mode for development
npm run dev:components
```

Output: `dist/schedule-selector.js`

### 6. Production Deployment

#### Option A: Static Hosting (Netlify, Vercel, Cloudflare Pages)

```bash
# Build production assets
npm run build

# Deploy dist/ folder to your hosting provider
```

#### Option B: Traditional Web Server (Apache, Nginx)

1. Copy all files to web root
2. Ensure `js/config.local.js` exists with production keys
3. Configure HTTPS (required for geolocation and some APIs)
4. Set cache headers for static assets

#### Environment-Specific Configuration

For different environments (dev/staging/prod), use build scripts:

```bash
# Generate config from environment variables
node build-cloudflare.js
```

This replaces placeholders in `config.js.template` with actual environment variables.

---

## 📖 Usage Guide

### For End Users

#### Searching for Properties

1. **Open the application** in your web browser
2. **Use filters** to narrow results:
   - Select a **borough** from dropdown
   - Choose **neighborhoods** (multi-select with search)
   - Pick your **rental pattern** (weekly, bi-weekly, etc.)
   - Set **price range**
   - Choose **sort order**
3. **Select your schedule**:
   - Click days in the schedule selector
   - Must select 2-5 contiguous days
   - Prices update automatically
4. **Browse listings**:
   - Scroll to see more (6 at a time load automatically)
   - Click photos to view carousel
   - Check map for locations
5. **Contact hosts**:
   - Click **"Contact Host"** on any listing
   - Fill in your details and message
   - Submit to send inquiry

#### Using the Map

- **View Mode Toggle**: Switch between Street and Satellite views
- **Marker Click**: Click price markers to see listing preview
- **Zoom/Pan**: Use mouse or touch gestures to navigate
- **Legend**: Blue = available, Purple = selected listing

#### AI Market Research

1. Click the **purple atom icon** (floating button, bottom-right)
2. Describe your housing needs in freeform text
3. Include your email/phone (or enter separately)
4. Confirm contact details
5. Receive AI-generated market report via email within 24 hours

### For Developers

#### Project Structure

```
search-page-2/
├── index.html                 # Main entry point
├── js/                        # JavaScript modules
│   ├── app.js                 # Core application logic (1,592 lines)
│   ├── supabase-api.js        # Database client (537 lines)
│   ├── filter-config.js       # Dynamic filter configuration (283 lines)
│   ├── config.js              # Environment config
│   └── ...                    # Supporting modules
├── css/                       # Stylesheets
│   ├── styles.css             # Main styles
│   ├── responsive.css         # Media queries
│   └── ai-signup.css          # Modal styles
├── components/                # React components
│   ├── ScheduleSelector/      # Day picker component
│   ├── ContactHost/           # Messaging modal
│   └── AiSignup/              # Research signup
├── assets/                    # Images and animations
└── dist/                      # Built components
```

#### Key Files & Line Numbers

- **`js/app.js:534`** - `applyFilters()` - Main filter logic
- **`js/app.js:16`** - `calculateDynamicPrice()` - Pricing calculations
- **`js/supabase-api.js:46`** - `getListings()` - Database queries
- **`js/supabase-api.js:191`** - `transformListing()` - Data transformation
- **`js/filter-config.js:283`** - Dynamic filter configuration
- **`components/ScheduleSelector/SearchScheduleSelector.tsx:400`** - React day picker

#### Adding New Features

**Add a New Filter**:

1. Update `filter-config.js` to include new filter type
2. Add UI element in `index.html`
3. Wire event listener in `app.js:setupEventListeners()`
4. Update `applyFilters()` in `app.js:534` to handle new filter
5. Modify `SupabaseAPI.getListings()` to apply database filter

**Add a New Listing Field**:

1. Ensure field exists in Supabase `listing` table
2. Update `SupabaseAPI.transformListing()` in `supabase-api.js:191` to map field
3. Update `createListingCard()` in `app.js` to display field
4. Add CSS styling in `css/styles.css`

**Modify Schedule Selector**:

1. Edit `components/ScheduleSelector/SearchScheduleSelector.tsx`
2. Build with `npm run build:components`
3. Test integration with `js/schedule-selector-integration.js`

#### Development Workflow

```bash
# 1. Start development server
python -m http.server 8000

# 2. Watch React components (in separate terminal)
npm run dev:components

# 3. Make changes to files
# 4. Refresh browser to see updates

# 5. For JavaScript changes - no build needed
# 6. For React component changes - auto-rebuilt by watch mode
```

#### Testing

```bash
# Run Playwright tests
npm test

# Run specific test file
npx playwright test tests/filters.spec.js

# Run in headed mode (see browser)
npx playwright test --headed
```

---

## 🏗️ Architecture

### Hybrid Architecture: Vanilla JS + React Islands

**Core Philosophy**: Keep the main application lightweight with vanilla JavaScript, use React only for complex interactive components.

```
┌─────────────────────────────────────────┐
│          Browser (Client-Side)          │
├─────────────────────────────────────────┤
│  Vanilla JavaScript (ES6+)              │
│  ├── App Controller (app.js)            │
│  ├── Event Handlers                     │
│  ├── DOM Manipulation                   │
│  └── State Management (Window objects)  │
├─────────────────────────────────────────┤
│  React Islands (Specific Components)    │
│  ├── Schedule Selector (TypeScript)     │
│  ├── Informational Text (Tooltips)      │
│  └── Contact Host Modal (JSX)           │
├─────────────────────────────────────────┤
│  API Layer                              │
│  ├── Supabase Client (Read Operations)  │
│  └── Bubble.io API (Write Operations)   │
└─────────────────────────────────────────┘
         ↓                    ↓
┌──────────────────┐  ┌─────────────────┐
│    Supabase      │  │   Bubble.io     │
│   (PostgreSQL)   │  │   Workflows     │
│  - Listings      │  │  - Messaging    │
│  - Photos        │  │  - AI Research  │
│  - Locations     │  │  - Auth         │
└──────────────────┘  └─────────────────┘
```

### Data Flow Architecture

**Filter Application Flow**:
```
User Changes Filter
    ↓
Event Listener Triggered
    ↓
Collect All Filter Values
    ↓
FilterConfig.buildFilterConfig() - Convert to DB format
    ↓
SupabaseAPI.getListings(filters) - Query database
    ↓
Transform Database Format to App Format
    ↓
renderListings() - Update DOM
    ↓
updateMapMarkers() - Sync map
    ↓
User Sees Updated Results
```

**Dynamic Pricing Flow**:
```
User Selects Days in Schedule Selector
    ↓
React Component Callback: onSelectionChange(days)
    ↓
Update window.selectedDays global variable
    ↓
window.updateAllDisplayedPrices() - Recalculate all cards
    ↓
For each listing: calculateDynamicPrice(listing, nightCount)
    ↓
Update DOM with new prices
    ↓
window.applyFilters() - Re-fetch if filters active
```

### State Management

**Global State** (Window Objects):
- `window.ENV` - Environment configuration
- `window.SupabaseAPI` - Database client instance
- `window.FilterConfig` - Filter configuration manager
- `window.currentListings` - Currently displayed listings
- `window.selectedDays` - Schedule selection (array of day indices)
- `window.mapInstance` - Google Maps instance

**Component-Local State**:
- React components use hooks (`useState`, `useEffect`)
- Vanilla JS modals use object properties
- Lazy loading uses module-scoped counters

---

## 💻 Technologies

### Frontend Stack

- **HTML5** - Semantic markup
- **CSS3** - Custom properties, Flexbox, Grid
- **JavaScript ES6+** - Modern syntax, modules, async/await
- **React 18** - Component library for complex UI
- **TypeScript** - Type safety for React components
- **Styled Components** - CSS-in-JS for React styling

### Backend & Database

- **Supabase** - PostgreSQL database with real-time capabilities
  - PostgREST API for fast queries
  - Row Level Security (RLS) policies
  - Foreign key relationships with data integrity
- **Bubble.io** - No-code backend for workflows
  - Message delivery
  - AI processing coordination
  - User authentication (future)

### External Services

- **Google Maps Platform**
  - Maps JavaScript API
  - Places API
  - Custom markers and info windows
- **Lottie** - JSON-based animations
- **CDN Resources** - React, Supabase client, fonts

### Build & Development

- **Vite** - Fast build tool for React components
- **TypeScript Compiler** - Type checking
- **Playwright** - End-to-end testing
- **Python HTTP Server** - Local development

---

## 🐛 Troubleshooting

### Common Issues

#### No Listings Displayed

**Symptoms**: Filters show results count, but no listings appear.

**Cause**: Critical bug in `supabase-api.js:64` - all listings lack `Approved=true` flag.

**Solution**:
```javascript
// js/supabase-api.js line 64
// Remove this line:
.eq('Approved', true)

// Or change to:
.in('Approved', [true, null, false])  // Show all regardless of approval
```

**Verification**: Check browser console for empty result arrays.

#### Map Not Loading

**Symptoms**: Map section shows placeholder or error.

**Causes**:
1. Invalid Google Maps API key
2. API not enabled in Google Cloud Console
3. Domain restriction preventing access

**Solutions**:
1. Verify `GOOGLE_MAPS_API_KEY` in `config.local.js`
2. Enable both **Maps JavaScript API** and **Places API**
3. Add your domain to allowed referrers (or remove restrictions for testing)
4. Check browser console for specific Google Maps errors

#### Prices Not Updating

**Symptoms**: Changing schedule selector doesn't update listing prices.

**Causes**:
1. React component not loaded
2. Integration script failed to wire callback
3. Missing price fields in database

**Solutions**:
1. Check console for React errors during initialization
2. Verify `dist/schedule-selector.js` exists and loads
3. Confirm `window.updateAllDisplayedPrices` function exists
4. Check database for `💰Nightly Host Rate for X nights` fields

#### Filters Not Working

**Symptoms**: Selecting filters doesn't change results.

**Causes**:
1. Filter configuration not initialized
2. Database connection failed
3. Incorrect filter IDs

**Solutions**:
1. Ensure `FilterConfig.initializeFilterConfig()` called after Supabase init
2. Check browser console for Supabase connection errors
3. Verify borough/neighborhood IDs match database values
4. Test with single filter to isolate issue

### Debugging Tips

#### Enable Detailed Logging

```javascript
// In browser console
window.DEBUG = true;

// Or uncomment in app.js
const DEBUG = true;
```

#### Check Supabase Connection

```javascript
// Browser console
console.log(window.SupabaseAPI);
console.log(window.ENV.SUPABASE_URL);
console.log(window.ENV.SUPABASE_ANON_KEY);

// Test query
await window.SupabaseAPI.getBoroughs();
```

#### Inspect Filter State

```javascript
// Browser console
console.log(window.FilterConfig);
console.log(window.selectedDays);
console.log(window.currentListings);
```

### Browser Compatibility

**Supported**:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari iOS 14+
- Chrome Mobile Android 90+

**Known Issues**:
- Internet Explorer: Not supported (uses ES6+ features)
- Old Safari (<14): Intersection Observer may need polyfill

---

## 🤝 Contributing

### Development Guidelines

1. **Code Style**:
   - Use ES6+ features
   - Prefer `const` over `let`, avoid `var`
   - Use template literals for strings
   - Add JSDoc comments for functions
   - Follow existing naming conventions

2. **Git Workflow**:
   ```bash
   # Create feature branch
   git checkout -b feature/your-feature-name

   # Make changes and commit
   git add .
   git commit -m "feat: Add new feature description"

   # Push and create PR
   git push origin feature/your-feature-name
   ```

3. **Commit Messages**:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `style:` - Code style changes (formatting)
   - `refactor:` - Code refactoring
   - `perf:` - Performance improvements
   - `test:` - Test additions/changes
   - `chore:` - Build process, dependencies

### Project Priorities

**Current Focus**:
1. Fix critical Approved filter bug (see `supabase-api.js:64`)
2. Verify dynamic borough/neighborhood loading
3. Add comprehensive test coverage
4. Improve error handling and user feedback

**Future Roadmap**:
1. Add listing title/description search
2. Implement user accounts and saved searches
3. Add favorites/bookmarking
4. Build host dashboard
5. Integrate payment processing
6. Add review/rating system

---

## 📄 License

MIT License - See [LICENSE](./LICENSE) file for details.

---

## 📞 Contact

**Split Lease**
- Website: [app.split.lease](https://app.split.lease)

---

## 🙏 Acknowledgments

- Built with [Supabase](https://supabase.com)
- Maps powered by [Google Maps Platform](https://cloud.google.com/maps-platform)
- Workflows powered by [Bubble.io](https://bubble.io)
- Animations from [Lottie](https://airbnb.design/lottie/)

---

**Last Updated**: 2025
**Version**: 1.0.0
**Status**: Active Development
