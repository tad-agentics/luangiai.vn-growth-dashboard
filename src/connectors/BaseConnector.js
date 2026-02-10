// Growth Intelligence Platform - Base Connector
// ==============================================

import { getEventBus } from '../core/EventBus.js';
import { RATE_LIMITS } from '../config/constants.js';

/**
 * BaseConnector - Abstract interface for all data source connectors
 * All connectors (FluentCRM, Google Ads, Meta Ads, etc.) should extend this class
 */
export class BaseConnector {
    constructor(config = {}) {
        this.provider = '';              // 'fluentcrm', 'google_ads', 'meta_ads', etc.
        this.config = config;
        this.isConnected = false;
        this.lastSyncTime = null;
        this.eventBus = getEventBus();

        // Rate limiting
        this.rateLimiter = null;
        this.requestQueue = [];
        this.isProcessingQueue = false;
    }

    /**
     * Authenticate with the data source
     * @abstract
     * @returns {Promise<boolean>} Success status
     */
    async authenticate() {
        throw new Error('authenticate() must be implemented by subclass');
    }

    /**
     * Test connection to the data source
     * @abstract
     * @returns {Promise<boolean>} Connection status
     */
    async testConnection() {
        throw new Error('testConnection() must be implemented by subclass');
    }

    /**
     * Fetch data from the source
     * @abstract
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>} Fetched data
     */
    async fetchData(options = {}) {
        throw new Error('fetchData() must be implemented by subclass');
    }

    /**
     * Perform incremental sync (fetch only changes since last sync)
     * @abstract
     * @param {string} since - ISO timestamp of last sync
     * @returns {Promise<Object>} Updated data
     */
    async syncIncremental(since) {
        throw new Error('syncIncremental() must be implemented by subclass');
    }

    /**
     * Get normalized metrics for unified dashboard
     * @abstract
     * @param {Object} dateRange - { start, end } date range
     * @returns {Promise<Object>} Normalized metrics
     */
    async getMetrics(dateRange) {
        throw new Error('getMetrics() must be implemented by subclass');
    }

    /**
     * Normalize raw data to unified schema
     * @abstract
     * @param {Object} raw - Raw data from source
     * @returns {Object} Normalized data
     */
    normalizeData(raw) {
        throw new Error('normalizeData() must be implemented by subclass');
    }

    /**
     * Initialize rate limiter based on provider config
     */
    initRateLimiter() {
        const config = RATE_LIMITS[this.provider];
        if (!config) return;

        switch (config.type) {
            case 'token_bucket':
                this.rateLimiter = new TokenBucket(config);
                break;
            case 'request_budget':
                this.rateLimiter = new RequestBudget(config);
                break;
            case 'sliding_window':
                this.rateLimiter = new SlidingWindow(config);
                break;
            case 'delay':
                this.rateLimiter = new DelayLimiter(config);
                break;
        }
    }

    /**
     * Execute a function with rate limiting
     * @param {Function} fn - Async function to execute
     * @returns {Promise<*>} Function result
     */
    async withRateLimit(fn) {
        if (this.rateLimiter) {
            await this.rateLimiter.acquire();
        }
        return fn();
    }

    /**
     * Make an API call with error handling and rate limiting
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>} API response
     */
    async apiCall(endpoint, options = {}) {
        return this.withRateLimit(async () => {
            const startTime = Date.now();

            try {
                const response = await fetch(endpoint, {
                    ...options,
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers
                    }
                });

                if (!response.ok) {
                    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();

                this.eventBus.emit('apiCall', {
                    provider: this.provider,
                    endpoint,
                    duration: Date.now() - startTime,
                    success: true
                });

                return data;
            } catch (error) {
                this.eventBus.emit('apiCall', {
                    provider: this.provider,
                    endpoint,
                    duration: Date.now() - startTime,
                    success: false,
                    error: error.message
                });

                throw error;
            }
        });
    }

    /**
     * Emit sync status update
     * @param {string} status - Status message
     * @param {Object} details - Additional details
     */
    emitSyncStatus(status, details = {}) {
        this.eventBus.emit('syncStatus', {
            provider: this.provider,
            status,
            ...details
        });
    }

    /**
     * Disconnect from the data source
     */
    disconnect() {
        this.isConnected = false;
        this.eventBus.emit('disconnected', { provider: this.provider });
    }

    /**
     * Get connection status
     * @returns {Object} Status object
     */
    getStatus() {
        return {
            provider: this.provider,
            isConnected: this.isConnected,
            lastSyncTime: this.lastSyncTime
        };
    }
}

// =====================================================
// Rate Limiter Implementations
// =====================================================

/**
 * Token Bucket Rate Limiter (Google Ads style)
 */
class TokenBucket {
    constructor({ tokensPerDay, burstLimit }) {
        this.tokens = burstLimit;
        this.maxTokens = burstLimit;
        this.refillRate = tokensPerDay / (24 * 60 * 60 * 1000); // tokens per ms
        this.lastRefill = Date.now();
    }

    refill() {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
        this.lastRefill = now;
    }

    async acquire(cost = 1) {
        this.refill();

        if (this.tokens >= cost) {
            this.tokens -= cost;
            return true;
        }

        // Wait for enough tokens
        const waitTime = (cost - this.tokens) / this.refillRate;
        await this.delay(waitTime);
        return this.acquire(cost);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Request Budget Rate Limiter (Meta Ads style)
 */
class RequestBudget {
    constructor({ budgetPerHour }) {
        this.budget = budgetPerHour;
        this.maxBudget = budgetPerHour;
        this.resetTime = Date.now() + 3600000;
    }

    async acquire(cost = 1) {
        const now = Date.now();

        if (now > this.resetTime) {
            this.budget = this.maxBudget;
            this.resetTime = now + 3600000;
        }

        if (this.budget >= cost) {
            this.budget -= cost;
            return true;
        }

        // Wait for budget reset
        const waitTime = this.resetTime - now;
        await this.delay(waitTime);
        return this.acquire(cost);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Sliding Window Rate Limiter (TikTok style)
 */
class SlidingWindow {
    constructor({ windowMs, maxRequests }) {
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;
        this.timestamps = [];
    }

    async acquire() {
        const now = Date.now();
        this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);

        if (this.timestamps.length < this.maxRequests) {
            this.timestamps.push(now);
            return true;
        }

        // Wait for oldest request to expire
        const oldestInWindow = this.timestamps[0];
        const waitTime = this.windowMs - (now - oldestInWindow);
        await this.delay(waitTime);
        return this.acquire();
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Simple Delay Rate Limiter (FluentCRM style)
 */
class DelayLimiter {
    constructor({ delayMs }) {
        this.delayMs = delayMs;
        this.lastRequest = 0;
    }

    async acquire() {
        const now = Date.now();
        const elapsed = now - this.lastRequest;

        if (elapsed < this.delayMs) {
            await this.delay(this.delayMs - elapsed);
        }

        this.lastRequest = Date.now();
        return true;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default BaseConnector;
