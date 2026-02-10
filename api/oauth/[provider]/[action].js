// Unified OAuth Handler
// Vercel Serverless Function with Dynamic Routes
// ================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qktiedjahvbeuznpjubv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

// Provider configurations
const PROVIDERS = {
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'https://fluentcrm-dashboard.vercel.app/api/oauth/google/callback',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        scopes: ['https://www.googleapis.com/auth/adwords', 'https://www.googleapis.com/auth/userinfo.email'],
        dbProvider: 'google_ads'
    },
    meta: {
        clientId: process.env.META_APP_ID,
        clientSecret: process.env.META_APP_SECRET,
        redirectUri: process.env.META_REDIRECT_URI || 'https://fluentcrm-dashboard.vercel.app/api/oauth/meta/callback',
        authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
        tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
        userInfoUrl: 'https://graph.facebook.com/me',
        scopes: ['ads_read', 'ads_management', 'business_management'],
        dbProvider: 'meta_ads'
    },
    tiktok: {
        clientId: process.env.TIKTOK_CLIENT_KEY,
        clientSecret: process.env.TIKTOK_CLIENT_SECRET,
        redirectUri: process.env.TIKTOK_REDIRECT_URI || 'https://fluentcrm-dashboard.vercel.app/api/oauth/tiktok/callback',
        authUrl: 'https://business-api.tiktok.com/portal/auth',
        tokenUrl: 'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/',
        scopes: ['advertiser.read', 'campaign.read', 'report.read'],
        dbProvider: 'tiktok_ads'
    },
    ga4: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.GA4_REDIRECT_URI || 'https://fluentcrm-dashboard.vercel.app/api/oauth/ga4/callback',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        scopes: ['https://www.googleapis.com/auth/analytics.readonly', 'https://www.googleapis.com/auth/userinfo.email'],
        dbProvider: 'ga4'
    },
    gsc: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.GSC_REDIRECT_URI || 'https://fluentcrm-dashboard.vercel.app/api/oauth/gsc/callback',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly', 'https://www.googleapis.com/auth/userinfo.email'],
        dbProvider: 'gsc'
    }
};

export default async function handler(req, res) {
    const { provider, action } = req.query;

    if (!PROVIDERS[provider]) {
        return res.status(400).json({ error: `Unknown provider: ${provider}` });
    }

    const config = PROVIDERS[provider];

    if (action === 'init') {
        return handleInit(req, res, config, provider);
    } else if (action === 'callback') {
        return await handleCallback(req, res, config, provider);
    } else if (action === 'refresh') {
        return await handleRefresh(req, res, config, provider);
    } else {
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
}

function handleInit(req, res, config, provider) {
    if (!config.clientId) {
        return res.status(500).json({ error: `${provider} OAuth not configured` });
    }

    const state = Buffer.from(JSON.stringify({
        timestamp: Date.now(),
        provider,
        nonce: Math.random().toString(36).substring(7)
    })).toString('base64');

    let authUrl;

    if (provider === 'tiktok') {
        const params = new URLSearchParams({
            app_id: config.clientId,
            state: state,
            redirect_uri: config.redirectUri,
            scope: config.scopes.join(',')
        });
        authUrl = `${config.authUrl}?${params.toString()}`;
    } else if (provider === 'meta') {
        const params = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            state: state,
            scope: config.scopes.join(',')
        });
        authUrl = `${config.authUrl}?${params.toString()}`;
    } else {
        // Google (ads, ga4, gsc)
        const params = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            response_type: 'code',
            scope: config.scopes.join(' '),
            access_type: 'offline',
            prompt: 'consent',
            state: state
        });
        authUrl = `${config.authUrl}?${params.toString()}`;
    }

    res.redirect(302, authUrl);
}

async function handleCallback(req, res, config, provider) {
    const { code, error, auth_code } = req.query;
    const authCode = code || auth_code;

    if (error) {
        return res.redirect(`/?oauth_error=${encodeURIComponent(error)}`);
    }

    if (!authCode) {
        return res.status(400).json({ error: 'No authorization code provided' });
    }

    try {
        let tokens;

        if (provider === 'tiktok') {
            const tokenResponse = await fetch(config.tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    app_id: config.clientId,
                    secret: config.clientSecret,
                    auth_code: authCode
                })
            });
            const result = await tokenResponse.json();
            if (result.code !== 0) throw new Error(result.message);
            tokens = result.data;
        } else if (provider === 'meta') {
            const params = new URLSearchParams({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                redirect_uri: config.redirectUri,
                code: authCode
            });
            const tokenResponse = await fetch(`${config.tokenUrl}?${params.toString()}`);
            tokens = await tokenResponse.json();
            if (tokens.error) throw new Error(tokens.error.message);
        } else {
            // Google
            const tokenResponse = await fetch(config.tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: config.clientId,
                    client_secret: config.clientSecret,
                    code: authCode,
                    grant_type: 'authorization_code',
                    redirect_uri: config.redirectUri
                })
            });
            tokens = await tokenResponse.json();
            if (tokens.error) throw new Error(tokens.error_description || tokens.error);
        }

        // Get user info
        let accountInfo = { id: 'default', name: 'Connected' };
        if (config.userInfoUrl && tokens.access_token) {
            try {
                const userResponse = await fetch(config.userInfoUrl, {
                    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
                });
                const userInfo = await userResponse.json();
                accountInfo = { id: userInfo.id || 'default', name: userInfo.email || userInfo.name || 'Connected' };
            } catch (e) {
                console.log('Could not fetch user info:', e.message);
            }
        }

        // Store tokens
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const expiresAt = new Date(Date.now() + ((tokens.expires_in || 3600) * 1000)).toISOString();

        await supabase.from('oauth_tokens').upsert({
            provider: config.dbProvider,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_type: tokens.token_type || 'Bearer',
            expires_at: expiresAt,
            scope: Array.isArray(config.scopes) ? config.scopes.join(' ') : config.scopes,
            account_id: accountInfo.id,
            account_name: accountInfo.name,
            metadata: { connected_at: new Date().toISOString() }
        }, { onConflict: 'provider,account_id' });

        await supabase.from('audit_log').insert({
            action: 'oauth_connected',
            details: { provider: config.dbProvider, account: accountInfo.name }
        });

        res.redirect(`/?oauth_success=${config.dbProvider}`);

    } catch (error) {
        console.error(`OAuth callback error for ${provider}:`, error);
        res.redirect(`/?oauth_error=${encodeURIComponent(error.message)}`);
    }
}

async function handleRefresh(req, res, config, provider) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        const { data: tokenData, error: fetchError } = await supabase
            .from('oauth_tokens')
            .select('refresh_token')
            .eq('provider', config.dbProvider)
            .single();

        if (fetchError || !tokenData?.refresh_token) {
            return res.status(400).json({ error: 'No refresh token available' });
        }

        let newTokens;

        if (provider === 'meta') {
            const params = new URLSearchParams({
                grant_type: 'fb_exchange_token',
                client_id: config.clientId,
                client_secret: config.clientSecret,
                fb_exchange_token: tokenData.refresh_token
            });
            const response = await fetch(`${config.tokenUrl}?${params.toString()}`);
            newTokens = await response.json();
        } else {
            // Google
            const response = await fetch(config.tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: config.clientId,
                    client_secret: config.clientSecret,
                    refresh_token: tokenData.refresh_token,
                    grant_type: 'refresh_token'
                })
            });
            newTokens = await response.json();
        }

        if (newTokens.error) {
            throw new Error(newTokens.error_description || newTokens.error);
        }

        const expiresAt = new Date(Date.now() + ((newTokens.expires_in || 3600) * 1000)).toISOString();

        await supabase.from('oauth_tokens').update({
            access_token: newTokens.access_token,
            expires_at: expiresAt,
            metadata: { refreshed_at: new Date().toISOString() }
        }).eq('provider', config.dbProvider);

        return res.status(200).json({ success: true, expires_at: expiresAt });

    } catch (error) {
        console.error(`Token refresh error for ${provider}:`, error);
        return res.status(500).json({ error: error.message });
    }
}
