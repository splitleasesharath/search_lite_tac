/**
 * Optimized Local Database Manager for Split Lease
 * Uses the new listingoptimized endpoint for simplified data management
 */

class OptimizedListingDatabase {
    constructor() {
        this.dbName = 'SplitLeaseOptimizedDB';
        this.version = 1;
        this.db = null;
        this.apiConfig = {
            baseUrl: 'https://upgradefromstr.bubbleapps.io/version-test/api/1.1',
            apiKey: window.ENV?.BUBBLE_API_KEY || '05a7a0d1d2400a0b574acd99748e07a0',
            endpoint: 'listingoptimized'
        };
        this.syncInterval = 5 * 60 * 1000; // 5 minutes
        this.autoSyncTimer = null;
    }

    /**
     * Initialize the database
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('Database error:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('Optimized database opened successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                this.createObjectStores(db);
            };
        });
    }

    /**
     * Create object stores for the optimized structure
     */
    createObjectStores(db) {
        // Main listings store with optimized structure
        if (!db.objectStoreNames.contains('listings_optimized')) {
            const listingsStore = db.createObjectStore('listings_optimized', {
                keyPath: '_id'
            });

            // Create basic indexes for querying
            listingsStore.createIndex('borough', 'Borough', { unique: false });
            listingsStore.createIndex('neighborhood', 'Neighborhood', { unique: false });
        }

        // Sync metadata store
        if (!db.objectStoreNames.contains('sync_metadata')) {
            db.createObjectStore('sync_metadata', {
                keyPath: 'key'
            });
        }

        // Cache store for images
        if (!db.objectStoreNames.contains('image_cache')) {
            const imageStore = db.createObjectStore('image_cache', {
                keyPath: 'url'
            });
            imageStore.createIndex('listingId', 'listingId', { unique: false });
            imageStore.createIndex('cachedDate', 'cachedDate', { unique: false });
        }
    }

    /**
     * Fetch listings from the optimized API endpoint
     */
    async fetchFromAPI(limit = 100, cursor = 0) {
        const url = `${this.apiConfig.baseUrl}/obj/${this.apiConfig.endpoint}?limit=${limit}&cursor=${cursor}`;

        try {
            console.log(`Fetching from: ${url}`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiConfig.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data.response || { results: [], remaining: 0, count: 0 };

        } catch (error) {
            console.error('Error fetching from API:', error);
            throw error;
        }
    }

    // NOTE: Removed fetchListingPhotos and fetchMultipleListingPhotos functions
    // We now store images directly in IndexedDB during sync for faster local access
    // No need for separate API calls - images are cached in 'Cached Images' field

    /**
     * Save listings to the local database
     */
    async saveListings(listings) {
        const transaction = this.db.transaction(['listings_optimized'], 'readwrite');
        const store = transaction.objectStore('listings_optimized');

        let savedCount = 0;

        for (const listing of listings) {
            try {
                // Add a local timestamp for tracking
                listing.localSyncDate = new Date().toISOString();

                // Don't process images during sync - lazy load them later
                // Just store the raw Features - Photos field
                let imageUrls = listing['Features - Photos'] || [];

                // Don't generate placeholder images here - do it during lazy loading

                // Ensure all expected fields exist with defaults
                const processedListing = {
                    ...listing,
                    // Store raw photo field - don't cache processed URLs
                    'Features - Photos': listing['Features - Photos'] || [],
                    // Ensure critical fields have values
                    'Listing name': listing['Listing name'] || 'Unnamed Listing',
                    'Borough': listing['Borough'] || 'Unknown',
                    'Neighborhood': listing['Neighborhood'] || 'Unknown',
                    'Starting nightly price': listing['Starting nightly price'] || 0,
                    'Qty of bedrooms': listing['Qty of bedrooms'] || 0,
                    'Qty of bathrooms': listing['Qty of bathrooms'] || 0,
                    'Qty of guests allowed': listing['Qty of guests allowed'] || 1,
                    'Type of space': listing['Type of space'] || 'Unknown',
                    'Kitchen type': listing['Kitchen type'] || 'Unknown',
                    'Weeks offered': listing['Weeks offered'] || 'Unknown',
                    'Days Available': listing['Days Available'] || [],
                    'Host Name': listing['Host Name'] || 'Host',
                    'Host Pricture': listing['Host Pricture'] || null
                };

                await store.put(processedListing);
                savedCount++;
            } catch (error) {
                console.error('Error saving listing:', listing._id, error);
            }
        }

        console.log(`Saved ${savedCount} listings to local database`);
        return savedCount;
    }

    /**
     * Get listings from local database with optional filters
     */
    async getListings(filters = {}) {
        const transaction = this.db.transaction(['listings_optimized'], 'readonly');
        const store = transaction.objectStore('listings_optimized');

        let listings = [];

        // Use index if filtering by specific field
        if (filters.borough) {
            const index = store.index('borough');
            listings = await this.getAllFromIndex(index, filters.borough);
        } else if (filters.neighborhood) {
            const index = store.index('neighborhood');
            listings = await this.getAllFromIndex(index, filters.neighborhood);
        } else {
            listings = await this.getAllFromStore(store);
        }

        // Apply additional filters
        if (filters.minPrice !== undefined) {
            listings = listings.filter(l => l['Starting nightly price'] >= filters.minPrice);
        }
        if (filters.maxPrice !== undefined) {
            listings = listings.filter(l => l['Starting nightly price'] <= filters.maxPrice);
        }
        if (filters.bedrooms !== undefined) {
            listings = listings.filter(l => l['Qty of bedrooms'] >= filters.bedrooms);
        }
        if (filters.typeOfSpace) {
            listings = listings.filter(l => l['Type of space'] === filters.typeOfSpace);
        }
        if (filters.weeksOffered) {
            listings = listings.filter(l => l['Weeks offered'] === filters.weeksOffered);
        }

        // Sort results
        if (filters.sortBy) {
            listings = this.sortListings(listings, filters.sortBy);
        }

        // Limit results
        if (filters.limit) {
            listings = listings.slice(0, filters.limit);
        }

        return listings;
    }

    /**
     * Sort listings by specified criteria
     */
    sortListings(listings, sortBy) {
        const sortFunctions = {
            'price-low': (a, b) => a['Starting nightly price'] - b['Starting nightly price'],
            'price-high': (a, b) => b['Starting nightly price'] - a['Starting nightly price'],
            'bedrooms': (a, b) => b['Qty of bedrooms'] - a['Qty of bedrooms'],
            'recent': (a, b) => new Date(b['Created Date']) - new Date(a['Created Date']),
            'modified': (a, b) => new Date(b['Modified Date']) - new Date(a['Modified Date'])
        };

        const sortFunction = sortFunctions[sortBy];
        if (sortFunction) {
            return listings.sort(sortFunction);
        }

        return listings;
    }

    /**
     * Get a single listing by ID
     */
    async getListing(listingId) {
        const transaction = this.db.transaction(['listings_optimized'], 'readonly');
        const store = transaction.objectStore('listings_optimized');

        return new Promise((resolve, reject) => {
            const request = store.get(listingId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Search listings by text
     */
    async searchListings(searchTerm) {
        const allListings = await this.getListings();
        const term = searchTerm.toLowerCase();

        return allListings.filter(listing => {
            const searchableFields = [
                listing['Listing name'],
                listing['Borough'],
                listing['Neighborhood'],
                listing['Type of space'],
                listing['Host Name']
            ];

            return searchableFields.some(field =>
                field && field.toLowerCase().includes(term)
            );
        });
    }

    /**
     * Sync with Bubble API - fetch all listings
     */
    async syncWithAPI() {
        console.log('Starting sync with optimized API...');
        const startTime = Date.now();

        try {
            let allListings = [];
            let cursor = 0;
            let hasMore = true;
            const batchSize = 100;

            while (hasMore) {
                const response = await this.fetchFromAPI(batchSize, cursor);
                const listings = response.results || [];

                if (listings.length > 0) {
                    allListings = allListings.concat(listings);
                    await this.saveListings(listings);
                }

                // Check if there are more results
                hasMore = response.remaining > 0;
                cursor += listings.length;

                console.log(`Fetched ${listings.length} listings (Total: ${allListings.length})`);

                // Add a small delay to avoid rate limiting
                if (hasMore) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            // Update sync metadata
            await this.updateSyncMetadata({
                lastSync: new Date().toISOString(),
                totalListings: allListings.length,
                syncDuration: Date.now() - startTime
            });

            console.log(`Sync completed: ${allListings.length} listings in ${Date.now() - startTime}ms`);
            return {
                success: true,
                count: allListings.length,
                duration: Date.now() - startTime
            };

        } catch (error) {
            console.error('Sync error:', error);

            await this.updateSyncMetadata({
                lastSyncError: error.message,
                lastSyncErrorDate: new Date().toISOString()
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Update sync metadata
     */
    async updateSyncMetadata(data) {
        const transaction = this.db.transaction(['sync_metadata'], 'readwrite');
        const store = transaction.objectStore('sync_metadata');

        for (const [key, value] of Object.entries(data)) {
            await store.put({
                key,
                value,
                updatedAt: new Date().toISOString()
            });
        }
    }

    /**
     * Get sync metadata
     */
    async getSyncMetadata() {
        const transaction = this.db.transaction(['sync_metadata'], 'readonly');
        const store = transaction.objectStore('sync_metadata');
        const allData = await this.getAllFromStore(store);

        const metadata = {};
        for (const item of allData) {
            metadata[item.key] = item.value;
        }

        return metadata;
    }

    /**
     * Start automatic syncing
     */
    startAutoSync(intervalMinutes = 5) {
        this.stopAutoSync(); // Clear any existing timer

        this.syncInterval = intervalMinutes * 60 * 1000;

        // Initial sync
        this.syncWithAPI();

        // Set up periodic sync
        this.autoSyncTimer = setInterval(() => {
            this.syncWithAPI();
        }, this.syncInterval);

        console.log(`Auto-sync started: every ${intervalMinutes} minutes`);
    }

    /**
     * Stop automatic syncing
     */
    stopAutoSync() {
        if (this.autoSyncTimer) {
            clearInterval(this.autoSyncTimer);
            this.autoSyncTimer = null;
            console.log('Auto-sync stopped');
        }
    }

    /**
     * Clear all data from the database
     */
    async clearDatabase() {
        const transaction = this.db.transaction(
            ['listings_optimized', 'sync_metadata', 'image_cache'],
            'readwrite'
        );

        for (const storeName of ['listings_optimized', 'sync_metadata', 'image_cache']) {
            const store = transaction.objectStore(storeName);
            await store.clear();
        }

        console.log('Database cleared');
    }

    /**
     * Get database statistics
     */
    async getStats() {
        const listings = await this.getListings();
        const metadata = await this.getSyncMetadata();

        const boroughs = {};
        const types = {};
        let totalPrice = 0;

        for (const listing of listings) {
            // Count by borough
            const borough = listing['Borough'] || 'Unknown';
            boroughs[borough] = (boroughs[borough] || 0) + 1;

            // Count by type
            const type = listing['Type of space'] || 'Unknown';
            types[type] = (types[type] || 0) + 1;

            // Sum prices
            totalPrice += listing['Starting nightly price'] || 0;
        }

        return {
            totalListings: listings.length,
            averagePrice: listings.length > 0 ? totalPrice / listings.length : 0,
            listingsByBorough: boroughs,
            listingsByType: types,
            lastSync: metadata.lastSync,
            syncDuration: metadata.syncDuration
        };
    }

    // Helper methods for IndexedDB operations
    getAllFromStore(store) {
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    getAllFromIndex(index, value) {
        return new Promise((resolve, reject) => {
            const request = index.getAll(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Export database as JSON
     */
    async exportData() {
        const listings = await this.getListings();
        const metadata = await this.getSyncMetadata();

        return {
            version: this.version,
            exportDate: new Date().toISOString(),
            listings: listings,
            metadata: metadata,
            stats: await this.getStats()
        };
    }

    /**
     * Import data from JSON
     */
    async importData(jsonData) {
        if (!jsonData.listings || !Array.isArray(jsonData.listings)) {
            throw new Error('Invalid import data format');
        }

        await this.clearDatabase();
        const savedCount = await this.saveListings(jsonData.listings);

        console.log(`Imported ${savedCount} listings`);
        return savedCount;
    }
}

// Create global instance
const optimizedDB = new OptimizedListingDatabase();

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.OptimizedListingDB = optimizedDB;
}

// For module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OptimizedListingDatabase;
}