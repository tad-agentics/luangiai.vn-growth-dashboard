// Growth Intelligence Platform - AI Memory Manager
// ================================================

import { getSupabaseClient, logAuditEvent } from '../config/supabase.js';

/**
 * MemoryManager - Handles persistent context memory for AI co-CGO
 * Enables Claude to remember decisions, insights, and preferences over time
 */
export class MemoryManager {
    constructor() {
        this.memoryTypes = ['decision', 'insight', 'preference', 'fact'];
        this.defaultRetention = {
            decision: 365,    // 1 year
            insight: 90,      // 90 days
            preference: 180,  // 6 months
            fact: 180         // 6 months
        };
    }

    /**
     * Save a new memory
     * @param {Object} memory - Memory object
     * @returns {Promise<Object>} Saved memory
     */
    async save(memory) {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Supabase not available');

        const {
            memory_type,
            context,
            content,
            importance = 5,
            tags = [],
            source_type = 'manual',
            source_id = null
        } = memory;

        // Validate memory type
        if (!this.memoryTypes.includes(memory_type)) {
            throw new Error(`Invalid memory type: ${memory_type}`);
        }

        // Calculate expiration based on type
        const retentionDays = this.defaultRetention[memory_type];
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + retentionDays);

        const { data, error } = await supabase
            .from('ai_memory')
            .insert({
                memory_type,
                context,
                content,
                importance: Math.max(1, Math.min(10, importance)),
                tags,
                source_type,
                source_id,
                expires_at: expiresAt.toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        logAuditEvent('memory_saved', {
            memory_id: data.id,
            memory_type,
            context
        });

        return data;
    }

    /**
     * Recall memories based on search criteria
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Matching memories
     */
    async recall(options = {}) {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Supabase not available');

        const {
            query = null,
            memory_type = null,
            tags = [],
            min_importance = 0,
            limit = 10,
            include_expired = false
        } = options;

        let queryBuilder = supabase
            .from('ai_memory')
            .select('*')
            .gte('importance', min_importance)
            .order('importance', { ascending: false })
            .order('last_accessed', { ascending: false })
            .limit(limit);

        // Filter by memory type
        if (memory_type && memory_type !== 'all') {
            queryBuilder = queryBuilder.eq('memory_type', memory_type);
        }

        // Exclude expired unless requested
        if (!include_expired) {
            queryBuilder = queryBuilder.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
        }

        // Search in context and content
        if (query) {
            queryBuilder = queryBuilder.or(`context.ilike.%${query}%,content.ilike.%${query}%`);
        }

        // Filter by tags (any match)
        if (tags.length > 0) {
            queryBuilder = queryBuilder.overlaps('tags', tags);
        }

        const { data, error } = await queryBuilder;

        if (error) throw error;

        // Update access tracking
        if (data?.length > 0) {
            await this.updateAccessTracking(data.map(m => m.id));
        }

        return data || [];
    }

    /**
     * Update access tracking for retrieved memories
     * @param {Array} ids - Memory IDs
     */
    async updateAccessTracking(ids) {
        const supabase = getSupabaseClient();
        if (!supabase || !ids.length) return;

        // Note: Supabase doesn't support increment in JS client directly
        // We'll update last_accessed and handle access_count separately
        await supabase
            .from('ai_memory')
            .update({ last_accessed: new Date().toISOString() })
            .in('id', ids);
    }

    /**
     * Get memories by context
     * @param {string} context - Context to search
     * @returns {Promise<Array>} Matching memories
     */
    async getByContext(context) {
        return this.recall({ query: context });
    }

    /**
     * Get recent decisions
     * @param {number} limit - Maximum results
     * @returns {Promise<Array>} Recent decisions
     */
    async getRecentDecisions(limit = 5) {
        return this.recall({
            memory_type: 'decision',
            limit,
            min_importance: 3
        });
    }

    /**
     * Get user preferences
     * @returns {Promise<Array>} All active preferences
     */
    async getPreferences() {
        return this.recall({
            memory_type: 'preference',
            limit: 50
        });
    }

    /**
     * Get high-importance insights
     * @param {number} limit - Maximum results
     * @returns {Promise<Array>} Important insights
     */
    async getImportantInsights(limit = 10) {
        return this.recall({
            memory_type: 'insight',
            min_importance: 7,
            limit
        });
    }

    /**
     * Delete a memory
     * @param {string} id - Memory ID
     * @returns {Promise<boolean>} Success
     */
    async delete(id) {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Supabase not available');

        const { error } = await supabase
            .from('ai_memory')
            .delete()
            .eq('id', id);

        if (error) throw error;

        logAuditEvent('memory_deleted', { memory_id: id });
        return true;
    }

    /**
     * Update memory importance
     * @param {string} id - Memory ID
     * @param {number} importance - New importance (1-10)
     * @returns {Promise<Object>} Updated memory
     */
    async updateImportance(id, importance) {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Supabase not available');

        const { data, error } = await supabase
            .from('ai_memory')
            .update({ importance: Math.max(1, Math.min(10, importance)) })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Clean up expired memories
     * @returns {Promise<number>} Number of deleted memories
     */
    async cleanupExpired() {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Supabase not available');

        const { data, error } = await supabase
            .from('ai_memory')
            .delete()
            .lt('expires_at', new Date().toISOString())
            .select('id');

        if (error) throw error;

        const count = data?.length || 0;
        if (count > 0) {
            logAuditEvent('memory_cleanup', { deleted_count: count });
        }

        return count;
    }

    /**
     * Get memory statistics
     * @returns {Promise<Object>} Memory stats
     */
    async getStats() {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Supabase not available');

        const { data, error } = await supabase
            .from('ai_memory')
            .select('memory_type, importance');

        if (error) throw error;

        const stats = {
            total: data?.length || 0,
            by_type: {},
            avg_importance: 0,
            high_importance: 0
        };

        if (data?.length > 0) {
            let totalImportance = 0;

            data.forEach(m => {
                stats.by_type[m.memory_type] = (stats.by_type[m.memory_type] || 0) + 1;
                totalImportance += m.importance;
                if (m.importance >= 7) stats.high_importance++;
            });

            stats.avg_importance = (totalImportance / data.length).toFixed(1);
        }

        return stats;
    }

    /**
     * Build context for AI prompt
     * Returns a summary of relevant memories for a given topic
     * @param {string} topic - Topic to gather context for
     * @returns {Promise<string>} Context summary
     */
    async buildContext(topic) {
        const memories = await this.recall({
            query: topic,
            limit: 5,
            min_importance: 3
        });

        if (memories.length === 0) {
            return 'No relevant prior context found.';
        }

        const context = memories.map(m => {
            const typeLabel = {
                decision: 'Previous Decision',
                insight: 'Past Insight',
                preference: 'User Preference',
                fact: 'Known Fact'
            }[m.memory_type] || 'Memory';

            return `[${typeLabel}] ${m.context}: ${m.content}`;
        }).join('\n');

        return `Relevant context from memory:\n${context}`;
    }

    /**
     * Save a decision with associated reasoning
     * @param {string} decision - The decision made
     * @param {string} reasoning - Why this decision was made
     * @param {Array} tags - Tags for categorization
     * @returns {Promise<Object>} Saved memory
     */
    async saveDecision(decision, reasoning, tags = []) {
        return this.save({
            memory_type: 'decision',
            context: decision,
            content: reasoning,
            importance: 7,
            tags: ['decision', ...tags],
            source_type: 'ai_decision'
        });
    }

    /**
     * Save an insight from data analysis
     * @param {string} insight - The insight discovered
     * @param {string} evidence - Supporting evidence
     * @param {number} importance - How important (1-10)
     * @returns {Promise<Object>} Saved memory
     */
    async saveInsight(insight, evidence, importance = 5) {
        return this.save({
            memory_type: 'insight',
            context: insight,
            content: evidence,
            importance,
            tags: ['insight', 'analysis'],
            source_type: 'auto_insight'
        });
    }

    /**
     * Save a user preference
     * @param {string} preference - The preference
     * @param {string} details - Additional details
     * @returns {Promise<Object>} Saved memory
     */
    async savePreference(preference, details = '') {
        return this.save({
            memory_type: 'preference',
            context: preference,
            content: details,
            importance: 6,
            tags: ['preference', 'user'],
            source_type: 'user_feedback'
        });
    }
}

// Singleton instance
let memoryManagerInstance = null;

/**
 * Get MemoryManager singleton
 * @returns {MemoryManager}
 */
export function getMemoryManager() {
    if (!memoryManagerInstance) {
        memoryManagerInstance = new MemoryManager();
    }
    return memoryManagerInstance;
}

export default MemoryManager;
