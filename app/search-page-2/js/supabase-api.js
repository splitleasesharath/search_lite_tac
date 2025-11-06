/**
 * Supabase API Client for Split Lease
 * Connects to Supabase database to fetch listing data
 */

class SupabaseAPI {
    constructor() {
        // Use config from window.ENV (set by config.js)
        this.supabaseUrl = window.ENV?.SUPABASE_URL;
        this.supabaseKey = window.ENV?.SUPABASE_ANON_KEY;

        if (!this.supabaseUrl || !this.supabaseKey) {
            console.error('❌ Supabase credentials not found in window.ENV');
            throw new Error('Supabase credentials missing from config');
        }

        this.client = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the Supabase client
     */
    async initialize() {
        try {
            // Check if Supabase JS client library is loaded
            // The @supabase/supabase-js@2 CDN exposes window.supabase
            const supabaseLib = window.supabase || (typeof supabase !== 'undefined' ? supabase : null);

            if (!supabaseLib || !supabaseLib.createClient) {
                console.error('❌ Supabase client library not loaded. Include it in your HTML.');
                console.error('   Expected: window.supabase.createClient to be available');
                console.error('   Found: window.supabase =', typeof window.supabase);
                return false;
            }

            // Create Supabase client
            this.client = supabaseLib.createClient(this.supabaseUrl, this.supabaseKey);
            this.isInitialized = true;
            console.log('✅ Supabase API initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Supabase:', error);
            return false;
        }
    }

    /**
     * Get all active listings from Supabase
     * @param {Object} filters - Optional filters for listings
     * @returns {Promise<Array>} Array of transformed listings
     */
    async getListings(filters = {}) {
        if (!this.isInitialized) {
            console.warn('⚠️ Supabase not initialized');
            return [];
        }

        try {
            const hasFilters = filters && Object.keys(filters).length > 0;
            console.log('🔍 Fetching listings from Supabase...', hasFilters ? 'with filters' : 'all listings');
            if (hasFilters) {
                console.log('📋 Active filters:', filters);
            }

            // Build query with filters
            let query = this.client
                .from('listing')
                .select('*');
                // Active filter removed - showing all listings regardless of Active status
                // Removed .eq('Approved', true) - no listings have Approved=true in database

            // Apply borough filter
            if (filters.boroughs && filters.boroughs.length > 0) {
                console.log('  🏙️ Filtering by boroughs:', filters.boroughs.length);
                query = query.in('"Location - Borough"', filters.boroughs);
            }

            // Apply week pattern filter
            if (filters.weekPatterns && filters.weekPatterns.length > 0) {
                console.log('  📅 Filtering by week patterns:', filters.weekPatterns);
                query = query.in('"Weeks offered"', filters.weekPatterns);
            }

            // Apply price range filter
            if (filters.priceRange) {
                console.log('  💰 Filtering by price range:', filters.priceRange);
                if (filters.priceRange.min !== undefined) {
                    query = query.gte('"Standarized Minimum Nightly Price (Filter)"', filters.priceRange.min);
                }
                if (filters.priceRange.max !== undefined) {
                    query = query.lte('"Standarized Minimum Nightly Price (Filter)"', filters.priceRange.max);
                }
            }

            // Apply neighborhood filter
            if (filters.neighborhoods && filters.neighborhoods.length > 0) {
                console.log('  🏘️ Filtering by neighborhoods:', filters.neighborhoods.length);
                query = query.in('"Location - Hood"', filters.neighborhoods);
            }

            

            // Apply sorting (field names already quoted in filter-config.js)
            if (filters.sort && filters.sort.field) {
                console.log('  🔢 Sorting by:', filters.sort.field, filters.sort.ascending ? 'ASC' : 'DESC');
                // Field name comes pre-quoted from filter-config.js
                const sortField = filters.sort.field;
                query = query.order(sortField, { ascending: filters.sort.ascending });
            } else {
                // Default sort by modified date
                query = query.order('"Modified Date"', { ascending: false });
            }

            const { data, error } = await query;

            if (error) {
                console.error('❌ Error fetching listings:', error);
                return [];
            }

            let rows = Array.isArray(data) ? data : [];

            console.log(`📊 Retrieved ${rows.length} listings from Supabase`);

            // Apply client-side schedule filter when necessary (JSON fields may be double-encoded strings)
            if (filters.requiredDayNumbers && Array.isArray(filters.requiredDayNumbers) && filters.requiredDayNumbers.length > 0) {
                console.log('  📅 Applying schedule filter (client):', filters.requiredDayNumbers);
                const beforeCount = rows.length;
                const requiredSet = new Set(filters.requiredDayNumbers);

                const numberToDayName = (n) => {
                    switch (n) {
                        case 1: return 'Sunday';
                        case 2: return 'Monday';
                        case 3: return 'Tuesday';
                        case 4: return 'Wednesday';
                        case 5: return 'Thursday';
                        case 6: return 'Friday';
                        case 7: return 'Saturday';
                        default: return null;
                    }
                };

                const parseJsonArray = (value) => {
                    if (Array.isArray(value)) return value;
                    if (typeof value === 'string') {
                        try {
                            const parsed = JSON.parse(value);
                            return Array.isArray(parsed) ? parsed : null;
                        } catch (_) {
                            return null;
                        }
                    }
                    return null;
                };

                rows = rows.filter((dbListing) => {
                    // Try numeric nights array first
                    const rawNights = dbListing['Nights Available (numbers)'];
                    const nightsArr = parseJsonArray(rawNights);
                    if (Array.isArray(nightsArr)) {
                        const nightNums = new Set(
                            nightsArr
                                .map((x) => (typeof x === 'number' ? x : (typeof x === 'string' ? parseInt(x, 10) : NaN)))
                                .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
                        );
                        if ([...requiredSet].every((n) => nightNums.has(n))) {
                            return true;
                        }
                    }

                    // Fallback to day names array
                    const rawDays = dbListing['Days Available (List of Days)'];
                    const daysArr = parseJsonArray(rawDays);
                    if (Array.isArray(daysArr)) {
                        const dayNames = new Set(daysArr.map((d) => (typeof d === 'string' ? d.trim() : '')));
                        if ([...requiredSet].every((n) => {
                            const name = numberToDayName(n);
                            return !!name && dayNames.has(name);
                        })) {
                            return true;
                        }
                    }

                    return false;
                });

                console.log(`  ✅ Schedule filter applied: ${rows.length}/${beforeCount} listings match required days`);
            }

            // Collect all unique photo IDs from all remaining listings (handles string or array)
            const allPhotoIds = new Set();
            const collectIdsFrom = (photosField) => {
                let arr = photosField;
                if (typeof photosField === 'string') {
                    try { arr = JSON.parse(photosField); } catch (_) { return; }
                }
                if (Array.isArray(arr)) {
                    for (const id of arr) {
                        if (id && typeof id === 'string') allPhotoIds.add(id);
                    }
                }
            };
            
            // Collect listing photo IDs
            rows.forEach(listing => collectIdsFrom(listing['Features - Photos']));
            
            // Collect host picture IDs (may also be photo IDs needing lookup)
            rows.forEach(listing => {
                const hostPicture = listing['Host Picture'] || listing['host picture'];
                if (hostPicture && typeof hostPicture === 'string') {
                    // Check if it looks like a photo ID (not a URL)
                    if (!hostPicture.startsWith('http://') && !hostPicture.startsWith('https://') && !hostPicture.startsWith('//')) {
                        allPhotoIds.add(hostPicture);
                    }
                }
            });

            console.log(`📸 Found ${allPhotoIds.size} unique photo IDs, fetching URLs...`);

            // Fetch all photo URLs in one batch query
            const photoMap = await this.fetchPhotoUrls(Array.from(allPhotoIds));

            // Transform the raw Supabase data to match the app's expected format
            const transformedListings = rows.map(listing => this.transformListing(listing, photoMap));

            return transformedListings;
        } catch (error) {
            console.error('❌ Error in getListings:', error);
            return [];
        }
    }

    /**
     * Fetch photo URLs from listing_photo table by IDs
     * @param {Array<string>} photoIds - Array of photo IDs
     * @returns {Promise<Object>} Map of photo ID to photo URL
     */
    async fetchPhotoUrls(photoIds) {
        if (!photoIds || photoIds.length === 0) {
            return {};
        }

        try {
            const { data, error } = await this.client
                .from('listing_photo')
                .select('_id, Photo')
                .in('_id', photoIds);

            if (error) {
                console.error('❌ Error fetching photos:', error);
                return {};
            }

            // Create a map of photo ID to URL
            const photoMap = {};
            data.forEach(photo => {
                if (photo.Photo) {
                    // Add https: protocol if URL starts with //
                    let photoUrl = photo.Photo;
                    if (photoUrl.startsWith('//')) {
                        photoUrl = 'https:' + photoUrl;
                    }
                    photoMap[photo._id] = photoUrl;
                }
            });

            console.log(`✅ Fetched ${Object.keys(photoMap).length} photo URLs`);
            return photoMap;
        } catch (error) {
            console.error('❌ Error in fetchPhotoUrls:', error);
            return {};
        }
    }

    /**
     * Transform Supabase listing to app format
     * @param {Object} dbListing - Raw listing from Supabase
     * @param {Object} photoMap - Map of photo IDs to URLs
     * @returns {Object} Transformed listing
     */
    transformListing(dbListing, photoMap = {}) {
        // Extract basic info
        const id = dbListing._id;
        const name = dbListing.Name || 'Unnamed Listing';
        const borough = this.normalizeBoroughName(dbListing['Location - Borough']);
        const neighborhood = dbListing['Location - Hood'] || dbListing['neighborhood (manual input by user)'] || '';

        // Extract pricing - Supabase stores per-night rates
        // Use null instead of 0 for missing prices so downstream code can handle appropriately
        const rawStartingPrice = dbListing['Standarized Minimum Nightly Price (Filter)'];
        const startingPrice = (rawStartingPrice !== null && rawStartingPrice !== undefined)
            ? parseFloat(rawStartingPrice)
            : null;

        const price2 = parseFloat(dbListing['💰Nightly Host Rate for 2 nights']) || null;
        const price3 = parseFloat(dbListing['💰Nightly Host Rate for 3 nights']) || null;
        const price4 = parseFloat(dbListing['💰Nightly Host Rate for 4 nights']) || null;
        const price5 = parseFloat(dbListing['💰Nightly Host Rate for 5 nights']) || null;
        const price7 = parseFloat(dbListing['💰Nightly Host Rate for 7 nights']) || null;

        // Extract features
        const bedrooms = dbListing['Features - Qty Bedrooms'] || 0;
        const bathrooms = dbListing['Features - Qty Bathrooms'] || 0;
        const guests = dbListing['Features - Qty Guests'] || 1;
        const typeOfSpace = dbListing['Features - Type of Space'] || 'Entire Place';
        const kitchenType = dbListing['Kitchen Type'] || 'Full Kitchen';

        // Extract photos using photoMap to convert IDs to URLs
        const photos = this.extractPhotos(dbListing['Features - Photos'], photoMap, id);

        // Extract coordinates
        // Note: Location - Address is stored as a JSON string, not a JSONB object
        let address = dbListing['Location - Address'];

        // Parse the JSON string if it's a string
        if (typeof address === 'string') {
            try {
                address = JSON.parse(address);
            } catch (error) {
                console.warn(`⚠️ Failed to parse address for listing ${id}:`, error);
                address = null;
            }
        }

        const coordinates = {
            lat: address?.lat || 40.7580,
            lng: address?.lng || -73.9855
        };

        // Extract host info
        const hostName = dbListing['host name'] || 'Host';
        const hostEmail = dbListing['Host email'] || '';
        
        // Extract host image - may be a photo ID or direct URL
        let hostImage = dbListing['Host Picture'] || dbListing['host picture'] || null;
        if (hostImage && typeof hostImage === 'string') {
            // If it looks like a photo ID (not a URL), look it up in photoMap
            if (!hostImage.startsWith('http://') && !hostImage.startsWith('https://') && !hostImage.startsWith('//')) {
                const resolvedUrl = photoMap[hostImage];
                if (resolvedUrl) {
                    console.log(`✅ Listing ${id}: Resolved host picture ID "${hostImage}" → ${resolvedUrl.substring(0, 60)}...`);
                    hostImage = resolvedUrl;
                } else {
                    console.warn(`⚠️ Listing ${id}: Host picture ID "${hostImage}" not found in photoMap`);
                    hostImage = null; // Set to null if not resolved
                }
            }
        }

        // Extract availability info
        const daysAvailable = dbListing['Days Available (List of Days)'] || [];
        const weeksOffered = dbListing['Weeks offered'] || 'Every week';

        // Parse amenities from database fields
        const amenities = this.parseAmenities(dbListing);

        return {
            id: id,
            title: name,
            location: this.formatLocation(neighborhood, borough),
            neighborhood: neighborhood,
            borough: borough,
            coordinates: coordinates,
            price: {
                starting: startingPrice || 0,
                full: price7 || price5 || startingPrice || 0
            },
            // Include all price fields for dynamic pricing (both standard and emoji field names)
            'Starting nightly price': startingPrice,
            'Price 2 nights selected': price2,
            'Price 3 nights selected': price3,
            'Price 4 nights selected': price4,
            'Price 5 nights selected': price5,
            'Price 6 nights selected': null, // Not in Supabase schema
            'Price 7 nights selected': price7,
            // Also include emoji field names for map marker fallback logic
            '💰Nightly Host Rate for 2 nights': price2,
            '💰Nightly Host Rate for 3 nights': price3,
            '💰Nightly Host Rate for 4 nights': price4,
            '💰Nightly Host Rate for 5 nights': price5,
            '💰Nightly Host Rate for 7 nights': price7,
            type: typeOfSpace,
            squareFeet: dbListing['Features - SQFT Area'] || null,
            maxGuests: guests,
            bedrooms: bedrooms,
            bathrooms: bathrooms,
            kitchen: kitchenType,
            amenities: amenities,
            host: {
            name: hostName,
            image: hostImage,
            verified: false
            },
            images: photos,
            description: this.generateDescription(bedrooms, bathrooms, kitchenType),
            weeks_offered: weeksOffered,
            days_available: daysAvailable,
            created_date: dbListing['Created Date'],
            modified_date: dbListing['Modified Date'],
            isNew: this.isNewListing(dbListing['Created Date']),
            _rawListing: dbListing
        };
    }

    /**
     * Extract photos from Supabase photos field and convert IDs to URLs
     * @param {Array} photosField - Array of photo IDs from Features - Photos (may be double-encoded as string)
     * @param {Object} photoMap - Map of photo IDs to actual URLs
     * @param {string} listingId - Listing ID for debugging purposes
     */
    extractPhotos(photosField, photoMap = {}, listingId = null) {
        console.log(`📸 Processing photos for listing ${listingId}:`, {
            photosField,
            photoFieldType: typeof photosField,
            photoMapKeys: Object.keys(photoMap).length,
            photoMapSample: Object.keys(photoMap).slice(0, 3)
        });

        // Handle double-encoded JSONB: Supabase stores "Features - Photos" as JSONB string containing JSON array
        // Need to parse it to get the actual array
        let photos = photosField;
        if (typeof photosField === 'string') {
            try {
                photos = JSON.parse(photosField);
                console.log(`🔧 Listing ${listingId}: Parsed double-encoded JSONB string to array`);
            } catch (error) {
                console.error(`❌ Listing ${listingId}: Failed to parse photos JSON string:`, error);
                return []; // Return empty array - NO FALLBACK
            }
        }

        if (!photos || !Array.isArray(photos)) {
            console.error(`❌ Listing ${listingId}: No photos field or not an array after parsing`);
            return []; // Return empty array - NO FALLBACK
        }

        if (photos.length === 0) {
            console.error(`❌ Listing ${listingId}: Photos array is empty`);
            return []; // Return empty array - NO FALLBACK
        }

        // Convert photo IDs to actual URLs using photoMap
        const photoUrls = [];
        const missingPhotoIds = [];

        for (const photoId of photos) {
            if (typeof photoId !== 'string') {
                console.error(`❌ Listing ${listingId}: Invalid photo ID type:`, typeof photoId, photoId);
                continue;
            }

            const url = photoMap[photoId];
            if (!url) {
                console.error(`❌ Listing ${listingId}: Photo ID "${photoId}" NOT FOUND in photoMap`);
                missingPhotoIds.push(photoId);
            } else {
                console.log(`✅ Listing ${listingId}: Photo ID "${photoId}" → ${url.substring(0, 60)}...`);
                photoUrls.push(url);
            }
        }

        if (missingPhotoIds.length > 0) {
            console.error(`❌ Listing ${listingId}: Missing ${missingPhotoIds.length} photo URLs:`, missingPhotoIds);
        }

        if (photoUrls.length === 0) {
            console.error(`❌ Listing ${listingId}: NO VALID PHOTO URLS RESOLVED - returning empty array`);
        } else {
            console.log(`✅ Listing ${listingId}: Resolved ${photoUrls.length} photo URLs`);
        }

        return photoUrls.slice(0, 5); // Return actual photos only, limit to 5
    }

    /**
     * Format location string
     */
    formatLocation(neighborhood, borough) {
        if (neighborhood && borough) {
            return `${neighborhood}, ${borough}`;
        } else if (borough) {
            return borough;
        } else {
            return 'New York';
        }
    }

    /**
     * Normalize borough name to lowercase format (dynamically loaded from database)
     * ⚠️ NO HARDCODED VALUES - Uses FilterConfig cache from database
     */
    normalizeBoroughName(boroughId) {
        // Use dynamic lookup from FilterConfig (populated from database)
        if (window.FilterConfig && window.FilterConfig.getBoroughValueFromId) {
            const value = window.FilterConfig.getBoroughValueFromId(boroughId);
            if (value) {
                return value;
            }
        }

        // If FilterConfig not ready or ID not found, log error and return null
        console.error(`❌ Cannot normalize borough ID "${boroughId}" - FilterConfig not initialized or ID not found`);
        return null;
    }

    

    /**
     * Parse amenities from database fields and return prioritized list with icons
     * @param {Object} dbListing - Raw listing from database
     * @returns {Array} Array of amenity objects with icon, name, and priority
     */
    parseAmenities(dbListing) {
        // Amenities map with icons and priority (lower = higher priority)
        const amenitiesMap = {
            'wifi': { icon: '📶', name: 'WiFi', priority: 1 },
            'furnished': { icon: '🛋️', name: 'Furnished', priority: 2 },
            'pet': { icon: '🐕', name: 'Pet-Friendly', priority: 3 },
            'dog': { icon: '🐕', name: 'Pet-Friendly', priority: 3 },
            'cat': { icon: '🐕', name: 'Pet-Friendly', priority: 3 },
            'washer': { icon: '🧺', name: 'Washer/Dryer', priority: 4 },
            'dryer': { icon: '🧺', name: 'Washer/Dryer', priority: 4 },
            'parking': { icon: '🅿️', name: 'Parking', priority: 5 },
            'elevator': { icon: '🏢', name: 'Elevator', priority: 6 },
            'gym': { icon: '💪', name: 'Gym', priority: 7 },
            'doorman': { icon: '🚪', name: 'Doorman', priority: 8 },
            'ac': { icon: '❄️', name: 'A/C', priority: 9 },
            'air conditioning': { icon: '❄️', name: 'A/C', priority: 9 },
            'kitchen': { icon: '🍳', name: 'Kitchen', priority: 10 },
            'balcony': { icon: '🌿', name: 'Balcony', priority: 11 },
            'workspace': { icon: '💻', name: 'Workspace', priority: 12 },
            'desk': { icon: '💻', name: 'Workspace', priority: 12 }
        };

        const amenities = [];
        const foundAmenities = new Set(); // Track which amenities we've already added

        // Check Features field (if it exists as a string or array)
        const features = dbListing['Features'];
        if (features) {
            const featureText = typeof features === 'string' ? features.toLowerCase() : '';

            for (const [key, amenity] of Object.entries(amenitiesMap)) {
                if (featureText.includes(key) && !foundAmenities.has(amenity.name)) {
                    amenities.push(amenity);
                    foundAmenities.add(amenity.name);
                }
            }
        }

        // Check Kitchen Type field - if it's "Full Kitchen", add kitchen amenity
        const kitchenType = dbListing['Kitchen Type'];
        if (kitchenType && kitchenType.toLowerCase().includes('kitchen') && !foundAmenities.has('Kitchen')) {
            amenities.push(amenitiesMap['kitchen']);
            foundAmenities.add('Kitchen');
        }

        // Sort by priority (lower number = higher priority)
        amenities.sort((a, b) => a.priority - b.priority);

        return amenities;
    }

    /**
     * Check if listing is new (created within last 30 days)
     */
    isNewListing(createdDate) {
        if (!createdDate) return false;
        const created = new Date(createdDate);
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        return created > thirtyDaysAgo;
    }

    /**
     * Generate description from listing features
     */
    generateDescription(bedrooms, bathrooms, kitchenType) {
        const parts = [];

        if (bedrooms === 0) {
            parts.push('Studio');
        } else {
            parts.push(`${bedrooms} bedroom${bedrooms > 1 ? 's' : ''}`);
        }

        if (bathrooms > 0) {
            parts.push(`${bathrooms} bathroom${bathrooms > 1 ? 's' : ''}`);
        }

        if (kitchenType) {
            parts.push(kitchenType);
        }

        return '• ' + parts.join(' • ');
    }

    /**
     * Get all boroughs from zat_geo_borough_toplevel table
     * @returns {Promise<Array>} Array of borough objects with id and name
     */
    async getBoroughs() {
        if (!this.isInitialized) {
            console.warn('⚠️ Supabase not initialized');
            return [];
        }

        try {
            console.log('🏙️ Fetching boroughs from database...');

            const { data, error } = await this.client
                .from('zat_geo_borough_toplevel')
                .select('_id, "Display Borough"')
                .order('"Display Borough"', { ascending: true });

            if (error) {
                console.error('❌ Error fetching boroughs:', error);
                return [];
            }

            // Transform to app format
            const boroughs = data
                .filter(b => b['Display Borough'] && b['Display Borough'].trim())
                .map(b => ({
                    id: b._id,
                    name: b['Display Borough'].trim(),
                    // Generate value for select option (lowercase, replace spaces)
                    value: b['Display Borough'].trim().toLowerCase()
                        .replace(/\s+county\s+nj/i, '') // Remove "County NJ"
                        .replace(/\s+/g, '-') // Replace spaces with hyphens
                }));

            console.log(`✅ Fetched ${boroughs.length} boroughs from database`);
            return boroughs;
        } catch (error) {
            console.error('❌ Error in getBoroughs:', error);
            return [];
        }
    }

    /**
     * Get all neighborhoods from zat_geo_hood_mediumlevel table
     * @param {string} boroughId - Optional borough ID to filter neighborhoods
     * @returns {Promise<Array>} Array of neighborhood objects with id, name, and borough
     */
    async getNeighborhoods(boroughId = null) {
        if (!this.isInitialized) {
            console.warn('⚠️ Supabase not initialized');
            return [];
        }

        try {
            console.log('🏘️ Fetching neighborhoods from database...', boroughId ? `for borough: ${boroughId}` : 'all');

            let query = this.client
                .from('zat_geo_hood_mediumlevel')
                .select('_id, Display, "Geo-Borough"')
                .order('Display', { ascending: true });

            // Filter by borough if provided
            if (boroughId) {
                query = query.eq('"Geo-Borough"', boroughId);
            }

            const { data, error } = await query;

            if (error) {
                console.error('❌ Error fetching neighborhoods:', error);
                return [];
            }

            // Transform to app format
            const neighborhoods = data
                .filter(n => n.Display && n.Display.trim()) // Filter out empty or null Display names
                .map(n => ({
                    id: n._id,
                    name: n.Display.trim(),
                    boroughId: n['Geo-Borough'],
                    // Generate kebab-case value for checkbox value attribute
                    value: n.Display.trim().toLowerCase()
                        .replace(/[^\w\s-]/g, '') // Remove special chars
                        .replace(/\s+/g, '-') // Replace spaces with hyphens
                        .replace(/--+/g, '-') // Replace multiple hyphens with single
                }));

            console.log(`✅ Fetched ${neighborhoods.length} neighborhoods from database`);
            return neighborhoods;
        } catch (error) {
            console.error('❌ Error in getNeighborhoods:', error);
            return [];
        }
    }

    /**
     * Get database statistics
     */
    async getStats() {
        if (!this.isInitialized) return null;

        try {
            const { data, error } = await this.client
                .from('listing')
                .select('_id, "Location - Borough", "Standarized Minimum Nightly Price (Filter)"')
                .eq('Active', true);

            if (error) throw error;

            // Calculate stats
            const totalListings = data.length;
            const prices = data
                .map(l => parseFloat(l['Standarized Minimum Nightly Price (Filter)']))
                .filter(p => !isNaN(p) && p > 0);

            const averagePrice = prices.length > 0
                ? prices.reduce((a, b) => a + b, 0) / prices.length
                : 0;

            return {
                totalListings,
                averagePrice: averagePrice.toFixed(2)
            };
        } catch (error) {
            console.error('Error getting stats:', error);
            return null;
        }
    }

    // Alias methods for backward compatibility with remote code
    async init() {
        return await this.initialize();
    }

    async fetchListings(filters = {}) {
        return await this.getListings(filters);
    }
}

// Create global instance
window.SupabaseAPI = new SupabaseAPI();
