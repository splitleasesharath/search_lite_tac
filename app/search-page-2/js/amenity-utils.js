/**
 * Amenity Utilities for Split Lease
 * Functions for parsing and rendering amenity icons with priority mapping
 */

/**
 * Amenity priority map - lower number = higher priority
 * Icons are loaded from the Bubble CDN based on database validation
 */
const AMENITY_PRIORITY_MAP = {
    // High priority amenities (shown first)
    'wifi': { priority: 1, fallbackIcon: '📶', fallbackName: 'WiFi' },
    'air conditioned': { priority: 2, fallbackIcon: '❄️', fallbackName: 'A/C' },
    'gym': { priority: 3, fallbackIcon: '💪', fallbackName: 'Gym' },
    'elevator': { priority: 4, fallbackIcon: '🏢', fallbackName: 'Elevator' },
    'doorman': { priority: 5, fallbackIcon: '🚪', fallbackName: 'Doorman' },
    'laundry room': { priority: 6, fallbackIcon: '🧺', fallbackName: 'Laundry' },
    'washer': { priority: 7, fallbackIcon: '🧺', fallbackName: 'Washer/Dryer' },
    'dryer': { priority: 7, fallbackIcon: '🧺', fallbackName: 'Washer/Dryer' },
    'bike storage': { priority: 8, fallbackIcon: '🚲', fallbackName: 'Bike Storage' },
    'parking': { priority: 9, fallbackIcon: '🅿️', fallbackName: 'Parking' },
    'common outdoor space': { priority: 10, fallbackIcon: '🌿', fallbackName: 'Outdoor Space' },
    'balcony': { priority: 11, fallbackIcon: '🌿', fallbackName: 'Balcony' },

    // Medium priority amenities
    'closet': { priority: 12, fallbackIcon: '👔', fallbackName: 'Closet' },
    'tv': { priority: 13, fallbackIcon: '📺', fallbackName: 'TV' },
    'computer': { priority: 14, fallbackIcon: '💻', fallbackName: 'Computer' },
    'dedicated workspace': { priority: 15, fallbackIcon: '💻', fallbackName: 'Workspace' },
    'desk': { priority: 15, fallbackIcon: '💻', fallbackName: 'Desk' },
    'towels and linens': { priority: 16, fallbackIcon: '🛏️', fallbackName: 'Linens' },
    'hangers': { priority: 17, fallbackIcon: '👔', fallbackName: 'Hangers' },
    'locked door': { priority: 18, fallbackIcon: '🔒', fallbackName: 'Locked Door' },

    // Lower priority amenities
    'hot water': { priority: 19, fallbackIcon: '💧', fallbackName: 'Hot Water' },
    'heating': { priority: 20, fallbackIcon: '🔥', fallbackName: 'Heating' },
    'kitchen': { priority: 21, fallbackIcon: '🍳', fallbackName: 'Kitchen' },
    'coffee maker': { priority: 22, fallbackIcon: '☕', fallbackName: 'Coffee Maker' },
    'dishwasher': { priority: 23, fallbackIcon: '🍽️', fallbackName: 'Dishwasher' },
    'pet-friendly': { priority: 24, fallbackIcon: '🐕', fallbackName: 'Pet-Friendly' },
    'dog': { priority: 24, fallbackIcon: '🐕', fallbackName: 'Pet-Friendly' },
    'cat': { priority: 24, fallbackIcon: '🐕', fallbackName: 'Pet-Friendly' }
};

/**
 * Parse amenities from in-unit and in-building JSON arrays
 * This function is called during data transformation in supabase-api.js
 *
 * @param {Array|string} inUnitAmenities - JSON array or string of amenity UUIDs from "Features - Amenities In-Unit"
 * @param {Array|string} inBuildingAmenities - JSON array or string of amenity UUIDs from "Features - Amenities In-Building"
 * @returns {Promise<Array>} Array of amenity objects with {id, name, icon, iconUrl, priority, category}
 */
async function parseAmenities(inUnitAmenities, inBuildingAmenities) {
    // Parse JSON if needed
    const parseJson = (value) => {
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch (e) {
                console.warn('Failed to parse amenities JSON:', e);
                return [];
            }
        }
        return [];
    };

    const inUnitIds = parseJson(inUnitAmenities);
    const inBuildingIds = parseJson(inBuildingAmenities);
    const allAmenityIds = [...inUnitIds, ...inBuildingIds];

    if (allAmenityIds.length === 0) {
        return [];
    }

    // Fetch amenity details from zat_features_amenity table
    const amenityDetails = await fetchAmenityDetails(allAmenityIds);

    // Map amenities to unified format with priority
    const amenities = amenityDetails.map(amenity => {
        const nameLower = (amenity.Name || '').toLowerCase();
        const priorityInfo = AMENITY_PRIORITY_MAP[nameLower] || { priority: 999, fallbackIcon: '✓', fallbackName: amenity.Name };

        return {
            id: amenity._id,
            name: amenity.Name,
            icon: priorityInfo.fallbackIcon, // Use fallback emoji icon
            iconUrl: amenity.Icon ? (amenity.Icon.startsWith('//') ? 'https:' + amenity.Icon : amenity.Icon) : null,
            priority: priorityInfo.priority,
            category: inUnitIds.includes(amenity._id) ? 'in-unit' : 'in-building'
        };
    });

    // Sort by priority (lower number = higher priority)
    amenities.sort((a, b) => a.priority - b.priority);

    return amenities;
}

/**
 * Fetch amenity details from zat_features_amenity table via Supabase
 *
 * @param {Array<string>} amenityIds - Array of amenity UUIDs
 * @returns {Promise<Array>} Array of amenity objects from database
 */
async function fetchAmenityDetails(amenityIds) {
    if (!amenityIds || amenityIds.length === 0) {
        return [];
    }

    if (!window.SupabaseAPI || !window.SupabaseAPI.isInitialized) {
        console.error('Supabase API not initialized - cannot fetch amenity details');
        return [];
    }

    try {
        const { data, error } = await window.SupabaseAPI.client
            .from('zat_features_amenity')
            .select('_id, Name, Icon')
            .in('_id', amenityIds);

        if (error) {
            console.error('Error fetching amenity details:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Exception fetching amenity details:', error);
        return [];
    }
}

/**
 * Render amenity icons as HTML with hover tooltips
 * Displays up to maxVisible icons, with a "+X more" counter for remaining
 *
 * @param {Array} amenities - Array of amenity objects from parseAmenities()
 * @param {number} maxVisible - Maximum number of icons to display (default: 6)
 * @returns {string} HTML string for amenity icons row
 */
function renderAmenityIcons(amenities, maxVisible = 6) {
    if (!amenities || amenities.length === 0) {
        return '<div class="listing-amenities empty">No amenities listed</div>';
    }

    const visibleAmenities = amenities.slice(0, maxVisible);
    const hiddenCount = Math.max(0, amenities.length - maxVisible);

    let html = '<div class="listing-amenities">';

    // Render visible amenities
    visibleAmenities.forEach(amenity => {
        // Use iconUrl if available, otherwise use fallback emoji icon
        const iconDisplay = amenity.iconUrl
            ? `<img src="${amenity.iconUrl}" alt="${amenity.name}" class="amenity-icon-img" />`
            : amenity.icon;

        html += `
            <span class="amenity-icon" data-tooltip="${amenity.name}" title="${amenity.name}">
                ${iconDisplay}
            </span>
        `;
    });

    // Add "+X more" counter if needed
    if (hiddenCount > 0) {
        html += `
            <span class="amenity-more-count" data-tooltip="View all amenities" title="View all amenities">
                +${hiddenCount} more
            </span>
        `;
    }

    html += '</div>';
    return html;
}

/**
 * Show all amenities in a modal (for future implementation)
 * This function will be called when user clicks "+X more" button
 *
 * @param {string} listingId - Listing ID to show amenities for
 */
function showAllAmenities(listingId) {
    // TODO: Implement modal to show all amenities
    // For now, just log to console
    console.log('Show all amenities for listing:', listingId);

    // Find listing and get all amenities
    const listing = window.currentListings ? window.currentListings.find(l => l.id === listingId) : null;
    if (!listing || !listing.amenities) {
        console.warn('No amenities found for listing:', listingId);
        return;
    }

    // Future: Open modal with all amenities categorized by in-unit vs in-building
    alert(`All amenities:\n\n${listing.amenities.map(a => `${a.icon} ${a.name} (${a.category})`).join('\n')}`);
}

// Export functions for use in other modules
window.AmenityUtils = {
    parseAmenities,
    renderAmenityIcons,
    showAllAmenities,
    AMENITY_PRIORITY_MAP
};

console.log('✅ Amenity utilities loaded');
