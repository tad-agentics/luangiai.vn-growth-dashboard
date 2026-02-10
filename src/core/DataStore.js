// Growth Intelligence Platform - Centralized Data Store
// =====================================================

import { EventBus } from './EventBus.js';

/**
 * DataStore - Centralized state management for the Growth Intelligence Platform
 * Provides a single source of truth for all data across CRM, Ads, and SEO sources
 */
export class DataStore {
    constructor() {
        this.eventBus = new EventBus();

        // Initialize state structure
        this.state = {
            // CRM Data (FluentCRM)
            crm: {
                contacts: {
                    total: 0,
                    subscribed: 0,
                    pending: 0,
                    unsubscribed: 0,
                    bounced: 0,
                    complained: 0
                },
                subscribers: [],
                lists: [],
                tags: [],
                campaigns: [],
                sequences: [],
                personas: {},
                categorizationStats: {},
                personaHistory: {},
                growthAnalytics: {},
                astrologyStats: {}
            },

            // Ads Data
            ads: {
                google: [],
                meta: [],
                tiktok: [],
                unified: [] // Normalized across platforms
            },

            // SEO Data
            seo: {
                ga4: {
                    sessions: [],
                    conversions: [],
                    channels: []
                },
                gsc: {
                    queries: [],
                    pages: [],
                    performance: []
                }
            },

            // Unified Metrics (cross-platform)
            unified: {
                metrics: {},
                attribution: [],
                insights: []
            },

            // AI Context
            ai: {
                memory: [],
                reports: [],
                recommendations: []
            },

            // App State
            app: {
                isConnected: false,
                isSyncing: false,
                lastSyncTime: null,
                currentTab: 'overview',
                growthPeriod: 30,
                connectedSources: []
            }
        };

        // Proxy for change detection
        this.state = this._createProxy(this.state, '');
    }

    /**
     * Create a proxy for nested change detection
     * @private
     */
    _createProxy(obj, path) {
        const self = this;

        return new Proxy(obj, {
            set(target, property, value) {
                const oldValue = target[property];
                target[property] = value;

                const fullPath = path ? `${path}.${property}` : property;
                self.eventBus.emit('change', { path: fullPath, oldValue, newValue: value });
                self.eventBus.emit(`change:${fullPath}`, { oldValue, newValue: value });

                return true;
            },
            get(target, property) {
                const value = target[property];
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    const fullPath = path ? `${path}.${property}` : property;
                    return self._createProxy(value, fullPath);
                }
                return value;
            }
        });
    }

    /**
     * Get value at path (supports dot notation)
     * @param {string} path - Path like 'crm.subscribers' or 'ads.google'
     * @returns {*} Value at path
     */
    get(path) {
        if (!path) return this.state;

        const parts = path.split('.');
        let current = this.state;

        for (const part of parts) {
            if (current === undefined || current === null) return undefined;
            current = current[part];
        }

        return current;
    }

    /**
     * Set value at path (supports dot notation)
     * @param {string} path - Path like 'crm.subscribers'
     * @param {*} value - Value to set
     */
    set(path, value) {
        const parts = path.split('.');
        const lastKey = parts.pop();
        let current = this.state;

        for (const part of parts) {
            if (current[part] === undefined) {
                current[part] = {};
            }
            current = current[part];
        }

        current[lastKey] = value;
    }

    /**
     * Subscribe to changes at a specific path
     * @param {string} path - Path to watch (or '*' for all changes)
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribe(path, callback) {
        const eventName = path === '*' ? 'change' : `change:${path}`;
        return this.eventBus.on(eventName, callback);
    }

    /**
     * Batch update multiple paths at once
     * @param {Object} updates - Object with path: value pairs
     */
    batchUpdate(updates) {
        this.eventBus.emit('batchStart');

        for (const [path, value] of Object.entries(updates)) {
            this.set(path, value);
        }

        this.eventBus.emit('batchEnd', { paths: Object.keys(updates) });
    }

    /**
     * Get full state snapshot (for serialization)
     * @returns {Object} State snapshot
     */
    getSnapshot() {
        return JSON.parse(JSON.stringify(this.state));
    }

    /**
     * Restore state from snapshot
     * @param {Object} snapshot - State snapshot
     */
    restoreSnapshot(snapshot) {
        Object.assign(this.state, snapshot);
        this.eventBus.emit('restored', { snapshot });
    }

    /**
     * Reset specific section of state
     * @param {string} section - Section to reset ('crm', 'ads', 'seo', 'ai')
     */
    resetSection(section) {
        const defaults = {
            crm: {
                contacts: { total: 0, subscribed: 0, pending: 0, unsubscribed: 0, bounced: 0, complained: 0 },
                subscribers: [],
                lists: [],
                tags: [],
                campaigns: [],
                sequences: [],
                personas: {},
                categorizationStats: {},
                personaHistory: {},
                growthAnalytics: {},
                astrologyStats: {}
            },
            ads: { google: [], meta: [], tiktok: [], unified: [] },
            seo: { ga4: { sessions: [], conversions: [], channels: [] }, gsc: { queries: [], pages: [], performance: [] } },
            unified: { metrics: {}, attribution: [], insights: [] },
            ai: { memory: [], reports: [], recommendations: [] }
        };

        if (defaults[section]) {
            this.set(section, defaults[section]);
            this.eventBus.emit('reset', { section });
        }
    }

    /**
     * Check if a data source is connected
     * @param {string} source - Source identifier
     * @returns {boolean}
     */
    isSourceConnected(source) {
        return this.state.app.connectedSources.includes(source);
    }

    /**
     * Add a connected source
     * @param {string} source - Source identifier
     */
    addConnectedSource(source) {
        if (!this.isSourceConnected(source)) {
            this.state.app.connectedSources.push(source);
            this.eventBus.emit('sourceConnected', { source });
        }
    }

    /**
     * Remove a connected source
     * @param {string} source - Source identifier
     */
    removeConnectedSource(source) {
        const index = this.state.app.connectedSources.indexOf(source);
        if (index > -1) {
            this.state.app.connectedSources.splice(index, 1);
            this.eventBus.emit('sourceDisconnected', { source });
        }
    }
}

// Singleton instance
let dataStoreInstance = null;

/**
 * Get the DataStore singleton instance
 * @returns {DataStore}
 */
export function getDataStore() {
    if (!dataStoreInstance) {
        dataStoreInstance = new DataStore();
    }
    return dataStoreInstance;
}

export default DataStore;
