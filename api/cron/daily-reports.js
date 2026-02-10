// Daily Reports Cron Job
// Vercel Serverless Function - Scheduled via Vercel Cron
// ======================================================

import { createClient } from '@supabase/supabase-js';
import { generateDailyStrategy, generateWeeklySummary, saveReport } from '../lib/report-generators.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qktiedjahvbeuznpjubv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
    // Verify cron secret for security
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const today = new Date().toISOString().split('T')[0];
    const results = [];

    try {
        // Generate Daily Strategy Report
        const dailyReport = await generateDailyStrategy(supabase);
        await saveReport(supabase, 'daily_strategy', today, dailyReport);
        results.push({ type: 'daily_strategy', status: 'success' });

        // Generate Weekly Summary on Sundays
        if (new Date().getDay() === 0) {
            const weeklyReport = await generateWeeklySummary(supabase);
            await saveReport(supabase, 'weekly_summary', today, weeklyReport);
            results.push({ type: 'weekly_summary', status: 'success' });
        }

        // Clean up old reports (keep last 90 days)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 90);
        await supabase.from('ai_reports').delete().lt('report_date', cutoffDate.toISOString().split('T')[0]);

        // Clean up expired memories
        await supabase.from('ai_memory').delete().lt('expires_at', new Date().toISOString());

        // Log successful run
        await supabase.from('audit_log').insert({
            action: 'cron_daily_reports',
            details: { date: today, reports_generated: results.length }
        });

        return res.status(200).json({ success: true, date: today, reports: results });

    } catch (error) {
        console.error('Cron job error:', error);
        await supabase.from('audit_log').insert({
            action: 'cron_daily_reports_error',
            details: { date: today, error: error.message }
        });
        return res.status(500).json({ error: error.message });
    }
}
