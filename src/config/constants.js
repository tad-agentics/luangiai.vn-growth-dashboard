// Growth Intelligence Platform - Constants
// =========================================

// Conversion Tags - Tags that indicate a user has converted/purchased
export const CONVERSION_TAGS = [
    'paid', 'purchased', 'customer', 'buyer', 'converted',
    'order', 'subscription', 'premium', 'pro', 'vip',
    'thanh-toan', 'da-mua', 'khach-hang' // Vietnamese tags
];

// Persona Definitions based on Age + Device rules
export const PERSONA_DEFINITIONS = {
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

// Vietnamese Eastern Zodiac (12 con giáp / Tử Vi) - based on birth year
export const ZODIAC_SIGNS = {
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
export const ZODIAC_ORDER = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tị', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

// Age bucket definitions
export const AGE_BUCKETS = ['18-24', '25-34', '35-44', '45-54', '55+', 'Unknown'];

// Device types
export const DEVICE_TYPES = ['Mobile', 'Desktop', 'Tablet', 'Unknown'];

// Data source identifiers
export const DATA_SOURCES = {
    FLUENTCRM: 'fluentcrm',
    GOOGLE_ADS: 'google_ads',
    META_ADS: 'meta_ads',
    TIKTOK_ADS: 'tiktok_ads',
    GA4: 'ga4',
    GSC: 'gsc'
};

// Memory types for AI context
export const MEMORY_TYPES = {
    DECISION: 'decision',
    INSIGHT: 'insight',
    PREFERENCE: 'preference',
    FACT: 'fact'
};

// Report types for AI insights
export const REPORT_TYPES = {
    DAILY_STRATEGY: 'daily_strategy',
    WEEKLY_SUMMARY: 'weekly_summary',
    PERSONA_DEEP_DIVE: 'persona_deep_dive',
    CHANNEL_ANALYSIS: 'channel_analysis'
};

// Rate limiting configurations
export const RATE_LIMITS = {
    google_ads: { type: 'token_bucket', tokensPerDay: 1000, burstLimit: 100 },
    meta_ads: { type: 'request_budget', budgetPerHour: 200 },
    tiktok_ads: { type: 'sliding_window', windowMs: 60000, maxRequests: 10 },
    ga4: { type: 'token_bucket', tokensPerDay: 50000, burstLimit: 1000 },
    fluentcrm: { type: 'delay', delayMs: 300 }
};

// Cache configuration
export const CACHE_CONFIG = {
    SUBSCRIBER_CACHE_KEY: 'main',
    MAX_PAYLOAD_MB: 5,
    SYNC_LOCK_KEY: 'fluentcrm_sync_lock',
    SYNC_LOCK_TIMEOUT_MS: 120000 // 2 minutes
};

// Chart colors (Tailwind-inspired)
export const CHART_COLORS = {
    primary: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4',
    purple: '#8b5cf6',
    pink: '#ec4899',
    gray: '#6b7280'
};

// Default chart options
export const CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            labels: { color: '#9ca3af' }
        }
    }
};
