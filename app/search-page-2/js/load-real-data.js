/**
 * Load Real Database Data from SQLite Export
 * This loads the actual 68 listings from the Python sync
 */

async function loadRealDatabaseData() {
    console.log('🔄 Loading real database data from SQLite export...');

    try {
        // Initialize the optimized database
        const db = new OptimizedListingDatabase();
        await db.init();

        // Clear any existing data to ensure fresh unique images
        await db.clearDatabase();
        console.log('🗑️ Cleared database to generate fresh unique images for each listing');

        // Check if we can access the exported JSON (might fail due to CORS)
        let realListings = null;

        try {
            const response = await fetch('./split_lease_listings.json');
            if (response.ok) {
                const exportData = await response.json();
                realListings = exportData.listings;
                console.log(`📊 Found ${realListings.length} listings in JSON export`);
            }
        } catch (error) {
            console.log('ℹ️ Cannot load JSON export due to CORS, using API sync...');
        }

        // If we can't load from JSON, sync from API directly
        if (!realListings || realListings.length === 0) {
            console.log('🔄 Syncing directly from listingoptimized API...');
            const syncResult = await db.syncWithAPI();

            if (syncResult.success) {
                console.log(`✅ Synced ${syncResult.count} listings from API`);
                return syncResult.count;
            } else {
                throw new Error('Failed to sync from API: ' + syncResult.error);
            }
        }

        // Load the real data from JSON export
        const savedCount = await db.saveListings(realListings);
        console.log(`✅ Loaded ${savedCount} real listings into IndexedDB`);

        // Update metadata
        await db.updateSyncMetadata({
            lastSync: new Date().toISOString(),
            totalListings: savedCount,
            syncDuration: 0,
            dataSource: 'json_export'
        });

        return savedCount;
    } catch (error) {
        console.error('❌ Failed to load real database data:', error);

        // Fallback to sample data if real data fails
        console.log('⚠️ Falling back to sample data...');
        return await loadSampleData();
    }
}

async function loadSampleData() {
    // Enhanced sample data with more listings and proper images
    const enhancedSampleListings = [
        {
            "_id": "sample1",
            "Listing name": "Modern Manhattan Studio",
            "Borough": "Manhattan",
            "Neighborhood": "East Village",
            "Type of space": "Entire Place",
            "Qty of bedrooms": 0,
            "Qty of bathrooms": 1,
            "Qty of guests allowed": 2,
            "Kitchen type": "Full Kitchen",
            "Starting nightly price": 275,
            "Price 7 nights selected": 220,
            "Weeks offered": "Every week",
            "Days Available": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            "Host Name": "Sarah M.",
            "Host Pricture": "https://50bf0464e4735aabad1cc8848a0e8b8a.cdn.bubble.io/f1728409086161x522086459925635800/Robert.PNG",
            "Created Date": "2025-01-15T10:00:00.000Z",
            "Modified Date": "2025-01-20T15:30:00.000Z"
        },
        {
            "_id": "sample2",
            "Listing name": "Brooklyn Heights Loft",
            "Borough": "Brooklyn",
            "Neighborhood": "Brooklyn Heights",
            "Type of space": "Entire Place",
            "Qty of bedrooms": 1,
            "Qty of bathrooms": 1,
            "Qty of guests allowed": 3,
            "Kitchen type": "Full Kitchen",
            "Starting nightly price": 195,
            "Price 7 nights selected": 145,
            "Weeks offered": "Every week",
            "Days Available": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
            "Host Name": "Michael R.",
            "Host Pricture": "https://50bf0464e4735aabad1cc8848a0e8b8a.cdn.bubble.io/f1728409100287x106329658851495860/herbert.PNG",
            "Created Date": "2025-01-10T08:00:00.000Z",
            "Modified Date": "2025-01-18T12:45:00.000Z"
        },
        {
            "_id": "sample3",
            "Listing name": "Cozy Queens Room",
            "Borough": "Queens",
            "Neighborhood": "Astoria",
            "Type of space": "Private Room",
            "Qty of bedrooms": 1,
            "Qty of bathrooms": 1,
            "Qty of guests allowed": 1,
            "Kitchen type": "Shared Kitchen",
            "Starting nightly price": 125,
            "Price 7 nights selected": 100,
            "Weeks offered": "One week on, one week off",
            "Days Available": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            "Host Name": "Jennifer L.",
            "Host Pricture": "https://50bf0464e4735aabad1cc8848a0e8b8a.cdn.bubble.io/f1728409115104x181161173223309760/arthur.PNG",
            "Created Date": "2025-01-12T14:00:00.000Z",
            "Modified Date": "2025-01-22T09:15:00.000Z"
        },
        {
            "_id": "sample4",
            "Listing name": "Midtown Executive Suite",
            "Borough": "Manhattan",
            "Neighborhood": "Midtown",
            "Type of space": "Entire Place",
            "Qty of bedrooms": 1,
            "Qty of bathrooms": 1,
            "Qty of guests allowed": 2,
            "Kitchen type": "Kitchenette",
            "Starting nightly price": 350,
            "Price 7 nights selected": 300,
            "Weeks offered": "Every week",
            "Days Available": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            "Host Name": "David K.",
            "Host Pricture": "https://50bf0464e4735aabad1cc8848a0e8b8a.cdn.bubble.io/f1728409141343x409613303206629500/julia.PNG",
            "Created Date": "2025-01-08T16:00:00.000Z",
            "Modified Date": "2025-01-20T10:30:00.000Z"
        },
        {
            "_id": "sample5",
            "Listing name": "Williamsburg Artist Loft",
            "Borough": "Brooklyn",
            "Neighborhood": "Williamsburg",
            "Type of space": "Entire Place",
            "Qty of bedrooms": 2,
            "Qty of bathrooms": 2,
            "Qty of guests allowed": 4,
            "Kitchen type": "Full Kitchen",
            "Starting nightly price": 285,
            "Price 7 nights selected": 240,
            "Weeks offered": "Two weeks on, two weeks off",
            "Days Available": ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
            "Host Name": "Emma S.",
            "Host Pricture": "https://50bf0464e4735aabad1cc8848a0e8b8a.cdn.bubble.io/f1728409157968x114901798371225990/samuel.PNG",
            "Created Date": "2025-01-05T09:00:00.000Z",
            "Modified Date": "2025-01-19T14:20:00.000Z"
        },
        {
            "_id": "sample6",
            "Listing name": "Financial District Studio",
            "Borough": "Manhattan",
            "Neighborhood": "Financial District",
            "Type of space": "Entire Place",
            "Qty of bedrooms": 0,
            "Qty of bathrooms": 1,
            "Qty of guests allowed": 2,
            "Kitchen type": "Full Kitchen",
            "Starting nightly price": 290,
            "Price 7 nights selected": 250,
            "Weeks offered": "Every week",
            "Days Available": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            "Host Name": "Alex T.",
            "Host Pricture": "https://50bf0464e4735aabad1cc8848a0e8b8a.cdn.bubble.io/f1728409172448x313002107074554900/selena.PNG",
            "Created Date": "2025-01-14T11:00:00.000Z",
            "Modified Date": "2025-01-21T16:45:00.000Z"
        }
    ];

    const db = new OptimizedListingDatabase();
    await db.init();
    const savedCount = await db.saveListings(enhancedSampleListings);

    await db.updateSyncMetadata({
        lastSync: new Date().toISOString(),
        totalListings: savedCount,
        syncDuration: 0,
        dataSource: 'enhanced_sample'
    });

    return savedCount;
}

// Export functions
if (typeof window !== 'undefined') {
    window.loadRealDatabaseData = loadRealDatabaseData;
    window.loadSampleData = loadSampleData;

    // Auto-load real data when script loads
    document.addEventListener('DOMContentLoaded', async () => {
        if (typeof OptimizedListingDatabase !== 'undefined') {
            // Small delay to ensure other scripts are loaded
            setTimeout(async () => {
                try {
                    const count = await loadRealDatabaseData();
                    console.log(`📊 Database loaded with ${count} listings`);
                } catch (error) {
                    console.warn('⚠️ Failed to load real data:', error);
                }
            }, 500);
        }
    });
}