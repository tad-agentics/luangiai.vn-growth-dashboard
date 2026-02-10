// Growth Intelligence Platform - Meta (Facebook) Ads Connector
// =============================================================

import { BaseConnector } from './BaseConnector.js';
import { getSupabaseClient, logAuditEvent } from '../config/supabase.js';
import { DATA_SOURCES } from '../config/constants.js';

/**
 * MetaAdsConnector - Handles Meta Marketing API interactions
 * Uses Graph API v18.0
 */
export class MetaAdsConnector extends BaseConnector {
    constructor(config = {}) {
        super(config);
        this.provider = DATA_SOURCES.META_ADS;
        this.accessToken = null;
        this.adAccountId = config.adAccountId || null;
        this.apiVersion = 'v18.0';

        // Initialize rate limiter (request budget: 200/hour)
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
                .eq('provider', 'meta_ads')
                .order('updated_at', { ascending: false })
                .limit(1)
                .single();

            if (error || !data) {
                console.log('No Meta Ads connection found');
                return false;
            }

            // Check if token is expired (Meta tokens last ~60 days)
            if (new Date(data.expires_at) < new Date()) {
                console.log('Meta token expired. Please reconnect.');
                return false;
            }

            this.accessToken = data.access_token;
            this.adAccountId = data.account_id;

            this.isConnected = true;
            this.emitSyncStatus('connected');
            return true;
        } catch (e) {
            console.error('Meta Ads authentication failed:', e);
            return false;
        }
    }

    /**
     * Test connection to Meta Ads
     * @returns {Promise<boolean>}
     */
    async testConnection() {
        try {
            const accounts = await this.getAdAccounts();
            return accounts.length > 0;
        } catch {
            return false;
        }
    }

    /**
     * Make a Meta Graph API call
     * @param {string} endpoint - API endpoint
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>}
     */
    async graphApi(endpoint, params = {}) {
        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }

        return this.withRateLimit(async () => {
            const url = new URL(`https://graph.facebook.com/${this.apiVersion}${endpoint}`);
            url.searchParams.set('access_token', this.accessToken);

            Object.entries(params).forEach(([key, value]) => {
                url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : value);
            });

            const response = await fetch(url.toString());

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `API error: ${response.status}`);
            }

            return response.json();
        });
    }

    /**
     * Get available ad accounts
     * @returns {Promise<Array>}
     */
    async getAdAccounts() {
        const response = await this.graphApi('/me/adaccounts', {
            fields: 'id,name,account_status,currency,amount_spent'
        });
        return response.data || [];
    }

    /**
     * Fetch campaign insights
     * @param {Object} dateRange - { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
     * @returns {Promise<Array>}
     */
    async fetchCampaignInsights(dateRange) {
        const response = await this.graphApi(`/act_${this.adAccountId}/insights`, {
            fields: [
                'campaign_id',
                'campaign_name',
                'impressions',
                'clicks',
                'spend',
                'actions',
                'action_values',
                'cpc',
                'cpm',
                'ctr',
                'frequency'
            ].join(','),
            level: 'campaign',
            time_range: { since: dateRange.start, until: dateRange.end },
            time_increment: 1  // Daily breakdown
        });

        return this.handlePagination(response);
    }

    /**
     * Fetch ad set insights
     * @param {Object} dateRange
     * @returns {Promise<Array>}
     */
    async fetchAdSetInsights(dateRange) {
        const response = await this.graphApi(`/act_${this.adAccountId}/insights`, {
            fields: [
                'adset_id',
                'adset_name',
                'campaign_id',
                'campaign_name',
                'impressions',
                'clicks',
                'spend',
                'actions',
                'cpc',
                'ctr'
            ].join(','),
            level: 'adset',
            time_range: { since: dateRange.start, until: dateRange.end }
        });

        return this.handlePagination(response);
    }

    /**
     * Fetch account-level summary
     * @param {Object} dateRange
     * @returns {Promise<Object>}
     */
    async fetchAccountSummary(dateRange) {
        const response = await this.graphApi(`/act_${this.adAccountId}/insights`, {
            fields: [
                'impressions',
                'clicks',
                'spend',
                'actions',
                'action_values',
                'cpc',
                'cpm',
                'ctr'
            ].join(','),
            time_range: { since: dateRange.start, until: dateRange.end }
        });

        const data = response.data?.[0] || {};

        // Extract conversions from actions
        const conversions = this.extractConversions(data.actions);
        const revenue = this.extractRevenue(data.action_values);

        return {
            impressions: parseInt(data.impressions || 0),
            clicks: parseInt(data.clicks || 0),
            spend: parseFloat(data.spend || 0),
            conversions,
            revenue,
            cpc: parseFloat(data.cpc || 0),
            cpm: parseFloat(data.cpm || 0),
            ctr: parseFloat(data.ctr || 0)
        };
    }

    /**
     * Handle API pagination
     * @param {Object} response - Initial response
     * @returns {Promise<Array>}
     */
    async handlePagination(response) {
        let allData = response.data || [];

        while (response.paging?.next) {
            const nextResponse = await fetch(response.paging.next);
            response = await nextResponse.json();
            allData = allData.concat(response.data || []);

            // Safety limit
            if (allData.length > 10000) break;
        }

        return allData;
    }

    /**
     * Extract conversions from actions array
     * @param {Array} actions - Meta actions array
     * @returns {number}
     */
    extractConversions(actions) {
        if (!actions) return 0;

        const conversionTypes = [
            'purchase',
            'lead',
            'complete_registration',
            'omni_purchase',
            'offsite_conversion.fb_pixel_purchase'
        ];

        return actions
            .filter(a => conversionTypes.some(t => a.action_type?.includes(t)))
            .reduce((sum, a) => sum + parseInt(a.value || 0), 0);
    }

    /**
     * Extract revenue from action values
     * @param {Array} actionValues - Meta action values array
     * @returns {number}
     */
    extractRevenue(actionValues) {
        if (!actionValues) return 0;

        const revenueTypes = ['purchase', 'omni_purchase'];

        return actionValues
            .filter(a => revenueTypes.some(t => a.action_type?.includes(t)))
            .reduce((sum, a) => sum + parseFloat(a.value || 0), 0);
    }

    /**
     * Fetch all data from Meta Ads
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async fetchData(options = {}) {
        const dateRange = options.dateRange || this.getDefaultDateRange();

        this.emitSyncStatus('syncing', { platform: 'Meta Ads' });

        try {
            const [campaigns, summary] = await Promise.all([
                this.fetchCampaignInsights(dateRange),
                this.fetchAccountSummary(dateRange)
            ]);

            const data = {
                campaigns: this.normalizeCampaigns(campaigns),
                summary,
                dateRange,
                fetchedAt: new Date().toISOString()
            };

            this.emitSyncStatus('complete', { platform: 'Meta Ads', campaigns: campaigns.length });
            logAuditEvent('meta_ads_sync', { campaigns: campaigns.length });

            return data;
        } catch (error) {
            this.emitSyncStatus('error', { platform: 'Meta Ads', error: error.message });
            throw error;
        }
    }

    /**
     * Normalize campaign data to unified format
     * @param {Array} campaigns
     * @returns {Array}
     */
    normalizeCampaigns(campaigns) {
        return campaigns.map(row => ({
            source: DATA_SOURCES.META_ADS,
            date: row.date_start,
            campaign_id: row.campaign_id,
            campaign_name: row.campaign_name,
            impressions: parseInt(row.impressions || 0),
            clicks: parseInt(row.clicks || 0),
            spend: parseFloat(row.spend || 0),
            conversions: this.extractConversions(row.actions),
            revenue: this.extractRevenue(row.action_values),
            ctr: parseFloat(row.ctr || 0),
            cpc: parseFloat(row.cpc || 0),
            cpm: parseFloat(row.cpm || 0),
            frequency: parseFloat(row.frequency || 0),
            currency: 'VND'
        }));
    }

    /**
     * Normalize data to unified schema
     * @param {Object} raw
     * @returns {Object}
     */
    normalizeData(raw) {
        return {
            source: DATA_SOURCES.META_ADS,
            date: raw.date_start,
            campaign_id: raw.campaign_id,
            campaign_name: raw.campaign_name,
            impressions: parseInt(raw.impressions || 0),
            clicks: parseInt(raw.clicks || 0),
            spend: parseFloat(raw.spend || 0),
            conversions: this.extractConversions(raw.actions),
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
            source: DATA_SOURCES.META_ADS,
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

export default MetaAdsConnector;
