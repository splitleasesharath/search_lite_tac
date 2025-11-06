// Day selector state
let selectedDays = [1, 2, 3, 4, 5]; // Default to Monday-Friday
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Lazy loading state
let allListings = []; // Store all listings
let loadedListingsCount = 0; // Track how many listings are loaded
let isLoading = false; // Prevent multiple simultaneous loads
const INITIAL_LOAD_COUNT = 6; // Load first 6 listings initially
const LOAD_BATCH_SIZE = 6; // Load 6 more listings per scroll
let lazyLoadObserver = null;

// Track currently populated borough to prevent unnecessary neighborhood repopulation
let currentPopulatedBoroughId = null;

// Calculate dynamic price from Supabase database
function calculateDynamicPrice(listing, selectedDaysCount) {
    const nightsCount = Math.max(selectedDaysCount - 1, 1); // n days = (n-1) nights, minimum 1 night

    // Supabase provides pro-rated prices for different night counts
    // Check if we have a specific pro-rated price for this number of nights
    const priceFieldMap = {
        2: 'Price 2 nights selected',
        3: 'Price 3 nights selected',
        4: 'Price 4 nights selected',
        5: 'Price 5 nights selected',
        6: 'Price 6 nights selected',
        7: 'Price 7 nights selected'
    };

    // For pro-rated prices, look up using (selectedDaysCount - 1)
    // Database prices are already normalized per-night rates, so return directly
    if (nightsCount >= 2 && nightsCount <= 7) {
        const fieldName = priceFieldMap[nightsCount];
        if (fieldName && listing[fieldName]) {
            // Database stores per-night rate, return directly without division
            return listing[fieldName];
        }
    }

    // Default to base per-night price from Supabase
    return listing['Starting nightly price'] || listing.price?.starting || 0;
}

// Update all displayed prices when day selection changes
function updateAllDisplayedPrices() {
    const nightsCount = Math.max(selectedDays.length - 1, 1);

    // Update all listing cards
    document.querySelectorAll('.listing-card').forEach(card => {
        const listingId = card.dataset.id;
        const listing = window.currentListings ?
            window.currentListings.find(l => l.id === listingId) :
            null;

        if (listing) {
            const dynamicPrice = calculateDynamicPrice(listing, selectedDays.length);
            const fullPriceElement = card.querySelector('.full-price');
            if (fullPriceElement) {
                // Always display as per night since database stores per-night price
                fullPriceElement.textContent = `$${dynamicPrice.toFixed(2)}/night`;
            }
        }
    });
}

// Make functions globally available IMMEDIATELY for backup initialization
// These MUST be exposed before DOMContentLoaded to be available to backup init
window.populateBoroughs = populateBoroughs;
window.populateNeighborhoods = populateNeighborhoods;
window.setupEventListeners = setupEventListeners;
window.updateListingCount = updateListingCount;
window.renderListings = renderListings;
window.resetAllFilters = resetAllFilters;

// Main application JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the application
    init();
});

async function init() {
    // Day selector now handled by React component (see schedule-selector-integration.js)

    // Show loading skeleton
    const skeleton = document.getElementById('loadingSkeleton');
    if (skeleton) skeleton.classList.add('active');

    // Simulate loading delay for better UX
    await new Promise(resolve => setTimeout(resolve, 800));

    // Try to connect to Supabase API first
    if (window.SupabaseAPI) {
        const connected = await window.SupabaseAPI.init();
        if (connected) {
            try {
                // Initialize FilterConfig with database data (REQUIRED before fetching listings)
                if (window.FilterConfig) {
                    await window.FilterConfig.initializeFilterConfig();
                } else {
                    console.error('❌ FilterConfig not loaded - include filter-config.js before app.js');
                }

                // Fetch data from Supabase
                const supabaseData = await window.SupabaseAPI.fetchListings();
                if (supabaseData && supabaseData.length > 0) {
                    console.log(`✅ Loaded ${supabaseData.length} listings from Supabase`);
                    window.currentListings = supabaseData;
                    renderListings(supabaseData);
                    const stats = window.SupabaseAPI.getStats();
                    console.log(`📊 Supabase stats:`, stats);

                    // Update map markers to match displayed cards only (after lazy loading initializes)
                    if (window.mapInstance && window.updateMapMarkers) {
                        setTimeout(() => updateMapToMatchDisplayedCards(), 1000);
                    }

                    // Populate boroughs and neighborhoods from Supabase
                    await populateBoroughs();
                    // Get the currently selected borough and populate its neighborhoods
                    const boroughSelect = document.getElementById('boroughSelect');
                    const selectedBorough = boroughSelect?.value;
                    const boroughId = window.FilterConfig ? window.FilterConfig.getBoroughId(selectedBorough) : null;
                    await populateNeighborhoods(boroughId);
                    currentPopulatedBoroughId = boroughId; // Track initial population

                    // Hide loading skeleton
                    if (skeleton) skeleton.classList.remove('active');
                    setupEventListeners();
                    updateListingCount(supabaseData.length);
                    return;
                }
            } catch (error) {
                console.warn('⚠️ Supabase failed, trying fallback:', error.message);
            }
        }
    }

    // No Supabase connection or failed to load listings
    console.error('❌ Failed to load listings from Supabase');
    if (skeleton) skeleton.classList.remove('active');
    const container = document.getElementById('listingsContainer');
    if (container) {
        container.innerHTML = '<div class="error-message">Failed to load listings. Please refresh the page.</div>';
    }
}

// Initialize lazy loading system
function initializeLazyLoading(listings) {
    allListings = listings;
    loadedListingsCount = 0;
    isLoading = false;

    const container = document.getElementById('listingsContainer');
    container.innerHTML = '';

    // Load initial batch
    loadMoreListings();

    // Setup intersection observer for lazy loading
    setupLazyLoadObserver();
}

// Load more listings (batch loading)
async function loadMoreListings() {
    if (isLoading || loadedListingsCount >= allListings.length) {
        return;
    }

    isLoading = true;
    const container = document.getElementById('listingsContainer');
    const batchSize = loadedListingsCount === 0 ? INITIAL_LOAD_COUNT : LOAD_BATCH_SIZE;
    const endIndex = Math.min(loadedListingsCount + batchSize, allListings.length);

    console.log(`📦 Loading listings ${loadedListingsCount + 1}-${endIndex} of ${allListings.length}`);

    for (let i = loadedListingsCount; i < endIndex; i++) {
        const listing = allListings[i];

        // Add listing card (now async for image loading)
        const card = await createListingCard(listing);
        if (card) {
            container.appendChild(card);
        }

        // Add AI research card after certain positions
        if ((i + 1) === 4 || (i + 1) === 8) {
            const aiCard = createAIResearchCard();
            container.appendChild(aiCard);

            // Initialize atom Lottie animation for AI Research card
            setTimeout(() => {
                const aiIconContainer = aiCard.querySelector('.aiResearchAtomIcon');
                if (aiIconContainer && typeof lottie !== 'undefined') {
                    lottie.loadAnimation({
                        container: aiIconContainer,
                        renderer: 'svg',
                        loop: true,
                        autoplay: true,
                        path: 'https://50bf0464e4735aabad1cc8848a0e8b8a.cdn.bubble.io/f1746105302928x174581704119754800/atom%20white.json',
                        speed: 0.25
                    });
                    console.log('✅ AI Research atom animation loaded');
                }
            }, 100);
        }
    }

    loadedListingsCount = endIndex;

    // Add load more sentinel if there are more listings
    if (loadedListingsCount < allListings.length) {
        addLoadMoreSentinel();
        // Start observing the new sentinel
        const newSentinel = document.getElementById('lazy-load-sentinel');
        if (newSentinel && lazyLoadObserver) {
            lazyLoadObserver.observe(newSentinel);
        }
    }

    // Update displayed prices for new listings
    updateAllDisplayedPrices();

    // Register price info triggers for newly loaded listings
    if (window.registerPriceInfoTriggers) {
        window.registerPriceInfoTriggers();
    }

    // Update map to show only the currently displayed listings
    updateMapToMatchDisplayedCards();

    isLoading = false;
}

// Add sentinel element for intersection observer
function addLoadMoreSentinel() {
    const container = document.getElementById('listingsContainer');
    const existingSentinel = document.getElementById('lazy-load-sentinel');

    // Remove existing sentinel if present
    if (existingSentinel) {
        existingSentinel.remove();
    }

    // Create new sentinel
    const sentinel = document.createElement('div');
    sentinel.id = 'lazy-load-sentinel';
    sentinel.className = 'lazy-load-sentinel';
    sentinel.innerHTML = `
        <div class="loading-more">
            <div class="spinner"></div>
            <span>Loading more listings...</span>
        </div>
    `;
    container.appendChild(sentinel);
}

// Setup intersection observer for lazy loading
function setupLazyLoadObserver() {
    // Clean up existing observer
    if (lazyLoadObserver) {
        lazyLoadObserver.disconnect();
    }

    // Create new observer
    lazyLoadObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting && entry.target.id === 'lazy-load-sentinel') {
                    console.log('📍 Sentinel visible, loading more listings...');
                    loadMoreListings();
                }
            });
        },
        {
            root: null, // Use viewport as root
            rootMargin: '100px', // Load 100px before sentinel becomes visible
            threshold: 0.1
        }
    );

    // Start observing the sentinel if it exists
    const sentinel = document.getElementById('lazy-load-sentinel');
    if (sentinel) {
        lazyLoadObserver.observe(sentinel);
    }
}

// Legacy function for compatibility - now uses lazy loading
function renderListings(listings) {
    initializeLazyLoading(listings);
}

// Get currently displayed listings from the DOM
function getDisplayedListings() {
    const displayedCards = document.querySelectorAll('.listing-card');
    const displayedIds = Array.from(displayedCards).map(card => card.dataset.id);

    // Filter allListings to only include displayed ones, maintaining order
    const displayedListings = displayedIds
        .map(id => allListings.find(listing => listing.id === id))
        .filter(listing => listing !== undefined);

    console.log(`📊 Currently displaying ${displayedListings.length} listing cards out of ${allListings.length} total`);
    return displayedListings;
}

// Update map markers to match only the currently displayed listing cards
function updateMapToMatchDisplayedCards() {
    if (!window.mapInstance || !window.updateMapMarkers) {
        return;
    }

    const displayedListings = getDisplayedListings();
    console.log(`🗺️ Updating map to show only ${displayedListings.length} displayed listings`);
    window.updateMapMarkers(displayedListings);
}

// Render amenity icons with tooltips
function renderAmenityIcons(amenities, maxVisible = 6) {
    if (!amenities || amenities.length === 0) {
        return '';
    }

    const visibleAmenities = amenities.slice(0, maxVisible);
    const hiddenCount = Math.max(0, amenities.length - maxVisible);

    let html = '<div class="listing-amenities">';

    // Render visible amenities
    visibleAmenities.forEach(amenity => {
        html += `
            <span class="amenity-icon" data-tooltip="${amenity.name}">
                ${amenity.icon}
            </span>
        `;
    });

    // Add "more" counter if needed
    if (hiddenCount > 0) {
        html += `
            <span class="amenity-more-count" title="Show all amenities">
                +${hiddenCount} more
            </span>
        `;
    }

    html += '</div>';
    return html;
}

// Create a listing card element
async function createListingCard(listing) {
    const card = document.createElement('div');
    card.className = 'listing-card';
    card.dataset.id = listing.id;

    // Load images on-demand for this specific listing
    if (!listing.images) {
        if (window.localDB) {
            listing.images = await window.localDB.loadListingImagesOnDemand(listing);
        } else {
            listing.images = [];
        }
    }

    // Check if listing has images
    const hasImages = listing.images && listing.images.length > 0;
    const hasMultipleImages = listing.images && listing.images.length > 1;
    const imageNavStyle = hasMultipleImages ? '' : 'style="display: none;"';

    // Build the card HTML
    if (!hasImages) {
        console.error('Listing has no images', { id: listing.id, title: listing.title });
    }
    const imageSection = hasImages ? `
        <div class="listing-images" data-current="0" data-total="${listing.images.length}">
            <img src="${listing.images[0]}" alt="${listing.title}">
            <button class="image-nav prev-btn" onclick="changeImage('${listing.id}', -1)" ${imageNavStyle}>‹</button>
            <button class="image-nav next-btn" onclick="changeImage('${listing.id}', 1)" ${imageNavStyle}>›</button>
            ${hasMultipleImages ? `<div class="image-counter"><span class="current-image">1</span> / <span class="total-images">${listing.images.length}</span></div>` : ''}
            <button class="favorite-btn" onclick="toggleFavorite('${listing.id}')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
            </button>
            ${listing.isNew ? '<span class="new-badge">New Listing</span>' : ''}
        </div>
    ` : '';

    card.innerHTML = `
        ${imageSection}
        <div class="listing-content">
            <div class="listing-info">
                <div class="listing-location">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span class="location-text">${listing.location}</span>
                </div>
                <h3 class="listing-title">${listing.title}</h3>
                <p class="listing-type">${listing.type}${listing.squareFeet ? ` (${listing.squareFeet} SQFT)` : ''} - ${listing.maxGuests} guests max</p>
                ${renderAmenityIcons(listing.amenities)}
                <p class="listing-details">${listing.description}</p>
            </div>
            <div class="listing-footer">
                <div class="host-info">
                    <img src="${listing.host.image}" alt="${listing.host.name}" class="host-avatar">
                    <div class="host-details">
                        <span class="host-name">
                            ${listing.host.name}
                            ${listing.host.verified ? '<span class="verified-badge" title="Verified">✓</span>' : ''}
                        </span>
                        <button class="message-btn" onclick="openContactHostModal('${listing.id}')">Message</button>
                    </div>
                </div>
                <div class="pricing-info">
                    <div id="price-info-trigger-${listing.id}"
                         class="starting-price info-trigger"
                         role="button"
                         tabindex="0"
                         aria-label="Price information - click for details"
                         style="cursor: pointer; display: flex; align-items: center; gap: 4px;">
                        <span>Starting at $${parseFloat(listing.price.starting || listing['Starting nightly price'] || 0).toFixed(2)}/night</span>
                        <svg viewBox="0 0 24 24" width="14" height="14" style="color: #3b82f6; fill: currentColor; flex-shrink: 0;">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                        </svg>
                    </div>
                    <div class="full-price">$${calculateDynamicPrice(listing, selectedDays.length).toFixed(2)}/night</div>
                    <div class="availability-text">Message Split Lease for Availability</div>
                </div>
            </div>
        </div>
    `;

    return card;
}

// Create AI Research Card
function createAIResearchCard() {
    const card = document.createElement('div');
    card.className = 'ai-research-card';

    const aiResearchPrompt = {
        icon: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>',
        title: 'Free, AI Deep Research',
        subtitle: 'Save time & money with Insights from 100+ sources',
        buttonText: 'Your unique logistics'
    };

    card.innerHTML = `
        <div class="ai-icon">
            ${aiResearchPrompt.icon}
        </div>
        <h3 class="ai-title">${aiResearchPrompt.title}</h3>
        <p class="ai-subtitle">${aiResearchPrompt.subtitle}</p>
        <button class="ai-btn" onclick="openAiSignupModal()">${aiResearchPrompt.buttonText}</button>
    `;

    return card;
}

// Change image in carousel
function changeImage(listingId, direction) {
    // Try to find in current listings first
    let listing = window.currentListings ? window.currentListings.find(l => l.id === listingId) : null;

    if (!listing) {
        console.error('Listing not found for carousel:', listingId);
        return;
    }

    if (!listing.images || listing.images.length <= 1) {
        console.warn('Listing has no multiple images:', listingId);
        return;
    }

    const card = document.querySelector(`[data-id="${listingId}"]`);
    if (!card) {
        console.warn('Card not found for listing:', listingId);
        return;
    }

    const imageContainer = card.querySelector('.listing-images');
    const img = imageContainer.querySelector('img');
    const currentImageSpan = imageContainer.querySelector('.current-image');

    let currentIndex = parseInt(imageContainer.dataset.current) || 0;
    currentIndex = (currentIndex + direction + listing.images.length) % listing.images.length;

    // Update image source
    img.src = listing.images[currentIndex];
    imageContainer.dataset.current = currentIndex;

    // Update image counter if it exists
    if (currentImageSpan) {
        currentImageSpan.textContent = currentIndex + 1;
    }

    console.log(`📸 Changed to image ${currentIndex + 1}/${listing.images.length} for listing ${listingId}`);
}

// Toggle favorite
function toggleFavorite(listingId) {
    const card = document.querySelector(`[data-id="${listingId}"]`);
    const favoriteBtn = card.querySelector('.favorite-btn');
    const svg = favoriteBtn.querySelector('svg');

    if (svg.getAttribute('fill') === 'red') {
        svg.setAttribute('fill', 'none');
    } else {
        svg.setAttribute('fill', 'red');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function() {
            const navItems = document.querySelector('.nav-items');
            navItems.classList.toggle('active');
        });
    }

    // Filter toggle button
    const filterToggleBtn = document.getElementById('filterToggleBtn');
    if (filterToggleBtn) {
        filterToggleBtn.addEventListener('click', function() {
            const filterPanel = document.getElementById('filterPanel');
            filterPanel.classList.toggle('active');
        });
    }

    // Map toggle button
    const mapToggleBtn = document.getElementById('mapToggleBtn');
    if (mapToggleBtn) {
        mapToggleBtn.addEventListener('click', function() {
            const mapSection = document.getElementById('mapSection');
            mapSection.classList.toggle('active');
        });
    }

    // Close filter panel on mobile
    const filterPanel = document.getElementById('filterPanel');
    if (filterPanel) {
        filterPanel.addEventListener('click', function(e) {
            if (e.target === filterPanel) {
                filterPanel.classList.remove('active');
            }
        });
    }

    // Close map on mobile
    const mapSection = document.getElementById('mapSection');
    if (mapSection) {
        mapSection.addEventListener('click', function(e) {
            if (e.target === mapSection) {
                mapSection.classList.remove('active');
            }
        });
    }

    // Filter changes
    setupFilterListeners();

    // Neighborhood search
    const neighborhoodSearch = document.getElementById('neighborhoodSearch');
    if (neighborhoodSearch) {
        neighborhoodSearch.addEventListener('input', function(e) {
            filterNeighborhoods(e.target.value);
        });
    }
}

// Setup filter listeners
function setupFilterListeners() {
    const filters = ['boroughSelect', 'weekPattern', 'priceTier', 'sortBy'];

    filters.forEach(filterId => {
        const element = document.getElementById(filterId);
        if (element) {
            element.addEventListener('change', applyFilters);
        }
    });

    // Borough select - update location text and refresh neighborhoods
    const boroughSelect = document.getElementById('boroughSelect');
    if (boroughSelect) {
        boroughSelect.addEventListener('change', async function() {
            updateLocationText();

            // Clear any selected neighborhoods when borough changes
            clearNeighborhoodSelections();

            // Refresh neighborhoods based on selected borough
            const selectedBorough = boroughSelect.value;
            const boroughId = window.FilterConfig ? window.FilterConfig.getBoroughId(selectedBorough) : null;
            await populateNeighborhoods(boroughId);
            currentPopulatedBoroughId = boroughId; // Track the change

            // Re-apply filters with the new borough and cleared neighborhoods
            applyFilters();
        });
        // Initialize on load
        updateLocationText();
    }

    // Neighborhood checkboxes (event listeners are attached dynamically in populateNeighborhoods)
    // This is kept for any pre-existing checkboxes on initial load
    const neighborhoodCheckboxes = document.querySelectorAll('.neighborhood-list input[type="checkbox"]');
    neighborhoodCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            updateNeighborhoodChips();
            applyFilters();
        });
    });
}

// Update location text based on borough selection (dynamically loaded from database)
function updateLocationText() {
    const boroughSelect = document.getElementById('boroughSelect');
    const locationText = document.getElementById('location-text');

    if (!boroughSelect || !locationText) return;

    const selectedBorough = boroughSelect.value;
    const displayName = window.FilterConfig ? window.FilterConfig.getBoroughDisplayName(selectedBorough) : null;

    if (displayName) {
        locationText.textContent = displayName;
    } else {
        console.warn(`⚠️ No display name found for borough: ${selectedBorough}`);
        locationText.textContent = selectedBorough; // Fallback to raw value
    }
}

// Apply filters to listings - ENABLED with fallback logic
async function applyFilters() {
    console.log('🔍 Applying filters to listings...');

    if (!window.SupabaseAPI || !window.SupabaseAPI.isInitialized) {
        console.warn('⚠️ Supabase API not initialized');
        return;
    }

    if (!window.FilterConfig) {
        console.error('❌ FilterConfig not loaded - include filter-config.js');
        return;
    }

    try {
        // Collect filter values from UI
        const checkedNeighborhoods = Array.from(
            document.querySelectorAll('.neighborhood-list input[type="checkbox"]:checked')
        ).map(checkbox => checkbox.value);

        const filterInputs = {
            borough: document.getElementById('boroughSelect')?.value,
            weekPattern: document.getElementById('weekPattern')?.value,
            priceTier: document.getElementById('priceTier')?.value,
            sortBy: document.getElementById('sortBy')?.value,
            neighborhoods: checkedNeighborhoods
        };

        console.log('📋 Filter inputs:', filterInputs);

        // Build filter configuration using FilterConfig
        const filterConfig = window.FilterConfig.buildFilterConfig(filterInputs);
        console.log('⚙️ Filter config:', filterConfig);

        // Fetch filtered listings from Supabase
        let filteredListings = await window.SupabaseAPI.getListings(filterConfig);

        // Check if any non-sort filters are applied
        const hasActiveFilters = Object.keys(filterConfig).some(key =>
            key !== 'sort' && filterConfig[key] && (Array.isArray(filterConfig[key]) ? filterConfig[key].length > 0 : true)
        );

        // Handle zero results case: Automatically show all listings with fallback message
        let didFallback = false;
        if (filteredListings.length === 0 && hasActiveFilters) {
            console.log('⚠️ No listings match current filters - showing all listings as fallback');

            // Fetch all listings without filters (keeping only the sort preference)
            filteredListings = await window.SupabaseAPI.getListings({
                sort: filterConfig.sort
            });

            didFallback = true;

            // Show informative notice that filters yielded 0 results
            showFilterResetNotice('No listings match your current filters. Showing all available listings instead.');
        } else {
            // Clear notices when we have valid results
            clearFilterResetNotice();
            clearNoResultsNotice();
        }

        // Update the display
        window.currentListings = filteredListings;
        console.log(`✅ Displaying ${filteredListings.length} listings`);

        initializeLazyLoading(filteredListings);

        // Update count - show search results (0) when in fallback mode, otherwise show actual count
        updateListingCount(didFallback ? 0 : filteredListings.length, didFallback ? filteredListings.length : null);

        // Update map markers to match only currently displayed cards (not all filtered results)
        // This ensures map shows only what's visible in the listing cards
        updateMapToMatchDisplayedCards();

        // Re-populate neighborhoods ONLY if borough has changed (preserves checked state)
        const boroughSelect = document.getElementById('boroughSelect');
        const selectedBorough = boroughSelect?.value;
        const boroughId = window.FilterConfig ? window.FilterConfig.getBoroughId(selectedBorough) : null;

        // Only repopulate if the borough has actually changed
        if (boroughId !== currentPopulatedBoroughId) {
            await populateNeighborhoods(boroughId);
            currentPopulatedBoroughId = boroughId;
        }

    } catch (error) {
        console.error('❌ Error applying filters:', error);
        // On error, show all listings
        if (window.currentListings && window.currentListings.length > 0) {
            initializeLazyLoading(window.currentListings);
            updateListingCount(window.currentListings.length);
        }
    }
}

// Toast notification system
function showToast(message, type = 'info', duration = 5000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`; // info, success, warning, error
    toast.textContent = message;

    document.body.appendChild(toast);

    // Fade in
    setTimeout(() => toast.classList.add('show'), 10);

    // Fade out and remove
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
    }, duration);
}

// Display a notice above the listings when filters are reset due to zero results
function showFilterResetNotice(message) {
    const section = document.querySelector('.listings-section');
    const container = document.getElementById('listingsContainer');
    if (!section || !container) return;

    let notice = document.getElementById('filterResetNotice');
    if (!notice) {
        notice = document.createElement('div');
        notice.id = 'filterResetNotice';
        notice.className = 'filter-reset-notice';
        notice.style.cssText = `
            margin: 12px 0 8px 0;
            padding: 12px 14px;
            border-radius: 10px;
            background: #FFF7ED;
            color: #9A3412;
            border: 1px solid #FED7AA;
            font-family: Inter, sans-serif;
            font-size: 14px;
            font-weight: 500;
        `;
        // Insert above the listings container
        section.insertBefore(notice, container);
    }
    notice.textContent = message || 'No results for your selections. Filters were reset to show all listings.';
}

// Remove the filter reset notice if present
function clearFilterResetNotice() {
    const notice = document.getElementById('filterResetNotice');
    if (notice && notice.parentNode) {
        notice.parentNode.removeChild(notice);
    }
}

// Display a "No listings found" notice when filters yield zero results
function showNoResultsNotice() {
    const section = document.querySelector('.listings-section');
    const container = document.getElementById('listingsContainer');
    if (!section || !container) return;

    // Clear any old reset notice
    clearFilterResetNotice();

    let notice = document.getElementById('noResultsNotice');
    if (!notice) {
        notice = document.createElement('div');
        notice.id = 'noResultsNotice';
        notice.className = 'no-results-notice';
        notice.style.cssText = `
            margin: 12px 0 8px 0;
            padding: 16px 18px;
            border-radius: 10px;
            background: #FEF2F2;
            color: #991B1B;
            border: 1px solid #FCA5A5;
            font-family: Inter, sans-serif;
            font-size: 14px;
            font-weight: 500;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        `;
        // Insert above the listings container
        section.insertBefore(notice, container);
    }

    notice.innerHTML = `
        <span>No listings match your current filters. Try adjusting your selection.</span>
        <button onclick="resetAllFilters()" style="
            padding: 6px 12px;
            background: #DC2626;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
            transition: background 0.2s;
        " onmouseover="this.style.background='#B91C1C'" onmouseout="this.style.background='#DC2626'">
            Reset Filters
        </button>
    `;
}

// Remove the no results notice if present
function clearNoResultsNotice() {
    const notice = document.getElementById('noResultsNotice');
    if (notice && notice.parentNode) {
        notice.parentNode.removeChild(notice);
    }
}

// Reset all filters to their default state
async function resetAllFilters() {
    console.log('🔄 Resetting all filters to defaults...');

    // Reset filter UI controls to defaults
    const boroughSelect = document.getElementById('boroughSelect');
    const weekPattern = document.getElementById('weekPattern');
    const priceTier = document.getElementById('priceTier');
    const sortBy = document.getElementById('sortBy');

    // Reset selects to their default values
    if (boroughSelect && boroughSelect.options.length > 0) {
        // Try to select Manhattan by default, or first option
        const manhattanOption = Array.from(boroughSelect.options).find(opt =>
            opt.value === 'manhattan' || opt.textContent === 'Manhattan'
        );
        if (manhattanOption) {
            boroughSelect.value = manhattanOption.value;
        } else {
            boroughSelect.selectedIndex = 0;
        }
    }

    if (weekPattern) weekPattern.value = 'every-week';
    if (priceTier) priceTier.value = 'all';
    if (sortBy) sortBy.value = 'recommended';

    // Uncheck all neighborhood checkboxes
    const neighborhoodCheckboxes = document.querySelectorAll('.neighborhood-list input[type="checkbox"]');
    neighborhoodCheckboxes.forEach(checkbox => {
        checkbox.checked = false;
    });

    // Update location text
    updateLocationText();

    // Re-populate neighborhoods for the newly selected borough
    const selectedBorough = boroughSelect?.value;
    const boroughId = window.FilterConfig ? window.FilterConfig.getBoroughId(selectedBorough) : null;
    await populateNeighborhoods(boroughId);
    currentPopulatedBoroughId = boroughId;

    // Clear the notice
    clearNoResultsNotice();
    clearFilterResetNotice();

    // Apply filters with the reset values (will show all listings with default filters)
    await applyFilters();

    console.log('✅ Filters reset successfully');
}

// Filter neighborhoods in the list
function filterNeighborhoods(searchTerm) {
    const labels = document.querySelectorAll('.neighborhood-list label');

    labels.forEach(label => {
        const text = label.textContent.toLowerCase();
        if (text.includes(searchTerm.toLowerCase())) {
            label.style.display = 'block';
        } else {
            label.style.display = 'none';
        }
    });
}

// Populate boroughs dynamically from Supabase database table
async function populateBoroughs() {
    if (!window.SupabaseAPI) return;

    try {
        // Fetch boroughs from zat_geo_borough_toplevel table
        const boroughs = await window.SupabaseAPI.getBoroughs();
        const boroughSelect = document.getElementById('boroughSelect');

        if (boroughSelect && boroughs && boroughs.length > 0) {
            console.log(`🏙️ Populating ${boroughs.length} boroughs from database table`);

            // Store current selection
            const currentValue = boroughSelect.value;

            // Clear existing options
            boroughSelect.innerHTML = '';

            // Add boroughs from database
            boroughs.forEach(borough => {
                const option = document.createElement('option');
                option.value = borough.value;
                option.textContent = borough.name;
                // Restore selection if it matches
                if (borough.value === currentValue || borough.id === currentValue) {
                    option.selected = true;
                }
                boroughSelect.appendChild(option);
            });

            // If no selection was restored, select the first option (or Manhattan if available)
            if (!boroughSelect.value) {
                const manhattanOption = Array.from(boroughSelect.options).find(opt =>
                    opt.value === 'manhattan' || opt.textContent === 'Manhattan'
                );
                if (manhattanOption) {
                    manhattanOption.selected = true;
                } else if (boroughSelect.options.length > 0) {
                    boroughSelect.options[0].selected = true;
                }
            }

            console.log('✅ Boroughs populated from database');
        } else {
            console.error('❌ No boroughs returned from database');
        }
    } catch (error) {
        console.error('❌ Failed to load boroughs from database:', error.message);
    }
}

// Populate neighborhoods dynamically from Supabase database table
async function populateNeighborhoods(boroughId = null) {
    if (!window.SupabaseAPI) return;

    try {
        // Fetch neighborhoods from zat_geo_hood_mediumlevel table
        const neighborhoods = await window.SupabaseAPI.getNeighborhoods(boroughId);
        const neighborhoodList = document.querySelector('.neighborhood-list');

        if (neighborhoodList && neighborhoods && neighborhoods.length > 0) {
            console.log(`📍 Populating ${neighborhoods.length} neighborhoods from database table`);

            // Clear existing neighborhoods
            neighborhoodList.innerHTML = '';

            // Add neighborhoods from database - use database ID as value for accurate filtering
            neighborhoods.forEach(neighborhood => {
                const label = document.createElement('label');
                // Use database _id as value instead of kebab-case name for accurate matching
                label.innerHTML = `<input type="checkbox" value="${neighborhood.id}"> ${neighborhood.name}`;
                neighborhoodList.appendChild(label);
            });

            // Re-attach event listeners for the new checkboxes
            const neighborhoodCheckboxes = document.querySelectorAll('.neighborhood-list input[type="checkbox"]');
            neighborhoodCheckboxes.forEach(checkbox => {
                checkbox.addEventListener('change', function() {
                    updateNeighborhoodChips();
                    applyFilters();
                });
            });

            console.log('✅ Neighborhoods populated from database and event listeners attached');
        } else {
            console.error('❌ No neighborhoods returned from database');
        }
    } catch (error) {
        console.error('❌ Failed to load neighborhoods from database:', error.message);
    }
}

// Update the visual display of selected neighborhood chips
function updateNeighborhoodChips() {
    const chipsContainer = document.getElementById('selectedNeighborhoodsChips');
    if (!chipsContainer) return;

    // Get all checked neighborhood checkboxes
    const checkedBoxes = document.querySelectorAll('.neighborhood-list input[type="checkbox"]:checked');

    // Clear existing chips
    chipsContainer.innerHTML = '';

    // Create chip for each selected neighborhood
    checkedBoxes.forEach(checkbox => {
        const neighborhoodName = checkbox.parentElement.textContent.trim();
        const neighborhoodId = checkbox.value;

        const chip = document.createElement('div');
        chip.className = 'neighborhood-chip';
        chip.dataset.neighborhoodId = neighborhoodId;

        const chipText = document.createElement('span');
        chipText.textContent = neighborhoodName;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'neighborhood-chip-remove';
        removeBtn.innerHTML = '×';
        removeBtn.setAttribute('aria-label', `Remove ${neighborhoodName}`);

        // Handle chip removal
        removeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            // Uncheck the corresponding checkbox
            checkbox.checked = false;
            // Update the display and apply filters
            updateNeighborhoodChips();
            applyFilters();
        });

        chip.appendChild(chipText);
        chip.appendChild(removeBtn);
        chipsContainer.appendChild(chip);
    });
}

// Clear all neighborhood selections
function clearNeighborhoodSelections() {
    // Uncheck all neighborhood checkboxes
    const neighborhoodCheckboxes = document.querySelectorAll('.neighborhood-list input[type="checkbox"]');
    neighborhoodCheckboxes.forEach(checkbox => {
        checkbox.checked = false;
    });

    // Clear the chips display
    updateNeighborhoodChips();
}

// Update listing count
function updateListingCount(count = 0, fallbackCount = null) {
    const countElement = document.getElementById('listingCount');
    if (countElement) {
        if (fallbackCount !== null) {
            // In fallback mode: show search result count (0) not the fallback count
            countElement.textContent = `${count} listings found`;
        } else {
            countElement.textContent = `${count} listings found`;
        }
    }
}

// Initialize Google Maps
window.actualInitMap = function() {
    console.log('🗺️ initMap called');

    // Check if map element exists
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.error('❌ Map element not found');
        return;
    }
    console.log('✅ Map element found:', mapElement);
    console.log('✅ Map element dimensions:', mapElement.offsetWidth, 'x', mapElement.offsetHeight);

    // Check if Google Maps API is loaded
    if (typeof google === 'undefined') {
        console.error('❌ Google object is undefined');
        showMapPlaceholder(mapElement);
        return;
    }

    if (!google.maps) {
        console.error('❌ google.maps is undefined');
        showMapPlaceholder(mapElement);
        return;
    }

    console.log('✅ Google Maps API loaded successfully');
    console.log('✅ Google Maps version:', google.maps.version);

    // NYC center coordinates (Manhattan)
    const nycCenter = { lat: 40.7580, lng: -73.9855 };

    // Create map with custom styles
    let map;
    try {
        console.log('🗺️ Creating Google Map...');
        map = new google.maps.Map(mapElement, {
        center: nycCenter,
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_CENTER
        },
        styles: [
            {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }]
            },
            {
                featureType: "transit",
                elementType: "labels",
                stylers: [{ visibility: "off" }]
            }
        ]
        });
        console.log('✅ Google Map created successfully');
        window.mapInitialized = true;
    } catch (error) {
        console.error('❌ Failed to create Google Map:', error);
        if (error.message && error.message.includes('ApiNotActivatedMapError')) {
            console.error('❌ Maps JavaScript API is not enabled');
            window.gm_authFailure();
        } else {
            showMapPlaceholder(mapElement);
        }
        return;
    }

    // Store map instance globally
    window.mapInstance = map;
    window.mapMarkers = [];

    // Function to add markers from current listings
    window.updateMapMarkers = function(listings) {
        console.log(`📍 Updating map markers with ${listings ? listings.length : 0} listings`);

        // Clear existing markers
        if (window.mapMarkers && window.mapMarkers.length > 0) {
            console.log(`🗑️ Clearing ${window.mapMarkers.length} existing markers`);
            window.mapMarkers.forEach(marker => {
                if (marker.setMap) marker.setMap(null);
            });
            window.mapMarkers = [];
        }

        if (!listings || listings.length === 0) {
            console.log('⚠️ No listings to display on map');
            return;
        }

        let addedCount = 0;
        let skippedCount = 0;

        // Process each listing
        for (const listing of listings) {
            let coordinates = null;
            const listingName = listing.Name || listing.title || listing.id;

            // Debug: Log the listing data structure
            if (addedCount < 3 || skippedCount < 3) {
                console.log(`\n🔍 Processing listing: ${listingName}`);
                console.log('  - listing.coordinates:', listing.coordinates);
                console.log('  - listing.listing_address_latitude:', listing.listing_address_latitude);
                console.log('  - listing.listing_address_longitude:', listing.listing_address_longitude);
            }

            // Check if listing already has coordinates object
            if (listing.coordinates && listing.coordinates.lat && listing.coordinates.lng) {
                // Validate coordinates are numbers
                const lat = parseFloat(listing.coordinates.lat);
                const lng = parseFloat(listing.coordinates.lng);
                if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                    coordinates = { lat, lng };
                    if (addedCount < 3) {
                        console.log(`  ✅ Using listing.coordinates: ${lat}, ${lng}`);
                    }
                } else {
                    if (skippedCount < 3) {
                        console.warn(`  ⚠️ Invalid coordinates in listing.coordinates: lat=${lat}, lng=${lng}`);
                    }
                }
            }
            // Check for database lat/lng fields
            else if (listing.listing_address_latitude && listing.listing_address_longitude) {
                const lat = parseFloat(listing.listing_address_latitude);
                const lng = parseFloat(listing.listing_address_longitude);
                if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                    coordinates = { lat, lng };
                    if (addedCount < 3) {
                        console.log(`  ✅ Using listing_address fields: ${lat}, ${lng}`);
                    }
                } else {
                    if (skippedCount < 3) {
                        console.warn(`  ⚠️ Invalid coordinates in listing_address fields: lat=${lat}, lng=${lng}`);
                    }
                }
            } else {
                if (skippedCount < 3) {
                    console.warn(`  ❌ No coordinate fields found in listing`);
                }
            }

            // If we have valid coordinates, add the marker
            if (coordinates && coordinates.lat && coordinates.lng) {
                const price = listing['Starting nightly price'] ||
                             listing['💰Nightly Host Rate for 7 nights'] ||
                             listing['💰Nightly Host Rate for 2 nights'] ||
                             listing.price?.starting ||
                             0;

                const title = listing.Name || listing.title || 'Split Lease Property';
                const location = listing['Location - Hood'] ||
                                listing['neighborhood (manual input by user)'] ||
                                listing['Location - Borough'] ||
                                listing.location ||
                                'Manhattan';

                addPriceMarker(map, coordinates, price, title, location, listing);
                addedCount++;
            } else {
                console.warn(`❌ No valid coordinates for listing: ${listingName}`);
                skippedCount++;
            }
        }

        console.log(`✅ Map markers updated: ${addedCount} added, ${skippedCount} skipped (no coordinates)`);
        console.log(`📊 Total markers on map: ${window.mapMarkers.length}`);
    };

    // Function to add a single price marker
    function addPriceMarker(map, coordinates, price, title, location, listing) {
        const markerOverlay = new google.maps.OverlayView();
        markerOverlay.onAdd = function() {
            const priceTag = document.createElement('div');
            priceTag.innerHTML = `$${parseFloat(price).toFixed(2)}`;
            priceTag.style.cssText = `
                position: absolute;
                background: #31135D;
                color: white;
                padding: 6px 12px;
                border-radius: 20px;
                font-weight: 600;
                font-size: 14px;
                font-family: 'Inter', sans-serif;
                white-space: nowrap;
                box-shadow: 0 2px 6px rgba(255, 255, 255, 0.15);
                cursor: pointer;
                transition: background-color 0.2s ease, transform 0.2s ease;
                will-change: transform;
                transform: translate(-50%, -50%);
                z-index: 1;
            `;

            priceTag.addEventListener('mouseenter', () => {
                priceTag.style.background = '#522580';
                priceTag.style.transform = 'translate(-50%, -50%) scale(1.1)';
                priceTag.style.zIndex = '10';
            });

            priceTag.addEventListener('mouseleave', () => {
                priceTag.style.background = '#31135D';
                priceTag.style.transform = 'translate(-50%, -50%) scale(1)';
                priceTag.style.zIndex = '1';
            });

            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="padding: 12px; min-width: 200px;">
                        <h4 style="margin: 0 0 6px 0; color: #1a1a1a; font-size: 16px;">${title}</h4>
                        <p style="margin: 0 0 6px 0; color: #6b7280; font-size: 13px;">${location}</p>
                        <p style="margin: 0; font-weight: 600; color: #31135D; font-size: 14px;">$${parseFloat(price).toFixed(2)}/night</p>
                    </div>
                `
            });

            priceTag.addEventListener('click', () => {
                infoWindow.open(map, markerOverlay);
                infoWindow.setPosition(coordinates);
            });

            this.div = priceTag;
            const panes = this.getPanes();
            panes.overlayLayer.appendChild(priceTag);
        };

        markerOverlay.draw = function() {
            const projection = this.getProjection();
            const position = projection.fromLatLngToDivPixel(new google.maps.LatLng(coordinates.lat, coordinates.lng));

            if (this.div) {
                // Use transform3d for GPU acceleration
                this.div.style.transform = `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%)`;
            }
        };

        markerOverlay.onRemove = function() {
            if (this.div) {
                this.div.parentNode.removeChild(this.div);
                this.div = null;
            }
        };

        markerOverlay.setMap(map);
        window.mapMarkers.push(markerOverlay);
    }

    // Use current listings from Supabase
    const listingsToMap = window.currentListings;

    // Add markers for each listing
    if (listingsToMap && listingsToMap.length > 0) {
        console.log(`🗺️ Preparing to add ${listingsToMap.length} listings to map`);

        // Always use updateMapMarkers for consistency
        window.updateMapMarkers(listingsToMap);
    } else {
        console.log('⚠️ No listings available for map');
    }

    console.log('✅ Map initialized successfully');
    console.log('📐 Map element dimensions:', mapElement.offsetWidth, 'x', mapElement.offsetHeight);

    // Force resize after a short delay to ensure proper rendering
    setTimeout(() => {
        google.maps.event.trigger(map, 'resize');
        map.setCenter(nycCenter);
    }, 500);
}

// Show placeholder when Google Maps API is not available
function showMapPlaceholder(mapElement) {
    mapElement.innerHTML = `
        <div style="
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #6b7280;
            font-family: 'Inter', sans-serif;
            text-align: center;
            padding: 2rem;
        ">
            <div style="
                width: 80px;
                height: 80px;
                background: #31135D;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 1rem;
            ">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
            </div>
            <h3 style="margin: 0 0 0.5rem 0; color: #31135D; font-weight: 600;">Map Preview</h3>
            <p style="margin: 0 0 1rem 0; line-height: 1.5;">
                NYC area with ${window.currentListings ? window.currentListings.length : 0} property listings
            </p>
            <p style="margin: 0; font-size: 0.9rem;">
                Add your Google Maps API key to enable interactive map
            </p>
        </div>
    `;
}

// Google Maps error handler
window.gm_authFailure = function() {
    console.error('❌ Google Maps authentication failed');
    const mapElement = document.getElementById('map');
    if (mapElement) {
        mapElement.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f3f4f6; color: #ef4444; font-family: Inter, sans-serif; text-align: center; padding: 2rem;">
                <div>
                    <h3 style="margin: 0 0 0.5rem 0;">Maps API Not Activated</h3>
                    <p style="margin: 0 0 1rem 0; font-size: 0.9rem;">The Google Maps JavaScript API needs to be enabled for this project.</p>
                    <div style="text-align: left; background: white; border: 1px solid #fecaca; border-radius: 8px; padding: 1rem; max-width: 400px; margin: 0 auto;">
                        <p style="margin: 0 0 0.5rem 0; font-weight: 600; color: #991b1b;">To fix this issue:</p>
                        <ol style="margin: 0; padding-left: 1.5rem; font-size: 0.85rem; color: #7f1d1d; line-height: 1.6;">
                            <li>Go to <a href="https://console.cloud.google.com/apis/library/maps-backend.googleapis.com" target="_blank" style="color: #dc2626;">Google Cloud Console</a></li>
                            <li>Select your project</li>
                            <li>Click "ENABLE" for Maps JavaScript API</li>
                            <li>Wait 1-2 minutes for changes to take effect</li>
                            <li>Refresh this page</li>
                        </ol>
                    </div>
                </div>
            </div>
        `;
    }
};

// Fallback if initMap fails to load
window.addEventListener('load', function() {
    setTimeout(() => {
        console.log('🔍 Checking map initialization status:');
        console.log('  - google object exists:', typeof google !== 'undefined');
        console.log('  - window.mapInitialized:', window.mapInitialized);
        console.log('  - window.mapInstance exists:', !!window.mapInstance);

        if (typeof google === 'undefined' || !window.mapInitialized) {
            console.log('🔄 Google Maps failed to load, showing fallback');
            const mapElement = document.getElementById('map');
            if (mapElement && !mapElement.innerHTML.includes('Map Preview')) {
                showMapPlaceholder(mapElement);
            }
        } else {
            console.log('✅ Google Maps is working correctly, no fallback needed');
        }
    }, 5000); // Increased timeout to allow more time for initialization
});

// Make initMap globally available for Google Maps callback
window.initMap = initMap;

// Cleanup function for intersection observer
function cleanupLazyLoading() {
    if (lazyLoadObserver) {
        lazyLoadObserver.disconnect();
        lazyLoadObserver = null;
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', cleanupLazyLoading);

// Open Contact Host Modal
function openContactHostModal(listingId) {
    console.log('📧 Opening contact host modal for listing:', listingId);

    // Find the listing by ID in allListings first (loaded listings)
    let listing = allListings.find(l => l.id === listingId);

    // Fallback to currentListings if not found
    if (!listing && window.currentListings) {
        listing = window.currentListings.find(l => l.id === listingId);
    }

    if (!listing) {
        console.error('❌ Listing not found:', listingId);
        showToast('Unable to open messaging. Listing not found.', 'error');
        return;
    }

    // Get current user (null if not logged in)
    const currentUser = window.currentUser || null;

    // Open the modal with listing and user data
    if (window.contactHostMessaging) {
        window.contactHostMessaging.open(listing, currentUser);
    } else {
        console.error('❌ Contact Host Messaging component not initialized');
        showToast('Unable to open messaging. Please refresh the page and try again.', 'error');
    }
}

// Make additional functions globally available
window.openContactHostModal = openContactHostModal;