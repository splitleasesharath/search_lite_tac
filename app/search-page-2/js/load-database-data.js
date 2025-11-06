/**
 * Database Data Loader
 * Loads data from the Python sync into IndexedDB
 */

// Function to load data into IndexedDB from the Python sync
async function loadDatabaseData() {
    console.log('🔄 Loading database data...');

    try {
        // Initialize the optimized database
        const db = new OptimizedListingDatabase();
        await db.init();

        // Sample data from our Python sync (you would replace this with actual data)
        const sampleListings = [
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
                "Price 2 nights selected": 260,
                "Price 3 nights selected": 250,
                "Price 4 nights selected": 240,
                "Price 5 nights selected": 230,
                "Price 7 nights selected": 220,
                "Weeks offered": "Every week",
                "Days Available": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                "Host Name": "Sarah M.",
                "Host Pricture": "",
                "Original Listing": "",
                "Created Date": "2025-01-15T10:00:00.000Z",
                "Modified Date": "2025-01-20T15:30:00.000Z",
                "Created By": "system"
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
                "Price 2 nights selected": 185,
                "Price 3 nights selected": 175,
                "Price 4 nights selected": 165,
                "Price 5 nights selected": 155,
                "Price 7 nights selected": 145,
                "Weeks offered": "Every week",
                "Days Available": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                "Host Name": "Michael R.",
                "Host Pricture": "",
                "Original Listing": "",
                "Created Date": "2025-01-10T08:00:00.000Z",
                "Modified Date": "2025-01-18T12:45:00.000Z",
                "Created By": "system"
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
                "Price 2 nights selected": 120,
                "Price 3 nights selected": 115,
                "Price 4 nights selected": 110,
                "Price 5 nights selected": 105,
                "Price 7 nights selected": 100,
                "Weeks offered": "One week on, one week off",
                "Days Available": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                "Host Name": "Jennifer L.",
                "Host Pricture": "",
                "Original Listing": "",
                "Created Date": "2025-01-12T14:00:00.000Z",
                "Modified Date": "2025-01-22T09:15:00.000Z",
                "Created By": "system"
            }
        ];

        // Save the sample data
        const savedCount = await db.saveListings(sampleListings);
        console.log(`✅ Loaded ${savedCount} sample listings into IndexedDB`);

        // Update metadata
        await db.updateSyncMetadata({
            lastSync: new Date().toISOString(),
            totalListings: savedCount,
            syncDuration: 0,
            dataSource: 'sample'
        });

        return true;
    } catch (error) {
        console.error('❌ Failed to load database data:', error);
        return false;
    }
}

// Auto-load data when script loads
if (typeof window !== 'undefined') {
    window.loadDatabaseData = loadDatabaseData;

    // Auto-load sample data if OptimizedListingDatabase is available
    document.addEventListener('DOMContentLoaded', async () => {
        if (typeof OptimizedListingDatabase !== 'undefined') {
            // Small delay to ensure other scripts are loaded
            setTimeout(async () => {
                try {
                    await loadDatabaseData();
                    console.log('📊 Sample database data loaded automatically');
                } catch (error) {
                    console.warn('⚠️ Failed to auto-load sample data:', error);
                }
            }, 1000);
        }
    });
}