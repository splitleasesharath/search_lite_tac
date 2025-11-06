/**
 * Schedule Selector Integration Script
 *
 * This script bridges the React Schedule Selector component with the existing
 * vanilla JavaScript application. It mounts the component and wires up callbacks
 * to integrate with the app's day selection logic.
 */

(function() {
    'use strict';

    console.log('🔗 Loading Schedule Selector integration...');

    /**
     * Initialize the Schedule Selector React component
     */
    function initScheduleSelector() {
        // Check if the mount function is available
        if (typeof window.ScheduleSelector === 'undefined' ||
            typeof window.ScheduleSelector.mount !== 'function') {
            console.error('❌ Schedule Selector mount function not found. Make sure the component script is loaded.');
            return;
        }

        console.log('✅ Schedule Selector mount function found');

        // Get initial selection from the global selectedDays array
        // app.js uses: let selectedDays = [1, 2, 3, 4, 5]; // Monday-Friday
        const initialSelection = window.selectedDays || [1, 2, 3, 4, 5];

        console.log(`📅 Initial selection: [${initialSelection.join(', ')}]`);

        // Mount the component with callbacks
        const root = window.ScheduleSelector.mount('schedule-selector-root', {
            initialSelection: initialSelection,
            minDays: 2,
            maxDays: 5,
            requireContiguous: true,

            // Callback fired when selection changes
            onSelectionChange: (selectedDaysArray) => {
                console.log('🔄 Selection changed:', selectedDaysArray);

                // Update the global selectedDays array
                // Normalize: deduplicate, validate 0-6, and sort ascending
                const normalizedSelected = [...new Set(selectedDaysArray.map(d => d.index))]
                    .filter(i => Number.isInteger(i) && i >= 0 && i <= 6)
                    .sort((a, b) => a - b);
                window.selectedDays = normalizedSelected.length > 0 ? normalizedSelected : [];

                console.log(`✅ Updated selectedDays: [${window.selectedDays.join(', ')}]`);

                // Call existing app.js functions to update the UI
                if (typeof window.updateAllDisplayedPrices === 'function') {
                    window.updateAllDisplayedPrices();
                }

                if (typeof window.applyFilters === 'function') {
                    window.applyFilters();
                }

                // Update check-in/check-out display if function exists
                if (typeof window.updateCheckinCheckout === 'function') {
                    window.updateCheckinCheckout();
                }
            },

            // Callback fired when validation error occurs
            onError: (errorMessage) => {
                console.warn('⚠️ Schedule selector validation error:', errorMessage);
                // The component already displays the error, so we just log it
            }
        });

        if (root) {
            console.log('✅ Schedule Selector mounted successfully');
        } else {
            console.error('❌ Failed to mount Schedule Selector');
        }
    }

    /**
     * Wait for dependencies to load, then initialize
     */
    function init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', checkAndInit);
        } else {
            checkAndInit();
        }
    }

    /**
     * Check if all dependencies are loaded
     */
    let checkAttempts = 0;
    const MAX_CHECK_ATTEMPTS = 50; // 5 seconds max (50 * 100ms)

    function checkAndInit() {
        console.log('🔍 Checking Schedule Selector dependencies...');

        // Increment attempt counter
        checkAttempts++;

        // Check for timeout
        if (checkAttempts > MAX_CHECK_ATTEMPTS) {
            console.error('❌ Schedule Selector failed to load after 5 seconds');
            console.error('💡 Possible causes:');
            console.error('   - CORS policy blocking ES module loading (use HTTP server instead of file://)');
            console.error('   - Component script not built (run: npm run build:components)');
            console.error('   - Script path incorrect in index.html');
            console.error('   - Build errors (process.env not defined, etc.)');
            console.error('   - Missing dependencies (React, ReactDOM, styled-components, framer-motion)');
            console.error('⚠️ Schedule Selector component failed to load. Check build configuration.');
            return;
        }

        // Check if React is loaded
        if (typeof React === 'undefined') {
            console.log('⏳ Waiting for React to load...');
            setTimeout(checkAndInit, 100);
            return;
        }
        console.log('✅ React loaded');

        // Check if ReactDOM is loaded
        if (typeof ReactDOM === 'undefined') {
            console.log('⏳ Waiting for ReactDOM to load...');
            setTimeout(checkAndInit, 100);
            return;
        }
        console.log('✅ ReactDOM loaded');

        // Check if Styled Components is loaded
        if (typeof styled === 'undefined') {
            console.warn('⚠️ Styled Components may not be loaded');
        } else {
            console.log('✅ Styled Components loaded');
        }

        // Check if Framer Motion is loaded
        if (typeof FramerMotion === 'undefined' && typeof window.FramerMotion === 'undefined') {
            console.warn('⚠️ Framer Motion may not be loaded (this is normal for bundled builds)');
        } else {
            console.log('✅ Framer Motion loaded');
        }

        // Check if the component script is loaded
        // If not loaded yet, wait a bit and retry
        if (typeof window.ScheduleSelector === 'undefined') {
            console.log(`⏳ Waiting for Schedule Selector component to load... (attempt ${checkAttempts}/${MAX_CHECK_ATTEMPTS})`);
            setTimeout(checkAndInit, 100);
            return;
        }

        // All dependencies loaded, initialize the component
        initScheduleSelector();
    }

    // Start initialization
    init();
})();
