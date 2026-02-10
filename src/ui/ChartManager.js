// Growth Intelligence Platform - Chart Manager
// =============================================

import { PERSONA_DEFINITIONS, ZODIAC_SIGNS, CHART_COLORS, CHART_DEFAULTS } from '../config/constants.js';

/**
 * ChartManager - Manages all Chart.js instances and updates
 */
export class ChartManager {
    constructor() {
        this.charts = {};
        this.initialized = false;
    }

    /**
     * Initialize all dashboard charts
     */
    initCharts() {
        if (this.initialized) return;

        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            console.error('Chart.js not loaded');
            return;
        }

        // Status Distribution Chart (Doughnut)
        this.createChart('statusChart', 'doughnut', {
            labels: ['Subscribed', 'Pending', 'Unsubscribed', 'Bounced'],
            datasets: [{
                data: [0, 0, 0, 0],
                backgroundColor: [CHART_COLORS.success, CHART_COLORS.warning, CHART_COLORS.gray, CHART_COLORS.danger]
            }]
        });

        // Persona Distribution Chart (Doughnut)
        this.createChart('personaChart', 'doughnut', {
            labels: Object.values(PERSONA_DEFINITIONS).map(p => p.name),
            datasets: [{
                data: new Array(Object.keys(PERSONA_DEFINITIONS).length).fill(0),
                backgroundColor: Object.values(PERSONA_DEFINITIONS).map(p => p.color)
            }]
        });

        // Age Distribution Chart (Bar)
        this.createChart('ageChart', 'bar', {
            labels: ['18-24', '25-34', '35-44', '45-54', '55+', 'Unknown'],
            datasets: [{
                label: 'Subscribers',
                data: [0, 0, 0, 0, 0, 0],
                backgroundColor: CHART_COLORS.primary
            }]
        }, {
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#9ca3af' } },
                x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
            }
        });

        // Device Distribution Chart (Pie)
        this.createChart('deviceChart', 'pie', {
            labels: ['Mobile', 'Desktop', 'Tablet', 'Unknown'],
            datasets: [{
                data: [0, 0, 0, 0],
                backgroundColor: [CHART_COLORS.primary, CHART_COLORS.purple, CHART_COLORS.info, CHART_COLORS.gray]
            }]
        });

        // Persona Growth Chart (Line)
        this.createChart('personaGrowthChart', 'line', {
            labels: [],
            datasets: Object.entries(PERSONA_DEFINITIONS).map(([key, def]) => ({
                label: def.name,
                data: [],
                borderColor: def.color,
                backgroundColor: def.color + '20',
                fill: true,
                tension: 0.4
            }))
        }, {
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#9ca3af' } },
                x: { grid: { display: false }, ticks: { color: '#9ca3af', maxRotation: 45 } }
            }
        });

        // Acquisition Source Chart (Doughnut)
        this.createChart('sourceChart', 'doughnut', {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    CHART_COLORS.primary, CHART_COLORS.danger, CHART_COLORS.warning,
                    CHART_COLORS.success, CHART_COLORS.info, CHART_COLORS.purple,
                    CHART_COLORS.pink, CHART_COLORS.gray
                ]
            }]
        });

        // Daily Registrations Chart (Line with Area)
        this.createChart('registrationsChart', 'line', {
            labels: [],
            datasets: [
                {
                    label: 'Total',
                    data: [],
                    borderColor: CHART_COLORS.primary,
                    backgroundColor: CHART_COLORS.primary + '20',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Customers',
                    data: [],
                    borderColor: CHART_COLORS.success,
                    backgroundColor: CHART_COLORS.success + '20',
                    fill: true,
                    tension: 0.4
                }
            ]
        }, {
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#9ca3af' } },
                x: { grid: { display: false }, ticks: { color: '#9ca3af', maxRotation: 45 } }
            }
        });

        // Time to Convert Chart (Bar)
        this.createChart('timeToConvertChart', 'bar', {
            labels: ['0 days', '1 day', '2 days', '3-7 days', '8-14 days', '15-30 days', '31-60 days', '61+ days'],
            datasets: [{
                label: 'Conversions',
                data: [0, 0, 0, 0, 0, 0, 0, 0],
                backgroundColor: CHART_COLORS.success
            }]
        }, {
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#9ca3af' } },
                x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
            }
        });

        // Zodiac Distribution Chart (Bar)
        this.createChart('zodiacChart', 'bar', {
            labels: Object.keys(ZODIAC_SIGNS).map(sign => `${ZODIAC_SIGNS[sign].symbol} ${sign}`),
            datasets: [{
                label: 'Subscribers',
                data: new Array(12).fill(0),
                backgroundColor: Object.values(ZODIAC_SIGNS).map(z => z.color)
            }]
        }, {
            indexAxis: 'y',
            scales: {
                y: { grid: { display: false }, ticks: { color: '#9ca3af' } },
                x: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#9ca3af' } }
            }
        });

        // Gender Distribution Chart (Doughnut)
        this.createChart('genderChart', 'doughnut', {
            labels: ['Male', 'Female', 'Unknown'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: [CHART_COLORS.primary, CHART_COLORS.pink, CHART_COLORS.gray]
            }]
        });

        // Birth Time Chart (Pie)
        this.createChart('birthTimeChart', 'pie', {
            labels: ['Morning (5-12)', 'Afternoon (12-17)', 'Evening (17-21)', 'Night (21-5)', 'Unknown'],
            datasets: [{
                data: [0, 0, 0, 0, 0],
                backgroundColor: [CHART_COLORS.warning, CHART_COLORS.success, CHART_COLORS.purple, CHART_COLORS.primary, CHART_COLORS.gray]
            }]
        });

        // Element Distribution Chart (Doughnut)
        this.createChart('elementChart', 'doughnut', {
            labels: ['Kim (Metal)', 'Mộc (Wood)', 'Thủy (Water)', 'Hỏa (Fire)', 'Thổ (Earth)'],
            datasets: [{
                data: [0, 0, 0, 0, 0],
                backgroundColor: [CHART_COLORS.gray, CHART_COLORS.success, CHART_COLORS.primary, CHART_COLORS.danger, CHART_COLORS.warning]
            }]
        });

        this.initialized = true;
        console.log('Charts initialized');
    }

    /**
     * Create a new chart instance
     * @param {string} id - Canvas element ID
     * @param {string} type - Chart type
     * @param {Object} data - Chart data
     * @param {Object} extraOptions - Additional options
     */
    createChart(id, type, data, extraOptions = {}) {
        const canvas = document.getElementById(id);
        if (!canvas) {
            console.warn(`Canvas not found: ${id}`);
            return;
        }

        const ctx = canvas.getContext('2d');

        this.charts[id] = new Chart(ctx, {
            type,
            data,
            options: {
                ...CHART_DEFAULTS,
                ...extraOptions
            }
        });
    }

    /**
     * Update chart data
     * @param {string} id - Chart ID
     * @param {Object} data - New data
     */
    updateChart(id, data) {
        const chart = this.charts[id];
        if (!chart) return;

        if (data.labels) chart.data.labels = data.labels;
        if (data.datasets) {
            data.datasets.forEach((dataset, i) => {
                if (chart.data.datasets[i]) {
                    Object.assign(chart.data.datasets[i], dataset);
                }
            });
        }

        chart.update('none'); // Update without animation for performance
    }

    /**
     * Update status chart with contact data
     * @param {Object} contacts - Contact stats
     */
    updateStatusChart(contacts) {
        this.updateChart('statusChart', {
            datasets: [{
                data: [
                    contacts.subscribed || 0,
                    contacts.pending || 0,
                    contacts.unsubscribed || 0,
                    contacts.bounced || 0
                ]
            }]
        });
    }

    /**
     * Update persona chart
     * @param {Object} personas - Persona data
     */
    updatePersonaChart(personas) {
        const counts = Object.keys(PERSONA_DEFINITIONS).map(key => personas[key]?.count || 0);
        this.updateChart('personaChart', {
            datasets: [{ data: counts }]
        });
    }

    /**
     * Update age distribution chart
     * @param {Object} stats - Categorization stats with age buckets
     */
    updateAgeChart(stats) {
        const buckets = ['18-24', '25-34', '35-44', '45-54', '55+', 'Unknown'];
        const data = buckets.map(bucket => stats.ageBuckets?.[bucket] || 0);
        this.updateChart('ageChart', {
            datasets: [{ data }]
        });
    }

    /**
     * Update device distribution chart
     * @param {Object} stats - Categorization stats with device buckets
     */
    updateDeviceChart(stats) {
        const devices = ['Mobile', 'Desktop', 'Tablet', 'Unknown'];
        const data = devices.map(d => stats.deviceBuckets?.[d] || 0);
        this.updateChart('deviceChart', {
            datasets: [{ data }]
        });
    }

    /**
     * Update persona growth chart
     * @param {Object} growthData - Growth data by persona and date
     * @param {number} days - Number of days to show
     */
    updatePersonaGrowthChart(growthData, days = 30) {
        if (!growthData || Object.keys(growthData).length === 0) return;

        const dates = Object.keys(growthData[Object.keys(growthData)[0]] || {}).slice(-days);
        const labels = dates.map(d => {
            const date = new Date(d);
            return `${date.getMonth() + 1}/${date.getDate()}`;
        });

        const datasets = Object.entries(PERSONA_DEFINITIONS).map(([key, def]) => ({
            label: def.name,
            data: dates.map(d => growthData[key]?.[d] || 0),
            borderColor: def.color,
            backgroundColor: def.color + '20',
            fill: true,
            tension: 0.4
        }));

        this.updateChart('personaGrowthChart', { labels, datasets });
    }

    /**
     * Update acquisition source chart
     * @param {Object} sources - Source data
     */
    updateSourceChart(sources) {
        const sortedSources = Object.entries(sources)
            .filter(([name]) => name !== 'Unknown')
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 8);

        this.updateChart('sourceChart', {
            labels: sortedSources.map(([name]) => name),
            datasets: [{
                data: sortedSources.map(([, data]) => data.total)
            }]
        });
    }

    /**
     * Update daily registrations chart
     * @param {Object} dailyRegistrations - Daily registration data
     * @param {number} days - Number of days to show
     */
    updateRegistrationsChart(dailyRegistrations, days = 30) {
        const dates = Object.keys(dailyRegistrations).slice(-days);
        const labels = dates.map(d => {
            const date = new Date(d);
            return `${date.getMonth() + 1}/${date.getDate()}`;
        });

        this.updateChart('registrationsChart', {
            labels,
            datasets: [
                { data: dates.map(d => dailyRegistrations[d]?.total || 0) },
                { data: dates.map(d => dailyRegistrations[d]?.customers || 0) }
            ]
        });
    }

    /**
     * Update time to convert chart
     * @param {Object} distribution - Time to convert distribution
     */
    updateTimeToConvertChart(distribution) {
        const buckets = ['0', '1', '2', '3-7', '8-14', '15-30', '31-60', '61+'];
        this.updateChart('timeToConvertChart', {
            datasets: [{ data: buckets.map(b => distribution[b] || 0) }]
        });
    }

    /**
     * Update zodiac chart
     * @param {Object} zodiacStats - Zodiac distribution
     */
    updateZodiacChart(zodiacStats) {
        const data = Object.keys(ZODIAC_SIGNS).map(sign => zodiacStats[sign]?.count || 0);
        this.updateChart('zodiacChart', {
            datasets: [{ data }]
        });
    }

    /**
     * Update gender chart
     * @param {Object} genderStats - Gender distribution
     */
    updateGenderChart(genderStats) {
        this.updateChart('genderChart', {
            datasets: [{
                data: [
                    genderStats.Male?.count || 0,
                    genderStats.Female?.count || 0,
                    genderStats.Unknown?.count || 0
                ]
            }]
        });
    }

    /**
     * Update birth time chart
     * @param {Object} birthTimeStats - Birth time distribution
     */
    updateBirthTimeChart(birthTimeStats) {
        const periods = ['Morning (5-12)', 'Afternoon (12-17)', 'Evening (17-21)', 'Night (21-5)', 'Unknown'];
        this.updateChart('birthTimeChart', {
            datasets: [{
                data: periods.map(p => birthTimeStats[p]?.count || 0)
            }]
        });
    }

    /**
     * Update element chart
     * @param {Object} elementStats - Element distribution
     */
    updateElementChart(elementStats) {
        const elements = ['Kim', 'Mộc', 'Thủy', 'Hỏa', 'Thổ'];
        this.updateChart('elementChart', {
            datasets: [{
                data: elements.map(e => elementStats[e]?.count || 0)
            }]
        });
    }

    /**
     * Get chart instance
     * @param {string} id - Chart ID
     * @returns {Chart|null}
     */
    getChart(id) {
        return this.charts[id] || null;
    }

    /**
     * Destroy all charts
     */
    destroy() {
        Object.values(this.charts).forEach(chart => chart.destroy());
        this.charts = {};
        this.initialized = false;
    }
}

// Singleton instance
let chartManagerInstance = null;

/**
 * Get ChartManager singleton
 * @returns {ChartManager}
 */
export function getChartManager() {
    if (!chartManagerInstance) {
        chartManagerInstance = new ChartManager();
    }
    return chartManagerInstance;
}

export default ChartManager;
