# FluentCRM Live Dashboard

A real-time dashboard for monitoring your FluentCRM metrics with AI-powered strategy recommendations.

## Features

- **Live Metrics**: Total contacts, lists, tags, and campaigns
- **Contact Status Distribution**: Visual breakdown of subscribed, pending, unsubscribed, bounced, and complained contacts
- **Growth Charts**: 7/14/30-day contact growth visualization
- **Top Lists & Tags**: See your most popular lists and tags
- **Campaign Performance**: Recent campaigns with open/click rates
- **Historical Tracking**: 90-day metric history stored locally
- **AI Strategy Report**: Daily recommendations based on your CRM data
- **Auto-Refresh**: Updates every 5 minutes + daily refresh at 6 AM

## Setup

### 1. Generate WordPress Application Password

1. Log into your WordPress admin
2. Go to **Users > Profile**
3. Scroll to **Application Passwords**
4. Enter a name (e.g., "FluentCRM Dashboard")
5. Click **Add New Application Password**
6. Copy the generated password (spaces are normal)

### 2. Run the Dashboard

**Option A: Open directly**
- Double-click `index.html` to open in your browser

**Option B: Run with local server (recommended for CORS)**
```bash
cd /Users/ductrinh/Desktop/fluentcrm-dashboard
python3 -m http.server 8080
```
Then open: http://localhost:8080

### 3. Connect to FluentCRM

1. Enter your WordPress site URL (e.g., `https://yoursite.com`)
2. Enter your WordPress username
3. Enter the Application Password you generated
4. Check "Remember credentials" to stay logged in
5. Click **Connect to Dashboard**

## CORS Configuration

If you see connection errors, add this to your WordPress theme's `functions.php`:

```php
add_action('rest_api_init', function() {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', function($value) {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Authorization, Content-Type');
        return $value;
    });
}, 15);
```

Or use a CORS plugin like "WP CORS" or "Enable CORS".

## Data Storage

- **Credentials**: Stored in browser localStorage (optional)
- **Historical Data**: Last 90 days stored in localStorage
- **No external servers**: All data stays on your machine

## Strategy Report

The dashboard analyzes your data and provides recommendations for:
- Contact growth optimization
- Pending contact management
- List segmentation strategies
- Tag utilization
- Campaign scheduling
- Email engagement improvement

Reports regenerate automatically at 6 AM daily or on-demand.

## Security Notes

- Never share your Application Password
- Use HTTPS for your WordPress site
- Revoke the Application Password if compromised
- Credentials are stored locally, not transmitted to third parties
