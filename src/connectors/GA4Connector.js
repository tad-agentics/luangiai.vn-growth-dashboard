// Growth Intelligence Platform - Google Analytics 4 Connector
// ===========================================================

import { BaseConnector } from './BaseConnector.js';
import { getSupabaseClient, logAuditEvent } from '../config/supabase.js';
import { DATA_SOURCES } from '../config/constants.js';

/**
 * GA4Connector - Handles Google Analytics 4 Data API interactions
 * Uses GA4 Data API v1beta
 */
export class GA4Connector extends BaseConnector {
    constructor(config = {}) {
        super(config);
        this.provider = DATA_SOURCES.GA4;
        this.accessToken = null;
        this.propertyId = config.propertyId || null;
        this.baseUrl = 'https://analyticsdata.googleapis.com/v1beta';

        // Initialize rate limiter (10 requests per second)
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
                .eq('provider', 'ga4')
                .order('updated_at', { ascending: false })
                .limit(1)
                .single();

            if (error || !data) {
                console.log('No GA4 connection found');
                return false;
            }

            // Check if token is expired
            if (new Date(data.expires_at) < new Date()) {
                const refreshed = await this.refreshToken(data);
                if (!refreshed) return false;
            } else {
                this.accessToken = data.access_token;
            }

            // Get property ID from metadata
            if (data.metadata?.properties?.length > 0) {
                this.propertyId = data.metadata.properties[0].id;
            }

            this.isConnected = true;
            this.emitSyncStatus('connected');
            return true;
        } catch (e) {
            console.error('GA4 authentication failed:', e);
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
     * Test connection to GA4
     * @returns {Promise<boolean>}
     */
    async testConnection() {
        try {
            const result = await this.runReport({
                dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
                metrics: [{ name: 'sessions' }],
                limit: 1
            });
            return result !== null;
        } catch {
            return false;
        }
    }

    /**
     * Run a GA4 report
     * @param {Object} reportConfig - Report configuration
     * @returns {Promise<Object>}
     */
    async runReport(reportConfig) {
        if (!this.accessToken || !this.propertyId) {
            throw new Error('Not authenticated or no property selected');
        }

        return this.withRateLimit(async () => {
            const response = await fetch(
                `${this.baseUrl}/properties/${this.propertyId.replace('properties/', '')}:runReport`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(reportConfig)
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'GA4 API error');
            }

            return response.json();
        });
    }

    /**
     * Fetch traffic overview
     * @param {Object} dateRange - Date range
     * @returns {Promise<Object>}
     */
    async fetchTrafficOverview(dateRange) {
        const report = await this.runReport({
            dateRanges: [{
                startDate: dateRange.start,
                endDate: dateRange.end
            }],
            metrics: [
                { name: 'sessions' },
                { name: 'totalUsers' },
                { name: 'newUsers' },
                { name: 'bounceRate' },
                { name: 'averageSessionDuration' },
                { name: 'screenPageViews' },
                { name: 'conversions' }
            ]
        });

        const row = report.rows?.[0]?.metricValues || [];

        return {
            sessions: parseInt(row[0]?.value || 0),
            users: parseInt(row[1]?.value || 0),
            newUsers: parseInt(row[2]?.value || 0),
            bounceRate: parseFloat(row[3]?.value || 0),
            avgSessionDuration: parseFloat(row[4]?.value || 0),
            pageViews: parseInt(row[5]?.value || 0),
            conversions: parseInt(row[6]?.value || 0)
        };
    }

    /**
     * Fetch traffic by channel
     * @param {Object} dateRange - Date range
     * @returns {Promise<Array>}
     */
    async fetchTrafficByChannel(dateRange) {
        const report = await this.runReport({
            dateRanges: [{
                startDate: dateRange.start,
                endDate: dateRange.end
            }],
            dimensions: [{ name: 'sessionDefaultChannelGroup' }],
            metrics: [
                { name: 'sessions' },
                { name: 'totalUsers' },
                { name: 'conversions' },
                { name: 'bounceRate' }
            ],
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
            limit: 10
        });

        return (report.rows || []).map(row => ({
            channel: row.dimensionValues?.[0]?.value || 'Unknown',
            sessions: parseInt(row.metricValues?.[0]?.value || 0),
            users: parseInt(row.metricValues?.[1]?.value || 0),
            conversions: parseInt(row.metricValues?.[2]?.value || 0),
            bounceRate: parseFloat(row.metricValues?.[3]?.value || 0)
        }));
    }

    /**
     * Fetch traffic by source/medium
     * @param {Object} dateRange - Date range
     * @returns {Promise<Array>}
     */
    async fetchTrafficBySourceMedium(dateRange) {
        const report = await this.runReport({
            dateRanges: [{
                startDate: dateRange.start,
                endDate: dateRange.end
            }],
            dimensions: [
                { name: 'sessionSource' },
                { name: 'sessionMedium' }
            ],
            metrics: [
                { name: 'sessions' },
                { name: 'totalUsers' },
                { name: 'conversions' }
            ],
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
            limit: 20
        });

        return (report.rows || []).map(row => ({
            source: row.dimensionValues?.[0]?.value || 'Unknown',
            medium: row.dimensionValues?.[1]?.value || 'Unknown',
            sessions: parseInt(row.metricValues?.[0]?.value || 0),
            users: parseInt(row.metricValues?.[1]?.value || 0),
            conversions: parseInt(row.metricValues?.[2]?.value || 0)
        }));
    }

    /**
     * Fetch top landing pages
     * @param {Object} dateRange - Date range
     * @returns {Promise<Array>}
     */
    async fetchTopLandingPages(dateRange) {
        const report = await this.runReport({
            dateRanges: [{
                startDate: dateRange.start,
                endDate: dateRange.end
            }],
            dimensions: [{ name: 'landingPage' }],
            metrics: [
                { name: 'sessions' },
                { name: 'conversions' },
                { name: 'bounceRate' },
                { name: 'averageSessionDuration' }
            ],
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
            limit: 20
        });

        return (report.rows || []).map(row => ({
            page: row.dimensionValues?.[0]?.value || '/',
            sessions: parseInt(row.metricValues?.[0]?.value || 0),
            conversions: parseInt(row.metricValues?.[1]?.value || 0),
            bounceRate: parseFloat(row.metricValues?.[2]?.value || 0),
            avgDuration: parseFloat(row.metricValues?.[3]?.value || 0)
        }));
    }

    /**
     * Fetch daily sessions trend
     * @param {Object} dateRange - Date range
     * @returns {Promise<Array>}
     */
    async fetchDailyTrend(dateRange) {
        const report = await this.runReport({
            dateRanges: [{
                startDate: dateRange.start,
                endDate: dateRange.end
            }],
            dimensions: [{ name: 'date' }],
            metrics: [
                { name: 'sessions' },
                { name: 'totalUsers' },
                { name: 'conversions' }
            ],
            orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }]
        });

        return (report.rows || []).map(row => ({
            date: row.dimensionValues?.[0]?.value || '',
            sessions: parseInt(row.metricValues?.[0]?.value || 0),
            users: parseInt(row.metricValues?.[1]?.value || 0),
            conversions: parseInt(row.metricValues?.[2]?.value || 0)
        }));
    }

    /**
     * Fetch device breakdown
     * @param {Object} dateRange - Date range
     * @returns {Promise<Array>}
     */
    async fetchDeviceBreakdown(dateRange) {
        const report = await this.runReport({
            dateRanges: [{
                startDate: dateRange.start,
                endDate: dateRange.end
            }],
            dimensions: [{ name: 'deviceCategory' }],
            metrics: [
                { name: 'sessions' },
                { name: 'conversions' }
            ]
        });

        return (report.rows || []).map(row => ({
            device: row.dimensionValues?.[0]?.value || 'Unknown',
            sessions: parseInt(row.metricValues?.[0]?.value || 0),
            conversions: parseInt(row.metricValues?.[1]?.value || 0)
        }));
    }

    /**
     * Fetch all GA4 data
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>}
     */
    async fetchData(options = {}) {
        const dateRange = options.dateRange || this.getDefaultDateRange();

        this.emitSyncStatus('syncing', { platform: 'GA4' });

        try {
            const [overview, channels, sources, pages, daily, devices] = await Promise.all([
                this.fetchTrafficOverview(dateRange),
                this.fetchTrafficByChannel(dateRange),
                this.fetchTrafficBySourceMedium(dateRange),
                this.fetchTopLandingPages(dateRange),
                this.fetchDailyTrend(dateRange),
                this.fetchDeviceBreakdown(dateRange)
            ]);

            const data = {
                overview,
                channels,
                sources,
                pages,
                daily,
                devices,
                dateRange,
                fetchedAt: new Date().toISOString()
            };

            this.emitSyncStatus('complete', { platform: 'GA4' });
            logAuditEvent('ga4_sync', { sessions: overview.sessions });

            return data;
        } catch (error) {
            this.emitSyncStatus('error', { platform: 'GA4', error: error.message });
            throw error;
        }
    }

    /**
     * Normalize data to unified schema
     * @param {Object} raw - Raw GA4 data
     * @returns {Object}
     */
    normalizeData(raw) {
        return {
            source: DATA_SOURCES.GA4,
            date: raw.date,
            sessions: raw.sessions || 0,
            users: raw.users || 0,
            pageViews: raw.pageViews || 0,
            bounceRate: raw.bounceRate || 0,
            conversions: raw.conversions || 0
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
            source: DATA_SOURCES.GA4,
            ...data.overview
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
     * @param {string} since - Start date
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

export default GA4Connector;
