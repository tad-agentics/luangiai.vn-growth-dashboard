// Shared Report Generation Logic
// ================================

// Generation-based personas (DOB-based)
export const PERSONA_DEFINITIONS = {
    'gen_z': { name: 'Gen Z', birthYearRange: [2000, 2012], bestChannel: 'TikTok, Instagram Reels', recommendedOffer: '99K impulse offer' },
    'millennial': { name: 'Millennial', birthYearRange: [1981, 1999], bestChannel: 'Facebook, Google Ads', recommendedOffer: '299K value package' },
    'gen_x': { name: 'Gen X', birthYearRange: [1965, 1980], bestChannel: 'Zalo OA, Facebook', recommendedOffer: '399K family package' },
    'boomer': { name: 'Boomer', birthYearRange: [1946, 1964], bestChannel: 'Direct, Referral, Zalo', recommendedOffer: '599K premium' },
    'unknown': { name: 'Unknown', birthYearRange: null, bestChannel: 'Progressive profiling', recommendedOffer: '199K low-commitment' }
};

export async function generateDailyStrategy(supabase) {
    const today = new Date().toISOString().split('T')[0];

    const [todayResult, yesterdayResult, adResult] = await Promise.all([
        supabase.from('daily_metrics').select('*').eq('date', today).single(),
        supabase.from('daily_metrics').select('*').lt('date', today).order('date', { ascending: false }).limit(1).single(),
        supabase.from('ad_performance').select('*').eq('date', today)
    ]);

    const metrics = todayResult.data || {};
    const yesterday = yesterdayResult.data || {};
    const adPerf = adResult.data || [];

    const contactChange = (metrics.total_contacts || 0) - (yesterday.total_contacts || 0);
    const totalSpend = adPerf.reduce((s, r) => s + (r.spend || 0), 0);
    const totalConversions = adPerf.reduce((s, r) => s + (r.conversions || 0), 0);

    const opportunities = [];
    const risks = [];
    const actions = [];

    // Analyze personas
    const personas = metrics.personas || {};
    Object.entries(personas).forEach(([key, data]) => {
        const def = PERSONA_DEFINITIONS[key];
        if (data.cvr > 5) {
            opportunities.push({
                title: `High-converting ${def?.name || key}`,
                description: `${data.cvr}% CVR - consider increasing targeting budget`,
                impact: 'high'
            });
        }
        if (data.count > 100 && data.cvr < 1) {
            risks.push({
                title: `Low conversion for ${def?.name || key}`,
                description: `Only ${data.cvr}% CVR with ${data.count} contacts`,
                severity: 'medium'
            });
        }
    });

    if (totalSpend > 0 && totalConversions > 0) {
        const cpa = totalSpend / totalConversions;
        if (cpa > 500000) {
            risks.push({
                title: 'High CPA',
                description: `CPA at ${Math.round(cpa).toLocaleString()} VND - above target`,
                severity: 'high'
            });
        }
    }

    if ((metrics.new_contacts_today || 0) < 10) {
        actions.push({ task: 'Boost acquisition campaigns - low new contacts today', priority: 'high', deadline: 'Today' });
    }

    actions.push({ task: 'Review top-performing ad creatives', priority: 'medium', deadline: 'This week' });

    return {
        type: 'daily_strategy',
        generated_at: new Date().toISOString(),
        summary: `Today: ${metrics.new_contacts_today || 0} new contacts (${contactChange >= 0 ? '+' : ''}${contactChange} net). Total: ${metrics.total_contacts?.toLocaleString() || 0}`,
        key_metrics: {
            total_contacts: metrics.total_contacts || 0,
            new_today: metrics.new_contacts_today || 0,
            change: contactChange,
            ad_spend: totalSpend,
            ad_conversions: totalConversions
        },
        focus_today: opportunities.length > 0 ? `Focus on ${opportunities[0].title}` : 'Monitor performance and optimize ad spend',
        opportunities,
        risks,
        action_items: actions
    };
}

export async function generateWeeklySummary(supabase) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const [metricsResult, adResult] = await Promise.all([
        supabase.from('daily_metrics').select('*').gte('date', startStr).lte('date', endStr).order('date', { ascending: true }),
        supabase.from('ad_performance').select('*').gte('date', startStr)
    ]);

    const weekMetrics = metricsResult.data || [];
    const adPerf = adResult.data || [];

    const latest = weekMetrics[weekMetrics.length - 1] || {};
    const earliest = weekMetrics[0] || {};
    const newContacts = weekMetrics.reduce((s, m) => s + (m.new_contacts_today || 0), 0);
    const totalSpend = adPerf.reduce((s, r) => s + (r.spend || 0), 0);
    const totalConversions = adPerf.reduce((s, r) => s + (r.conversions || 0), 0);

    const contactGrowth = earliest.total_contacts > 0
        ? ((latest.total_contacts - earliest.total_contacts) / earliest.total_contacts * 100)
        : 0;

    const highlights = [];
    if (newContacts > 0) highlights.push(`Acquired ${newContacts.toLocaleString()} new contacts`);
    if (totalConversions > 0) highlights.push(`Generated ${totalConversions} ad conversions`);
    if (contactGrowth > 0) highlights.push(`Contact base grew ${contactGrowth.toFixed(1)}%`);

    return {
        type: 'weekly_summary',
        generated_at: new Date().toISOString(),
        performance_summary: `This week: ${newContacts.toLocaleString()} new contacts, ${totalConversions} conversions, ${(totalSpend / 1000000).toFixed(1)}M VND ad spend`,
        week_highlights: highlights,
        trends: {
            contact_growth: parseFloat(contactGrowth.toFixed(1)),
            new_contacts: newContacts,
            ad_conversions: totalConversions
        },
        opportunities: [],
        risks: [],
        action_items: [
            { task: 'Review weekly performance data', priority: 'medium' },
            { task: 'Plan next week campaigns', priority: 'high' }
        ]
    };
}

export async function generateChannelAnalysis(supabase) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const { data: adPerf } = await supabase
        .from('ad_performance')
        .select('*')
        .gte('date', startDate.toISOString().split('T')[0]);

    const channels = {};
    (adPerf || []).forEach(row => {
        const ch = row.provider || 'unknown';
        if (!channels[ch]) channels[ch] = { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
        channels[ch].spend += row.spend || 0;
        channels[ch].impressions += row.impressions || 0;
        channels[ch].clicks += row.clicks || 0;
        channels[ch].conversions += row.conversions || 0;
    });

    Object.keys(channels).forEach(ch => {
        const c = channels[ch];
        c.ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) + '%' : 'N/A';
        c.cpa = c.conversions > 0 ? Math.round(c.spend / c.conversions) : null;
    });

    const totalSpend = Object.values(channels).reduce((s, c) => s + c.spend, 0);
    const totalConversions = Object.values(channels).reduce((s, c) => s + c.conversions, 0);

    return {
        type: 'channel_analysis',
        period: { days: 30 },
        generated_at: new Date().toISOString(),
        totals: {
            spend: totalSpend,
            conversions: totalConversions,
            avg_cpa: totalConversions > 0 ? Math.round(totalSpend / totalConversions) : null
        },
        channels
    };
}

export async function generateSEOAudit(supabase) {
    const { data: seoData } = await supabase
        .from('seo_performance')
        .select('*')
        .order('date', { ascending: false })
        .limit(200);

    const totals = { clicks: 0, impressions: 0 };
    const queryPerformance = {};

    (seoData || []).forEach(row => {
        totals.clicks += row.clicks || 0;
        totals.impressions += row.impressions || 0;

        if (row.query) {
            if (!queryPerformance[row.query]) {
                queryPerformance[row.query] = { clicks: 0, impressions: 0, positions: [] };
            }
            queryPerformance[row.query].clicks += row.clicks || 0;
            queryPerformance[row.query].impressions += row.impressions || 0;
            if (row.position) queryPerformance[row.query].positions.push(row.position);
        }
    });

    const opportunities = Object.entries(queryPerformance)
        .map(([query, data]) => {
            const avgPosition = data.positions.length > 0
                ? data.positions.reduce((a, b) => a + b, 0) / data.positions.length
                : null;
            return { query, ...data, avgPosition };
        })
        .filter(q => q.avgPosition >= 5 && q.avgPosition <= 20 && q.impressions > 100)
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 10);

    const topQueries = Object.entries(queryPerformance)
        .sort((a, b) => b[1].clicks - a[1].clicks)
        .slice(0, 10)
        .map(([query, data]) => ({ query, clicks: data.clicks, impressions: data.impressions }));

    return {
        type: 'seo_audit',
        generated_at: new Date().toISOString(),
        overview: {
            total_clicks: totals.clicks,
            total_impressions: totals.impressions,
            avg_ctr: totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(2) + '%' : 'N/A'
        },
        top_queries: topQueries,
        opportunities: opportunities.map(o => ({
            query: o.query,
            position: o.avgPosition?.toFixed(1),
            impressions: o.impressions,
            potential: 'Move to top 3'
        }))
    };
}

export async function saveReport(supabase, type, date, report) {
    await supabase.from('ai_reports').upsert({
        report_type: type,
        report_date: date,
        content: JSON.stringify(report),
        metadata: { generated_at: new Date().toISOString() }
    }, { onConflict: 'report_type,report_date' });
}
