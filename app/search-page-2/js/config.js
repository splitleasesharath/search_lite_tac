// Configuration with environment variables
// This file will be generated during build for production
// For local development, copy config.local.js.example to config.local.js

// IMPORTANT: If you see YOUR_API_KEY in production, the build script didn't run
// Make sure Cloudflare Pages is configured with:
// Build command: node build-cloudflare.js
// Environment variables: GOOGLE_MAPS_API_KEY, BUBBLE_API_KEY, BUBBLE_API_BASE_URL

// Only set defaults if ENV doesn't exist or has placeholder values
console.log('🔧 Loading config.js');
console.log('  window.ENV exists before:', !!window.ENV);
if (window.ENV) {
    console.log('  Current GOOGLE_MAPS_API_KEY:', window.ENV.GOOGLE_MAPS_API_KEY ? window.ENV.GOOGLE_MAPS_API_KEY.substring(0, 20) + '...' : 'NOT SET');
}

// Check if ENV doesn't exist or has placeholder values
if (!window.ENV || window.ENV.GOOGLE_MAPS_API_KEY === 'YOUR_API_KEY') {
    console.log('⚠️ window.ENV not found or has placeholders, using local API keys');
    window.ENV = {
        GOOGLE_MAPS_API_KEY: 'AIzaSyCFcO3jCTvR69iA4UAxPi-sWHJ7zWPMJWo',
        BUBBLE_API_KEY: '05a7a0d1d2400a0b574acd99748e07a0',
        BUBBLE_API_BASE_URL: 'https://upgradefromstr.bubbleapps.io/version-test/api/1.1',
        BUBBLE_MESSAGING_ENDPOINT: 'https://app.split.lease/api/1.1/wf/core-contact-host-send-message',
        SUPABASE_URL: 'https://qcfifybkaddcoimjroca.supabase.co',
        SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjZmlmeWJrYWRkY29pbWpyb2NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzU0MDUsImV4cCI6MjA3NTA1MTQwNX0.glGwHxds0PzVLF1Y8VBGX0jYz3zrLsgE9KAWWwkYms8',
        // AI Signup
        AI_SIGNUP_WORKFLOW_URL: 'https://app.split.lease/version-test/api/1.1/wf/ai-signup-guest',
        AI_SIGNUP_BUBBLE_KEY: '5dbb448f9a6bbb043cb56ac16b8de109',
        // Lottie Animation URLs
        HEADER_ICON_LOTTIE_URL: 'https://50bf0464e4735aabad1cc8848a0e8b8a.cdn.bubble.io/f1760473171600x280130752685858750/atom%20animation.json',
        PARSING_LOTTIE_URL: 'https://50bf0464e4735aabad1cc8848a0e8b8a.cdn.bubble.io/f1722533720265x199451206376484160/Animation%20-%201722533570126.json',
        LOADING_LOTTIE_URL: 'https://50bf0464e4735aabad1cc8848a0e8b8a.cdn.bubble.io/f1720724605167x733559911663532000/Animation%20-%201720724343172.lottie',
        SUCCESS_LOTTIE_URL: 'https://50bf0464e4735aabad1cc8848a0e8b8a.cdn.bubble.io/f1745939792891x394981453861459140/Report.json'
    };
} else {
    console.log('✅ window.ENV already exists with valid keys, not overwriting');
    // Ensure missing keys are set if not already
    if (!window.ENV.BUBBLE_MESSAGING_ENDPOINT) {
        window.ENV.BUBBLE_MESSAGING_ENDPOINT = 'https://app.split.lease/api/1.1/wf/core-contact-host-send-message';
    }
    if (!window.ENV.SUPABASE_URL) {
        window.ENV.SUPABASE_URL = 'https://qcfifybkaddcoimjroca.supabase.co';
    }
    if (!window.ENV.SUPABASE_ANON_KEY) {
        window.ENV.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjZmlmeWJrYWRkY29pbWpyb2NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzU0MDUsImV4cCI6MjA3NTA1MTQwNX0.glGwHxds0PzVLF1Y8VBGX0jYz3zrLsgE9KAWWwkYms8';
    }
    if (!window.ENV.AI_SIGNUP_WORKFLOW_URL) {
        window.ENV.AI_SIGNUP_WORKFLOW_URL = 'https://app.split.lease/version-test/api/1.1/wf/ai-signup-guest';
    }
    if (!window.ENV.AI_SIGNUP_BUBBLE_KEY) {
        window.ENV.AI_SIGNUP_BUBBLE_KEY = '5dbb448f9a6bbb043cb56ac16b8de109';
    }
    if (!window.ENV.HEADER_ICON_LOTTIE_URL) {
        window.ENV.HEADER_ICON_LOTTIE_URL = 'https://50bf0464e4735aabad1cc8848a0e8b8a.cdn.bubble.io/f1760473171600x280130752685858750/atom%20animation.json';
    }
    if (!window.ENV.PARSING_LOTTIE_URL) {
        window.ENV.PARSING_LOTTIE_URL = 'https://50bf0464e4735aabad1cc8848a0e8b8a.cdn.bubble.io/f1722533720265x199451206376484160/Animation%20-%201722533570126.json';
    }
    if (!window.ENV.LOADING_LOTTIE_URL) {
        window.ENV.LOADING_LOTTIE_URL = 'https://50bf0464e4735aabad1cc8848a0e8b8a.cdn.bubble.io/f1720724605167x733559911663532000/Animation%20-%201720724343172.lottie';
    }
    if (!window.ENV.SUCCESS_LOTTIE_URL) {
        window.ENV.SUCCESS_LOTTIE_URL = 'https://50bf0464e4735aabad1cc8848a0e8b8a.cdn.bubble.io/f1745939792891x394981453861459140/Report.json';
    }
}

console.log('  window.ENV exists after:', !!window.ENV);
console.log('  Final GOOGLE_MAPS_API_KEY:', window.ENV.GOOGLE_MAPS_API_KEY ? window.ENV.GOOGLE_MAPS_API_KEY.substring(0, 20) + '...' : 'NOT SET');
console.log('  BUBBLE_MESSAGING_ENDPOINT:', window.ENV.BUBBLE_MESSAGING_ENDPOINT ? window.ENV.BUBBLE_MESSAGING_ENDPOINT : 'NOT SET');
console.log('  SUPABASE_URL:', window.ENV.SUPABASE_URL ? window.ENV.SUPABASE_URL : 'NOT SET');
console.log('  SUPABASE_ANON_KEY:', window.ENV.SUPABASE_ANON_KEY ? window.ENV.SUPABASE_ANON_KEY.substring(0, 20) + '...' : 'NOT SET');
console.log('  Config loaded at:', new Date().toISOString());
// ============================================================
// Environment Detection
// ============================================================

window.ENV.ENVIRONMENT = (function() {
    // Check if running on localhost
    if (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '') {
        return 'development';
    }

    // Check for staging domain
    if (window.location.hostname.includes('staging') ||
        window.location.hostname.includes('test') ||
        window.location.hostname.includes('preview')) {
        return 'staging';
    }

    // Production
    return 'production';
})();

console.log('  Environment:', window.ENV.ENVIRONMENT);

// ============================================================
// Logger Configuration
// ============================================================

// Wait for Logger to be loaded, then configure it
document.addEventListener('DOMContentLoaded', function() {
    if (window.Logger) {
        // Set log level based on environment
        const logLevels = {
            'development': window.Logger.LogLevel?.DEBUG || 0,
            'staging': window.Logger.LogLevel?.INFO || 1,
            'production': window.Logger.LogLevel?.WARN || 2
        };

        const level = logLevels[window.ENV.ENVIRONMENT];
        if (typeof window.Logger.setMinLevel === 'function') {
            window.Logger.setMinLevel(level);
            console.log('  Logger level set to:', Object.keys(window.Logger.LogLevel || {}).find(k => window.Logger.LogLevel[k] === level) || level);
        }
    } else {
        console.warn('  Logger not available, skipping logger configuration');
    }
});
