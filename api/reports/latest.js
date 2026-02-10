// Get Latest AI Report API
// Vercel Serverless Function
// ==========================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qktiedjahvbeuznpjubv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { type } = req.query;

    try {
        let query = supabase
            .from('ai_reports')
            .select('*')
            .order('report_date', { ascending: false });

        if (type) {
            query = query.eq('report_type', type).limit(1);
        } else {
            // Get latest of each type
            query = query.limit(10);
        }

        const { data, error } = await query;

        if (error) throw error;

        if (type) {
            // Single report
            if (!data || data.length === 0) {
                return res.status(404).json({ error: 'No report found' });
            }
            const report = data[0];
            return res.status(200).json({
                type: report.report_type,
                date: report.report_date,
                report: JSON.parse(report.content)
            });
        } else {
            // Multiple reports - dedupe by type
            const latestByType = {};
            data?.forEach(r => {
                if (!latestByType[r.report_type]) {
                    latestByType[r.report_type] = {
                        type: r.report_type,
                        date: r.report_date,
                        report: JSON.parse(r.content)
                    };
                }
            });

            return res.status(200).json({
                reports: Object.values(latestByType)
            });
        }

    } catch (error) {
        console.error('Error fetching reports:', error);
        return res.status(500).json({ error: error.message });
    }
}
