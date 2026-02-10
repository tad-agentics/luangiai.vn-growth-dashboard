# Luangiai.vn Growth Intelligence Platform

A unified Growth Intelligence Platform that combines CRM, Ads APIs, and SEO data with Claude AI as your co-Chief Growth Officer.

![Dashboard](https://img.shields.io/badge/Dashboard-Vercel-black)
![MCP](https://img.shields.io/badge/MCP-Claude-orange)
![License](https://img.shields.io/badge/License-Private-red)

## Features

### Data Sources
- **FluentCRM**: 16K+ subscribers with NRU persona segmentation
- **Google Ads**: Campaign performance via OAuth
- **Meta Ads**: Facebook/Instagram campaigns
- **TikTok Ads**: TikTok marketing campaigns
- **Google Analytics 4**: Website traffic and conversions
- **Google Search Console**: Organic search performance

### Dashboard Tabs
| Tab | Description |
|-----|-------------|
| Overview | Key metrics, status distribution, data quality |
| Growth Analytics | Cohort analysis, source performance, daily trends |
| Ads Performance | Cross-platform ad metrics, spend, ROAS |
| SEO Insights | Organic traffic, top queries, keyword opportunities |
| AI Reports | AI-generated daily/weekly strategy reports |
| NRU Personas | Age + device persona segmentation |
| Astrology | Vietnamese zodiac (12 con giáp) insights |

### AI co-CGO (MCP Integration)
Claude can access all dashboard data through MCP tools:
- `get_growth_summary` - Current metrics across all sources
- `analyze_persona` - Deep dive into specific persona
- `compare_channels` - Cross-platform performance comparison
- `save_insight` / `recall_memories` - Persistent AI memory
- `generate_report` - AI-powered analysis reports

## Quick Start

### 1. Deploy to Vercel
```bash
vercel --prod
```

### 2. Configure Environment Variables
Set these in Vercel Dashboard → Settings → Environment Variables:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret |
| `META_APP_ID` | Meta/Facebook app ID |
| `META_APP_SECRET` | Meta/Facebook app secret |
| `TIKTOK_CLIENT_KEY` | TikTok client key |
| `TIKTOK_CLIENT_SECRET` | TikTok client secret |
| `CRON_SECRET` | Secret for cron job auth |

### 3. Run MCP Server (for Claude integration)
```bash
npm install
npm run mcp
```

## Project Structure

```
├── src/
│   ├── config/          # Constants, Supabase config
│   ├── core/            # DataStore, EventBus
│   ├── connectors/      # API connectors (CRM, Ads, SEO)
│   ├── analytics/       # PersonaEngine, GrowthEngine
│   ├── ai/              # MemoryManager, InsightsEngine
│   ├── mcp/             # MCP Server for Claude
│   └── ui/              # ChartManager, AdsManager
├── api/
│   ├── oauth/           # OAuth handler (dynamic routes)
│   ├── reports/         # Report generation APIs
│   ├── cron/            # Scheduled jobs
│   └── lib/             # Shared utilities
├── dashboard.js         # Main dashboard (legacy)
├── index.html           # Dashboard UI
└── vercel.json          # Deployment config
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/oauth/{provider}/init` | GET | Start OAuth flow |
| `/api/oauth/{provider}/callback` | GET | OAuth callback |
| `/api/reports/generate` | POST | Generate AI report |
| `/api/reports/latest` | GET | Get latest reports |
| `/api/cron/daily-reports` | GET | Daily cron job |

### Supported OAuth Providers
`google` · `meta` · `tiktok` · `ga4` · `gsc`

## NRU Personas

| Persona | Age | Device | Best Channel |
|---------|-----|--------|--------------|
| Gen Z Explorer | 18-24 | Any | TikTok Organic |
| Career Climber | 25-34 | Mobile | Facebook Ads |
| Desktop Researcher | 25-44 | Desktop | SEO / Desktop FB |
| Life Transition | 35-44 | Mobile | Zalo OA |
| Established Buyer | 45+ | Any | Direct / Referral |
| Mystery Visitor | Unknown | Unknown | Progressive profiling |

## Database Schema (Supabase)

- `subscriber_cache` - Cached FluentCRM subscribers
- `daily_metrics` - Daily aggregated metrics
- `ad_performance` - Ads data by platform
- `seo_performance` - GSC/GA4 data
- `oauth_tokens` - OAuth credentials
- `ai_memory` - AI context memory
- `ai_reports` - Generated reports
- `audit_log` - Activity logging

## Development

```bash
# Local development
python3 -m http.server 8080

# Run MCP server with auto-reload
npm run mcp:dev

# Deploy to Vercel
vercel --prod
```

## Security

- OAuth tokens stored encrypted in Supabase
- Cron jobs authenticated with `CRON_SECRET`
- CORS configured for dashboard domain only
- No credentials exposed in client-side code

## Currency

All monetary values are in **VND** (Vietnamese Dong).

---

Built with Claude AI as co-CGO 🤖
