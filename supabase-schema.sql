-- Supabase Schema for Luangiai CRM Dashboard
-- Run this in the Supabase SQL Editor

-- ============================================
-- 1. CONFIGURATION TABLE
-- Stores API credentials and settings
-- ============================================
CREATE TABLE IF NOT EXISTS config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default FluentCRM config
INSERT INTO config (key, value) VALUES
('fluentcrm', '{
    "siteUrl": "https://luangiai.vn",
    "username": "tad@accel3.com",
    "password": "dbC0 SxeB RRJ3 ANhK aZqj n3z3"
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 2. OAUTH TOKENS TABLE
-- For Google/Facebook API integrations
-- ============================================
CREATE TABLE IF NOT EXISTS oauth_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider TEXT NOT NULL, -- 'google', 'facebook', 'tiktok'
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type TEXT DEFAULT 'Bearer',
    expires_at TIMESTAMPTZ,
    scope TEXT,
    account_id TEXT, -- Ad account ID
    account_name TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider, account_id)
);

-- ============================================
-- 3. DAILY METRICS SNAPSHOT
-- Historical data for trend analysis
-- ============================================
CREATE TABLE IF NOT EXISTS daily_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    total_contacts INTEGER DEFAULT 0,
    subscribed INTEGER DEFAULT 0,
    pending INTEGER DEFAULT 0,
    unsubscribed INTEGER DEFAULT 0,
    bounced INTEGER DEFAULT 0,
    total_lists INTEGER DEFAULT 0,
    total_tags INTEGER DEFAULT 0,
    total_campaigns INTEGER DEFAULT 0,
    leads INTEGER DEFAULT 0,
    customers INTEGER DEFAULT 0,
    new_contacts_today INTEGER DEFAULT 0,
    conversions_today INTEGER DEFAULT 0,
    personas JSONB DEFAULT '{}',
    sources JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for date queries
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date DESC);

-- ============================================
-- 4. AI ANALYSIS REPORTS
-- Store generated AI insights
-- ============================================
CREATE TABLE IF NOT EXISTS ai_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report_type TEXT NOT NULL, -- 'daily_strategy', 'weekly_summary', 'persona_insight'
    report_date DATE NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(report_type, report_date)
);

-- Index for report queries
CREATE INDEX IF NOT EXISTS idx_ai_reports_type_date ON ai_reports(report_type, report_date DESC);

-- ============================================
-- 5. AD PERFORMANCE CACHE
-- Cache expensive API calls
-- ============================================
CREATE TABLE IF NOT EXISTS ad_performance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider TEXT NOT NULL, -- 'google', 'facebook'
    account_id TEXT NOT NULL,
    date DATE NOT NULL,
    campaign_id TEXT,
    campaign_name TEXT,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    spend DECIMAL(10,2) DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    cost_per_conversion DECIMAL(10,2),
    currency TEXT DEFAULT 'VND',
    raw_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider, account_id, date, campaign_id)
);

-- Index for performance queries
CREATE INDEX IF NOT EXISTS idx_ad_performance_lookup ON ad_performance(provider, account_id, date DESC);

-- ============================================
-- 6. SUBSCRIBER CACHE
-- Cache FluentCRM subscriber data to avoid full syncs
-- ============================================
CREATE TABLE IF NOT EXISTS subscriber_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cache_key TEXT UNIQUE NOT NULL DEFAULT 'main', -- Allow multiple cache keys if needed
    last_sync_time TIMESTAMPTZ NOT NULL,
    subscriber_count INTEGER DEFAULT 0,
    subscribers JSONB NOT NULL DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_subscriber_cache_key ON subscriber_cache(cache_key);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS subscriber_cache_updated_at ON subscriber_cache;
CREATE TRIGGER subscriber_cache_updated_at
    BEFORE UPDATE ON subscriber_cache
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 7. AUDIT LOG
-- Track who accessed what
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action TEXT NOT NULL, -- 'login', 'view_dashboard', 'export_data', 'update_config'
    user_identifier TEXT, -- Email or IP
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS config_updated_at ON config;
CREATE TRIGGER config_updated_at
    BEFORE UPDATE ON config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS oauth_tokens_updated_at ON oauth_tokens;
CREATE TRIGGER oauth_tokens_updated_at
    BEFORE UPDATE ON oauth_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- Enable for production security
-- ============================================

-- For now, allow all access (dashboard uses anon key)
-- In production, you'd want proper auth

ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriber_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policies allowing anon access (for internal dashboard)
CREATE POLICY "Allow anon read config" ON config FOR SELECT USING (true);
CREATE POLICY "Allow anon read oauth" ON oauth_tokens FOR SELECT USING (true);
CREATE POLICY "Allow anon all daily_metrics" ON daily_metrics FOR ALL USING (true);
CREATE POLICY "Allow anon all ai_reports" ON ai_reports FOR ALL USING (true);
CREATE POLICY "Allow anon all ad_performance" ON ad_performance FOR ALL USING (true);
CREATE POLICY "Allow anon all subscriber_cache" ON subscriber_cache FOR ALL USING (true);
CREATE POLICY "Allow anon insert audit" ON audit_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon read audit" ON audit_log FOR SELECT USING (true);

-- ============================================
-- 8. UNIFIED METRICS (Medallion Gold Layer)
-- Cross-platform normalized metrics
-- ============================================
CREATE TABLE IF NOT EXISTS unified_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    source TEXT NOT NULL,           -- 'fluentcrm', 'google_ads', 'meta_ads', 'tiktok_ads', 'ga4', 'gsc'

    -- Traffic Metrics
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    sessions INTEGER DEFAULT 0,

    -- Conversion Metrics
    leads INTEGER DEFAULT 0,
    customers INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,

    -- Cost Metrics
    spend DECIMAL(12,2) DEFAULT 0,
    revenue DECIMAL(12,2) DEFAULT 0,
    currency TEXT DEFAULT 'VND',

    -- Calculated Fields (stored for performance)
    ctr DECIMAL(6,4),              -- clicks / impressions
    cvr DECIMAL(6,4),              -- conversions / clicks
    cpc DECIMAL(10,2),             -- spend / clicks
    cpa DECIMAL(10,2),             -- spend / conversions
    roas DECIMAL(6,2),             -- revenue / spend

    -- Dimensions (for drill-down)
    campaign_id TEXT,
    campaign_name TEXT,
    ad_group_id TEXT,
    ad_group_name TEXT,
    persona TEXT,                  -- Linked persona (if attributable)

    raw_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(date, source, campaign_id, ad_group_id)
);

CREATE INDEX IF NOT EXISTS idx_unified_metrics_date ON unified_metrics(date DESC);
CREATE INDEX IF NOT EXISTS idx_unified_metrics_source ON unified_metrics(source, date DESC);
CREATE INDEX IF NOT EXISTS idx_unified_metrics_persona ON unified_metrics(persona, date DESC);

-- RLS Policy
ALTER TABLE unified_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all unified_metrics" ON unified_metrics FOR ALL USING (true);

-- ============================================
-- 9. AI CONTEXT MEMORY
-- Persistent memory for AI co-CGO
-- ============================================
CREATE TABLE IF NOT EXISTS ai_memory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    memory_type TEXT NOT NULL,      -- 'decision', 'insight', 'preference', 'fact'
    context TEXT NOT NULL,          -- What this memory relates to
    content TEXT NOT NULL,          -- The actual memory content
    importance INTEGER DEFAULT 5,   -- 1-10 scale for retrieval priority

    -- Metadata for retrieval
    tags TEXT[] DEFAULT '{}',

    -- Lifecycle
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed TIMESTAMPTZ DEFAULT NOW(),
    access_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,         -- Optional expiration

    -- Source tracking
    source_type TEXT,               -- 'user_feedback', 'auto_insight', 'manual'
    source_id TEXT                  -- Reference to originating data
);

CREATE INDEX IF NOT EXISTS idx_ai_memory_type ON ai_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_ai_memory_tags ON ai_memory USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_ai_memory_importance ON ai_memory(importance DESC);
CREATE INDEX IF NOT EXISTS idx_ai_memory_created ON ai_memory(created_at DESC);

-- RLS Policy
ALTER TABLE ai_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all ai_memory" ON ai_memory FOR ALL USING (true);

-- ============================================
-- 10. SEO PERFORMANCE DATA
-- Cache for GA4 and GSC data
-- ============================================
CREATE TABLE IF NOT EXISTS seo_performance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source TEXT NOT NULL,           -- 'ga4' or 'gsc'
    date DATE NOT NULL,

    -- GSC Metrics
    query TEXT,
    page TEXT,

    -- Common Metrics
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    ctr DECIMAL(6,4),
    position DECIMAL(6,2),

    -- GA4 Metrics
    sessions INTEGER DEFAULT 0,
    users INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    bounce_rate DECIMAL(6,4),
    avg_session_duration DECIMAL(10,2),
    conversions INTEGER DEFAULT 0,

    -- Channel info
    channel_grouping TEXT,
    landing_page TEXT,

    raw_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(source, date, query, page)
);

CREATE INDEX IF NOT EXISTS idx_seo_performance_date ON seo_performance(source, date DESC);
CREATE INDEX IF NOT EXISTS idx_seo_performance_query ON seo_performance(query) WHERE query IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_seo_performance_page ON seo_performance(page) WHERE page IS NOT NULL;

-- RLS Policy
ALTER TABLE seo_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all seo_performance" ON seo_performance FOR ALL USING (true);

-- ============================================
-- 11. ATTRIBUTION PATHS
-- Multi-touch attribution tracking
-- ============================================
CREATE TABLE IF NOT EXISTS attribution_paths (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subscriber_id TEXT NOT NULL,    -- FluentCRM subscriber ID

    -- Journey tracking
    touchpoints JSONB NOT NULL,     -- Array of {channel, timestamp, action}
    first_touch_channel TEXT,
    last_touch_channel TEXT,

    -- Outcome
    converted BOOLEAN DEFAULT false,
    conversion_date TIMESTAMPTZ,
    conversion_value DECIMAL(12,2),

    -- Attribution weights
    first_touch_weight DECIMAL(4,2),
    last_touch_weight DECIMAL(4,2),
    linear_weight DECIMAL(4,2),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attribution_subscriber ON attribution_paths(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_attribution_converted ON attribution_paths(converted, conversion_date DESC);

-- RLS Policy
ALTER TABLE attribution_paths ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all attribution_paths" ON attribution_paths FOR ALL USING (true);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS attribution_paths_updated_at ON attribution_paths;
CREATE TRIGGER attribution_paths_updated_at
    BEFORE UPDATE ON attribution_paths
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 12. WOOCOMMERCE ORDER CACHE
-- Cache WooCommerce orders to avoid full API syncs
-- ============================================
CREATE TABLE IF NOT EXISTS order_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cache_key TEXT UNIQUE NOT NULL DEFAULT 'main', -- Allow multiple cache keys if needed
    last_sync_time TIMESTAMPTZ NOT NULL,
    last_order_id INTEGER DEFAULT 0,              -- Track newest order ID for incremental sync
    order_count INTEGER DEFAULT 0,
    orders JSONB NOT NULL DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_order_cache_key ON order_cache(cache_key);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS order_cache_updated_at ON order_cache;
CREATE TRIGGER order_cache_updated_at
    BEFORE UPDATE ON order_cache
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS Policy
ALTER TABLE order_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all order_cache" ON order_cache FOR ALL USING (true);

-- ============================================
-- 13. AI SETTINGS
-- Store AI configuration like business context
-- ============================================
CREATE TABLE IF NOT EXISTS ai_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,           -- 'business_context', 'default_prompt', etc.
    value TEXT NOT NULL,                -- The actual content
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_ai_settings_key ON ai_settings(key);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS ai_settings_updated_at ON ai_settings;
CREATE TRIGGER ai_settings_updated_at
    BEFORE UPDATE ON ai_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS Policy
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all ai_settings" ON ai_settings FOR ALL USING (true);

-- ============================================
-- DONE! Your database is ready for Growth Intelligence Platform.
-- ============================================
