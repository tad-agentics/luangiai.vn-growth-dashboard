// Growth Intelligence Platform - Ads Manager
// ==========================================

import { getSupabaseClient, logAuditEvent } from '../config/supabase.js';
import { DATA_SOURCES, CHART_COLORS } from '../config/constants.js';

/**
 * AdsManager - Handles Ads tab UI and data display
 */
export class AdsManager {
    constructor() {
        this.charts = {};
        this.platformData = {
            google: null,
            meta: null,
            tiktok: null
        };
        this.connectionStatus = {
            google: false,
            meta: false,
            tiktok: false
        };
    }

    /**
     * Initialize the Ads Manager
     */
    async init() {
        await this.checkConnectionStatus();
        this.initCharts();
        this.bindEvents();
    }

    /**
     * Check which platforms are connected
     */
    async checkConnectionStatus() {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        try {
            const { data, error } = await supabase
                .from('oauth_tokens')
                .select('provider, account_name, expires_at')
                .in('provider', ['google_ads', 'meta_ads', 'tiktok_ads']);

            if (error) throw error;

            data?.forEach(token => {
                const isExpired = new Date(token.expires_at) < new Date();
                const platform = token.provider.replace('_ads', '');

                this.connectionStatus[platform] = !isExpired;
                this.updateConnectionUI(platform, !isExpired, token.account_name);
            });
        } catch (e) {
            console.error('Failed to check ad platform connections:', e);
        }
    }

    /**
     * Update connection status UI
     * @param {string} platform - Platform name
     * @param {boolean} connected - Connection status
     * @param {string} accountName - Account name if connected
     */
    updateConnectionUI(platform, connected, accountName = '') {
        const statusEl = document.getElementById(`${platform}AdsStatus`);
        const btnEl = document.getElementById(`${platform}AdsBtn`);

        if (statusEl) {
            if (connected) {
                statusEl.textContent = accountName || 'Connected';
                statusEl.classList.remove('text-gray-400');
                statusEl.classList.add('text-green-400');
            } else {
                statusEl.textContent = 'Not connected';
                statusEl.classList.remove('text-green-400');
                statusEl.classList.add('text-gray-400');
            }
        }

        if (btnEl) {
            if (connected) {
                btnEl.textContent = 'Refresh';
                btnEl.classList.remove('bg-blue-600', 'bg-indigo-600', 'bg-pink-600');
                btnEl.classList.add('bg-gray-600');
            } else {
                btnEl.textContent = 'Connect';
            }
        }
    }

    /**
     * Initialize charts for Ads tab
     */
    initCharts() {
        // Spend by Platform Chart
        const spendCtx = document.getElementById('adsSpendChart')?.getContext('2d');
        if (spendCtx) {
            this.charts.spend = new Chart(spendCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Google Ads', 'Meta Ads', 'TikTok Ads'],
                    datasets: [{
                        data: [0, 0, 0],
                        backgroundColor: ['#3b82f6', '#6366f1', '#ec4899'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: '#9ca3af', padding: 20 }
                        }
                    }
                }
            });
        }

        // Conversions by Platform Chart
        const convCtx = document.getElementById('adsConversionsChart')?.getContext('2d');
        if (convCtx) {
            this.charts.conversions = new Chart(convCtx, {
                type: 'bar',
                data: {
                    labels: ['Google Ads', 'Meta Ads', 'TikTok Ads'],
                    datasets: [{
                        label: 'Conversions',
                        data: [0, 0, 0],
                        backgroundColor: ['#3b82f6', '#6366f1', '#ec4899']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255,255,255,0.1)' },
                            ticks: { color: '#9ca3af' }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#9ca3af' }
                        }
                    }
                }
            });
        }

        // Daily Spend Trend Chart
        const dailyCtx = document.getElementById('adsDailySpendChart')?.getContext('2d');
        if (dailyCtx) {
            this.charts.dailySpend = new Chart(dailyCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'Google Ads',
                            data: [],
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            fill: true,
                            tension: 0.3
                        },
                        {
                            label: 'Meta Ads',
                            data: [],
                            borderColor: '#6366f1',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            fill: true,
                            tension: 0.3
                        },
                        {
                            label: 'TikTok Ads',
                            data: [],
                            borderColor: '#ec4899',
                            backgroundColor: 'rgba(236, 72, 153, 0.1)',
                            fill: true,
                            tension: 0.3
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: { color: '#9ca3af' }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255,255,255,0.1)' },
                            ticks: { color: '#9ca3af' }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#9ca3af' }
                        }
                    }
                }
            });
        }
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Campaign filter change
        document.getElementById('adsCampaignFilter')?.addEventListener('change', () => {
            this.updateCampaignTable();
        });

        // Campaign sort change
        document.getElementById('adsCampaignSort')?.addEventListener('change', () => {
            this.updateCampaignTable();
        });
    }

    /**
     * Load and display ads data
     * @param {Object} adsData - Aggregated ads data from all platforms
     */
    async loadAdsData(adsData) {
        if (!adsData) return;

        this.platformData = adsData;
        this.updateMetrics(adsData);
        this.updateCharts(adsData);
        this.updatePlatformTable(adsData);
        this.updateCampaignTable();
    }

    /**
     * Update aggregated metrics
     * @param {Object} data - Ads data
     */
    updateMetrics(data) {
        const totals = this.calculateTotals(data);

        // Update UI
        const setEl = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };

        setEl('adsTotalSpend', this.formatCurrency(totals.spend));
        setEl('adsTotalImpressions', this.formatNumber(totals.impressions));
        setEl('adsTotalClicks', this.formatNumber(totals.clicks));
        setEl('adsTotalCTR', `CTR: ${totals.ctr.toFixed(2)}%`);
        setEl('adsTotalConversions', this.formatNumber(totals.conversions));
        setEl('adsTotalCVR', `CVR: ${totals.cvr.toFixed(2)}%`);
        setEl('adsAvgCPA', this.formatCurrency(totals.cpa));
    }

    /**
     * Calculate totals from all platforms
     * @param {Object} data - Platform data
     * @returns {Object} Totals
     */
    calculateTotals(data) {
        let spend = 0, impressions = 0, clicks = 0, conversions = 0;

        ['google', 'meta', 'tiktok'].forEach(platform => {
            if (data[platform]?.summary) {
                const s = data[platform].summary;
                spend += s.spend || 0;
                impressions += s.impressions || 0;
                clicks += s.clicks || 0;
                conversions += s.conversions || 0;
            }
        });

        return {
            spend,
            impressions,
            clicks,
            conversions,
            ctr: impressions > 0 ? (clicks / impressions * 100) : 0,
            cvr: clicks > 0 ? (conversions / clicks * 100) : 0,
            cpa: conversions > 0 ? (spend / conversions) : 0
        };
    }

    /**
     * Update charts with new data
     * @param {Object} data - Ads data
     */
    updateCharts(data) {
        // Spend chart
        if (this.charts.spend) {
            const spendData = [
                data.google?.summary?.spend || 0,
                data.meta?.summary?.spend || 0,
                data.tiktok?.summary?.spend || 0
            ];
            this.charts.spend.data.datasets[0].data = spendData;
            this.charts.spend.update();
        }

        // Conversions chart
        if (this.charts.conversions) {
            const convData = [
                data.google?.summary?.conversions || 0,
                data.meta?.summary?.conversions || 0,
                data.tiktok?.summary?.conversions || 0
            ];
            this.charts.conversions.data.datasets[0].data = convData;
            this.charts.conversions.update();
        }

        // Daily spend trend
        if (this.charts.dailySpend && data.dailyTrend) {
            const labels = data.dailyTrend.dates || [];
            this.charts.dailySpend.data.labels = labels;
            this.charts.dailySpend.data.datasets[0].data = data.dailyTrend.google || [];
            this.charts.dailySpend.data.datasets[1].data = data.dailyTrend.meta || [];
            this.charts.dailySpend.data.datasets[2].data = data.dailyTrend.tiktok || [];
            this.charts.dailySpend.update();
        }
    }

    /**
     * Update platform performance table
     * @param {Object} data - Ads data
     */
    updatePlatformTable(data) {
        const tbody = document.getElementById('adsPlatformTable');
        if (!tbody) return;

        const platforms = [
            { key: 'google', name: 'Google Ads', icon: 'fab fa-google', color: 'text-blue-400' },
            { key: 'meta', name: 'Meta Ads', icon: 'fab fa-meta', color: 'text-indigo-400' },
            { key: 'tiktok', name: 'TikTok Ads', icon: 'fab fa-tiktok', color: 'text-pink-400' }
        ];

        let html = '';
        let hasData = false;

        platforms.forEach(p => {
            const s = data[p.key]?.summary;
            if (s) {
                hasData = true;
                const ctr = s.impressions > 0 ? (s.clicks / s.impressions * 100) : 0;
                const cpa = s.conversions > 0 ? (s.spend / s.conversions) : 0;
                const roas = s.spend > 0 ? ((s.revenue || 0) / s.spend) : 0;

                html += `
                    <tr class="border-b border-gray-800 hover:bg-gray-800/50">
                        <td class="py-3">
                            <span class="flex items-center gap-2">
                                <i class="${p.icon} ${p.color}"></i>
                                ${p.name}
                            </span>
                        </td>
                        <td class="text-right py-3">${this.formatCurrency(s.spend)}</td>
                        <td class="text-right py-3">${this.formatNumber(s.impressions)}</td>
                        <td class="text-right py-3">${this.formatNumber(s.clicks)}</td>
                        <td class="text-right py-3">${ctr.toFixed(2)}%</td>
                        <td class="text-right py-3">${this.formatNumber(s.conversions)}</td>
                        <td class="text-right py-3">${this.formatCurrency(cpa)}</td>
                        <td class="text-right py-3">${roas > 0 ? roas.toFixed(2) + 'x' : '-'}</td>
                    </tr>
                `;
            }
        });

        if (!hasData) {
            html = `
                <tr class="border-b border-gray-800">
                    <td colspan="8" class="py-4 text-center text-gray-500">
                        Connect ad platforms to view performance data
                    </td>
                </tr>
            `;
        }

        tbody.innerHTML = html;
    }

    /**
     * Update campaign table with filtering and sorting
     */
    updateCampaignTable() {
        const tbody = document.getElementById('adsCampaignTable');
        if (!tbody) return;

        const filterEl = document.getElementById('adsCampaignFilter');
        const sortEl = document.getElementById('adsCampaignSort');
        const filter = filterEl?.value || 'all';
        const sort = sortEl?.value || 'spend';

        // Collect all campaigns
        let campaigns = [];

        ['google', 'meta', 'tiktok'].forEach(platform => {
            if (filter !== 'all' && filter !== platform) return;

            const platformCampaigns = this.platformData[platform]?.campaigns || [];
            platformCampaigns.forEach(c => {
                campaigns.push({
                    ...c,
                    platform,
                    platformName: platform === 'google' ? 'Google' :
                                 platform === 'meta' ? 'Meta' : 'TikTok'
                });
            });
        });

        // Sort campaigns
        campaigns.sort((a, b) => {
            switch (sort) {
                case 'conversions':
                    return (b.conversions || 0) - (a.conversions || 0);
                case 'cpa':
                    const cpA = a.conversions > 0 ? a.spend / a.conversions : Infinity;
                    const cpB = b.conversions > 0 ? b.spend / b.conversions : Infinity;
                    return cpA - cpB;
                case 'roas':
                    const roasA = a.spend > 0 ? (a.revenue || 0) / a.spend : 0;
                    const roasB = b.spend > 0 ? (b.revenue || 0) / b.spend : 0;
                    return roasB - roasA;
                default: // spend
                    return (b.spend || 0) - (a.spend || 0);
            }
        });

        // Take top 10
        campaigns = campaigns.slice(0, 10);

        if (campaigns.length === 0) {
            tbody.innerHTML = `
                <tr class="border-b border-gray-800">
                    <td colspan="8" class="py-4 text-center text-gray-500">
                        No campaign data available
                    </td>
                </tr>
            `;
            return;
        }

        const platformColors = {
            google: 'text-blue-400',
            meta: 'text-indigo-400',
            tiktok: 'text-pink-400'
        };

        const platformIcons = {
            google: 'fab fa-google',
            meta: 'fab fa-meta',
            tiktok: 'fab fa-tiktok'
        };

        let html = '';
        campaigns.forEach(c => {
            const ctr = c.impressions > 0 ? (c.clicks / c.impressions * 100) : 0;
            const cpa = c.conversions > 0 ? (c.spend / c.conversions) : 0;

            html += `
                <tr class="border-b border-gray-800 hover:bg-gray-800/50">
                    <td class="py-3 max-w-xs truncate" title="${c.campaign_name || c.name || 'Unnamed'}">
                        ${c.campaign_name || c.name || 'Unnamed Campaign'}
                    </td>
                    <td class="py-3">
                        <span class="flex items-center gap-1 ${platformColors[c.platform]}">
                            <i class="${platformIcons[c.platform]} text-xs"></i>
                            ${c.platformName}
                        </span>
                    </td>
                    <td class="text-right py-3">${this.formatCurrency(c.spend)}</td>
                    <td class="text-right py-3">${this.formatNumber(c.impressions)}</td>
                    <td class="text-right py-3">${this.formatNumber(c.clicks)}</td>
                    <td class="text-right py-3">${ctr.toFixed(2)}%</td>
                    <td class="text-right py-3">${this.formatNumber(c.conversions)}</td>
                    <td class="text-right py-3">${this.formatCurrency(cpa)}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    /**
     * Format currency (VND)
     * @param {number} value - Value to format
     * @returns {string} Formatted currency
     */
    formatCurrency(value) {
        if (value === null || value === undefined) return '-';
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            maximumFractionDigits: 0
        }).format(value);
    }

    /**
     * Format number with comma separators
     * @param {number} value - Value to format
     * @returns {string} Formatted number
     */
    formatNumber(value) {
        if (value === null || value === undefined) return '-';
        return new Intl.NumberFormat('vi-VN').format(value);
    }

    /**
     * Connect to Google Ads (initiate OAuth)
     */
    connectGoogleAds() {
        window.location.href = '/api/oauth/google/init';
    }

    /**
     * Connect to Meta Ads (initiate OAuth)
     */
    connectMetaAds() {
        window.location.href = '/api/oauth/meta/init';
    }

    /**
     * Connect to TikTok Ads (initiate OAuth)
     */
    connectTikTokAds() {
        window.location.href = '/api/oauth/tiktok/init';
    }
}

// Singleton instance
let adsManagerInstance = null;

/**
 * Get AdsManager singleton
 * @returns {AdsManager}
 */
export function getAdsManager() {
    if (!adsManagerInstance) {
        adsManagerInstance = new AdsManager();
    }
    return adsManagerInstance;
}

// Global functions for onclick handlers
window.connectGoogleAds = () => getAdsManager().connectGoogleAds();
window.connectMetaAds = () => getAdsManager().connectMetaAds();
window.connectTikTokAds = () => getAdsManager().connectTikTokAds();

export default AdsManager;
