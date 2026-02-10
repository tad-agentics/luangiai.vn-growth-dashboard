// Growth Intelligence Platform - Persona Engine
// ==============================================

import { PERSONA_DEFINITIONS, ZODIAC_SIGNS, ZODIAC_ORDER } from '../config/constants.js';

/**
 * PersonaEngine - Handles all persona-related calculations and assignments
 */
export class PersonaEngine {
    constructor() {
        this.personas = PERSONA_DEFINITIONS;
    }

    /**
     * Parse date of birth to age
     * @param {string|Date} dob - Date of birth
     * @returns {number|null} Age in years
     */
    parseAge(dob) {
        if (!dob) return null;
        try {
            let birthDate;
            if (typeof dob === 'string') {
                const parts = dob.split(/[\/\-]/);
                if (parts.length === 3) {
                    if (parseInt(parts[0]) > 31) {
                        birthDate = new Date(parts[0], parts[1] - 1, parts[2]);
                    } else if (parseInt(parts[2]) > 31) {
                        birthDate = new Date(parts[2], parts[1] - 1, parts[0]);
                    } else {
                        birthDate = new Date(parts[2], parts[1] - 1, parts[0]);
                    }
                } else {
                    birthDate = new Date(dob);
                }
            } else {
                birthDate = new Date(dob);
            }

            if (isNaN(birthDate.getTime())) return null;

            const today = new Date();
            return (today - birthDate) / (365.25 * 24 * 60 * 60 * 1000);
        } catch (e) {
            return null;
        }
    }

    /**
     * Get age bucket from age
     * @param {number} age - Age in years
     * @returns {string} Age bucket
     */
    getAgeBucket(age) {
        if (age === null || age === undefined || age < 0 || age > 120) return 'Unknown';
        if (age < 25) return '18-24';
        if (age < 35) return '25-34';
        if (age < 45) return '35-44';
        if (age < 55) return '45-54';
        return '55+';
    }

    /**
     * Get device type from subscriber data
     * @param {Object} subscriber - Subscriber object
     * @returns {string} Device type
     */
    getDeviceType(subscriber) {
        const device = subscriber.custom_fields?.device ||
                       subscriber.device || subscriber.device_type ||
                       subscriber.custom_values?.device ||
                       subscriber.meta?.device ||
                       subscriber.user_agent || '';

        if (!device) return 'Unknown';

        const d = device.toLowerCase();

        if (d.includes('iphone') || d.includes('android') || d.includes('mobile')) {
            return 'Mobile';
        }
        if (d.includes('windows') || d.includes('mac') || d.includes('linux') ||
            d.includes('desktop') || (d.includes('apple') && !d.includes('iphone') && !d.includes('ipad'))) {
            return 'Desktop';
        }
        if (d.includes('ipad') || d.includes('tablet')) {
            return 'Tablet';
        }

        return 'Unknown';
    }

    /**
     * Assign persona based on birth year (generation)
     * Gen Z: 2000-2012, Millennial: 1981-1999, Gen X: 1965-1980, Boomer: 1946-1964
     * @param {number|string} birthYear - Birth year
     * @returns {string} Persona key
     */
    assignPersona(birthYear) {
        if (!birthYear || birthYear === 'Unknown') return 'unknown';
        const year = parseInt(birthYear);
        if (isNaN(year)) return 'unknown';

        if (year >= 2000 && year <= 2012) return 'gen_z';
        if (year >= 1981 && year <= 1999) return 'millennial';
        if (year >= 1965 && year <= 1980) return 'gen_x';
        if (year >= 1946 && year <= 1964) return 'boomer';

        // Outside defined ranges
        if (year > 2012) return 'gen_z';
        if (year < 1946) return 'boomer';

        return 'unknown';
    }

    /**
     * Parse gender value
     * @param {*} genderValue - Gender value (1, -1, 'male', 'female', etc.)
     * @returns {string} 'Male', 'Female', or 'Unknown'
     */
    parseGender(genderValue) {
        if (genderValue === '1' || genderValue === 1 || genderValue === 'male' || genderValue === 'Male') return 'Male';
        if (genderValue === '-1' || genderValue === -1 || genderValue === 'female' || genderValue === 'Female') return 'Female';
        return 'Unknown';
    }

    /**
     * Get Vietnamese zodiac sign from date of birth
     * @param {string|Date} dob - Date of birth
     * @returns {string|null} Zodiac sign
     */
    getZodiacSign(dob) {
        if (!dob) return null;
        try {
            let birthDate;
            if (typeof dob === 'string') {
                const parts = dob.split(/[\/\-]/);
                if (parts.length === 3) {
                    if (parseInt(parts[0]) > 31) {
                        birthDate = new Date(parts[0], parts[1] - 1, parts[2]);
                    } else {
                        birthDate = new Date(parts[2], parts[1] - 1, parts[0]);
                    }
                } else {
                    birthDate = new Date(dob);
                }
            } else {
                birthDate = new Date(dob);
            }

            if (isNaN(birthDate.getTime())) return null;

            const year = birthDate.getFullYear();
            // 2020 is year of the Rat (Tý), index 0
            const index = ((year - 2020) % 12 + 12) % 12;
            return ZODIAC_ORDER[index];
        } catch (e) {
            return null;
        }
    }

    /**
     * Parse birth time to time period
     * @param {string} birthtime - Birth time string
     * @returns {string} Time period
     */
    parseBirthTimePeriod(birthtime) {
        if (!birthtime) return 'Unknown';
        try {
            let hour;
            if (typeof birthtime === 'string') {
                const parts = birthtime.split(':');
                hour = parseInt(parts[0]);
            } else {
                hour = birthtime;
            }

            if (isNaN(hour)) return 'Unknown';

            if (hour >= 5 && hour < 12) return 'Morning (5-12)';
            if (hour >= 12 && hour < 17) return 'Afternoon (12-17)';
            if (hour >= 17 && hour < 21) return 'Evening (17-21)';
            return 'Night (21-5)';
        } catch (e) {
            return 'Unknown';
        }
    }

    /**
     * Categorize all subscribers into personas
     * @param {Array} subscribers - Array of subscribers
     * @returns {Object} Persona categorization results
     */
    categorizePersonas(subscribers) {
        const personas = {};
        const categorizationStats = {
            withAge: 0,
            withDevice: 0,
            withGender: 0,
            subscribed: 0,
            tagged: 0
        };

        // Initialize persona counts
        Object.keys(PERSONA_DEFINITIONS).forEach(key => {
            personas[key] = {
                ...PERSONA_DEFINITIONS[key],
                count: 0,
                subscribed: 0,
                converted: 0,
                genderBreakdown: { Male: 0, Female: 0, Unknown: 0 },
                deviceBreakdown: { Mobile: 0, Desktop: 0, Tablet: 0, Unknown: 0 }
            };
        });

        // Process each subscriber
        subscribers.forEach(subscriber => {
            // Extract DOB from various locations
            const dob = subscriber.date_of_birth ||
                       subscriber.custom_fields?.date_of_birth ||
                       subscriber.custom_fields?.dob ||
                       subscriber.custom_fields?.ngay_sinh ||
                       null;

            const age = this.parseAge(dob);
            const ageGroup = this.getAgeBucket(age);
            const deviceType = this.getDeviceType(subscriber);
            const personaKey = this.assignPersona(ageGroup, deviceType);

            // Update stats
            if (age !== null) categorizationStats.withAge++;
            if (deviceType !== 'Unknown') categorizationStats.withDevice++;
            if (subscriber.status === 'subscribed') categorizationStats.subscribed++;
            if (subscriber.tags?.length > 0 || subscriber._tagCount > 0) categorizationStats.tagged++;

            // Gender
            const genderValue = subscriber.custom_fields?.gender ||
                               subscriber.custom_fields?.gioi_tinh ||
                               null;
            const gender = this.parseGender(genderValue);
            if (gender !== 'Unknown') categorizationStats.withGender++;

            // Update persona
            personas[personaKey].count++;
            if (subscriber.status === 'subscribed') personas[personaKey].subscribed++;

            // Check conversion
            const isConverted = this.checkConversion(subscriber);
            if (isConverted) personas[personaKey].converted++;

            // Gender breakdown
            personas[personaKey].genderBreakdown[gender]++;

            // Device breakdown
            personas[personaKey].deviceBreakdown[deviceType]++;
        });

        // Calculate percentages
        Object.keys(personas).forEach(key => {
            const p = personas[key];
            p.percentage = subscribers.length > 0 ? (p.count / subscribers.length * 100).toFixed(1) : 0;
            p.cvr = p.count > 0 ? (p.converted / p.count * 100).toFixed(2) : 0;
        });

        return { personas, categorizationStats };
    }

    /**
     * Check if subscriber has converted
     * @param {Object} subscriber - Subscriber object
     * @returns {boolean} Has converted
     */
    checkConversion(subscriber) {
        // Method 1: contact_type is 'customer'
        if (subscriber.contact_type === 'customer') return true;

        // Method 2: Has conversion tag
        const conversionKeywords = ['paid', 'purchased', 'customer', 'buyer', 'converted',
                                    'order', 'subscription', 'premium', 'pro', 'vip',
                                    'thanh-toan', 'da-mua', 'khach-hang'];

        if (subscriber.tags && subscriber.tags.length > 0) {
            for (const tag of subscriber.tags) {
                const tagTitle = (tag.title || tag.name || '').toLowerCase();
                if (conversionKeywords.some(kw => tagTitle.includes(kw))) {
                    return true;
                }
            }
        }

        // Method 3: Custom field indicates conversion
        if (subscriber.custom_fields) {
            const cf = subscriber.custom_fields;
            if (cf.paid === 'yes' || cf.paid === true || cf.paid === 1) return true;
            if (cf.customer === 'yes' || cf.customer === true || cf.customer === 1) return true;
            if (cf.converted === 'yes' || cf.converted === true || cf.converted === 1) return true;
            if (cf.status === 'paid' || cf.status === 'customer') return true;
        }

        return false;
    }

    /**
     * Calculate persona growth over time
     * @param {Array} subscribers - Array of subscribers
     * @param {number} days - Number of days to analyze
     * @returns {Object} Growth data by persona
     */
    calculatePersonaGrowth(subscribers, days = 90) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const growth = {};
        Object.keys(PERSONA_DEFINITIONS).forEach(key => {
            growth[key] = {};
        });

        // Initialize date buckets
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];

            Object.keys(growth).forEach(persona => {
                growth[persona][dateKey] = 0;
            });
        }

        // Count subscribers by persona and date
        subscribers.forEach(subscriber => {
            if (!subscriber.created_at) return;

            const createdDate = new Date(subscriber.created_at);
            createdDate.setHours(0, 0, 0, 0);

            // Skip if older than our window
            const daysDiff = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24));
            if (daysDiff >= days) return;

            const dateKey = createdDate.toISOString().split('T')[0];

            // Assign persona
            const dob = subscriber.date_of_birth ||
                       subscriber.custom_fields?.date_of_birth ||
                       subscriber.custom_fields?.dob || null;
            const age = this.parseAge(dob);
            const ageGroup = this.getAgeBucket(age);
            const deviceType = this.getDeviceType(subscriber);
            const personaKey = this.assignPersona(ageGroup, deviceType);

            if (growth[personaKey][dateKey] !== undefined) {
                growth[personaKey][dateKey]++;
            }
        });

        return growth;
    }

    /**
     * Get persona by key
     * @param {string} key - Persona key
     * @returns {Object} Persona definition
     */
    getPersona(key) {
        return PERSONA_DEFINITIONS[key] || null;
    }

    /**
     * Get all persona definitions
     * @returns {Object} All persona definitions
     */
    getPersonaDefinitions() {
        return PERSONA_DEFINITIONS;
    }

    /**
     * Get zodiac sign info
     * @param {string} sign - Zodiac sign name
     * @returns {Object} Zodiac sign info
     */
    getZodiacInfo(sign) {
        return ZODIAC_SIGNS[sign] || null;
    }
}

// Singleton instance
let personaEngineInstance = null;

/**
 * Get PersonaEngine singleton
 * @returns {PersonaEngine}
 */
export function getPersonaEngine() {
    if (!personaEngineInstance) {
        personaEngineInstance = new PersonaEngine();
    }
    return personaEngineInstance;
}

export default PersonaEngine;
