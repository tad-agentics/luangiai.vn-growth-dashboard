// Growth Intelligence Platform - FluentCRM Connector
// ===================================================

import { BaseConnector } from './BaseConnector.js';
import { getSupabaseClient, logAuditEvent } from '../config/supabase.js';
import { CONVERSION_TAGS, CACHE_CONFIG } from '../config/constants.js';

/**
 * FluentCRM Connector - Handles all FluentCRM API interactions
 * Includes optimized caching, incremental sync, and rate limiting
 */
export class FluentCRMConnector extends BaseConnector {
    constructor(config = {}) {
        super(config);
        this.provider = 'fluentcrm';
        this.apiBase = '';
        this.credentials = null;

        // Sync management
        this.isSyncing = false;
        this.lastSyncTime = localStorage.getItem('fluentcrm_last_sync') || null;

        // Initialize rate limiter (300ms delay between requests)
        this.initRateLimiter();
    }

    /**
     * Connect to FluentCRM with credentials
     * @param {string} siteUrl - WordPress site URL
     * @param {string} username - API username
     * @param {string} password - API password (app password)
     * @returns {Promise<boolean>} Success status
     */
    async authenticate(siteUrl, username, password) {
        this.apiBase = `${siteUrl.replace(/\/$/, '')}/wp-json/fluent-crm/v2`;
        this.credentials = btoa(`${username}:${password}`);

        try {
            // Test connection by fetching lists
            const response = await this.apiCall('/lists');
            if (response.error) throw new Error(response.error);

            this.isConnected = true;
            this.emitSyncStatus('connected');
            logAuditEvent('fluentcrm_connected', { siteUrl });

            return true;
        } catch (error) {
            this.isConnected = false;
            throw error;
        }
    }

    /**
     * Test connection to FluentCRM
     * @returns {Promise<boolean>}
     */
    async testConnection() {
        try {
            const response = await this.apiCall('/lists');
            return !response.error;
        } catch {
            return false;
        }
    }

    /**
     * Make an API call to FluentCRM
     * @param {string} endpoint - API endpoint
     * @param {string} method - HTTP method
     * @param {Object} body - Request body
     * @returns {Promise<Object>} Response data
     */
    async apiCall(endpoint, method = 'GET', body = null) {
        return this.withRateLimit(async () => {
            try {
                const options = {
                    method,
                    headers: {
                        'Authorization': `Basic ${this.credentials}`,
                        'Content-Type': 'application/json'
                    }
                };

                if (body) options.body = JSON.stringify(body);

                console.log(`FluentCRM API: ${this.apiBase}${endpoint}`);
                const response = await fetch(`${this.apiBase}${endpoint}`, options);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                return await response.json();
            } catch (error) {
                console.error(`FluentCRM API Error (${endpoint}):`, error);
                return { error: error.message };
            }
        });
    }

    /**
     * Extract array from various FluentCRM response formats
     * @param {Object} response - API response
     * @param {string} key - Key to extract
     * @returns {Array} Extracted array
     */
    extractArray(response, key) {
        if (!response) return [];
        if (Array.isArray(response)) return response;

        const nested = response[key];
        if (!nested) return [];
        if (Array.isArray(nested)) return nested;
        if (nested.data && Array.isArray(nested.data)) return nested.data;

        if (typeof nested === 'object') {
            const keys = Object.keys(nested);
            const itemKeys = keys.filter(k =>
                !['total', 'per_page', 'current_page', 'last_page', 'next_page_url', 'prev_page_url', 'from', 'to'].includes(k)
            );
            if (itemKeys.length > 0) {
                return itemKeys.map(k => nested[k]).filter(v => v && typeof v === 'object');
            }
        }

        return [];
    }

    /**
     * Fetch all data from FluentCRM
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>} All CRM data
     */
    async fetchData(options = {}) {
        const { forceFullSync = false } = options;

        // Prevent concurrent syncs
        if (this.isSyncing) {
            console.log('Sync already in progress, skipping...');
            return null;
        }

        if (!this.acquireSyncLock()) {
            console.log('Another tab is syncing...');
            return null;
        }

        this.isSyncing = true;
        this.emitSyncStatus('syncing');

        try {
            // Fetch metadata in parallel
            const [listsData, tagsData, campaignsData, sequencesData] = await Promise.all([
                this.apiCall('/lists'),
                this.apiCall('/tags'),
                this.apiCall('/campaigns?per_page=100'),
                this.apiCall('/sequences?per_page=100')
            ]);

            // Fetch contact stats
            const contactStats = await this.fetchContactStats();

            // Fetch subscribers
            const subscribers = await this.fetchSubscribers(forceFullSync);

            const data = {
                lists: this.extractArray(listsData, 'lists'),
                tags: this.extractArray(tagsData, 'tags'),
                campaigns: this.extractArray(campaignsData, 'campaigns'),
                sequences: this.extractArray(sequencesData, 'sequences'),
                contacts: contactStats,
                subscribers
            };

            // Update last sync time
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem('fluentcrm_last_sync', this.lastSyncTime);

            this.emitSyncStatus('complete', { subscriberCount: subscribers.length });

            return data;
        } finally {
            this.isSyncing = false;
            this.releaseSyncLock();
        }
    }

    /**
     * Fetch contact statistics
     * @returns {Promise<Object>} Contact stats
     */
    async fetchContactStats() {
        const statuses = ['subscribed', 'pending', 'unsubscribed', 'bounced', 'complained'];
        const stats = { total: 0, subscribed: 0, pending: 0, unsubscribed: 0, bounced: 0, complained: 0 };

        for (const status of statuses) {
            try {
                const response = await this.apiCall(`/subscribers?statuses[]=${status}&per_page=1`);
                let count = 0;
                if (response.total !== undefined) {
                    count = response.total;
                } else if (response.subscribers?.total !== undefined) {
                    count = response.subscribers.total;
                }
                stats[status] = count;
                stats.total += count;
            } catch (e) {
                console.log(`Could not fetch ${status} count:`, e);
            }
        }

        // Get total count
        try {
            const allResponse = await this.apiCall('/subscribers?per_page=1');
            if (allResponse.total && allResponse.total > stats.total) {
                stats.total = allResponse.total;
            } else if (allResponse.subscribers?.total && allResponse.subscribers.total > stats.total) {
                stats.total = allResponse.subscribers.total;
            }
        } catch (e) {
            console.log('Could not fetch all subscribers count:', e);
        }

        return stats;
    }

    /**
     * Fetch subscribers with caching support
     * @param {boolean} forceFullSync - Force full sync
     * @returns {Promise<Array>} Subscribers array
     */
    async fetchSubscribers(forceFullSync = false) {
        let subscribers = [];

        // Try loading from Supabase cache first
        if (!forceFullSync) {
            const cache = await this.loadSubscriberCache();
            if (cache && cache.subscribers.length > 0) {
                subscribers = cache.subscribers;
                this.lastSyncTime = cache.lastSyncTime;
                localStorage.setItem('fluentcrm_last_sync', this.lastSyncTime);

                this.emitSyncStatus('cacheLoaded', { count: subscribers.length });

                // Do incremental sync for updates
                const updates = await this.syncIncremental(this.lastSyncTime, subscribers);
                subscribers = updates;

                // Save updated cache
                await this.saveSubscriberCache(subscribers);

                return subscribers;
            }
        }

        // Full sync required
        subscribers = await this.fullSubscriberSync();
        await this.saveSubscriberCache(subscribers);

        return subscribers;
    }

    /**
     * Full sync - fetches ALL subscribers
     * @returns {Promise<Array>} All subscribers
     */
    async fullSubscriberSync() {
        let allSubscribers = [];
        let page = 1;
        const perPage = 500;
        const maxPages = 50;

        this.emitSyncStatus('fullSync', { progress: 0 });

        while (page <= maxPages) {
            const response = await this.apiCall(
                `/subscribers?per_page=${perPage}&page=${page}&with[]=tags&custom_fields=true`
            );
            const subscribers = response.subscribers?.data || response.data || this.extractArray(response, 'subscribers') || [];

            if (subscribers.length === 0) break;

            allSubscribers.push(...subscribers);
            console.log(`Fetched page ${page}: ${subscribers.length} (total: ${allSubscribers.length})`);

            const progress = Math.min(100, Math.round((page / maxPages) * 100));
            this.emitSyncStatus('fullSync', { progress, count: allSubscribers.length });

            if (subscribers.length < perPage) break;

            page++;
        }

        console.log(`Full sync complete: ${allSubscribers.length} subscribers`);
        return allSubscribers;
    }

    /**
     * Incremental sync - fetch only changes since last sync
     * @param {string} since - ISO timestamp
     * @param {Array} existingSubscribers - Current subscriber list
     * @returns {Promise<Array>} Updated subscribers
     */
    async syncIncremental(since, existingSubscribers = []) {
        console.log(`Incremental sync: Fetching changes since ${since}...`);

        const subscriberMap = new Map();
        existingSubscribers.forEach(sub => subscriberMap.set(sub.id, sub));

        let page = 1;
        let updatedCount = 0;
        let newCount = 0;
        const perPage = 500;
        const maxPages = 10;
        const lastSyncDate = new Date(since);

        while (page <= maxPages) {
            const response = await this.apiCall(
                `/subscribers?per_page=${perPage}&page=${page}&with[]=tags&custom_fields=true&sort_by=updated_at&sort_order=DESC`
            );
            const subscribers = response.subscribers?.data || response.data || this.extractArray(response, 'subscribers') || [];

            if (subscribers.length === 0) break;

            let hasOlderRecords = false;
            for (const sub of subscribers) {
                const subUpdatedAt = new Date(sub.updated_at || sub.created_at);

                if (subUpdatedAt < lastSyncDate) {
                    hasOlderRecords = true;
                    break;
                }

                if (subscriberMap.has(sub.id)) {
                    subscriberMap.set(sub.id, sub);
                    updatedCount++;
                } else {
                    subscriberMap.set(sub.id, sub);
                    newCount++;
                }
            }

            if (hasOlderRecords) break;
            if (subscribers.length < perPage) break;

            page++;
        }

        console.log(`Incremental sync: ${newCount} new, ${updatedCount} updated`);
        return Array.from(subscriberMap.values());
    }

    /**
     * Load subscriber cache from Supabase
     * @returns {Promise<Object|null>} Cache data
     */
    async loadSubscriberCache() {
        const supabase = getSupabaseClient();
        if (!supabase) return null;

        try {
            console.log('Loading subscriber cache from Supabase...');
            const { data, error } = await supabase
                .from('subscriber_cache')
                .select('*')
                .eq('cache_key', CACHE_CONFIG.SUBSCRIBER_CACHE_KEY)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    console.log('No cache found in Supabase (first run)');
                    return null;
                }
                throw error;
            }

            if (data && data.subscribers && data.subscribers.length > 0) {
                // Expand minimal format
                const subscribers = this.expandMinimalFormat(data.subscribers, data.metadata?.format);

                const cacheAge = Date.now() - new Date(data.updated_at).getTime();
                console.log(`Loaded ${data.subscriber_count} subscribers from cache (${(cacheAge / 3600000).toFixed(1)}h old)`);

                return {
                    subscribers,
                    lastSyncTime: data.last_sync_time,
                    subscriberCount: data.subscriber_count,
                    updatedAt: data.updated_at
                };
            }

            return null;
        } catch (e) {
            console.log('Failed to load cache from Supabase:', e.message);
            return null;
        }
    }

    /**
     * Save subscriber cache to Supabase
     * @param {Array} subscribers - Subscribers to cache
     */
    async saveSubscriberCache(subscribers) {
        const supabase = getSupabaseClient();
        if (!supabase || !subscribers || subscribers.length === 0) return;

        try {
            // Compress to minimal format
            const subscribersToCache = this.compressToMinimalFormat(subscribers);

            const payloadSize = JSON.stringify(subscribersToCache).length;
            const payloadMB = (payloadSize / (1024 * 1024)).toFixed(2);

            if (payloadSize > CACHE_CONFIG.MAX_PAYLOAD_MB * 1024 * 1024) {
                console.log('⚠️ Payload too large for Supabase, skipping cache save');
                return;
            }

            const cacheData = {
                cache_key: CACHE_CONFIG.SUBSCRIBER_CACHE_KEY,
                last_sync_time: this.lastSyncTime || new Date().toISOString(),
                subscriber_count: subscribers.length,
                subscribers: subscribersToCache,
                metadata: {
                    payload_mb: payloadMB,
                    format: 'minimal_v2'
                }
            };

            const { error } = await supabase
                .from('subscriber_cache')
                .upsert(cacheData, { onConflict: 'cache_key' });

            if (error) throw error;

            console.log('✅ Subscriber cache saved to Supabase');
            logAuditEvent('cache_saved', { subscriber_count: subscribers.length, payload_mb: payloadMB });
        } catch (e) {
            console.error('❌ Failed to save cache:', e.message);
        }
    }

    /**
     * Compress subscribers to minimal format for caching
     * @param {Array} subscribers - Full subscriber objects
     * @returns {Array} Compressed subscribers
     */
    compressToMinimalFormat(subscribers) {
        return subscribers.map(sub => {
            const dob = sub.date_of_birth ||
                       sub.custom_fields?.date_of_birth ||
                       sub.custom_fields?.dob ||
                       sub.custom_fields?.ngay_sinh || null;

            const birthTime = sub.custom_fields?.birth_time ||
                             sub.custom_fields?.gio_sinh || null;

            const gender = sub.custom_fields?.gender ||
                          sub.custom_fields?.gioi_tinh || null;

            const hasConversionTag = sub.tags?.some(t => {
                const title = (t.title || t.name || '').toLowerCase();
                return CONVERSION_TAGS.some(ct => title.includes(ct));
            }) || false;

            const device = sub.custom_fields?.device ||
                          sub.device || sub.device_type ||
                          sub.custom_values?.device ||
                          sub.meta?.device ||
                          sub.user_agent || null;

            return {
                id: sub.id,
                s: sub.status?.charAt(0),
                t: sub.contact_type?.charAt(0),
                c: sub.created_at,
                u: sub.updated_at,
                d: dob,
                bt: birthTime,
                g: gender,
                src: sub.source,
                cv: hasConversionTag ? 1 : 0,
                tc: sub.tags?.length || 0,
                la: sub.last_activity,
                dev: device
            };
        });
    }

    /**
     * Expand minimal format back to full format
     * @param {Array} subscribers - Compressed subscribers
     * @param {string} format - Format version
     * @returns {Array} Expanded subscribers
     */
    expandMinimalFormat(subscribers, format) {
        if (format !== 'minimal_v2') return subscribers;

        const statusMap = { 's': 'subscribed', 'p': 'pending', 'u': 'unsubscribed', 'b': 'bounced' };
        const typeMap = { 'l': 'lead', 'c': 'customer' };

        return subscribers.map(sub => ({
            id: sub.id,
            status: statusMap[sub.s] || sub.s || 'subscribed',
            contact_type: typeMap[sub.t] || sub.t || 'lead',
            created_at: sub.c,
            updated_at: sub.u,
            date_of_birth: sub.d,
            source: sub.src,
            custom_fields: {
                birth_time: sub.bt,
                gender: sub.g,
                device: sub.dev
            },
            last_activity: sub.la,
            device: sub.dev,
            tags: sub.cv ? [{ title: 'converted' }] : [],
            _tagCount: sub.tc
        }));
    }

    /**
     * Acquire sync lock (prevent cross-tab concurrent syncs)
     * @returns {boolean} Lock acquired
     */
    acquireSyncLock() {
        const lock = localStorage.getItem(CACHE_CONFIG.SYNC_LOCK_KEY);
        const now = Date.now();

        if (lock && now - parseInt(lock) < CACHE_CONFIG.SYNC_LOCK_TIMEOUT_MS) {
            return false;
        }

        localStorage.setItem(CACHE_CONFIG.SYNC_LOCK_KEY, now.toString());
        return true;
    }

    /**
     * Release sync lock
     */
    releaseSyncLock() {
        localStorage.removeItem(CACHE_CONFIG.SYNC_LOCK_KEY);
    }

    /**
     * Get normalized metrics for unified dashboard
     * @param {Object} dateRange - Date range
     * @returns {Promise<Object>} Normalized metrics
     */
    async getMetrics(dateRange) {
        // FluentCRM doesn't have date-range API, metrics come from subscribers
        return {
            source: 'fluentcrm',
            period: dateRange,
            // Metrics will be calculated from subscriber data
            type: 'crm'
        };
    }

    /**
     * Normalize subscriber data to unified format
     * @param {Object} raw - Raw subscriber data
     * @returns {Object} Normalized data
     */
    normalizeData(raw) {
        return {
            id: raw.id,
            source: 'fluentcrm',
            email: raw.email,
            status: raw.status,
            contactType: raw.contact_type,
            createdAt: raw.created_at,
            updatedAt: raw.updated_at,
            lastActivity: raw.last_activity,
            customFields: raw.custom_fields,
            tags: raw.tags
        };
    }
}

export default FluentCRMConnector;
