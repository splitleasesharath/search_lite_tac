/**
 * Local Database Manager for Split Lease
 * Uses IndexedDB for local storage with Bubble API sync
 */

class SplitLeaseDatabase {
    constructor() {
        this.dbName = 'SplitLeaseDB';
        this.version = 1;
        this.db = null;
        this.syncInterval = 5 * 60 * 1000; // 5 minutes default
        this.lastSync = null;
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
                console.log('Database opened successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object stores (tables)
                this.createObjectStores(db);
            };
        });
    }

    /**
     * Create object stores (database tables)
     */
    createObjectStores(db) {
        // Listings store - main property data
        if (!db.objectStoreNames.contains('listings')) {
            const listingsStore = db.createObjectStore('listings', {
                keyPath: 'id'
            });

            // Create indexes for searching/filtering
            listingsStore.createIndex('borough', 'borough', { unique: false });
            listingsStore.createIndex('neighborhood', 'neighborhood', { unique: false });
            listingsStore.createIndex('priceStarting', 'priceStarting', { unique: false });
            listingsStore.createIndex('priceFull', 'priceFull', { unique: false });
            listingsStore.createIndex('bedrooms', 'bedrooms', { unique: false });
            listingsStore.createIndex('weekPattern', 'weekPattern', { unique: false });
            listingsStore.createIndex('isActive', 'isActive', { unique: false });
            listingsStore.createIndex('createdDate', 'createdDate', { unique: false });
            listingsStore.createIndex('lastModified', 'lastModified', { unique: false });
        }

        // Hosts store - host/owner information
        if (!db.objectStoreNames.contains('hosts')) {
            const hostsStore = db.createObjectStore('hosts', {
                keyPath: 'id'
            });

            hostsStore.createIndex('email', 'email', { unique: true });
            hostsStore.createIndex('isVerified', 'isVerified', { unique: false });
        }

        // Images store - listing images
        if (!db.objectStoreNames.contains('images')) {
            const imagesStore = db.createObjectStore('images', {
                keyPath: 'id',
                autoIncrement: true
            });

            imagesStore.createIndex('listingId', 'listingId', { unique: false });
            imagesStore.createIndex('order', 'order', { unique: false });
        }

        // Sync metadata store
        if (!db.objectStoreNames.contains('sync_meta')) {
            const syncStore = db.createObjectStore('sync_meta', {
                keyPath: 'key'
            });
        }
    }

    /**
     * Save listings to local database
     */
    async saveListings(listings) {
        const transaction = this.db.transaction(['listings'], 'readwrite');
        const store = transaction.objectStore('listings');

        const promises = listings.map(listing => {
            // Ensure required fields
            const processedListing = {
                id: listing._id || listing.id || `temp_${Date.now()}_${Math.random()}`,
                title: listing.title || listing.property_name || 'Untitled',
                description: listing.description || '',

                // Location fields
                borough: listing.borough || 'Manhattan',
                neighborhood: listing.neighborhood || '',
                address: listing.address || '',
                latitude: listing.latitude || 40.7128,
                longitude: listing.longitude || -74.0060,

                // Pricing fields (ensure numbers)
                priceStarting: parseFloat(listing.price_starting || listing.nightly_rate_7_nights || 0),
                priceFull: parseFloat(listing.price_full || listing.nightly_rate_2_nights || 0),
                weeklyRate: parseFloat(listing.weekly_rate || 0),
                monthlyRate: parseFloat(listing.monthly_rate || 0),

                // Property details
                propertyType: listing.property_type || 'Entire Place',
                bedrooms: parseInt(listing.bedrooms || 0),
                bathrooms: parseFloat(listing.bathrooms || 1),
                squareFeet: parseInt(listing.square_feet || 0),
                maxGuests: parseInt(listing.max_guests || listing.guest_capacity || 2),

                // Amenities
                hasKitchen: listing.has_kitchen || true,
                kitchenType: listing.kitchen_type || 'Full Kitchen',
                hasWifi: listing.has_wifi !== false,
                hasParking: listing.has_parking || false,
                hasLaundry: listing.has_laundry || false,

                // Availability
                weekPattern: listing.week_pattern || 'every_week',
                availableFrom: listing.available_from || new Date().toISOString(),
                availableTo: listing.available_to || null,
                minimumStay: parseInt(listing.minimum_stay || 7),

                // Host information
                hostId: listing.host_id || listing.host || null,
                hostName: listing.host_name || 'Host',
                hostImage: listing.host_image || null,
                hostVerified: listing.host_verified || false,

                // Status
                isActive: listing.is_active !== false,
                isNew: listing.is_new || false,

                // Dates
                createdDate: listing.created_date || listing.Created_Date || new Date().toISOString(),
                lastModified: listing.modified_date || listing.Modified_Date || new Date().toISOString(),
                lastSynced: new Date().toISOString(),

                // Original Bubble data (for reference)
                _bubbleData: listing
            };

            return store.put(processedListing);
        });

        await transaction.complete;
        console.log(`Saved ${listings.length} listings to local database`);
    }

    /**
     * Save images to local database
     */
    async saveImages(listingId, imageUrls) {
        const transaction = this.db.transaction(['images'], 'readwrite');
        const store = transaction.objectStore('images');

        // Delete existing images for this listing
        const index = store.index('listingId');
        const existingImages = await index.getAllKeys(listingId);
        for (const key of existingImages) {
            await store.delete(key);
        }

        // Add new images
        const promises = imageUrls.map((url, index) => {
            return store.add({
                listingId: listingId,
                url: url,
                order: index,
                cached: false // Could implement image caching later
            });
        });

        await Promise.all(promises);
    }

    /**
     * Get all listings from local database
     */
    async getListings(filters = {}) {
        const transaction = this.db.transaction(['listings', 'images'], 'readonly');
        const listingsStore = transaction.objectStore('listings');
        const imagesStore = transaction.objectStore('images');

        let listings = [];

        // Apply filters if provided
        if (filters.borough) {
            const index = listingsStore.index('borough');
            listings = await index.getAll(filters.borough);
        } else {
            listings = await listingsStore.getAll();
        }

        // Filter further if needed
        if (filters.minPrice) {
            listings = listings.filter(l => l.priceStarting >= filters.minPrice);
        }
        if (filters.maxPrice) {
            listings = listings.filter(l => l.priceStarting <= filters.maxPrice);
        }
        if (filters.bedrooms) {
            listings = listings.filter(l => l.bedrooms >= filters.bedrooms);
        }
        if (filters.weekPattern) {
            listings = listings.filter(l => l.weekPattern === filters.weekPattern);
        }

        // Attach images to each listing
        for (const listing of listings) {
            const imageIndex = imagesStore.index('listingId');
            const images = await imageIndex.getAll(listing.id);
            listing.images = images.sort((a, b) => a.order - b.order).map(img => img.url);
        }

        // Sort results
        if (filters.sortBy) {
            switch (filters.sortBy) {
                case 'price-low':
                    listings.sort((a, b) => a.priceStarting - b.priceStarting);
                    break;
                case 'price-high':
                    listings.sort((a, b) => b.priceStarting - a.priceStarting);
                    break;
                case 'recent':
                    listings.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
                    break;
                case 'bedrooms':
                    listings.sort((a, b) => b.bedrooms - a.bedrooms);
                    break;
            }
        }

        return listings;
    }

    /**
     * Sync with Bubble API
     */
    async syncWithBubble() {
        try {
            console.log('Starting sync with Bubble API...');

            // Record sync start time
            const syncStartTime = new Date().toISOString();

            // Fetch from Bubble API (implement your actual API call here)
            // For now, using a placeholder
            const response = await fetch(`https://upgradefromstr.bubbleapps.io/version-test/api/1.1/obj/listing?limit=100`, {
                headers: {
                    'Authorization': 'Bearer 05a7a0d1d2400a0b574acd99748e07a0',
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                const listings = data.response?.results || [];

                // Save to local database
                await this.saveListings(listings);

                // Update sync metadata
                await this.updateSyncMeta('lastSync', syncStartTime);
                await this.updateSyncMeta('lastSyncCount', listings.length);

                console.log(`Sync completed: ${listings.length} listings updated`);
                return { success: true, count: listings.length };
            } else {
                throw new Error(`API returned ${response.status}`);
            }
        } catch (error) {
            console.error('Sync error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update sync metadata
     */
    async updateSyncMeta(key, value) {
        const transaction = this.db.transaction(['sync_meta'], 'readwrite');
        const store = transaction.objectStore('sync_meta');
        await store.put({ key, value, timestamp: new Date().toISOString() });
    }

    /**
     * Get sync metadata
     */
    async getSyncMeta(key) {
        const transaction = this.db.transaction(['sync_meta'], 'readonly');
        const store = transaction.objectStore('sync_meta');
        const result = await store.get(key);
        return result?.value;
    }

    /**
     * Start automatic sync
     */
    startAutoSync(intervalMinutes = 5) {
        this.syncInterval = intervalMinutes * 60 * 1000;

        // Initial sync
        this.syncWithBubble();

        // Schedule periodic syncs
        setInterval(() => {
            this.syncWithBubble();
        }, this.syncInterval);

        console.log(`Auto-sync started: every ${intervalMinutes} minutes`);
    }

    /**
     * Clear all data
     */
    async clearDatabase() {
        const objectStoreNames = ['listings', 'hosts', 'images', 'sync_meta'];

        for (const storeName of objectStoreNames) {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            await store.clear();
        }

        console.log('Database cleared');
    }

    /**
     * Export data as JSON
     */
    async exportData() {
        const listings = await this.getListings();
        const syncMeta = {
            lastSync: await this.getSyncMeta('lastSync'),
            lastSyncCount: await this.getSyncMeta('lastSyncCount')
        };

        return {
            listings,
            syncMeta,
            exportDate: new Date().toISOString()
        };
    }

    /**
     * Import data from JSON
     */
    async importData(jsonData) {
        if (jsonData.listings) {
            await this.saveListings(jsonData.listings);
        }

        console.log(`Imported ${jsonData.listings?.length || 0} listings`);
    }
}

// Initialize database on page load
const splitLeaseDB = new SplitLeaseDatabase();

// Export for use in other scripts
window.SplitLeaseDB = splitLeaseDB;