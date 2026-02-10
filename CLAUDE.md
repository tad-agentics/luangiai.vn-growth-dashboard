# Growth Intelligence Platform - AI co-CGO

This project is a unified Growth Intelligence Platform that combines CRM, Ads APIs, and SEO data with Claude as an AI co-Chief Growth Officer.

## Quick Start

```bash
# Run MCP server
npm run mcp

# Development mode with auto-reload
npm run mcp:dev
```

## MCP Server

The MCP server (`src/mcp/MCPServer.js`) exposes dashboard data through tools and resources.

### Available Tools

| Tool | Description |
|------|-------------|
| `get_growth_summary` | Get current metrics across CRM, Ads, and SEO |
| `analyze_persona` | Deep dive into a specific NRU persona |
| `compare_channels` | Compare performance across marketing channels |
| `get_seo_insights` | Get SEO data from GA4 and GSC |
| `save_insight` | Save a memory for future recall |
| `recall_memories` | Retrieve relevant past context |
| `generate_report` | Generate AI-powered analysis reports |
| `get_subscriber_segments` | Get detailed subscriber segmentation |

### Available Resources

| URI | Description |
|-----|-------------|
| `growth://dashboard/overview` | Current dashboard state |
| `growth://personas/all` | Complete persona breakdown |
| `growth://memory/recent` | Recent AI memories |
| `growth://ads/summary` | Cross-platform ad performance |
| `growth://seo/summary` | Organic search performance |

### Memory System

The AI can remember and recall:
- **Decisions**: Strategic choices made (retained 1 year)
- **Insights**: Data-driven discoveries (retained 90 days)
- **Preferences**: User preferences (retained 6 months)
- **Facts**: Business facts (retained 6 months)

## Project Structure

```
/fluentcrm-dashboard
├── src/
│   ├── config/          # Constants, Supabase config
│   ├── core/            # DataStore, EventBus
│   ├── connectors/      # API connectors (FluentCRM, Ads, SEO)
│   ├── analytics/       # PersonaEngine, GrowthEngine
│   ├── ui/              # ChartManager, AdsManager
│   ├── ai/              # MemoryManager, InsightsEngine
│   └── mcp/             # MCP Server
├── api/
│   ├── oauth/           # OAuth handler (dynamic routes)
│   ├── reports/         # Report generation APIs
│   ├── cron/            # Scheduled jobs
│   └── lib/             # Shared utilities
├── dashboard.js         # Main dashboard (legacy)
├── index.html           # Dashboard UI
└── vercel.json          # Vercel deployment config
```

## Data Sources

- **FluentCRM**: 16K+ subscribers with persona segmentation
- **Google Ads**: Campaign performance via OAuth
- **Meta Ads**: Facebook/Instagram campaigns
- **TikTok Ads**: TikTok marketing campaigns
- **Google Analytics 4**: Website traffic and conversions
- **Google Search Console**: Organic search performance

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/oauth/{provider}/init` | GET | Start OAuth flow |
| `/api/oauth/{provider}/callback` | GET | OAuth callback |
| `/api/oauth/{provider}/refresh` | POST | Refresh tokens |
| `/api/reports/generate` | POST | Generate AI report |
| `/api/reports/latest` | GET | Get latest reports |
| `/api/cron/daily-reports` | GET | Daily report cron job |

### Supported OAuth Providers
- `google` - Google Ads
- `meta` - Meta (Facebook) Ads
- `tiktok` - TikTok Ads
- `ga4` - Google Analytics 4
- `gsc` - Google Search Console

## Report Types

| Type | Description |
|------|-------------|
| `daily_strategy` | Daily opportunities, risks, and actions |
| `weekly_summary` | Week performance and trends |
| `channel_analysis` | Cross-channel ad comparison |
| `seo_audit` | SEO performance and opportunities |

## NRU Personas

| Persona | Age | Device | Best Channel |
|---------|-----|--------|--------------|
| Gen Z Explorer | 18-24 | Any | TikTok Organic |
| Career Climber | 25-34 | Mobile | Facebook Ads |
| Desktop Researcher | 25-44 | Desktop | SEO / Desktop FB |
| Life Transition | 35-44 | Mobile | Zalo OA |
| Established Buyer | 45+ | Any | Direct / Referral |
| Mystery Visitor | Unknown | Unknown | Progressive profiling |

## Environment Variables

Required for Vercel deployment:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anon/public key
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth secret
- `META_APP_ID` - Meta/Facebook app ID
- `META_APP_SECRET` - Meta/Facebook app secret
- `TIKTOK_CLIENT_KEY` - TikTok client key
- `TIKTOK_CLIENT_SECRET` - TikTok client secret
- `CRON_SECRET` - Secret for cron job authentication

## Currency

All monetary values are in VND (Vietnamese Dong).

## Database Tables (Supabase)

- `subscriber_cache` - Cached FluentCRM subscribers
- `daily_metrics` - Daily aggregated metrics
- `ad_performance` - Ads data by platform
- `seo_performance` - GSC/GA4 data
- `oauth_tokens` - OAuth credentials
- `ai_memory` - AI context memory
- `ai_reports` - Generated reports
- `audit_log` - Activity logging
- `config` - App configuration
