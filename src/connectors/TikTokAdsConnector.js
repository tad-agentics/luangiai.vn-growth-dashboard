// Growth Intelligence Platform - TikTok Ads Connector
// ====================================================

import { BaseConnector } from './BaseConnector.js';
import { getSupabaseClient, logAuditEvent } from '../config/supabase.js';
import { DATA_SOURCES } from '../config/constants.js';

/**
 * TikTokAdsConnector - Handles TikTok Marketing API interactions
 * Uses TikTok Business API v1.3
 */
export class TikTokAdsConnector extends BaseConnector {
    constructor(config = {}) {
        super(config);
        this.provider = DATA_SOURCES.TIKTOK_ADS;
        this.accessToken = null;
        this.advertiserId = config.advertiserId || null;
        this.apiVersion = 'v1.3';
        this.baseUrl = 'https://business-api.tiktok.com/open_api';

        // Initialize rate limiter (sliding window: 10 req/minute)
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
                .eq('provider', 'tiktok_ads')
                .order('updated_at', { ascending: false })
                .limit(1)
                .single();

            if (error || !data) {
                console.log('No TikTok Ads connection found');
                return false;
            }

            // Check if token is expired
            if (new Date(data.expires_at) < new Date()) {
                // Try to refresh
                const refreshed = await this.refreshToken(data);
                if (!refreshed) return false;
            } else {
                this.accessToken = data.access_token;
                this.advertiserId = data.account_id;
            }

            this.isConnected = true;
            this.emitSyncStatus('connected');
            return true;
        } catch (e) {
            console.error('TikTok Ads authentication failed:', e);
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
            const response = await fetch(`${this.baseUrl}/${this.apiVersion}/oauth2/refresh_token/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    app_id: process.env.TIKTOK_APP_ID,
                    secret: process.env.TIKTOK_APP_SECRET,
                    refresh_token: tokenData.refresh_token,
                    grant_type: 'refresh_token'
                })
            });

            const data = await response.json();

            if (data.code !== 0) {
                console.error('Token refresh failed:', data.message);
                return false;
            }

            // Update token in database
            const supabase = getSupabaseClient();
            await supabase
                .from('oauth_tokens')
                .update({
                    access_token: data.data.access_token,
                    refresh_token: data.data.refresh_token,
                    expires_at: new Date(Date.now() + data.data.expires_in * 1000).toISOString()
                })
                .eq('id', tokenData.id);

            this.accessToken = data.data.access_token;
            return true;
        } catch (e) {
            console.error('Token refresh error:', e);
            return false;
        }
    }

    /**
     * Test connection to TikTok Ads
     * @returns {Promise<boolean>}
     */
    async testConnection() {
        try {
            const advertisers = await this.getAdvertisers();
            return advertisers.length > 0;
        } catch {
            return false;
        }
    }

    /**
     * Make a TikTok API call
     * @param {string} endpoint - API endpoint
     * @param {Object} params - Request parameters
     * @param {string} method - HTTP method
     * @returns {Promise<Object>}
     */
    async apiCall(endpoint, params = {}, method = 'GET') {
        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }

        return this.withRateLimit(async () => {
            const url = new URL(`${this.baseUrl}/${this.apiVersion}${endpoint}`);

            const options = {
                method,
                headers: {
                    'Access-Token': this.accessToken,
                    'Content-Type': 'application/json'
                }
            };

            if (method === 'GET') {
                Object.entries(params).forEach(([key, value]) => {
                    url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : value);
                });
            } else {
                options.body = JSON.stringify(params);
            }

            const response = await fetch(url.toString(), options);
            const data = await response.json();

            if (data.code !== 0) {
                throw new Error(data.message || `API error: ${data.code}`);
            }

            return data.data;
        });
    }

    /**
     * Get available advertiser accounts
     * @returns {Promise<Array>}
     */
    async getAdvertisers() {
        const data = await this.apiCall('/oauth2/advertiser/get/');
        return data?.list || [];
    }

    /**
     * Fetch campaign report
     * @param {Object} dateRange
     * @returns {Promise<Array>}
     */
    async fetchCampaignReport(dateRange) {
        const data = await this.apiCall('/report/integrated/get/', {
            advertiser_id: this.advertiserId,
            data_level: 'AUCTION_CAMPAIGN',
            dimensions: ['campaign_id', 'stat_time_day'],
            metrics: [
                'campaign_name',
                'spend',
                'impressions',
                'clicks',
                'conversion',
                'cost_per_conversion',
                'conversion_rate',
                'cpc',
                'cpm',
                'ctr'
            ],
            start_date: dateRange.start,
            end_date: dateRange.end,
            page_size: 1000
        }, 'GET');

        return data?.list || [];
    }

    /**
     * Fetch ad group report
     * @param {Object} dateRange
     * @returns {Promise<Array>}
     */
    async fetchAdGroupReport(dateRange) {
        const data = await this.apiCall('/report/integrated/get/', {
            advertiser_id: this.advertiserId,
            data_level: 'AUCTION_ADGROUP',
            dimensions: ['adgroup_id', 'stat_time_day'],
            metrics: [
                'adgroup_name',
                'campaign_id',
                'spend',
                'impressions',
                'clicks',
                'conversion'
            ],
            start_date: dateRange.start,
            end_date: dateRange.end,
            page_size: 1000
        }, 'GET');

        return data?.list || [];
    }

    /**
     * Fetch account-level summary
     * @param {Object} dateRange
     * @returns {Promise<Object>}
     */
    async fetchAccountSummary(dateRange) {
        const data = await this.apiCall('/report/integrated/get/', {
            advertiser_id: this.advertiserId,
            data_level: 'AUCTION_ADVERTISER',
            dimensions: ['advertiser_id'],
            metrics: [
                'spend',
                'impressions',
                'clicks',
                'conversion',
                'cost_per_conversion',
                'cpc',
                'cpm',
                'ctr'
            ],
            start_date: dateRange.start,
            end_date: dateRange.end
        }, 'GET');

        const row = data?.list?.[0]?.metrics || {};

        return {
            impressions: parseInt(row.impressions || 0),
            clicks: parseInt(row.clicks || 0),
            spend: parseFloat(row.spend || 0),
            conversions: parseInt(row.conversion || 0),
            cpc: parseFloat(row.cpc || 0),
            cpm: parseFloat(row.cpm || 0),
            ctr: parseFloat(row.ctr || 0),
            cpa: parseFloat(row.cost_per_conversion || 0)
        };
    }

    /**
     * Fetch all data from TikTok Ads
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async fetchData(options = {}) {
        const dateRange = options.dateRange || this.getDefaultDateRange();

        this.emitSyncStatus('syncing', { platform: 'TikTok Ads' });

        try {
            const [campaigns, summary] = await Promise.all([
                this.fetchCampaignReport(dateRange),
                this.fetchAccountSummary(dateRange)
            ]);

            const data = {
                campaigns: this.normalizeCampaigns(campaigns),
                summary,
                dateRange,
                fetchedAt: new Date().toISOString()
            };

            this.emitSyncStatus('complete', { platform: 'TikTok Ads', campaigns: campaigns.length });
            logAuditEvent('tiktok_ads_sync', { campaigns: campaigns.length });

            return data;
        } catch (error) {
            this.emitSyncStatus('error', { platform: 'TikTok Ads', error: error.message });
            throw error;
        }
    }

    /**
     * Normalize campaign data to unified format
     * @param {Array} campaigns
     * @returns {Array}
     */
    normalizeCampaigns(campaigns) {
        return campaigns.map(row => {
            const metrics = row.metrics || {};
            const dimensions = row.dimensions || {};

            return {
                source: DATA_SOURCES.TIKTOK_ADS,
                date: dimensions.stat_time_day,
                campaign_id: dimensions.campaign_id,
                campaign_name: metrics.campaign_name,
                impressions: parseInt(metrics.impressions || 0),
                clicks: parseInt(metrics.clicks || 0),
                spend: parseFloat(metrics.spend || 0),
                conversions: parseInt(metrics.conversion || 0),
                ctr: parseFloat(metrics.ctr || 0),
                cpc: parseFloat(metrics.cpc || 0),
                cpm: parseFloat(metrics.cpm || 0),
                cpa: parseFloat(metrics.cost_per_conversion || 0),
                cvr: parseFloat(metrics.conversion_rate || 0),
                currency: 'VND'
            };
        });
    }

    /**
     * Normalize data to unified schema
     * @param {Object} raw
     * @returns {Object}
     */
    normalizeData(raw) {
        const metrics = raw.metrics || {};
        const dimensions = raw.dimensions || {};

        return {
            source: DATA_SOURCES.TIKTOK_ADS,
            date: dimensions.stat_time_day,
            campaign_id: dimensions.campaign_id,
            campaign_name: metrics.campaign_name,
            impressions: parseInt(metrics.impressions || 0),
            clicks: parseInt(metrics.clicks || 0),
            spend: parseFloat(metrics.spend || 0),
            conversions: parseInt(metrics.conversion || 0),
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
            source: DATA_SOURCES.TIKTOK_ADS,
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
     * Sync incremental data
     * @param {string} since
     * @returns {Promise<Object>}
     */
    async syncIncremental(since) {
        const dateRange = {
            start: new Date(since).toISOString().split('T')[0],
            end: new Date().toISOString().split('T')[0]
        };

        return this.fetchData({ dateRange });
    }
}

export default TikTokAdsConnector;
