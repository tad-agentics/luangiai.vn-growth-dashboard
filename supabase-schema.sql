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
    "username": "dominhthai94@gmail.com",
    "password": "p3Jb 1Z6G JOde MAaS qtvt DK9D"
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
-- 6. AUDIT LOG
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
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policies allowing anon access (for internal dashboard)
CREATE POLICY "Allow anon read config" ON config FOR SELECT USING (true);
CREATE POLICY "Allow anon read oauth" ON oauth_tokens FOR SELECT USING (true);
CREATE POLICY "Allow anon all daily_metrics" ON daily_metrics FOR ALL USING (true);
CREATE POLICY "Allow anon all ai_reports" ON ai_reports FOR ALL USING (true);
CREATE POLICY "Allow anon all ad_performance" ON ad_performance FOR ALL USING (true);
CREATE POLICY "Allow anon insert audit" ON audit_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon read audit" ON audit_log FOR SELECT USING (true);

-- ============================================
-- DONE! Your database is ready.
-- ============================================
