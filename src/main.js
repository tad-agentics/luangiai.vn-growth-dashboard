// Growth Intelligence Platform - Main Bootstrap
// ==============================================

import { getDataStore } from './core/DataStore.js';
import { getEventBus } from './core/EventBus.js';
import { getSupabaseClient, loadConfigFromSupabase, logAuditEvent, FALLBACK_CONFIG } from './config/supabase.js';
import { FluentCRMConnector } from './connectors/FluentCRMConnector.js';
import { getPersonaEngine } from './analytics/PersonaEngine.js';
import { getGrowthEngine } from './analytics/GrowthEngine.js';
import { getChartManager } from './ui/ChartManager.js';
import { PERSONA_DEFINITIONS, ZODIAC_SIGNS } from './config/constants.js';

/**
 * GrowthIntelligencePlatform - Main application class
 * Orchestrates all modules and handles the dashboard lifecycle
 */
class GrowthIntelligencePlatform {
    constructor() {
        // Core services
        this.dataStore = getDataStore();
        this.eventBus = getEventBus();

        // Connectors
        this.fluentCRM = null;

        // Analytics engines
        this.personaEngine = getPersonaEngine();
        this.growthEngine = getGrowthEngine();

        // UI
        this.chartManager = getChartManager();
        this.currentTab = 'overview';
        this.growthPeriod = 30;

        // Bind methods
        this.refreshData = this.refreshData.bind(this);
        this.switchTab = this.switchTab.bind(this);
        this.setGrowthPeriod = this.setGrowthPeriod.bind(this);
    }

    /**
     * Initialize the platform
     */
    async init() {
        console.log('Initializing Growth Intelligence Platform...');

        // Hide connection modal
        const connectionModal = document.getElementById('connectionModal');
        if (connectionModal) connectionModal.classList.add('hidden');

        // Load config from Supabase
        let config = FALLBACK_CONFIG;
        try {
            const supabaseConfig = await loadConfigFromSupabase();
            if (supabaseConfig) {
                config = supabaseConfig;
                console.log('Loaded credentials from Supabase');
            }
        } catch (e) {
            console.log('Using fallback credentials:', e.message);
        }

        // Log dashboard access
        logAuditEvent('dashboard_load', { source: 'init', version: '2.0' });

        // Initialize FluentCRM connector
        this.fluentCRM = new FluentCRMConnector();

        // Connect to FluentCRM
        await this.connect(config.siteUrl, config.username, config.password);

        // Set up event listeners
        this.setupEventListeners();

        console.log('Platform initialized');
    }

    /**
     * Connect to FluentCRM
     */
    async connect(siteUrl, username, password) {
        try {
            await this.fluentCRM.authenticate(siteUrl, username, password);

            // Show dashboard
            document.getElementById('connectionModal')?.classList.add('hidden');
            document.getElementById('dashboard')?.classList.remove('hidden');

            // Initialize charts
            this.chartManager.initCharts();

            // Load data
            await this.refreshData();

            console.log('Dashboard running in manual refresh mode');
        } catch (error) {
            console.error('Connection failed:', error);
            this.showError(`Connection failed: ${error.message}`);
        }
    }

    /**
     * Refresh all dashboard data
     */
    async refreshData(forceFullSync = false) {
        console.log('Refreshing dashboard data...');

        try {
            // Fetch data from FluentCRM
            const crmData = await this.fluentCRM.fetchData({ forceFullSync });

            if (crmData) {
                // Update data store
                this.dataStore.set('crm.lists', crmData.lists);
                this.dataStore.set('crm.tags', crmData.tags);
                this.dataStore.set('crm.campaigns', crmData.campaigns);
                this.dataStore.set('crm.sequences', crmData.sequences);
                this.dataStore.set('crm.contacts', crmData.contacts);
                this.dataStore.set('crm.subscribers', crmData.subscribers);

                // Calculate analytics
                this.calculateAllAnalytics(crmData.subscribers);

                // Update UI
                this.updateDashboard();

                // Update timestamp
                document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
            }
        } catch (error) {
            console.error('Error refreshing data:', error);
        }
    }

    /**
     * Calculate all analytics from subscriber data
     */
    calculateAllAnalytics(subscribers) {
        // Persona categorization
        const { personas, categorizationStats } = this.personaEngine.categorizePersonas(subscribers);
        this.dataStore.set('crm.personas', personas);
        this.dataStore.set('crm.categorizationStats', categorizationStats);

        // Growth analytics
        const growthAnalytics = this.growthEngine.calculateGrowthAnalytics(subscribers);
        this.dataStore.set('crm.growthAnalytics', growthAnalytics);

        // Persona growth over time
        const personaGrowth = this.personaEngine.calculatePersonaGrowth(subscribers, 90);
        this.dataStore.set('crm.personaHistory', personaGrowth);

        // Astrology stats
        const astrologyStats = this.calculateAstrologyStats(subscribers);
        this.dataStore.set('crm.astrologyStats', astrologyStats);
    }

    /**
     * Calculate astrology statistics
     */
    calculateAstrologyStats(subscribers) {
        const zodiacStats = {};
        const genderStats = { Male: { count: 0, converted: 0 }, Female: { count: 0, converted: 0 }, Unknown: { count: 0, converted: 0 } };
        const birthTimeStats = {};
        const elementStats = { Kim: { count: 0 }, Mộc: { count: 0 }, Thủy: { count: 0 }, Hỏa: { count: 0 }, Thổ: { count: 0 } };

        // Initialize zodiac stats
        Object.keys(ZODIAC_SIGNS).forEach(sign => {
            zodiacStats[sign] = { count: 0, converted: 0 };
        });

        // Initialize birth time stats
        ['Morning (5-12)', 'Afternoon (12-17)', 'Evening (17-21)', 'Night (21-5)', 'Unknown'].forEach(period => {
            birthTimeStats[period] = { count: 0 };
        });

        subscribers.forEach(subscriber => {
            const dob = subscriber.date_of_birth ||
                       subscriber.custom_fields?.date_of_birth ||
                       subscriber.custom_fields?.dob || null;

            // Zodiac
            const zodiacSign = this.personaEngine.getZodiacSign(dob);
            if (zodiacSign && zodiacStats[zodiacSign]) {
                zodiacStats[zodiacSign].count++;
                if (this.personaEngine.checkConversion(subscriber)) {
                    zodiacStats[zodiacSign].converted++;
                }

                // Element
                const signInfo = ZODIAC_SIGNS[zodiacSign];
                if (signInfo && elementStats[signInfo.element]) {
                    elementStats[signInfo.element].count++;
                }
            }

            // Gender
            const genderValue = subscriber.custom_fields?.gender ||
                               subscriber.custom_fields?.gioi_tinh || null;
            const gender = this.personaEngine.parseGender(genderValue);
            genderStats[gender].count++;
            if (this.personaEngine.checkConversion(subscriber)) {
                genderStats[gender].converted++;
            }

            // Birth time
            const birthTime = subscriber.custom_fields?.birth_time ||
                             subscriber.custom_fields?.gio_sinh || null;
            const timePeriod = this.personaEngine.parseBirthTimePeriod(birthTime);
            if (birthTimeStats[timePeriod]) {
                birthTimeStats[timePeriod].count++;
            }
        });

        // Calculate CVRs
        Object.keys(zodiacStats).forEach(sign => {
            const z = zodiacStats[sign];
            z.cvr = z.count > 0 ? (z.converted / z.count * 100).toFixed(2) : 0;
        });

        Object.keys(genderStats).forEach(gender => {
            const g = genderStats[gender];
            g.cvr = g.count > 0 ? (g.converted / g.count * 100).toFixed(2) : 0;
        });

        return { zodiacStats, genderStats, birthTimeStats, elementStats };
    }

    /**
     * Update dashboard UI
     */
    updateDashboard() {
        const contacts = this.dataStore.get('crm.contacts');
        const personas = this.dataStore.get('crm.personas');
        const growthAnalytics = this.dataStore.get('crm.growthAnalytics');
        const astrologyStats = this.dataStore.get('crm.astrologyStats');
        const personaHistory = this.dataStore.get('crm.personaHistory');
        const categorizationStats = this.dataStore.get('crm.categorizationStats');

        // Update overview tab
        this.updateOverviewTab(contacts, personas, categorizationStats);

        // Update growth tab
        this.updateGrowthTab(growthAnalytics);

        // Update personas tab
        this.updatePersonasTab(personas, growthAnalytics);

        // Update astrology tab
        this.updateAstrologyTab(astrologyStats);

        // Update charts
        this.chartManager.updateStatusChart(contacts);
        this.chartManager.updatePersonaChart(personas);
        this.chartManager.updatePersonaGrowthChart(personaHistory, this.growthPeriod);

        if (growthAnalytics) {
            this.chartManager.updateSourceChart(growthAnalytics.sources);
            this.chartManager.updateRegistrationsChart(growthAnalytics.dailyRegistrations, this.growthPeriod);

            const ttcDistribution = this.growthEngine.calculateTimeToConvertDistribution(growthAnalytics.timeToConvert);
            this.chartManager.updateTimeToConvertChart(ttcDistribution);
        }

        if (astrologyStats) {
            this.chartManager.updateZodiacChart(astrologyStats.zodiacStats);
            this.chartManager.updateGenderChart(astrologyStats.genderStats);
            this.chartManager.updateBirthTimeChart(astrologyStats.birthTimeStats);
            this.chartManager.updateElementChart(astrologyStats.elementStats);
        }
    }

    /**
     * Update overview tab content
     */
    updateOverviewTab(contacts, personas, stats) {
        // Update metric cards
        this.updateElement('totalContacts', this.formatNumber(contacts?.total || 0));
        this.updateElement('subscribedCount', this.formatNumber(contacts?.subscribed || 0));
        this.updateElement('pendingCount', this.formatNumber(contacts?.pending || 0));
        this.updateElement('unsubscribedCount', this.formatNumber(contacts?.unsubscribed || 0));

        // Data quality indicators
        if (stats) {
            const total = Object.values(personas || {}).reduce((sum, p) => sum + (p.count || 0), 0) || 1;
            this.updateDataQuality('withAge', stats.withAge, total);
            this.updateDataQuality('withDevice', stats.withDevice, total);
            this.updateDataQuality('subscribed', stats.subscribed, total);
            this.updateDataQuality('tagged', stats.tagged, total);
        }
    }

    /**
     * Update growth tab content
     */
    updateGrowthTab(analytics) {
        if (!analytics) return;

        // Week over week
        const wowEl = document.getElementById('weekOverWeek');
        if (wowEl) {
            const change = analytics.weekOverWeekChange || 0;
            const sign = change > 0 ? '+' : '';
            wowEl.textContent = `${sign}${change}%`;
            wowEl.className = change > 0 ? 'text-green-400' : (change < 0 ? 'text-red-400' : 'text-gray-400');
        }

        this.updateElement('thisWeekNew', analytics.thisWeekNew || 0);
        this.updateElement('lastWeekNew', analytics.lastWeekNew || 0);
        this.updateElement('avgTimeToConvert', `${analytics.avgTimeToConvert || 0} days`);
        this.updateElement('totalCustomers', this.formatNumber(analytics.customers || 0));
        this.updateElement('totalLeads', this.formatNumber(analytics.leads || 0));

        // CVR
        const cvr = analytics.customers && (analytics.leads + analytics.customers) > 0
            ? ((analytics.customers / (analytics.leads + analytics.customers)) * 100).toFixed(2)
            : 0;
        this.updateElement('overallCVR', `${cvr}%`);
    }

    /**
     * Update personas tab content
     */
    updatePersonasTab(personas, analytics) {
        const container = document.getElementById('personaCards');
        if (!container || !personas) return;

        const bestChannels = analytics?.bestChannelByPersona || {};
        const personaStats = analytics?.personaStats || {};

        let html = '';
        Object.entries(personas).forEach(([key, persona]) => {
            const def = PERSONA_DEFINITIONS[key];
            const best = bestChannels[key] || {};
            const stats = personaStats[key] || {};

            html += `
                <div class="bg-gray-700/50 rounded-lg p-4 border-l-4" style="border-color: ${def.color}">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h4 class="font-semibold text-white">${def.name}</h4>
                            <p class="text-sm text-gray-400">${def.description}</p>
                        </div>
                        <span class="text-2xl font-bold text-white">${this.formatNumber(persona.count)}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div>
                            <span class="text-gray-400">CVR:</span>
                            <span class="text-white ml-1">${persona.cvr}%</span>
                        </div>
                        <div>
                            <span class="text-gray-400">Best Channel:</span>
                            <span class="text-white ml-1">${best.channel || def.bestChannel}</span>
                        </div>
                        <div>
                            <span class="text-gray-400">Avg Time:</span>
                            <span class="text-white ml-1">${stats.avgTimeToConvert?.toFixed(0) || '-'} days</span>
                        </div>
                        <div>
                            <span class="text-gray-400">Offer:</span>
                            <span class="text-white ml-1">${def.recommendedOffer}</span>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    /**
     * Update astrology tab content
     */
    updateAstrologyTab(stats) {
        if (!stats) return;

        // Update zodiac CVR table
        const zodiacTable = document.getElementById('zodiacCVRTable');
        if (zodiacTable && stats.zodiacStats) {
            const sorted = Object.entries(stats.zodiacStats)
                .filter(([, data]) => data.count > 0)
                .sort((a, b) => parseFloat(b[1].cvr) - parseFloat(a[1].cvr));

            let html = '';
            sorted.forEach(([sign, data]) => {
                const info = ZODIAC_SIGNS[sign];
                html += `
                    <tr class="border-b border-gray-700">
                        <td class="py-2">${info.symbol} ${sign}</td>
                        <td class="text-right">${this.formatNumber(data.count)}</td>
                        <td class="text-right">${data.cvr}%</td>
                    </tr>
                `;
            });
            zodiacTable.innerHTML = html;
        }
    }

    /**
     * Switch to a different tab
     */
    switchTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.add('hidden');
        });

        // Show selected tab
        const selectedTab = document.getElementById(`${tabName}Tab`);
        if (selectedTab) selectedTab.classList.remove('hidden');

        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active', 'border-blue-500', 'text-blue-400');
            btn.classList.add('border-transparent', 'text-gray-400');
        });

        const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active', 'border-blue-500', 'text-blue-400');
            activeBtn.classList.remove('border-transparent', 'text-gray-400');
        }

        this.currentTab = tabName;
    }

    /**
     * Set growth period for charts
     */
    setGrowthPeriod(days) {
        this.growthPeriod = days;

        // Update period buttons
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.classList.remove('bg-blue-600');
            btn.classList.add('bg-gray-700');
        });

        const activeBtn = document.querySelector(`[data-period="${days}"]`);
        if (activeBtn) {
            activeBtn.classList.add('bg-blue-600');
            activeBtn.classList.remove('bg-gray-700');
        }

        // Update charts
        const personaHistory = this.dataStore.get('crm.personaHistory');
        const growthAnalytics = this.dataStore.get('crm.growthAnalytics');

        this.chartManager.updatePersonaGrowthChart(personaHistory, days);
        if (growthAnalytics) {
            this.chartManager.updateRegistrationsChart(growthAnalytics.dailyRegistrations, days);
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTab(btn.dataset.tab);
            });
        });

        // Period buttons
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setGrowthPeriod(parseInt(btn.dataset.period));
            });
        });

        // Refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshData(false));
        }

        // Full sync button
        const fullSyncBtn = document.getElementById('fullSyncBtn');
        if (fullSyncBtn) {
            fullSyncBtn.addEventListener('click', () => this.refreshData(true));
        }
    }

    /**
     * Update DOM element text
     */
    updateElement(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    /**
     * Update data quality indicator
     */
    updateDataQuality(id, count, total) {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const el = document.getElementById(`quality_${id}`);
        if (el) {
            el.style.width = `${pct}%`;
            el.textContent = `${pct}%`;
        }
    }

    /**
     * Format number with thousand separators
     */
    formatNumber(num) {
        return new Intl.NumberFormat().format(num);
    }

    /**
     * Show error message
     */
    showError(message) {
        console.error(message);
        // Could add toast notification here
    }
}

// Initialize on DOM ready
let platform = null;

function initPlatform() {
    platform = new GrowthIntelligencePlatform();
    platform.init();

    // Expose for debugging and external access
    window.growthPlatform = platform;
}

// Start initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPlatform);
} else {
    initPlatform();
}

// Export for module usage
export { GrowthIntelligencePlatform, platform };
export default GrowthIntelligencePlatform;
