/**
 * Informational Text Component - Modular Version
 *
 * Usage:
 * 1. Include React, ReactDOM, Babel, and Tailwind CDN in your HTML
 * 2. Include this file: <script src="informational-text.js"></script>
 * 3. Call initInformationalText(config) with your configuration
 *
 * Example:
 * <script>
 *   initInformationalText({
 *     supabaseUrl: 'https://your-project.supabase.co',
 *     supabaseKey: 'your-anon-key',
 *     tableName: 'informationaltexts',
 *     triggers: [
 *       { id: 'trigger-1', infoId: '1234567890x123456789' },
 *       { id: 'trigger-2', infoId: '0987654321x987654321' }
 *     ]
 *   });
 * </script>
 */

// Supabase configuration (will be set by initInformationalText)
let SUPABASE_CONFIG = {
    url: '',
    key: '',
    tableName: 'informationaltexts'
};

// Trigger mappings (will be set by initInformationalText)
let TRIGGER_MAPPINGS = [];

/**
 * Fetch informational text from Supabase database by _id
 */
async function fetchInformationalText(id) {
    try {
        const url = `${SUPABASE_CONFIG.url}/rest/v1/${SUPABASE_CONFIG.tableName}?_id=eq.${encodeURIComponent(id)}&select=*`;

        console.log('🔍 Fetching from URL:', url);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_CONFIG.key,
                'Authorization': `Bearer ${SUPABASE_CONFIG.key}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        });

        console.log('📡 Response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ API error:', errorData);
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('📦 Data received:', data);
        console.log('📊 Number of results:', data.length);

        if (data && data.length > 0) {
            console.log('✅ Found record:', data[0]);
            return data[0];
        }

        console.warn(`⚠️ No informational text found for _id: ${id}`);
        return null;
    } catch (error) {
        console.error('💥 Error fetching informational text:', error);
        return null;
    }
}

/**
 * Initialize informational text triggers
 */
function setupTriggers() {
    const attachTriggers = function() {
        const triggers = document.querySelectorAll('.info-trigger');

        triggers.forEach(trigger => {
            // Check if already has event listener to avoid duplicates
            if (trigger.hasAttribute('data-info-listener')) {
                return;
            }
            trigger.setAttribute('data-info-listener', 'true');

            const handleTrigger = async function(e) {
                e.preventDefault();
                e.stopPropagation();

                const triggerId = this.id;

                // Find the mapping for this trigger
                const mapping = TRIGGER_MAPPINGS.find(m => m.id === triggerId);
                if (!mapping || !mapping.infoId) {
                    console.warn(`No mapping found for trigger: ${triggerId}`);
                    return;
                }

                // Show loading state
                if (window.showInfoText) {
                    window.showInfoText(triggerId, "Loading...", "Fetching information from database...", "");
                }

                // Fetch from Supabase database
                const infoData = await fetchInformationalText(mapping.infoId);

                if (infoData) {
                    // Use data from Supabase with correct field names
                    const title = infoData['Information Tag-Title'] || infoData.title || 'Information';
                    const content = infoData['Desktop copy'] || infoData.content || 'Content not available';
                    const expandedContent = infoData['Desktop+ copy'] || infoData.expanded_content || infoData['Expanded Content'] || '';

                    console.log('Loaded from Supabase:', { title, content, expandedContent });
                    console.log('Raw data from Supabase:', infoData);

                    // Show the informational text with Supabase data
                    if (window.showInfoText) {
                        window.showInfoText(triggerId, title, content, expandedContent);
                    }
                } else {
                    // Fallback content if API fails
                    if (window.showInfoText) {
                        window.showInfoText(
                            triggerId,
                            "Error Loading Content",
                            "Unable to load informational text from the database. Please try again later.",
                            ""
                        );
                    }
                }
            };

            // Add click event listener
            trigger.addEventListener('click', handleTrigger);

            // Add keyboard event listener for accessibility
            trigger.addEventListener('keydown', function(e) {
                // Trigger on Enter or Space key
                if (e.key === 'Enter' || e.key === ' ') {
                    handleTrigger.call(this, e);
                }
            });
        });
    };

    // Attach immediately if DOM is already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachTriggers);
    } else {
        attachTriggers();
    }

    // Make attachTriggers available globally for dynamic content
    window.attachInfoTriggers = attachTriggers;
}

/**
 * Initialize the Informational Text component
 *
 * @param {Object} config - Configuration object
 * @param {string} config.supabaseUrl - Supabase project URL
 * @param {string} config.supabaseKey - Supabase anon key
 * @param {string} [config.tableName='informationaltexts'] - Table name in Supabase
 * @param {Array} config.triggers - Array of trigger mappings
 * @param {string} config.triggers[].id - Trigger element ID
 * @param {string} config.triggers[].infoId - Supabase record _id
 * @param {string} [config.containerElementId='info-text-root'] - Container element ID for React component
 */
function initInformationalText(config) {
    if (!config) {
        console.error('❌ Configuration is required');
        return;
    }

    if (!config.supabaseUrl || !config.supabaseKey) {
        console.error('❌ Supabase URL and API key are required');
        return;
    }

    if (!config.triggers || !Array.isArray(config.triggers) || config.triggers.length === 0) {
        console.error('❌ At least one trigger mapping is required');
        return;
    }

    // Set global configuration
    SUPABASE_CONFIG = {
        url: config.supabaseUrl,
        key: config.supabaseKey,
        tableName: config.tableName || 'informationaltexts'
    };

    TRIGGER_MAPPINGS = config.triggers;

    // Make TRIGGER_MAPPINGS accessible globally for dynamic updates
    window.TRIGGER_MAPPINGS = TRIGGER_MAPPINGS;

    // Setup triggers
    setupTriggers();

    console.log('✅ Informational Text component initialized');
    console.log('📋 Configuration:', {
        url: SUPABASE_CONFIG.url,
        tableName: SUPABASE_CONFIG.tableName,
        triggerCount: TRIGGER_MAPPINGS.length
    });
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initInformationalText };
}

// Make available globally
window.initInformationalText = initInformationalText;
