/**
 * Pricing Display Utilities for Split Lease
 * Functions for enhanced pricing calculations and display with clear labeling
 */

/**
 * Render enhanced pricing HTML with clear primary/secondary hierarchy
 * Shows dynamic price based on selected days with proper labeling
 *
 * @param {Object} listing - Listing object with pricing fields
 * @param {number} selectedDaysCount - Number of days selected (from schedule selector)
 * @returns {string} HTML string for enhanced pricing display
 */
function renderEnhancedPricing(listing, selectedDaysCount) {
    const nightsCount = Math.max(selectedDaysCount - 1, 1); // n days = (n-1) nights, minimum 1 night

    // Calculate dynamic price for selected duration
    const dynamicPrice = calculateDynamicPrice(listing, selectedDaysCount);

    // Get base starting price for comparison
    const startingPrice = parseFloat(listing['Starting nightly price'] || listing.price?.starting || 0);

    // Determine if we should show "normally from" text (only if prices differ significantly)
    const showNormalPrice = startingPrice > 0 && Math.abs(dynamicPrice - startingPrice) > 1;

    let html = '<div class="pricing-info-enhanced">';

    // Primary price (large, bold, prominent)
    html += `
        <div class="primary-price">
            <div class="price-label">Your Selection (${nightsCount} night${nightsCount > 1 ? 's' : ''})</div>
            <div class="price-amount">$${dynamicPrice.toFixed(2)}<span class="price-unit">/night</span></div>
        </div>
    `;

    // Secondary price (smaller, gray, only if different from primary)
    if (showNormalPrice) {
        html += `
            <div class="secondary-price">
                Normally from $${startingPrice.toFixed(2)}/night
            </div>
        `;
    }

    // Pricing details button (opens breakdown modal)
    html += `
        <button class="pricing-details-btn" onclick="window.PricingDisplay.showPricingBreakdown('${listing.id}')" aria-label="View pricing details">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4M12 8h.01"></path>
            </svg>
            Details
        </button>
    `;

    html += '</div>';

    return html;
}

/**
 * Calculate dynamic price based on selected days count
 * Reuses existing calculateDynamicPrice function from app.js
 *
 * @param {Object} listing - Listing object with pricing fields
 * @param {number} selectedDaysCount - Number of days selected
 * @returns {number} Calculated per-night price
 */
function calculateDynamicPrice(listing, selectedDaysCount) {
    const nightsCount = Math.max(selectedDaysCount - 1, 1);

    // Price field mapping for different night counts
    const priceFieldMap = {
        2: 'Price 2 nights selected',
        3: 'Price 3 nights selected',
        4: 'Price 4 nights selected',
        5: 'Price 5 nights selected',
        6: 'Price 6 nights selected',
        7: 'Price 7 nights selected'
    };

    // Try to get specific price for this night count
    if (nightsCount >= 2 && nightsCount <= 7) {
        const fieldName = priceFieldMap[nightsCount];
        const price = listing[fieldName];

        // Return if we have a valid price (> 0)
        if (price && price > 0) {
            return parseFloat(price);
        }

        // Fallback: Try emoji field names (database uses both formats)
        const emojiFieldName = `💰Nightly Host Rate for ${nightsCount} nights`;
        const emojiPrice = listing[emojiFieldName];
        if (emojiPrice && emojiPrice > 0) {
            return parseFloat(emojiPrice);
        }

        // If zero or missing, try interpolation
        const interpolatedPrice = interpolatePricing(listing, nightsCount);
        if (interpolatedPrice > 0) {
            return interpolatedPrice;
        }
    }

    // Final fallback: Use starting price
    const startingPrice = listing['Starting nightly price'] || listing.price?.starting || 0;
    return parseFloat(startingPrice) || 0;
}

/**
 * Interpolate pricing for missing night counts
 * Uses linear interpolation between available prices
 *
 * @param {Object} listing - Listing object with pricing fields
 * @param {number} targetNights - Number of nights to interpolate price for
 * @returns {number} Interpolated price or 0 if unable to interpolate
 */
function interpolatePricing(listing, targetNights) {
    // Collect all available prices
    const availablePrices = [];

    for (let nights = 2; nights <= 7; nights++) {
        const fieldName = `Price ${nights} nights selected`;
        const emojiFieldName = `💰Nightly Host Rate for ${nights} nights`;

        const price = listing[fieldName] || listing[emojiFieldName];
        if (price && price > 0) {
            availablePrices.push({ nights, price: parseFloat(price) });
        }
    }

    // Need at least 2 data points to interpolate
    if (availablePrices.length < 2) {
        return 0;
    }

    // Find closest lower and higher night counts
    const lowerPrice = availablePrices.filter(p => p.nights < targetNights).sort((a, b) => b.nights - a.nights)[0];
    const higherPrice = availablePrices.filter(p => p.nights > targetNights).sort((a, b) => a.nights - b.nights)[0];

    if (!lowerPrice || !higherPrice) {
        // Use closest available price if we can't bracket
        const closest = availablePrices.sort((a, b) => Math.abs(a.nights - targetNights) - Math.abs(b.nights - targetNights))[0];
        return closest.price;
    }

    // Linear interpolation
    const nightsRange = higherPrice.nights - lowerPrice.nights;
    const priceRange = higherPrice.price - lowerPrice.price;
    const interpolatedPrice = lowerPrice.price + ((targetNights - lowerPrice.nights) / nightsRange) * priceRange;

    return interpolatedPrice;
}

/**
 * Show detailed pricing breakdown modal
 * Displays all available pricing tiers (2-7 nights)
 *
 * @param {string} listingId - Listing ID to show pricing for
 */
function showPricingBreakdown(listingId) {
    // Find listing
    const listing = window.currentListings ? window.currentListings.find(l => l.id === listingId) : null;
    if (!listing) {
        console.error('Listing not found:', listingId);
        return;
    }

    // Collect all available pricing tiers
    const pricingTiers = [];

    for (let nights = 2; nights <= 7; nights++) {
        const fieldName = `Price ${nights} nights selected`;
        const emojiFieldName = `💰Nightly Host Rate for ${nights} nights`;

        const price = listing[fieldName] || listing[emojiFieldName];
        if (price && price > 0) {
            const totalPrice = parseFloat(price) * nights;
            pricingTiers.push({
                nights,
                perNightPrice: parseFloat(price),
                totalPrice: totalPrice
            });
        }
    }

    if (pricingTiers.length === 0) {
        alert('Pricing information not available. Please contact host for rates.');
        return;
    }

    // Build modal HTML
    const modalHtml = `
        <div class="pricing-modal-overlay" onclick="this.remove()">
            <div class="pricing-modal" onclick="event.stopPropagation()">
                <div class="pricing-modal-header">
                    <h3>Pricing Breakdown</h3>
                    <button class="pricing-modal-close" onclick="this.closest('.pricing-modal-overlay').remove()">&times;</button>
                </div>
                <div class="pricing-modal-body">
                    <div class="listing-title">${listing.title || listing.Name}</div>
                    <div class="listing-location-modal">${listing.location || listing['Location - Hood'] || 'New York'}</div>

                    <table class="pricing-table">
                        <thead>
                            <tr>
                                <th>Duration</th>
                                <th>Per Night</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pricingTiers.map(tier => `
                                <tr>
                                    <td>${tier.nights} night${tier.nights > 1 ? 's' : ''}</td>
                                    <td>$${tier.perNightPrice.toFixed(2)}</td>
                                    <td><strong>$${tier.totalPrice.toFixed(2)}</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="pricing-note">
                        Prices shown are per-night rates. Longer stays typically offer better value.
                    </div>
                </div>
                <div class="pricing-modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.pricing-modal-overlay').remove()">Close</button>
                    <button class="btn-primary" onclick="window.openContactHostModal('${listingId}')">Contact Host</button>
                </div>
            </div>
        </div>
    `;

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

/**
 * Get price for specific number of nights
 * Helper function used by other modules
 *
 * @param {Object} listing - Listing object with pricing fields
 * @param {number} nights - Number of nights
 * @returns {number} Price per night or 0 if not available
 */
function getPriceForNights(listing, nights) {
    if (nights < 2 || nights > 7) {
        return listing['Starting nightly price'] || listing.price?.starting || 0;
    }

    const fieldName = `Price ${nights} nights selected`;
    const emojiFieldName = `💰Nightly Host Rate for ${nights} nights`;

    const price = listing[fieldName] || listing[emojiFieldName];
    return price && price > 0 ? parseFloat(price) : 0;
}

// Export functions for global use
window.PricingDisplay = {
    renderEnhancedPricing,
    calculateDynamicPrice,
    showPricingBreakdown,
    getPriceForNights,
    interpolatePricing
};

console.log('✅ Pricing display utilities loaded');
