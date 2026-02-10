// Growth Intelligence Platform - Event Bus
// =========================================

/**
 * EventBus - Simple pub/sub system for component communication
 */
export class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);

        // Return unsubscribe function
        return () => this.off(event, callback);
    }

    /**
     * Subscribe to an event (only fires once)
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    once(event, callback) {
        const wrapper = (...args) => {
            this.off(event, wrapper);
            callback(...args);
        };
        this.on(event, wrapper);
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback to remove
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event handler for "${event}":`, error);
                }
            });
        }

        // Also emit to wildcard listeners
        if (this.listeners.has('*')) {
            this.listeners.get('*').forEach(callback => {
                try {
                    callback({ event, data });
                } catch (error) {
                    console.error(`Error in wildcard handler for "${event}":`, error);
                }
            });
        }
    }

    /**
     * Remove all listeners for an event (or all events)
     * @param {string} [event] - Event name (optional, removes all if not provided)
     */
    clear(event) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }

    /**
     * Get listener count for an event
     * @param {string} event - Event name
     * @returns {number} Number of listeners
     */
    listenerCount(event) {
        return this.listeners.has(event) ? this.listeners.get(event).size : 0;
    }

    /**
     * Get all registered events
     * @returns {string[]} Array of event names
     */
    eventNames() {
        return Array.from(this.listeners.keys());
    }
}

// Global event bus singleton
let globalEventBus = null;

/**
 * Get the global EventBus singleton
 * @returns {EventBus}
 */
export function getEventBus() {
    if (!globalEventBus) {
        globalEventBus = new EventBus();
    }
    return globalEventBus;
}

export default EventBus;
