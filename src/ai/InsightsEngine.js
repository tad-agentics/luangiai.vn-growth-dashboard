// Growth Intelligence Platform - AI Insights Engine
// =================================================

import { getSupabaseClient, logAuditEvent } from '../config/supabase.js';
import { PERSONA_DEFINITIONS } from '../config/constants.js';

/**
 * InsightsEngine - Generates AI-powered analysis and recommendations
 * Analyzes data from CRM, Ads, and SEO to produce actionable insights
 */
export class InsightsEngine {
    constructor() {
        this.reportTypes = [
            'daily_strategy',
            'weekly_summary',
            'persona_deep_dive',
            'channel_analysis',
            'seo_audit',
            'conversion_funnel'
        ];
    }

    /**
     * Generate a report based on type
     * @param {string} reportType - Type of report
     * @param {Object} options - Report options
     * @returns {Promise<Object>} Generated report
     */
    async generateReport(reportType, options = {}) {
        switch (reportType) {
            case 'daily_strategy':
                return this.generateDailyStrategy(options);
            case 'weekly_summary':
                return this.generateWeeklySummary(options);
            case 'persona_deep_dive':
                return this.generatePersonaDeepDive(options);
            case 'channel_analysis':
                return this.generateChannelAnalysis(options);
            case 'seo_audit':
                return this.generateSEOAudit(options);
            case 'conversion_funnel':
                return this.generateConversionFunnel(options);
            default:
                throw new Error(`Unknown report type: ${reportType}`);
        }
    }

    /**
     * Generate daily strategy report
     * @param {Object} options - Report options
     * @returns {Promise<Object>} Daily strategy report
     */
    async generateDailyStrategy(options = {}) {
        const supabase = getSupabaseClient();
        const today = new Date().toISOString().split('T')[0];

        // Get latest metrics
        const { data: todayMetrics } = await supabase
            .from('daily_metrics')
            .select('*')
            .eq('date', today)
            .single();

        const { data: yesterdayMetrics } = await supabase
            .from('daily_metrics')
            .select('*')
            .lt('date', today)
            .order('date', { ascending: false })
            .limit(1)
            .single();

        // Get ad performance
        const { data: adPerf } = await supabase
            .from('ad_performance')
            .select('*')
            .eq('date', today);

        // Get SEO data
        const { data: seoData } = await supabase
            .from('seo_performance')
            .select('*')
            .order('date', { ascending: false })
            .limit(50);

        // Calculate changes
        const metrics = todayMetrics || {};
        const yesterday = yesterdayMetrics || {};

        const contactChange = metrics.total_contacts - (yesterday.total_contacts || 0);
        const newToday = metrics.new_contacts_today || 0;
        const totalSpend = adPerf?.reduce((s, r) => s + (r.spend || 0), 0) || 0;
        const totalConversions = adPerf?.reduce((s, r) => s + (r.conversions || 0), 0) || 0;

        // Generate opportunities
        const opportunities = [];
        const risks = [];
        const actions = [];

        // Analyze personas
        const personas = metrics.personas || {};
        Object.entries(personas).forEach(([key, data]) => {
            const def = PERSONA_DEFINITIONS[key];
            if (data.cvr > 5) {
                opportunities.push({
                    type: 'high_cvr_persona',
                    persona: def?.name || key,
                    message: `${def?.name || key} has ${data.cvr}% CVR - increase targeting`,
                    priority: 'high'
                });
            }
            if (data.count > 1000 && data.cvr < 2) {
                risks.push({
                    type: 'low_cvr_volume',
                    persona: def?.name || key,
                    message: `${def?.name || key} has ${data.count} contacts but only ${data.cvr}% CVR`,
                    priority: 'medium'
                });
            }
        });

        // Analyze ad performance
        if (totalSpend > 0) {
            const cpa = totalConversions > 0 ? totalSpend / totalConversions : null;
            if (cpa && cpa > 500000) {
                risks.push({
                    type: 'high_cpa',
                    message: `CPA is ${Math.round(cpa).toLocaleString()} VND - above target`,
                    priority: 'high'
                });
                actions.push({
                    action: 'Review ad targeting and creative',
                    urgency: 'today'
                });
            }
        }

        // Analyze SEO
        const avgPosition = seoData?.length > 0
            ? seoData.reduce((s, r) => s + (r.position || 0), 0) / seoData.length
            : null;

        if (avgPosition && avgPosition > 15) {
            opportunities.push({
                type: 'seo_improvement',
                message: `Average position is ${avgPosition.toFixed(1)} - SEO optimization needed`,
                priority: 'medium'
            });
        }

        // Default actions
        if (newToday < 10) {
            actions.push({
                action: 'Boost acquisition campaigns - low new contacts today',
                urgency: 'today'
            });
        }

        const report = {
            type: 'daily_strategy',
            date: today,
            generated_at: new Date().toISOString(),
            summary: {
                total_contacts: metrics.total_contacts || 0,
                change_from_yesterday: contactChange,
                new_today: newToday,
                subscribed: metrics.subscribed || 0,
                customers: metrics.customers || 0,
                ad_spend: totalSpend,
                ad_conversions: totalConversions,
                conversion_rate: metrics.leads > 0
                    ? ((metrics.customers / metrics.leads) * 100).toFixed(2) + '%'
                    : 'N/A'
            },
            opportunities,
            risks,
            actions,
            personas_snapshot: personas
        };

        // Save report
        await this.saveReport(report);

        return report;
    }

    /**
     * Generate weekly summary report
     * @param {Object} options - Report options
     * @returns {Promise<Object>} Weekly summary report
     */
    async generateWeeklySummary(options = {}) {
        const supabase = getSupabaseClient();
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        // Get metrics for the week
        const { data: weekMetrics } = await supabase
            .from('daily_metrics')
            .select('*')
            .gte('date', startDate.toISOString().split('T')[0])
            .lte('date', endDate.toISOString().split('T')[0])
            .order('date', { ascending: true });

        // Get previous week for comparison
        const prevEndDate = new Date(startDate);
        prevEndDate.setDate(prevEndDate.getDate() - 1);
        const prevStartDate = new Date(prevEndDate);
        prevStartDate.setDate(prevStartDate.getDate() - 7);

        const { data: prevWeekMetrics } = await supabase
            .from('daily_metrics')
            .select('*')
            .gte('date', prevStartDate.toISOString().split('T')[0])
            .lte('date', prevEndDate.toISOString().split('T')[0]);

        // Get ad performance
        const { data: adPerf } = await supabase
            .from('ad_performance')
            .select('*')
            .gte('date', startDate.toISOString().split('T')[0]);

        // Calculate weekly totals
        const latest = weekMetrics?.[weekMetrics.length - 1] || {};
        const earliest = weekMetrics?.[0] || {};
        const prevLatest = prevWeekMetrics?.[prevWeekMetrics.length - 1] || {};

        const newContacts = weekMetrics?.reduce((s, m) => s + (m.new_contacts_today || 0), 0) || 0;
        const prevNewContacts = prevWeekMetrics?.reduce((s, m) => s + (m.new_contacts_today || 0), 0) || 0;

        const totalSpend = adPerf?.reduce((s, r) => s + (r.spend || 0), 0) || 0;
        const totalConversions = adPerf?.reduce((s, r) => s + (r.conversions || 0), 0) || 0;

        // Calculate trends
        const contactGrowth = earliest.total_contacts > 0
            ? ((latest.total_contacts - earliest.total_contacts) / earliest.total_contacts * 100).toFixed(1)
            : 0;

        const acquisitionChange = prevNewContacts > 0
            ? ((newContacts - prevNewContacts) / prevNewContacts * 100).toFixed(1)
            : 0;

        // Generate insights
        const insights = [];
        const recommendations = [];

        if (parseFloat(contactGrowth) > 5) {
            insights.push({
                type: 'positive',
                message: `Strong growth: Contact base grew ${contactGrowth}% this week`
            });
        } else if (parseFloat(contactGrowth) < 0) {
            insights.push({
                type: 'warning',
                message: `Contact base declined ${Math.abs(contactGrowth)}% - check unsubscribes`
            });
            recommendations.push('Review email frequency and content quality');
        }

        if (parseFloat(acquisitionChange) > 20) {
            insights.push({
                type: 'positive',
                message: `Acquisition up ${acquisitionChange}% vs last week`
            });
        } else if (parseFloat(acquisitionChange) < -20) {
            insights.push({
                type: 'warning',
                message: `Acquisition down ${Math.abs(acquisitionChange)}% vs last week`
            });
            recommendations.push('Increase ad spend or diversify channels');
        }

        // Analyze by day of week
        const dayPerformance = {};
        weekMetrics?.forEach(m => {
            const day = new Date(m.date).toLocaleDateString('en-US', { weekday: 'long' });
            dayPerformance[day] = m.new_contacts_today || 0;
        });

        const bestDay = Object.entries(dayPerformance)
            .sort((a, b) => b[1] - a[1])[0];

        if (bestDay) {
            insights.push({
                type: 'info',
                message: `Best acquisition day: ${bestDay[0]} (${bestDay[1]} new contacts)`
            });
        }

        const report = {
            type: 'weekly_summary',
            period: {
                start: startDate.toISOString().split('T')[0],
                end: endDate.toISOString().split('T')[0]
            },
            generated_at: new Date().toISOString(),
            metrics: {
                total_contacts: latest.total_contacts || 0,
                contact_growth: contactGrowth + '%',
                new_contacts: newContacts,
                new_contacts_change: acquisitionChange + '%',
                subscribed: latest.subscribed || 0,
                customers: latest.customers || 0,
                ad_spend: totalSpend,
                ad_conversions: totalConversions,
                cpa: totalConversions > 0 ? Math.round(totalSpend / totalConversions) : null
            },
            day_performance: dayPerformance,
            insights,
            recommendations
        };

        await this.saveReport(report);
        return report;
    }

    /**
     * Generate persona deep dive report
     * @param {Object} options - Report options (persona required)
     * @returns {Promise<Object>} Persona deep dive report
     */
    async generatePersonaDeepDive(options = {}) {
        const { persona } = options;
        if (!persona) throw new Error('Persona key required');

        const supabase = getSupabaseClient();
        const personaDef = PERSONA_DEFINITIONS[persona];
        if (!personaDef) throw new Error(`Unknown persona: ${persona}`);

        // Get subscriber cache
        const { data: cache } = await supabase
            .from('subscriber_cache')
            .select('subscribers')
            .eq('cache_key', 'main')
            .single();

        // Get ad performance by campaign
        const { data: adPerf } = await supabase
            .from('ad_performance')
            .select('*')
            .order('date', { ascending: false })
            .limit(100);

        // Get latest metrics with persona breakdown
        const { data: metrics } = await supabase
            .from('daily_metrics')
            .select('personas')
            .order('date', { ascending: false })
            .limit(1)
            .single();

        const personaData = metrics?.personas?.[persona] || {};
        const subscribers = cache?.subscribers || [];

        // Analyze sources for this persona (simplified)
        const sources = {};
        let totalForPersona = 0;
        let convertedForPersona = 0;

        subscribers.forEach(s => {
            // In production, would use PersonaEngine to properly assign
            totalForPersona++;
            if (s.ct === 'customer') convertedForPersona++;
            const source = s.src || 'Unknown';
            sources[source] = (sources[source] || 0) + 1;
        });

        // Sort sources
        const topSources = Object.entries(sources)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // Generate recommendations
        const recommendations = [];

        if (personaDef.bestChannel) {
            recommendations.push({
                type: 'channel',
                message: `Focus on ${personaDef.bestChannel} for this persona`,
                reason: 'Historical best performer'
            });
        }

        if (personaDef.recommendedOffer) {
            recommendations.push({
                type: 'offer',
                message: `Lead with ${personaDef.recommendedOffer} offer`,
                reason: 'Matches persona price sensitivity'
            });
        }

        if (personaDef.nurturePriority) {
            recommendations.push({
                type: 'nurture',
                message: personaDef.nurturePriority,
                reason: 'Persona conversion pattern'
            });
        }

        const report = {
            type: 'persona_deep_dive',
            persona: persona,
            persona_name: personaDef.name,
            generated_at: new Date().toISOString(),
            profile: {
                description: personaDef.description,
                age_groups: personaDef.ageGroups,
                device_preference: personaDef.deviceTypes,
                priority: personaDef.priority
            },
            metrics: {
                count: personaData.count || totalForPersona,
                percentage: personaData.percentage || 'N/A',
                converted: personaData.converted || convertedForPersona,
                cvr: personaData.cvr || (totalForPersona > 0
                    ? ((convertedForPersona / totalForPersona) * 100).toFixed(2) + '%'
                    : 'N/A')
            },
            top_sources: topSources.map(([source, count]) => ({ source, count })),
            recommendations,
            targeting_tips: [
                `Target ${personaDef.ageGroups?.join(', ') || 'all ages'}`,
                personaDef.deviceTypes ? `Focus on ${personaDef.deviceTypes.join(', ')} users` : 'All devices',
                `Best channel: ${personaDef.bestChannel}`
            ]
        };

        await this.saveReport(report);
        return report;
    }

    /**
     * Generate channel analysis report
     * @param {Object} options - Report options
     * @returns {Promise<Object>} Channel analysis report
     */
    async generateChannelAnalysis(options = {}) {
        const supabase = getSupabaseClient();
        const days = options.days || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get ad performance
        const { data: adPerf } = await supabase
            .from('ad_performance')
            .select('*')
            .gte('date', startDate.toISOString().split('T')[0]);

        // Aggregate by provider
        const channels = {};
        (adPerf || []).forEach(row => {
            const ch = row.provider || 'unknown';
            if (!channels[ch]) {
                channels[ch] = {
                    spend: 0,
                    impressions: 0,
                    clicks: 0,
                    conversions: 0,
                    campaigns: new Set()
                };
            }
            channels[ch].spend += row.spend || 0;
            channels[ch].impressions += row.impressions || 0;
            channels[ch].clicks += row.clicks || 0;
            channels[ch].conversions += row.conversions || 0;
            if (row.campaign_id) channels[ch].campaigns.add(row.campaign_id);
        });

        // Calculate metrics and rankings
        const channelAnalysis = {};
        let totalSpend = 0;
        let totalConversions = 0;

        Object.entries(channels).forEach(([ch, data]) => {
            totalSpend += data.spend;
            totalConversions += data.conversions;

            channelAnalysis[ch] = {
                spend: data.spend,
                impressions: data.impressions,
                clicks: data.clicks,
                conversions: data.conversions,
                campaigns_count: data.campaigns.size,
                ctr: data.impressions > 0 ? ((data.clicks / data.impressions) * 100).toFixed(2) + '%' : 'N/A',
                cvr: data.clicks > 0 ? ((data.conversions / data.clicks) * 100).toFixed(2) + '%' : 'N/A',
                cpa: data.conversions > 0 ? Math.round(data.spend / data.conversions) : null,
                cpc: data.clicks > 0 ? Math.round(data.spend / data.clicks) : null
            };
        });

        // Rank channels
        const rankings = {
            by_conversions: Object.entries(channelAnalysis)
                .sort((a, b) => b[1].conversions - a[1].conversions)
                .map(([ch]) => ch),
            by_efficiency: Object.entries(channelAnalysis)
                .filter(([, d]) => d.cpa !== null)
                .sort((a, b) => a[1].cpa - b[1].cpa)
                .map(([ch]) => ch)
        };

        // Generate insights
        const insights = [];
        const recommendations = [];

        if (rankings.by_efficiency.length > 0) {
            const bestChannel = rankings.by_efficiency[0];
            const bestCPA = channelAnalysis[bestChannel].cpa;
            insights.push({
                type: 'efficiency',
                message: `${bestChannel} has lowest CPA at ${bestCPA?.toLocaleString()} VND`
            });

            if (rankings.by_efficiency.length > 1) {
                const worstChannel = rankings.by_efficiency[rankings.by_efficiency.length - 1];
                const worstCPA = channelAnalysis[worstChannel].cpa;
                if (worstCPA > bestCPA * 2) {
                    recommendations.push({
                        action: `Consider shifting budget from ${worstChannel} to ${bestChannel}`,
                        reason: `CPA difference: ${worstCPA?.toLocaleString()} vs ${bestCPA?.toLocaleString()} VND`
                    });
                }
            }
        }

        const report = {
            type: 'channel_analysis',
            period: {
                days,
                start: startDate.toISOString().split('T')[0],
                end: new Date().toISOString().split('T')[0]
            },
            generated_at: new Date().toISOString(),
            totals: {
                spend: totalSpend,
                conversions: totalConversions,
                avg_cpa: totalConversions > 0 ? Math.round(totalSpend / totalConversions) : null
            },
            channels: channelAnalysis,
            rankings,
            insights,
            recommendations
        };

        await this.saveReport(report);
        return report;
    }

    /**
     * Generate SEO audit report
     * @param {Object} options - Report options
     * @returns {Promise<Object>} SEO audit report
     */
    async generateSEOAudit(options = {}) {
        const supabase = getSupabaseClient();

        // Get SEO data
        const { data: seoData } = await supabase
            .from('seo_performance')
            .select('*')
            .order('date', { ascending: false })
            .limit(200);

        // Aggregate metrics
        const totals = {
            clicks: 0,
            impressions: 0,
            queries: new Set(),
            pages: new Set()
        };

        const queryPerformance = {};
        const pagePerformance = {};

        (seoData || []).forEach(row => {
            totals.clicks += row.clicks || 0;
            totals.impressions += row.impressions || 0;

            if (row.query) {
                totals.queries.add(row.query);
                if (!queryPerformance[row.query]) {
                    queryPerformance[row.query] = { clicks: 0, impressions: 0, positions: [] };
                }
                queryPerformance[row.query].clicks += row.clicks || 0;
                queryPerformance[row.query].impressions += row.impressions || 0;
                if (row.position) queryPerformance[row.query].positions.push(row.position);
            }

            if (row.page) {
                totals.pages.add(row.page);
                if (!pagePerformance[row.page]) {
                    pagePerformance[row.page] = { clicks: 0, impressions: 0 };
                }
                pagePerformance[row.page].clicks += row.clicks || 0;
                pagePerformance[row.page].impressions += row.impressions || 0;
            }
        });

        // Find opportunities (position 5-20, high impressions)
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

        // Top performers
        const topQueries = Object.entries(queryPerformance)
            .sort((a, b) => b[1].clicks - a[1].clicks)
            .slice(0, 10)
            .map(([query, data]) => ({ query, ...data }));

        const topPages = Object.entries(pagePerformance)
            .sort((a, b) => b[1].clicks - a[1].clicks)
            .slice(0, 10)
            .map(([page, data]) => ({ page, ...data }));

        // Generate recommendations
        const recommendations = [];

        if (opportunities.length > 0) {
            recommendations.push({
                type: 'quick_wins',
                message: `${opportunities.length} queries ranking 5-20 with high impressions`,
                action: 'Optimize content for these keywords to reach top 3'
            });
        }

        const avgCTR = totals.impressions > 0
            ? (totals.clicks / totals.impressions * 100)
            : 0;

        if (avgCTR < 2) {
            recommendations.push({
                type: 'ctr_improvement',
                message: `Average CTR is ${avgCTR.toFixed(2)}% - below industry average`,
                action: 'Improve meta titles and descriptions'
            });
        }

        const report = {
            type: 'seo_audit',
            generated_at: new Date().toISOString(),
            overview: {
                total_clicks: totals.clicks,
                total_impressions: totals.impressions,
                avg_ctr: avgCTR.toFixed(2) + '%',
                unique_queries: totals.queries.size,
                unique_pages: totals.pages.size
            },
            top_queries: topQueries,
            top_pages: topPages,
            opportunities: opportunities.map(o => ({
                query: o.query,
                position: o.avgPosition?.toFixed(1),
                impressions: o.impressions,
                current_clicks: o.clicks,
                potential: 'Move to top 3 for ~10% CTR'
            })),
            recommendations
        };

        await this.saveReport(report);
        return report;
    }

    /**
     * Generate conversion funnel report
     * @param {Object} options - Report options
     * @returns {Promise<Object>} Conversion funnel report
     */
    async generateConversionFunnel(options = {}) {
        const supabase = getSupabaseClient();

        // Get metrics
        const { data: metrics } = await supabase
            .from('daily_metrics')
            .select('*')
            .order('date', { ascending: false })
            .limit(1)
            .single();

        // Get subscriber cache for detailed analysis
        const { data: cache } = await supabase
            .from('subscriber_cache')
            .select('subscribers, subscriber_count')
            .eq('cache_key', 'main')
            .single();

        const total = metrics?.total_contacts || 0;
        const subscribed = metrics?.subscribed || 0;
        const pending = metrics?.pending || 0;
        const leads = metrics?.leads || 0;
        const customers = metrics?.customers || 0;

        // Calculate funnel stages
        const funnel = [
            {
                stage: 'Total Contacts',
                count: total,
                percentage: '100%',
                drop_off: null
            },
            {
                stage: 'Subscribed',
                count: subscribed,
                percentage: total > 0 ? ((subscribed / total) * 100).toFixed(1) + '%' : 'N/A',
                drop_off: total > 0 ? ((total - subscribed) / total * 100).toFixed(1) + '%' : null
            },
            {
                stage: 'Engaged (Leads)',
                count: leads,
                percentage: total > 0 ? ((leads / total) * 100).toFixed(1) + '%' : 'N/A',
                drop_off: subscribed > 0 ? ((subscribed - leads) / subscribed * 100).toFixed(1) + '%' : null
            },
            {
                stage: 'Converted (Customers)',
                count: customers,
                percentage: total > 0 ? ((customers / total) * 100).toFixed(1) + '%' : 'N/A',
                drop_off: leads > 0 ? ((leads - customers) / leads * 100).toFixed(1) + '%' : null
            }
        ];

        // Identify bottlenecks
        const bottlenecks = [];

        if (subscribed / total < 0.5) {
            bottlenecks.push({
                stage: 'Contacts → Subscribed',
                issue: 'Low subscription rate',
                recommendation: 'Improve opt-in forms and value proposition'
            });
        }

        if (leads > 0 && customers / leads < 0.05) {
            bottlenecks.push({
                stage: 'Leads → Customers',
                issue: 'Low conversion rate',
                recommendation: 'Review nurture sequences and offer pricing'
            });
        }

        const report = {
            type: 'conversion_funnel',
            generated_at: new Date().toISOString(),
            funnel,
            overall_conversion: total > 0 ? ((customers / total) * 100).toFixed(2) + '%' : 'N/A',
            bottlenecks,
            recommendations: bottlenecks.map(b => b.recommendation)
        };

        await this.saveReport(report);
        return report;
    }

    /**
     * Save report to database
     * @param {Object} report - Report to save
     */
    async saveReport(report) {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        const today = new Date().toISOString().split('T')[0];

        await supabase.from('ai_reports').upsert({
            report_type: report.type,
            report_date: today,
            content: JSON.stringify(report),
            metadata: {
                generated_at: report.generated_at
            }
        }, { onConflict: 'report_type,report_date' });

        logAuditEvent('report_generated', {
            report_type: report.type,
            date: today
        });
    }

    /**
     * Get latest report of a type
     * @param {string} reportType - Report type
     * @returns {Promise<Object|null>} Latest report
     */
    async getLatestReport(reportType) {
        const supabase = getSupabaseClient();
        if (!supabase) return null;

        const { data, error } = await supabase
            .from('ai_reports')
            .select('*')
            .eq('report_type', reportType)
            .order('report_date', { ascending: false })
            .limit(1)
            .single();

        if (error || !data) return null;

        return JSON.parse(data.content);
    }

    /**
     * Get all reports for a date
     * @param {string} date - Date (YYYY-MM-DD)
     * @returns {Promise<Array>} Reports for date
     */
    async getReportsForDate(date) {
        const supabase = getSupabaseClient();
        if (!supabase) return [];

        const { data, error } = await supabase
            .from('ai_reports')
            .select('*')
            .eq('report_date', date);

        if (error) return [];

        return data.map(r => ({
            type: r.report_type,
            date: r.report_date,
            report: JSON.parse(r.content)
        }));
    }
}

// Singleton instance
let insightsEngineInstance = null;

/**
 * Get InsightsEngine singleton
 * @returns {InsightsEngine}
 */
export function getInsightsEngine() {
    if (!insightsEngineInstance) {
        insightsEngineInstance = new InsightsEngine();
    }
    return insightsEngineInstance;
}

export default InsightsEngine;
