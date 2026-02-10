// Growth Intelligence Platform - Google Search Console Connector
// ==============================================================

import { BaseConnector } from './BaseConnector.js';
import { getSupabaseClient, logAuditEvent } from '../config/supabase.js';
import { DATA_SOURCES } from '../config/constants.js';

/**
 * GSCConnector - Handles Google Search Console API interactions
 * Uses Search Console API v3
 */
export class GSCConnector extends BaseConnector {
    constructor(config = {}) {
        super(config);
        this.provider = DATA_SOURCES.GSC;
        this.accessToken = null;
        this.siteUrl = config.siteUrl || null;
        this.baseUrl = 'https://www.googleapis.com/webmasters/v3';

        // Initialize rate limiter (1200 queries per minute)
        this.initRateLimiter();
    }

    /**
     * Authenticate using stored OAuth tokens
     * @returns {Promise<boolean>}
     */
    async authenticate() {
        const supabase = getSupabaseClient();
        if (!supabase) return false;

        try {
            const { data, error } = await supabase
                .from('oauth_tokens')
                .select('*')
                .eq('provider', 'gsc')
                .order('updated_at', { ascending: false })
                .limit(1)
                .single();

            if (error || !data) {
                console.log('No GSC connection found');
                return false;
            }

            // Check if token is expired
            if (new Date(data.expires_at) < new Date()) {
                const refreshed = await this.refreshToken(data);
                if (!refreshed) return false;
            } else {
                this.accessToken = data.access_token;
                this.siteUrl = data.account_id;
            }

            this.isConnected = true;
            this.emitSyncStatus('connected');
            return true;
        } catch (e) {
            console.error('GSC authentication failed:', e);
            return false;
        }
    }

    /**
     * Refresh OAuth token
     * @param {Object} tokenData - Current token data
     * @returns {Promise<boolean>}
     */
    async refreshToken(tokenData) {
        if (!tokenData.refresh_token) return false;

        try {
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: process.env.GOOGLE_CLIENT_ID,
                    client_secret: process.env.GOOGLE_CLIENT_SECRET,
                    refresh_token: tokenData.refresh_token,
                    grant_type: 'refresh_token'
                })
            });

            const data = await response.json();

            if (data.error) {
                console.error('Token refresh failed:', data.error);
                return false;
            }

            // Update token in database
            const supabase = getSupabaseClient();
            await supabase
                .from('oauth_tokens')
                .update({
                    access_token: data.access_token,
                    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString()
                })
                .eq('id', tokenData.id);

            this.accessToken = data.access_token;
            return true;
        } catch (e) {
            console.error('Token refresh error:', e);
            return false;
        }
    }

    /**
     * Test connection to GSC
     * @returns {Promise<boolean>}
     */
    async testConnection() {
        try {
            const sites = await this.getSites();
            return sites.length > 0;
        } catch {
            return false;
        }
    }

    /**
     * Get available sites
     * @returns {Promise<Array>}
     */
    async getSites() {
        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${this.baseUrl}/sites`, {
            headers: { 'Authorization': `Bearer ${this.accessToken}` }
        });

        const data = await response.json();
        return data.siteEntry || [];
    }

    /**
     * Query search analytics
     * @param {Object} queryConfig - Query configuration
     * @returns {Promise<Object>}
     */
    async searchAnalytics(queryConfig) {
        if (!this.accessToken || !this.siteUrl) {
            throw new Error('Not authenticated or no site selected');
        }

        return this.withRateLimit(async () => {
            const response = await fetch(
                `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(this.siteUrl)}/searchAnalytics/query`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(queryConfig)
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'GSC API error');
            }

            return response.json();
        });
    }

    /**
     * Fetch search performance overview
     * @param {Object} dateRange - Date range
     * @returns {Promise<Object>}
     */
    async fetchSearchOverview(dateRange) {
        const data = await this.searchAnalytics({
            startDate: dateRange.start,
            endDate: dateRange.end,
            dimensions: [],
            rowLimit: 1
        });

        const row = data.rows?.[0] || {};

        return {
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: row.ctr || 0,
            position: row.position || 0
        };
    }

    /**
     * Fetch top queries
     * @param {Object} dateRange - Date range
     * @returns {Promise<Array>}
     */
    async fetchTopQueries(dateRange) {
        const data = await this.searchAnalytics({
            startDate: dateRange.start,
            endDate: dateRange.end,
            dimensions: ['query'],
            rowLimit: 50
        });

        return (data.rows || []).map(row => ({
            query: row.keys?.[0] || '',
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: row.ctr || 0,
            position: row.position || 0
        }));
    }

    /**
     * Fetch top pages
     * @param {Object} dateRange - Date range
     * @returns {Promise<Array>}
     */
    async fetchTopPages(dateRange) {
        const data = await this.searchAnalytics({
            startDate: dateRange.start,
            endDate: dateRange.end,
            dimensions: ['page'],
            rowLimit: 50
        });

        return (data.rows || []).map(row => ({
            page: row.keys?.[0] || '',
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: row.ctr || 0,
            position: row.position || 0
        }));
    }

    /**
     * Fetch performance by country
     * @param {Object} dateRange - Date range
     * @returns {Promise<Array>}
     */
    async fetchByCountry(dateRange) {
        const data = await this.searchAnalytics({
            startDate: dateRange.start,
            endDate: dateRange.end,
            dimensions: ['country'],
            rowLimit: 20
        });

        return (data.rows || []).map(row => ({
            country: row.keys?.[0] || '',
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: row.ctr || 0,
            position: row.position || 0
        }));
    }

    /**
     * Fetch performance by device
     * @param {Object} dateRange - Date range
     * @returns {Promise<Array>}
     */
    async fetchByDevice(dateRange) {
        const data = await this.searchAnalytics({
            startDate: dateRange.start,
            endDate: dateRange.end,
            dimensions: ['device'],
            rowLimit: 10
        });

        return (data.rows || []).map(row => ({
            device: row.keys?.[0] || '',
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: row.ctr || 0,
            position: row.position || 0
        }));
    }

    /**
     * Fetch daily search trend
     * @param {Object} dateRange - Date range
     * @returns {Promise<Array>}
     */
    async fetchDailyTrend(dateRange) {
        const data = await this.searchAnalytics({
            startDate: dateRange.start,
            endDate: dateRange.end,
            dimensions: ['date']
        });

        return (data.rows || []).map(row => ({
            date: row.keys?.[0] || '',
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: row.ctr || 0,
            position: row.position || 0
        }));
    }

    /**
     * Fetch query-page combinations
     * @param {Object} dateRange - Date range
     * @returns {Promise<Array>}
     */
    async fetchQueryPageCombinations(dateRange) {
        const data = await this.searchAnalytics({
            startDate: dateRange.start,
            endDate: dateRange.end,
            dimensions: ['query', 'page'],
            rowLimit: 100
        });

        return (data.rows || []).map(row => ({
            query: row.keys?.[0] || '',
            page: row.keys?.[1] || '',
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: row.ctr || 0,
            position: row.position || 0
        }));
    }

    /**
     * Fetch all GSC data
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>}
     */
    async fetchData(options = {}) {
        const dateRange = options.dateRange || this.getDefaultDateRange();

        this.emitSyncStatus('syncing', { platform: 'GSC' });

        try {
            const [overview, queries, pages, countries, devices, daily] = await Promise.all([
                this.fetchSearchOverview(dateRange),
                this.fetchTopQueries(dateRange),
                this.fetchTopPages(dateRange),
                this.fetchByCountry(dateRange),
                this.fetchByDevice(dateRange),
                this.fetchDailyTrend(dateRange)
            ]);

            const data = {
                overview,
                queries,
                pages,
                countries,
                devices,
                daily,
                dateRange,
                fetchedAt: new Date().toISOString()
            };

            this.emitSyncStatus('complete', { platform: 'GSC' });
            logAuditEvent('gsc_sync', { clicks: overview.clicks, queries: queries.length });

            return data;
        } catch (error) {
            this.emitSyncStatus('error', { platform: 'GSC', error: error.message });
            throw error;
        }
    }

    /**
     * Normalize data to unified schema
     * @param {Object} raw - Raw GSC data
     * @returns {Object}
     */
    normalizeData(raw) {
        return {
            source: DATA_SOURCES.GSC,
            date: raw.date,
            query: raw.query,
            page: raw.page,
            clicks: raw.clicks || 0,
            impressions: raw.impressions || 0,
            ctr: raw.ctr || 0,
            position: raw.position || 0
        };
    }

    /**
     * Get metrics for unified dashboard
     * @param {Object} dateRange - Date range
     * @returns {Promise<Object>}
     */
    async getMetrics(dateRange) {
        const data = await this.fetchData({ dateRange });
        return {
            source: DATA_SOURCES.GSC,
            ...data.overview,
            topQueries: data.queries.slice(0, 10)
        };
    }

    /**
     * Get default date range (last 28 days - GSC limit)
     * @returns {Object}
     */
    getDefaultDateRange() {
        const end = new Date();
        end.setDate(end.getDate() - 3); // GSC data has 3-day delay
        const start = new Date(end);
        start.setDate(start.getDate() - 28);

        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    }

    /**
     * Sync incremental data
     * @param {string} since - Start date
     * @returns {Promise<Object>}
     */
    async syncIncremental(since) {
        const end = new Date();
        end.setDate(end.getDate() - 3); // GSC data has 3-day delay

        const dateRange = {
            start: new Date(since).toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };

        return this.fetchData({ dateRange });
    }

    /**
     * Find keyword opportunities (low position, high impressions)
     * @param {Object} dateRange - Date range
     * @returns {Promise<Array>}
     */
    async findKeywordOpportunities(dateRange) {
        const queries = await this.fetchTopQueries(dateRange);

        // Find queries with position 5-20 and high impressions
        return queries
            .filter(q => q.position >= 5 && q.position <= 20 && q.impressions > 100)
            .sort((a, b) => b.impressions - a.impressions)
            .slice(0, 20)
            .map(q => ({
                ...q,
                opportunity: 'Quick Win - improve position to top 3',
                potentialClicks: Math.round(q.impressions * 0.1) // Estimate 10% CTR at top 3
            }));
    }

    /**
     * Find pages needing optimization (high impressions, low CTR)
     * @param {Object} dateRange - Date range
     * @returns {Promise<Array>}
     */
    async findPagesNeedingOptimization(dateRange) {
        const pages = await this.fetchTopPages(dateRange);

        // Find pages with high impressions but below-average CTR
        const avgCtr = pages.reduce((sum, p) => sum + p.ctr, 0) / pages.length || 0;

        return pages
            .filter(p => p.impressions > 500 && p.ctr < avgCtr)
            .sort((a, b) => b.impressions - a.impressions)
            .slice(0, 10)
            .map(p => ({
                ...p,
                recommendation: 'Optimize title and meta description',
                currentCtr: (p.ctr * 100).toFixed(2) + '%',
                avgCtr: (avgCtr * 100).toFixed(2) + '%'
            }));
    }
}

export default GSCConnector;
