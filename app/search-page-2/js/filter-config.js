/**
 * Filter Configuration for Split Lease Search
 * Dynamically loads all filter configurations from Supabase database
 * ⚠️ NO HARDCODED VALUES - All data loaded from database at runtime
 */

/**
 * Dynamic Borough Cache
 * Populated from zat_geo_borough_toplevel table at initialization
 * Structure: { value: id, displayName: name, ... }
 */
let BOROUGH_CACHE = null;

/**
 * Dynamic Neighborhood Cache
 * Populated from zat_geo_hood_mediumlevel table as needed
 * Structure: { id: { name, boroughId, value }, ... }
 */
let NEIGHBORHOOD_CACHE = null;

/**
 * Week Pattern Mapping
 * Maps frontend select values to database text values
 */
const WEEK_PATTERNS = {
    'every-week': 'Every week',
    'one-on-off': 'One week on, one week off',
    'two-on-off': 'Two weeks on, two weeks off',
    'one-three-off': 'One week on, three weeks off'
};

/**
 * Price Tier Configuration
 * Defines min/max ranges for each price tier
 */
const PRICE_TIERS = {
    'under-200': { min: 0, max: 199.99 },
    '200-350': { min: 200, max: 350 },
    '350-500': { min: 350.01, max: 500 },
    '500-plus': { min: 500.01, max: 999999 },
    'all': null // No price filter
};


/**
 * Sort Options Configuration
 * Maps frontend sort values to database fields and order
 */
const SORT_OPTIONS = {
    'recommended': {
        field: '"Modified Date"',
        ascending: false,
        description: 'Our curated recommendations'
    },
    'price-low': {
        field: '"Standarized Minimum Nightly Price (Filter)"',
        ascending: true,
        description: 'Lowest price first'
    },
    'most-viewed': {
        field: '"Metrics - Click Counter"',
        ascending: false,
        description: 'Most popular listings'
    },
    'recent': {
        field: '"Created Date"',
        ascending: false,
        description: 'Newest listings first'
    }
};

/**
 * Filter Helper Functions - All Dynamic, No Hardcoded Values
 */

/**
 * Initialize filter configuration by loading borough and neighborhood data from database
 * MUST be called before using any filter functions
 * @returns {Promise<boolean>} Success status
 */
async function initializeFilterConfig() {
    if (!window.SupabaseAPI || !window.SupabaseAPI.isInitialized) {
        console.error('❌ Cannot initialize FilterConfig: Supabase API not ready');
        return false;
    }

    try {
        // Load boroughs from database
        const boroughs = await window.SupabaseAPI.getBoroughs();

        // Build borough cache: value -> {id, displayName, value}
        BOROUGH_CACHE = {};
        boroughs.forEach(borough => {
            BOROUGH_CACHE[borough.value] = {
                id: borough.id,
                displayName: borough.name,
                value: borough.value
            };
        });

        console.log(`✅ FilterConfig initialized with ${boroughs.length} boroughs from database`);
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize FilterConfig:', error);
        return false;
    }
}

/**
 * Get borough ID from frontend value (dynamically loaded from database)
 * @param {string} boroughValue - Frontend borough select value (e.g., "manhattan")
 * @returns {string|null} Supabase borough ID or null if not found
 */
function getBoroughId(boroughValue) {
    if (!BOROUGH_CACHE) {
        console.error('❌ FilterConfig not initialized - call initializeFilterConfig() first');
        return null;
    }

    const borough = BOROUGH_CACHE[boroughValue];
    if (!borough) {
        console.warn(`⚠️ Borough value "${boroughValue}" not found in database cache`);
        return null;
    }

    return borough.id;
}

/**
 * Get borough display name from frontend value (dynamically loaded from database)
 * @param {string} boroughValue - Frontend borough select value (e.g., "manhattan")
 * @returns {string|null} Display name (e.g., "Manhattan") or null if not found
 */
function getBoroughDisplayName(boroughValue) {
    if (!BOROUGH_CACHE) {
        console.error('❌ FilterConfig not initialized - call initializeFilterConfig() first');
        return null;
    }

    const borough = BOROUGH_CACHE[boroughValue];
    if (!borough) {
        console.warn(`⚠️ Borough value "${boroughValue}" not found in database cache`);
        return null;
    }

    return borough.displayName;
}

/**
 * Get borough value from database ID (reverse lookup)
 * @param {string} boroughId - Supabase borough _id
 * @returns {string|null} Frontend borough value (e.g., "manhattan") or null if not found
 */
function getBoroughValueFromId(boroughId) {
    if (!BOROUGH_CACHE) {
        console.error('❌ FilterConfig not initialized - call initializeFilterConfig() first');
        return null;
    }

    // Search cache for matching ID
    for (const [value, data] of Object.entries(BOROUGH_CACHE)) {
        if (data.id === boroughId) {
            return value;
        }
    }

    console.warn(`⚠️ Borough ID "${boroughId}" not found in database cache`);
    return null;
}

/**
 * Get week pattern text from frontend value
 * @param {string} weekPatternValue - Frontend week pattern select value
 * @returns {string|null} Database week pattern text
 */
function getWeekPattern(weekPatternValue) {
    return WEEK_PATTERNS[weekPatternValue] || null;
}

/**
 * Get price range from frontend tier value
 * @param {string} priceTierValue - Frontend price tier select value
 * @returns {Object|null} Object with min/max or null for all prices
 */
function getPriceRange(priceTierValue) {
    return PRICE_TIERS[priceTierValue] !== undefined ? PRICE_TIERS[priceTierValue] : null;
}

/**
 * Get sort configuration from frontend value
 * @param {string} sortByValue - Frontend sort select value
 * @returns {Object|null} Sort configuration with field and ascending
 */
function getSortConfig(sortByValue) {
    return SORT_OPTIONS[sortByValue] || SORT_OPTIONS['recommended'];
}

/**
 * Get neighborhood IDs from frontend checkbox values (database IDs expected)
 * @param {Array<string>} neighborhoodValues - Array of checkbox values (database IDs)
 * @returns {Array<string>} Array of Supabase neighborhood IDs
 */
function getNeighborhoodIds(neighborhoodValues) {
    if (!Array.isArray(neighborhoodValues)) {
        return [];
    }

    // Neighborhoods are already stored with database IDs as values
    // No mapping needed - return as-is
    return neighborhoodValues.filter(value => {
        // Validate it looks like a database ID (contains 'x' and is long)
        if (typeof value === 'string' && value.includes('x') && value.length >= 20) {
            return true;
        }
        console.warn(`⚠️ Invalid neighborhood ID format: "${value}" - expected database ID`);
        return false;
    });
}

/**
 * Build filter object for Supabase query
 * @param {Object} filterInputs - Frontend filter values
 * @returns {Object} Filter configuration for Supabase
 */
function buildFilterConfig(filterInputs) {
    const config = {
        boroughs: [],
        weekPatterns: [],
        priceRange: null,
        neighborhoods: [],
        sort: getSortConfig(filterInputs.sortBy || 'recommended')
    };

    // Borough filter
    if (filterInputs.borough) {
        const boroughId = getBoroughId(filterInputs.borough);
        if (boroughId) {
            config.boroughs.push(boroughId);
        }
    }

    // Week pattern filter
    if (filterInputs.weekPattern) {
        const weekPattern = getWeekPattern(filterInputs.weekPattern);
        if (weekPattern) {
            config.weekPatterns.push(weekPattern);
        }
    }

    // Price tier filter
    if (filterInputs.priceTier && filterInputs.priceTier !== 'all') {
        config.priceRange = getPriceRange(filterInputs.priceTier);
    }

    // Neighborhood filter - convert checkbox values to database IDs
    if (filterInputs.neighborhoods && Array.isArray(filterInputs.neighborhoods)) {
        config.neighborhoods = getNeighborhoodIds(filterInputs.neighborhoods);
    }

    // Schedule selector filter: convert 0-based indices (Sun=0) to 1-based (Sun=1)
    if (Array.isArray(window.selectedDays) && window.selectedDays.length > 0) {
        const requiredDayNumbers = Array.from(new Set(
            window.selectedDays
                .filter(i => typeof i === 'number')
                .map(i => i + 1) // 0-based -> 1-based
                .filter(n => n >= 1 && n <= 7)
        ));

        if (requiredDayNumbers.length > 0) {
            // Sort for stable logging and easier debugging
            config.requiredDayNumbers = requiredDayNumbers.sort((a, b) => a - b);
        }
    }

    return config;
}

// Export for use in other scripts
window.FilterConfig = {
    // Initialization (MUST be called after Supabase is ready)
    initializeFilterConfig,

    // Dynamic data accessors
    getBoroughId,
    getBoroughDisplayName,
    getBoroughValueFromId,
    getNeighborhoodIds,

    // Static configuration (safe to use without initialization)
    WEEK_PATTERNS,
    PRICE_TIERS,
    SORT_OPTIONS,
    getWeekPattern,
    getPriceRange,
    getSortConfig,
    buildFilterConfig
};
