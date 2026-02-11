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

// Persona Definitions based on Generation (DOB-based)
// Gen Z: 2000-2012 (12-24 years old in 2024)
// Millennial: 1981-1999 (25-43 years old in 2024)
// Gen X: 1965-1980 (44-59 years old in 2024)
// Boomer: 1946-1964 (60-78 years old in 2024)
const PERSONA_DEFINITIONS = {
    'gen_z': {
        name: 'Gen Z',
        color: '#f97316', // orange
        description: 'Born 2000-2012, digital natives, mobile-first',
        birthYearRange: [2000, 2012],
        priority: 'Medium',
        bestChannel: 'TikTok, Instagram Reels',
        recommendedOffer: '99K impulse offer',
        nurturePriority: 'Low - decide fast, impulse buyers'
    },
    'millennial': {
        name: 'Millennial',
        color: '#3b82f6', // blue
        description: 'Born 1981-1999, career-focused, value-seekers',
        birthYearRange: [1981, 1999],
        priority: 'High',
        bestChannel: 'Facebook, Google Ads',
        recommendedOffer: '299K value package',
        nurturePriority: 'High - research before buying'
    },
    'gen_x': {
        name: 'Gen X',
        color: '#8b5cf6', // purple
        description: 'Born 1965-1980, family-oriented, high purchasing power',
        birthYearRange: [1965, 1980],
        priority: 'High',
        bestChannel: 'Zalo OA, Facebook',
        recommendedOffer: '399K family package',
        nurturePriority: 'Medium - practical buyers'
    },
    'boomer': {
        name: 'Boomer',
        color: '#10b981', // green
        description: 'Born 1946-1964, premium segment, high AOV',
        birthYearRange: [1946, 1964],
        priority: 'Medium',
        bestChannel: 'Direct, Referral, Zalo',
        recommendedOffer: '599K premium',
        nurturePriority: 'Low - decide fast when trust built'
    },
    'unknown': {
        name: 'Unknown',
        color: '#6b7280', // gray
        description: 'Missing DOB data, needs profiling',
        birthYearRange: null,
        priority: 'Low',
        bestChannel: 'Progressive profiling',
        recommendedOffer: '199K low-commitment',
        nurturePriority: 'Medium - needs data collection'
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

// Helper: Assign persona based on birth year (generation)
// Gen Z: 2000-2012, Millennial: 1981-1999, Gen X: 1965-1980, Boomer: 1946-1964
function assignPersona(birthYear) {
    if (!birthYear || birthYear === 'Unknown') return 'unknown';
    const year = parseInt(birthYear);
    if (isNaN(year)) return 'unknown';

    if (year >= 2000 && year <= 2012) return 'gen_z';
    if (year >= 1981 && year <= 1999) return 'millennial';
    if (year >= 1965 && year <= 1980) return 'gen_x';
    if (year >= 1946 && year <= 1964) return 'boomer';

    // Outside defined ranges
    if (year > 2012) return 'gen_z';     // Younger than Gen Z
    if (year < 1946) return 'boomer';    // Older than Boomer

    return 'unknown';
}

// Helper: Parse gender (supports multiple formats)
function parseGender(genderValue) {
    if (genderValue === null || genderValue === undefined || genderValue === '') return 'Unknown';

    // Handle numeric values
    if (genderValue === 1 || genderValue === '1') return 'Male';
    if (genderValue === -1 || genderValue === '-1' || genderValue === 0 || genderValue === '0') return 'Female';

    // Handle string values (case-insensitive)
    const strVal = String(genderValue).toLowerCase().trim();

    // Male variations
    if (['male', 'm', 'nam', 'man', 'boy'].includes(strVal)) return 'Male';

    // Female variations
    if (['female', 'f', 'nữ', 'nu', 'woman', 'girl'].includes(strVal)) return 'Female';

    return 'Unknown';
}

// Helper: Extract DOB from subscriber with all possible field names
function extractDOB(subscriber) {
    return subscriber.custom_fields?.dob ||
           subscriber.custom_fields?.date_of_birth ||
           subscriber.custom_fields?.birthday ||
           subscriber.custom_fields?.ngay_sinh ||  // Vietnamese
           subscriber.date_of_birth ||
           subscriber.dob ||
           subscriber.d ||  // Compressed format
           null;
}

// Helper: Parse birth year from DOB string (handles DD/MM/YYYY format used by FluentCRM)
function parseBirthYear(dob) {
    if (!dob) return null;
    try {
        const dobStr = String(dob).trim();

        // Method 1: Parse DD/MM/YYYY or DD-MM-YYYY format (FluentCRM format)
        const ddmmyyyy = dobStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (ddmmyyyy) {
            const year = parseInt(ddmmyyyy[3]);
            if (year >= 1920 && year <= 2015) return year;
        }

        // Method 2: Parse YYYY-MM-DD or YYYY/MM/DD format (ISO format)
        const yyyymmdd = dobStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
        if (yyyymmdd) {
            const year = parseInt(yyyymmdd[1]);
            if (year >= 1920 && year <= 2015) return year;
        }

        // Method 3: Look for any 4-digit year in the string (1920-2015)
        const yearMatch = dobStr.match(/\b(19[2-9]\d|20[0-1]\d)\b/);
        if (yearMatch) {
            return parseInt(yearMatch[1]);
        }

        return null;
    } catch (e) {
        return null;
    }
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
        let year;

        if (typeof dob === 'string') {
            // Try parsing ISO date first (e.g., "2023-05-15T00:00:00" or "2023-05-15")
            const isoDate = new Date(dob);
            if (!isNaN(isoDate.getTime()) && isoDate.getFullYear() >= 1900 && isoDate.getFullYear() <= 2100) {
                year = isoDate.getFullYear();
            } else {
                // Fallback to manual parsing for formats like DD/MM/YYYY, MM-DD-YYYY, etc.
                const parts = dob.split(/[\/\-\.]/);
                if (parts.length >= 1) {
                    // Find the 4-digit year in the parts
                    const yearPart = parts.find(p => p.length === 4 && !isNaN(parseInt(p)));
                    if (yearPart) {
                        year = parseInt(yearPart);
                    }
                }
            }
        } else if (dob instanceof Date) {
            year = dob.getFullYear();
        } else if (typeof dob === 'number') {
            // Might be a year directly or a timestamp
            year = dob > 1900 && dob < 2100 ? dob : new Date(dob).getFullYear();
        }

        if (!year || isNaN(year) || year < 1900 || year > 2100) return null;

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
            astrologyStats: {}, // Store zodiac, gender, birthtime data
            timeOfDayStats: null, // Store time of day analysis data
            woocommerce: { // WooCommerce order analytics
                orders: [],
                customerOrders: {},
                metrics: {}
            }
        };

        // WooCommerce API credentials
        this.wcCredentials = {
            consumerKey: 'ck_2df779b69df26d3c4ffdabbb1d1a9688e1111314',
            consumerSecret: 'cs_67e56c53a8bcb2c797797c9d7e506e64c6fcfac3'
        };
        this.charts = {};
        this.refreshInterval = null;
        this.growthPeriod = 30; // Default to 30 days

        // Global date filter state
        this.dateFilter = {
            startDate: null,  // null = all time
            endDate: null,
            preset: 'all'     // 'all', '7d', '30d', '90d', 'ytd', 'custom'
        };

        // Internal team & test account exclusions
        this.excludedEmails = new Set([
            'thaido.hn@gmail.com',
            'dominhthai94@gmail.com',
            'oxgarp@gmail.com',
            'thangdm@agentics.vn',
            'thang.arsenal@gmail.com',
            'hongnt@agentics.vn',
            'hongnt.mgc@gmail.com',
            'hongng.1607@gmail.com',
            'tad@agentics.vn',
            'tad@accel3.com',
            'trinhad@gmail.com',
            'hangpt@agentics.vn',
            'quangtt@agentics.vn',
            'truongtuequang@gmail.com',
            'locnv@agentics.vn',
            'phankhue1711996@gmail.com',
            'phankhue171@gmail.com',
            'khanh077@gmail.com',
            'ducnguyen.88880@gmail.com',
            'maymancuatoi90+1@gmail.com',
            'ducnguyen.88880+1@gmail.com',
            'maymancuatoi2017+2@gmail.com',
            'maymancuatoi2017+3@gmail.com',
            'khue@gmail.com',
            'phuongbich@gmail.com',
            'truongtueanan@gmail.com'
        ]);

        // Pattern to match test emails
        this.testEmailPattern = /test|testing|tester/i;

        // Conditional filter state (applied before date filter)
        // Multi-condition filter with AND/OR support
        this.conditionalFilter = {
            mode: 'AND',           // 'AND' or 'OR'
            conditions: [],        // Array of { type, params, label }
            label: 'All Customers' // Display label
        };

        // Sync management to prevent server overload
        this.isSyncing = false;
        this.lastSyncTime = localStorage.getItem('fluentcrm_last_sync') || null;
        this.subscriberCache = null;

        this.init();
    }

    // Sync lock management - prevents multiple tabs from syncing simultaneously
    acquireSyncLock() {
        const SYNC_LOCK_KEY = 'fluentcrm_sync_lock';
        const lock = localStorage.getItem(SYNC_LOCK_KEY);
        const now = Date.now();

        // If lock exists and is less than 2 minutes old, another tab is syncing
        if (lock && now - parseInt(lock) < 120000) {
            console.log('Another tab is syncing, skipping...');
            return false;
        }

        // Acquire lock
        localStorage.setItem(SYNC_LOCK_KEY, now.toString());
        return true;
    }

    releaseSyncLock() {
        localStorage.removeItem('fluentcrm_sync_lock');
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

    // ============================================
    // SUPABASE SUBSCRIBER CACHE
    // Persist subscriber data across users/sessions
    // ============================================

    // Load cached subscribers from Supabase
    async loadSubscriberCache() {
        try {
            console.log('Loading subscriber cache from Supabase...');
            const { data, error } = await supabaseClient
                .from('subscriber_cache')
                .select('*')
                .eq('cache_key', 'main')
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    console.log('No cache found in Supabase (first run)');
                    return null;
                }
                throw error;
            }

            if (data && data.subscribers && data.subscribers.length > 0) {
                const cacheAge = Date.now() - new Date(data.updated_at).getTime();
                const cacheAgeHours = (cacheAge / (1000 * 60 * 60)).toFixed(1);
                console.log(`Loaded ${data.subscriber_count} subscribers from Supabase cache (${cacheAgeHours}h old)`);

                // Expand minimal format back to full field names
                const isMinimalFormat = data.metadata?.format === 'minimal_v2';
                let subscribers = data.subscribers;

                if (isMinimalFormat) {
                    console.log('Expanding minimal format cache...');
                    const statusMap = { 's': 'subscribed', 'p': 'pending', 'u': 'unsubscribed', 'b': 'bounced' };
                    const typeMap = { 'l': 'lead', 'c': 'customer' };

                    subscribers = data.subscribers.map(sub => ({
                        id: sub.id,
                        email: sub.e,  // Email for order matching
                        status: statusMap[sub.s] || sub.s || 'subscribed',
                        contact_type: typeMap[sub.t] || sub.t || 'lead',
                        created_at: sub.c,
                        updated_at: sub.u,
                        // Analytics fields
                        date_of_birth: sub.d,
                        source: sub.src,
                        custom_fields: {
                            birth_time: sub.bt,
                            gender: sub.g,
                            device: sub.dev  // Device for persona assignment
                        },
                        // Growth analytics fields
                        last_activity: sub.la,  // For engagement stats
                        device: sub.dev,        // Fallback device field
                        // Synthetic tags for CVR calculation
                        tags: sub.cv ? [{ title: 'converted' }] : [],
                        _tagCount: sub.tc
                    }));
                }

                // ALWAYS ensure all fields exist (handles both old and new cache formats)
                // This fallback ensures data works even when isMinimalFormat is false
                const statusMap = { 's': 'subscribed', 'p': 'pending', 'u': 'unsubscribed', 'b': 'bounced' };
                const typeMap = { 'l': 'lead', 'c': 'customer' };

                subscribers = subscribers.map(sub => ({
                    ...sub,
                    // Core fields
                    email: sub.email || sub.e,
                    created_at: sub.created_at || sub.c,
                    updated_at: sub.updated_at || sub.u,
                    source: sub.source || sub.src,
                    last_activity: sub.last_activity || sub.la,

                    // DOB - both formats for compatibility
                    date_of_birth: sub.date_of_birth || sub.d,
                    dob: sub.dob || sub.date_of_birth || sub.d,

                    // Device - both formats for compatibility
                    device: sub.device || sub.dev,
                    device_type: sub.device_type || sub.device || sub.dev,

                    // Status and contact_type - critical for CVR calculations
                    status: sub.status || statusMap[sub.s] || 'subscribed',
                    contact_type: sub.contact_type || typeMap[sub.t] || 'lead',

                    // Top-level gender and birthtime for direct access
                    gender: sub.gender || sub.custom_fields?.gender || sub.g,
                    birthtime: sub.birthtime || sub.custom_fields?.birth_time || sub.bt,

                    // Custom fields with all variants
                    custom_fields: {
                        ...(sub.custom_fields || {}),
                        gender: sub.custom_fields?.gender || sub.g,
                        birth_time: sub.custom_fields?.birth_time || sub.bt,
                        birthtime: sub.custom_fields?.birthtime || sub.bt,
                        device: sub.custom_fields?.device || sub.dev,
                        dob: sub.custom_fields?.dob || sub.d,
                        date_of_birth: sub.custom_fields?.date_of_birth || sub.d
                    }
                }));

                return {
                    subscribers: subscribers,
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

    // Save subscribers to Supabase cache
    async saveSubscriberCache() {
        try {
            if (!this.data.subscribers || this.data.subscribers.length === 0) {
                console.log('No subscribers to cache');
                return;
            }

            // Aggressively trim to absolute minimum - only IDs and essential fields
            // Tags are excluded (too large) - they'll be fetched on incremental sync
            console.log(`Preparing ${this.data.subscribers.length} subscribers for Supabase cache...`);

            const subscribersToCache = this.data.subscribers.map(sub => {
                // Extract DOB from various possible locations
                const dob = sub.date_of_birth ||
                           sub.custom_fields?.date_of_birth ||
                           sub.custom_fields?.dob ||
                           sub.custom_fields?.ngay_sinh ||
                           null;

                // Extract birth time for astrology
                const birthTime = sub.custom_fields?.birth_time ||
                                 sub.custom_fields?.gio_sinh ||
                                 null;

                // Extract gender
                const gender = sub.custom_fields?.gender ||
                              sub.custom_fields?.gioi_tinh ||
                              null;

                // Check if has conversion tags (for CVR)
                const hasConversionTag = sub.tags?.some(t => {
                    const title = (t.title || t.name || '').toLowerCase();
                    return title.includes('paid') || title.includes('customer') ||
                           title.includes('purchased') || title.includes('buyer') ||
                           title.includes('thanh-toan') || title.includes('da-mua');
                }) || false;

                // Extract device info for persona assignment
                const device = sub.custom_fields?.device ||
                              sub.device || sub.device_type ||
                              sub.custom_values?.device ||
                              sub.meta?.device ||
                              sub.user_agent || null;

                return {
                    id: sub.id,
                    e: sub.email?.toLowerCase(),  // email (for order matching)
                    s: sub.status?.charAt(0), // 's'=subscribed, 'p'=pending, etc (1 char)
                    t: sub.contact_type?.charAt(0), // 'l'=lead, 'c'=customer (1 char)
                    c: sub.created_at,
                    u: sub.updated_at,
                    // Analytics fields
                    d: dob,           // date of birth (for zodiac)
                    bt: birthTime,    // birth time
                    g: gender,        // gender
                    src: sub.source,  // traffic source
                    cv: hasConversionTag ? 1 : 0, // converted (1/0)
                    tc: sub.tags?.length || 0,    // tag count
                    // Growth analytics fields
                    la: sub.last_activity,        // last activity (for engagement)
                    dev: device                    // device (for persona)
                };
            });

            const payloadSize = JSON.stringify(subscribersToCache).length;
            const payloadMB = (payloadSize / (1024 * 1024)).toFixed(2);
            console.log(`Trimmed payload: ${payloadMB} MB (${subscribersToCache.length} subscribers)`);

            // If still too large (>5MB), skip caching
            if (payloadSize > 5 * 1024 * 1024) {
                console.log('⚠️ Payload still too large for Supabase, skipping cache save');
                return;
            }

            const cacheData = {
                cache_key: 'main',
                last_sync_time: this.lastSyncTime || new Date().toISOString(),
                subscriber_count: this.data.subscribers.length,
                subscribers: subscribersToCache,
                metadata: {
                    payload_mb: payloadMB,
                    contacts_total: this.data.contacts?.total || 0,
                    format: 'minimal_v2' // Track format version
                }
            };

            const { data, error } = await supabaseClient
                .from('subscriber_cache')
                .upsert(cacheData, { onConflict: 'cache_key' })
                .select();

            if (error) {
                console.error('Supabase upsert error:', error);
                throw error;
            }

            console.log('✅ Subscriber cache saved to Supabase successfully');
            this.logAuditEvent('cache_saved', {
                subscriber_count: this.data.subscribers.length,
                payload_mb: payloadMB
            });
        } catch (e) {
            console.error('❌ Failed to save cache to Supabase:', e);
            console.error('Error details:', e.message, e.code, e.details);
        }
    }

    // Check if cache has valid data (no time limit - incremental sync will update it)
    isCacheValid(cacheData) {
        // Cache is valid as long as it has subscribers
        // The incremental sync will fetch any new/updated records from FluentCRM
        return cacheData &&
               cacheData.subscribers &&
               cacheData.subscribers.length > 0;
    }

    // ============================================
    // SUPABASE ORDER CACHE
    // Persist WooCommerce orders across sessions
    // ============================================

    // Load cached orders from Supabase
    async loadOrderCache() {
        try {
            console.log('Loading order cache from Supabase...');
            const { data, error } = await supabaseClient
                .from('order_cache')
                .select('*')
                .eq('cache_key', 'main')
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    console.log('No order cache found in Supabase (first run)');
                    return null;
                }
                throw error;
            }

            if (data && data.orders && data.orders.length > 0) {
                const cacheAge = Date.now() - new Date(data.updated_at).getTime();
                const cacheAgeHours = (cacheAge / (1000 * 60 * 60)).toFixed(1);
                console.log(`Loaded ${data.order_count} orders from Supabase cache (${cacheAgeHours}h old)`);

                // Expand cached flat format to expected nested structure
                const orders = data.orders.map(order => ({
                    ...order,
                    billing: {
                        email: order.billing_email,
                        first_name: order.billing_first_name,
                        last_name: order.billing_last_name
                    }
                }));

                return {
                    orders: orders,
                    lastSyncTime: data.last_sync_time,
                    lastOrderId: data.last_order_id || 0,
                    orderCount: data.order_count,
                    updatedAt: data.updated_at
                };
            }

            return null;
        } catch (e) {
            console.log('Failed to load order cache from Supabase:', e.message);
            return null;
        }
    }

    // Save orders to Supabase cache
    async saveOrderCache() {
        try {
            const orders = this.data.woocommerce?.orders || [];
            if (orders.length === 0) {
                console.log('No orders to cache');
                return;
            }

            console.log(`Preparing ${orders.length} orders for Supabase cache...`);

            // Trim orders to essential fields only
            const ordersToCache = orders.map(order => ({
                id: order.id,
                status: order.status,
                date_created: order.date_created,
                total: order.total,
                currency: order.currency,
                billing_email: order.billing?.email?.toLowerCase(),
                billing_first_name: order.billing?.first_name,
                billing_last_name: order.billing?.last_name,
                line_items: (order.line_items || []).map(item => ({
                    product_id: item.product_id,
                    name: item.name,
                    sku: item.sku,
                    quantity: item.quantity,
                    total: item.total
                }))
            }));

            // Find the highest order ID for incremental sync
            const maxOrderId = Math.max(...orders.map(o => o.id), 0);

            const payloadSize = JSON.stringify(ordersToCache).length;
            const payloadMB = (payloadSize / (1024 * 1024)).toFixed(2);
            console.log(`Order cache payload: ${payloadMB} MB (${ordersToCache.length} orders)`);

            // If too large (>5MB), skip caching
            if (payloadSize > 5 * 1024 * 1024) {
                console.log('⚠️ Order payload too large for Supabase, skipping cache save');
                return;
            }

            const cacheData = {
                cache_key: 'main',
                last_sync_time: new Date().toISOString(),
                last_order_id: maxOrderId,
                order_count: ordersToCache.length,
                orders: ordersToCache,
                metadata: {
                    payload_mb: payloadMB,
                    max_order_id: maxOrderId
                }
            };

            const { error } = await supabaseClient
                .from('order_cache')
                .upsert(cacheData, { onConflict: 'cache_key' });

            if (error) {
                console.error('Supabase order cache upsert error:', error);
                throw error;
            }

            console.log('✅ Order cache saved to Supabase successfully');
            this.logAuditEvent('order_cache_saved', {
                order_count: ordersToCache.length,
                payload_mb: payloadMB,
                max_order_id: maxOrderId
            });
        } catch (e) {
            console.error('❌ Failed to save order cache to Supabase:', e);
            console.error('Error details:', e.message, e.code, e.details);
        }
    }

    // Check if order cache is valid
    isOrderCacheValid(cacheData) {
        return cacheData &&
               cacheData.orders &&
               cacheData.orders.length > 0;
    }

    // Save daily metrics snapshot to Supabase
    async saveDailyMetrics() {
        const today = new Date().toISOString().split('T')[0];

        // Use subscribers array for counting (contacts is an object with stats, not an array)
        const subscribers = this.data.subscribers || [];

        const metrics = {
            date: today,
            total_contacts: this.data.contacts?.total || subscribers.length,
            subscribed: subscribers.filter(c => c.status === 'subscribed').length,
            pending: subscribers.filter(c => c.status === 'pending').length,
            unsubscribed: subscribers.filter(c => c.status === 'unsubscribed').length,
            bounced: subscribers.filter(c => c.status === 'bounced').length,
            total_lists: this.data.lists?.length || 0,
            total_tags: this.data.tags?.length || 0,
            total_campaigns: this.data.campaigns?.length || 0,
            leads: subscribers.filter(c => c.contact_type === 'lead').length,
            customers: subscribers.filter(c => c.contact_type === 'customer').length,
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

            // MANUAL REFRESH MODE - Auto-refresh disabled to protect WordPress server
            // Users click the Refresh button when they need updated data
            // This prevents the 174K+ DB queries that crashed the server
            console.log('Dashboard running in manual refresh mode - click Refresh button to update data');

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

    async refreshData(forceFullSync = false) {
        // Prevent concurrent syncs (same tab)
        if (this.isSyncing) {
            console.log('Sync already in progress, skipping...');
            return;
        }

        // Prevent concurrent syncs (cross-tab)
        if (!this.acquireSyncLock()) {
            console.log('Another tab is syncing, using cached data...');
            this.loadFromCache();
            return;
        }

        this.isSyncing = true;
        console.log('Refreshing dashboard data...');

        // Show loading indicator immediately
        this.updateSyncSourceUI('supabase', '(checking cache...)');

        try {
            // Try to load cached data first for instant display
            if (!forceFullSync) {
                this.loadFromCache();
                if (this.data.subscribers.length > 0) {
                    // Show cached data immediately
                    this.categorizePersonas();
                    this.calculatePersonaGrowth();
                    this.calculateGrowthAnalytics();
                    this.calculateAstrologyStats();
                    this.calculateTimeOfDayStats();
                    this.updateDashboard();
                }
            }

            // Step 1: Fetch metadata (lists, tags, campaigns, sequences)
            this.updateSyncSourceUI('full', '(fetching metadata...)');
            const [listsData, tagsData, campaignsData, sequencesData] = await Promise.all([
                this.apiCall('/lists'),
                this.apiCall('/tags'),
                this.apiCall('/campaigns?per_page=100'),
                this.apiCall('/sequences?per_page=100')
            ]);

            // Step 2: Fetch contact stats
            this.updateSyncSourceUI('full', '(fetching stats...)');
            await this.fetchContactStats();

            this.data.lists = this.extractArray(listsData, 'lists');
            this.data.tags = this.extractArray(tagsData, 'tags');
            this.data.campaigns = this.extractArray(campaignsData, 'campaigns');
            this.data.sequences = this.extractArray(sequencesData, 'sequences');

            // Step 3: Fetch subscribers (this is the big one)
            await this.fetchSubscribers(forceFullSync);
            this.categorizePersonas();
            this.calculatePersonaGrowth();
            this.calculateGrowthAnalytics();
            this.calculateAstrologyStats();
            this.savePersonaHistory();

            // Step 4: Fetch WooCommerce orders
            this.updateSyncSourceUI('full', '(fetching orders...)');
            await this.fetchWooCommerceOrders(forceFullSync);

            // Step 5: Calculate time of day stats (needs both subscribers and orders)
            this.calculateTimeOfDayStats();

            // Update sync status to show completion
            this.updateSyncSourceUI('supabase', `(${this.data.subscribers.length} synced)`);

            this.updateDashboard();

            // Save to cache for next load
            this.saveToCache();

            // Save daily metrics to Supabase
            this.saveDailyMetrics();

            // Update last sync time
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem('fluentcrm_last_sync', this.lastSyncTime);

            document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();

        } catch (error) {
            console.error('Error refreshing data:', error);
        } finally {
            this.isSyncing = false;
            this.releaseSyncLock();
        }
    }

    // Load subscriber data from localStorage cache
    // Note: Full subscriber data is now in Supabase, localStorage only has metadata
    loadFromCache() {
        try {
            // Check if we have cached metadata (not full data - that's in Supabase)
            const cached = localStorage.getItem('fluentcrm_cache_meta');
            if (cached) {
                const { timestamp, subscriberCount } = JSON.parse(cached);
                // Just log that we have cache info - actual data loads from Supabase
                if (Date.now() - timestamp < 3600000) {
                    console.log(`Cache metadata found: ${subscriberCount} subscribers (will load from Supabase)`);
                    return false; // Return false so Supabase cache is used
                }
            }
        } catch (e) {
            console.log('Could not load cache:', e.message);
        }
        return false;
    }

    // Save subscriber data to localStorage cache
    // Note: localStorage has ~5MB limit, so we only cache metadata, not full subscriber data
    // Full subscriber data is cached in Supabase instead
    saveToCache() {
        try {
            // Only save timestamp and count - Supabase handles the full data
            const cacheData = {
                timestamp: Date.now(),
                subscriberCount: this.data.subscribers?.length || 0
            };
            localStorage.setItem('fluentcrm_cache_meta', JSON.stringify(cacheData));
            console.log(`Cache metadata saved (${cacheData.subscriberCount} subscribers in Supabase)`);
        } catch (e) {
            console.log('Could not save cache metadata:', e.message);
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

    // Update sync source indicator in UI
    updateSyncSourceUI(source, details = '') {
        const el = document.getElementById('syncSource');
        if (!el) return;

        el.classList.remove('hidden', 'bg-success/20', 'text-success', 'bg-secondary/20', 'text-secondary', 'bg-warning/20', 'text-yellow-400');

        switch (source) {
            case 'supabase':
                el.textContent = `📦 Supabase cache ${details}`;
                el.classList.add('bg-success/20', 'text-success');
                break;
            case 'incremental':
                el.textContent = `⚡ Incremental sync ${details}`;
                el.classList.add('bg-secondary/20', 'text-secondary');
                break;
            case 'full':
                el.textContent = `🔄 Full sync ${details}`;
                el.classList.add('bg-warning/20', 'text-yellow-400');
                break;
            default:
                el.classList.add('hidden');
                return;
        }
    }

    async fetchSubscribers(forceFullSync = false) {
        try {
            // Step 1: Try to load from Supabase cache if we don't have data
            if (this.data.subscribers.length === 0 && !forceFullSync) {
                this.updateSyncSourceUI('supabase', '(loading...)');
                const cache = await this.loadSubscriberCache();

                if (cache && this.isCacheValid(cache)) {
                    // Use cached data from Supabase
                    this.data.subscribers = cache.subscribers;
                    this.lastSyncTime = cache.lastSyncTime;
                    localStorage.setItem('fluentcrm_last_sync', this.lastSyncTime);

                    const cacheAge = ((Date.now() - new Date(cache.updatedAt).getTime()) / (1000 * 60 * 60)).toFixed(1);
                    console.log(`✅ Loaded ${cache.subscriberCount} subscribers from Supabase cache (${cacheAge}h old)`);
                    this.updateSyncSourceUI('supabase', `(${cache.subscriberCount} loaded, fetching updates...)`);

                    // Do incremental sync to get any new changes from FluentCRM
                    console.log('🔄 Fetching updates from FluentCRM...');
                    await this.incrementalSubscriberSync();

                    // Save updated cache back to Supabase
                    this.updateSyncSourceUI('supabase', `(saving cache...)`);
                    await this.saveSubscriberCache();

                    // Fetch WooCommerce orders (always fetch fresh for purchase analytics)
                    this.updateSyncSourceUI('supabase', `(fetching orders...)`);
                    await this.fetchWooCommerceOrders();

                    // Update dashboard with new WooCommerce data
                    this.updateDashboard();

                    this.updateSyncSourceUI('incremental', `(${this.data.subscribers.length} total)`);
                    return;
                }
            }

            // Step 2: Check if we can do incremental sync (have local data)
            const canIncrementalSync = !forceFullSync &&
                                       this.lastSyncTime &&
                                       this.data.subscribers.length > 0;

            if (canIncrementalSync) {
                this.updateSyncSourceUI('incremental', '(syncing...)');
                await this.incrementalSubscriberSync();

                // Fetch WooCommerce orders (always fetch fresh for purchase analytics)
                this.updateSyncSourceUI('incremental', `(fetching orders...)`);
                await this.fetchWooCommerceOrders();

                // Update dashboard with new WooCommerce data
                this.updateDashboard();

                this.updateSyncSourceUI('incremental', `(${this.data.subscribers.length} total)`);
            } else {
                // Full sync required - first time or force refresh
                this.updateSyncSourceUI('full', '(syncing...)');
                console.log('⚠️ Full sync required - fetching all subscribers from FluentCRM...');
                await this.fullSubscriberSync();
                this.updateSyncSourceUI('full', `(${this.data.subscribers.length} fetched)`);
            }

            // Step 3: Save to Supabase cache after sync
            await this.saveSubscriberCache();

        } catch (e) {
            console.log('Could not fetch subscribers:', e);
            // Keep existing data if we have it
            if (this.data.subscribers.length === 0) {
                this.data.subscribers = [];
            }
        }
    }

    // Full sync - fetches ALL subscribers (only on first load or force refresh)
    async fullSubscriberSync() {
        let allSubscribers = [];
        let page = 1;
        const perPage = 500;
        const knownTotal = this.data.contacts.total || 15000;
        const totalPages = Math.ceil(knownTotal / perPage);

        console.log(`Full sync: Fetching all ${knownTotal} subscribers...`);
        this.updateSyncSourceUI('full', `(0/${knownTotal})`);

        while (allSubscribers.length < knownTotal && page <= 50) {
            const response = await this.apiCall(`/subscribers?per_page=${perPage}&page=${page}&with[]=tags&custom_fields=true`);
            const subscribers = response.subscribers?.data || response.data || this.extractArray(response, 'subscribers') || [];

            if (subscribers.length === 0) break;

            // Use push with spread instead of concat (better memory efficiency)
            allSubscribers.push(...subscribers);
            console.log(`Fetched page ${page}: ${subscribers.length} (total: ${allSubscribers.length})`);

            // Update UI with progress
            const pct = Math.round((allSubscribers.length / knownTotal) * 100);
            this.updateSyncSourceUI('full', `(${allSubscribers.length}/${knownTotal} - ${pct}%)`);

            if (subscribers.length < perPage) break;

            // Rate limiting: Add 300ms delay between pages to reduce server load
            await new Promise(resolve => setTimeout(resolve, 300));
            page++;
        }

        console.log(`Full sync complete: ${allSubscribers.length} subscribers`);
        this.data.subscribers = allSubscribers;
    }

    // Incremental sync - fetches only new/updated subscribers since last sync
    async incrementalSubscriberSync() {
        console.log(`Incremental sync: Fetching changes since ${this.lastSyncTime}...`);

        let page = 1;
        let updatedCount = 0;
        let newCount = 0;
        const perPage = 500;

        // Create a map of existing subscribers by ID for quick lookup
        const subscriberMap = new Map();
        this.data.subscribers.forEach(sub => {
            subscriberMap.set(sub.id, sub);
        });

        while (page <= 10) { // Limit incremental sync to 10 pages max (5000 changes)
            // Fetch subscribers updated after last sync
            const response = await this.apiCall(
                `/subscribers?per_page=${perPage}&page=${page}&with[]=tags&custom_fields=true&sort_by=updated_at&sort_order=DESC`
            );
            const subscribers = response.subscribers?.data || response.data || this.extractArray(response, 'subscribers') || [];

            if (subscribers.length === 0) break;

            // Check if we've reached records older than our last sync
            let hasOlderRecords = false;
            for (const sub of subscribers) {
                const subUpdatedAt = new Date(sub.updated_at || sub.created_at);
                const lastSync = new Date(this.lastSyncTime);

                if (subUpdatedAt < lastSync) {
                    hasOlderRecords = true;
                    break;
                }

                // Update or add subscriber
                if (subscriberMap.has(sub.id)) {
                    // Update existing subscriber
                    const index = this.data.subscribers.findIndex(s => s.id === sub.id);
                    if (index !== -1) {
                        this.data.subscribers[index] = sub;
                        updatedCount++;
                    }
                } else {
                    // Add new subscriber
                    this.data.subscribers.push(sub);
                    subscriberMap.set(sub.id, sub);
                    newCount++;
                }
            }

            console.log(`Incremental page ${page}: ${subscribers.length} records processed`);

            if (hasOlderRecords || subscribers.length < perPage) break;

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 300));
            page++;
        }

        console.log(`Incremental sync complete: ${newCount} new, ${updatedCount} updated`);
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

        // Use filtered subscribers to respect conditional filter & email exclusions
        const filteredSubscribers = this.getFilteredSubscribers();

        filteredSubscribers.forEach(subscriber => {
            stats.totalProcessed++;

            // Use helper functions for robust DOB extraction and parsing
            const dob = extractDOB(subscriber);
            const birthYear = parseBirthYear(dob);

            const age = parseAge(dob);
            const ageGroup = getAgeBucket(age);

            if (birthYear !== null) stats.withDOB++;

            const deviceType = getDeviceType(subscriber);
            if (deviceType !== 'Unknown') stats.withDevice++;

            stats.ageGroups[ageGroup] = (stats.ageGroups[ageGroup] || 0) + 1;
            stats.deviceTypes[deviceType] = (stats.deviceTypes[deviceType] || 0) + 1;

            // Assign persona based on birth year (generation)
            const personaKey = assignPersona(birthYear);

            // Store persona, DOB, and birth year on subscriber for later use
            subscriber._persona = personaKey;
            subscriber._dob = dob;
            subscriber._birthYear = birthYear;
            subscriber._ageGroup = ageGroup;

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

            // Track birth year distribution within persona
            if (birthYear) {
                personas[personaKey].birthYearDistribution = personas[personaKey].birthYearDistribution || {};
                personas[personaKey].birthYearDistribution[birthYear] =
                    (personas[personaKey].birthYearDistribution[birthYear] || 0) + 1;
            }

            personas[personaKey].ageDistribution[ageGroup] =
                (personas[personaKey].ageDistribution[ageGroup] || 0) + 1;
            personas[personaKey].deviceDistribution[deviceType] =
                (personas[personaKey].deviceDistribution[deviceType] || 0) + 1;
        });

        if (filteredSubscribers.length === 0 && this.data.contacts.total > 0) {
            personas['unknown'].count = this.data.contacts.total;
            personas['unknown'].subscribed = this.data.contacts.subscribed;
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
        // Use filtered subscribers to respect conditional filter & email exclusions
        const filteredSubscribers = this.getFilteredSubscribers();

        filteredSubscribers.forEach(subscriber => {
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

            // Extract birth year for generation-based persona assignment
            let birthYear = null;
            if (dob) {
                try {
                    birthYear = new Date(dob).getFullYear();
                    if (isNaN(birthYear)) birthYear = null;
                } catch (e) {
                    birthYear = null;
                }
            }
            const personaKey = assignPersona(birthYear);

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

    // ==================== EMAIL EXCLUSION & DATE FILTER HELPERS ====================

    // Check if email should be excluded (internal team or test account)
    isExcludedEmail(email) {
        if (!email) return false;
        const lowerEmail = email.toLowerCase();

        // Check explicit exclusion list
        if (this.excludedEmails.has(lowerEmail)) return true;

        // Check test patterns
        if (this.testEmailPattern.test(lowerEmail)) return true;

        return false;
    }

    // Get customers matching conditional filter criteria (data scope level)
    // Supports multiple conditions with AND/OR logic
    getConditionallyFilteredCustomers() {
        const { mode, conditions } = this.conditionalFilter;

        // Get all orders grouped by customer (with true purchase numbers)
        const allOrders = (this.data.woocommerce?.orders || []).filter(order => {
            const email = order.billing?.email || order.billing_email;
            return !this.isExcludedEmail(email);
        });
        const allTimeCustomerOrders = this.groupOrdersByCustomer(allOrders);

        // No conditions = no filter (show all)
        if (!conditions || conditions.length === 0) {
            return { emails: null, customerOrders: allTimeCustomerOrders };
        }

        const subscribers = this.data.subscribers || [];

        // Get emails matching each condition
        const conditionResults = conditions.map(condition => {
            return this.getEmailsMatchingCondition(condition, subscribers, allTimeCustomerOrders);
        });

        // Combine results based on AND/OR mode
        let matchingEmails;
        if (mode === 'AND') {
            // AND: Intersection of all condition results
            matchingEmails = conditionResults.reduce((result, current, index) => {
                if (index === 0) return current;
                return new Set([...result].filter(email => current.has(email)));
            }, new Set());
        } else {
            // OR: Union of all condition results
            matchingEmails = conditionResults.reduce((result, current) => {
                current.forEach(email => result.add(email));
                return result;
            }, new Set());
        }

        // Return filtered customer orders
        const filteredCustomerOrders = {};
        matchingEmails.forEach(email => {
            if (allTimeCustomerOrders[email]) {
                filteredCustomerOrders[email] = allTimeCustomerOrders[email];
            }
        });

        return { emails: matchingEmails, customerOrders: filteredCustomerOrders };
    }

    // Get emails matching a single condition
    getEmailsMatchingCondition(condition, subscribers, allTimeCustomerOrders) {
        const { type, params } = condition;
        const matchingEmails = new Set();

        if (type === 'subscriberDateRange') {
            const { startDate, endDate } = params;
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;
            if (end) end.setHours(23, 59, 59, 999);

            subscribers.forEach(sub => {
                if (this.isExcludedEmail(sub.email)) return;
                if (!sub.created_at) return;
                const created = new Date(sub.created_at);
                if (start && created < start) return;
                if (end && created > end) return;
                matchingEmails.add(sub.email?.toLowerCase());
            });
        }

        if (type === 'firstPurchaseProduct') {
            const productMatcher = params.matcher || (() => false);
            Object.entries(allTimeCustomerOrders).forEach(([email, orders]) => {
                const firstOrder = orders.find(o => o._purchaseNumber === 1);
                if (firstOrder?.line_items?.some(productMatcher)) {
                    matchingEmails.add(email);
                }
            });
        }

        if (type === 'firstPurchaseValue') {
            const { matcher } = params;
            Object.entries(allTimeCustomerOrders).forEach(([email, orders]) => {
                const firstOrder = orders.find(o => o._purchaseNumber === 1);
                if (firstOrder && matcher(firstOrder.total)) {
                    matchingEmails.add(email);
                }
            });
        }

        if (type === 'source') {
            const { source: targetSource } = params;
            subscribers.forEach(sub => {
                if (this.isExcludedEmail(sub.email)) return;
                const parsedSource = this.parseSource(sub.source || '');
                if (parsedSource === targetSource) {
                    matchingEmails.add(sub.email?.toLowerCase());
                }
            });
        }

        if (type === 'gender') {
            const { gender: targetGender } = params;
            subscribers.forEach(sub => {
                if (this.isExcludedEmail(sub.email)) return;
                const genderRaw = sub.custom_fields?.gender || sub.gender || null;
                const gender = parseGender(genderRaw);
                if (gender === targetGender) {
                    matchingEmails.add(sub.email?.toLowerCase());
                }
            });
        }

        if (type === 'dobRange') {
            const { startDate, endDate } = params;
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;

            subscribers.forEach(sub => {
                if (this.isExcludedEmail(sub.email)) return;
                const dob = extractDOB(sub);
                if (!dob) return;
                try {
                    // Parse DD/MM/YYYY format properly
                    const dobStr = String(dob).trim();
                    let dobDate = null;

                    // Try DD/MM/YYYY format first (FluentCRM format)
                    const ddmmyyyy = dobStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
                    if (ddmmyyyy) {
                        dobDate = new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
                    } else {
                        // Try YYYY-MM-DD format
                        const yyyymmdd = dobStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
                        if (yyyymmdd) {
                            dobDate = new Date(parseInt(yyyymmdd[1]), parseInt(yyyymmdd[2]) - 1, parseInt(yyyymmdd[3]));
                        } else {
                            dobDate = new Date(dob);
                        }
                    }

                    if (!dobDate || isNaN(dobDate.getTime())) return;
                    if (start && dobDate < start) return;
                    if (end && dobDate > end) return;
                    matchingEmails.add(sub.email?.toLowerCase());
                } catch (e) { /* skip invalid dates */ }
            });
        }

        if (type === 'device') {
            const { device: targetDevice } = params;
            subscribers.forEach(sub => {
                if (this.isExcludedEmail(sub.email)) return;
                const device = getDeviceType(sub);
                if (device === targetDevice) {
                    matchingEmails.add(sub.email?.toLowerCase());
                }
            });
        }

        return matchingEmails;
    }

    // Filter subscribers by email exclusions, conditional filter, and date range
    getFilteredSubscribers() {
        const subscribers = this.data.subscribers || [];
        const { startDate, endDate } = this.dateFilter;
        const { emails: conditionalEmails } = this.getConditionallyFilteredCustomers();

        return subscribers.filter(sub => {
            // Exclude internal team & test emails
            if (this.isExcludedEmail(sub.email)) return false;

            // Conditional filter (if active)
            if (conditionalEmails !== null) {
                if (!conditionalEmails.has(sub.email?.toLowerCase())) return false;
            }

            // Date filter (if active)
            if (startDate || endDate) {
                if (!sub.created_at) return false;
                const created = new Date(sub.created_at);
                const start = startDate ? new Date(startDate) : null;
                const end = endDate ? new Date(endDate) : new Date();
                if (end) end.setHours(23, 59, 59, 999);
                if (start && created < start) return false;
                if (end && created > end) return false;
            }

            return true;
        });
    }

    // Filter orders by email exclusions and date range
    getFilteredOrders() {
        const orders = this.data.woocommerce?.orders || [];
        const { startDate, endDate } = this.dateFilter;

        return orders.filter(order => {
            // Exclude orders from internal team & test emails
            const email = order.billing?.email || order.billing_email;
            if (this.isExcludedEmail(email)) return false;

            // Date filter (if active)
            if (startDate || endDate) {
                if (!order.date_created) return false;
                const created = new Date(order.date_created);
                const start = startDate ? new Date(startDate) : null;
                const end = endDate ? new Date(endDate) : new Date();
                if (end) end.setHours(23, 59, 59, 999);
                if (start && created < start) return false;
                if (end && created > end) return false;
            }

            return true;
        });
    }

    // ==================== GROWTH ANALYTICS ====================

    calculateGrowthAnalytics() {
        const subscribers = this.getFilteredSubscribers();
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
            const dob = extractDOB(subscriber);
            // Extract birth year for generation-based persona assignment using robust parser
            const birthYear = parseBirthYear(dob);
            const personaKey = assignPersona(birthYear);

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

    // Calculate historical comparisons for KPI cards
    calculateComparisons() {
        const analytics = this.data.growthAnalytics || {};
        const wc = this.data.woocommerce || {};
        const dailyRegs = analytics.dailyRegistrations || {};
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // Initialize comparisons object
        const comparisons = {
            // Acquisition metrics
            leads: { today: 0, sameDayLastWeek: 0, change: 0 },
            weeklyLeads: { thisWeek: 0, lastWeek: 0, change: 0 },
            cvr: { current: 0, lastWeek: 0, change: 0 },

            // Revenue metrics (from WooCommerce)
            revenue: { thisWeek: 0, lastWeek: 0, change: 0 },
            orders: { thisWeek: 0, lastWeek: 0, change: 0 },
            aov: { current: 0, lastWeek: 0, change: 0 },

            // Persona metrics
            personaGrowth: {}
        };

        // 1. SAME DAY LAST WEEK - Leads comparison
        const sameDayLastWeek = new Date(today);
        sameDayLastWeek.setDate(sameDayLastWeek.getDate() - 7);
        const sameDayLastWeekStr = sameDayLastWeek.toISOString().split('T')[0];

        comparisons.leads.today = dailyRegs[todayStr]?.total || 0;
        comparisons.leads.sameDayLastWeek = dailyRegs[sameDayLastWeekStr]?.total || 0;
        comparisons.leads.change = comparisons.leads.sameDayLastWeek > 0
            ? Math.round((comparisons.leads.today - comparisons.leads.sameDayLastWeek) / comparisons.leads.sameDayLastWeek * 100)
            : (comparisons.leads.today > 0 ? 100 : 0);

        // 2. THIS WEEK VS LAST WEEK - Already calculated in analytics
        comparisons.weeklyLeads.thisWeek = analytics.thisWeekNew || 0;
        comparisons.weeklyLeads.lastWeek = analytics.lastWeekNew || 0;
        comparisons.weeklyLeads.change = parseInt(analytics.weekOverWeekChange) || 0;

        // 3. CVR COMPARISON - This week vs last week
        const thisWeekStart = this.getWeekStart(today);
        const lastWeekStart = new Date(thisWeekStart);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        const twoWeeksAgoStart = new Date(lastWeekStart);
        twoWeeksAgoStart.setDate(twoWeeksAgoStart.getDate() - 7);

        let thisWeekCustomers = 0, thisWeekTotal = 0;
        let lastWeekCustomers = 0, lastWeekTotal = 0;

        Object.entries(dailyRegs).forEach(([date, data]) => {
            const d = new Date(date);
            if (d >= thisWeekStart) {
                thisWeekCustomers += data.customers || 0;
                thisWeekTotal += data.total || 0;
            } else if (d >= lastWeekStart && d < thisWeekStart) {
                lastWeekCustomers += data.customers || 0;
                lastWeekTotal += data.total || 0;
            }
        });

        const thisWeekCVR = thisWeekTotal > 0 ? (thisWeekCustomers / thisWeekTotal * 100) : 0;
        const lastWeekCVR = lastWeekTotal > 0 ? (lastWeekCustomers / lastWeekTotal * 100) : 0;
        comparisons.cvr.current = thisWeekCVR;
        comparisons.cvr.lastWeek = lastWeekCVR;
        comparisons.cvr.change = lastWeekCVR > 0
            ? Math.round((thisWeekCVR - lastWeekCVR) / lastWeekCVR * 100)
            : (thisWeekCVR > 0 ? 100 : 0);

        // 4. REVENUE COMPARISON - This week vs last week (from WooCommerce orders)
        // Respect conditional filter (if active)
        const { emails: conditionalEmails } = this.getConditionallyFilteredCustomers();
        const allOrders = this.getFilteredOrders();
        const orders = conditionalEmails !== null
            ? allOrders.filter(order => {
                const email = (order.billing?.email || order.billing_email)?.toLowerCase();
                return conditionalEmails.has(email);
            })
            : allOrders;

        orders.forEach(order => {
            const orderDate = new Date(order.date_created);
            const orderTotal = parseFloat(order.total) || 0;

            if (orderDate >= thisWeekStart) {
                comparisons.revenue.thisWeek += orderTotal;
                comparisons.orders.thisWeek++;
            } else if (orderDate >= lastWeekStart && orderDate < thisWeekStart) {
                comparisons.revenue.lastWeek += orderTotal;
                comparisons.orders.lastWeek++;
            }
        });

        comparisons.revenue.change = comparisons.revenue.lastWeek > 0
            ? Math.round((comparisons.revenue.thisWeek - comparisons.revenue.lastWeek) / comparisons.revenue.lastWeek * 100)
            : (comparisons.revenue.thisWeek > 0 ? 100 : 0);

        comparisons.orders.change = comparisons.orders.lastWeek > 0
            ? Math.round((comparisons.orders.thisWeek - comparisons.orders.lastWeek) / comparisons.orders.lastWeek * 100)
            : (comparisons.orders.thisWeek > 0 ? 100 : 0);

        // 5. AOV COMPARISON
        const thisWeekAOV = comparisons.orders.thisWeek > 0 ? comparisons.revenue.thisWeek / comparisons.orders.thisWeek : 0;
        const lastWeekAOV = comparisons.orders.lastWeek > 0 ? comparisons.revenue.lastWeek / comparisons.orders.lastWeek : 0;
        comparisons.aov.current = thisWeekAOV;
        comparisons.aov.lastWeek = lastWeekAOV;
        comparisons.aov.change = lastWeekAOV > 0
            ? Math.round((thisWeekAOV - lastWeekAOV) / lastWeekAOV * 100)
            : (thisWeekAOV > 0 ? 100 : 0);

        // 6. PERSONA GROWTH - This week vs last week by persona
        // Use filtered subscribers to respect conditional filter & email exclusions
        const personas = this.data.personas || {};
        const filteredSubscribers = this.getFilteredSubscribers();

        Object.keys(personas).forEach(personaKey => {
            let thisWeekCount = 0, lastWeekCount = 0;

            filteredSubscribers.forEach(sub => {
                if (sub._persona !== personaKey) return;
                const createdAt = new Date(sub.created_at);

                if (createdAt >= thisWeekStart) {
                    thisWeekCount++;
                } else if (createdAt >= lastWeekStart && createdAt < thisWeekStart) {
                    lastWeekCount++;
                }
            });

            comparisons.personaGrowth[personaKey] = {
                thisWeek: thisWeekCount,
                lastWeek: lastWeekCount,
                change: lastWeekCount > 0
                    ? Math.round((thisWeekCount - lastWeekCount) / lastWeekCount * 100)
                    : (thisWeekCount > 0 ? 100 : 0)
            };
        });

        this.data.comparisons = comparisons;
        return comparisons;
    }

    // Format comparison badge HTML
    formatComparisonBadge(change, suffix = '') {
        if (change === 0) {
            return `<span class="text-muted-foreground text-xs">→ 0%${suffix}</span>`;
        } else if (change > 0) {
            return `<span class="text-success text-xs">↑ +${change}%${suffix}</span>`;
        } else {
            return `<span class="text-destructive text-xs">↓ ${change}%${suffix}</span>`;
        }
    }

    calculateAstrologyStats() {
        const subscribers = this.getFilteredSubscribers();
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
            genderCVR: { Male: { total: 0, customers: 0 }, Female: { total: 0, customers: 0 }, Unknown: { total: 0, customers: 0 } },
            ageDistribution: { '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0, 'Unknown': 0 }
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
            // Get DOB using helper function
            const dob = extractDOB(subscriber);

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

                // Count age distribution
                const age = parseAge(dob);
                const ageBucket = getAgeBucket(age);
                stats.ageDistribution[ageBucket]++;
            } else {
                // No DOB, count as Unknown age
                stats.ageDistribution['Unknown']++;
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

            // Gender by persona - extract birth year for generation-based persona
            let birthYear = null;
            if (dob) {
                try {
                    birthYear = new Date(dob).getFullYear();
                    if (isNaN(birthYear)) birthYear = null;
                } catch (e) {
                    birthYear = null;
                }
            }
            const personaKey = assignPersona(birthYear);

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

    // Calculate time of day statistics for subscriptions, purchases, and repeat purchases
    calculateTimeOfDayStats() {
        const subscribers = this.getFilteredSubscribers();
        const orders = this.getFilteredOrders();

        // Initialize hourly buckets (0-23)
        const stats = {
            subscriptions: Array(24).fill(0),
            firstPurchases: Array(24).fill(0),
            repeatPurchases: Array(24).fill(0),
            totalSubscriptions: 0,
            totalFirstPurchases: 0,
            totalRepeatPurchases: 0
        };

        // Count subscriptions by hour
        subscribers.forEach(sub => {
            if (!sub.created_at) return;
            try {
                const date = new Date(sub.created_at);
                if (!isNaN(date.getTime())) {
                    const hour = date.getHours();
                    stats.subscriptions[hour]++;
                    stats.totalSubscriptions++;
                }
            } catch (e) {}
        });

        // Group orders by customer email
        const customerOrders = {};
        orders.forEach(order => {
            const email = order.billing?.email?.toLowerCase();
            if (!email || !order.date_created) return;
            if (!customerOrders[email]) {
                customerOrders[email] = [];
            }
            customerOrders[email].push(order);
        });

        // Sort each customer's orders by date and categorize
        Object.values(customerOrders).forEach(orderList => {
            // Sort by date
            orderList.sort((a, b) => new Date(a.date_created) - new Date(b.date_created));

            orderList.forEach((order, index) => {
                try {
                    const date = new Date(order.date_created);
                    if (isNaN(date.getTime())) return;
                    const hour = date.getHours();

                    if (index === 0) {
                        // First purchase
                        stats.firstPurchases[hour]++;
                        stats.totalFirstPurchases++;
                    } else {
                        // Repeat purchase (2nd, 3rd, etc.)
                        stats.repeatPurchases[hour]++;
                        stats.totalRepeatPurchases++;
                    }
                } catch (e) {}
            });
        });

        this.data.timeOfDayStats = stats;
    }

    // ==================== WOOCOMMERCE ORDER ANALYTICS ====================

    async fetchWooCommerceOrders(forceFullSync = false) {
        console.log('Fetching WooCommerce orders...');
        const auth = btoa(`${this.wcCredentials.consumerKey}:${this.wcCredentials.consumerSecret}`);

        try {
            // Step 1: Try to load from Supabase cache first
            if (!forceFullSync) {
                console.log('Checking order cache...');
                this.updateOrderSyncUI('checking', '(checking cache...)');
                const cache = await this.loadOrderCache();

                if (cache && this.isOrderCacheValid(cache)) {
                    // Use cached orders
                    this.data.woocommerce.orders = cache.orders;
                    const cacheAge = ((Date.now() - new Date(cache.updatedAt).getTime()) / (1000 * 60 * 60)).toFixed(1);
                    console.log(`✅ Loaded ${cache.orderCount} orders from cache (${cacheAge}h old)`);
                    this.updateOrderSyncUI('cached', `(${cache.orderCount} cached)`);

                    // Incremental sync: fetch only new orders since lastOrderId
                    this.updateOrderSyncUI('incremental', '(checking new orders...)');
                    const newOrders = await this.fetchNewOrders(cache.lastOrderId, auth);

                    if (newOrders.length > 0) {
                        console.log(`🔄 Found ${newOrders.length} new orders since ID ${cache.lastOrderId}`);

                        // Merge new orders with cached orders (avoid duplicates)
                        const existingIds = new Set(this.data.woocommerce.orders.map(o => o.id));
                        const uniqueNewOrders = newOrders.filter(o => !existingIds.has(o.id));

                        this.data.woocommerce.orders.push(...uniqueNewOrders);
                        console.log(`Total orders after merge: ${this.data.woocommerce.orders.length}`);

                        // Save updated cache
                        this.updateOrderSyncUI('saving', '(saving cache...)');
                        await this.saveOrderCache();
                        this.updateOrderSyncUI('cached', `(${this.data.woocommerce.orders.length} total, +${newOrders.length} new)`);
                    } else {
                        console.log('No new orders since last sync');
                        this.updateOrderSyncUI('cached', `(${cache.orderCount} cached, up-to-date)`);
                    }

                    this.calculateWooCommerceMetrics();
                    return;
                }
            }

            // Step 2: Full sync (first time or forced)
            console.log('⚠️ Full order sync required...');
            this.updateOrderSyncUI('full', '(full sync...)');
            const allOrders = await this.fetchAllOrders(auth);

            this.data.woocommerce.orders = allOrders;
            console.log(`Total WooCommerce orders: ${allOrders.length}`);

            // Save to cache
            this.updateOrderSyncUI('saving', '(saving cache...)');
            await this.saveOrderCache();
            this.updateOrderSyncUI('cached', `(${allOrders.length} cached)`);

            this.calculateWooCommerceMetrics();

        } catch (error) {
            console.error('Error fetching WooCommerce orders:', error);
            this.updateOrderSyncUI('error', '(error)');
        }
    }

    // Update order sync status UI
    updateOrderSyncUI(status, details = '') {
        const el = document.getElementById('orderSyncSource');
        if (!el) return;

        el.classList.remove('hidden', 'bg-success/20', 'text-success', 'bg-secondary/20', 'text-secondary', 'bg-warning/20', 'text-yellow-400', 'bg-red-500/20', 'text-red-400');

        switch (status) {
            case 'cached':
                el.textContent = `🛒 Orders ${details}`;
                el.classList.add('bg-success/20', 'text-success');
                break;
            case 'incremental':
                el.textContent = `⚡ Orders ${details}`;
                el.classList.add('bg-secondary/20', 'text-secondary');
                break;
            case 'full':
                el.textContent = `🔄 Orders ${details}`;
                el.classList.add('bg-warning/20', 'text-yellow-400');
                break;
            case 'checking':
            case 'saving':
                el.textContent = `📦 Orders ${details}`;
                el.classList.add('bg-secondary/20', 'text-secondary');
                break;
            case 'error':
                el.textContent = `❌ Orders ${details}`;
                el.classList.add('bg-red-500/20', 'text-red-400');
                break;
            default:
                el.classList.add('hidden');
                return;
        }
    }

    // Fetch all orders (full sync)
    async fetchAllOrders(auth) {
        let allOrders = [];
        let page = 1;
        const perPage = 100;

        while (page <= 50) { // Max 5000 orders
            const response = await fetch(
                `https://luangiai.vn/wp-json/wc/v3/orders?per_page=${perPage}&page=${page}&status=completed,processing`,
                { headers: { 'Authorization': `Basic ${auth}` } }
            );

            if (!response.ok) {
                console.error('WooCommerce API error:', response.status);
                break;
            }

            const orders = await response.json();
            if (!orders || orders.length === 0) break;

            allOrders.push(...orders);
            console.log(`Fetched ${allOrders.length} WooCommerce orders (page ${page})`);

            if (orders.length < perPage) break;

            await new Promise(r => setTimeout(r, 300)); // Rate limit
            page++;
        }

        return allOrders;
    }

    // Fetch only new orders since lastOrderId (incremental sync)
    async fetchNewOrders(lastOrderId, auth) {
        let newOrders = [];
        let page = 1;
        const perPage = 100;

        console.log(`Fetching orders newer than ID ${lastOrderId}...`);

        while (page <= 10) { // Max 1000 new orders per incremental sync
            // Use 'after' parameter or filter by order_id
            // WooCommerce API doesn't have 'after_id', so we fetch recent and filter
            const response = await fetch(
                `https://luangiai.vn/wp-json/wc/v3/orders?per_page=${perPage}&page=${page}&status=completed,processing&orderby=id&order=desc`,
                { headers: { 'Authorization': `Basic ${auth}` } }
            );

            if (!response.ok) {
                console.error('WooCommerce API error:', response.status);
                break;
            }

            const orders = await response.json();
            if (!orders || orders.length === 0) break;

            // Filter orders newer than lastOrderId
            const newerOrders = orders.filter(o => o.id > lastOrderId);
            newOrders.push(...newerOrders);

            // If we found orders older than lastOrderId, we've caught up
            if (newerOrders.length < orders.length) {
                break;
            }

            if (orders.length < perPage) break;

            await new Promise(r => setTimeout(r, 300)); // Rate limit
            page++;
        }

        return newOrders;
    }

    groupOrdersByCustomer(orders) {
        const customers = {};
        orders.forEach(order => {
            const email = order.billing?.email?.toLowerCase();
            if (!email) return;
            if (!customers[email]) customers[email] = [];
            customers[email].push(order);
        });

        // Sort each customer's orders chronologically and tag purchase numbers
        Object.values(customers).forEach(customerOrders => {
            customerOrders.sort((a, b) => new Date(a.date_created) - new Date(b.date_created));
            customerOrders.forEach((order, index) => {
                order._purchaseNumber = index + 1;
            });
        });

        return customers;
    }

    calculateWooCommerceMetrics() {
        // Get conditional filter results (includes all-time customer orders with TRUE purchase numbers)
        const { emails: conditionalEmails, customerOrders: conditionalCustomerOrders } = this.getConditionallyFilteredCustomers();

        // Get date-filtered orders
        const filteredOrders = this.getFilteredOrders();
        if (!filteredOrders || filteredOrders.length === 0) {
            console.log('No WooCommerce orders in selected date range');
            return;
        }

        // Build filtered customerOrders but PRESERVE true _purchaseNumber from all-time grouping
        // AND respect conditional filter (if active)
        const customerOrders = {};
        filteredOrders.forEach(order => {
            const email = (order.billing?.email || order.billing_email)?.toLowerCase();
            if (!email) return;

            // Apply conditional filter (if active)
            if (conditionalEmails !== null && !conditionalEmails.has(email)) {
                return; // Skip orders from customers not in conditional filter
            }

            // Find the TRUE _purchaseNumber from all-time data
            const allTimeOrders = conditionalCustomerOrders[email] || [];
            const matchingOrder = allTimeOrders.find(o => o.id === order.id);
            if (matchingOrder) {
                order._purchaseNumber = matchingOrder._purchaseNumber;
            }

            if (!customerOrders[email]) customerOrders[email] = [];
            customerOrders[email].push(order);
        });

        // Sort each customer's filtered orders by their TRUE purchase number
        Object.values(customerOrders).forEach(orders => {
            orders.sort((a, b) => a._purchaseNumber - b._purchaseNumber);
        });

        this.data.woocommerce.customerOrders = customerOrders;

        // When a conditional filter is active (like "1st Purchase = Product X"),
        // the funnel should show the COMPLETE journey of those customers, not just orders within date range
        const funnelCustomerOrders = (conditionalEmails !== null)
            ? conditionalCustomerOrders  // Use all orders from filtered customers
            : customerOrders;            // Use date-filtered orders when no conditional filter

        const metrics = {
            timeToFirstPurchase: this.wcCalcTimeToFirstPurchase(customerOrders),
            timeFirstToSecond: this.wcCalcTimeBetweenPurchases(customerOrders, 1, 2),
            aovSecondPurchase: this.wcCalcAOVByPurchaseNum(customerOrders, 2),
            aovFirstPurchase: this.wcCalcAOVByPurchaseNum(customerOrders, 1),
            ltv: this.wcCalcLTV(funnelCustomerOrders),  // Use full data for LTV
            revenueNew: this.wcCalcRevenueByType(customerOrders, 'new'),
            revenueReturning: this.wcCalcRevenueByType(customerOrders, 'returning'),
            sku1st: this.wcCalcSKUBreakdown(funnelCustomerOrders, 1),  // Use full data for SKU analysis
            sku2nd: this.wcCalcSKUBreakdown(funnelCustomerOrders, 2),
            sku3rd: this.wcCalcSKUBreakdown(funnelCustomerOrders, 3),
            totalCustomers: Object.keys(funnelCustomerOrders).length,  // Total filtered customers
            totalOrders: Object.values(funnelCustomerOrders).reduce((sum, orders) => sum + orders.length, 0),
            repeatCustomers: Object.values(funnelCustomerOrders).filter(orders =>
                orders.some(o => o._purchaseNumber > 1)
            ).length,
            funnel: this.wcCalcPurchaseFunnel(funnelCustomerOrders),  // Use full data for funnel
            topCustomers: this.wcCalcTopCustomers(funnelCustomerOrders)
        };

        this.data.woocommerce.metrics = metrics;
        console.log('WooCommerce metrics calculated:', metrics);
    }

    wcCalcTimeToFirstPurchase(customerOrders) {
        const times = [];
        const subscribers = this.getFilteredSubscribers();

        Object.entries(customerOrders).forEach(([email, orders]) => {
            const subscriber = subscribers.find(s => s.email?.toLowerCase() === email);
            if (subscriber && orders[0]) {
                const subDate = new Date(subscriber.created_at);
                const orderDate = new Date(orders[0].date_created);
                const days = (orderDate - subDate) / (1000 * 60 * 60 * 24);
                if (days >= 0 && days < 365) { // Reasonable range
                    times.push(days);
                }
            }
        });

        const avg = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
        return { avg, count: times.length, data: times };
    }

    wcCalcTimeBetweenPurchases(customerOrders, from, to) {
        const times = [];

        Object.values(customerOrders).forEach(orders => {
            if (orders.length >= to) {
                const d1 = new Date(orders[from - 1].date_created);
                const d2 = new Date(orders[to - 1].date_created);
                const days = (d2 - d1) / (1000 * 60 * 60 * 24);
                if (days >= 0 && days < 365) { // Reasonable range
                    times.push(days);
                }
            }
        });

        const avg = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
        return { avg, count: times.length, data: times };
    }

    wcCalcAOVByPurchaseNum(customerOrders, num) {
        const totals = [];

        Object.values(customerOrders).forEach(orders => {
            const order = orders.find(o => o._purchaseNumber === num);
            if (order) {
                totals.push(parseFloat(order.total) || 0);
            }
        });

        const avg = totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
        return { avg, count: totals.length, total: totals.reduce((a, b) => a + b, 0) };
    }

    wcCalcLTV(customerOrders) {
        const ltvs = Object.values(customerOrders).map(orders =>
            orders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0)
        );

        const avg = ltvs.length > 0 ? ltvs.reduce((a, b) => a + b, 0) / ltvs.length : 0;
        const total = ltvs.reduce((a, b) => a + b, 0);

        // LTV distribution buckets
        const distribution = {
            '<200K': 0,
            '200K-500K': 0,
            '500K-1M': 0,
            '1M-2M': 0,
            '2M+': 0
        };

        ltvs.forEach(ltv => {
            if (ltv < 200000) distribution['<200K']++;
            else if (ltv < 500000) distribution['200K-500K']++;
            else if (ltv < 1000000) distribution['500K-1M']++;
            else if (ltv < 2000000) distribution['1M-2M']++;
            else distribution['2M+']++;
        });

        return { avg, total, count: ltvs.length, distribution, data: ltvs };
    }

    wcCalcRevenueByType(customerOrders, type) {
        let total = 0;

        Object.values(customerOrders).forEach(orders => {
            orders.forEach(order => {
                const amount = parseFloat(order.total) || 0;
                if (type === 'new' && order._purchaseNumber === 1) {
                    total += amount;
                } else if (type === 'returning' && order._purchaseNumber > 1) {
                    total += amount;
                }
            });
        });

        return total;
    }

    wcCalcSKUBreakdown(customerOrders, purchaseNum) {
        const skus = {};

        Object.values(customerOrders).forEach(orders => {
            const order = orders.find(o => o._purchaseNumber === purchaseNum);
            if (order && order.line_items) {
                order.line_items.forEach(item => {
                    const key = item.name || item.sku || 'Unknown Product';
                    skus[key] = (skus[key] || 0) + (item.quantity || 1);
                });
            }
        });

        // Sort by count and return top 5
        return Object.entries(skus)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));
    }

    wcCalcPurchaseFunnel(customerOrders) {
        const totalSubscribers = this.getFilteredSubscribers().length;

        // Count orders by their TRUE purchase number within the filtered date range
        // This answers: "How many 1st/2nd/3rd purchases happened in this period?"
        let firstPurchase = 0, secondPurchase = 0, thirdPurchase = 0, fourPlus = 0;

        Object.values(customerOrders).forEach(orders => {
            orders.forEach(order => {
                if (order._purchaseNumber === 1) firstPurchase++;
                else if (order._purchaseNumber === 2) secondPurchase++;
                else if (order._purchaseNumber === 3) thirdPurchase++;
                else if (order._purchaseNumber >= 4) fourPlus++;
            });
        });

        return {
            subscribers: totalSubscribers,
            firstPurchase,    // How many TRUE 1st purchases happened in date range
            secondPurchase,   // How many TRUE 2nd purchases happened in date range
            thirdPurchase,    // How many TRUE 3rd purchases happened in date range
            fourPlus          // How many TRUE 4th+ purchases happened in date range
        };
    }

    // Calculate tripwire cohort analysis (monthly cohorts with retention tracking)
    calculateTripwireCohortAnalysis() {
        const { emails, customerOrders } = this.getConditionallyFilteredCustomers();
        if (!emails || emails.size === 0) return null;

        // Monthly cohorts based on first purchase date
        const cohorts = {}; // { '2025-01': { total: X, returned: Y, ... } }

        Object.entries(customerOrders).forEach(([email, orders]) => {
            const firstOrder = orders.find(o => o._purchaseNumber === 1);
            if (!firstOrder) return;

            const cohortKey = firstOrder.date_created?.substring(0, 7) || 'Unknown'; // YYYY-MM
            if (!cohorts[cohortKey]) {
                cohorts[cohortKey] = {
                    total: 0,
                    returned: 0,
                    thirdPurchase: 0,
                    revenue1st: 0,
                    revenue2nd: 0,
                    revenueTotal: 0,
                    secondPurchaseProducts: {},
                    avgDaysTo2nd: []
                };
            }

            const cohort = cohorts[cohortKey];
            cohort.total++;
            cohort.revenue1st += parseFloat(firstOrder.total) || 0;

            const secondOrder = orders.find(o => o._purchaseNumber === 2);
            if (secondOrder) {
                cohort.returned++;
                cohort.revenue2nd += parseFloat(secondOrder.total) || 0;

                // Track what they bought
                secondOrder.line_items?.forEach(item => {
                    const name = item.name || 'Unknown';
                    cohort.secondPurchaseProducts[name] = (cohort.secondPurchaseProducts[name] || 0) + 1;
                });

                // Time to 2nd purchase
                const days = (new Date(secondOrder.date_created) - new Date(firstOrder.date_created)) / (1000*60*60*24);
                if (days >= 0) cohort.avgDaysTo2nd.push(days);
            }

            if (orders.find(o => o._purchaseNumber === 3)) {
                cohort.thirdPurchase++;
            }

            cohort.revenueTotal += orders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
        });

        // Calculate averages and format
        Object.values(cohorts).forEach(c => {
            c.returnRate = c.total > 0 ? (c.returned / c.total * 100).toFixed(1) : 0;
            c.avgDaysTo2nd = c.avgDaysTo2nd.length > 0
                ? (c.avgDaysTo2nd.reduce((a,b) => a+b, 0) / c.avgDaysTo2nd.length).toFixed(1)
                : '-';
            c.topSecondProducts = Object.entries(c.secondPurchaseProducts)
                .sort((a,b) => b[1] - a[1])
                .slice(0, 5);
        });

        return cohorts;
    }

    wcCalcTopCustomers(customerOrders) {
        const subscribers = this.getFilteredSubscribers();
        const customers = [];

        Object.entries(customerOrders).forEach(([email, orders]) => {
            const ltv = orders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
            const aov = ltv / orders.length;

            // Find days to first purchase
            const subscriber = subscribers.find(s => s.email?.toLowerCase() === email);
            let daysToFirst = null;
            if (subscriber && orders[0]) {
                const subDate = new Date(subscriber.created_at);
                const orderDate = new Date(orders[0].date_created);
                daysToFirst = (orderDate - subDate) / (1000 * 60 * 60 * 24);
                if (daysToFirst < 0 || daysToFirst > 365) daysToFirst = null;
            }

            customers.push({
                email,
                orderCount: orders.length,
                ltv,
                aov,
                daysToFirst
            });
        });

        // Sort by LTV descending, take top 10
        return customers.sort((a, b) => b.ltv - a.ltv).slice(0, 10);
    }

    // ==================== 2ND PURCHASER PROFILE ====================
    calculate2ndPurchaserProfile() {
        const customerOrders = this.data.woocommerce?.customerOrders || {};
        const subscribers = this.getFilteredSubscribers();

        // Build email to subscriber lookup
        const emailToSubscriber = {};
        subscribers.forEach(s => {
            if (s.email) {
                emailToSubscriber[s.email.toLowerCase()] = s;
            }
        });

        // Find all customers with 2+ purchases
        const secondPurchasers = [];

        Object.entries(customerOrders).forEach(([email, orders]) => {
            if (orders.length >= 2) {
                const subscriber = emailToSubscriber[email];
                const secondOrder = orders.find(o => o._purchaseNumber === 2);
                const firstOrder = orders.find(o => o._purchaseNumber === 1);

                if (secondOrder) {
                    // Extract demographics from subscriber
                    const dob = subscriber?.date_of_birth ||
                               subscriber?.custom_fields?.dob ||
                               subscriber?.custom_fields?.date_of_birth ||
                               subscriber?.dob || null;

                    // Parse age from DOB
                    let age = null;
                    let birthYear = null;
                    if (dob) {
                        try {
                            const parts = dob.split(/[\/\-]/);
                            birthYear = parts.find(p => {
                                const num = parseInt(p);
                                return num > 1900 && num < 2100;
                            });
                            if (birthYear) {
                                birthYear = parseInt(birthYear);
                                age = new Date().getFullYear() - birthYear;
                            }
                        } catch(e) {}
                    }

                    // Get age bucket
                    let ageGroup = 'Unknown';
                    if (age !== null) {
                        if (age < 18) ageGroup = '<18';
                        else if (age <= 24) ageGroup = '18-24';
                        else if (age <= 34) ageGroup = '25-34';
                        else if (age <= 44) ageGroup = '35-44';
                        else if (age <= 54) ageGroup = '45-54';
                        else ageGroup = '55+';
                    }

                    // Get device type
                    let deviceType = 'Unknown';
                    const deviceVal = subscriber?.device_type ||
                                     subscriber?.custom_fields?.device ||
                                     subscriber?.device || null;
                    if (deviceVal) {
                        const dv = deviceVal.toLowerCase();
                        if (dv.includes('mobile') || dv.includes('phone') || dv.includes('android') || dv.includes('ios')) {
                            deviceType = 'Mobile';
                        } else if (dv.includes('desktop') || dv.includes('windows') || dv.includes('mac')) {
                            deviceType = 'Desktop';
                        } else if (dv.includes('tablet') || dv.includes('ipad')) {
                            deviceType = 'Tablet';
                        }
                    }

                    // Get source
                    const source = subscriber?.source || 'Unknown';
                    let parsedSource = 'Unknown';
                    if (source) {
                        const sl = source.toLowerCase();
                        if (sl.includes('facebook') || sl.includes('fbclid')) parsedSource = 'Facebook';
                        else if (sl.includes('google') || sl.includes('gclid')) parsedSource = 'Google';
                        else if (sl.includes('tiktok') || sl.includes('ttclid')) parsedSource = 'TikTok';
                        else if (sl.includes('zalo')) parsedSource = 'Zalo';
                        else if (sl.includes('utm_')) parsedSource = 'UTM Tagged';
                        else if (sl.includes('direct') || sl === '') parsedSource = 'Direct';
                        else parsedSource = 'Other';
                    }

                    // Get gender
                    let gender = 'Unknown';
                    const genderVal = subscriber?.custom_fields?.gender ||
                                     subscriber?.custom_fields?.gioi_tinh ||
                                     subscriber?.gender;
                    if (genderVal) {
                        const gv = String(genderVal).toLowerCase();
                        if (gv === '1' || gv === 'male' || gv === 'nam') gender = 'Male';
                        else if (gv === '-1' || gv === '0' || gv === 'female' || gv === 'nu' || gv === 'nữ') gender = 'Female';
                    }

                    // Assign persona based on birth year (generation)
                    const persona = assignPersona(birthYear);

                    // Calculate days between 1st and 2nd
                    let daysBetween = null;
                    if (firstOrder && secondOrder) {
                        const d1 = new Date(firstOrder.date_created);
                        const d2 = new Date(secondOrder.date_created);
                        daysBetween = Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
                        if (daysBetween < 0) daysBetween = null;
                    }

                    secondPurchasers.push({
                        email,
                        persona,
                        ageGroup,
                        age,
                        birthYear,
                        deviceType,
                        source: parsedSource,
                        gender,
                        daysBetween,
                        secondOrderValue: parseFloat(secondOrder.total || 0)
                    });
                }
            }
        });

        // Aggregate statistics
        const profile = {
            count: secondPurchasers.length,
            personas: {},
            ageGroups: {},
            birthYears: {},
            devices: {},
            sources: {},
            genders: {},
            avgDaysBetween: 0,
            avgAge: null
        };

        let totalDays = 0;
        let daysCount = 0;
        let totalAge = 0;
        let ageCount = 0;

        secondPurchasers.forEach(p => {
            // Persona
            profile.personas[p.persona] = (profile.personas[p.persona] || 0) + 1;

            // Age Group
            profile.ageGroups[p.ageGroup] = (profile.ageGroups[p.ageGroup] || 0) + 1;

            // Birth Year
            if (p.birthYear) {
                profile.birthYears[p.birthYear] = (profile.birthYears[p.birthYear] || 0) + 1;
            }

            // Device
            profile.devices[p.deviceType] = (profile.devices[p.deviceType] || 0) + 1;

            // Source
            profile.sources[p.source] = (profile.sources[p.source] || 0) + 1;

            // Gender
            profile.genders[p.gender] = (profile.genders[p.gender] || 0) + 1;

            // Days between
            if (p.daysBetween !== null && p.daysBetween >= 0) {
                totalDays += p.daysBetween;
                daysCount++;
            }

            // Age
            if (p.age !== null) {
                totalAge += p.age;
                ageCount++;
            }
        });

        profile.avgDaysBetween = daysCount > 0 ? totalDays / daysCount : 0;
        profile.avgAge = ageCount > 0 ? totalAge / ageCount : null;

        return profile;
    }

    initCharts() {
        // Design system chart colors
        const chartColors = {
            primary: '#B05B36',
            secondary: '#D4927A',
            accent: '#E5B299',
            success: '#10B981',
            warning: '#F59E0B',
            danger: '#EF4444',
            muted: '#666666',
            grid: 'rgba(42, 43, 47, 0.1)',
            text: '#666666'
        };

        // Status Chart
        const statusCtx = document.getElementById('statusChart')?.getContext('2d');
        if (statusCtx) {
            this.charts.status = new Chart(statusCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Subscribed', 'Pending', 'Unsubscribed', 'Bounced', 'Complained'],
                    datasets: [{
                        data: [0, 0, 0, 0, 0],
                        backgroundColor: [chartColors.success, chartColors.warning, chartColors.danger, chartColors.primary, chartColors.secondary],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right', labels: { color: chartColors.text, usePointStyle: true, padding: 15 } }
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
                        legend: { position: 'right', labels: { color: chartColors.text, usePointStyle: true, padding: 15 } }
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
                        backgroundColor: chartColors.primary
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { color: chartColors.grid }, ticks: { color: chartColors.text } },
                        y: { grid: { color: chartColors.grid }, ticks: { color: chartColors.text } }
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
                        backgroundColor: [chartColors.primary, chartColors.success, chartColors.warning, chartColors.muted],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right', labels: { color: chartColors.text, usePointStyle: true, padding: 15 } }
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
                            labels: { color: '#666666', usePointStyle: true, padding: 15 }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: 'rgba(42, 43, 47, 0.1)' },
                            ticks: { color: '#666666', maxRotation: 45, minRotation: 45 }
                        },
                        y: {
                            grid: { color: 'rgba(42, 43, 47, 0.1)' },
                            ticks: { color: '#666666' },
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
                        legend: { position: 'right', labels: { color: '#666666', usePointStyle: true, padding: 10, font: { size: 11 } } }
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
                        x: { grid: { color: 'rgba(42, 43, 47, 0.1)' }, ticks: { color: '#666666' } },
                        y: { grid: { color: 'rgba(42, 43, 47, 0.1)' }, ticks: { color: '#666666' }, beginAtZero: true }
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
                        legend: { position: 'top', labels: { color: '#666666', usePointStyle: true } }
                    },
                    scales: {
                        x: { grid: { color: 'rgba(42, 43, 47, 0.1)' }, ticks: { color: '#666666', maxRotation: 45, minRotation: 45 } },
                        y: { grid: { color: 'rgba(42, 43, 47, 0.1)' }, ticks: { color: '#666666' }, beginAtZero: true }
                    }
                }
            });
        }

        // ========== WOOCOMMERCE CHARTS ==========

        // WooCommerce Revenue Chart (New vs Returning)
        const wcRevenueCtx = document.getElementById('wcRevenueChart')?.getContext('2d');
        if (wcRevenueCtx) {
            this.charts.wcRevenue = new Chart(wcRevenueCtx, {
                type: 'doughnut',
                data: {
                    labels: ['New Customers', 'Returning Customers'],
                    datasets: [{
                        data: [0, 0],
                        backgroundColor: ['#B05B36', '#10B981'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { color: '#666666', usePointStyle: true, padding: 15 }
                        },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => {
                                    const value = ctx.raw || 0;
                                    return `${ctx.label}: ${this.formatNumber(value)} VND`;
                                }
                            }
                        }
                    }
                }
            });
        }

        // WooCommerce LTV Distribution Chart
        const wcLTVCtx = document.getElementById('wcLTVChart')?.getContext('2d');
        if (wcLTVCtx) {
            this.charts.wcLTV = new Chart(wcLTVCtx, {
                type: 'bar',
                data: {
                    labels: ['<200K', '200K-500K', '500K-1M', '1M-2M', '2M+'],
                    datasets: [{
                        label: 'Customers',
                        data: [0, 0, 0, 0, 0],
                        backgroundColor: '#D4927A'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => `${ctx.raw} customers`
                            }
                        }
                    },
                    scales: {
                        x: { grid: { color: 'rgba(42, 43, 47, 0.1)' }, ticks: { color: '#666666' } },
                        y: { grid: { color: 'rgba(42, 43, 47, 0.1)' }, ticks: { color: '#666666' }, beginAtZero: true }
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
                        x: { grid: { color: 'rgba(42, 43, 47, 0.1)' }, ticks: { color: '#666666' } },
                        y: { grid: { display: false }, ticks: { color: '#666666' } }
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
                        legend: { position: 'right', labels: { color: '#666666', usePointStyle: true, padding: 15 } }
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
                        legend: { position: 'right', labels: { color: '#666666', usePointStyle: true, padding: 10 } }
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
                        legend: { position: 'right', labels: { color: '#666666', usePointStyle: true, padding: 10 } }
                    }
                }
            });
        }

        // 2nd Purchaser Persona Chart
        const secPurchCtx = document.getElementById('secPurchPersonaChart')?.getContext('2d');
        if (secPurchCtx) {
            this.charts.secPurchPersona = new Chart(secPurchCtx, {
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
                        legend: { position: 'right', labels: { color: '#666666', usePointStyle: true, padding: 10 } }
                    }
                }
            });
        }

        // Time of Day Charts
        const timeChartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: { color: '#666666', maxRotation: 45, minRotation: 45, font: { size: 9 } },
                    grid: { display: false }
                },
                y: {
                    ticks: { color: '#666666' },
                    grid: { color: 'rgba(102, 102, 102, 0.1)' },
                    beginAtZero: true
                }
            }
        };

        const subscribeTimeCtx = document.getElementById('subscribeTimeChart')?.getContext('2d');
        if (subscribeTimeCtx) {
            this.charts.subscribeTime = new Chart(subscribeTimeCtx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Subscriptions',
                        data: [],
                        backgroundColor: 'rgba(99, 102, 241, 0.7)',
                        borderColor: 'rgba(99, 102, 241, 1)',
                        borderWidth: 1
                    }]
                },
                options: timeChartOptions
            });
        }

        const purchaseTimeCtx = document.getElementById('purchaseTimeChart')?.getContext('2d');
        if (purchaseTimeCtx) {
            this.charts.purchaseTime = new Chart(purchaseTimeCtx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'First Purchases',
                        data: [],
                        backgroundColor: 'rgba(34, 197, 94, 0.7)',
                        borderColor: 'rgba(34, 197, 94, 1)',
                        borderWidth: 1
                    }]
                },
                options: timeChartOptions
            });
        }

        const repeatTimeCtx = document.getElementById('repeatTimeChart')?.getContext('2d');
        if (repeatTimeCtx) {
            this.charts.repeatTime = new Chart(repeatTimeCtx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Repeat Purchases',
                        data: [],
                        backgroundColor: 'rgba(168, 85, 247, 0.7)',
                        borderColor: 'rgba(168, 85, 247, 1)',
                        borderWidth: 1
                    }]
                },
                options: timeChartOptions
            });
        }
    }

    setGrowthPeriod(days) {
        this.growthPeriod = days;

        // Update button states
        document.querySelectorAll('.growth-period-btn').forEach(btn => {
            btn.classList.remove('active', 'bg-primary', 'text-white');
            btn.classList.add('bg-muted', 'text-foreground');
            if (parseInt(btn.dataset.days) === days) {
                btn.classList.add('active', 'bg-primary', 'text-white');
                btn.classList.remove('bg-muted', 'text-foreground');
            }
        });

        this.updatePersonaGrowthChart();
    }

    updateDashboard() {
        // New 3-tab structure - wrapped in try-catch to prevent one section from breaking others
        try {
            this.updateExecutiveSummary();
        } catch (e) {
            console.error('Error updating Executive Summary:', e);
        }

        try {
            this.updateDeepDive();
        } catch (e) {
            console.error('Error updating Deep Dive:', e);
        }

        try {
            this.updateRevenue();
        } catch (e) {
            console.error('Error updating Revenue:', e);
        }

        // Legacy updates for shared data
        try {
            this.updateWooCommerceSection();
        } catch (e) {
            console.error('Error updating WooCommerce Section:', e);
        }
    }

    // ==================== EXECUTIVE SUMMARY TAB ====================
    updateExecutiveSummary() {
        const analytics = this.data.growthAnalytics || {};
        const wc = this.data.woocommerce?.metrics || {};
        const personas = this.data.personas || {};

        // Calculate historical comparisons
        const comparisons = this.calculateComparisons();

        // Get filtered counts
        const filteredSubscribers = this.getFilteredSubscribers();

        // Acquisition metrics - use filtered count (with null checks)
        const metricTotalEl = document.getElementById('metricTotal');
        const metricTotalTrendEl = document.getElementById('metricTotalTrend');
        const metricWeekNewEl = document.getElementById('metricWeekNew');
        if (metricTotalEl) metricTotalEl.textContent = this.formatNumber(filteredSubscribers.length);
        if (metricTotalTrendEl) metricTotalTrendEl.textContent = `+${analytics.thisWeekNew || 0} this week`;
        if (metricWeekNewEl) metricWeekNewEl.textContent = this.formatNumber(analytics.thisWeekNew || 0);

        // CVR
        const total = (analytics.leads || 0) + (analytics.customers || 0);
        const cvr = total > 0 ? ((analytics.customers / total) * 100).toFixed(1) : '0';
        const cvrEl = document.getElementById('metricCVR2');
        if (cvrEl) cvrEl.textContent = `${cvr}%`;

        // CVR Trend Badge
        const cvrTrendEl = document.getElementById('metricCVRTrend');
        if (cvrTrendEl) {
            cvrTrendEl.innerHTML = this.formatComparisonBadge(comparisons.cvr.change);
        }

        // Week trend with badge
        const weekChange = parseInt(analytics.weekOverWeekChange) || 0;
        const weekTrendEl = document.getElementById('metricWeekTrend');
        if (weekTrendEl) {
            weekTrendEl.innerHTML = this.formatComparisonBadge(weekChange);
        }

        // Top source
        if (analytics.sources) {
            const topSource = Object.entries(analytics.sources)
                .sort((a, b) => b[1].total - a[1].total)[0];
            if (topSource) {
                const topSourceEl = document.getElementById('metricTopSource');
                const topSourcePctEl = document.getElementById('metricTopSourcePct');
                if (topSourceEl) topSourceEl.textContent = topSource[0];
                if (topSourcePctEl) {
                    const pct = ((topSource[1].total / total) * 100).toFixed(0);
                    topSourcePctEl.textContent = `${pct}% of leads`;
                }
            }
        }

        // Revenue metrics
        const summaryLTV = document.getElementById('summaryLTV');
        if (summaryLTV) summaryLTV.textContent = this.formatCurrency(wc.ltv?.avg || 0);

        const summaryRepeatRate = document.getElementById('summaryRepeatRate');
        if (summaryRepeatRate) {
            const repeatRate = (wc.totalCustomers > 0 && wc.repeatCustomers != null) ?
                ((wc.repeatCustomers / wc.totalCustomers) * 100).toFixed(1) : '0';
            summaryRepeatRate.textContent = `${repeatRate}%`;
        }

        // Revenue This Week with comparison
        const summaryWeekRevenue = document.getElementById('summaryWeekRevenue');
        if (summaryWeekRevenue) {
            summaryWeekRevenue.textContent = this.formatCurrency(comparisons.revenue.thisWeek);
        }
        const summaryRevenueTrend = document.getElementById('summaryRevenueTrend');
        if (summaryRevenueTrend) {
            summaryRevenueTrend.innerHTML = this.formatComparisonBadge(comparisons.revenue.change);
        }

        // AOV with comparison
        const summaryAOV = document.getElementById('summaryAOV');
        if (summaryAOV) summaryAOV.textContent = this.formatCurrency(comparisons.aov.current || wc.aovFirstPurchase?.avg || 0);
        const summaryAOVTrend = document.getElementById('summaryAOVTrend');
        if (summaryAOVTrend) {
            summaryAOVTrend.innerHTML = this.formatComparisonBadge(comparisons.aov.change);
        }

        // Best persona
        const bestPersona = this.getBestConvertingPersona();
        const bestPersonaEl = document.getElementById('summaryBestPersona');
        const bestPersonaCVREl = document.getElementById('summaryBestPersonaCVR');
        if (bestPersonaEl && bestPersona) {
            bestPersonaEl.textContent = bestPersona.name || '-';
            if (bestPersonaCVREl) bestPersonaCVREl.textContent = bestPersona.cvr != null ? `${bestPersona.cvr.toFixed(1)}% CVR` : '-';
        }

        // VIP customers (4+ purchases)
        const vipCount = document.getElementById('summaryVIPCount');
        if (vipCount) {
            const vips = Object.values(this.data.woocommerce?.customerOrders || {})
                .filter(orders => orders.length >= 4).length;
            vipCount.textContent = this.formatNumber(vips);
        }

        // Active today (last 24h)
        const activeToday = document.getElementById('summaryActiveToday');
        if (activeToday) {
            const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const active = filteredSubscribers.filter(s =>
                s.last_activity && new Date(s.last_activity) > dayAgo
            ).length;
            activeToday.textContent = this.formatNumber(active);
        }

        // Data quality
        const dataQuality = document.getElementById('summaryDataQuality');
        if (dataQuality) {
            const complete = filteredSubscribers.filter(s => s.dob && s.device_type).length;
            const total = filteredSubscribers.length || 1;
            dataQuality.textContent = `${((complete / total) * 100).toFixed(0)}%`;
        }

        // Generate and display insights
        this.updateInsightsBar();
        this.updateActionsBar();
        this.initSummaryCharts();
    }

    getBestConvertingPersona() {
        const personas = this.data.personas || {};
        let best = null;
        Object.entries(personas).forEach(([name, data]) => {
            if (data.count > 10 && (!best || data.cvr > best.cvr)) {
                best = { name, ...data };
            }
        });
        return best;
    }

    updateInsightsBar() {
        const insights = this.generateInsights();
        const insightsBar = document.getElementById('insightsBar');
        if (!insightsBar) return;

        if (insights.length === 0) {
            insightsBar.innerHTML = '<p class="text-muted-foreground">No insights available yet.</p>';
            return;
        }

        insightsBar.innerHTML = insights.map(insight => {
            const icon = insight.type === 'positive' ? '✅' : insight.type === 'warning' ? '⚠️' : 'ℹ️';
            const color = insight.type === 'positive' ? 'text-success' :
                         insight.type === 'warning' ? 'text-warning' : 'text-foreground';
            return `<p class="${color}">${icon} ${insight.text}</p>`;
        }).join('');
    }

    generateInsights() {
        const insights = [];
        const wc = this.data.woocommerce?.metrics || {};
        const personas = this.data.personas || {};
        const analytics = this.data.growthAnalytics || {};

        // LTV insight
        if (wc.ltv?.avg > 0) {
            insights.push({
                type: 'info',
                text: `Average LTV is ${this.formatCurrency(wc.ltv.avg)} per customer`
            });
        }

        // Best converting persona
        const bestPersona = this.getBestConvertingPersona();
        if (bestPersona && bestPersona.cvr > 5) {
            insights.push({
                type: 'positive',
                text: `${bestPersona.name} has highest CVR at ${bestPersona.cvr.toFixed(1)}% - focus acquisition here`
            });
        }

        // Repeat rate insight
        if (wc.totalCustomers > 0) {
            const repeatRate = (wc.repeatCustomers / wc.totalCustomers) * 100;
            if (repeatRate < 20) {
                insights.push({
                    type: 'warning',
                    text: `Only ${repeatRate.toFixed(0)}% repeat purchase rate - focus on retention`
                });
            } else if (repeatRate > 30) {
                insights.push({
                    type: 'positive',
                    text: `Strong ${repeatRate.toFixed(0)}% repeat purchase rate - customers love your products`
                });
            }
        }

        // Week over week trend
        if (analytics.weekOverWeekChange) {
            if (analytics.weekOverWeekChange < -10) {
                insights.push({
                    type: 'warning',
                    text: `Lead acquisition down ${Math.abs(analytics.weekOverWeekChange)}% vs last week`
                });
            } else if (analytics.weekOverWeekChange > 20) {
                insights.push({
                    type: 'positive',
                    text: `Lead acquisition up ${analytics.weekOverWeekChange}% vs last week!`
                });
            }
        }

        return insights.slice(0, 3);
    }

    updateActionsBar() {
        const actions = this.generateActions();
        const actionsBar = document.getElementById('actionsBar');
        if (!actionsBar) return;

        if (actions.length === 0) {
            actionsBar.innerHTML = '<p class="text-muted-foreground">No recommendations available yet.</p>';
            return;
        }

        actionsBar.innerHTML = actions.map((action, i) => `
            <div class="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <div class="w-6 h-6 bg-success/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span class="text-success text-xs font-bold">${i + 1}</span>
                </div>
                <div class="text-sm text-foreground">${action}</div>
            </div>
        `).join('');
    }

    generateActions() {
        const actions = [];
        const wc = this.data.woocommerce || {};
        const subscribers = this.getFilteredSubscribers();

        // Incomplete profiles
        const incomplete = subscribers.filter(s => !s.dob || !s.device_type).length;
        if (incomplete > 10) {
            actions.push(`Nurture <strong>${incomplete}</strong> contacts with incomplete profiles to improve segmentation`);
        }

        // One-time buyers (>30 days)
        const oneTimers = Object.values(wc.customerOrders || {})
            .filter(orders => {
                if (orders.length !== 1) return false;
                const orderDate = new Date(orders[0].date_created);
                const daysSinceOrder = (Date.now() - orderDate) / (1000 * 60 * 60 * 24);
                return daysSinceOrder > 30;
            }).length;
        if (oneTimers > 0) {
            actions.push(`Re-engage <strong>${oneTimers}</strong> one-time buyers with win-back campaign (inactive >30 days)`);
        }

        // Best source recommendation
        const analytics = this.data.growthAnalytics || {};
        if (analytics.sources) {
            const sources = Object.entries(analytics.sources)
                .filter(([, data]) => data.total > 10)
                .map(([name, data]) => ({
                    name,
                    cvr: data.total > 0 ? (data.customers / data.total) * 100 : 0
                }))
                .sort((a, b) => b.cvr - a.cvr);

            if (sources.length > 0 && sources[0].cvr > 5) {
                actions.push(`Double down on <strong>${sources[0].name}</strong> - highest CVR at ${sources[0].cvr.toFixed(1)}%`);
            }
        }

        return actions.slice(0, 3);
    }

    initSummaryCharts() {
        // Growth Pulse Chart (7 days) - Shows leads & orders, this week vs last week
        const leadCtx = document.getElementById('summaryLeadChart')?.getContext('2d');
        if (leadCtx && !this.charts.summaryLead) {
            const pulse = this.getGrowthPulseData();
            this.charts.summaryLead = new Chart(leadCtx, {
                type: 'line',
                data: {
                    labels: pulse.labels,
                    datasets: [
                        {
                            label: 'Leads (This Week)',
                            data: pulse.thisWeekLeads,
                            borderColor: '#B05B36',
                            backgroundColor: 'rgba(176, 91, 54, 0.15)',
                            fill: true,
                            tension: 0.3,
                            borderWidth: 2,
                            pointRadius: 3
                        },
                        {
                            label: 'Orders (This Week)',
                            data: pulse.thisWeekOrders,
                            borderColor: '#10B981',
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            fill: true,
                            tension: 0.3,
                            borderWidth: 2,
                            pointRadius: 3
                        },
                        {
                            label: 'Leads (Last Week)',
                            data: pulse.lastWeekLeads,
                            borderColor: '#B05B36',
                            borderDash: [5, 5],
                            backgroundColor: 'transparent',
                            fill: false,
                            tension: 0.3,
                            borderWidth: 1,
                            pointRadius: 0
                        },
                        {
                            label: 'Orders (Last Week)',
                            data: pulse.lastWeekOrders,
                            borderColor: '#10B981',
                            borderDash: [5, 5],
                            backgroundColor: 'transparent',
                            fill: false,
                            tension: 0.3,
                            borderWidth: 1,
                            pointRadius: 0
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'bottom',
                            labels: { color: '#666', padding: 8, usePointStyle: true, font: { size: 10 } }
                        },
                        tooltip: { mode: 'index', intersect: false }
                    },
                    scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(42, 43, 47, 0.1)' }, ticks: { color: '#666' } },
                        x: { grid: { display: false }, ticks: { color: '#666' } }
                    }
                }
            });
        } else if (this.charts.summaryLead) {
            const pulse = this.getGrowthPulseData();
            this.charts.summaryLead.data.labels = pulse.labels;
            this.charts.summaryLead.data.datasets[0].data = pulse.thisWeekLeads;
            this.charts.summaryLead.data.datasets[1].data = pulse.thisWeekOrders;
            this.charts.summaryLead.data.datasets[2].data = pulse.lastWeekLeads;
            this.charts.summaryLead.data.datasets[3].data = pulse.lastWeekOrders;
            this.charts.summaryLead.update();
        }

        // Revenue Split Chart
        const revCtx = document.getElementById('summaryRevenueChart')?.getContext('2d');
        if (revCtx && !this.charts.summaryRevenue) {
            const wc = this.data.woocommerce?.metrics || {};
            this.charts.summaryRevenue = new Chart(revCtx, {
                type: 'doughnut',
                data: {
                    labels: ['New Customers', 'Returning Customers'],
                    datasets: [{
                        data: [wc.revenueNew || 0, wc.revenueReturning || 0],
                        backgroundColor: ['#B05B36', '#10B981'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { color: '#666', padding: 15 } } }
                }
            });
        } else if (this.charts.summaryRevenue) {
            const wc = this.data.woocommerce?.metrics || {};
            this.charts.summaryRevenue.data.datasets[0].data = [wc.revenueNew || 0, wc.revenueReturning || 0];
            this.charts.summaryRevenue.update();
        }
    }

    getGrowthPulseData() {
        const labels = [];
        const thisWeekLeads = [];
        const thisWeekOrders = [];
        const lastWeekLeads = [];
        const lastWeekOrders = [];

        const subscribers = this.getFilteredSubscribers();

        // Apply conditional filter to orders (if active)
        const { emails: conditionalEmails } = this.getConditionallyFilteredCustomers();
        const allOrders = this.getFilteredOrders();
        const orders = conditionalEmails !== null
            ? allOrders.filter(order => {
                const email = (order.billing?.email || order.billing_email)?.toLowerCase();
                return conditionalEmails.has(email);
            })
            : allOrders;

        // Helper to extract date string (handles multiple formats)
        const getDateStr = (dateValue) => {
            if (!dateValue) return null;
            try {
                // Handle ISO format, space-separated, or date-only
                const d = new Date(dateValue);
                if (isNaN(d.getTime())) return null;
                return d.toISOString().split('T')[0];
            } catch (e) {
                return null;
            }
        };

        for (let i = 6; i >= 0; i--) {
            // This week
            const thisDate = new Date();
            thisDate.setDate(thisDate.getDate() - i);
            const thisDateStr = thisDate.toISOString().split('T')[0];

            // Last week (same weekday)
            const lastDate = new Date();
            lastDate.setDate(lastDate.getDate() - i - 7);
            const lastDateStr = lastDate.toISOString().split('T')[0];

            labels.push(thisDate.toLocaleDateString('en-US', { weekday: 'short' }));

            // This week counts - use robust date parsing
            thisWeekLeads.push(subscribers.filter(s =>
                getDateStr(s.created_at) === thisDateStr
            ).length);
            thisWeekOrders.push(orders.filter(o =>
                getDateStr(o.date_created) === thisDateStr
            ).length);

            // Last week counts
            lastWeekLeads.push(subscribers.filter(s =>
                getDateStr(s.created_at) === lastDateStr
            ).length);
            lastWeekOrders.push(orders.filter(o =>
                getDateStr(o.date_created) === lastDateStr
            ).length);
        }

        return { labels, thisWeekLeads, thisWeekOrders, lastWeekLeads, lastWeekOrders };
    }

    // ==================== DEEP DIVE TAB ====================
    updateDeepDive() {
        // Update persona performance table with LTV
        try {
            this.updatePersonaTableWithLTV();
        } catch (e) {
            console.error('Error updating Persona Table:', e);
        }

        // Update cohort table (limited to 4 weeks)
        try {
            this.updateCohortTableLimited();
        } catch (e) {
            console.error('Error updating Cohort Table:', e);
        }

        // Update source chart and table
        try {
            this.updateSourceData();
        } catch (e) {
            console.error('Error updating Source Data:', e);
        }

        // Update demographic sections (collapsible content)
        try {
            this.updateDemographicSections();
        } catch (e) {
            console.error('Error updating Demographic Sections:', e);
        }
    }

    updatePersonaTableWithLTV() {
        const personas = this.data.personas || {};
        const table = document.getElementById('personaTable');
        if (!table) return;

        const total = Object.values(personas).reduce((sum, p) => sum + p.count, 0);
        const avgCvr = total > 0 ?
            Object.values(personas).reduce((sum, p) => sum + (p.converted || 0), 0) / total * 100 : 0;

        // Get LTV by persona from WooCommerce data
        const personaLTV = this.calculatePersonaLTV();

        const sortedPersonas = Object.entries(personas)
            .sort((a, b) => b[1].count - a[1].count);

        table.innerHTML = sortedPersonas.map(([name, data]) => {
            const pct = ((data.count / total) * 100).toFixed(1);
            const ltv = personaLTV[name] || 0;
            const topSource = this.getTopSourceForPersona(name);
            const actionLabel = data.cvr > avgCvr ? 'Scale' : 'Nurture';
            const actionColor = data.cvr > avgCvr ? 'bg-success' : 'bg-warning';
            const personaKey = name.replace(/[^a-zA-Z0-9]/g, '_');

            return `
                <tr class="border-b border-foreground/10 hover:bg-muted/30 cursor-pointer persona-row" onclick="expandPersonaRow('${personaKey}')" data-persona="${this.escapeHtml(name)}">
                    <td class="py-3 text-center">
                        <i class="fas fa-chevron-right text-muted-foreground transition-transform duration-200" id="persona-icon-${personaKey}"></i>
                    </td>
                    <td class="py-3">
                        <span class="font-medium text-foreground">${this.escapeHtml(name)}</span>
                    </td>
                    <td class="py-3 text-right text-foreground">${this.formatNumber(data.count)}</td>
                    <td class="py-3 text-right text-muted-foreground">${pct}%</td>
                    <td class="py-3">
                        <div class="w-full bg-muted rounded-full h-2">
                            <div class="bg-primary h-2 rounded-full" style="width: ${pct}%"></div>
                        </div>
                    </td>
                    <td class="py-3 text-right ${data.cvr > avgCvr ? 'text-success' : 'text-foreground'} font-medium">
                        ${data.cvr?.toFixed(1) || 0}%
                    </td>
                    <td class="py-3 text-right text-foreground">${this.formatCurrency(ltv)}</td>
                    <td class="py-3 text-muted-foreground">${topSource}</td>
                    <td class="py-3 text-center">
                        <span class="px-2 py-1 ${actionColor} text-white text-xs rounded">${actionLabel}</span>
                    </td>
                </tr>
                <tr id="persona-detail-${personaKey}" class="hidden">
                    <td colspan="9" class="p-0">
                        <div id="persona-detail-content-${personaKey}" class="bg-muted/20 p-4 border-t border-foreground/10">
                            <div class="text-center text-muted-foreground">Loading details...</div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Update data completeness (use filtered subscribers)
        const completeEl = document.getElementById('dataCompleteness');
        if (completeEl) {
            const filteredSubs = this.getFilteredSubscribers();
            const complete = filteredSubs.filter(s => s.dob && s.device_type).length;
            completeEl.textContent = `${this.formatNumber(complete)} / ${this.formatNumber(filteredSubs.length)}`;
        }
    }

    calculatePersonaLTV() {
        const personaLTV = {};
        const customerOrders = this.data.woocommerce?.customerOrders || {};
        const subscribers = this.getFilteredSubscribers();

        // Map emails to personas
        const emailToPersona = {};
        subscribers.forEach(s => {
            if (s.email && s._persona) {
                emailToPersona[s.email.toLowerCase()] = s._persona;
            }
        });

        // Calculate LTV per persona
        const personaTotals = {};
        const personaCounts = {};

        Object.entries(customerOrders).forEach(([email, orders]) => {
            const persona = emailToPersona[email];
            if (persona) {
                const ltv = orders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
                personaTotals[persona] = (personaTotals[persona] || 0) + ltv;
                personaCounts[persona] = (personaCounts[persona] || 0) + 1;
            }
        });

        Object.keys(personaTotals).forEach(persona => {
            personaLTV[persona] = personaTotals[persona] / (personaCounts[persona] || 1);
        });

        return personaLTV;
    }

    getTopSourceForPersona(personaName) {
        const subscribers = this.getFilteredSubscribers();
        const sources = {};

        subscribers.forEach(s => {
            if (s._persona === personaName && s.source) {
                sources[s.source] = (sources[s.source] || 0) + 1;
            }
        });

        const topSource = Object.entries(sources)
            .sort((a, b) => b[1] - a[1])[0];

        return topSource ? topSource[0] : '-';
    }

    calculatePersonaDetails(personaName) {
        const subscribers = this.getFilteredSubscribers();
        const customerOrders = this.data.woocommerce?.customerOrders || {};

        // Filter subscribers for this persona
        const personaSubs = subscribers.filter(s => s._persona === personaName);

        // Group by birth year - each year gets its own row with all metrics
        const byBirthYear = {};

        // Helper: Get time of day bucket
        const getTimeOfDay = (dateStr) => {
            if (!dateStr) return null;
            const hour = new Date(dateStr).getHours();
            if (hour >= 5 && hour < 12) return 'morning';
            if (hour >= 12 && hour < 17) return 'afternoon';
            if (hour >= 17 && hour < 21) return 'evening';
            return 'night';
        };

        // Helper: Check if device is mobile
        const isMobile = (deviceType) => {
            const d = (deviceType || '').toLowerCase();
            return d.includes('mobile') || d.includes('phone') || d.includes('ios') || d.includes('android');
        };

        // Totals for footer
        const totals = {
            subscribers: 0,
            buyers: 0,
            totalRevenue: 0,
            orderCount: 0,
            mobile: 0,
            desktop: 0,
            daysToConvert: 0,
            convertedCount: 0
        };

        // Process each subscriber
        personaSubs.forEach(sub => {
            // Get birth year - use _birthYear set during categorization, or parse from DOB
            let birthYear = sub._birthYear || parseBirthYear(extractDOB(sub));
            if (!birthYear) birthYear = 'Unknown';

            // Initialize year data if not exists
            if (!byBirthYear[birthYear]) {
                byBirthYear[birthYear] = {
                    subscribers: 0,
                    buyers: 0,
                    totalRevenue: 0,
                    orderCount: 0,
                    devices: { mobile: 0, desktop: 0 },
                    timeOfDay: { morning: { total: 0, converted: 0 }, afternoon: { total: 0, converted: 0 }, evening: { total: 0, converted: 0 }, night: { total: 0, converted: 0 } },
                    sources: {},
                    daysToConvert: []
                };
            }

            const yearData = byBirthYear[birthYear];
            yearData.subscribers++;
            totals.subscribers++;

            // Device - check multiple field locations
            const deviceValue = sub.device_type || sub.device || sub.custom_fields?.device;
            if (isMobile(deviceValue)) {
                yearData.devices.mobile++;
                totals.mobile++;
            } else {
                yearData.devices.desktop++;
                totals.desktop++;
            }

            // Source
            if (sub.source) {
                yearData.sources[sub.source] = (yearData.sources[sub.source] || 0) + 1;
            }

            // Time of day (based on registration)
            const timeOfDay = getTimeOfDay(sub.created_at);
            if (timeOfDay) {
                yearData.timeOfDay[timeOfDay].total++;
            }

            // Check if buyer
            const email = sub.email?.toLowerCase();
            if (email && customerOrders[email]) {
                const orders = customerOrders[email];
                const revenue = orders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);

                yearData.buyers++;
                yearData.totalRevenue += revenue;
                yearData.orderCount += orders.length;
                totals.buyers++;
                totals.totalRevenue += revenue;
                totals.orderCount += orders.length;

                // Time of day conversion
                if (timeOfDay) {
                    yearData.timeOfDay[timeOfDay].converted++;
                }

                // Days to convert
                if (sub.created_at && orders.length > 0) {
                    const firstOrder = orders.reduce((earliest, o) => {
                        const d = new Date(o.date_created);
                        return d < earliest ? d : earliest;
                    }, new Date(orders[0].date_created));
                    const days = Math.max(0, Math.floor((firstOrder - new Date(sub.created_at)) / (1000 * 60 * 60 * 24)));
                    yearData.daysToConvert.push(days);
                    totals.daysToConvert += days;
                    totals.convertedCount++;
                }
            }
        });

        // Calculate derived metrics for each year
        Object.keys(byBirthYear).forEach(year => {
            const data = byBirthYear[year];

            // CVR
            data.cvr = data.subscribers > 0 ? ((data.buyers / data.subscribers) * 100).toFixed(1) : '0.0';

            // AOV
            data.aov = data.orderCount > 0 ? (data.totalRevenue / data.orderCount) : 0;

            // Best time of day (highest CVR)
            let bestTime = 'morning';
            let bestCvr = 0;
            Object.entries(data.timeOfDay).forEach(([period, d]) => {
                const cvr = d.total > 0 ? (d.converted / d.total) : 0;
                if (cvr > bestCvr) {
                    bestCvr = cvr;
                    bestTime = period;
                }
            });
            data.bestTimeOfDay = bestTime;
            data.bestTimeCvr = (bestCvr * 100).toFixed(0);

            // Top source
            const topSrc = Object.entries(data.sources).sort((a, b) => b[1] - a[1])[0];
            data.topSource = topSrc ? topSrc[0] : '-';
            data.topSourceCount = topSrc ? topSrc[1] : 0;

            // Avg days to convert
            data.avgDaysToConvert = data.daysToConvert.length > 0
                ? Math.round(data.daysToConvert.reduce((a, b) => a + b, 0) / data.daysToConvert.length)
                : 0;
        });

        // Sort birth years (newest first, Unknown at end)
        const sortedYears = Object.keys(byBirthYear)
            .filter(y => y !== 'Unknown')
            .sort((a, b) => parseInt(b) - parseInt(a));
        if (byBirthYear['Unknown']) {
            sortedYears.push('Unknown');
        }

        // Calculate totals
        totals.cvr = totals.subscribers > 0 ? ((totals.buyers / totals.subscribers) * 100).toFixed(1) : '0.0';
        totals.aov = totals.orderCount > 0 ? (totals.totalRevenue / totals.orderCount) : 0;
        totals.avgDaysToConvert = totals.convertedCount > 0 ? Math.round(totals.daysToConvert / totals.convertedCount) : 0;

        return {
            byBirthYear,
            sortedYears,
            totals,
            nurtureROI: {
                avgDays: totals.avgDaysToConvert,
                totalValue: totals.totalRevenue
            }
        };
    }

    renderPersonaDetails(personaName, details) {
        const timeIcons = { morning: '🌅', afternoon: '☀️', evening: '🌆', night: '🌙' };

        // Build table rows for each birth year
        const birthYearRows = details.sortedYears.map(year => {
            const data = details.byBirthYear[year];
            return `
                <tr class="border-b border-foreground/10 hover:bg-muted/20">
                    <td class="py-2 text-foreground font-medium">${year}</td>
                    <td class="py-2 text-right text-foreground">${data.subscribers}</td>
                    <td class="py-2 text-right text-success font-medium">${data.buyers}</td>
                    <td class="py-2 text-right ${parseFloat(data.cvr) > 0 ? 'text-primary' : 'text-muted-foreground'} font-medium">${data.cvr}%</td>
                    <td class="py-2 text-right text-foreground">${this.formatCurrency(data.aov)}</td>
                    <td class="py-2 text-center">
                        <span class="text-xs">📱${data.devices.mobile}</span>
                        <span class="text-muted-foreground mx-1">/</span>
                        <span class="text-xs">🖥️${data.devices.desktop}</span>
                    </td>
                    <td class="py-2 text-center">
                        <span title="${data.bestTimeOfDay} (${data.bestTimeCvr}% CVR)">${timeIcons[data.bestTimeOfDay]} ${data.bestTimeCvr}%</span>
                    </td>
                    <td class="py-2 text-muted-foreground text-sm">${this.escapeHtml(data.topSource)}${data.topSourceCount > 0 ? ` (${data.topSourceCount})` : ''}</td>
                </tr>
            `;
        }).join('');

        // Totals row
        const t = details.totals;
        const totalsRow = `
            <tr class="bg-muted/30 font-medium border-t-2 border-foreground/20">
                <td class="py-2 text-foreground">TOTAL</td>
                <td class="py-2 text-right text-foreground">${t.subscribers}</td>
                <td class="py-2 text-right text-success">${t.buyers}</td>
                <td class="py-2 text-right text-primary">${t.cvr}%</td>
                <td class="py-2 text-right text-foreground">${this.formatCurrency(t.aov)}</td>
                <td class="py-2 text-center">
                    <span class="text-xs">📱${t.mobile}</span>
                    <span class="text-muted-foreground mx-1">/</span>
                    <span class="text-xs">🖥️${t.desktop}</span>
                </td>
                <td class="py-2 text-center">-</td>
                <td class="py-2 text-muted-foreground">-</td>
            </tr>
        `;

        return `
            <div class="space-y-3">
                <!-- Birth Year Breakdown Table -->
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="text-muted-foreground text-xs border-b border-foreground/20 bg-muted/20">
                                <th class="text-left py-2 px-1">Year</th>
                                <th class="text-right py-2 px-1">Subscribers</th>
                                <th class="text-right py-2 px-1">Buyers</th>
                                <th class="text-right py-2 px-1">CVR</th>
                                <th class="text-right py-2 px-1">AOV</th>
                                <th class="text-center py-2 px-1">Device</th>
                                <th class="text-center py-2 px-1">Best Time</th>
                                <th class="text-left py-2 px-1">Top Source</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${birthYearRows || '<tr><td colspan="8" class="py-4 text-center text-muted-foreground">No birth year data available</td></tr>'}
                            ${totalsRow}
                        </tbody>
                    </table>
                </div>

                <!-- Nurture ROI Summary -->
                <div class="flex items-center justify-between bg-success/10 rounded-lg p-3">
                    <div class="flex items-center gap-6">
                        <div>
                            <span class="text-success font-medium">📈 Nurture ROI:</span>
                        </div>
                        <div class="flex gap-6 text-sm">
                            <div>
                                <span class="text-muted-foreground">Avg Days to Convert:</span>
                                <span class="text-foreground font-bold ml-1">${details.nurtureROI.avgDays} days</span>
                            </div>
                            <div>
                                <span class="text-muted-foreground">Total Value:</span>
                                <span class="text-success font-bold ml-1">${this.formatCurrency(details.nurtureROI.totalValue)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    updateCohortTableLimited() {
        const analytics = this.data.growthAnalytics || {};
        const cohortsObj = analytics.cohorts || {};
        const table = document.getElementById('cohortTable');
        if (!table) return;

        // Convert cohorts object to array and sort by week (most recent first)
        const cohortsArray = Object.entries(cohortsObj)
            .map(([weekKey, cohort]) => ({
                weekLabel: weekKey,
                total: cohort.total || 0,
                converted: cohort.customers || 0,  // 'customers' is the converted count
                cvr: cohort.cvr || 0,
                avgDaysToConvert: cohort.avgDaysToConvert
            }))
            .sort((a, b) => b.weekLabel.localeCompare(a.weekLabel));  // Sort descending by week

        // Limit to 4 weeks
        const limitedCohorts = cohortsArray.slice(0, 4);

        if (limitedCohorts.length === 0) {
            table.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-muted-foreground">No cohort data available</td></tr>';
            return;
        }

        table.innerHTML = limitedCohorts.map(cohort => {
            const cvr = cohort.total > 0 ? ((cohort.converted / cohort.total) * 100).toFixed(1) : 0;
            const barWidth = Math.min(parseFloat(cvr) * 5, 100);

            return `
                <tr class="border-b border-foreground/10 hover:bg-muted/30">
                    <td class="py-2 text-foreground">${cohort.weekLabel}</td>
                    <td class="py-2 text-right text-foreground">${this.formatNumber(cohort.total)}</td>
                    <td class="py-2 text-right text-success">${this.formatNumber(cohort.converted)}</td>
                    <td class="py-2 text-right font-medium text-foreground">${cvr}%</td>
                    <td class="py-2">
                        <div class="w-full bg-muted rounded-full h-2">
                            <div class="bg-success h-2 rounded-full" style="width: ${barWidth}%"></div>
                        </div>
                    </td>
                    <td class="py-2 text-right text-muted-foreground">${cohort.avgDaysToConvert || '-'}</td>
                </tr>
            `;
        }).join('');
    }

    updateSourceData() {
        const analytics = this.data.growthAnalytics || {};

        // Update source chart
        if (this.charts.source && analytics.sources) {
            const sortedSources = Object.entries(analytics.sources)
                .sort((a, b) => b[1].total - a[1].total)
                .slice(0, 5);

            this.charts.source.data.labels = sortedSources.map(([name]) => name);
            this.charts.source.data.datasets[0].data = sortedSources.map(([, data]) => data.total);
            this.charts.source.update();
        }

        // Update source table (top 5 only)
        const sourceTable = document.getElementById('sourceTable');
        if (sourceTable && analytics.sources) {
            const total = analytics.leads + analytics.customers || 1;
            const avgCvr = total > 0 ? (analytics.customers / total) * 100 : 0;

            const sortedSources = Object.entries(analytics.sources)
                .sort((a, b) => b[1].total - a[1].total)
                .slice(0, 5);

            sourceTable.innerHTML = sortedSources.map(([name, data]) => {
                const cvr = data.total > 0 ? ((data.customers / data.total) * 100).toFixed(1) : 0;
                const cvrColor = parseFloat(cvr) > avgCvr ? 'text-success' : 'text-foreground';

                return `
                    <tr class="border-b border-foreground/10 hover:bg-muted/30">
                        <td class="py-2 text-foreground">${this.escapeHtml(name)}</td>
                        <td class="py-2 text-right text-foreground">${this.formatNumber(data.leads)}</td>
                        <td class="py-2 text-right text-success">${this.formatNumber(data.customers)}</td>
                        <td class="py-2 text-right ${cvrColor} font-medium">${cvr}%</td>
                    </tr>
                `;
            }).join('');
        }
    }

    updateDemographicSections() {
        // These methods populate the collapsible sections
        try {
            this.updatePersonasTab();   // Updates age chart, device chart, persona targeting
        } catch (e) {
            console.error('Error updating Personas Tab:', e);
        }

        try {
            this.updateAstrologyTab();  // Updates zodiac chart, gender chart, tables
        } catch (e) {
            console.error('Error updating Astrology Tab:', e);
        }

        try {
            this.updateTimeOfDaySection();
        } catch (e) {
            console.error('Error updating Time of Day Section:', e);
        }
    }

    updateTimeOfDaySection() {
        const stats = this.data.timeOfDayStats;
        if (!stats) return;

        // Define time periods for grouping
        const timePeriods = [
            { name: 'Early Morning (5-8)', hours: [5, 6, 7], icon: '🌅' },
            { name: 'Morning (8-12)', hours: [8, 9, 10, 11], icon: '☀️' },
            { name: 'Afternoon (12-17)', hours: [12, 13, 14, 15, 16], icon: '🌤️' },
            { name: 'Evening (17-21)', hours: [17, 18, 19, 20], icon: '🌆' },
            { name: 'Night (21-24)', hours: [21, 22, 23], icon: '🌙' },
            { name: 'Late Night (0-5)', hours: [0, 1, 2, 3, 4], icon: '🌃' }
        ];

        // Find best hours
        const findBestHour = (data) => {
            let maxVal = 0;
            let bestHour = 0;
            data.forEach((val, hour) => {
                if (val > maxVal) {
                    maxVal = val;
                    bestHour = hour;
                }
            });
            return { hour: bestHour, count: maxVal };
        };

        const formatHour = (hour) => {
            if (hour === 0) return '12 AM';
            if (hour < 12) return `${hour} AM`;
            if (hour === 12) return '12 PM';
            return `${hour - 12} PM`;
        };

        // Update best time cards
        const bestSubscribe = findBestHour(stats.subscriptions);
        const bestPurchase = findBestHour(stats.firstPurchases);
        const bestRepeat = findBestHour(stats.repeatPurchases);

        const bestSubscribeEl = document.getElementById('bestSubscribeTime');
        const bestSubscribeCountEl = document.getElementById('bestSubscribeTimeCount');
        if (bestSubscribeEl) bestSubscribeEl.textContent = formatHour(bestSubscribe.hour);
        if (bestSubscribeCountEl) bestSubscribeCountEl.textContent = `${this.formatNumber(bestSubscribe.count)} subscriptions`;

        const bestPurchaseEl = document.getElementById('bestPurchaseTime');
        const bestPurchaseCountEl = document.getElementById('bestPurchaseTimeCount');
        if (bestPurchaseEl) bestPurchaseEl.textContent = formatHour(bestPurchase.hour);
        if (bestPurchaseCountEl) bestPurchaseCountEl.textContent = `${this.formatNumber(bestPurchase.count)} purchases`;

        const bestRepeatEl = document.getElementById('bestRepeatTime');
        const bestRepeatCountEl = document.getElementById('bestRepeatTimeCount');
        if (bestRepeatEl) bestRepeatEl.textContent = formatHour(bestRepeat.hour);
        if (bestRepeatCountEl) bestRepeatCountEl.textContent = `${this.formatNumber(bestRepeat.count)} repeat purchases`;

        // Update charts
        const hourLabels = Array.from({ length: 24 }, (_, i) => formatHour(i));

        // Subscription time chart
        if (this.charts.subscribeTime) {
            this.charts.subscribeTime.data.labels = hourLabels;
            this.charts.subscribeTime.data.datasets[0].data = stats.subscriptions;
            this.charts.subscribeTime.update();
        }

        // Purchase time chart
        if (this.charts.purchaseTime) {
            this.charts.purchaseTime.data.labels = hourLabels;
            this.charts.purchaseTime.data.datasets[0].data = stats.firstPurchases;
            this.charts.purchaseTime.update();
        }

        // Repeat purchase time chart
        if (this.charts.repeatTime) {
            this.charts.repeatTime.data.labels = hourLabels;
            this.charts.repeatTime.data.datasets[0].data = stats.repeatPurchases;
            this.charts.repeatTime.update();
        }

        // Update table
        const table = document.getElementById('timeOfDayTable');
        if (table) {
            table.innerHTML = timePeriods.map(period => {
                const subCount = period.hours.reduce((sum, h) => sum + stats.subscriptions[h], 0);
                const purchaseCount = period.hours.reduce((sum, h) => sum + stats.firstPurchases[h], 0);
                const repeatCount = period.hours.reduce((sum, h) => sum + stats.repeatPurchases[h], 0);

                const subPct = stats.totalSubscriptions > 0 ? (subCount / stats.totalSubscriptions * 100).toFixed(1) : 0;
                const purchasePct = stats.totalFirstPurchases > 0 ? (purchaseCount / stats.totalFirstPurchases * 100).toFixed(1) : 0;
                const repeatPct = stats.totalRepeatPurchases > 0 ? (repeatCount / stats.totalRepeatPurchases * 100).toFixed(1) : 0;

                return `
                    <tr class="border-b border-foreground/10 hover:bg-muted/30">
                        <td class="py-3 font-medium text-foreground">${period.icon} ${period.name}</td>
                        <td class="py-3 text-right text-foreground">${this.formatNumber(subCount)}</td>
                        <td class="py-3 text-right text-muted-foreground">${subPct}%</td>
                        <td class="py-3 text-right text-foreground">${this.formatNumber(purchaseCount)}</td>
                        <td class="py-3 text-right text-muted-foreground">${purchasePct}%</td>
                        <td class="py-3 text-right text-foreground">${this.formatNumber(repeatCount)}</td>
                        <td class="py-3 text-right text-muted-foreground">${repeatPct}%</td>
                    </tr>
                `;
            }).join('');
        }
    }

    // ==================== REVENUE TAB ====================
    updateRevenue() {
        // This tab uses the WooCommerce section which is already implemented
        // Just need to update a few additional elements
        const wc = this.data.woocommerce?.metrics || {};

        // Repeat rate in revenue tab
        const revRepeatRate = document.getElementById('revRepeatRate');
        if (revRepeatRate) {
            const rate = (wc.totalCustomers > 0 && wc.repeatCustomers != null) ?
                ((wc.repeatCustomers / wc.totalCustomers) * 100).toFixed(1) : '0';
            revRepeatRate.textContent = `${rate}%`;
        }

        // AOV metrics
        const revAOV1st = document.getElementById('revAOV1st');
        if (revAOV1st) revAOV1st.textContent = this.formatCurrency(wc.aovFirstPurchase?.avg || 0);

        const revAOV3rd = document.getElementById('revAOV3rd');
        if (revAOV3rd) {
            // Calculate AOV for 3rd+ purchases
            const thirdPlusOrders = [];
            Object.values(this.data.woocommerce?.customerOrders || {}).forEach(orders => {
                orders.forEach(o => {
                    if (o._purchaseNumber >= 3) {
                        thirdPlusOrders.push(parseFloat(o.total || 0));
                    }
                });
            });
            const avgAOV3rd = thirdPlusOrders.length > 0 ?
                thirdPlusOrders.reduce((a, b) => a + b, 0) / thirdPlusOrders.length : 0;
            revAOV3rd.textContent = this.formatCurrency(avgAOV3rd);
        }

        // Update 2nd Purchaser Profile
        this.update2ndPurchaserProfile();
    }

    // Update 2nd Purchaser Profile section
    update2ndPurchaserProfile() {
        const profile = this.calculate2ndPurchaserProfile();
        this.data.secondPurchaserProfile = profile;

        // Count
        const countEl = document.getElementById('secPurchCount');
        if (countEl) countEl.textContent = this.formatNumber(profile.count);

        // Top Persona
        const topPersona = Object.entries(profile.personas)
            .sort((a, b) => b[1] - a[1])[0];
        const topPersonaEl = document.getElementById('secPurchTopPersona');
        const topPersonaPctEl = document.getElementById('secPurchTopPersonaPct');
        if (topPersonaEl && topPersona) {
            const personaNames = {
                'gen_z': 'Gen Z',
                'millennial': 'Millennial',
                'gen_x': 'Gen X',
                'boomer': 'Boomer',
                'unknown': 'Unknown'
            };
            topPersonaEl.textContent = personaNames[topPersona[0]] || topPersona[0];
            if (topPersonaPctEl && profile.count > 0) {
                const pct = (topPersona[1] / profile.count * 100).toFixed(0);
                topPersonaPctEl.textContent = `${pct}%`;
            }
        } else if (topPersonaEl) {
            topPersonaEl.textContent = '-';
        }

        // Average Age
        const avgAgeEl = document.getElementById('secPurchAvgAge');
        if (avgAgeEl) {
            avgAgeEl.textContent = profile.avgAge ? profile.avgAge.toFixed(0) : '-';
        }

        // Device Split (show dominant device)
        const deviceEl = document.getElementById('secPurchDevice');
        if (deviceEl) {
            const mobileCount = profile.devices['Mobile'] || 0;
            const desktopCount = profile.devices['Desktop'] || 0;
            const total = mobileCount + desktopCount;
            if (total > 0) {
                const mobilePct = (mobileCount / total * 100).toFixed(0);
                deviceEl.textContent = `${mobilePct}% Mobile`;
            } else {
                deviceEl.textContent = '-';
            }
        }

        // Top Source
        const topSource = Object.entries(profile.sources)
            .sort((a, b) => b[1] - a[1])[0];
        const topSourceEl = document.getElementById('secPurchTopSource');
        if (topSourceEl) {
            topSourceEl.textContent = topSource ? topSource[0] : '-';
        }

        // Average Days
        const avgDaysEl = document.getElementById('secPurchAvgDays');
        if (avgDaysEl) {
            avgDaysEl.textContent = profile.avgDaysBetween > 0 ? profile.avgDaysBetween.toFixed(0) : '-';
        }

        // Update chart
        this.update2ndPurchaserChart(profile);

        // Update demographics table
        this.update2ndPurchaserTable(profile);
    }

    update2ndPurchaserChart(profile) {
        if (!this.charts.secPurchPersona) return;

        const personaNames = {
            'gen_z': 'Gen Z',
            'millennial': 'Millennial',
            'gen_x': 'Gen X',
            'boomer': 'Boomer',
            'unknown': 'Unknown'
        };

        const personaColors = {
            'gen_z': '#f97316',
            'millennial': '#3b82f6',
            'gen_x': '#8b5cf6',
            'boomer': '#10b981',
            'unknown': '#6b7280'
        };

        const sortedPersonas = Object.entries(profile.personas)
            .sort((a, b) => b[1] - a[1]);

        this.charts.secPurchPersona.data.labels = sortedPersonas.map(([key]) =>
            personaNames[key] || key
        );
        this.charts.secPurchPersona.data.datasets[0].data = sortedPersonas.map(([, count]) => count);
        this.charts.secPurchPersona.data.datasets[0].backgroundColor = sortedPersonas.map(([key]) =>
            personaColors[key] || '#6b7280'
        );
        this.charts.secPurchPersona.update();
    }

    update2ndPurchaserTable(profile) {
        const tableEl = document.getElementById('secPurchDemoTable');
        if (!tableEl) return;

        const rows = [];
        const total = profile.count || 1;

        // Gender rows
        Object.entries(profile.genders)
            .filter(([g]) => g !== 'Unknown')
            .sort((a, b) => b[1] - a[1])
            .forEach(([gender, count]) => {
                rows.push({
                    label: `Gender: ${gender}`,
                    count,
                    pct: (count / total * 100).toFixed(1)
                });
            });

        // Age group rows
        const ageOrder = ['18-24', '25-34', '35-44', '45-54', '55+', 'Unknown'];
        ageOrder.forEach(age => {
            const count = profile.ageGroups[age];
            if (count && count > 0) {
                rows.push({
                    label: `Age: ${age}`,
                    count,
                    pct: (count / total * 100).toFixed(1)
                });
            }
        });

        // Source rows (top 3)
        Object.entries(profile.sources)
            .filter(([s]) => s !== 'Unknown')
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .forEach(([source, count]) => {
                rows.push({
                    label: `Source: ${source}`,
                    count,
                    pct: (count / total * 100).toFixed(1)
                });
            });

        if (rows.length === 0) {
            tableEl.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-muted-foreground">No data available</td></tr>';
            return;
        }

        tableEl.innerHTML = rows.map(r => `
            <tr class="border-b border-foreground/10">
                <td class="py-2 text-foreground">${r.label}</td>
                <td class="py-2 text-right text-foreground">${this.formatNumber(r.count)}</td>
                <td class="py-2 text-right text-muted-foreground">${r.pct}%</td>
            </tr>
        `).join('');
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
        // Note: Time to 1st Purchase is now updated in updateWooCommerceSection()
        document.getElementById('metricWeekNew').textContent = this.formatNumber(analytics.thisWeekNew || 0);

        const weekChange = analytics.weekOverWeekChange || 0;
        const trendColor = weekChange > 0 ? 'text-success' : weekChange < 0 ? 'text-danger' : 'text-muted-foreground';
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
                const cvrColor = parseFloat(sourceCvr) > parseFloat(cvr) ? 'text-success' : 'text-muted-foreground';
                return `
                    <tr class="border-b border-foreground">
                        <td class="py-2 text-foreground">${this.escapeHtml(name)}</td>
                        <td class="py-2 text-right text-foreground">${this.formatNumber(data.leads)}</td>
                        <td class="py-2 text-right text-success">${this.formatNumber(data.customers)}</td>
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
                const cvrColor = parseFloat(cohort.cvr) > parseFloat(cvr) ? 'text-success' : 'text-muted-foreground';

                return `
                    <tr class="border-b border-foreground">
                        <td class="py-2 text-foreground">${weekLabel}</td>
                        <td class="py-2 text-right text-foreground">${this.formatNumber(cohort.leads)}</td>
                        <td class="py-2 text-right text-success">${this.formatNumber(cohort.customers)}</td>
                        <td class="py-2 text-right ${cvrColor} font-medium">${cohort.cvr}%</td>
                        <td class="py-2">
                            <div class="h-2 bg-muted rounded-full overflow-hidden">
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
                    <div class="border border-foreground rounded-lg p-3">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="w-3 h-3 rounded-full" style="background: ${persona.color}"></span>
                            <span class="font-medium text-sm" style="color: ${persona.color}">${persona.name}</span>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            ${topSources.map(([source, data]) => {
                                const pct = total > 0 ? ((data.total / total) * 100).toFixed(0) : 0;
                                return `<span class="text-xs bg-muted text-foreground px-2 py-1 rounded">${source}: ${pct}%</span>`;
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
                    <div class="border border-foreground rounded-lg p-4 text-center border-l-4" style="border-left-color: ${s.color}">
                        <div class="text-2xl font-bold" style="color: ${s.color}">${this.formatNumber(s.count)}</div>
                        <div class="text-foreground text-sm font-medium">${s.name}</div>
                        <div class="text-muted-foreground text-xs">${s.desc}</div>
                        <div class="text-muted-foreground text-xs mt-1">${pct}%</div>
                    </div>
                `;
            }).join('');
        }

        // Update WooCommerce section
        this.updateWooCommerceSection();
    }

    updateWooCommerceSection() {
        const wc = this.data.woocommerce;
        if (!wc || !wc.metrics) return;

        const m = wc.metrics;

        // Update metric cards
        const timeToFirstEl = document.getElementById('wcTimeToFirst');
        if (timeToFirstEl) {
            timeToFirstEl.textContent = m.timeToFirstPurchase?.avg != null
                ? m.timeToFirstPurchase.avg.toFixed(1)
                : '-';
        }

        const timeFirstToSecondEl = document.getElementById('wcTimeFirstToSecond');
        if (timeFirstToSecondEl) {
            timeFirstToSecondEl.textContent = m.timeFirstToSecond?.avg != null
                ? m.timeFirstToSecond.avg.toFixed(1)
                : '-';
        }

        const aov2ndEl = document.getElementById('wcAOV2nd');
        if (aov2ndEl) {
            aov2ndEl.textContent = m.aovSecondPurchase?.avg != null
                ? this.formatNumber(Math.round(m.aovSecondPurchase.avg))
                : '-';
        }

        const avgLTVEl = document.getElementById('wcAvgLTV');
        if (avgLTVEl) {
            avgLTVEl.textContent = m.ltv?.avg != null
                ? this.formatNumber(Math.round(m.ltv.avg))
                : '-';
        }

        // Update Revenue Chart (New vs Returning)
        if (this.charts.wcRevenue) {
            this.charts.wcRevenue.data.datasets[0].data = [
                m.revenueNew || 0,
                m.revenueReturning || 0
            ];
            this.charts.wcRevenue.update();
        }

        // Update LTV Distribution Chart
        if (this.charts.wcLTV && m.ltv?.data) {
            const ltvBuckets = { '<200K': 0, '200K-500K': 0, '500K-1M': 0, '1M-2M': 0, '2M+': 0 };
            m.ltv.data.forEach(ltv => {
                if (ltv < 200000) ltvBuckets['<200K']++;
                else if (ltv < 500000) ltvBuckets['200K-500K']++;
                else if (ltv < 1000000) ltvBuckets['500K-1M']++;
                else if (ltv < 2000000) ltvBuckets['1M-2M']++;
                else ltvBuckets['2M+']++;
            });
            this.charts.wcLTV.data.datasets[0].data = Object.values(ltvBuckets);
            this.charts.wcLTV.update();
        }

        // Update Purchase Funnel
        const funnelEl = document.getElementById('wcPurchaseFunnel');
        if (funnelEl && m.funnel) {
            const funnel = m.funnel;
            const maxCount = Math.max(funnel.subscribers, 1);

            const funnelSteps = [
                { label: 'Subscribers', count: funnel.subscribers, color: '#6b7280' },
                { label: '1st Purchase', count: funnel.firstPurchase, color: '#B05B36' },
                { label: '2nd Purchase', count: funnel.secondPurchase, color: '#D4927A' },
                { label: '3rd Purchase', count: funnel.thirdPurchase, color: '#10B981' },
                { label: '4+ Purchases', count: funnel.fourPlus, color: '#059669' }
            ];

            funnelEl.innerHTML = funnelSteps.map((step, i) => {
                const pct = maxCount > 0 ? ((step.count / maxCount) * 100).toFixed(1) : 0;
                const width = Math.max(20, (step.count / maxCount) * 100);
                const dropOff = i > 0 ? ((funnelSteps[i-1].count - step.count) / funnelSteps[i-1].count * 100).toFixed(0) : null;

                return `
                    <div class="text-center">
                        <div class="text-2xl font-bold" style="color: ${step.color}">${this.formatNumber(step.count)}</div>
                        <div class="text-xs text-muted-foreground">${step.label}</div>
                        <div class="h-2 bg-muted rounded-full mt-2 mx-auto" style="width: ${width}%">
                            <div class="h-full rounded-full" style="width: 100%; background: ${step.color}"></div>
                        </div>
                        ${dropOff !== null ? `<div class="text-xs text-danger mt-1">-${dropOff}%</div>` : '<div class="text-xs mt-1">&nbsp;</div>'}
                    </div>
                `;
            }).join('');
        }

        // Update SKU Breakdowns
        const escapeHtml = (str) => this.escapeHtml(str);
        ['1st', '2nd', '3rd'].forEach((num) => {
            const skuEl = document.getElementById(`wcSKU${num}`);
            const skuData = m[`sku${num}`];
            if (skuEl && skuData) {
                if (skuData.length === 0) {
                    skuEl.innerHTML = '<div class="text-muted-foreground text-sm">No data</div>';
                } else {
                    const maxQty = Math.max(...skuData.map(s => s.count), 1);
                    skuEl.innerHTML = skuData.map(item => {
                        const barWidth = (item.count / maxQty) * 100;
                        const safeName = escapeHtml(item.name);
                        return `
                            <div class="flex items-center gap-2">
                                <div class="flex-1 text-sm text-foreground truncate" title="${safeName}">${safeName}</div>
                                <div class="w-20 h-2 bg-muted rounded-full overflow-hidden">
                                    <div class="h-full bg-primary rounded-full" style="width: ${barWidth}%"></div>
                                </div>
                                <div class="w-10 text-right text-xs text-muted-foreground">${item.count}</div>
                            </div>
                        `;
                    }).join('');
                }
            }
        });

        // Update Top Customers Table
        const topCustomersEl = document.getElementById('wcTopCustomersTable');
        if (topCustomersEl && m.topCustomers) {
            if (m.topCustomers.length === 0) {
                topCustomersEl.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-muted-foreground">No customer data</td></tr>';
            } else {
                topCustomersEl.innerHTML = m.topCustomers.map(c => `
                    <tr class="border-b border-foreground">
                        <td class="py-2 text-foreground">${this.escapeHtml(c.email)}</td>
                        <td class="py-2 text-right text-foreground">${c.orderCount}</td>
                        <td class="py-2 text-right text-success font-medium">${this.formatNumber(Math.round(c.ltv))}</td>
                        <td class="py-2 text-right text-foreground">${this.formatNumber(Math.round(c.aov))}</td>
                        <td class="py-2 text-right text-muted-foreground">${c.daysToFirst != null ? c.daysToFirst.toFixed(0) : '-'}</td>
                    </tr>
                `).join('');
            }
        }
    }

    updateOverviewTab() {
        const { contacts, lists, tags, categorizationStats } = this.data;

        // Calculate total conversions
        const totalConverted = categorizationStats?.totalConverted || 0;
        const overallCVR = contacts.total > 0 ? (totalConverted / contacts.total * 100).toFixed(2) : 0;

        // Key metrics (use filtered subscribers for loaded count)
        const filteredSubsCount = this.getFilteredSubscribers().length;
        document.getElementById('metricTotal').textContent = this.formatNumber(contacts.total);
        document.getElementById('metricTotalTrend').textContent = `${this.formatNumber(filteredSubsCount)} in range`;
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
            <div class="border border-foreground rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-muted-foreground text-sm">DOB Data</span>
                    <span class="badge ${dobPct > 70 ? 'badge-green' : dobPct > 40 ? 'badge-yellow' : 'badge-red'}">${dobPct}%</span>
                </div>
                <div class="h-2 bg-muted rounded-full overflow-hidden">
                    <div class="h-full bg-primary rounded-full" style="width: ${dobPct}%"></div>
                </div>
                <div class="text-muted-foreground text-xs mt-2">${this.formatNumber(stats.withDOB || 0)} / ${this.formatNumber(total)}</div>
            </div>
            <div class="border border-foreground rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-muted-foreground text-sm">Device Data</span>
                    <span class="badge ${devicePct > 70 ? 'badge-green' : devicePct > 40 ? 'badge-yellow' : 'badge-red'}">${devicePct}%</span>
                </div>
                <div class="h-2 bg-muted rounded-full overflow-hidden">
                    <div class="h-full bg-secondary rounded-full" style="width: ${devicePct}%"></div>
                </div>
                <div class="text-muted-foreground text-xs mt-2">${this.formatNumber(stats.withDevice || 0)} / ${this.formatNumber(total)}</div>
            </div>
            <div class="border border-foreground rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-muted-foreground text-sm">Subscribed</span>
                    <span class="badge ${subscribedPct > 80 ? 'badge-green' : subscribedPct > 50 ? 'badge-yellow' : 'badge-red'}">${subscribedPct}%</span>
                </div>
                <div class="h-2 bg-muted rounded-full overflow-hidden">
                    <div class="h-full bg-success rounded-full" style="width: ${subscribedPct}%"></div>
                </div>
                <div class="text-muted-foreground text-xs mt-2">${this.formatNumber(this.data.contacts.subscribed)} / ${this.formatNumber(this.data.contacts.total)}</div>
            </div>
            <div class="border border-foreground rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-muted-foreground text-sm">Tagged</span>
                    <span class="badge ${taggedPct > 50 ? 'badge-green' : taggedPct > 20 ? 'badge-yellow' : 'badge-red'}">${taggedPct}%</span>
                </div>
                <div class="h-2 bg-muted rounded-full overflow-hidden">
                    <div class="h-full bg-accent rounded-full" style="width: ${Math.min(taggedPct, 100)}%"></div>
                </div>
                <div class="text-muted-foreground text-xs mt-2">${this.formatNumber(taggedCount)} tagged</div>
            </div>
        `;
    }

    updateTopLists() {
        const container = document.getElementById('topListsContainer');
        const sortedLists = [...this.data.lists]
            .sort((a, b) => (b.subscribers_count || 0) - (a.subscribers_count || 0))
            .slice(0, 5);

        if (sortedLists.length === 0) {
            container.innerHTML = '<p class="text-muted-foreground text-center py-4">No lists found</p>';
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
                            <span class="font-medium text-foreground text-sm">${this.escapeHtml(list.title)}</span>
                            <span class="text-muted-foreground text-sm">${this.formatNumber(count)}</span>
                        </div>
                        <div class="h-2 bg-muted rounded-full overflow-hidden">
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
            container.innerHTML = '<p class="text-muted-foreground text-center py-4">No tags found</p>';
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
                            <span class="font-medium text-foreground text-sm">${this.escapeHtml(tag.title)}</span>
                            <span class="text-muted-foreground text-sm">${this.formatNumber(count)}</span>
                        </div>
                        <div class="h-2 bg-muted rounded-full overflow-hidden">
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
        const dataCompletenessEl = document.getElementById('dataCompleteness');
        if (dataCompletenessEl) {
            dataCompletenessEl.textContent = `${this.formatNumber(completeData)} (${(completeData / (stats.totalProcessed || 1) * 100).toFixed(1)}%)`;
        }

        // Persona table
        const tableBody = document.getElementById('personaTable');
        const personaArray = Object.entries(personas)
            .map(([key, p]) => ({ key, ...p }))
            .sort((a, b) => b.count - a.count);

        // Calculate overall CVR for comparison
        const totalConverted = personaArray.reduce((sum, p) => sum + (p.converted || 0), 0);
        const overallCVR = total > 0 ? (totalConverted / total * 100) : 0;

        if (tableBody) {
            tableBody.innerHTML = personaArray.map(p => {
                const pct = (p.count / total * 100).toFixed(1);
                const cvr = p.count > 0 ? (p.converted / p.count * 100).toFixed(2) : 0;
                const cvrValue = parseFloat(cvr);
                const priorityColor = p.priority === 'High' ? 'badge-green' : p.priority === 'Medium' ? 'badge-yellow' : 'badge-gray';
                const cvrColor = cvrValue > overallCVR ? 'text-success' : cvrValue > 0 ? 'text-yellow-400' : 'text-muted-foreground';

                return `
                    <tr class="border-b border-foreground hover:border border-foreground/50">
                        <td class="py-3">
                            <span class="flex items-center gap-2">
                                <span class="w-3 h-3 rounded-full" style="background: ${p.color}"></span>
                                <span class="font-medium" style="color: ${p.color}">${p.name}</span>
                            </span>
                        </td>
                        <td class="text-right py-3 text-foreground font-medium">${this.formatNumber(p.count)}</td>
                        <td class="text-right py-3 text-muted-foreground">${pct}%</td>
                        <td class="py-3">
                            <div class="h-2 bg-muted rounded-full overflow-hidden">
                                <div class="h-full rounded-full" style="width: ${pct}%; background: ${p.color}"></div>
                            </div>
                        </td>
                        <td class="text-right py-3 text-foreground">${this.formatNumber(p.converted || 0)}</td>
                        <td class="text-right py-3 ${cvrColor} font-medium">${cvr}%</td>
                        <td class="text-center py-3">
                            <span class="badge ${priorityColor}">${p.priority}</span>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // Persona cards - with dynamic best channel
        const cardsContainer = document.getElementById('personaCards');
        const bestChannelData = this.data.growthAnalytics?.bestChannelByPersona || {};

        if (cardsContainer) {
        cardsContainer.innerHTML = personaArray.filter(p => p.count > 0).map(p => {
            const pct = (p.count / total * 100).toFixed(1);
            const cvr = p.count > 0 ? (p.converted / p.count * 100).toFixed(2) : 0;
            const cvrValue = parseFloat(cvr);
            const cvrColor = cvrValue > overallCVR ? 'text-success' : cvrValue > 0 ? 'text-yellow-400' : 'text-muted-foreground';
            const cvrBgColor = cvrValue > overallCVR ? 'bg-success/20' : cvrValue > 0 ? 'bg-warning/20' : 'border border-foreground';

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
                            <p class="text-muted-foreground text-xs mt-1">${p.description}</p>
                        </div>
                        <div class="text-right">
                            <div class="text-foreground font-bold text-xl">${this.formatNumber(p.count)}</div>
                            <div class="text-muted-foreground text-xs">${pct}%</div>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-2 mb-3">
                        <div class="border border-foreground rounded p-2 text-center">
                            <div class="text-muted-foreground text-xs">Subscribed</div>
                            <div class="text-foreground font-medium">${this.formatNumber(p.subscribed || 0)}</div>
                        </div>
                        <div class="${cvrBgColor} rounded p-2 text-center">
                            <div class="text-muted-foreground text-xs">CVR</div>
                            <div class="${cvrColor} font-bold">${cvr}%</div>
                        </div>
                    </div>
                    <div class="space-y-2 text-sm border-t border-gray-700 pt-3">
                        <div class="flex justify-between">
                            <span class="text-muted-foreground">Converted:</span>
                            <span class="text-success font-medium">${this.formatNumber(p.converted || 0)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-muted-foreground">Best Channel:</span>
                            <span class="text-foreground flex items-center gap-1">
                                ${dynamicBestChannel}
                                ${isDataDriven ? `<span class="text-xs text-success" title="Based on ${channelCVR}% CVR">(${channelCVR}%)</span>` : '<span class="text-xs text-muted-foreground">(default)</span>'}
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-muted-foreground">Offer:</span>
                            <span class="text-foreground">${p.recommendedOffer}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        }

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

        if (targetingTable) {
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
                const cvrVsAvgColor = cvrVsAvg > 0 ? 'text-success' : cvrVsAvg < 0 ? 'text-danger' : 'text-muted-foreground';
                const cvrVsAvgSign = cvrVsAvg > 0 ? '+' : '';
                const sampleSize = stats.sampleSize || 0;

                // Dynamic nurture strategy
                const nurture = stats.nurtureStrategy || { priority: p.priority, reason: p.nurturePriority, description: '' };
                const priorityColor = nurture.priority === 'High' ? 'text-danger' :
                                      nurture.priority === 'Medium' ? 'text-yellow-400' :
                                      nurture.priority === 'Low' ? 'text-success' : 'text-muted-foreground';

                return `
                    <tr class="border-b border-foreground">
                        <td class="py-3">
                            <span class="flex items-center gap-2">
                                <span class="w-3 h-3 rounded-full" style="background: ${p.color}"></span>
                                <span style="color: ${p.color}">${p.name}</span>
                            </span>
                        </td>
                        <td class="py-3 text-foreground">
                            ${dynamicBestChannel}
                            ${isDataDriven ? `<span class="text-xs text-success ml-1">(${channelCVR}%)</span>` : ''}
                        </td>
                        <td class="py-3 text-foreground">
                            <span class="text-foreground">${topSourcePct}%</span>
                            <span class="text-muted-foreground text-xs ml-1">${topSource}</span>
                        </td>
                        <td class="py-3 ${cvrVsAvgColor} font-medium">
                            ${cvrVsAvgSign}${cvrVsAvg}%
                        </td>
                        <td class="py-3">
                            <span class="${priorityColor} font-medium">${nurture.priority}</span>
                            <span class="text-muted-foreground text-xs ml-1">${nurture.description}</span>
                        </td>
                        <td class="py-3 text-muted-foreground text-xs">
                            ${sampleSize} conv
                        </td>
                    </tr>
                `;
            }).join('');
        }

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
            const trendColor = p.trend > 0 ? 'text-success' : p.trend < 0 ? 'text-danger' : 'text-muted-foreground';
            const cvrColor = p.cvr > overallCVR ? 'text-success' : p.cvr > 0 ? 'text-yellow-400' : 'text-muted-foreground';
            const sparklineId = `sparkline-${p.key}`;

            return `
                <div class="card p-4 persona-card" style="border-left-color: ${p.color}">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h4 class="font-medium" style="color: ${p.color}">${p.name}</h4>
                            <div class="text-foreground font-bold text-xl mt-1">${this.formatNumber(p.currentTotal)}</div>
                        </div>
                        <div class="text-right">
                            <div class="text-xs text-muted-foreground">Last ${this.growthPeriod} days</div>
                            <div class="text-success font-medium">+${this.formatNumber(p.totalNew)}</div>
                        </div>
                    </div>
                    <div class="sparkline-container mb-3">
                        <canvas id="${sparklineId}" height="40"></canvas>
                    </div>
                    <div class="grid grid-cols-4 gap-2 text-xs">
                        <div class="border border-foreground rounded p-2 text-center">
                            <div class="text-muted-foreground">7d New</div>
                            <div class="text-foreground font-medium">+${p.last7}</div>
                        </div>
                        <div class="border border-foreground rounded p-2 text-center">
                            <div class="text-muted-foreground">Avg/day</div>
                            <div class="text-foreground font-medium">${p.avgDaily}</div>
                        </div>
                        <div class="border border-foreground rounded p-2 text-center">
                            <div class="text-muted-foreground">Trend</div>
                            <div class="${trendColor} font-medium">
                                <i class="fas ${trendIcon} text-xs mr-1"></i>${Math.abs(p.trend)}%
                            </div>
                        </div>
                        <div class="border border-foreground rounded p-2 text-center">
                            <div class="text-muted-foreground">CVR</div>
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
        const total = this.getFilteredSubscribers().length || 1;

        // Summary cards - with null checks
        const astroWithDOBEl = document.getElementById('astroWithDOB');
        const astroWithDOBPctEl = document.getElementById('astroWithDOBPct');
        if (astroWithDOBEl) astroWithDOBEl.textContent = this.formatNumber(stats.withDOB || 0);
        if (astroWithDOBPctEl) astroWithDOBPctEl.textContent = `${((stats.withDOB || 0) / total * 100).toFixed(1)}% of contacts`;

        const astroWithBirthtimeEl = document.getElementById('astroWithBirthtime');
        const astroWithBirthtimePctEl = document.getElementById('astroWithBirthtimePct');
        if (astroWithBirthtimeEl) astroWithBirthtimeEl.textContent = this.formatNumber(stats.withBirthtime || 0);
        if (astroWithBirthtimePctEl) astroWithBirthtimePctEl.textContent = `${((stats.withBirthtime || 0) / total * 100).toFixed(1)}% of contacts`;

        // Top zodiac sign
        const zodiacSigns = stats.zodiacSigns || {};
        const sortedZodiac = Object.entries(zodiacSigns)
            .filter(([, data]) => data.total > 0)
            .sort((a, b) => b[1].total - a[1].total);

        if (sortedZodiac.length > 0) {
            const [topSign, topData] = sortedZodiac[0];
            const zodiacInfo = ZODIAC_SIGNS[topSign];
            const astroTopZodiacEl = document.getElementById('astroTopZodiac');
            const astroTopZodiacPctEl = document.getElementById('astroTopZodiacPct');
            if (astroTopZodiacEl && zodiacInfo) astroTopZodiacEl.textContent = `${zodiacInfo.symbol} ${topSign}`;
            if (astroTopZodiacPctEl) astroTopZodiacPctEl.textContent = `${this.formatNumber(topData.total)} contacts`;
        }

        // Best converting zodiac sign
        const zodiacCVR = stats.zodiacCVR || {};
        const sortedByCVR = Object.entries(zodiacCVR)
            .filter(([sign]) => (zodiacSigns[sign]?.total || 0) >= 10) // Min 10 contacts
            .sort((a, b) => b[1] - a[1]);

        if (sortedByCVR.length > 0) {
            const [bestSign, bestCVR] = sortedByCVR[0];
            const zodiacInfo = ZODIAC_SIGNS[bestSign];
            const astroBestCVREl = document.getElementById('astroBestCVR');
            const astroBestCVRPctEl = document.getElementById('astroBestCVRPct');
            if (astroBestCVREl && zodiacInfo) astroBestCVREl.textContent = `${zodiacInfo.symbol} ${bestSign}`;
            if (astroBestCVRPctEl) astroBestCVRPctEl.textContent = `${bestCVR.toFixed(2)}% CVR`;
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
                const cvrColor = cvr > overallCVR ? 'text-success' : cvr > 0 ? 'text-yellow-400' : 'text-muted-foreground';
                const topGender = data.male > data.female ? 'Male' : data.female > data.male ? 'Female' : 'Even';
                const topGenderColor = topGender === 'Male' ? 'text-secondary' : topGender === 'Female' ? 'text-primary' : 'text-muted-foreground';
                const elementColor = {
                    'Kim': 'text-yellow-400',
                    'Mộc': 'text-success',
                    'Thủy': 'text-secondary',
                    'Hỏa': 'text-danger',
                    'Thổ': 'text-purple-400'
                }[zodiacInfo.element];

                return `
                    <tr class="border-b border-foreground">
                        <td class="py-3">
                            <span style="color: ${zodiacInfo.color}" class="font-medium">${zodiacInfo.symbol} ${sign}</span>
                        </td>
                        <td class="text-right py-3 text-foreground">${this.formatNumber(data.total)}</td>
                        <td class="text-right py-3 text-muted-foreground">${pct}%</td>
                        <td class="text-right py-3 text-success">${this.formatNumber(data.customers)}</td>
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
                let bestGenderColor = 'text-muted-foreground';
                if (maleData.total >= 10 && femaleData.total >= 10) {
                    if (maleCVR > femaleCVR) {
                        bestGender = 'Male';
                        bestGenderColor = 'text-secondary';
                    } else if (femaleCVR > maleCVR) {
                        bestGender = 'Female';
                        bestGenderColor = 'text-primary';
                    } else {
                        bestGender = 'Equal';
                        bestGenderColor = 'text-muted-foreground';
                    }
                } else if (maleData.total >= 10) {
                    bestGender = 'Male (only)';
                    bestGenderColor = 'text-secondary';
                } else if (femaleData.total >= 10) {
                    bestGender = 'Female (only)';
                    bestGenderColor = 'text-primary';
                }

                const maleCVRColor = maleCVR > femaleCVR ? 'text-success' : 'text-muted-foreground';
                const femaleCVRColor = femaleCVR > maleCVR ? 'text-success' : 'text-muted-foreground';

                return `
                    <tr class="border-b border-foreground">
                        <td class="py-3">
                            <span class="flex items-center gap-2">
                                <span class="w-3 h-3 rounded-full" style="background: ${persona.color}"></span>
                                <span style="color: ${persona.color}" class="font-medium">${persona.name}</span>
                            </span>
                        </td>
                        <td class="text-right py-3 text-secondary">${this.formatNumber(maleData.total)}</td>
                        <td class="text-right py-3 text-primary">${this.formatNumber(femaleData.total)}</td>
                        <td class="text-right py-3 text-muted-foreground">${this.formatNumber(unknownData.total)}</td>
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

    formatCurrency(num) {
        if (typeof num !== 'number' || isNaN(num)) return '-';
        // Format in VND with K/M suffix
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
        return Math.round(num).toLocaleString();
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

function refreshData(forceFullSync = false) {
    if (dashboard) {
        dashboard.refreshData(forceFullSync);
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

// ==================== GLOBAL DATE FILTER FUNCTIONS ====================

function setDateRange(preset) {
    if (!dashboard) return;

    const today = new Date();
    let startDate = null, endDate = null;

    // Update active button styling
    document.querySelectorAll('.date-preset-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.preset === preset);
    });

    switch (preset) {
        case '7d':
            startDate = new Date(today);
            startDate.setDate(startDate.getDate() - 6);
            endDate = today;
            break;
        case '30d':
            startDate = new Date(today);
            startDate.setDate(startDate.getDate() - 29);
            endDate = today;
            break;
        case '90d':
            startDate = new Date(today);
            startDate.setDate(startDate.getDate() - 89);
            endDate = today;
            break;
        case 'ytd':
            startDate = new Date(today.getFullYear(), 0, 1);
            endDate = today;
            break;
        case 'custom':
            const startInput = document.getElementById('dateFilterStart');
            const endInput = document.getElementById('dateFilterEnd');
            startDate = startInput?.value ? new Date(startInput.value) : null;
            endDate = endInput?.value ? new Date(endInput.value) : today;
            break;
        case 'all':
        default:
            startDate = null;
            endDate = null;
            break;
    }

    // Update date inputs to reflect selection
    const startInput = document.getElementById('dateFilterStart');
    const endInput = document.getElementById('dateFilterEnd');
    if (startInput) startInput.value = startDate ? startDate.toISOString().split('T')[0] : '';
    if (endInput) endInput.value = endDate ? endDate.toISOString().split('T')[0] : '';

    // Store filter state in dashboard
    dashboard.dateFilter = {
        startDate: startDate ? startDate.toISOString().split('T')[0] : null,
        endDate: endDate ? endDate.toISOString().split('T')[0] : null,
        preset: preset
    };

    // Update filter indicator
    updateDateFilterIndicator(preset, startDate, endDate);
}

function applyDateFilter() {
    if (!dashboard) return;

    const btn = document.querySelector('button[onclick="applyDateFilter()"]');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Applying...';
        btn.disabled = true;
    }

    setTimeout(() => {
        try {
            // Recalculate ALL analytics with new date filter
            dashboard.categorizePersonas();
            dashboard.calculatePersonaGrowth();
            dashboard.calculateGrowthAnalytics();
            dashboard.calculateWooCommerceMetrics();
            dashboard.updateDashboard();

            // Show success feedback
            if (btn) {
                btn.innerHTML = '<i class="fas fa-check mr-1"></i>Applied!';
                setTimeout(() => {
                    btn.innerHTML = '<i class="fas fa-check mr-1"></i>Apply';
                    btn.disabled = false;
                }, 1000);
            }
        } catch (err) {
            console.error('Error applying date filter:', err);
            if (btn) {
                btn.innerHTML = '<i class="fas fa-times mr-1"></i>Error';
                setTimeout(() => {
                    btn.innerHTML = '<i class="fas fa-check mr-1"></i>Apply';
                    btn.disabled = false;
                }, 2000);
            }
        }
    }, 50);
}

// ==================== CONDITIONAL FILTER FUNCTIONS (Multi-condition AND/OR) ====================

let conditionCounter = 0;

function setFilterMode(mode) {
    if (!dashboard) return;
    dashboard.conditionalFilter.mode = mode;

    // Update UI buttons
    const andBtn = document.getElementById('filterModeAnd');
    const orBtn = document.getElementById('filterModeOr');

    if (mode === 'AND') {
        andBtn?.classList.add('bg-primary', 'text-white');
        andBtn?.classList.remove('text-muted-foreground');
        orBtn?.classList.remove('bg-primary', 'text-white');
        orBtn?.classList.add('text-muted-foreground');
    } else {
        orBtn?.classList.add('bg-primary', 'text-white');
        orBtn?.classList.remove('text-muted-foreground');
        andBtn?.classList.remove('bg-primary', 'text-white');
        andBtn?.classList.add('text-muted-foreground');
    }

    // Update connector labels
    document.querySelectorAll('.condition-connector').forEach(el => {
        el.textContent = mode;
    });

    // Re-apply filter if conditions exist
    if (dashboard.conditionalFilter.conditions.length > 0) {
        applyConditionalFilter();
    }
}

function addFilterCondition() {
    const container = document.getElementById('filterConditionsContainer');
    const template = document.getElementById('filterConditionTemplate');
    if (!container || !template) return;

    const conditionId = `condition-${++conditionCounter}`;
    const clone = template.content.cloneNode(true);
    const conditionEl = clone.querySelector('.filter-condition');
    conditionEl.dataset.conditionId = conditionId;

    // Show connector for non-first conditions
    if (container.children.length > 0) {
        const connector = conditionEl.querySelector('.condition-connector');
        connector?.classList.remove('hidden');
        connector.textContent = dashboard?.conditionalFilter?.mode || 'AND';
    }

    container.appendChild(clone);

    // Show Apply button
    document.getElementById('conditionalApplyBtn')?.classList.remove('hidden');
}

function removeFilterCondition(btn) {
    const conditionEl = btn.closest('.filter-condition');
    if (!conditionEl) return;

    conditionEl.remove();

    // Update connectors - hide first condition's connector
    const container = document.getElementById('filterConditionsContainer');
    const conditions = container?.querySelectorAll('.filter-condition');
    if (conditions && conditions.length > 0) {
        conditions[0].querySelector('.condition-connector')?.classList.add('hidden');
    }

    // Hide Apply button if no conditions
    if (!conditions || conditions.length === 0) {
        document.getElementById('conditionalApplyBtn')?.classList.add('hidden');
        clearConditionalFilter();
    } else {
        applyConditionalFilter();
    }
}

function toggleConditionInputs(selectEl) {
    const conditionEl = selectEl.closest('.filter-condition');
    const inputsContainer = conditionEl?.querySelector('.condition-inputs');
    if (!inputsContainer) return;

    const filterType = selectEl.value;
    inputsContainer.innerHTML = '';

    if (!filterType) return;

    // Create inputs based on filter type
    const inputClass = 'px-3 py-1.5 bg-background rounded text-sm border border-foreground/20 focus:border-primary outline-none';

    if (filterType === 'subscriberDateRange') {
        inputsContainer.innerHTML = `
            <input type="date" class="condition-start-date ${inputClass}">
            <span class="text-muted-foreground text-sm">to</span>
            <input type="date" class="condition-end-date ${inputClass}">
        `;
    } else if (filterType === 'firstPurchaseProduct') {
        inputsContainer.innerHTML = `
            <select class="condition-product-match-type ${inputClass}">
                <option value="name">Name</option>
                <option value="id">ID</option>
            </select>
            <input type="text" class="condition-product-value ${inputClass} w-40" placeholder="Product name or ID...">
        `;
    } else if (filterType === 'firstPurchaseValue') {
        inputsContainer.innerHTML = `
            <select class="condition-operator ${inputClass}">
                <option value="gte">>=</option>
                <option value="lte"><=</option>
                <option value="eq">=</option>
                <option value="gt">></option>
                <option value="lt"><</option>
            </select>
            <input type="number" class="condition-amount ${inputClass} w-28" placeholder="Amount">
        `;
    } else if (filterType === 'source') {
        inputsContainer.innerHTML = `
            <select class="condition-source ${inputClass}">
                <option value="">Select...</option>
                <option value="Facebook Ads">Facebook Ads</option>
                <option value="Google Ads">Google Ads</option>
                <option value="Facebook">Facebook</option>
                <option value="Google">Google</option>
                <option value="TikTok">TikTok</option>
                <option value="Zalo">Zalo</option>
                <option value="YouTube">YouTube</option>
                <option value="Instagram">Instagram</option>
                <option value="Email">Email</option>
                <option value="Organic">Organic</option>
                <option value="UTM Tagged">UTM Tagged</option>
                <option value="Other Referral">Other Referral</option>
                <option value="Unknown">Unknown</option>
            </select>
        `;
    } else if (filterType === 'gender') {
        inputsContainer.innerHTML = `
            <select class="condition-gender ${inputClass}">
                <option value="">Select...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Unknown">Unknown</option>
            </select>
        `;
    } else if (filterType === 'dobRange') {
        inputsContainer.innerHTML = `
            <input type="date" class="condition-dob-start ${inputClass}">
            <span class="text-muted-foreground text-sm">to</span>
            <input type="date" class="condition-dob-end ${inputClass}">
        `;
    } else if (filterType === 'device') {
        inputsContainer.innerHTML = `
            <select class="condition-device ${inputClass}">
                <option value="">Select...</option>
                <option value="Mobile">Mobile</option>
                <option value="Desktop">Desktop</option>
                <option value="Tablet">Tablet</option>
                <option value="Unknown">Unknown</option>
            </select>
        `;
    }
}

function buildConditionConfig(conditionEl) {
    const filterType = conditionEl.querySelector('.condition-type')?.value;
    if (!filterType) return null;

    let config = { type: filterType, params: {}, label: '' };

    if (filterType === 'subscriberDateRange') {
        const startDate = conditionEl.querySelector('.condition-start-date')?.value || null;
        const endDate = conditionEl.querySelector('.condition-end-date')?.value || null;
        if (!startDate && !endDate) return null;
        config.params = { startDate, endDate };
        config.label = `Created: ${startDate || 'any'} - ${endDate || 'any'}`;
    } else if (filterType === 'firstPurchaseProduct') {
        const matchType = conditionEl.querySelector('.condition-product-match-type')?.value || 'name';
        const productValue = conditionEl.querySelector('.condition-product-value')?.value?.trim();
        if (!productValue) return null;

        if (matchType === 'id') {
            const productIds = productValue.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            config.params = {
                matchType: 'id',
                productIds,
                matcher: (item) => productIds.includes(item.product_id)
            };
            config.label = `1st Purchase = ID: ${productValue}`;
        } else {
            config.params = {
                matchType: 'name',
                productName: productValue,
                matcher: (item) => (item.name || item.sku || '').toLowerCase().includes(productValue.toLowerCase())
            };
            config.label = `1st Purchase = "${productValue}"`;
        }
    } else if (filterType === 'firstPurchaseValue') {
        const operator = conditionEl.querySelector('.condition-operator')?.value || 'gte';
        const amount = parseFloat(conditionEl.querySelector('.condition-amount')?.value);
        if (isNaN(amount)) return null;

        const operatorLabels = { eq: '=', gte: '>=', lte: '<=', gt: '>', lt: '<' };
        config.params = {
            operator,
            amount,
            matcher: (orderTotal) => {
                const total = parseFloat(orderTotal);
                if (operator === 'eq') return total === amount;
                if (operator === 'gte') return total >= amount;
                if (operator === 'lte') return total <= amount;
                if (operator === 'gt') return total > amount;
                if (operator === 'lt') return total < amount;
                return false;
            }
        };
        config.label = `1st Purchase ${operatorLabels[operator]} ${amount.toLocaleString()}`;
    } else if (filterType === 'source') {
        const source = conditionEl.querySelector('.condition-source')?.value;
        if (!source) return null;
        config.params = { source };
        config.label = `Source = ${source}`;
    } else if (filterType === 'gender') {
        const gender = conditionEl.querySelector('.condition-gender')?.value;
        if (!gender) return null;
        config.params = { gender };
        config.label = `Gender = ${gender}`;
    } else if (filterType === 'dobRange') {
        const startDate = conditionEl.querySelector('.condition-dob-start')?.value || null;
        const endDate = conditionEl.querySelector('.condition-dob-end')?.value || null;
        if (!startDate && !endDate) return null;
        config.params = { startDate, endDate };
        config.label = `DOB: ${startDate || 'any'} - ${endDate || 'any'}`;
    } else if (filterType === 'device') {
        const device = conditionEl.querySelector('.condition-device')?.value;
        if (!device) return null;
        config.params = { device };
        config.label = `Device = ${device}`;
    }

    return config;
}

function applyConditionalFilter() {
    if (!dashboard) return;

    const container = document.getElementById('filterConditionsContainer');
    const conditionEls = container?.querySelectorAll('.filter-condition') || [];

    // Build conditions array from UI
    const conditions = [];
    conditionEls.forEach(el => {
        const config = buildConditionConfig(el);
        if (config) conditions.push(config);
    });

    // Update dashboard filter state
    dashboard.conditionalFilter.conditions = conditions;

    // Build combined label
    const mode = dashboard.conditionalFilter.mode;
    if (conditions.length === 0) {
        dashboard.conditionalFilter.label = 'All Customers';
    } else if (conditions.length === 1) {
        dashboard.conditionalFilter.label = conditions[0].label;
    } else {
        dashboard.conditionalFilter.label = conditions.map(c => c.label).join(` ${mode} `);
    }

    // Recalculate ALL analytics with new filter
    dashboard.categorizePersonas();
    dashboard.calculatePersonaGrowth();
    dashboard.calculateGrowthAnalytics();
    dashboard.calculateWooCommerceMetrics();
    dashboard.updateDashboard();

    // Update UI
    updateConditionalFilterInfo();
    updateActiveFiltersDisplay();
    updateTripwireAnalysisPanel();
}

function clearConditionalFilter() {
    if (!dashboard) return;

    dashboard.conditionalFilter = {
        mode: 'AND',
        conditions: [],
        label: 'All Customers'
    };

    // Clear UI
    const container = document.getElementById('filterConditionsContainer');
    if (container) container.innerHTML = '';

    // Reset mode buttons
    setFilterMode('AND');

    // Hide UI elements
    document.getElementById('conditionalApplyBtn')?.classList.add('hidden');
    document.getElementById('conditionalFilterInfo')?.classList.add('hidden');
    document.getElementById('activeFiltersDisplay')?.classList.add('hidden');
    document.getElementById('tripwireAnalysisPanel')?.classList.add('hidden');

    // Recalculate ALL analytics with cleared filter
    dashboard.categorizePersonas();
    dashboard.calculatePersonaGrowth();
    dashboard.calculateGrowthAnalytics();
    dashboard.calculateWooCommerceMetrics();
    dashboard.updateDashboard();
}

function updateConditionalFilterInfo() {
    const info = document.getElementById('conditionalFilterInfo');
    const count = document.getElementById('conditionalFilterCount');

    if (!dashboard || !info || !count) return;

    const { emails } = dashboard.getConditionallyFilteredCustomers();

    if (emails !== null) {
        count.textContent = emails.size;
        info.classList.remove('hidden');
    } else {
        info.classList.add('hidden');
    }
}

function updateActiveFiltersDisplay() {
    const display = document.getElementById('activeFiltersDisplay');
    if (!display || !dashboard) return;

    const { conditions, mode } = dashboard.conditionalFilter;

    if (conditions.length === 0) {
        display.classList.add('hidden');
        return;
    }

    display.innerHTML = conditions.map((c, i) => `
        ${i > 0 ? `<span class="text-xs text-muted-foreground font-medium">${mode}</span>` : ''}
        <span class="px-2 py-1 bg-primary/20 text-primary text-xs rounded-full">${c.label}</span>
    `).join('');
    display.classList.remove('hidden');
}

function updateTripwireAnalysisPanel() {
    const panel = document.getElementById('tripwireAnalysisPanel');
    if (!panel || !dashboard) return;

    const { conditions } = dashboard.conditionalFilter;

    // Only show panel for product-based filters
    const hasProductFilter = conditions.some(c => c.type === 'firstPurchaseProduct');
    if (!hasProductFilter) {
        panel.classList.add('hidden');
        return;
    }

    const cohorts = dashboard.calculateTripwireCohortAnalysis();
    if (!cohorts) {
        panel.classList.add('hidden');
        return;
    }

    panel.classList.remove('hidden');

    // Calculate totals
    let totalBuyers = 0, totalReturned = 0, allDays = [];
    Object.values(cohorts).forEach(c => {
        totalBuyers += c.total;
        totalReturned += c.returned;
        if (c.avgDaysTo2nd !== '-') {
            allDays.push(parseFloat(c.avgDaysTo2nd) * c.returned);
        }
    });

    // Update summary cards
    document.getElementById('tripwireTotal').textContent = totalBuyers;
    document.getElementById('tripwireReturned').textContent = totalReturned;
    document.getElementById('tripwireReturnRate').textContent =
        totalBuyers > 0 ? (totalReturned / totalBuyers * 100).toFixed(1) + '%' : '0%';
    document.getElementById('tripwireAvgDays').textContent =
        totalReturned > 0 ? (allDays.reduce((a,b) => a+b, 0) / totalReturned).toFixed(0) + ' days' : '-';

    // Build cohort table
    const tbody = document.getElementById('tripwireCohortTable');
    if (!tbody) return;

    const sortedCohorts = Object.entries(cohorts).sort((a, b) => b[0].localeCompare(a[0]));

    tbody.innerHTML = sortedCohorts.map(([month, c]) => `
        <tr class="border-b border-foreground/10 hover:bg-muted/50">
            <td class="py-2 font-medium">${month}</td>
            <td class="text-right">${c.total}</td>
            <td class="text-right text-green-500">${c.returned}</td>
            <td class="text-right">${c.returnRate}%</td>
            <td class="text-right">${c.thirdPurchase}</td>
            <td class="text-right">${c.avgDaysTo2nd}</td>
            <td class="text-left text-xs text-muted-foreground">
                ${c.topSecondProducts.slice(0, 2).map(([name]) =>
                    name.length > 25 ? name.substring(0, 25) + '...' : name
                ).join(', ') || '-'}
            </td>
        </tr>
    `).join('');
}

function updateDateFilterIndicator(preset, startDate, endDate) {
    const indicator = document.getElementById('dateFilterIndicator');
    const label = document.getElementById('dateFilterLabel');

    if (!indicator || !label) return;

    const labels = {
        '7d': 'Last 7 Days',
        '30d': 'Last 30 Days',
        '90d': 'Last 90 Days',
        'ytd': 'Year to Date',
        'all': 'All Time'
    };

    let labelText = labels[preset] || 'All Time';

    if (preset === 'custom' && startDate && endDate) {
        const formatDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        labelText = `${formatDate(startDate)} - ${formatDate(endDate)}`;
    }

    label.textContent = labelText;
    indicator.classList.toggle('hidden', preset === 'all');
}

// Toggle collapsible sections
function toggleSection(sectionId) {
    const content = document.getElementById(`${sectionId}-content`);
    const icon = document.getElementById(`${sectionId}-icon`);

    if (content) {
        content.classList.toggle('hidden');
    }
    if (icon) {
        icon.classList.toggle('rotate-180');
    }
}

// Expand persona row to show details
let currentExpandedPersona = null;
function expandPersonaRow(personaKey) {
    const detailRow = document.getElementById(`persona-detail-${personaKey}`);
    const detailContent = document.getElementById(`persona-detail-content-${personaKey}`);
    const icon = document.getElementById(`persona-icon-${personaKey}`);

    if (!detailRow) return;

    // If clicking the same row, toggle it
    if (currentExpandedPersona === personaKey) {
        detailRow.classList.add('hidden');
        if (icon) icon.style.transform = 'rotate(0deg)';
        currentExpandedPersona = null;
        return;
    }

    // Close any previously expanded row
    if (currentExpandedPersona) {
        const prevRow = document.getElementById(`persona-detail-${currentExpandedPersona}`);
        const prevIcon = document.getElementById(`persona-icon-${currentExpandedPersona}`);
        if (prevRow) prevRow.classList.add('hidden');
        if (prevIcon) prevIcon.style.transform = 'rotate(0deg)';
    }

    // Get persona name from the row
    const parentRow = detailRow.previousElementSibling;
    const personaName = parentRow?.dataset?.persona;

    if (!personaName || !dashboard) {
        detailContent.innerHTML = '<div class="text-center text-muted-foreground">Unable to load details</div>';
        detailRow.classList.remove('hidden');
        if (icon) icon.style.transform = 'rotate(90deg)';
        currentExpandedPersona = personaKey;
        return;
    }

    // Calculate and render details
    detailContent.innerHTML = '<div class="text-center text-muted-foreground">Loading...</div>';
    detailRow.classList.remove('hidden');
    if (icon) icon.style.transform = 'rotate(90deg)';
    currentExpandedPersona = personaKey;

    // Use setTimeout to allow UI to update before heavy calculation
    setTimeout(() => {
        try {
            const details = dashboard.calculatePersonaDetails(personaName);
            detailContent.innerHTML = dashboard.renderPersonaDetails(personaName, details);
        } catch (err) {
            console.error('Error calculating persona details:', err);
            detailContent.innerHTML = '<div class="text-center text-destructive">Error loading details</div>';
        }
    }, 50);
}

// Reset segment filters
function resetFilters() {
    const filterPersona = document.getElementById('filterPersona');
    const filterGender = document.getElementById('filterGender');
    const filterSource = document.getElementById('filterSource');

    if (filterPersona) filterPersona.value = '';
    if (filterGender) filterGender.value = '';
    if (filterSource) filterSource.value = '';

    // Trigger filter update
    if (dashboard) {
        dashboard.updateDeepDive();
    }
}
// Deploy trigger: Wed Feb 11 11:27:07 +07 2026
