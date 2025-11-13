# Feature: Listing Cards Improvement

## Metadata
adw_id: `402e5067`
prompt: `Using the plan from the local file: C:\Users\igor\My Drive (splitleaseteam@gmail.com)\!Agent Context and Tools\SL1\TAC - Search\app\search-page-2\plan\listing-cards-improvement-plan.md make improvements to the Listing Cards. Use the mcp-tool-specialist subagent exclusively and generously to invoke playwright mcp, and also supabase mcp, as and when needed. To validate the build process, and refocus.`

## Feature Description
This feature comprehensively improves the Split Lease listing cards to address critical information gaps, enhance scannability, clarify pricing, and improve overall user experience. Based on extensive code analysis and competitive research, we will systematically add missing bedroom/bathroom counts, amenity icons, schedule indicators, and enhanced pricing displays while maintaining the clean, professional design aesthetic.

The improvements target key user pain points identified through analysis: inability to quickly scan essential property details (beds/baths), hidden amenities that are deal-breakers, confusing dual-price displays, and truncated descriptions. These changes will dramatically improve decision-making speed and user satisfaction.

## User Story
As a **prospective tenant searching for short-term accommodation in NYC**
I want to **quickly scan listing cards to see essential property details (bedrooms, bathrooms, amenities) and understand pricing clearly**
So that **I can efficiently compare properties and make informed decisions without clicking into every listing**

## Problem Statement
The current listing card implementation displays only 11 of 31+ available data fields, forcing users to click into each listing to see critical information like bedroom/bathroom counts and available amenities. The dual-price display (starting price vs. selected-days price) confuses users about actual costs. Description text frequently truncates mid-sentence without indication. These information gaps significantly slow the user's ability to filter and compare properties, leading to decision fatigue and potentially lower conversion rates.

## Solution Statement
We will systematically enhance listing cards through a 3-phase approach:
1. **Phase 1 (Critical)**: Add bedroom/bathroom display, implement amenity icon rows, clarify pricing with better labeling, and fix description truncation with line-clamp
2. **Phase 2 (High Priority)**: Increase card height for better information density, add schedule/availability indicators, implement quick action buttons
3. **Phase 3 (Polish)**: Optimize mobile responsiveness, enhance image carousel, and add comparison features

This approach maintains the existing design language while strategically adding high-value information through progressive disclosure principles.

## Relevant Files
Use these files to implement the feature:

### Core Application Files
- **`app/search-page-2/js/app.js`** (lines 320-404) - Contains `createListingCard()` function that builds listing HTML structure. This is the primary file to modify for UI changes.
- **`app/search-page-2/js/supabase-api.js`** (lines 191-350) - Contains `transformListing()` function that maps database fields to app format. Must update to extract bedroom/bathroom/amenity data.
- **`app/search-page-2/css/styles.css`** - Main stylesheet for listing cards. Will add new CSS for amenity icons, bedroom/bathroom specs, enhanced pricing, and schedule indicators.
- **`app/search-page-2/css/responsive.css`** - Mobile/tablet breakpoints. Will optimize for smaller screens in Phase 3.

### Supporting Files
- **`app/search-page-2/js/filter-config.js`** - May need updates if adding new filterable amenities
- **`app/search-page-2/js/schedule-selector-integration.js`** - Integration between schedule selector and pricing updates
- **`app/search-page-2/index.html`** - Main entry point, may need script updates

### New Files

#### Phase 1 New Files
- **`app/search-page-2/js/amenity-utils.js`** - New utility module for parsing and rendering amenity icons
- **`app/search-page-2/js/pricing-display.js`** - New module for enhanced pricing calculations and display
- **`app/search-page-2/css/listing-enhancements.css`** - New stylesheet specifically for Phase 1 enhancements (amenities, specs, pricing)

#### Phase 2 New Files
- **`app/search-page-2/js/quick-actions.js`** - New module for quick action buttons (quick view, share, compare)
- **`app/search-page-2/js/schedule-display.js`** - New utility for rendering schedule/availability indicators

#### Phase 3 New Files
- **`app/search-page-2/js/comparison-manager.js`** - New module for managing listing comparisons
- **`app/search-page-2/components/ComparisonModal/`** - New React component for side-by-side comparison view

### Testing Files
- **`app/search-page-2/tests/listing-cards.spec.js`** - New Playwright test suite for listing card functionality
- **`app/search-page-2/tests/pricing-updates.spec.js`** - New tests for dynamic pricing behavior
- **`app/search-page-2/tests/responsive.spec.js`** - New tests for mobile/tablet layouts

## Implementation Plan

### Phase 1: Foundation & Critical Fixes (Week 1)
**Goal**: Address user-blocking information gaps
**Estimated Effort**: 2-3 days

This phase focuses on the most critical missing information that prevents users from making decisions. We'll add bedroom/bathroom counts, amenity icons, clarify pricing, and fix description truncation.

**Key Deliverables**:
- Bedroom and bathroom counts visible on all cards
- Top 4-6 amenity icons displayed per listing
- Clear, labeled pricing with explanation
- Full description visible or properly truncated with line-clamp

### Phase 2: Core Implementation & Enhancement (Week 2)
**Goal**: Improve scannability and user experience
**Estimated Effort**: 3-4 days

This phase adds schedule indicators, quick action buttons, and increases card height to accommodate all new information without cramping.

**Key Deliverables**:
- Schedule/availability indicator showing available days
- Quick action buttons (Quick View, Message, Share, Compare)
- Increased card height (260px → 300px) for better information density
- Feature badges (New, Hot, Price Drop, etc.)

### Phase 3: Integration & Polish (Week 3-4)
**Goal**: Mobile optimization, advanced features, and refinement
**Estimated Effort**: 4-5 days

This phase optimizes for mobile devices, enhances the image carousel, and adds comparison functionality.

**Key Deliverables**:
- Fully responsive design for mobile/tablet
- Enhanced image carousel with better controls
- Comparison feature for side-by-side property analysis
- Host information redesign for space efficiency
- Performance optimizations and testing

## Step by Step Tasks
IMPORTANT: Execute every step in order, top to bottom.

### 1. Verify Database Schema and Available Fields
- Use Supabase MCP tool to list all tables in the database
- Use Supabase MCP tool to verify `listing` table has bedroom/bathroom fields
- Document which fields exist: `No of Bedrooms`, `No of Bathrooms`, `Building Type (if Multi-Family)`
- Verify amenity/feature data structure in `Features` field
- Check if schedule fields exist: `Days Available (List of Days)`, `Nights Available (numbers)`
- Document pricing fields: `💰Nightly Host Rate for 2 nights` through `💰Nightly Host Rate for 7 nights`

### 2. Create Utility Modules for Phase 1
- Create `js/amenity-utils.js` with functions for:
  - `parseAmenities(featuresField)` - Extract amenities from database field
  - `renderAmenityIcons(amenities, maxVisible=6)` - Generate HTML for amenity icon row
  - Define amenity priority mapping (WiFi, Furnished, Pet-Friendly, Washer/Dryer, Parking, Elevator, etc.)
- Create `js/pricing-display.js` with functions for:
  - `renderEnhancedPricing(listing, selectedDaysCount)` - Generate improved pricing HTML
  - `showPricingBreakdown(listingId)` - Display detailed pricing modal
- Create `css/listing-enhancements.css` with styles for:
  - `.listing-amenities` and `.amenity-icon` classes
  - `.listing-specs` and `.spec-item` classes
  - `.pricing-info-enhanced` classes
  - Responsive styles for new elements

### 3. Update Data Transformation Layer
- Modify `js/supabase-api.js` `transformListing()` function (line ~191)
- Add extraction of bedroom count: `bedrooms: parseInt(dbListing['No of Bedrooms']) || null`
- Add extraction of bathroom count: `bathrooms: parseFloat(dbListing['No of Bathrooms']) || null`
- Add building type: `buildingType: dbListing['Building Type (if Multi-Family)'] || null`
- Add days available parsing: `daysAvailable: this.parseDaysAvailable(dbListing['Days Available (List of Days)'])`
- Add nights available parsing: `nightsAvailable: this.parseNightsAvailable(dbListing['Nights Available (numbers)'])`
- Add amenities parsing: `amenities: this.parseAmenities(dbListing['Features'])`
- Implement helper functions: `parseDaysAvailable()`, `parseNightsAvailable()`, `parseAmenities()`

### 4. Update Listing Card HTML Generation
- Modify `js/app.js` `createListingCard()` function (line ~320)
- Add bedroom/bathroom spec line using new `renderListingSpecs()` helper
- Insert amenity icons row after specs line using `renderAmenityIcons()` from amenity-utils
- Update description with line-clamp CSS classes for proper truncation
- Replace pricing section with enhanced pricing using `renderEnhancedPricing()` from pricing-display
- Add schedule indicator if days available using `renderScheduleIndicator()` helper

### 5. Implement Bedroom/Bathroom Display
- Create `renderListingSpecs(listing)` function in `app.js`
- Build spec items array with bedrooms, bathrooms, type, square feet, max guests
- Format as: "2BR • 1BA • Apartment • 850 SQFT • 4 guests"
- Add separator dots between items
- Style with `.listing-specs` flexbox layout
- Make bedroom/bathroom count bold and colored with primary purple

### 6. Implement Amenity Icons System
- In `js/amenity-utils.js`, create icon mapping for 12 priority amenities
- Define icons: Furnished (🛋️), Pet-Friendly (🐕), WiFi (📶), Washer/Dryer (🧺), Parking (🅿️), Elevator (🏢), Gym (💪), Doorman (🚪), A/C (❄️), Kitchen (🍳), Workspace (💻), Balcony (🌿)
- Implement `renderAmenityIcons()` to show top 6 with "+X more" counter
- Add hover tooltips showing amenity names using `data-tooltip` attribute
- Style icons as 32x32px squares with light background, hover effects
- Implement `showAllAmenities(listingId)` for modal with full amenity list

### 7. Implement Enhanced Pricing Display
- In `js/pricing-display.js`, create `renderEnhancedPricing()` function
- Calculate dynamic price based on selected days using existing `calculateDynamicPrice()`
- Show primary price: "Your Selection (X nights) - $X.XX/night" in large, bold text
- Show secondary price: "Normally from $Y/night" in smaller, gray text (if different)
- Add "ℹ️ Details" button that calls `showPricingBreakdown()`
- Implement pricing breakdown modal showing all 2-7 night rates
- Style with clear visual hierarchy: primary price prominent, secondary subtle

### 8. Fix Description Truncation
- Update `.listing-details` CSS with line-clamp
- Add `-webkit-line-clamp: 3` to limit to 3 lines
- Add `-webkit-box-orient: vertical` and `overflow: hidden`
- Add ellipsis for overflow indication
- Optional: Add "Read more" button that expands description inline
- Test with various description lengths

### 9. Create Schedule Indicator Component
- Create `renderScheduleIndicator(daysAvailable)` function in new `js/schedule-display.js`
- Map day names (Monday, Tuesday, etc.) to indices 0-6
- Render 7-day strip showing SMTWTFS abbreviations
- Highlight available days in primary purple, unavailable in gray
- Style as compact inline element with 20x20px day boxes
- Position after property specs line

### 10. Implement Quick Actions Bar (Phase 2)
- Create `js/quick-actions.js` module
- Add quick actions footer to card HTML in `createListingCard()`
- Implement 4 action buttons: Quick View (👁️), Message (📧), Share (📤), Compare (☑️)
- Wire up event handlers for each action
- Implement `openQuickView(listingId)` - shows modal with detailed preview
- Implement `shareListing(listingId)` - copies link to clipboard or shows share sheet
- Implement `toggleCompare(listingId)` - adds/removes from comparison set
- Style actions as flexbox row with equal-width buttons, borders, hover effects

### 11. Increase Card Height
- Update `.listing-card` CSS from `height: 260px` to `height: 300px`
- OR change to `min-height: 300px` with `height: auto` for dynamic height
- Test that all new elements fit comfortably
- Verify no content overflow or clipping
- Measure impact on cards per viewport (should show ~2.5 cards instead of 3)
- Adjust if needed based on information density vs. viewport usage trade-off

### 12. Add Feature Badges
- Implement badge system for "New Listing" (already exists)
- Add conditional badges: Hot/Popular, Price Drop, Superhost, Fast Booking
- Position badges in top-left of image area
- Stack multiple badges vertically if needed
- Style with small rounded rectangles, distinct colors per badge type
- Wire up logic for when to show each badge (isNew, isPriceReduced, isSuperhost, etc.)

### 13. Implement Comparison Feature
- Create `js/comparison-manager.js` to track selected listings
- Maintain `window.comparisonSet` Set of listing IDs
- Add sticky comparison bar at bottom of page showing "X listings selected"
- Add "Compare" button that opens comparison modal
- Create comparison modal showing side-by-side table of all features
- Highlight differences between listings
- Allow removing listings from comparison
- Style comparison bar and modal for clarity

### 14. Mobile Responsive Optimization (Phase 3)
- Update `css/responsive.css` with new breakpoints for enhanced cards
- At 768px: Switch to single column, stack image above content vertically
- At 576px: Condense amenity icons to top 4, smaller quick action buttons
- Ensure touch targets are minimum 44x44px for mobile
- Add swipe gesture support for image carousel on mobile
- Test on iOS (iPhone 12+) and Android (Pixel, Samsung) using Playwright MCP
- Verify layout doesn't break, all text readable, buttons tappable

### 15. Enhanced Image Carousel
- Add always-visible navigation dots below image
- Implement thumbnail strip that appears on hover (desktop only)
- Add swipe gesture detection for mobile using touch events
- Preload next/previous images for faster navigation
- Add image counter that's always visible (not just on hover)
- Implement zoom on click for full-screen view
- Update navigation controls to be more prominent

### 16. Host Information Redesign
- Compact host section from 2 lines to 1 line
- Reduce avatar from 40px to 32px
- Layout as: `[Avatar] John D. ✓ [Message button]` inline
- Free up vertical space for other elements
- Maintain verified badge visibility
- Ensure message button remains easily clickable

### 17. Update Build Configuration
- Update `vite.config.js` to include new JS modules if using build step
- Ensure all new CSS files are imported in `index.html`
- Update script loading order: utilities first, then main app
- Add cache-busting parameters to new script tags
- Test production build with `npm run build`

### 18. Write Comprehensive Tests
- Create `tests/listing-cards.spec.js` using Playwright MCP
- Test: Bedroom/bathroom counts display correctly for various properties
- Test: Amenity icons appear and show correct tooltips on hover
- Test: Pricing updates when schedule selector changes
- Test: Description truncates properly and expands if implemented
- Test: Schedule indicator shows correct available days
- Test: Quick action buttons trigger correct functions
- Test: Comparison feature adds/removes listings correctly
- Test: Mobile layout stacks properly at breakpoints
- Test: Image carousel navigation works on desktop and mobile
- Create `tests/responsive.spec.js` for mobile-specific tests

### 19. Validate with Supabase MCP
- Use Supabase MCP to query sample listings and verify data structure
- Check that bedroom/bathroom fields are populated for most listings
- Verify amenity parsing works with actual Features field format
- Test pricing field availability (2-night through 7-night rates)
- Ensure schedule fields are in expected JSON format
- Document any data inconsistencies or missing fields
- Create SQL migration if database schema changes are needed

### 20. Validate with Playwright MCP Browser Testing
- Launch browser using Playwright MCP `browser_navigate` to local dev server
- Take screenshots of listing cards before and after changes
- Use `browser_snapshot` to capture accessibility tree
- Test interactive elements: click amenity icons, hover for tooltips
- Verify pricing updates when clicking schedule selector days
- Test quick action buttons: Quick View, Message, Share, Compare
- Resize browser window to test responsive breakpoints
- Verify mobile touch interactions work correctly
- Document any visual regressions or layout issues

### 21. Performance Testing and Optimization
- Measure page load time before and after changes
- Use browser DevTools Performance tab to check rendering performance
- Ensure lazy loading still works with enhanced cards
- Verify no layout thrashing or jank during scroll
- Check memory usage with many listings displayed
- Optimize any heavy operations (e.g., amenity parsing)
- Add request animation frame for smooth updates
- Test with slow network (3G throttling) to ensure progressive enhancement

### 22. A/B Testing Preparation
- Implement feature flag system for gradual rollout
- Add `window.FEATURE_FLAGS.enhancedCards` toggle
- Wrap new features in conditional logic based on feature flag
- Set up tracking for key metrics: CTR, time on page, message rate
- Prepare A/B test groups: 50% control (old cards), 50% variant (new cards)
- Document baseline metrics before launch
- Create monitoring dashboard for real-time metrics

### 23. Documentation and Handoff
- Update README.md with new features and usage
- Document all new utility functions with JSDoc comments
- Create architectural decision records (ADRs) for major changes
- Write user-facing documentation for new features
- Create video walkthrough of improvements
- Prepare stakeholder presentation with before/after comparisons
- Document known issues and future enhancement ideas

### 24. Final Integration Testing
- Test entire user flow: land on page → apply filters → select schedule → view cards → message host
- Verify no regressions in existing functionality (filters, map, sorting)
- Test with various data scenarios: missing fields, zero amenities, long descriptions
- Check error handling: database down, slow network, API errors
- Verify accessibility: keyboard navigation, screen reader compatibility
- Test cross-browser: Chrome, Firefox, Safari, Edge
- Final mobile device testing on real devices (not just emulators)

## Testing Strategy

### Unit Tests
- Test `parseAmenities()` with various input formats (string, JSON, null)
- Test `renderListingSpecs()` with missing fields (no bedrooms, no bathrooms)
- Test `calculateDynamicPrice()` with different night selections
- Test `renderScheduleIndicator()` with various day availability patterns
- Test `renderEnhancedPricing()` with edge cases (zero price, same base/dynamic price)
- Test amenity icon rendering with 0, 3, 6, and 12+ amenities

### Integration Tests
- Test full card rendering pipeline from database to DOM
- Test filter integration: ensure new fields don't break existing filters
- Test pricing integration: verify schedule selector updates all card prices
- Test modal integration: Quick View, pricing breakdown, all amenities
- Test comparison feature: add multiple listings, remove, compare
- Test map marker synchronization with enhanced cards

### End-to-End Tests (Playwright)
- **Test E2E-1: Initial Load**
  - Navigate to search page
  - Verify listing cards display with all new elements
  - Screenshot for regression testing
- **Test E2E-2: Schedule Price Updates**
  - Select 2 days in schedule selector
  - Verify all card prices update to 2-night rate
  - Change to 5 days, verify prices update to 5-night rate
- **Test E2E-3: Amenity Interactions**
  - Hover over amenity icon
  - Verify tooltip appears with amenity name
  - Click "+X more" if present
  - Verify modal shows all amenities
- **Test E2E-4: Quick Actions**
  - Click "Quick View" button
  - Verify modal opens with listing details
  - Close modal
  - Click "Share" button
  - Verify share functionality works (clipboard or share sheet)
- **Test E2E-5: Comparison Feature**
  - Click "Compare" on 3 different listings
  - Verify comparison bar shows "3 listings selected"
  - Click "Compare" button in bar
  - Verify comparison modal opens with side-by-side view
  - Remove one listing from comparison
  - Verify count updates to "2 listings selected"
- **Test E2E-6: Mobile Responsiveness**
  - Resize viewport to 375x667 (iPhone SE)
  - Verify vertical card layout
  - Test swipe gesture on image carousel
  - Verify touch targets are tappable
  - Check that amenity icons don't overflow
- **Test E2E-7: Error Handling**
  - Disconnect network
  - Verify graceful degradation (cached data, error messages)
  - Reconnect network
  - Verify recovery

### Edge Cases
1. **Missing Data**:
   - Listing with no bedrooms/bathrooms specified → Show "Studio" or hide spec line
   - Listing with no amenities → Show message "No amenities listed" or hide amenity row
   - Listing with no images → Show placeholder image
   - Listing with no pricing data → Show "Contact for pricing"

2. **Extreme Values**:
   - Listing with 10+ bedrooms → Ensure layout doesn't break
   - Listing with 50+ amenities → Properly truncate to "+44 more"
   - Very long description (500+ characters) → Line-clamp works correctly
   - Very short description (10 characters) → No line-clamp needed, displays naturally

3. **Schedule Edge Cases**:
   - No days available → Hide schedule indicator or show "Contact host"
   - All days available (7/7) → Show "Available every day"
   - Only weekends available → Show "Weekends only" badge

4. **Pricing Edge Cases**:
   - Same price for all night counts → Only show one price
   - Missing 3-night rate but have 2 and 4 → Interpolate or show "Contact for 3-night pricing"
   - Zero or negative price → Show validation error or "Invalid pricing"

5. **Mobile Edge Cases**:
   - Very small screen (320px width) → Ultra-compact layout
   - Landscape orientation on mobile → Hybrid layout
   - Tablet in portrait (768px) → Decide between mobile or desktop layout
   - High-DPI screens (Retina) → Ensure crisp icons and images

6. **Performance Edge Cases**:
   - 100+ listings loaded → Lazy loading must work correctly
   - Rapid filter changes → Debounce to prevent excessive re-renders
   - Slow database response → Show skeleton loaders, don't block UI
   - Offline mode → Use IndexedDB cache effectively

## Acceptance Criteria
The feature is considered complete when ALL of the following criteria are met:

### Phase 1 Completion Criteria
- [ ] Bedroom and bathroom counts display on 100% of cards where data exists
- [ ] At least 4 amenity icons display per card when amenities are available
- [ ] Amenity icons have hover tooltips showing amenity names
- [ ] "+X more" counter appears when more than 6 amenities exist
- [ ] Pricing displays with clear labels: "Your Selection (X nights)" and "Normally from"
- [ ] Pricing updates correctly when schedule selector changes
- [ ] Description properly truncates with line-clamp or is fully visible
- [ ] No visual regressions in existing card elements (location, title, type, host)

### Phase 2 Completion Criteria
- [ ] Card height increased to 300px or dynamic height implemented
- [ ] Schedule indicator shows available days as colored day letters (SMTWTFS)
- [ ] Quick action bar displays 4 buttons: Quick View, Message, Share, Compare
- [ ] Quick View button opens modal with listing details
- [ ] Share button copies link to clipboard or opens share sheet
- [ ] Compare button adds/removes listing from comparison set
- [ ] Comparison bar appears at bottom showing "X listings selected" when items added
- [ ] Feature badges display conditionally (New, Hot, Price Drop, etc.)

### Phase 3 Completion Criteria
- [ ] Mobile layout (≤768px) stacks image above content vertically
- [ ] Mobile layout shows condensed amenities (top 4) and maintains readability
- [ ] Touch targets on mobile are minimum 44x44px
- [ ] Image carousel supports swipe gestures on mobile
- [ ] Enhanced carousel shows navigation dots and thumbnail strip (desktop)
- [ ] Host information redesigned to single line, freeing vertical space
- [ ] Comparison modal opens showing side-by-side property details
- [ ] All features work on Chrome, Firefox, Safari, Edge (latest versions)

### Performance Criteria
- [ ] Page load time does not increase by more than 10%
- [ ] Lazy loading continues to work correctly (6 cards per batch)
- [ ] No layout shifts (CLS) when cards render
- [ ] Smooth scrolling with no jank (60fps)
- [ ] Time to interactive (TTI) remains under 3 seconds

### Quality Criteria
- [ ] All new code has JSDoc comments
- [ ] CSS follows existing naming conventions
- [ ] No console errors or warnings
- [ ] Passes accessibility audit (WCAG AA)
- [ ] All Playwright tests pass (20+ test cases)
- [ ] Cross-browser testing complete with no major bugs

### User Experience Criteria
- [ ] Users can identify bedroom/bathroom count in <1 second
- [ ] Users can see key amenities without clicking (scannability test)
- [ ] Pricing is clear and not confusing (user testing feedback)
- [ ] Mobile users can interact with all features easily
- [ ] Comparison feature is discoverable and intuitive

## Validation Commands
Execute these commands to validate the feature is complete:

### Build Validation
```bash
# Navigate to project directory
cd "C:\Users\igor\My Drive (splitleaseteam@gmail.com)\!Agent Context and Tools\SL1\TAC - Search\trees\402e5067\app\search-page-2"

# Install dependencies if not already installed
npm install

# Build React components
npm run build:components

# Verify build output exists
ls -la dist/schedule-selector.js
```

### Code Quality Validation
```bash
# Check for syntax errors in new JavaScript files
node -c js/amenity-utils.js
node -c js/pricing-display.js
node -c js/quick-actions.js
node -c js/schedule-display.js
node -c js/comparison-manager.js

# Verify CSS is valid (using stylelint if available)
# npx stylelint "css/**/*.css"
```

### Functional Validation with Playwright MCP
Use the mcp-tool-specialist agent with Playwright MCP to:
```javascript
// 1. Launch browser and navigate to app
await mcp__playwright__browser_navigate({url: "http://localhost:8000"});

// 2. Take screenshot of listing cards
await mcp__playwright__browser_take_screenshot({
  filename: "listing-cards-after-enhancement.png",
  fullPage: true
});

// 3. Capture accessibility snapshot
const snapshot = await mcp__playwright__browser_snapshot();
// Verify bedroom/bathroom text present: "2BR • 1BA"

// 4. Test amenity icon interaction
await mcp__playwright__browser_hover({
  element: "First amenity icon",
  ref: "[data-amenity-icon]:first-of-type"
});
// Verify tooltip appears

// 5. Test pricing update
await mcp__playwright__browser_click({
  element: "Schedule selector day 2",
  ref: ".schedule-day:nth-child(2)"
});
await mcp__playwright__browser_click({
  element: "Schedule selector day 3",
  ref: ".schedule-day:nth-child(3)"
});
// Verify pricing updates to 2-night rate

// 6. Test quick action button
await mcp__playwright__browser_click({
  element: "Quick View button on first listing",
  ref: ".listing-card:first-of-type .quick-action-btn:first-of-type"
});
// Verify modal opens

// 7. Test responsive breakpoint
await mcp__playwright__browser_resize({width: 375, height: 667});
await mcp__playwright__browser_take_screenshot({
  filename: "listing-cards-mobile.png"
});
// Verify vertical layout

// 8. Check console for errors
const consoleMessages = await mcp__playwright__browser_console_messages({onlyErrors: true});
// Should be empty or only expected warnings
```

### Database Validation with Supabase MCP
Use the mcp-tool-specialist agent with Supabase MCP to:
```javascript
// 1. List all tables
await mcp__supabase__list_tables({schemas: ["public"]});

// 2. Query sample listings to verify field structure
await mcp__supabase__execute_sql({
  query: `
    SELECT
      "Name",
      "No of Bedrooms",
      "No of Bathrooms",
      "Features",
      "Days Available (List of Days)",
      "💰Nightly Host Rate for 2 nights",
      "💰Nightly Host Rate for 3 nights"
    FROM listing
    WHERE "Active" = true
    LIMIT 5
  `
});
// Verify fields exist and have expected data types

// 3. Check for data completeness
await mcp__supabase__execute_sql({
  query: `
    SELECT
      COUNT(*) as total,
      COUNT("No of Bedrooms") as has_bedrooms,
      COUNT("No of Bathrooms") as has_bathrooms,
      COUNT("Features") as has_features
    FROM listing
    WHERE "Active" = true
  `
});
// Verify sufficient data coverage

// 4. Test amenity parsing logic
await mcp__supabase__execute_sql({
  query: `
    SELECT "Features"
    FROM listing
    WHERE "Features" IS NOT NULL
    LIMIT 10
  `
});
// Verify Features field format is parseable
```

### Manual Validation Checklist
After running automated tests, perform these manual checks:
- [ ] Open app in Chrome DevTools mobile emulator, test all breakpoints
- [ ] Verify pricing changes when selecting different day counts (2, 3, 4, 5, 7 nights)
- [ ] Hover over each amenity icon type, verify correct tooltips
- [ ] Click "+X more" amenities counter, verify modal shows all amenities
- [ ] Test "Quick View" on multiple listings, verify correct data loads
- [ ] Test "Compare" feature with 2-3 listings, verify comparison modal
- [ ] Check cards with missing data (no bedrooms, no amenities), verify graceful handling
- [ ] Test on real iPhone/iPad device (if available), verify touch interactions
- [ ] Test on real Android device (if available), verify layout and performance
- [ ] Ask 2-3 users to test, gather qualitative feedback on clarity and usability

## Notes

### Implementation Strategy
- **Progressive Enhancement**: All new features should degrade gracefully if data is missing
- **Performance First**: Use lazy loading, debouncing, and request animation frame to maintain 60fps
- **Mobile First**: Design and test mobile layout before desktop enhancements
- **Accessibility**: Ensure keyboard navigation, screen reader compatibility, and WCAG AA compliance
- **Feature Flags**: Wrap new features in flags for gradual rollout and easy rollback

### Data Availability Considerations
Based on the analysis plan, some fields may not be consistently populated:
- **Bedrooms/Bathrooms**: Likely 80-90% populated, show "Studio" or hide if missing
- **Amenities**: May be in various formats (string, JSON, comma-separated), need robust parsing
- **Schedule Data**: JSON format may vary, handle parse errors gracefully
- **Pricing**: All 6 rates (2-7 nights) may not exist for every listing, interpolate or show range

### Dependencies and APIs
- **Supabase**: PostgreSQL database with PostgREST API
- **Google Maps**: Already integrated, no changes needed for this feature
- **Bubble.io**: Used for messaging, may need endpoint for comparison feature data
- **React**: Schedule Selector component, build using Vite
- **Playwright**: Testing framework, use MCP for browser automation

### Future Enhancements (Out of Scope for v1)
- Ratings & reviews display (requires new backend feature)
- Virtual tour integration (requires 360° photo upload)
- Personalized recommendations using ML (requires recommendation engine)
- Neighborhood info integration (Walk Score, Transit Score, etc.)
- Advanced search with AI (natural language queries)
- Saved searches and alerts

### Known Limitations
- Image optimization not included (AVIF/WebP support)
- Offline mode improvements not included
- Advanced animation effects not included (keep it performant)
- Server-side rendering not included (client-side only)

### Risk Mitigation
- **Breaking Changes**: Use feature flags to enable/disable enhancements
- **Performance Degradation**: Monitor Core Web Vitals, roll back if CLS or LCP worsens
- **Data Inconsistencies**: Implement robust error handling and fallbacks for missing fields
- **Browser Compatibility**: Test on 5+ browser/OS combinations before launch
- **Mobile Performance**: Test on lower-end Android devices (not just flagship)

### MCP Tool Usage Guidelines
When implementing this feature:
1. **Use mcp-tool-specialist agent generously** for browser testing and database validation
2. **Use Playwright MCP** for all interactive testing (clicks, hovers, form fills)
3. **Use Supabase MCP** to verify schema, test queries, and validate data structure
4. **Take screenshots** at each phase to document progress and catch regressions
5. **Capture console logs** to identify errors early
6. **Test responsive breakpoints** using browser resize functionality

### Success Metrics
Track these metrics to validate impact:
- **Click-Through Rate (CTR)**: Target +20% increase
- **Time to Decision**: Target -30% decrease (users decide faster)
- **Message Host Rate**: Target +25% increase
- **Bounce Rate**: Target -20% decrease
- **User Satisfaction**: Survey feedback target >80% positive
- **Mobile Conversion**: Target +35% increase

---

**Document Version**: 1.0
**Created**: 2025-01-06
**Status**: Ready for Implementation
**Next Steps**: Begin Phase 1 implementation using mcp-tool-specialist agent
