// Growth Intelligence Platform - Growth Analytics Engine
// ======================================================

import { PERSONA_DEFINITIONS } from '../config/constants.js';
import { getPersonaEngine } from './PersonaEngine.js';

/**
 * GrowthEngine - Handles all growth-related analytics calculations
 * Sources, cohorts, engagement, time-to-convert, etc.
 */
export class GrowthEngine {
    constructor() {
        this.personaEngine = getPersonaEngine();
    }

    /**
     * Parse acquisition source from URL/referrer
     * @param {string} source - Source URL or identifier
     * @returns {string} Parsed channel name
     */
    parseSource(source) {
        if (!source) return 'Direct';

        const s = source.toLowerCase();

        // Facebook Ads (fbclid parameter)
        if (s.includes('fbclid') || s.includes('fb_ad') || s.includes('facebook.com/ads')) {
            return 'Facebook Ads';
        }

        // Google Ads (gclid parameter)
        if (s.includes('gclid') || s.includes('google_ads') || s.includes('adwords')) {
            return 'Google Ads';
        }

        // TikTok (ttclid parameter)
        if (s.includes('ttclid') || s.includes('tiktok.com')) {
            return 'TikTok';
        }

        // Organic social platforms
        if (s.includes('facebook.com') || s.includes('fb.com') || s.includes('m.facebook')) {
            return 'Facebook';
        }
        if (s.includes('google.com') || s.includes('google.co.')) {
            return 'Google';
        }
        if (s.includes('zalo') || s.includes('zaloapp')) {
            return 'Zalo';
        }
        if (s.includes('youtube.com') || s.includes('youtu.be')) {
            return 'YouTube';
        }
        if (s.includes('instagram.com')) {
            return 'Instagram';
        }

        // UTM tracking
        if (s.includes('utm_source') || s.includes('utm_medium') || s.includes('utm_campaign')) {
            // Try to extract utm_source
            const match = s.match(/utm_source[=:]([^&\s]+)/i);
            if (match) {
                const utmSource = match[1].toLowerCase();
                if (utmSource.includes('facebook')) return 'Facebook';
                if (utmSource.includes('google')) return 'Google';
                if (utmSource.includes('tiktok')) return 'TikTok';
                if (utmSource.includes('zalo')) return 'Zalo';
                if (utmSource.includes('email') || utmSource.includes('newsletter')) return 'Email';
                return 'UTM Tagged';
            }
            return 'UTM Tagged';
        }

        // Email
        if (s.includes('email') || s.includes('newsletter') || s.includes('mailchimp')) {
            return 'Email';
        }

        // Has referrer but unrecognized
        if (s.includes('http') || s.includes('www.')) {
            return 'Other Referral';
        }

        // Check if it looks like a direct identifier
        if (s === 'direct' || s === 'none' || s === '') {
            return 'Direct';
        }

        return 'Organic';
    }

    /**
     * Get week start date (Monday)
     * @param {Date} date - Input date
     * @returns {Date} Monday of that week
     */
    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    /**
     * Calculate comprehensive growth analytics
     * @param {Array} subscribers - Array of subscribers
     * @returns {Object} Growth analytics data
     */
    calculateGrowthAnalytics(subscribers) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const analytics = {
            sources: {},
            sourcesByPersona: {},
            personaStats: {},
            cohorts: {},
            dailyRegistrations: {},
            timeToConvert: [],
            engagement: { active: 0, recent: 0, dormant: 0, inactive: 0, never: 0 },
            leads: 0,
            customers: 0
        };

        // Initialize persona stats
        Object.keys(PERSONA_DEFINITIONS).forEach(key => {
            analytics.personaStats[key] = {
                total: 0,
                customers: 0,
                timeToConvert: [],
                avgTimeToConvert: null,
                topSource: null,
                topSourcePct: 0
            };
        });

        // Initialize daily registrations for last 30 days
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            analytics.dailyRegistrations[dateKey] = { total: 0, leads: 0, customers: 0 };
        }

        // Process each subscriber
        subscribers.forEach(subscriber => {
            // 1. ACQUISITION SOURCE
            const channel = this.parseSource(subscriber.source || '');
            if (!analytics.sources[channel]) {
                analytics.sources[channel] = { total: 0, leads: 0, customers: 0 };
            }
            analytics.sources[channel].total++;

            const isCustomer = subscriber.contact_type === 'customer';
            if (isCustomer) {
                analytics.customers++;
                analytics.sources[channel].customers++;
            } else {
                analytics.leads++;
                analytics.sources[channel].leads++;
            }

            // 2. SOURCE BY PERSONA
            const dob = subscriber.custom_fields?.dob || subscriber.date_of_birth || null;
            const age = this.personaEngine.parseAge(dob);
            const ageGroup = this.personaEngine.getAgeBucket(age);
            const deviceType = this.personaEngine.getDeviceType(subscriber);
            const personaKey = this.personaEngine.assignPersona(ageGroup, deviceType);

            if (!analytics.sourcesByPersona[personaKey]) {
                analytics.sourcesByPersona[personaKey] = {};
            }
            if (!analytics.sourcesByPersona[personaKey][channel]) {
                analytics.sourcesByPersona[personaKey][channel] = { total: 0, customers: 0 };
            }
            analytics.sourcesByPersona[personaKey][channel].total++;
            if (isCustomer) {
                analytics.sourcesByPersona[personaKey][channel].customers++;
            }

            // 2b. PERSONA STATS
            analytics.personaStats[personaKey].total++;
            if (isCustomer) {
                analytics.personaStats[personaKey].customers++;
                if (subscriber.updated_at && subscriber.created_at) {
                    const created = new Date(subscriber.created_at);
                    const updated = new Date(subscriber.updated_at);
                    const daysToConvert = Math.max(0, Math.floor((updated - created) / (1000 * 60 * 60 * 24)));
                    if (daysToConvert <= 365) {
                        analytics.personaStats[personaKey].timeToConvert.push(daysToConvert);
                    }
                }
            }

            // 3. COHORT ANALYSIS (Weekly)
            if (subscriber.created_at) {
                const createdDate = new Date(subscriber.created_at);
                const weekStart = this.getWeekStart(createdDate);
                const weekKey = weekStart.toISOString().split('T')[0];

                if (!analytics.cohorts[weekKey]) {
                    analytics.cohorts[weekKey] = { total: 0, leads: 0, customers: 0, daysToConvert: [] };
                }
                analytics.cohorts[weekKey].total++;

                if (isCustomer) {
                    analytics.cohorts[weekKey].customers++;
                    if (subscriber.updated_at && subscriber.created_at) {
                        const created = new Date(subscriber.created_at);
                        const updated = new Date(subscriber.updated_at);
                        const daysToConvert = Math.max(0, Math.floor((updated - created) / (1000 * 60 * 60 * 24)));
                        if (daysToConvert <= 365) {
                            analytics.cohorts[weekKey].daysToConvert.push(daysToConvert);
                            analytics.timeToConvert.push(daysToConvert);
                        }
                    }
                } else {
                    analytics.cohorts[weekKey].leads++;
                }

                // 4. DAILY REGISTRATIONS
                const dateKey = createdDate.toISOString().split('T')[0];
                if (analytics.dailyRegistrations[dateKey]) {
                    analytics.dailyRegistrations[dateKey].total++;
                    if (isCustomer) {
                        analytics.dailyRegistrations[dateKey].customers++;
                    } else {
                        analytics.dailyRegistrations[dateKey].leads++;
                    }
                }
            }

            // 5. ENGAGEMENT STATUS
            if (subscriber.last_activity) {
                const lastActive = new Date(subscriber.last_activity);
                const daysSinceActive = Math.floor((today - lastActive) / (1000 * 60 * 60 * 24));

                if (daysSinceActive <= 7) {
                    analytics.engagement.active++;
                } else if (daysSinceActive <= 30) {
                    analytics.engagement.recent++;
                } else if (daysSinceActive <= 90) {
                    analytics.engagement.dormant++;
                } else {
                    analytics.engagement.inactive++;
                }
            } else {
                analytics.engagement.never++;
            }
        });

        // Calculate averages
        analytics.avgTimeToConvert = analytics.timeToConvert.length > 0
            ? (analytics.timeToConvert.reduce((a, b) => a + b, 0) / analytics.timeToConvert.length).toFixed(1)
            : 0;

        // Calculate cohort averages
        Object.values(analytics.cohorts).forEach(cohort => {
            cohort.avgDaysToConvert = cohort.daysToConvert.length > 0
                ? (cohort.daysToConvert.reduce((a, b) => a + b, 0) / cohort.daysToConvert.length).toFixed(1)
                : '-';
            cohort.cvr = cohort.total > 0 ? (cohort.customers / cohort.total * 100).toFixed(2) : 0;
        });

        // Week-over-week comparison
        const thisWeekStart = this.getWeekStart(today);
        const lastWeekStart = new Date(thisWeekStart);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);

        let thisWeekNew = 0, lastWeekNew = 0;
        Object.entries(analytics.dailyRegistrations).forEach(([date, data]) => {
            const d = new Date(date);
            if (d >= thisWeekStart) {
                thisWeekNew += data.total;
            } else if (d >= lastWeekStart && d < thisWeekStart) {
                lastWeekNew += data.total;
            }
        });

        analytics.thisWeekNew = thisWeekNew;
        analytics.lastWeekNew = lastWeekNew;
        analytics.weekOverWeekChange = lastWeekNew > 0
            ? ((thisWeekNew - lastWeekNew) / lastWeekNew * 100).toFixed(0)
            : (thisWeekNew > 0 ? 100 : 0);

        // Calculate best channel per persona
        analytics.bestChannelByPersona = this.calculateBestChannels(analytics.sourcesByPersona);

        // Calculate detailed persona stats
        this.calculatePersonaDetailedStats(analytics);

        return analytics;
    }

    /**
     * Calculate detailed stats per persona
     * @param {Object} analytics - Analytics object to enhance
     */
    calculatePersonaDetailedStats(analytics) {
        const overallCVR = analytics.customers / (analytics.leads + analytics.customers) || 0;
        const overallAvgTime = analytics.timeToConvert.length > 0
            ? analytics.timeToConvert.reduce((a, b) => a + b, 0) / analytics.timeToConvert.length
            : null;

        Object.entries(analytics.personaStats).forEach(([personaKey, stats]) => {
            // Calculate average time to convert
            if (stats.timeToConvert.length > 0) {
                stats.avgTimeToConvert = stats.timeToConvert.reduce((a, b) => a + b, 0) / stats.timeToConvert.length;
            }

            // Calculate CVR
            stats.cvr = stats.total > 0 ? (stats.customers / stats.total) : 0;
            stats.cvrVsAverage = overallCVR > 0 ? ((stats.cvr - overallCVR) / overallCVR * 100) : 0;

            // Find top source for this persona
            const sources = analytics.sourcesByPersona[personaKey] || {};
            let topSource = null;
            let topSourceCount = 0;
            let totalFromSources = 0;

            Object.entries(sources).forEach(([channel, data]) => {
                totalFromSources += data.total;
                if (data.total > topSourceCount) {
                    topSourceCount = data.total;
                    topSource = channel;
                }
            });

            stats.topSource = topSource;
            stats.topSourcePct = totalFromSources > 0 ? (topSourceCount / totalFromSources * 100) : 0;
            stats.sampleSize = stats.customers;

            // Dynamic nurture strategy
            stats.nurtureStrategy = this.calculateNurtureStrategy(stats, overallAvgTime);
        });
    }

    /**
     * Determine nurture strategy based on conversion behavior
     * @param {Object} stats - Persona stats
     * @param {number} overallAvgTime - Overall average time to convert
     * @returns {Object} Nurture strategy
     */
    calculateNurtureStrategy(stats, overallAvgTime) {
        const avgTime = stats.avgTimeToConvert;
        const cvr = stats.cvr;
        const sampleSize = stats.sampleSize;

        if (sampleSize < 5) {
            return {
                priority: 'Unknown',
                reason: 'Insufficient data',
                description: `Only ${sampleSize} conversions`
            };
        }

        if (avgTime !== null && avgTime < 3) {
            return {
                priority: 'Low',
                reason: 'Fast converters',
                description: `Avg ${avgTime.toFixed(0)}d to convert`
            };
        }

        if (avgTime !== null && avgTime >= 3 && avgTime <= 14) {
            return {
                priority: 'Medium',
                reason: 'Standard journey',
                description: `Avg ${avgTime.toFixed(0)}d to convert`
            };
        }

        if (avgTime !== null && avgTime > 14) {
            return {
                priority: 'High',
                reason: 'Delayed converters',
                description: `Avg ${avgTime.toFixed(0)}d to convert`
            };
        }

        if (cvr > 0.05) {
            return {
                priority: 'Medium',
                reason: 'Good CVR',
                description: `${(cvr * 100).toFixed(1)}% conversion rate`
            };
        }

        return {
            priority: 'Medium',
            reason: 'Standard',
            description: 'Default nurturing'
        };
    }

    /**
     * Calculate best performing channel for each persona
     * @param {Object} sourcesByPersona - Sources grouped by persona
     * @returns {Object} Best channel per persona
     */
    calculateBestChannels(sourcesByPersona) {
        const bestChannels = {};
        const MIN_SAMPLE_SIZE = 10;

        Object.entries(sourcesByPersona).forEach(([personaKey, channels]) => {
            let bestChannel = null;
            let bestCVR = -1;
            let bestVolume = 0;
            let channelStats = [];

            Object.entries(channels).forEach(([channel, data]) => {
                if (channel === 'Unknown') return;

                const cvr = data.total > 0 ? (data.customers / data.total) : 0;
                channelStats.push({ channel, total: data.total, customers: data.customers, cvr });

                if (data.total >= MIN_SAMPLE_SIZE) {
                    if (cvr > bestCVR || (cvr === bestCVR && data.total > bestVolume)) {
                        bestCVR = cvr;
                        bestChannel = channel;
                        bestVolume = data.total;
                    }
                }
            });

            // Fallback to highest volume channel
            if (!bestChannel && channelStats.length > 0) {
                const sorted = channelStats
                    .filter(c => c.channel !== 'Unknown')
                    .sort((a, b) => b.total - a.total);
                if (sorted.length > 0) {
                    bestChannel = sorted[0].channel;
                    bestCVR = sorted[0].cvr;
                }
            }

            const isDataDriven = bestChannel && channelStats.find(c => c.channel === bestChannel)?.total >= MIN_SAMPLE_SIZE;

            bestChannels[personaKey] = {
                channel: bestChannel || PERSONA_DEFINITIONS[personaKey]?.bestChannel || 'Unknown',
                cvr: bestCVR >= 0 ? (bestCVR * 100).toFixed(2) : '-',
                isDataDriven,
                stats: channelStats.slice(0, 3)
            };
        });

        return bestChannels;
    }

    /**
     * Calculate time-to-convert distribution
     * @param {Array} timeToConvert - Array of days to convert
     * @returns {Object} Distribution buckets
     */
    calculateTimeToConvertDistribution(timeToConvert) {
        const buckets = {
            '0': 0,
            '1': 0,
            '2': 0,
            '3-7': 0,
            '8-14': 0,
            '15-30': 0,
            '31-60': 0,
            '61+': 0
        };

        timeToConvert.forEach(days => {
            if (days === 0) buckets['0']++;
            else if (days === 1) buckets['1']++;
            else if (days === 2) buckets['2']++;
            else if (days <= 7) buckets['3-7']++;
            else if (days <= 14) buckets['8-14']++;
            else if (days <= 30) buckets['15-30']++;
            else if (days <= 60) buckets['31-60']++;
            else buckets['61+']++;
        });

        return buckets;
    }
}

// Singleton instance
let growthEngineInstance = null;

/**
 * Get GrowthEngine singleton
 * @returns {GrowthEngine}
 */
export function getGrowthEngine() {
    if (!growthEngineInstance) {
        growthEngineInstance = new GrowthEngine();
    }
    return growthEngineInstance;
}

export default GrowthEngine;
