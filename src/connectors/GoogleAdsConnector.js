// Growth Intelligence Platform - Google Ads Connector
// ====================================================

import { BaseConnector } from './BaseConnector.js';
import { getSupabaseClient, logAuditEvent } from '../config/supabase.js';
import { DATA_SOURCES } from '../config/constants.js';

/**
 * GoogleAdsConnector - Handles Google Ads API interactions
 * Uses Google Ads API v15 with GAQL queries
 */
export class GoogleAdsConnector extends BaseConnector {
    constructor(config = {}) {
        super(config);
        this.provider = DATA_SOURCES.GOOGLE_ADS;
        this.developerToken = config.developerToken || null;
        this.customerId = config.customerId || null;
        this.accessToken = null;

        // Initialize rate limiter (token bucket: 1000 ops/day basic access)
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
                .eq('provider', 'google_ads')
                .single();

            if (error || !data) {
                console.log('No Google Ads connection found');
                return false;
            }

            // Check if token is expired
            if (new Date(data.expires_at) < new Date()) {
                // Try to refresh
                const refreshed = await this.refreshToken();
                if (!refreshed) return false;
            } else {
                this.accessToken = data.access_token;
                this.customerId = data.account_id;
            }

            this.isConnected = true;
            this.emitSyncStatus('connected');
            return true;
        } catch (e) {
            console.error('Google Ads authentication failed:', e);
            return false;
        }
    }

    /**
     * Refresh OAuth token via serverless function
     * @returns {Promise<boolean>}
     */
    async refreshToken() {
        try {
            const response = await fetch('/api/oauth/google/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account_id: this.customerId })
            });

            if (!response.ok) {
                console.error('Token refresh failed');
                return false;
            }

            // Re-fetch token from database
            const supabase = getSupabaseClient();
            const { data } = await supabase
                .from('oauth_tokens')
                .select('access_token')
                .eq('provider', 'google_ads')
                .single();

            if (data) {
                this.accessToken = data.access_token;
                return true;
            }

            return false;
        } catch (e) {
            console.error('Token refresh error:', e);
            return false;
        }
    }

    /**
     * Test connection to Google Ads
     * @returns {Promise<boolean>}
     */
    async testConnection() {
        try {
            const accounts = await this.getAccessibleCustomers();
            return accounts.length > 0;
        } catch {
            return false;
        }
    }

    /**
     * Make a Google Ads API call using GAQL
     * @param {string} query - GAQL query
     * @returns {Promise<Array>} Query results
     */
    async executeQuery(query) {
        if (!this.accessToken || !this.customerId) {
            throw new Error('Not authenticated');
        }

        return this.withRateLimit(async () => {
            const response = await fetch(
                `https://googleads.googleapis.com/v15/customers/${this.customerId}/googleAds:searchStream`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'developer-token': this.developerToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ query })
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `API error: ${response.status}`);
            }

            const results = await response.json();
            return results.flatMap(r => r.results || []);
        });
    }

    /**
     * Get accessible customer accounts
     * @returns {Promise<Array>}
     */
    async getAccessibleCustomers() {
        return this.withRateLimit(async () => {
            const response = await fetch(
                'https://googleads.googleapis.com/v15/customers:listAccessibleCustomers',
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'developer-token': this.developerToken
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch customers');
            }

            const data = await response.json();
            return data.resourceNames || [];
        });
    }

    /**
     * Fetch campaign performance data
     * @param {Object} dateRange - { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
     * @returns {Promise<Array>}
     */
    async fetchCampaigns(dateRange) {
        const query = `
            SELECT
                campaign.id,
                campaign.name,
                campaign.status,
                campaign.advertising_channel_type,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions,
                metrics.conversions_value,
                metrics.ctr,
                metrics.average_cpc,
                segments.date
            FROM campaign
            WHERE segments.date BETWEEN '${dateRange.start}' AND '${dateRange.end}'
                AND campaign.status != 'REMOVED'
            ORDER BY metrics.impressions DESC
        `;

        return this.executeQuery(query);
    }

    /**
     * Fetch ad group performance data
     * @param {Object} dateRange
     * @returns {Promise<Array>}
     */
    async fetchAdGroups(dateRange) {
        const query = `
            SELECT
                ad_group.id,
                ad_group.name,
                ad_group.status,
                campaign.id,
                campaign.name,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions,
                segments.date
            FROM ad_group
            WHERE segments.date BETWEEN '${dateRange.start}' AND '${dateRange.end}'
                AND ad_group.status != 'REMOVED'
            ORDER BY metrics.impressions DESC
        `;

        return this.executeQuery(query);
    }

    /**
     * Fetch account-level summary
     * @param {Object} dateRange
     * @returns {Promise<Object>}
     */
    async fetchAccountSummary(dateRange) {
        const query = `
            SELECT
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions,
                metrics.conversions_value,
                metrics.ctr,
                metrics.average_cpc
            FROM customer
            WHERE segments.date BETWEEN '${dateRange.start}' AND '${dateRange.end}'
        `;

        const results = await this.executeQuery(query);

        // Aggregate results
        const summary = {
            impressions: 0,
            clicks: 0,
            spend: 0,
            conversions: 0,
            revenue: 0
        };

        results.forEach(row => {
            summary.impressions += parseInt(row.metrics?.impressions || 0);
            summary.clicks += parseInt(row.metrics?.clicks || 0);
            summary.spend += (parseInt(row.metrics?.costMicros || 0) / 1000000);
            summary.conversions += parseFloat(row.metrics?.conversions || 0);
            summary.revenue += parseFloat(row.metrics?.conversionsValue || 0);
        });

        return summary;
    }

    /**
     * Fetch all data from Google Ads
     * @param {Object} options - { dateRange: { start, end } }
     * @returns {Promise<Object>}
     */
    async fetchData(options = {}) {
        const dateRange = options.dateRange || this.getDefaultDateRange();

        this.emitSyncStatus('syncing', { platform: 'Google Ads' });

        try {
            const [campaigns, summary] = await Promise.all([
                this.fetchCampaigns(dateRange),
                this.fetchAccountSummary(dateRange)
            ]);

            const data = {
                campaigns: this.normalizeCampaigns(campaigns),
                summary,
                dateRange,
                fetchedAt: new Date().toISOString()
            };

            this.emitSyncStatus('complete', { platform: 'Google Ads', campaigns: campaigns.length });
            logAuditEvent('google_ads_sync', { campaigns: campaigns.length });

            return data;
        } catch (error) {
            this.emitSyncStatus('error', { platform: 'Google Ads', error: error.message });
            throw error;
        }
    }

    /**
     * Normalize campaign data to unified format
     * @param {Array} campaigns - Raw campaign data
     * @returns {Array}
     */
    normalizeCampaigns(campaigns) {
        return campaigns.map(row => ({
            source: DATA_SOURCES.GOOGLE_ADS,
            date: row.segments?.date,
            campaign_id: row.campaign?.id,
            campaign_name: row.campaign?.name,
            status: row.campaign?.status,
            channel: row.campaign?.advertisingChannelType,
            impressions: parseInt(row.metrics?.impressions || 0),
            clicks: parseInt(row.metrics?.clicks || 0),
            spend: (parseInt(row.metrics?.costMicros || 0) / 1000000),
            conversions: parseFloat(row.metrics?.conversions || 0),
            revenue: parseFloat(row.metrics?.conversionsValue || 0),
            ctr: parseFloat(row.metrics?.ctr || 0),
            cpc: (parseInt(row.metrics?.averageCpc || 0) / 1000000),
            currency: 'VND'
        }));
    }

    /**
     * Normalize data to unified schema
     * @param {Object} raw - Raw data
     * @returns {Object}
     */
    normalizeData(raw) {
        return {
            source: DATA_SOURCES.GOOGLE_ADS,
            date: raw.segments?.date,
            campaign_id: raw.campaign?.id,
            campaign_name: raw.campaign?.name,
            impressions: parseInt(raw.metrics?.impressions || 0),
            clicks: parseInt(raw.metrics?.clicks || 0),
            spend: (parseInt(raw.metrics?.costMicros || 0) / 1000000),
            conversions: parseFloat(raw.metrics?.conversions || 0),
            currency: 'VND'
        };
    }

    /**
     * Get metrics for unified dashboard
     * @param {Object} dateRange
     * @returns {Promise<Object>}
     */
    async getMetrics(dateRange) {
        const data = await this.fetchData({ dateRange });
        return {
            source: DATA_SOURCES.GOOGLE_ADS,
            ...data.summary,
            campaigns: data.campaigns.length
        };
    }

    /**
     * Get default date range (last 30 days)
     * @returns {Object}
     */
    getDefaultDateRange() {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);

        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    }

    /**
     * Sync data incrementally (for Google Ads, this means last few days)
     * @param {string} since - ISO timestamp (not used directly for Ads)
     * @returns {Promise<Object>}
     */
    async syncIncremental(since) {
        // Google Ads doesn't have incremental sync in the same way
        // Instead, we fetch last 7 days to catch any updates
        const dateRange = {
            start: new Date(since).toISOString().split('T')[0],
            end: new Date().toISOString().split('T')[0]
        };

        return this.fetchData({ dateRange });
    }
}

export default GoogleAdsConnector;
