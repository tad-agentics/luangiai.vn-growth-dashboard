// Growth Intelligence Platform - Supabase Configuration
// =====================================================

// Supabase Configuration
const SUPABASE_URL = 'https://qktiedjahvbeuznpjubv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrdGllZGphaHZiZXV6bnBqdWJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTg1MDMsImV4cCI6MjA4NTY5NDUwM30.cpoTuuYlqHRgfJWnGIMnnyY7w2vPcLjRALb7X3Qm-Mo';

// Initialize Supabase client
let supabaseClient = null;

/**
 * Get or create the Supabase client instance
 * @returns {Object} Supabase client
 */
export function getSupabaseClient() {
    if (!supabaseClient && typeof window !== 'undefined' && window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return supabaseClient;
}

/**
 * Initialize Supabase with custom URL and key (for testing or different environments)
 * @param {string} url - Supabase URL
 * @param {string} key - Supabase anon key
 */
export function initSupabase(url = SUPABASE_URL, key = SUPABASE_ANON_KEY) {
    if (typeof window !== 'undefined' && window.supabase) {
        supabaseClient = window.supabase.createClient(url, key);
    }
    return supabaseClient;
}

// Fallback credentials (used if Supabase config is unavailable)
export const FALLBACK_CONFIG = {
    siteUrl: 'https://luangiai.vn',
    username: 'tad@accel3.com',
    password: 'dbC0 SxeB RRJ3 ANhK aZqj n3z3'
};

/**
 * Load FluentCRM config from Supabase
 * @returns {Promise<Object|null>} Configuration object or null
 */
export async function loadConfigFromSupabase() {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
        const { data, error } = await client
            .from('config')
            .select('*')
            .eq('key', 'fluentcrm')
            .single();

        if (error) throw error;
        return data?.value || null;
    } catch (e) {
        console.log('Could not load config from Supabase:', e.message);
        return null;
    }
}

/**
 * Save FluentCRM config to Supabase
 * @param {Object} config - Configuration to save
 * @returns {Promise<boolean>} Success status
 */
export async function saveConfigToSupabase(config) {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
        const { error } = await client
            .from('config')
            .upsert({
                key: 'fluentcrm',
                value: config,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });

        if (error) throw error;
        return true;
    } catch (e) {
        console.log('Could not save config to Supabase:', e.message);
        return false;
    }
}

/**
 * Log an audit event to Supabase
 * @param {string} action - Action type
 * @param {Object} details - Event details
 */
export async function logAuditEvent(action, details = {}) {
    const client = getSupabaseClient();
    if (!client) return;

    try {
        await client.from('audit_log').insert({
            action,
            details,
            user_agent: navigator?.userAgent || 'unknown',
            created_at: new Date().toISOString()
        });
    } catch (e) {
        console.log('Audit log failed:', e.message);
    }
}

export { SUPABASE_URL, SUPABASE_ANON_KEY };
export default { getSupabaseClient, initSupabase, loadConfigFromSupabase, saveConfigToSupabase, logAuditEvent };
