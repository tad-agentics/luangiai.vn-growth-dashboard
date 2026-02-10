// AI Report Generation API
// Vercel Serverless Function
// ==========================

import { createClient } from '@supabase/supabase-js';
import {
    generateDailyStrategy,
    generateWeeklySummary,
    generateChannelAnalysis,
    generateSEOAudit,
    saveReport
} from '../lib/report-generators.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qktiedjahvbeuznpjubv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const type = req.query.type || req.body?.type;
    if (!type) return res.status(400).json({ error: 'Report type required' });

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    try {
        const generators = {
            daily_strategy: generateDailyStrategy,
            weekly_summary: generateWeeklySummary,
            channel_analysis: generateChannelAnalysis,
            seo_audit: generateSEOAudit
        };

        const generator = generators[type];
        if (!generator) return res.status(400).json({ error: `Unknown report type: ${type}` });

        const report = await generator(supabase);
        const today = new Date().toISOString().split('T')[0];

        await saveReport(supabase, type, today, report);

        return res.status(200).json({ type, date: today, report });

    } catch (error) {
        console.error('Report generation error:', error);
        return res.status(500).json({ error: error.message });
    }
}
