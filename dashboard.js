// Luangiai.vn CRM Dashboard - FluentCRM Integration
// ==================================================

// Supabase Configuration
const SUPABASE_URL = 'https://qktiedjahvbeuznpjubv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrdGllZGphaHZiZXV6bnBqdWJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTg1MDMsImV4cCI6MjA4NTY5NDUwM30.cpoTuuYlqHRgfJWnGIMnnyY7w2vPcLjRALb7X3Qm-Mo';

// Initialize Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fallback credentials (used if Supabase is unavailable)
const FALLBACK_CONFIG = {
    siteUrl: 'https://luangiai.vn',
    username: 'tad@accel3.com',
    password: 'dbC0 SxeB RRJ3 ANhK aZqj n3z3'
};

// Conversion Tags - Tags that indicate a user has converted/purchased
// Customize this array based on your FluentCRM tag structure
const CONVERSION_TAGS = [
    'paid', 'purchased', 'customer', 'buyer', 'converted',
    'order', 'subscription', 'premium', 'pro', 'vip',
    'thanh-toan', 'da-mua', 'khach-hang' // Vietnamese tags
];

// Persona Definitions based on Age + Device rules
const PERSONA_DEFINITIONS = {
    'gen_z_explorer': {
        name: 'Gen Z Explorer',
        color: '#f97316', // orange
        description: 'Young users (18-24), mobile-first, impulse buyers',
        ageGroups: ['18-24'],
        deviceTypes: null,
        priority: 'Low',
        bestChannel: 'TikTok Organic',
        recommendedOffer: '49K impulse offer',
        nurturePriority: 'Low - decide instantly'
    },
    'career_climber': {
        name: 'Career Climber',
        color: '#3b82f6', // blue
        description: 'Age 25-34, mobile users seeking career guidance',
        ageGroups: ['25-34'],
        deviceTypes: ['Mobile'],
        priority: 'High',
        bestChannel: 'Facebook Ads',
        recommendedOffer: '299K career-focused',
        nurturePriority: 'High - delayed converters'
    },
    'desktop_researcher': {
        name: 'Desktop Researcher',
        color: '#8b5cf6', // purple
        description: 'Age 25-44, desktop users, high CVR potential',
        ageGroups: ['25-34', '35-44'],
        deviceTypes: ['Desktop'],
        priority: 'High',
        bestChannel: 'SEO / Desktop FB',
        recommendedOffer: '299K full analysis',
        nurturePriority: 'Medium - high base CVR'
    },
    'life_transition': {
        name: 'Life Transition',
        color: '#06b6d4', // cyan
        description: 'Age 35-44, mobile users making major life decisions',
        ageGroups: ['35-44'],
        deviceTypes: ['Mobile'],
        priority: 'High',
        bestChannel: 'Zalo OA',
        recommendedOffer: '349K family package',
        nurturePriority: 'High - delayed converters'
    },
    'established_buyer': {
        name: 'Established Buyer',
        color: '#10b981', // green
        description: 'Age 45+, high AOV, premium segment',
        ageGroups: ['45-54', '55+'],
        deviceTypes: null,
        priority: 'Medium',
        bestChannel: 'Direct / Referral',
        recommendedOffer: '749K premium first',
        nurturePriority: 'Low - decide fast'
    },
    'mystery_visitor': {
        name: 'Mystery Visitor',
        color: '#6b7280', // gray
        description: 'Unknown profile, incomplete data',
        ageGroups: ['Unknown'],
        deviceTypes: null,
        priority: 'Low',
        bestChannel: 'Progressive profiling',
        recommendedOffer: '199K low-commitment',
        nurturePriority: 'Medium - needs profiling'
    }
};

// Helper: Parse DOB to age
function parseAge(dob) {
    if (!dob) return null;
    try {
        let birthDate;
        if (typeof dob === 'string') {
            const parts = dob.split(/[\/\-]/);
            if (parts.length === 3) {
                if (parseInt(parts[0]) > 31) {
                    birthDate = new Date(parts[0], parts[1] - 1, parts[2]);
                } else if (parseInt(parts[2]) > 31) {
                    birthDate = new Date(parts[2], parts[1] - 1, parts[0]);
                } else {
                    birthDate = new Date(parts[2], parts[1] - 1, parts[0]);
                }
            } else {
                birthDate = new Date(dob);
            }
        } else {
            birthDate = new Date(dob);
        }

        if (isNaN(birthDate.getTime())) return null;

        const today = new Date();
        const age = (today - birthDate) / (365.25 * 24 * 60 * 60 * 1000);
        return age;
    } catch (e) {
        return null;
    }
}

// Helper: Get age bucket
function getAgeBucket(age) {
    if (age === null || age === undefined || age < 0 || age > 120) return 'Unknown';
    if (age < 25) return '18-24';
    if (age < 35) return '25-34';
    if (age < 45) return '35-44';
    if (age < 55) return '45-54';
    return '55+';
}

// Helper: Get device type
function getDeviceType(subscriber) {
    const device = subscriber.custom_fields?.device ||
                   subscriber.device || subscriber.device_type ||
                   subscriber.custom_values?.device ||
                   subscriber.meta?.device ||
                   subscriber.user_agent || '';

    if (!device) return 'Unknown';

    const d = device.toLowerCase();

    if (d.includes('iphone') || d.includes('android') || d.includes('mobile')) {
        return 'Mobile';
    }
    if (d.includes('windows') || d.includes('mac') || d.includes('linux') ||
        d.includes('desktop') || (d.includes('apple') && !d.includes('iphone') && !d.includes('ipad'))) {
        return 'Desktop';
    }
    if (d.includes('ipad') || d.includes('tablet')) {
        return 'Tablet';
    }

    return 'Unknown';
}

// Helper: Assign persona
function assignPersona(ageGroup, deviceType) {
    if (ageGroup === '18-24') return 'gen_z_explorer';
    if (ageGroup === '25-34' && deviceType === 'Mobile') return 'career_climber';
    if ((ageGroup === '25-34' || ageGroup === '35-44') && deviceType === 'Desktop') return 'desktop_researcher';
    if (ageGroup === '35-44' && deviceType === 'Mobile') return 'life_transition';
    if (ageGroup === '45-54' || ageGroup === '55+') return 'established_buyer';
    return 'mystery_visitor';
}

// Helper: Parse gender (1 = Male, -1 = Female in your data)
function parseGender(genderValue) {
    if (genderValue === '1' || genderValue === 1) return 'Male';
    if (genderValue === '-1' || genderValue === -1) return 'Female';
    return 'Unknown';
}

// Vietnamese Eastern Zodiac (12 con giáp / Tử Vi) - based on birth year
// Each animal corresponds to a year in a 12-year cycle
// Order: Tý(Rat), Sửu(Buffalo), Dần(Tiger), Mão(Cat), Thìn(Dragon), Tị(Snake),
//        Ngọ(Horse), Mùi(Goat), Thân(Monkey), Dậu(Rooster), Tuất(Dog), Hợi(Pig)
const ZODIAC_SIGNS = {
    'Tý': { symbol: '🐀', animal: 'Chuột', element: 'Thủy', color: '#3b82f6', index: 0 },
    'Sửu': { symbol: '🐂', animal: 'Trâu', element: 'Thổ', color: '#8b5cf6', index: 1 },
    'Dần': { symbol: '🐅', animal: 'Hổ', element: 'Mộc', color: '#f97316', index: 2 },
    'Mão': { symbol: '🐇', animal: 'Mèo', element: 'Mộc', color: '#ec4899', index: 3 },
    'Thìn': { symbol: '🐉', animal: 'Rồng', element: 'Thổ', color: '#eab308', index: 4 },
    'Tị': { symbol: '🐍', animal: 'Rắn', element: 'Hỏa', color: '#ef4444', index: 5 },
    'Ngọ': { symbol: '🐎', animal: 'Ngựa', element: 'Hỏa', color: '#f43f5e', index: 6 },
    'Mùi': { symbol: '🐐', animal: 'Dê', element: 'Thổ', color: '#a855f7', index: 7 },
    'Thân': { symbol: '🐒', animal: 'Khỉ', element: 'Kim', color: '#6b7280', index: 8 },
    'Dậu': { symbol: '🐓', animal: 'Gà', element: 'Kim', color: '#fbbf24', index: 9 },
    'Tuất': { symbol: '🐕', animal: 'Chó', element: 'Thổ', color: '#22c55e', index: 10 },
    'Hợi': { symbol: '🐖', animal: 'Lợn', element: 'Thủy', color: '#06b6d4', index: 11 }
};

// Zodiac sign order for year calculation
const ZODIAC_ORDER = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tị', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

// Helper: Get Vietnamese zodiac sign from DOB (based on birth year)
// The cycle repeats every 12 years. 2020 = Tý (Rat), 2021 = Sửu, etc.
function getZodiacSign(dob) {
    if (!dob) return null;
    try {
        let birthDate;
        if (typeof dob === 'string') {
            const parts = dob.split(/[\/\-]/);
            if (parts.length === 3) {
                if (parseInt(parts[0]) > 31) {
                    birthDate = new Date(parts[0], parts[1] - 1, parts[2]);
                } else {
                    birthDate = new Date(parts[2], parts[1] - 1, parts[0]);
                }
            } else {
                birthDate = new Date(dob);
            }
        } else {
            birthDate = new Date(dob);
        }

        if (isNaN(birthDate.getTime())) return null;

        const year = birthDate.getFullYear();
        // 2020 is year of the Rat (Tý), index 0
        // Formula: (year - 2020) mod 12, adjusted for negative years
        const index = ((year - 2020) % 12 + 12) % 12;
        return ZODIAC_ORDER[index];
    } catch (e) {
        return null;
    }
}

// Helper: Parse birthtime to time period
function parseBirthTimePeriod(birthtime) {
    if (!birthtime) return 'Unknown';
    try {
        let hour;
        if (typeof birthtime === 'string') {
            const parts = birthtime.split(':');
            hour = parseInt(parts[0]);
        } else {
            hour = birthtime;
        }

        if (isNaN(hour)) return 'Unknown';

        if (hour >= 5 && hour < 12) return 'Morning (5-12)';
        if (hour >= 12 && hour < 17) return 'Afternoon (12-17)';
        if (hour >= 17 && hour < 21) return 'Evening (17-21)';
        return 'Night (21-5)';
    } catch (e) {
        return 'Unknown';
    }
}

class CRMDashboard {
    constructor() {
        this.apiBase = '';
        this.credentials = null;
        this.currentTab = 'overview';
        this.data = {
            contacts: { total: 0, subscribed: 0, pending: 0, unsubscribed: 0, bounced: 0, complained: 0 },
            lists: [],
            tags: [],
            campaigns: [],
            sequences: [],
            subscribers: [],
            personas: {},
            categorizationStats: {},
            personaHistory: {}, // Store historical persona data
            growthAnalytics: {}, // Store growth metrics
            astrologyStats: {} // Store zodiac, gender, birthtime data
        };
        this.charts = {};
        this.refreshInterval = null;
        this.growthPeriod = 30; // Default to 30 days

        this.init();
    }

    async init() {
        // Hide the connection modal immediately
        const connectionModal = document.getElementById('connectionModal');
        if (connectionModal) {
            connectionModal.classList.add('hidden');
        }

        // Load credentials from Supabase
        let config = FALLBACK_CONFIG;
        try {
            const { data, error } = await supabaseClient
                .from('config')
                .select('value')
                .eq('key', 'fluentcrm')
                .single();

            if (data && !error) {
                config = data.value;
                console.log('Loaded credentials from Supabase');
            } else {
                console.log('Using fallback credentials:', error?.message);
            }
        } catch (e) {
            console.log('Supabase unavailable, using fallback:', e.message);
        }

        // Log dashboard access to audit log
        this.logAuditEvent('dashboard_load', { source: 'init' });

        // Auto-connect using loaded credentials
        this.connectWithCredentials(config.siteUrl, config.username, config.password, false);
    }

    // Log events to Supabase audit log
    async logAuditEvent(action, details = {}) {
        try {
            await supabaseClient.from('audit_log').insert({
                action,
                details,
                user_agent: navigator.userAgent
            });
        } catch (e) {
            // Silently fail - audit logging is non-critical
        }
    }

    // Save daily metrics snapshot to Supabase
    async saveDailyMetrics() {
        const today = new Date().toISOString().split('T')[0];
        const metrics = {
            date: today,
            total_contacts: this.data.contacts.length,
            subscribed: this.data.contacts.filter(c => c.status === 'subscribed').length,
            pending: this.data.contacts.filter(c => c.status === 'pending').length,
            unsubscribed: this.data.contacts.filter(c => c.status === 'unsubscribed').length,
            bounced: this.data.contacts.filter(c => c.status === 'bounced').length,
            total_lists: this.data.lists.length,
            total_tags: this.data.tags.length,
            total_campaigns: this.data.campaigns.length,
            leads: this.data.contacts.filter(c => c.contact_type === 'lead').length,
            customers: this.data.contacts.filter(c => c.contact_type === 'customer').length,
            personas: this.data.personas || {},
            sources: this.data.growthAnalytics?.sourceBreakdown || {}
        };

        try {
            await supabaseClient.from('daily_metrics').upsert(metrics, { onConflict: 'date' });
            console.log('Saved daily metrics to Supabase');
        } catch (e) {
            console.log('Failed to save metrics:', e.message);
        }
    }

    async handleConnect() {
        const siteUrl = document.getElementById('siteUrl').value.trim().replace(/\/$/, '');
        const username = document.getElementById('apiUsername').value.trim();
        const password = document.getElementById('apiPassword').value.trim();
        const remember = document.getElementById('rememberCredentials').checked;

        if (!siteUrl || !username || !password) {
            this.showError('Please fill in all fields');
            return;
        }

        await this.connectWithCredentials(siteUrl, username, password, remember);
    }

    async connectWithCredentials(siteUrl, username, password, remember) {
        const connectBtn = document.getElementById('connectBtn');
        const spinner = document.getElementById('connectSpinner');
        const btnText = document.getElementById('connectBtnText');

        if (connectBtn) {
            connectBtn.disabled = true;
            spinner.classList.remove('hidden');
            btnText.textContent = 'Connecting...';
        }

        this.apiBase = `${siteUrl}/wp-json/fluent-crm/v2`;
        this.credentials = btoa(`${username}:${password}`);

        try {
            const response = await this.apiCall('/lists');
            if (response.error) throw new Error(response.error);

            if (remember) {
                localStorage.setItem('fluentcrm_credentials', JSON.stringify({ siteUrl, username, password }));
            }

            document.getElementById('connectionModal').classList.add('hidden');
            document.getElementById('dashboard').classList.remove('hidden');

            this.initCharts();
            await this.refreshData();

            // Auto-refresh every 5 minutes
            this.refreshInterval = setInterval(() => this.refreshData(), 5 * 60 * 1000);

        } catch (error) {
            this.showError(`Connection failed: ${error.message}`);
            // Clear invalid saved credentials
            localStorage.removeItem('fluentcrm_credentials');
            if (connectBtn) {
                connectBtn.disabled = false;
                spinner.classList.add('hidden');
                btnText.textContent = 'Connect to Dashboard';
            }
        }
    }

    async apiCall(endpoint, method = 'GET', body = null) {
        try {
            const options = {
                method,
                headers: {
                    'Authorization': `Basic ${this.credentials}`,
                    'Content-Type': 'application/json'
                }
            };

            if (body) options.body = JSON.stringify(body);

            console.log(`API Call: ${this.apiBase}${endpoint}`);
            const response = await fetch(`${this.apiBase}${endpoint}`, options);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            return { error: error.message };
        }
    }

    extractArray(response, key) {
        if (!response) return [];
        if (Array.isArray(response)) return response;

        const nested = response[key];
        if (!nested) return [];
        if (Array.isArray(nested)) return nested;
        if (nested.data && Array.isArray(nested.data)) return nested.data;

        if (typeof nested === 'object') {
            const keys = Object.keys(nested);
            const itemKeys = keys.filter(k => !['total', 'per_page', 'current_page', 'last_page', 'next_page_url', 'prev_page_url', 'from', 'to'].includes(k));
            if (itemKeys.length > 0) {
                return itemKeys.map(k => nested[k]).filter(v => v && typeof v === 'object');
            }
        }

        return [];
    }

    async refreshData() {
        console.log('Refreshing dashboard data...');

        try {
            const [listsData, tagsData, campaignsData, sequencesData] = await Promise.all([
                this.apiCall('/lists'),
                this.apiCall('/tags'),
                this.apiCall('/campaigns?per_page=100'),
                this.apiCall('/sequences?per_page=100')
            ]);

            await this.fetchContactStats();

            this.data.lists = this.extractArray(listsData, 'lists');
            this.data.tags = this.extractArray(tagsData, 'tags');
            this.data.campaigns = this.extractArray(campaignsData, 'campaigns');
            this.data.sequences = this.extractArray(sequencesData, 'sequences');

            await this.fetchSubscribers();
            this.categorizePersonas();
            this.calculatePersonaGrowth();
            this.calculateGrowthAnalytics();
            this.calculateAstrologyStats();
            this.savePersonaHistory();
            this.updateDashboard();

            // Save daily metrics to Supabase
            this.saveDailyMetrics();

            document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();

        } catch (error) {
            console.error('Error refreshing data:', error);
        }
    }

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

        try {
            const allResponse = await this.apiCall('/subscribers?per_page=1');
            if (allResponse.total && allResponse.total > stats.total) {
                stats.total = allResponse.total;
            } else if (allResponse.subscribers?.total && allResponse.subscribers.total > stats.total) {
                stats.total = allResponse.subscribers.total;
            }
        } catch (e) {
            console.log('Could not fetch all subscribers:', e);
        }

        this.data.contacts = stats;
    }

    async fetchSubscribers() {
        try {
            let allSubscribers = [];
            let page = 1;
            const perPage = 500;
            const knownTotal = this.data.contacts.total || 15000;

            console.log(`Fetching all ${knownTotal} subscribers...`);

            while (allSubscribers.length < knownTotal && page <= 50) {
                const response = await this.apiCall(`/subscribers?per_page=${perPage}&page=${page}&with[]=tags&custom_fields=true`);
                const subscribers = response.subscribers?.data || response.data || this.extractArray(response, 'subscribers') || [];

                if (subscribers.length === 0) break;

                allSubscribers = allSubscribers.concat(subscribers);
                console.log(`Fetched page ${page}: ${subscribers.length} (total: ${allSubscribers.length})`);

                if (subscribers.length < perPage) break;
                page++;
            }

            console.log(`Total subscribers fetched: ${allSubscribers.length}`);
            this.data.subscribers = allSubscribers;
        } catch (e) {
            console.log('Could not fetch subscribers:', e);
            this.data.subscribers = [];
        }
    }

    categorizePersonas() {
        const personas = {};
        Object.keys(PERSONA_DEFINITIONS).forEach(key => {
            personas[key] = {
                ...PERSONA_DEFINITIONS[key],
                count: 0,
                subscribed: 0,
                converted: 0, // Track conversions
                contacts: [],
                ageDistribution: {},
                deviceDistribution: {}
            };
        });

        const stats = {
            totalProcessed: 0,
            withDOB: 0,
            withDevice: 0,
            totalConverted: 0,
            ageGroups: {},
            deviceTypes: {}
        };

        this.data.subscribers.forEach(subscriber => {
            stats.totalProcessed++;

            const dob = subscriber.custom_fields?.dob ||
                        subscriber.custom_fields?.date_of_birth ||
                        subscriber.custom_fields?.birthday ||
                        subscriber.date_of_birth ||
                        subscriber.dob ||
                        null;

            const age = parseAge(dob);
            const ageGroup = getAgeBucket(age);

            if (age !== null) stats.withDOB++;

            const deviceType = getDeviceType(subscriber);
            if (deviceType !== 'Unknown') stats.withDevice++;

            stats.ageGroups[ageGroup] = (stats.ageGroups[ageGroup] || 0) + 1;
            stats.deviceTypes[deviceType] = (stats.deviceTypes[deviceType] || 0) + 1;

            const personaKey = assignPersona(ageGroup, deviceType);

            personas[personaKey].contacts.push(subscriber.id);
            personas[personaKey].count++;

            if (subscriber.status === 'subscribed') {
                personas[personaKey].subscribed++;
            }

            // Check if subscriber has conversion tags
            const isConverted = this.checkConversion(subscriber);
            if (isConverted) {
                personas[personaKey].converted++;
                stats.totalConverted++;
            }

            personas[personaKey].ageDistribution[ageGroup] =
                (personas[personaKey].ageDistribution[ageGroup] || 0) + 1;
            personas[personaKey].deviceDistribution[deviceType] =
                (personas[personaKey].deviceDistribution[deviceType] || 0) + 1;
        });

        if (this.data.subscribers.length === 0 && this.data.contacts.total > 0) {
            personas['mystery_visitor'].count = this.data.contacts.total;
            personas['mystery_visitor'].subscribed = this.data.contacts.subscribed;
        }

        this.data.categorizationStats = stats;
        this.data.personas = personas;
    }

    checkConversion(subscriber) {
        // Primary check: contact_type field (most reliable)
        if (subscriber.contact_type === 'customer') {
            return true;
        }

        // Check subscriber tags for conversion indicators
        const tags = subscriber.tags || [];

        for (const tag of tags) {
            const tagName = (tag.title || tag.slug || tag.name || '').toLowerCase();
            for (const conversionTag of CONVERSION_TAGS) {
                if (tagName.includes(conversionTag.toLowerCase())) {
                    return true;
                }
            }
        }

        // Also check for custom field indicating paid status
        if (subscriber.custom_fields?.paid === 'yes' ||
            subscriber.custom_fields?.customer === 'yes' ||
            subscriber.custom_fields?.converted === 'yes' ||
            subscriber.custom_fields?.status === 'paid') {
            return true;
        }

        return false;
    }

    calculatePersonaGrowth() {
        // Calculate persona counts by registration date
        const personaByDate = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Initialize dates for last 90 days
        for (let i = 89; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            personaByDate[dateKey] = {};
            Object.keys(PERSONA_DEFINITIONS).forEach(key => {
                personaByDate[dateKey][key] = 0;
            });
        }

        // Count subscribers by registration date and persona
        this.data.subscribers.forEach(subscriber => {
            const createdAt = subscriber.created_at || subscriber.date_created;
            if (!createdAt) return;

            const regDate = new Date(createdAt);
            regDate.setHours(0, 0, 0, 0);
            const dateKey = regDate.toISOString().split('T')[0];

            if (!personaByDate[dateKey]) return; // Outside our 90-day window

            // Determine persona for this subscriber
            const dob = subscriber.custom_fields?.dob ||
                        subscriber.custom_fields?.date_of_birth ||
                        subscriber.custom_fields?.birthday ||
                        subscriber.date_of_birth ||
                        subscriber.dob ||
                        null;

            const age = parseAge(dob);
            const ageGroup = getAgeBucket(age);
            const deviceType = getDeviceType(subscriber);
            const personaKey = assignPersona(ageGroup, deviceType);

            personaByDate[dateKey][personaKey]++;
        });

        // Calculate cumulative totals
        const cumulativeByDate = {};
        const sortedDates = Object.keys(personaByDate).sort();
        const runningTotals = {};
        Object.keys(PERSONA_DEFINITIONS).forEach(key => {
            runningTotals[key] = 0;
        });

        sortedDates.forEach(date => {
            cumulativeByDate[date] = {};
            Object.keys(PERSONA_DEFINITIONS).forEach(key => {
                runningTotals[key] += personaByDate[date][key];
                cumulativeByDate[date][key] = runningTotals[key];
            });
        });

        this.data.personaGrowthDaily = personaByDate;
        this.data.personaGrowthCumulative = cumulativeByDate;
    }

    savePersonaHistory() {
        // Save today's snapshot to localStorage for historical tracking
        const today = new Date().toISOString().split('T')[0];
        const historyKey = 'fluentcrm_persona_history';

        let history = {};
        try {
            const saved = localStorage.getItem(historyKey);
            if (saved) {
                history = JSON.parse(saved);
            }
        } catch (e) {
            console.log('Could not load persona history:', e);
        }

        // Save today's persona counts
        history[today] = {};
        Object.entries(this.data.personas).forEach(([key, persona]) => {
            history[today][key] = persona.count;
        });

        // Keep only last 90 days
        const dates = Object.keys(history).sort();
        if (dates.length > 90) {
            dates.slice(0, dates.length - 90).forEach(date => {
                delete history[date];
            });
        }

        try {
            localStorage.setItem(historyKey, JSON.stringify(history));
        } catch (e) {
            console.log('Could not save persona history:', e);
        }

        this.data.personaHistory = history;
    }

    calculateGrowthAnalytics() {
        const subscribers = this.data.subscribers;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Initialize analytics object
        const analytics = {
            sources: {},
            sourcesByPersona: {},
            personaStats: {}, // Per-persona detailed stats
            cohorts: {},
            dailyRegistrations: {},
            timeToConvert: [],
            engagement: { active: 0, recent: 0, dormant: 0, inactive: 0, never: 0 },
            leads: 0,
            customers: 0
        };

        // Initialize persona stats
        Object.keys(PERSONA_DEFINITIONS).forEach(key => {
            analytics.personaStats[key] = {
                total: 0,
                customers: 0,
                timeToConvert: [],
                avgTimeToConvert: null,
                topSource: null,
                topSourcePct: 0
            };
        });

        // Initialize daily registrations for last 30 days
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            analytics.dailyRegistrations[dateKey] = { total: 0, leads: 0, customers: 0 };
        }

        // Process each subscriber
        subscribers.forEach(subscriber => {
            // === 1. ACQUISITION SOURCE ===
            const channel = this.parseSource(subscriber.source || '');
            if (!analytics.sources[channel]) {
                analytics.sources[channel] = { total: 0, leads: 0, customers: 0 };
            }
            analytics.sources[channel].total++;

            // Contact type (lead vs customer)
            const isCustomer = subscriber.contact_type === 'customer';
            if (isCustomer) {
                analytics.customers++;
                analytics.sources[channel].customers++;
            } else {
                analytics.leads++;
                analytics.sources[channel].leads++;
            }

            // === 2. SOURCE BY PERSONA (with conversion tracking) ===
            const dob = subscriber.custom_fields?.dob || subscriber.date_of_birth || null;
            const age = parseAge(dob);
            const ageGroup = getAgeBucket(age);
            const deviceType = getDeviceType(subscriber);
            const personaKey = assignPersona(ageGroup, deviceType);

            if (!analytics.sourcesByPersona[personaKey]) {
                analytics.sourcesByPersona[personaKey] = {};
            }
            if (!analytics.sourcesByPersona[personaKey][channel]) {
                analytics.sourcesByPersona[personaKey][channel] = { total: 0, customers: 0 };
            }
            analytics.sourcesByPersona[personaKey][channel].total++;
            if (isCustomer) {
                analytics.sourcesByPersona[personaKey][channel].customers++;
            }

            // === 2b. PERSONA STATS (for dynamic recommendations) ===
            analytics.personaStats[personaKey].total++;
            if (isCustomer) {
                analytics.personaStats[personaKey].customers++;
                // Track time-to-convert per persona
                if (subscriber.updated_at && subscriber.created_at) {
                    const created = new Date(subscriber.created_at);
                    const updated = new Date(subscriber.updated_at);
                    const daysToConvert = Math.max(0, Math.floor((updated - created) / (1000 * 60 * 60 * 24)));
                    if (daysToConvert <= 365) {
                        analytics.personaStats[personaKey].timeToConvert.push(daysToConvert);
                    }
                }
            }

            // === 3. COHORT ANALYSIS (Weekly) ===
            if (subscriber.created_at) {
                const createdDate = new Date(subscriber.created_at);
                const weekStart = this.getWeekStart(createdDate);
                const weekKey = weekStart.toISOString().split('T')[0];

                if (!analytics.cohorts[weekKey]) {
                    analytics.cohorts[weekKey] = { total: 0, leads: 0, customers: 0, daysToConvert: [] };
                }
                analytics.cohorts[weekKey].total++;

                if (isCustomer) {
                    analytics.cohorts[weekKey].customers++;
                    // Calculate days to convert (approximate - using updated_at as conversion date)
                    if (subscriber.updated_at && subscriber.created_at) {
                        const created = new Date(subscriber.created_at);
                        const updated = new Date(subscriber.updated_at);
                        const daysToConvert = Math.max(0, Math.floor((updated - created) / (1000 * 60 * 60 * 24)));
                        if (daysToConvert <= 365) { // Only count reasonable values
                            analytics.cohorts[weekKey].daysToConvert.push(daysToConvert);
                            analytics.timeToConvert.push(daysToConvert);
                        }
                    }
                } else {
                    analytics.cohorts[weekKey].leads++;
                }

                // === 4. DAILY REGISTRATIONS ===
                const dateKey = createdDate.toISOString().split('T')[0];
                if (analytics.dailyRegistrations[dateKey]) {
                    analytics.dailyRegistrations[dateKey].total++;
                    if (isCustomer) {
                        analytics.dailyRegistrations[dateKey].customers++;
                    } else {
                        analytics.dailyRegistrations[dateKey].leads++;
                    }
                }
            }

            // === 5. ENGAGEMENT STATUS ===
            if (subscriber.last_activity) {
                const lastActive = new Date(subscriber.last_activity);
                const daysSinceActive = Math.floor((today - lastActive) / (1000 * 60 * 60 * 24));

                if (daysSinceActive <= 7) {
                    analytics.engagement.active++;
                } else if (daysSinceActive <= 30) {
                    analytics.engagement.recent++;
                } else if (daysSinceActive <= 90) {
                    analytics.engagement.dormant++;
                } else {
                    analytics.engagement.inactive++;
                }
            } else {
                analytics.engagement.never++;
            }
        });

        // Calculate averages
        analytics.avgTimeToConvert = analytics.timeToConvert.length > 0
            ? (analytics.timeToConvert.reduce((a, b) => a + b, 0) / analytics.timeToConvert.length).toFixed(1)
            : 0;

        // Calculate cohort averages
        Object.values(analytics.cohorts).forEach(cohort => {
            cohort.avgDaysToConvert = cohort.daysToConvert.length > 0
                ? (cohort.daysToConvert.reduce((a, b) => a + b, 0) / cohort.daysToConvert.length).toFixed(1)
                : '-';
            cohort.cvr = cohort.total > 0 ? (cohort.customers / cohort.total * 100).toFixed(2) : 0;
        });

        // This week vs last week
        const thisWeekStart = this.getWeekStart(today);
        const lastWeekStart = new Date(thisWeekStart);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);

        let thisWeekNew = 0, lastWeekNew = 0;
        Object.entries(analytics.dailyRegistrations).forEach(([date, data]) => {
            const d = new Date(date);
            if (d >= thisWeekStart) {
                thisWeekNew += data.total;
            } else if (d >= lastWeekStart && d < thisWeekStart) {
                lastWeekNew += data.total;
            }
        });

        analytics.thisWeekNew = thisWeekNew;
        analytics.lastWeekNew = lastWeekNew;
        analytics.weekOverWeekChange = lastWeekNew > 0
            ? ((thisWeekNew - lastWeekNew) / lastWeekNew * 100).toFixed(0)
            : (thisWeekNew > 0 ? 100 : 0);

        // Calculate best channel per persona based on conversion rate
        analytics.bestChannelByPersona = this.calculateBestChannels(analytics.sourcesByPersona);

        // Calculate per-persona stats (avg time to convert, top source, etc.)
        this.calculatePersonaDetailedStats(analytics);

        this.data.growthAnalytics = analytics;
    }

    // Calculate detailed stats per persona for dynamic recommendations
    calculatePersonaDetailedStats(analytics) {
        const overallCVR = analytics.customers / (analytics.leads + analytics.customers) || 0;
        const overallAvgTime = analytics.timeToConvert.length > 0
            ? analytics.timeToConvert.reduce((a, b) => a + b, 0) / analytics.timeToConvert.length
            : null;

        Object.entries(analytics.personaStats).forEach(([personaKey, stats]) => {
            // Calculate average time to convert
            if (stats.timeToConvert.length > 0) {
                stats.avgTimeToConvert = stats.timeToConvert.reduce((a, b) => a + b, 0) / stats.timeToConvert.length;
            }

            // Calculate CVR
            stats.cvr = stats.total > 0 ? (stats.customers / stats.total) : 0;
            stats.cvrVsAverage = overallCVR > 0 ? ((stats.cvr - overallCVR) / overallCVR * 100) : 0;

            // Find top source for this persona
            const sources = analytics.sourcesByPersona[personaKey] || {};
            let topSource = null;
            let topSourceCount = 0;
            let totalFromSources = 0;

            Object.entries(sources).forEach(([channel, data]) => {
                totalFromSources += data.total;
                if (data.total > topSourceCount) {
                    topSourceCount = data.total;
                    topSource = channel;
                }
            });

            stats.topSource = topSource;
            stats.topSourcePct = totalFromSources > 0 ? (topSourceCount / totalFromSources * 100) : 0;
            stats.sampleSize = stats.customers; // Number of conversions

            // Dynamic nurture strategy based on time-to-convert
            stats.nurtureStrategy = this.calculateNurtureStrategy(stats, overallAvgTime);
        });
    }

    // Determine nurture strategy based on conversion behavior
    calculateNurtureStrategy(stats, overallAvgTime) {
        const avgTime = stats.avgTimeToConvert;
        const cvr = stats.cvr;
        const sampleSize = stats.sampleSize;

        // Not enough data
        if (sampleSize < 5) {
            return {
                priority: 'Unknown',
                reason: 'Insufficient data',
                description: `Only ${sampleSize} conversions`
            };
        }

        // Fast converters (< 3 days average)
        if (avgTime !== null && avgTime < 3) {
            return {
                priority: 'Low',
                reason: 'Fast converters',
                description: `Avg ${avgTime.toFixed(0)}d to convert`
            };
        }

        // Medium converters (3-14 days)
        if (avgTime !== null && avgTime >= 3 && avgTime <= 14) {
            return {
                priority: 'Medium',
                reason: 'Standard journey',
                description: `Avg ${avgTime.toFixed(0)}d to convert`
            };
        }

        // Slow converters (> 14 days) - need more nurturing
        if (avgTime !== null && avgTime > 14) {
            return {
                priority: 'High',
                reason: 'Delayed converters',
                description: `Avg ${avgTime.toFixed(0)}d to convert`
            };
        }

        // High CVR but no time data
        if (cvr > 0.05) {
            return {
                priority: 'Medium',
                reason: 'Good CVR',
                description: `${(cvr * 100).toFixed(1)}% conversion rate`
            };
        }

        return {
            priority: 'Medium',
            reason: 'Standard',
            description: 'Default nurturing'
        };
    }

    // Calculate the best performing channel for each persona
    calculateBestChannels(sourcesByPersona) {
        const bestChannels = {};
        const MIN_SAMPLE_SIZE = 10; // Minimum contacts to consider a channel reliable

        Object.entries(sourcesByPersona).forEach(([personaKey, channels]) => {
            let bestChannel = null;
            let bestCVR = -1;
            let bestVolume = 0;
            let channelStats = [];

            Object.entries(channels).forEach(([channel, data]) => {
                if (channel === 'Unknown') return; // Skip unknown sources

                const cvr = data.total > 0 ? (data.customers / data.total) : 0;
                channelStats.push({ channel, total: data.total, customers: data.customers, cvr });

                // Prioritize channels with good sample size AND good CVR
                if (data.total >= MIN_SAMPLE_SIZE) {
                    if (cvr > bestCVR || (cvr === bestCVR && data.total > bestVolume)) {
                        bestCVR = cvr;
                        bestChannel = channel;
                        bestVolume = data.total;
                    }
                }
            });

            // If no channel meets minimum sample size, pick the one with most volume
            if (!bestChannel && channelStats.length > 0) {
                const sorted = channelStats
                    .filter(c => c.channel !== 'Unknown')
                    .sort((a, b) => b.total - a.total);
                if (sorted.length > 0) {
                    bestChannel = sorted[0].channel;
                    bestCVR = sorted[0].cvr;
                }
            }

            bestChannels[personaKey] = {
                channel: bestChannel || PERSONA_DEFINITIONS[personaKey]?.bestChannel || 'Unknown',
                cvr: bestCVR >= 0 ? (bestCVR * 100).toFixed(1) : null,
                isDataDriven: bestChannel !== null,
                stats: channelStats.sort((a, b) => b.cvr - a.cvr).slice(0, 3) // Top 3 channels
            };
        });

        return bestChannels;
    }

    parseSource(sourceUrl) {
        if (!sourceUrl) return 'Unknown';

        const src = sourceUrl.toLowerCase();

        if (src.includes('fbclid')) return 'Facebook Ads';
        if (src.includes('gclid')) return 'Google Ads';
        if (src.includes('utm_source=facebook')) return 'Facebook';
        if (src.includes('utm_source=google')) return 'Google';
        if (src.includes('utm_source=tiktok')) return 'TikTok';
        if (src.includes('utm_source=zalo')) return 'Zalo';
        if (src.includes('utm_source=youtube')) return 'YouTube';
        if (src.includes('utm_source=instagram')) return 'Instagram';
        if (src.includes('utm_source=email')) return 'Email';
        if (src.includes('utm_')) return 'UTM Tagged';
        if (src.includes('luangiai.vn') && !src.includes('?')) return 'Organic';
        if (src === '') return 'Unknown';

        return 'Other Referral';
    }

    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    calculateAstrologyStats() {
        const subscribers = this.data.subscribers;
        const stats = {
            withDOB: 0,
            withBirthtime: 0,
            withGender: 0,
            zodiacSigns: {},
            genderDistribution: { Male: 0, Female: 0, Unknown: 0 },
            birthtimePeriods: { 'Morning (5-12)': 0, 'Afternoon (12-17)': 0, 'Evening (17-21)': 0, 'Night (21-5)': 0 },
            elements: { Kim: 0, Mộc: 0, Thủy: 0, Hỏa: 0, Thổ: 0 },
            genderByPersona: {},
            zodiacCVR: {},
            genderCVR: { Male: { total: 0, customers: 0 }, Female: { total: 0, customers: 0 }, Unknown: { total: 0, customers: 0 } }
        };

        // Initialize zodiac signs
        Object.keys(ZODIAC_SIGNS).forEach(sign => {
            stats.zodiacSigns[sign] = { total: 0, customers: 0, male: 0, female: 0 };
        });

        // Initialize gender by persona
        Object.keys(PERSONA_DEFINITIONS).forEach(personaKey => {
            stats.genderByPersona[personaKey] = {
                Male: { total: 0, customers: 0 },
                Female: { total: 0, customers: 0 },
                Unknown: { total: 0, customers: 0 }
            };
        });

        // Process each subscriber
        subscribers.forEach(subscriber => {
            // Get DOB
            const dob = subscriber.custom_fields?.dob ||
                        subscriber.custom_fields?.date_of_birth ||
                        subscriber.custom_fields?.birthday ||
                        subscriber.date_of_birth ||
                        subscriber.dob ||
                        null;

            // Get gender
            const genderRaw = subscriber.custom_fields?.gender ||
                              subscriber.gender ||
                              subscriber.custom_fields?.gioi_tinh ||
                              null;
            const gender = parseGender(genderRaw);

            // Get birthtime
            const birthtime = subscriber.custom_fields?.birthtime ||
                              subscriber.custom_fields?.birth_time ||
                              subscriber.custom_fields?.gio_sinh ||
                              subscriber.birthtime ||
                              null;

            // Is customer?
            const isCustomer = subscriber.contact_type === 'customer';

            // Count DOB
            if (dob) {
                stats.withDOB++;

                // Get zodiac sign
                const zodiac = getZodiacSign(dob);
                if (zodiac && stats.zodiacSigns[zodiac]) {
                    stats.zodiacSigns[zodiac].total++;
                    if (isCustomer) stats.zodiacSigns[zodiac].customers++;
                    if (gender === 'Male') stats.zodiacSigns[zodiac].male++;
                    if (gender === 'Female') stats.zodiacSigns[zodiac].female++;

                    // Count elements
                    const element = ZODIAC_SIGNS[zodiac].element;
                    stats.elements[element]++;
                }
            }

            // Count birthtime
            if (birthtime) {
                stats.withBirthtime++;
                const period = parseBirthTimePeriod(birthtime);
                if (stats.birthtimePeriods[period] !== undefined) {
                    stats.birthtimePeriods[period]++;
                }
            }

            // Count gender
            if (gender !== 'Unknown') {
                stats.withGender++;
            }
            stats.genderDistribution[gender]++;
            stats.genderCVR[gender].total++;
            if (isCustomer) stats.genderCVR[gender].customers++;

            // Gender by persona
            const age = parseAge(dob);
            const ageGroup = getAgeBucket(age);
            const deviceType = getDeviceType(subscriber);
            const personaKey = assignPersona(ageGroup, deviceType);

            if (stats.genderByPersona[personaKey]) {
                stats.genderByPersona[personaKey][gender].total++;
                if (isCustomer) {
                    stats.genderByPersona[personaKey][gender].customers++;
                }
            }
        });

        // Calculate CVR for zodiac signs
        Object.entries(stats.zodiacSigns).forEach(([sign, data]) => {
            stats.zodiacCVR[sign] = data.total > 0 ? (data.customers / data.total * 100) : 0;
        });

        this.data.astrologyStats = stats;
    }

    initCharts() {
        // Status Chart
        const statusCtx = document.getElementById('statusChart')?.getContext('2d');
        if (statusCtx) {
            this.charts.status = new Chart(statusCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Subscribed', 'Pending', 'Unsubscribed', 'Bounced', 'Complained'],
                    datasets: [{
                        data: [0, 0, 0, 0, 0],
                        backgroundColor: ['#22c55e', '#eab308', '#ef4444', '#f97316', '#ec4899'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right', labels: { color: '#9ca3af', usePointStyle: true, padding: 15 } }
                    }
                }
            });
        }

        // Persona Chart
        const personaCtx = document.getElementById('personaChart')?.getContext('2d');
        if (personaCtx) {
            this.charts.persona = new Chart(personaCtx, {
                type: 'doughnut',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: [],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right', labels: { color: '#9ca3af', usePointStyle: true, padding: 15 } }
                    }
                }
            });
        }

        // Age Chart
        const ageCtx = document.getElementById('ageChart')?.getContext('2d');
        if (ageCtx) {
            this.charts.age = new Chart(ageCtx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Contacts',
                        data: [],
                        backgroundColor: '#8b5cf6'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { color: '#374151' }, ticks: { color: '#9ca3af' } },
                        y: { grid: { color: '#374151' }, ticks: { color: '#9ca3af' } }
                    }
                }
            });
        }

        // Device Chart
        const deviceCtx = document.getElementById('deviceChart')?.getContext('2d');
        if (deviceCtx) {
            this.charts.device = new Chart(deviceCtx, {
                type: 'pie',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: ['#3b82f6', '#22c55e', '#f97316', '#6b7280'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right', labels: { color: '#9ca3af', usePointStyle: true, padding: 15 } }
                    }
                }
            });
        }

        // Persona Growth Chart
        const growthCtx = document.getElementById('personaGrowthChart')?.getContext('2d');
        if (growthCtx) {
            this.charts.personaGrowth = new Chart(growthCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: []
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: { color: '#9ca3af', usePointStyle: true, padding: 15 }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: '#374151' },
                            ticks: { color: '#9ca3af', maxRotation: 45, minRotation: 45 }
                        },
                        y: {
                            grid: { color: '#374151' },
                            ticks: { color: '#9ca3af' },
                            beginAtZero: true
                        }
                    }
                }
            });
        }

        // === GROWTH ANALYTICS CHARTS ===

        // Acquisition Source Chart (Doughnut)
        const sourceCtx = document.getElementById('sourceChart')?.getContext('2d');
        if (sourceCtx) {
            this.charts.source = new Chart(sourceCtx, {
                type: 'doughnut',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: [
                            '#3b82f6', // Facebook Ads - blue
                            '#ef4444', // Google Ads - red
                            '#22c55e', // Organic - green
                            '#f97316', // Facebook - orange
                            '#8b5cf6', // UTM Tagged - purple
                            '#06b6d4', // Zalo - cyan
                            '#ec4899', // TikTok - pink
                            '#eab308', // YouTube - yellow
                            '#6b7280', // Other - gray
                            '#14b8a6'  // Email - teal
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right', labels: { color: '#9ca3af', usePointStyle: true, padding: 10, font: { size: 11 } } }
                    }
                }
            });
        }

        // Conversion Timeline Chart (Bar - histogram style)
        const conversionCtx = document.getElementById('conversionTimelineChart')?.getContext('2d');
        if (conversionCtx) {
            this.charts.conversionTimeline = new Chart(conversionCtx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Conversions',
                        data: [],
                        backgroundColor: '#22c55e',
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { color: '#374151' }, ticks: { color: '#9ca3af' } },
                        y: { grid: { color: '#374151' }, ticks: { color: '#9ca3af' }, beginAtZero: true }
                    }
                }
            });
        }

        // Daily Registrations Chart (Line with area)
        const dailyRegCtx = document.getElementById('dailyRegistrationsChart')?.getContext('2d');
        if (dailyRegCtx) {
            this.charts.dailyRegistrations = new Chart(dailyRegCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'Total',
                            data: [],
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            fill: true,
                            tension: 0.3
                        },
                        {
                            label: 'Customers',
                            data: [],
                            borderColor: '#22c55e',
                            backgroundColor: 'rgba(34, 197, 94, 0.1)',
                            fill: true,
                            tension: 0.3
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { position: 'top', labels: { color: '#9ca3af', usePointStyle: true } }
                    },
                    scales: {
                        x: { grid: { color: '#374151' }, ticks: { color: '#9ca3af', maxRotation: 45, minRotation: 45 } },
                        y: { grid: { color: '#374151' }, ticks: { color: '#9ca3af' }, beginAtZero: true }
                    }
                }
            });
        }

        // ========== ASTROLOGY CHARTS ==========

        // Zodiac Chart
        const zodiacCtx = document.getElementById('zodiacChart')?.getContext('2d');
        if (zodiacCtx) {
            const zodiacColors = Object.values(ZODIAC_SIGNS).map(z => z.color);
            this.charts.zodiac = new Chart(zodiacCtx, {
                type: 'bar',
                data: {
                    labels: Object.keys(ZODIAC_SIGNS),
                    datasets: [{
                        label: 'Contacts',
                        data: [],
                        backgroundColor: zodiacColors
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { color: '#374151' }, ticks: { color: '#9ca3af' } },
                        y: { grid: { display: false }, ticks: { color: '#9ca3af' } }
                    }
                }
            });
        }

        // Gender Chart
        const genderCtx = document.getElementById('genderChart')?.getContext('2d');
        if (genderCtx) {
            this.charts.gender = new Chart(genderCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Male', 'Female', 'Unknown'],
                    datasets: [{
                        data: [0, 0, 0],
                        backgroundColor: ['#3b82f6', '#ec4899', '#6b7280'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right', labels: { color: '#9ca3af', usePointStyle: true, padding: 15 } }
                    }
                }
            });
        }

        // Birthtime Chart
        const birthtimeCtx = document.getElementById('birthtimeChart')?.getContext('2d');
        if (birthtimeCtx) {
            this.charts.birthtime = new Chart(birthtimeCtx, {
                type: 'pie',
                data: {
                    labels: ['Morning (5-12)', 'Afternoon (12-17)', 'Evening (17-21)', 'Night (21-5)'],
                    datasets: [{
                        data: [0, 0, 0, 0],
                        backgroundColor: ['#fbbf24', '#f97316', '#8b5cf6', '#1e3a8a'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right', labels: { color: '#9ca3af', usePointStyle: true, padding: 10 } }
                    }
                }
            });
        }

        // Element Chart (Ngũ Hành - 5 elements)
        const elementCtx = document.getElementById('elementChart')?.getContext('2d');
        if (elementCtx) {
            this.charts.element = new Chart(elementCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Kim 🪙', 'Mộc 🌳', 'Thủy 💧', 'Hỏa 🔥', 'Thổ 🌍'],
                    datasets: [{
                        data: [0, 0, 0, 0, 0],
                        backgroundColor: ['#fbbf24', '#22c55e', '#3b82f6', '#ef4444', '#8b5cf6'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right', labels: { color: '#9ca3af', usePointStyle: true, padding: 10 } }
                    }
                }
            });
        }
    }

    setGrowthPeriod(days) {
        this.growthPeriod = days;

        // Update button states
        document.querySelectorAll('.growth-period-btn').forEach(btn => {
            btn.classList.remove('active', 'bg-indigo-600', 'text-white');
            btn.classList.add('bg-gray-700', 'text-gray-300');
            if (parseInt(btn.dataset.days) === days) {
                btn.classList.add('active', 'bg-indigo-600', 'text-white');
                btn.classList.remove('bg-gray-700', 'text-gray-300');
            }
        });

        this.updatePersonaGrowthChart();
    }

    updateDashboard() {
        this.updateOverviewTab();
        this.updateGrowthTab();
        this.updatePersonasTab();
        this.updateAstrologyTab();
    }

    updateGrowthTab() {
        const analytics = this.data.growthAnalytics || {};
        const total = analytics.leads + analytics.customers || 1;

        // Key metrics
        document.getElementById('metricLeads').textContent = this.formatNumber(analytics.leads || 0);
        document.getElementById('metricLeadsPct').textContent = `${((analytics.leads / total) * 100).toFixed(1)}% of total`;
        document.getElementById('metricCustomers').textContent = this.formatNumber(analytics.customers || 0);
        const cvr = total > 0 ? ((analytics.customers / total) * 100).toFixed(2) : 0;
        document.getElementById('metricCustomerCVR').textContent = `${cvr}% CVR`;
        document.getElementById('metricAvgTTC').textContent = analytics.avgTimeToConvert || '-';
        document.getElementById('metricWeekNew').textContent = this.formatNumber(analytics.thisWeekNew || 0);

        const weekChange = analytics.weekOverWeekChange || 0;
        const trendColor = weekChange > 0 ? 'text-green-400' : weekChange < 0 ? 'text-red-400' : 'text-gray-400';
        const trendIcon = weekChange > 0 ? '↑' : weekChange < 0 ? '↓' : '→';
        document.getElementById('metricWeekTrend').innerHTML =
            `<span class="${trendColor}">${trendIcon} ${Math.abs(weekChange)}% vs last week</span>`;

        // Source chart
        if (this.charts.source && analytics.sources) {
            const sortedSources = Object.entries(analytics.sources)
                .sort((a, b) => b[1].total - a[1].total);

            this.charts.source.data.labels = sortedSources.map(([name]) => name);
            this.charts.source.data.datasets[0].data = sortedSources.map(([, data]) => data.total);
            this.charts.source.update();
        }

        // Source table
        const sourceTable = document.getElementById('sourceTable');
        if (sourceTable && analytics.sources) {
            const sortedSources = Object.entries(analytics.sources)
                .sort((a, b) => b[1].total - a[1].total);

            sourceTable.innerHTML = sortedSources.map(([name, data]) => {
                const sourceCvr = data.total > 0 ? ((data.customers / data.total) * 100).toFixed(2) : 0;
                const cvrColor = parseFloat(sourceCvr) > parseFloat(cvr) ? 'text-green-400' : 'text-gray-400';
                return `
                    <tr class="border-b border-gray-800">
                        <td class="py-2 text-white">${this.escapeHtml(name)}</td>
                        <td class="py-2 text-right text-gray-300">${this.formatNumber(data.leads)}</td>
                        <td class="py-2 text-right text-green-400">${this.formatNumber(data.customers)}</td>
                        <td class="py-2 text-right ${cvrColor} font-medium">${sourceCvr}%</td>
                    </tr>
                `;
            }).join('');
        }

        // Cohort table
        const cohortTable = document.getElementById('cohortTable');
        if (cohortTable && analytics.cohorts) {
            const sortedCohorts = Object.entries(analytics.cohorts)
                .sort((a, b) => b[0].localeCompare(a[0])) // Newest first
                .slice(0, 12); // Last 12 weeks

            const maxCvr = Math.max(...sortedCohorts.map(([, c]) => parseFloat(c.cvr) || 0), 1);

            cohortTable.innerHTML = sortedCohorts.map(([week, cohort]) => {
                const weekDate = new Date(week);
                const weekLabel = weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const barWidth = maxCvr > 0 ? (parseFloat(cohort.cvr) / maxCvr * 100) : 0;
                const cvrColor = parseFloat(cohort.cvr) > parseFloat(cvr) ? 'text-green-400' : 'text-gray-400';

                return `
                    <tr class="border-b border-gray-800">
                        <td class="py-2 text-white">${weekLabel}</td>
                        <td class="py-2 text-right text-gray-300">${this.formatNumber(cohort.leads)}</td>
                        <td class="py-2 text-right text-green-400">${this.formatNumber(cohort.customers)}</td>
                        <td class="py-2 text-right ${cvrColor} font-medium">${cohort.cvr}%</td>
                        <td class="py-2">
                            <div class="h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div class="h-full bg-green-500 rounded-full" style="width: ${barWidth}%"></div>
                            </div>
                        </td>
                        <td class="py-2 text-right text-purple-400">${cohort.avgDaysToConvert}</td>
                    </tr>
                `;
            }).join('');
        }

        // Conversion timeline chart
        if (this.charts.conversionTimeline && analytics.timeToConvert?.length > 0) {
            // Group by day buckets: 0, 1, 2, 3-7, 8-14, 15-30, 31-60, 61+
            const buckets = {
                '0': 0, '1': 0, '2': 0, '3-7': 0, '8-14': 0, '15-30': 0, '31-60': 0, '61+': 0
            };

            analytics.timeToConvert.forEach(days => {
                if (days === 0) buckets['0']++;
                else if (days === 1) buckets['1']++;
                else if (days === 2) buckets['2']++;
                else if (days <= 7) buckets['3-7']++;
                else if (days <= 14) buckets['8-14']++;
                else if (days <= 30) buckets['15-30']++;
                else if (days <= 60) buckets['31-60']++;
                else buckets['61+']++;
            });

            this.charts.conversionTimeline.data.labels = Object.keys(buckets).map(k => k + ' days');
            this.charts.conversionTimeline.data.datasets[0].data = Object.values(buckets);
            this.charts.conversionTimeline.update();
        }

        // Source by Persona
        const sourceByPersonaEl = document.getElementById('sourceByPersona');
        if (sourceByPersonaEl && analytics.sourcesByPersona) {
            const personasWithSources = Object.entries(analytics.sourcesByPersona)
                .filter(([key]) => this.data.personas[key]?.count > 0)
                .sort((a, b) => (this.data.personas[b[0]]?.count || 0) - (this.data.personas[a[0]]?.count || 0))
                .slice(0, 5);

            sourceByPersonaEl.innerHTML = personasWithSources.map(([personaKey, sources]) => {
                const persona = PERSONA_DEFINITIONS[personaKey];
                // sources is now {channel: {total, customers}}
                const topSources = Object.entries(sources)
                    .sort((a, b) => b[1].total - a[1].total)
                    .slice(0, 3);
                const total = Object.values(sources).reduce((sum, v) => sum + v.total, 0);

                return `
                    <div class="bg-gray-800 rounded-lg p-3">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="w-3 h-3 rounded-full" style="background: ${persona.color}"></span>
                            <span class="font-medium text-sm" style="color: ${persona.color}">${persona.name}</span>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            ${topSources.map(([source, data]) => {
                                const pct = total > 0 ? ((data.total / total) * 100).toFixed(0) : 0;
                                return `<span class="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">${source}: ${pct}%</span>`;
                            }).join('')}
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Daily registrations chart
        if (this.charts.dailyRegistrations && analytics.dailyRegistrations) {
            const dates = Object.keys(analytics.dailyRegistrations).sort();
            const labels = dates.map(d => {
                const date = new Date(d);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            });

            this.charts.dailyRegistrations.data.labels = labels;
            this.charts.dailyRegistrations.data.datasets[0].data = dates.map(d => analytics.dailyRegistrations[d].total);
            this.charts.dailyRegistrations.data.datasets[1].data = dates.map(d => analytics.dailyRegistrations[d].customers);
            this.charts.dailyRegistrations.update();
        }

        // Engagement grid
        const engagementGrid = document.getElementById('engagementGrid');
        if (engagementGrid && analytics.engagement) {
            const eng = analytics.engagement;
            const totalEng = eng.active + eng.recent + eng.dormant + eng.inactive + eng.never || 1;

            const statuses = [
                { name: 'Active', desc: 'Last 7 days', count: eng.active, color: '#22c55e' },
                { name: 'Recent', desc: 'Last 30 days', count: eng.recent, color: '#3b82f6' },
                { name: 'Dormant', desc: 'Last 90 days', count: eng.dormant, color: '#eab308' },
                { name: 'Inactive', desc: '90+ days', count: eng.inactive, color: '#ef4444' },
                { name: 'Never', desc: 'No activity', count: eng.never, color: '#6b7280' }
            ];

            engagementGrid.innerHTML = statuses.map(s => {
                const pct = ((s.count / totalEng) * 100).toFixed(1);
                return `
                    <div class="bg-gray-800 rounded-lg p-4 text-center border-l-4" style="border-left-color: ${s.color}">
                        <div class="text-2xl font-bold" style="color: ${s.color}">${this.formatNumber(s.count)}</div>
                        <div class="text-white text-sm font-medium">${s.name}</div>
                        <div class="text-gray-500 text-xs">${s.desc}</div>
                        <div class="text-gray-400 text-xs mt-1">${pct}%</div>
                    </div>
                `;
            }).join('');
        }
    }

    updateOverviewTab() {
        const { contacts, lists, tags, categorizationStats } = this.data;

        // Calculate total conversions
        const totalConverted = categorizationStats?.totalConverted || 0;
        const overallCVR = contacts.total > 0 ? (totalConverted / contacts.total * 100).toFixed(2) : 0;

        // Key metrics
        document.getElementById('metricTotal').textContent = this.formatNumber(contacts.total);
        document.getElementById('metricTotalTrend').textContent = `${this.formatNumber(this.data.subscribers.length)} loaded`;
        document.getElementById('metricConverted').textContent = this.formatNumber(totalConverted);
        document.getElementById('metricCVR').textContent = `${overallCVR}% CVR`;
        document.getElementById('metricSubscribed').textContent = this.formatNumber(contacts.subscribed);
        document.getElementById('metricSubscribedPct').textContent =
            contacts.total > 0 ? `${(contacts.subscribed / contacts.total * 100).toFixed(1)}%` : '-';
        document.getElementById('metricPending').textContent = this.formatNumber(contacts.pending);
        document.getElementById('metricPendingPct').textContent =
            contacts.total > 0 ? `${(contacts.pending / contacts.total * 100).toFixed(1)}%` : '-';
        document.getElementById('metricLists').textContent = lists.length;
        document.getElementById('metricTags').textContent = tags.length;

        // Status chart
        if (this.charts.status) {
            this.charts.status.data.datasets[0].data = [
                contacts.subscribed,
                contacts.pending,
                contacts.unsubscribed,
                contacts.bounced,
                contacts.complained
            ];
            this.charts.status.update();
        }

        // Persona chart
        if (this.charts.persona) {
            const personas = Object.values(this.data.personas).filter(p => p.count > 0);
            personas.sort((a, b) => b.count - a.count);

            this.charts.persona.data.labels = personas.map(p => p.name);
            this.charts.persona.data.datasets[0].data = personas.map(p => p.count);
            this.charts.persona.data.datasets[0].backgroundColor = personas.map(p => p.color);
            this.charts.persona.update();
        }

        // Data quality insights
        this.updateDataQuality();

        // Top lists
        this.updateTopLists();

        // Top tags
        this.updateTopTags();
    }

    updateDataQuality() {
        const stats = this.data.categorizationStats || {};
        const total = stats.totalProcessed || 1;

        const dobPct = ((stats.withDOB || 0) / total * 100).toFixed(1);
        const devicePct = ((stats.withDevice || 0) / total * 100).toFixed(1);
        const subscribedPct = (this.data.contacts.subscribed / (this.data.contacts.total || 1) * 100).toFixed(1);
        const taggedCount = this.data.tags.reduce((sum, t) => sum + (t.subscribers_count || 0), 0);
        const taggedPct = (taggedCount / (this.data.contacts.total || 1) * 100).toFixed(1);

        const container = document.getElementById('dataQualityGrid');
        container.innerHTML = `
            <div class="bg-gray-800 rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-gray-400 text-sm">DOB Data</span>
                    <span class="badge ${dobPct > 70 ? 'badge-green' : dobPct > 40 ? 'badge-yellow' : 'badge-red'}">${dobPct}%</span>
                </div>
                <div class="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div class="h-full bg-purple-500 rounded-full" style="width: ${dobPct}%"></div>
                </div>
                <div class="text-gray-500 text-xs mt-2">${this.formatNumber(stats.withDOB || 0)} / ${this.formatNumber(total)}</div>
            </div>
            <div class="bg-gray-800 rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-gray-400 text-sm">Device Data</span>
                    <span class="badge ${devicePct > 70 ? 'badge-green' : devicePct > 40 ? 'badge-yellow' : 'badge-red'}">${devicePct}%</span>
                </div>
                <div class="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div class="h-full bg-blue-500 rounded-full" style="width: ${devicePct}%"></div>
                </div>
                <div class="text-gray-500 text-xs mt-2">${this.formatNumber(stats.withDevice || 0)} / ${this.formatNumber(total)}</div>
            </div>
            <div class="bg-gray-800 rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-gray-400 text-sm">Subscribed</span>
                    <span class="badge ${subscribedPct > 80 ? 'badge-green' : subscribedPct > 50 ? 'badge-yellow' : 'badge-red'}">${subscribedPct}%</span>
                </div>
                <div class="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div class="h-full bg-green-500 rounded-full" style="width: ${subscribedPct}%"></div>
                </div>
                <div class="text-gray-500 text-xs mt-2">${this.formatNumber(this.data.contacts.subscribed)} / ${this.formatNumber(this.data.contacts.total)}</div>
            </div>
            <div class="bg-gray-800 rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-gray-400 text-sm">Tagged</span>
                    <span class="badge ${taggedPct > 50 ? 'badge-green' : taggedPct > 20 ? 'badge-yellow' : 'badge-red'}">${taggedPct}%</span>
                </div>
                <div class="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div class="h-full bg-cyan-500 rounded-full" style="width: ${Math.min(taggedPct, 100)}%"></div>
                </div>
                <div class="text-gray-500 text-xs mt-2">${this.formatNumber(taggedCount)} tagged</div>
            </div>
        `;
    }

    updateTopLists() {
        const container = document.getElementById('topListsContainer');
        const sortedLists = [...this.data.lists]
            .sort((a, b) => (b.subscribers_count || 0) - (a.subscribers_count || 0))
            .slice(0, 5);

        if (sortedLists.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">No lists found</p>';
            return;
        }

        const maxCount = sortedLists[0]?.subscribers_count || 1;

        container.innerHTML = sortedLists.map(list => {
            const count = list.subscribers_count || 0;
            const pct = (count / maxCount) * 100;
            return `
                <div class="flex items-center gap-4">
                    <div class="flex-1">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-medium text-white text-sm">${this.escapeHtml(list.title)}</span>
                            <span class="text-gray-400 text-sm">${this.formatNumber(count)}</span>
                        </div>
                        <div class="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div class="h-full bg-blue-500 rounded-full" style="width: ${pct}%"></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateTopTags() {
        const container = document.getElementById('topTagsContainer');
        const sortedTags = [...this.data.tags]
            .sort((a, b) => (b.subscribers_count || 0) - (a.subscribers_count || 0))
            .slice(0, 5);

        if (sortedTags.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">No tags found</p>';
            return;
        }

        const maxCount = sortedTags[0]?.subscribers_count || 1;

        container.innerHTML = sortedTags.map(tag => {
            const count = tag.subscribers_count || 0;
            const pct = (count / maxCount) * 100;
            return `
                <div class="flex items-center gap-4">
                    <div class="flex-1">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-medium text-white text-sm">${this.escapeHtml(tag.title)}</span>
                            <span class="text-gray-400 text-sm">${this.formatNumber(count)}</span>
                        </div>
                        <div class="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div class="h-full bg-cyan-500 rounded-full" style="width: ${pct}%"></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    updatePersonasTab() {
        const { personas, contacts, categorizationStats } = this.data;
        const total = contacts.total || 1;

        // Data completeness
        const stats = categorizationStats || {};
        const completeData = Math.min(stats.withDOB || 0, stats.withDevice || 0);
        document.getElementById('dataCompleteness').textContent =
            `${this.formatNumber(completeData)} (${(completeData / (stats.totalProcessed || 1) * 100).toFixed(1)}%)`;

        // Persona table
        const tableBody = document.getElementById('personaTable');
        const personaArray = Object.entries(personas)
            .map(([key, p]) => ({ key, ...p }))
            .sort((a, b) => b.count - a.count);

        // Calculate overall CVR for comparison
        const totalConverted = personaArray.reduce((sum, p) => sum + (p.converted || 0), 0);
        const overallCVR = total > 0 ? (totalConverted / total * 100) : 0;

        tableBody.innerHTML = personaArray.map(p => {
            const pct = (p.count / total * 100).toFixed(1);
            const cvr = p.count > 0 ? (p.converted / p.count * 100).toFixed(2) : 0;
            const cvrValue = parseFloat(cvr);
            const priorityColor = p.priority === 'High' ? 'badge-green' : p.priority === 'Medium' ? 'badge-yellow' : 'badge-gray';
            const cvrColor = cvrValue > overallCVR ? 'text-green-400' : cvrValue > 0 ? 'text-yellow-400' : 'text-gray-400';

            return `
                <tr class="border-b border-gray-800 hover:bg-gray-800/50">
                    <td class="py-3">
                        <span class="flex items-center gap-2">
                            <span class="w-3 h-3 rounded-full" style="background: ${p.color}"></span>
                            <span class="font-medium" style="color: ${p.color}">${p.name}</span>
                        </span>
                    </td>
                    <td class="text-right py-3 text-white font-medium">${this.formatNumber(p.count)}</td>
                    <td class="text-right py-3 text-gray-400">${pct}%</td>
                    <td class="py-3">
                        <div class="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div class="h-full rounded-full" style="width: ${pct}%; background: ${p.color}"></div>
                        </div>
                    </td>
                    <td class="text-right py-3 text-gray-300">${this.formatNumber(p.converted || 0)}</td>
                    <td class="text-right py-3 ${cvrColor} font-medium">${cvr}%</td>
                    <td class="text-center py-3">
                        <span class="badge ${priorityColor}">${p.priority}</span>
                    </td>
                </tr>
            `;
        }).join('');

        // Persona cards - with dynamic best channel
        const cardsContainer = document.getElementById('personaCards');
        const bestChannelData = this.data.growthAnalytics?.bestChannelByPersona || {};

        cardsContainer.innerHTML = personaArray.filter(p => p.count > 0).map(p => {
            const pct = (p.count / total * 100).toFixed(1);
            const cvr = p.count > 0 ? (p.converted / p.count * 100).toFixed(2) : 0;
            const cvrValue = parseFloat(cvr);
            const cvrColor = cvrValue > overallCVR ? 'text-green-400' : cvrValue > 0 ? 'text-yellow-400' : 'text-gray-500';
            const cvrBgColor = cvrValue > overallCVR ? 'bg-green-900/30' : cvrValue > 0 ? 'bg-yellow-900/30' : 'bg-gray-800';

            // Get dynamic best channel or fall back to static
            const channelInfo = bestChannelData[p.key] || {};
            const dynamicBestChannel = channelInfo.channel || p.bestChannel;
            const channelCVR = channelInfo.cvr;
            const isDataDriven = channelInfo.isDataDriven;

            return `
                <div class="card p-5 persona-card" style="border-left-color: ${p.color}">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h4 class="font-bold text-lg" style="color: ${p.color}">${p.name}</h4>
                            <p class="text-gray-400 text-xs mt-1">${p.description}</p>
                        </div>
                        <div class="text-right">
                            <div class="text-white font-bold text-xl">${this.formatNumber(p.count)}</div>
                            <div class="text-gray-500 text-xs">${pct}%</div>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-2 mb-3">
                        <div class="bg-gray-800 rounded p-2 text-center">
                            <div class="text-gray-400 text-xs">Subscribed</div>
                            <div class="text-white font-medium">${this.formatNumber(p.subscribed || 0)}</div>
                        </div>
                        <div class="${cvrBgColor} rounded p-2 text-center">
                            <div class="text-gray-400 text-xs">CVR</div>
                            <div class="${cvrColor} font-bold">${cvr}%</div>
                        </div>
                    </div>
                    <div class="space-y-2 text-sm border-t border-gray-700 pt-3">
                        <div class="flex justify-between">
                            <span class="text-gray-400">Converted:</span>
                            <span class="text-green-400 font-medium">${this.formatNumber(p.converted || 0)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">Best Channel:</span>
                            <span class="text-white flex items-center gap-1">
                                ${dynamicBestChannel}
                                ${isDataDriven ? `<span class="text-xs text-green-400" title="Based on ${channelCVR}% CVR">(${channelCVR}%)</span>` : '<span class="text-xs text-gray-500">(default)</span>'}
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">Offer:</span>
                            <span class="text-white">${p.recommendedOffer}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Age chart
        if (this.charts.age) {
            const ageGroups = categorizationStats.ageGroups || {};
            const orderedAgeGroups = ['18-24', '25-34', '35-44', '45-54', '55+', 'Unknown'];
            const filteredAgeGroups = orderedAgeGroups.filter(g => ageGroups[g] > 0);

            this.charts.age.data.labels = filteredAgeGroups;
            this.charts.age.data.datasets[0].data = filteredAgeGroups.map(g => ageGroups[g] || 0);
            this.charts.age.update();
        }

        // Device chart
        if (this.charts.device) {
            const deviceTypes = categorizationStats.deviceTypes || {};
            const deviceLabels = Object.keys(deviceTypes).filter(d => deviceTypes[d] > 0);

            this.charts.device.data.labels = deviceLabels;
            this.charts.device.data.datasets[0].data = deviceLabels.map(d => deviceTypes[d] || 0);
            this.charts.device.update();
        }

        // Targeting table - with dynamic columns
        const targetingTable = document.getElementById('targetingTable');
        const personaStats = this.data.growthAnalytics?.personaStats || {};
        // Note: overallCVR already defined above

        targetingTable.innerHTML = personaArray.filter(p => p.count > 0).map(p => {
            const channelInfo = bestChannelData[p.key] || {};
            const dynamicBestChannel = channelInfo.channel || p.bestChannel;
            const channelCVR = channelInfo.cvr;
            const isDataDriven = channelInfo.isDataDriven;

            // Get persona stats for new columns
            const stats = personaStats[p.key] || {};
            const topSourcePct = stats.topSourcePct ? stats.topSourcePct.toFixed(0) : '-';
            const topSource = stats.topSource || '-';
            const cvrVsAvg = stats.cvrVsAverage ? stats.cvrVsAverage.toFixed(0) : 0;
            const cvrVsAvgColor = cvrVsAvg > 0 ? 'text-green-400' : cvrVsAvg < 0 ? 'text-red-400' : 'text-gray-400';
            const cvrVsAvgSign = cvrVsAvg > 0 ? '+' : '';
            const sampleSize = stats.sampleSize || 0;

            // Dynamic nurture strategy
            const nurture = stats.nurtureStrategy || { priority: p.priority, reason: p.nurturePriority, description: '' };
            const priorityColor = nurture.priority === 'High' ? 'text-red-400' :
                                  nurture.priority === 'Medium' ? 'text-yellow-400' :
                                  nurture.priority === 'Low' ? 'text-green-400' : 'text-gray-400';

            return `
                <tr class="border-b border-gray-800">
                    <td class="py-3">
                        <span class="flex items-center gap-2">
                            <span class="w-3 h-3 rounded-full" style="background: ${p.color}"></span>
                            <span style="color: ${p.color}">${p.name}</span>
                        </span>
                    </td>
                    <td class="py-3 text-gray-300">
                        ${dynamicBestChannel}
                        ${isDataDriven ? `<span class="text-xs text-green-400 ml-1">(${channelCVR}%)</span>` : ''}
                    </td>
                    <td class="py-3 text-gray-300">
                        <span class="text-white">${topSourcePct}%</span>
                        <span class="text-gray-500 text-xs ml-1">${topSource}</span>
                    </td>
                    <td class="py-3 ${cvrVsAvgColor} font-medium">
                        ${cvrVsAvgSign}${cvrVsAvg}%
                    </td>
                    <td class="py-3">
                        <span class="${priorityColor} font-medium">${nurture.priority}</span>
                        <span class="text-gray-500 text-xs ml-1">${nurture.description}</span>
                    </td>
                    <td class="py-3 text-gray-400 text-xs">
                        ${sampleSize} conv
                    </td>
                </tr>
            `;
        }).join('');

        // Update persona growth chart
        this.updatePersonaGrowthChart();

        // Update persona growth cards
        this.updatePersonaGrowthCards();
    }

    updatePersonaGrowthChart() {
        if (!this.charts.personaGrowth) return;

        const growthData = this.data.personaGrowthDaily || {};
        const dates = Object.keys(growthData).sort();

        // Filter to selected period
        const periodDates = dates.slice(-this.growthPeriod);

        // Prepare datasets for each persona
        const datasets = Object.entries(PERSONA_DEFINITIONS).map(([key, def]) => {
            // Calculate cumulative values for each date
            let cumulative = 0;
            const data = [];

            // Get starting cumulative from before the period
            const prePeriodDates = dates.slice(0, dates.length - this.growthPeriod);
            prePeriodDates.forEach(date => {
                cumulative += (growthData[date]?.[key] || 0);
            });

            // Now add the period dates
            periodDates.forEach(date => {
                cumulative += (growthData[date]?.[key] || 0);
                data.push(cumulative);
            });

            return {
                label: def.name,
                data: data,
                borderColor: def.color,
                backgroundColor: def.color + '20',
                tension: 0.3,
                fill: false,
                pointRadius: 2,
                pointHoverRadius: 5
            };
        });

        // Format date labels
        const labels = periodDates.map(date => {
            const d = new Date(date);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });

        this.charts.personaGrowth.data.labels = labels;
        this.charts.personaGrowth.data.datasets = datasets;
        this.charts.personaGrowth.update();
    }

    updatePersonaGrowthCards() {
        const cardsContainer = document.getElementById('personaGrowthCards');
        if (!cardsContainer) return;

        const growthData = this.data.personaGrowthDaily || {};
        const dates = Object.keys(growthData).sort();
        const periodDates = dates.slice(-this.growthPeriod);

        // Calculate growth stats for each persona
        const personaStats = Object.entries(PERSONA_DEFINITIONS).map(([key, def]) => {
            // Calculate daily new registrations for the period
            const dailyNew = periodDates.map(date => growthData[date]?.[key] || 0);
            const totalNew = dailyNew.reduce((sum, val) => sum + val, 0);

            // Calculate 7-day and previous 7-day for trend
            const last7 = dailyNew.slice(-7).reduce((sum, val) => sum + val, 0);
            const prev7 = dailyNew.slice(-14, -7).reduce((sum, val) => sum + val, 0);
            const trend = prev7 > 0 ? ((last7 - prev7) / prev7 * 100).toFixed(0) : (last7 > 0 ? 100 : 0);

            // Daily average
            const avgDaily = (totalNew / this.growthPeriod).toFixed(1);

            // Current total and conversion data
            const currentTotal = this.data.personas[key]?.count || 0;
            const converted = this.data.personas[key]?.converted || 0;
            const cvr = currentTotal > 0 ? (converted / currentTotal * 100).toFixed(2) : 0;

            return {
                key,
                ...def,
                totalNew,
                last7,
                trend: parseInt(trend),
                avgDaily,
                currentTotal,
                converted,
                cvr: parseFloat(cvr),
                sparklineData: dailyNew.slice(-14) // Last 14 days for sparkline
            };
        }).filter(p => p.currentTotal > 0).sort((a, b) => b.currentTotal - a.currentTotal);

        // Calculate overall CVR for comparison
        const totalContacts = personaStats.reduce((sum, p) => sum + p.currentTotal, 0);
        const totalConverted = personaStats.reduce((sum, p) => sum + p.converted, 0);
        const overallCVR = totalContacts > 0 ? (totalConverted / totalContacts * 100) : 0;

        cardsContainer.innerHTML = personaStats.map(p => {
            const trendIcon = p.trend > 0 ? 'fa-arrow-up' : p.trend < 0 ? 'fa-arrow-down' : 'fa-minus';
            const trendColor = p.trend > 0 ? 'text-green-400' : p.trend < 0 ? 'text-red-400' : 'text-gray-400';
            const cvrColor = p.cvr > overallCVR ? 'text-green-400' : p.cvr > 0 ? 'text-yellow-400' : 'text-gray-400';
            const sparklineId = `sparkline-${p.key}`;

            return `
                <div class="card p-4 persona-card" style="border-left-color: ${p.color}">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h4 class="font-medium" style="color: ${p.color}">${p.name}</h4>
                            <div class="text-white font-bold text-xl mt-1">${this.formatNumber(p.currentTotal)}</div>
                        </div>
                        <div class="text-right">
                            <div class="text-xs text-gray-400">Last ${this.growthPeriod} days</div>
                            <div class="text-green-400 font-medium">+${this.formatNumber(p.totalNew)}</div>
                        </div>
                    </div>
                    <div class="sparkline-container mb-3">
                        <canvas id="${sparklineId}" height="40"></canvas>
                    </div>
                    <div class="grid grid-cols-4 gap-2 text-xs">
                        <div class="bg-gray-800 rounded p-2 text-center">
                            <div class="text-gray-400">7d New</div>
                            <div class="text-white font-medium">+${p.last7}</div>
                        </div>
                        <div class="bg-gray-800 rounded p-2 text-center">
                            <div class="text-gray-400">Avg/day</div>
                            <div class="text-white font-medium">${p.avgDaily}</div>
                        </div>
                        <div class="bg-gray-800 rounded p-2 text-center">
                            <div class="text-gray-400">Trend</div>
                            <div class="${trendColor} font-medium">
                                <i class="fas ${trendIcon} text-xs mr-1"></i>${Math.abs(p.trend)}%
                            </div>
                        </div>
                        <div class="bg-gray-800 rounded p-2 text-center">
                            <div class="text-gray-400">CVR</div>
                            <div class="${cvrColor} font-bold">${p.cvr}%</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Draw sparklines after DOM update
        setTimeout(() => {
            personaStats.forEach(p => {
                this.drawSparkline(`sparkline-${p.key}`, p.sparklineData, p.color);
            });
        }, 50);
    }

    updateAstrologyTab() {
        const stats = this.data.astrologyStats || {};
        const total = this.data.subscribers.length || 1;

        // Summary cards
        document.getElementById('astroWithDOB').textContent = this.formatNumber(stats.withDOB || 0);
        document.getElementById('astroWithDOBPct').textContent = `${((stats.withDOB || 0) / total * 100).toFixed(1)}% of contacts`;

        document.getElementById('astroWithBirthtime').textContent = this.formatNumber(stats.withBirthtime || 0);
        document.getElementById('astroWithBirthtimePct').textContent = `${((stats.withBirthtime || 0) / total * 100).toFixed(1)}% of contacts`;

        // Top zodiac sign
        const zodiacSigns = stats.zodiacSigns || {};
        const sortedZodiac = Object.entries(zodiacSigns)
            .filter(([, data]) => data.total > 0)
            .sort((a, b) => b[1].total - a[1].total);

        if (sortedZodiac.length > 0) {
            const [topSign, topData] = sortedZodiac[0];
            const zodiacInfo = ZODIAC_SIGNS[topSign];
            document.getElementById('astroTopZodiac').textContent = `${zodiacInfo.symbol} ${topSign}`;
            document.getElementById('astroTopZodiacPct').textContent = `${this.formatNumber(topData.total)} contacts`;
        }

        // Best converting zodiac sign
        const zodiacCVR = stats.zodiacCVR || {};
        const sortedByCVR = Object.entries(zodiacCVR)
            .filter(([sign]) => (zodiacSigns[sign]?.total || 0) >= 10) // Min 10 contacts
            .sort((a, b) => b[1] - a[1]);

        if (sortedByCVR.length > 0) {
            const [bestSign, bestCVR] = sortedByCVR[0];
            const zodiacInfo = ZODIAC_SIGNS[bestSign];
            document.getElementById('astroBestCVR').textContent = `${zodiacInfo.symbol} ${bestSign}`;
            document.getElementById('astroBestCVRPct').textContent = `${bestCVR.toFixed(2)}% CVR`;
        }

        // Update Zodiac Chart
        if (this.charts.zodiac) {
            const labels = Object.keys(ZODIAC_SIGNS).map(sign => `${ZODIAC_SIGNS[sign].symbol} ${sign}`);
            const data = Object.keys(ZODIAC_SIGNS).map(sign => zodiacSigns[sign]?.total || 0);

            this.charts.zodiac.data.labels = labels;
            this.charts.zodiac.data.datasets[0].data = data;
            this.charts.zodiac.update();
        }

        // Update Gender Chart
        if (this.charts.gender) {
            const genderData = stats.genderDistribution || { Male: 0, Female: 0, Unknown: 0 };
            this.charts.gender.data.datasets[0].data = [genderData.Male, genderData.Female, genderData.Unknown];
            this.charts.gender.update();
        }

        // Update Birthtime Chart
        if (this.charts.birthtime) {
            const birthtimeData = stats.birthtimePeriods || {};
            this.charts.birthtime.data.datasets[0].data = [
                birthtimeData['Morning (5-12)'] || 0,
                birthtimeData['Afternoon (12-17)'] || 0,
                birthtimeData['Evening (17-21)'] || 0,
                birthtimeData['Night (21-5)'] || 0
            ];
            this.charts.birthtime.update();
        }

        // Update Element Chart (Ngũ Hành)
        if (this.charts.element) {
            const elementData = stats.elements || {};
            this.charts.element.data.datasets[0].data = [
                elementData.Kim || 0,
                elementData.Mộc || 0,
                elementData.Thủy || 0,
                elementData.Hỏa || 0,
                elementData.Thổ || 0
            ];
            this.charts.element.update();
        }

        // Zodiac Performance Table
        const zodiacTable = document.getElementById('zodiacTable');
        if (zodiacTable) {
            const totalZodiac = Object.values(zodiacSigns).reduce((sum, d) => sum + d.total, 0) || 1;
            const overallCVR = this.data.growthAnalytics ?
                (this.data.growthAnalytics.customers / (this.data.growthAnalytics.leads + this.data.growthAnalytics.customers) * 100) : 0;

            zodiacTable.innerHTML = sortedZodiac.map(([sign, data]) => {
                const zodiacInfo = ZODIAC_SIGNS[sign];
                const pct = (data.total / totalZodiac * 100).toFixed(1);
                const cvr = data.total > 0 ? (data.customers / data.total * 100) : 0;
                const cvrColor = cvr > overallCVR ? 'text-green-400' : cvr > 0 ? 'text-yellow-400' : 'text-gray-400';
                const topGender = data.male > data.female ? 'Male' : data.female > data.male ? 'Female' : 'Even';
                const topGenderColor = topGender === 'Male' ? 'text-blue-400' : topGender === 'Female' ? 'text-pink-400' : 'text-gray-400';
                const elementColor = {
                    'Kim': 'text-yellow-400',
                    'Mộc': 'text-green-400',
                    'Thủy': 'text-blue-400',
                    'Hỏa': 'text-red-400',
                    'Thổ': 'text-purple-400'
                }[zodiacInfo.element];

                return `
                    <tr class="border-b border-gray-800">
                        <td class="py-3">
                            <span style="color: ${zodiacInfo.color}" class="font-medium">${zodiacInfo.symbol} ${sign}</span>
                        </td>
                        <td class="text-right py-3 text-white">${this.formatNumber(data.total)}</td>
                        <td class="text-right py-3 text-gray-400">${pct}%</td>
                        <td class="text-right py-3 text-green-400">${this.formatNumber(data.customers)}</td>
                        <td class="text-right py-3 ${cvrColor} font-medium">${cvr.toFixed(2)}%</td>
                        <td class="py-3 ${elementColor}">${zodiacInfo.element}</td>
                        <td class="py-3 ${topGenderColor}">${topGender}</td>
                    </tr>
                `;
            }).join('');
        }

        // Gender x Persona Table
        const genderPersonaTable = document.getElementById('genderPersonaTable');
        if (genderPersonaTable && stats.genderByPersona) {
            const personas = Object.entries(this.data.personas || {})
                .filter(([, p]) => p.count > 0)
                .sort((a, b) => b[1].count - a[1].count);

            genderPersonaTable.innerHTML = personas.map(([personaKey, persona]) => {
                const genderData = stats.genderByPersona[personaKey] || {};
                const maleData = genderData.Male || { total: 0, customers: 0 };
                const femaleData = genderData.Female || { total: 0, customers: 0 };
                const unknownData = genderData.Unknown || { total: 0, customers: 0 };

                const maleCVR = maleData.total > 0 ? (maleData.customers / maleData.total * 100) : 0;
                const femaleCVR = femaleData.total > 0 ? (femaleData.customers / femaleData.total * 100) : 0;

                let bestGender = '-';
                let bestGenderColor = 'text-gray-400';
                if (maleData.total >= 10 && femaleData.total >= 10) {
                    if (maleCVR > femaleCVR) {
                        bestGender = 'Male';
                        bestGenderColor = 'text-blue-400';
                    } else if (femaleCVR > maleCVR) {
                        bestGender = 'Female';
                        bestGenderColor = 'text-pink-400';
                    } else {
                        bestGender = 'Equal';
                        bestGenderColor = 'text-gray-400';
                    }
                } else if (maleData.total >= 10) {
                    bestGender = 'Male (only)';
                    bestGenderColor = 'text-blue-400';
                } else if (femaleData.total >= 10) {
                    bestGender = 'Female (only)';
                    bestGenderColor = 'text-pink-400';
                }

                const maleCVRColor = maleCVR > femaleCVR ? 'text-green-400' : 'text-gray-400';
                const femaleCVRColor = femaleCVR > maleCVR ? 'text-green-400' : 'text-gray-400';

                return `
                    <tr class="border-b border-gray-800">
                        <td class="py-3">
                            <span class="flex items-center gap-2">
                                <span class="w-3 h-3 rounded-full" style="background: ${persona.color}"></span>
                                <span style="color: ${persona.color}" class="font-medium">${persona.name}</span>
                            </span>
                        </td>
                        <td class="text-right py-3 text-blue-400">${this.formatNumber(maleData.total)}</td>
                        <td class="text-right py-3 text-pink-400">${this.formatNumber(femaleData.total)}</td>
                        <td class="text-right py-3 text-gray-400">${this.formatNumber(unknownData.total)}</td>
                        <td class="text-right py-3 ${maleCVRColor} font-medium">${maleCVR.toFixed(2)}%</td>
                        <td class="text-right py-3 ${femaleCVRColor} font-medium">${femaleCVR.toFixed(2)}%</td>
                        <td class="py-3 ${bestGenderColor} font-medium">${bestGender}</td>
                    </tr>
                `;
            }).join('');
        }
    }

    drawSparkline(canvasId, data, color) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.parentElement.offsetWidth;
        const height = 40;

        canvas.width = width;
        canvas.height = height;

        if (data.length < 2) return;

        const max = Math.max(...data, 1);
        const min = 0;
        const range = max - min || 1;

        const stepX = width / (data.length - 1);
        const points = data.map((val, i) => ({
            x: i * stepX,
            y: height - ((val - min) / range) * (height - 10) - 5
        }));

        // Draw gradient fill
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, color + '40');
        gradient.addColorStop(1, color + '00');

        ctx.beginPath();
        ctx.moveTo(points[0].x, height);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(points[points.length - 1].x, height);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw line
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw end point
        const lastPoint = points[points.length - 1];
        ctx.beginPath();
        ctx.arc(lastPoint.x, lastPoint.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
    }

    formatNumber(num) {
        if (typeof num !== 'number' || isNaN(num)) return '-';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toLocaleString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    showError(message) {
        const errorEl = document.getElementById('connectionError');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
            setTimeout(() => errorEl.classList.add('hidden'), 5000);
        }
    }

    disconnect() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        localStorage.removeItem('fluentcrm_credentials');
        location.reload();
    }
}

// Tab switching
function setTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabId) {
            btn.classList.add('active');
        }
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById(`tab-${tabId}`)?.classList.remove('hidden');
}

// Global functions
let dashboard;

window.addEventListener('DOMContentLoaded', () => {
    dashboard = new CRMDashboard();
});

function refreshData() {
    if (dashboard) {
        dashboard.refreshData();
    }
}

function disconnect() {
    if (dashboard) {
        dashboard.disconnect();
    }
}

function setGrowthPeriod(days) {
    if (dashboard) {
        dashboard.setGrowthPeriod(days);
    }
}
