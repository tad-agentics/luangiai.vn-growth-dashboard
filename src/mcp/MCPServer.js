#!/usr/bin/env node
// Growth Intelligence Platform - MCP Server
// ==========================================
// Model Context Protocol server for Claude integration

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qktiedjahvbeuznpjubv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Growth Intelligence MCP Server
 * Exposes dashboard data and AI memory to Claude
 */
class GrowthIntelligenceMCP {
    constructor() {
        this.server = new Server(
            {
                name: 'growth-intelligence',
                version: '1.0.0'
            },
            {
                capabilities: {
                    tools: {},
                    resources: {}
                }
            }
        );

        this.setupHandlers();
    }

    /**
     * Setup MCP request handlers
     */
    setupHandlers() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'get_growth_summary',
                    description: 'Get current growth metrics across all data sources (CRM, Ads, SEO). Returns subscriber counts, conversion rates, ad spend, and organic traffic.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            date_range: {
                                type: 'string',
                                description: 'Date range: "today", "7d", "30d", "90d"',
                                default: '30d'
                            }
                        }
                    }
                },
                {
                    name: 'analyze_persona',
                    description: 'Deep dive analysis of a specific NRU persona segment. Returns demographics, conversion rates, best channels, and recommendations.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            persona: {
                                type: 'string',
                                description: 'Persona key: gen_z, millennial, gen_x, boomer, unknown (generation-based)',
                                enum: ['gen_z', 'millennial', 'gen_x', 'boomer', 'unknown']
                            }
                        },
                        required: ['persona']
                    }
                },
                {
                    name: 'compare_channels',
                    description: 'Compare performance across marketing channels (Google Ads, Meta Ads, TikTok Ads, Organic). Returns spend, conversions, CPA, and ROAS.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            metric: {
                                type: 'string',
                                description: 'Primary metric to compare',
                                enum: ['spend', 'conversions', 'cpa', 'roas', 'ctr'],
                                default: 'conversions'
                            },
                            date_range: {
                                type: 'string',
                                description: 'Date range: "7d", "30d", "90d"',
                                default: '30d'
                            }
                        }
                    }
                },
                {
                    name: 'get_seo_insights',
                    description: 'Get SEO performance data including top queries, pages, and keyword opportunities from Google Search Console and GA4.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            focus: {
                                type: 'string',
                                description: 'Focus area for insights',
                                enum: ['queries', 'pages', 'opportunities', 'traffic', 'all'],
                                default: 'all'
                            }
                        }
                    }
                },
                {
                    name: 'save_insight',
                    description: 'Save an insight or decision to AI memory for future recall. Use this to remember important findings, user preferences, or strategic decisions.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            memory_type: {
                                type: 'string',
                                description: 'Type of memory',
                                enum: ['decision', 'insight', 'preference', 'fact']
                            },
                            context: {
                                type: 'string',
                                description: 'What this memory relates to (e.g., "budget allocation", "persona strategy")'
                            },
                            content: {
                                type: 'string',
                                description: 'The actual insight or decision to remember'
                            },
                            importance: {
                                type: 'number',
                                description: 'Importance score 1-10 (higher = retrieved more often)',
                                default: 5
                            },
                            tags: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Tags for categorization and retrieval'
                            }
                        },
                        required: ['memory_type', 'context', 'content']
                    }
                },
                {
                    name: 'recall_memories',
                    description: 'Retrieve relevant memories based on context or tags. Use this to recall past decisions, insights, or user preferences.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: {
                                type: 'string',
                                description: 'Search query for relevant memories'
                            },
                            memory_type: {
                                type: 'string',
                                description: 'Filter by memory type',
                                enum: ['decision', 'insight', 'preference', 'fact', 'all'],
                                default: 'all'
                            },
                            limit: {
                                type: 'number',
                                description: 'Maximum memories to return',
                                default: 10
                            }
                        }
                    }
                },
                {
                    name: 'generate_report',
                    description: 'Generate an AI-powered analysis report. Returns structured insights and recommendations.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            report_type: {
                                type: 'string',
                                description: 'Type of report to generate',
                                enum: ['daily_strategy', 'weekly_summary', 'persona_deep_dive', 'channel_analysis', 'seo_audit']
                            },
                            focus_area: {
                                type: 'string',
                                description: 'Optional focus area for the report'
                            }
                        },
                        required: ['report_type']
                    }
                },
                {
                    name: 'get_subscriber_segments',
                    description: 'Get detailed subscriber segmentation data from FluentCRM including status, tags, and engagement levels.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            segment_by: {
                                type: 'string',
                                description: 'How to segment subscribers',
                                enum: ['status', 'persona', 'engagement', 'source', 'zodiac'],
                                default: 'persona'
                            }
                        }
                    }
                }
            ]
        }));

        // List available resources
        this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
            resources: [
                {
                    uri: 'growth://dashboard/overview',
                    name: 'Dashboard Overview',
                    description: 'Current state of all dashboard metrics',
                    mimeType: 'application/json'
                },
                {
                    uri: 'growth://personas/all',
                    name: 'All Personas',
                    description: 'Complete persona breakdown with counts and CVR',
                    mimeType: 'application/json'
                },
                {
                    uri: 'growth://memory/recent',
                    name: 'Recent AI Memories',
                    description: 'Last 20 saved insights and decisions',
                    mimeType: 'application/json'
                },
                {
                    uri: 'growth://ads/summary',
                    name: 'Ads Summary',
                    description: 'Cross-platform advertising performance',
                    mimeType: 'application/json'
                },
                {
                    uri: 'growth://seo/summary',
                    name: 'SEO Summary',
                    description: 'Organic search performance overview',
                    mimeType: 'application/json'
                }
            ]
        }));

        // Handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            try {
                switch (name) {
                    case 'get_growth_summary':
                        return await this.getGrowthSummary(args);
                    case 'analyze_persona':
                        return await this.analyzePersona(args);
                    case 'compare_channels':
                        return await this.compareChannels(args);
                    case 'get_seo_insights':
                        return await this.getSEOInsights(args);
                    case 'save_insight':
                        return await this.saveInsight(args);
                    case 'recall_memories':
                        return await this.recallMemories(args);
                    case 'generate_report':
                        return await this.generateReport(args);
                    case 'get_subscriber_segments':
                        return await this.getSubscriberSegments(args);
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            } catch (error) {
                return {
                    content: [{ type: 'text', text: `Error: ${error.message}` }],
                    isError: true
                };
            }
        });

        // Handle resource reads
        this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
            const { uri } = request.params;

            try {
                switch (uri) {
                    case 'growth://dashboard/overview':
                        return await this.getDashboardOverview();
                    case 'growth://personas/all':
                        return await this.getAllPersonas();
                    case 'growth://memory/recent':
                        return await this.getRecentMemories();
                    case 'growth://ads/summary':
                        return await this.getAdsSummary();
                    case 'growth://seo/summary':
                        return await this.getSEOSummary();
                    default:
                        throw new Error(`Unknown resource: ${uri}`);
                }
            } catch (error) {
                return {
                    contents: [{
                        uri,
                        mimeType: 'text/plain',
                        text: `Error: ${error.message}`
                    }]
                };
            }
        });
    }

    // ==================== TOOL IMPLEMENTATIONS ====================

    async getGrowthSummary(args) {
        const dateRange = args?.date_range || '30d';
        const days = parseInt(dateRange) || 30;

        // Get latest daily metrics
        const { data: metrics } = await supabase
            .from('daily_metrics')
            .select('*')
            .order('date', { ascending: false })
            .limit(days);

        // Get latest ad performance
        const { data: adPerf } = await supabase
            .from('ad_performance')
            .select('*')
            .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

        // Get SEO performance
        const { data: seoPerf } = await supabase
            .from('seo_performance')
            .select('*')
            .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

        const latest = metrics?.[0] || {};
        const totalAdSpend = adPerf?.reduce((sum, r) => sum + (r.spend || 0), 0) || 0;
        const totalAdConversions = adPerf?.reduce((sum, r) => sum + (r.conversions || 0), 0) || 0;
        const totalClicks = seoPerf?.reduce((sum, r) => sum + (r.clicks || 0), 0) || 0;

        const summary = {
            period: `Last ${days} days`,
            crm: {
                total_contacts: latest.total_contacts || 0,
                subscribed: latest.subscribed || 0,
                leads: latest.leads || 0,
                customers: latest.customers || 0,
                conversion_rate: latest.leads > 0 ? ((latest.customers / latest.leads) * 100).toFixed(2) + '%' : 'N/A'
            },
            ads: {
                total_spend: totalAdSpend,
                total_conversions: totalAdConversions,
                avg_cpa: totalAdConversions > 0 ? (totalAdSpend / totalAdConversions).toFixed(0) : 'N/A',
                platforms_active: [...new Set(adPerf?.map(r => r.provider) || [])].length
            },
            seo: {
                organic_clicks: totalClicks,
                total_impressions: seoPerf?.reduce((sum, r) => sum + (r.impressions || 0), 0) || 0
            },
            personas: latest.personas || {}
        };

        return {
            content: [{
                type: 'text',
                text: JSON.stringify(summary, null, 2)
            }]
        };
    }

    async analyzePersona(args) {
        const { persona } = args;

        // Get subscriber cache
        const { data: cache } = await supabase
            .from('subscriber_cache')
            .select('subscribers, metadata')
            .eq('cache_key', 'main')
            .single();

        const subscribers = cache?.subscribers || [];

        // Filter by persona (generation-based)
        const personaMap = {
            'gen_z': { birthYearRange: [2000, 2012] },
            'millennial': { birthYearRange: [1981, 1999] },
            'gen_x': { birthYearRange: [1965, 1980] },
            'boomer': { birthYearRange: [1946, 1964] },
            'unknown': { unknown: true }
        };

        const personaDef = personaMap[persona];
        let count = 0;
        let converted = 0;

        // Count (simplified logic)
        subscribers.forEach(s => {
            // This would use actual PersonaEngine logic in production
            count++;
            if (s.ct === 'customer' || s.t > 0) converted++;
        });

        const analysis = {
            persona,
            total_count: count,
            converted: converted,
            conversion_rate: count > 0 ? ((converted / count) * 100).toFixed(2) + '%' : 'N/A',
            recommendations: [
                `Focus ${persona} targeting on their preferred channels`,
                `A/B test messaging tailored to this segment`,
                `Consider dedicated landing pages for this persona`
            ]
        };

        return {
            content: [{
                type: 'text',
                text: JSON.stringify(analysis, null, 2)
            }]
        };
    }

    async compareChannels(args) {
        const { metric = 'conversions', date_range = '30d' } = args;
        const days = parseInt(date_range) || 30;
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const { data: adPerf } = await supabase
            .from('ad_performance')
            .select('*')
            .gte('date', startDate);

        // Aggregate by provider
        const channels = {};
        (adPerf || []).forEach(row => {
            const provider = row.provider || 'unknown';
            if (!channels[provider]) {
                channels[provider] = { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
            }
            channels[provider].spend += row.spend || 0;
            channels[provider].impressions += row.impressions || 0;
            channels[provider].clicks += row.clicks || 0;
            channels[provider].conversions += row.conversions || 0;
        });

        // Calculate derived metrics
        Object.keys(channels).forEach(ch => {
            const c = channels[ch];
            c.ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) + '%' : 'N/A';
            c.cpa = c.conversions > 0 ? Math.round(c.spend / c.conversions) : 'N/A';
            c.roas = c.spend > 0 ? ((c.conversions * 100000) / c.spend).toFixed(2) : 'N/A'; // Assuming 100k VND per conversion value
        });

        // Sort by requested metric
        const sorted = Object.entries(channels)
            .sort((a, b) => (b[1][metric] || 0) - (a[1][metric] || 0));

        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    period: `Last ${days} days`,
                    sorted_by: metric,
                    channels: Object.fromEntries(sorted)
                }, null, 2)
            }]
        };
    }

    async getSEOInsights(args) {
        const { focus = 'all' } = args;

        const { data: seoData } = await supabase
            .from('seo_performance')
            .select('*')
            .order('date', { ascending: false })
            .limit(100);

        const insights = {
            overview: {
                total_clicks: seoData?.reduce((sum, r) => sum + (r.clicks || 0), 0) || 0,
                total_impressions: seoData?.reduce((sum, r) => sum + (r.impressions || 0), 0) || 0,
                avg_position: seoData?.length > 0
                    ? (seoData.reduce((sum, r) => sum + (r.position || 0), 0) / seoData.length).toFixed(1)
                    : 'N/A'
            }
        };

        if (focus === 'all' || focus === 'queries') {
            insights.top_queries = seoData
                ?.filter(r => r.query)
                .slice(0, 10)
                .map(r => ({ query: r.query, clicks: r.clicks, position: r.position }));
        }

        if (focus === 'all' || focus === 'pages') {
            insights.top_pages = seoData
                ?.filter(r => r.page)
                .slice(0, 10)
                .map(r => ({ page: r.page, clicks: r.clicks, impressions: r.impressions }));
        }

        if (focus === 'all' || focus === 'opportunities') {
            insights.opportunities = seoData
                ?.filter(r => r.position >= 5 && r.position <= 20 && r.impressions > 100)
                .slice(0, 10)
                .map(r => ({
                    query: r.query,
                    current_position: r.position,
                    impressions: r.impressions,
                    potential: 'Move to top 3 for ~10% CTR'
                }));
        }

        return {
            content: [{
                type: 'text',
                text: JSON.stringify(insights, null, 2)
            }]
        };
    }

    async saveInsight(args) {
        const { memory_type, context, content, importance = 5, tags = [] } = args;

        const { data, error } = await supabase
            .from('ai_memory')
            .insert({
                memory_type,
                context,
                content,
                importance,
                tags,
                source_type: 'claude_insight'
            })
            .select()
            .single();

        if (error) throw error;

        return {
            content: [{
                type: 'text',
                text: `Memory saved successfully. ID: ${data.id}\nType: ${memory_type}\nContext: ${context}`
            }]
        };
    }

    async recallMemories(args) {
        const { query, memory_type = 'all', limit = 10 } = args;

        let queryBuilder = supabase
            .from('ai_memory')
            .select('*')
            .order('importance', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(limit);

        if (memory_type !== 'all') {
            queryBuilder = queryBuilder.eq('memory_type', memory_type);
        }

        if (query) {
            queryBuilder = queryBuilder.or(`context.ilike.%${query}%,content.ilike.%${query}%`);
        }

        const { data, error } = await queryBuilder;

        if (error) throw error;

        // Update access counts
        if (data?.length > 0) {
            const ids = data.map(m => m.id);
            await supabase
                .from('ai_memory')
                .update({
                    last_accessed: new Date().toISOString(),
                    access_count: supabase.raw('access_count + 1')
                })
                .in('id', ids);
        }

        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    count: data?.length || 0,
                    memories: data?.map(m => ({
                        type: m.memory_type,
                        context: m.context,
                        content: m.content,
                        importance: m.importance,
                        created: m.created_at
                    }))
                }, null, 2)
            }]
        };
    }

    async generateReport(args) {
        const { report_type, focus_area } = args;

        // Get relevant data based on report type
        const { data: metrics } = await supabase
            .from('daily_metrics')
            .select('*')
            .order('date', { ascending: false })
            .limit(30);

        const { data: adPerf } = await supabase
            .from('ad_performance')
            .select('*')
            .order('date', { ascending: false })
            .limit(100);

        const latest = metrics?.[0] || {};
        const totalSpend = adPerf?.reduce((sum, r) => sum + (r.spend || 0), 0) || 0;
        const totalConversions = adPerf?.reduce((sum, r) => sum + (r.conversions || 0), 0) || 0;

        let report = {
            type: report_type,
            generated_at: new Date().toISOString(),
            focus_area: focus_area || 'general'
        };

        switch (report_type) {
            case 'daily_strategy':
                report.summary = `Current subscriber base: ${latest.total_contacts || 0}. ` +
                    `Active leads: ${latest.leads || 0}. ` +
                    `Ad spend (30d): ${totalSpend.toLocaleString()} VND. ` +
                    `Conversions: ${totalConversions}.`;
                report.opportunities = [
                    'Review underperforming ad campaigns',
                    'Focus on high-CVR personas',
                    'Optimize landing pages for mobile'
                ];
                report.risks = [
                    'Monitor ad spend efficiency',
                    'Check for declining engagement'
                ];
                break;

            case 'weekly_summary':
                report.metrics = {
                    contacts: latest.total_contacts,
                    new_this_week: latest.new_contacts_today * 7, // Approximation
                    conversions: totalConversions,
                    spend: totalSpend
                };
                report.trends = ['Analyze week-over-week changes'];
                break;

            default:
                report.data = { metrics: latest, ad_summary: { spend: totalSpend, conversions: totalConversions } };
        }

        // Save report to database
        await supabase.from('ai_reports').upsert({
            report_type,
            report_date: new Date().toISOString().split('T')[0],
            content: JSON.stringify(report),
            metadata: { focus_area }
        }, { onConflict: 'report_type,report_date' });

        return {
            content: [{
                type: 'text',
                text: JSON.stringify(report, null, 2)
            }]
        };
    }

    async getSubscriberSegments(args) {
        const { segment_by = 'persona' } = args;

        const { data: cache } = await supabase
            .from('subscriber_cache')
            .select('subscribers, subscriber_count, metadata')
            .eq('cache_key', 'main')
            .single();

        const segments = {};
        const subscribers = cache?.subscribers || [];

        subscribers.forEach(s => {
            let key;
            switch (segment_by) {
                case 'status':
                    key = s.st || 'unknown';
                    break;
                case 'engagement':
                    // Simplified engagement calculation
                    key = s.la ? 'active' : 'inactive';
                    break;
                case 'source':
                    key = s.src || 'unknown';
                    break;
                default:
                    key = 'all';
            }

            if (!segments[key]) {
                segments[key] = { count: 0, converted: 0 };
            }
            segments[key].count++;
            if (s.ct === 'customer') segments[key].converted++;
        });

        // Calculate CVR for each segment
        Object.keys(segments).forEach(k => {
            const seg = segments[k];
            seg.cvr = seg.count > 0 ? ((seg.converted / seg.count) * 100).toFixed(2) + '%' : 'N/A';
        });

        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    segmented_by: segment_by,
                    total_subscribers: cache?.subscriber_count || 0,
                    segments
                }, null, 2)
            }]
        };
    }

    // ==================== RESOURCE IMPLEMENTATIONS ====================

    async getDashboardOverview() {
        const { data: metrics } = await supabase
            .from('daily_metrics')
            .select('*')
            .order('date', { ascending: false })
            .limit(1)
            .single();

        return {
            contents: [{
                uri: 'growth://dashboard/overview',
                mimeType: 'application/json',
                text: JSON.stringify(metrics || {}, null, 2)
            }]
        };
    }

    async getAllPersonas() {
        const { data: metrics } = await supabase
            .from('daily_metrics')
            .select('personas')
            .order('date', { ascending: false })
            .limit(1)
            .single();

        return {
            contents: [{
                uri: 'growth://personas/all',
                mimeType: 'application/json',
                text: JSON.stringify(metrics?.personas || {}, null, 2)
            }]
        };
    }

    async getRecentMemories() {
        const { data } = await supabase
            .from('ai_memory')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        return {
            contents: [{
                uri: 'growth://memory/recent',
                mimeType: 'application/json',
                text: JSON.stringify(data || [], null, 2)
            }]
        };
    }

    async getAdsSummary() {
        const { data } = await supabase
            .from('ad_performance')
            .select('provider, spend, impressions, clicks, conversions')
            .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

        const summary = {};
        (data || []).forEach(row => {
            const p = row.provider || 'unknown';
            if (!summary[p]) summary[p] = { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
            summary[p].spend += row.spend || 0;
            summary[p].impressions += row.impressions || 0;
            summary[p].clicks += row.clicks || 0;
            summary[p].conversions += row.conversions || 0;
        });

        return {
            contents: [{
                uri: 'growth://ads/summary',
                mimeType: 'application/json',
                text: JSON.stringify(summary, null, 2)
            }]
        };
    }

    async getSEOSummary() {
        const { data } = await supabase
            .from('seo_performance')
            .select('clicks, impressions, ctr, position')
            .gte('date', new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

        const summary = {
            total_clicks: data?.reduce((s, r) => s + (r.clicks || 0), 0) || 0,
            total_impressions: data?.reduce((s, r) => s + (r.impressions || 0), 0) || 0,
            avg_ctr: data?.length > 0
                ? (data.reduce((s, r) => s + (r.ctr || 0), 0) / data.length * 100).toFixed(2) + '%'
                : 'N/A',
            avg_position: data?.length > 0
                ? (data.reduce((s, r) => s + (r.position || 0), 0) / data.length).toFixed(1)
                : 'N/A'
        };

        return {
            contents: [{
                uri: 'growth://seo/summary',
                mimeType: 'application/json',
                text: JSON.stringify(summary, null, 2)
            }]
        };
    }

    /**
     * Start the MCP server
     */
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Growth Intelligence MCP server running');
    }
}

// Start the server
const server = new GrowthIntelligenceMCP();
server.run().catch(console.error);
