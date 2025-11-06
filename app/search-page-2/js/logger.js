/**
 * Structured Logging System for Split Lease Search Lite
 *
 * Provides centralized logging with:
 * - Timestamp prefixes
 * - Log levels (debug, info, warn, error)
 * - Performance tracking
 * - Error tracking
 * - Log history buffer
 *
 * @version 1.0.0
 * @created 2025-10-09
 */

(function() {
  'use strict';

  /**
   * Log levels enum
   */
  const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  };

  /**
   * Global Logger object
   */
  window.Logger = {
    // Configuration
    enabled: true,
    minLevel: LogLevel.INFO, // Only log INFO and above by default
    maxHistorySize: 100,

    // Log history
    history: [],

    // Performance tracking
    timers: new Map(),

    // Error tracking
    errors: [],
    maxErrors: 50,

    /**
     * Get current timestamp string
     * @returns {string} Formatted timestamp
     */
    getTimestamp: function() {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const ms = String(now.getMilliseconds()).padStart(3, '0');
      return `${hours}:${minutes}:${seconds}.${ms}`;
    },

    /**
     * Add log entry to history
     * @param {string} level - Log level
     * @param {Array} args - Log arguments
     */
    addToHistory: function(level, args) {
      const entry = {
        timestamp: new Date().toISOString(),
        level: level,
        message: args.map(arg => {
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg);
            } catch (e) {
              return String(arg);
            }
          }
          return String(arg);
        }).join(' ')
      };

      this.history.push(entry);

      // Trim history if too large
      if (this.history.length > this.maxHistorySize) {
        this.history.shift();
      }
    },

    /**
     * Debug level logging
     * Only shown when minLevel is DEBUG
     */
    debug: function(...args) {
      if (!this.enabled || this.minLevel > LogLevel.DEBUG) return;

      const timestamp = this.getTimestamp();
      console.log(`[${timestamp}] [DEBUG]`, ...args);
      this.addToHistory('DEBUG', args);
    },

    /**
     * Info level logging
     * General information messages
     */
    info: function(...args) {
      if (!this.enabled || this.minLevel > LogLevel.INFO) return;

      const timestamp = this.getTimestamp();
      console.log(`[${timestamp}] [INFO]`, ...args);
      this.addToHistory('INFO', args);
    },

    /**
     * Warning level logging
     * Potential issues that don't break functionality
     */
    warn: function(...args) {
      if (!this.enabled || this.minLevel > LogLevel.WARN) return;

      const timestamp = this.getTimestamp();
      console.warn(`[${timestamp}] [WARN]`, ...args);
      this.addToHistory('WARN', args);
    },

    /**
     * Error level logging
     * Critical errors that affect functionality
     */
    error: function(...args) {
      if (!this.enabled || this.minLevel > LogLevel.ERROR) return;

      const timestamp = this.getTimestamp();
      console.error(`[${timestamp}] [ERROR]`, ...args);
      this.addToHistory('ERROR', args);

      // Track error separately
      const errorEntry = {
        timestamp: new Date().toISOString(),
        message: args.map(arg => String(arg)).join(' '),
        stack: new Error().stack
      };
      this.errors.push(errorEntry);

      // Trim errors if too many
      if (this.errors.length > this.maxErrors) {
        this.errors.shift();
      }
    },

    /**
     * Start a performance timer
     * @param {string} label - Timer label
     */
    time: function(label) {
      this.timers.set(label, performance.now());
      this.debug(`Timer started: ${label}`);
    },

    /**
     * End a performance timer and log duration
     * @param {string} label - Timer label
     * @returns {number} Duration in milliseconds
     */
    timeEnd: function(label) {
      const startTime = this.timers.get(label);
      if (!startTime) {
        this.warn(`Timer not found: ${label}`);
        return 0;
      }

      const duration = performance.now() - startTime;
      this.timers.delete(label);

      this.info(`${label}: ${duration.toFixed(2)}ms`);
      return duration;
    },

    /**
     * Log API request
     * @param {string} method - HTTP method
     * @param {string} url - Request URL
     * @param {Object} options - Request options
     */
    logApiRequest: function(method, url, options = {}) {
      this.debug(`API Request: ${method} ${url}`, options);
    },

    /**
     * Log API response
     * @param {number} status - HTTP status code
     * @param {string} url - Request URL
     * @param {number} duration - Request duration in ms
     */
    logApiResponse: function(status, url, duration) {
      const level = status >= 400 ? 'error' : 'info';
      this[level](`API Response: ${status} ${url} (${duration.toFixed(2)}ms)`);
    },

    /**
     * Log data source change
     * @param {string} source - Data source name
     * @param {string} reason - Reason for change
     */
    logDataSource: function(source, reason) {
      this.info(`Data Source: ${source} - ${reason}`);
    },

    /**
     * Get log history
     * @param {string} level - Optional filter by level
     * @returns {Array} Log entries
     */
    getHistory: function(level = null) {
      if (level) {
        return this.history.filter(entry => entry.level === level);
      }
      return this.history;
    },

    /**
     * Get error history
     * @returns {Array} Error entries
     */
    getErrors: function() {
      return this.errors;
    },

    /**
     * Clear log history
     */
    clearHistory: function() {
      this.history = [];
      this.info('Log history cleared');
    },

    /**
     * Clear error history
     */
    clearErrors: function() {
      this.errors = [];
      this.info('Error history cleared');
    },

    /**
     * Export logs as JSON
     * @returns {string} JSON string of logs
     */
    exportLogs: function() {
      const exportData = {
        timestamp: new Date().toISOString(),
        logs: this.history,
        errors: this.errors,
        userAgent: navigator.userAgent,
        url: window.location.href
      };
      return JSON.stringify(exportData, null, 2);
    },

    /**
     * Download logs as file
     * @param {string} filename - Optional filename
     */
    downloadLogs: function(filename = null) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fname = filename || `split-lease-logs-${timestamp}.json`;

      const content = this.exportLogs();
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.info(`Logs downloaded: ${fname}`);
    },

    /**
     * Get system information for debugging
     * @returns {Object} System info
     */
    getSystemInfo: function() {
      return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        cookiesEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        screenResolution: `${screen.width}x${screen.height}`,
        windowSize: `${window.innerWidth}x${window.innerHeight}`,
        timestamp: new Date().toISOString(),
        url: window.location.href
      };
    },

    /**
     * Log system information
     */
    logSystemInfo: function() {
      const info = this.getSystemInfo();
      this.info('System Information:', info);
    },

    /**
     * Set minimum log level
     * @param {string} level - Level name (debug, info, warn, error)
     */
    setLevel: function(level) {
      const levelMap = {
        'debug': LogLevel.DEBUG,
        'info': LogLevel.INFO,
        'warn': LogLevel.WARN,
        'error': LogLevel.ERROR
      };

      if (levelMap[level] !== undefined) {
        this.minLevel = levelMap[level];
        console.log(`Logger level set to: ${level}`);
      } else {
        console.error(`Invalid log level: ${level}`);
      }
    },

    /**
     * Enable logging
     */
    enable: function() {
      this.enabled = true;
      this.info('Logger enabled');
    },

    /**
     * Disable logging
     */
    disable: function() {
      console.log('Logger disabled');
      this.enabled = false;
    }
  };

  // Initialize logger
  console.log('Logger initialized');
  window.Logger.info('Split Lease Search Lite Logger ready');

})();
