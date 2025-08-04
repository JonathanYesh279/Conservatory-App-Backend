/**
 * Query Cache Service
 * Provides intelligent caching for frequently accessed date-related queries
 */

import { generateCacheKey, estimateQueryComplexity } from '../utils/queryOptimization.js';
import { now, formatDateTime } from '../utils/dateHelpers.js';

class QueryCacheService {
  constructor() {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      totalQueries: 0
    };
    this.config = {
      maxSize: 1000, // Maximum number of cached items
      defaultTTL: 5 * 60 * 1000, // 5 minutes default TTL
      maxTTL: 60 * 60 * 1000, // 1 hour maximum TTL
      cleanupInterval: 10 * 60 * 1000 // 10 minutes cleanup interval
    };
    
    // Start cleanup interval
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Get cached query result
   * @param {string} queryType - Type of query
   * @param {Object} params - Query parameters
   * @returns {Object|null} Cached result or null if not found
   */
  get(queryType, params = {}) {
    this.stats.totalQueries++;
    
    const key = generateCacheKey(queryType, params);
    const cachedItem = this.cache.get(key);
    
    if (!cachedItem) {
      this.stats.misses++;
      return null;
    }
    
    // Check if item has expired
    if (Date.now() > cachedItem.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      return null;
    }
    
    // Update access time and hit count
    cachedItem.lastAccessed = Date.now();
    cachedItem.hitCount++;
    this.stats.hits++;
    
    return cachedItem.data;
  }

  /**
   * Set cached query result
   * @param {string} queryType - Type of query
   * @param {Object} params - Query parameters
   * @param {any} data - Data to cache
   * @param {Object} options - Cache options
   */
  set(queryType, params = {}, data, options = {}) {
    const key = generateCacheKey(queryType, params);
    const ttl = this._calculateTTL(queryType, params, options);
    
    const cacheItem = {
      key,
      data,
      queryType,
      params,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      expiresAt: Date.now() + ttl,
      hitCount: 0,
      size: this._estimateSize(data)
    };
    
    // Evict items if cache is full
    if (this.cache.size >= this.config.maxSize) {
      this._evictLeastUsed();
    }
    
    this.cache.set(key, cacheItem);
    this.stats.sets++;
  }

  /**
   * Invalidate cache entries by pattern
   * @param {string} queryType - Query type to invalidate
   * @param {Object} pattern - Pattern to match for invalidation
   */
  invalidate(queryType, pattern = {}) {
    let invalidatedCount = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (item.queryType === queryType) {
        // Check if item matches invalidation pattern
        if (this._matchesPattern(item.params, pattern)) {
          this.cache.delete(key);
          invalidatedCount++;
        }
      }
    }
    
    this.stats.evictions += invalidatedCount;
    return invalidatedCount;
  }

  /**
   * Invalidate all cache entries for a specific date
   * @param {string|Date} date - Date to invalidate
   */
  invalidateByDate(date) {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    let invalidatedCount = 0;
    
    for (const [key, item] of this.cache.entries()) {
      const params = item.params;
      
      // Check if cache item is related to the specific date
      if (this._isDateRelated(params, dateStr)) {
        this.cache.delete(key);
        invalidatedCount++;
      }
    }
    
    this.stats.evictions += invalidatedCount;
    return invalidatedCount;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.evictions += size;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const hitRate = this.stats.totalQueries > 0 ? 
      (this.stats.hits / this.stats.totalQueries * 100).toFixed(2) : 0;
    
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      size: this.cache.size,
      maxSize: this.config.maxSize,
      utilization: `${(this.cache.size / this.config.maxSize * 100).toFixed(2)}%`,
      averageItemSize: this._getAverageItemSize(),
      timestamp: formatDateTime(now())
    };
  }

  /**
   * Get cache health metrics
   * @returns {Object} Health metrics
   */
  getHealth() {
    const stats = this.getStats();
    const hitRate = parseFloat(stats.hitRate);
    
    let health = 'good';
    if (hitRate < 30) {
      health = 'poor';
    } else if (hitRate < 60) {
      health = 'fair';
    } else if (hitRate > 80) {
      health = 'excellent';
    }
    
    return {
      status: health,
      hitRate: stats.hitRate,
      size: stats.size,
      utilization: stats.utilization,
      recommendations: this._generateHealthRecommendations(stats)
    };
  }

  /**
   * Get top cache entries by hit count
   * @param {number} limit - Number of entries to return
   * @returns {Array} Top cache entries
   */
  getTopEntries(limit = 10) {
    const entries = Array.from(this.cache.values())
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, limit)
      .map(item => ({
        queryType: item.queryType,
        params: item.params,
        hitCount: item.hitCount,
        createdAt: new Date(item.createdAt).toISOString(),
        lastAccessed: new Date(item.lastAccessed).toISOString(),
        size: item.size
      }));
    
    return entries;
  }

  /**
   * Optimize cache by removing expired and least used items
   */
  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;
    
    // Remove expired items
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    
    this.stats.evictions += cleanedCount;
    return cleanedCount;
  }

  /**
   * Destroy the cache service
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }

  /**
   * Private helper methods
   */

  /**
   * Calculate TTL based on query type and complexity
   * @private
   */
  _calculateTTL(queryType, params, options) {
    if (options.ttl) {
      return Math.min(options.ttl, this.config.maxTTL);
    }
    
    let ttl = this.config.defaultTTL;
    
    // Longer TTL for complex queries
    const complexity = estimateQueryComplexity(params);
    if (complexity > 5) {
      ttl *= 2;
    }
    
    // Shorter TTL for real-time data
    if (queryType.includes('attendance') || queryType.includes('current')) {
      ttl = Math.min(ttl, 2 * 60 * 1000); // 2 minutes max
    }
    
    // Longer TTL for historical data
    if (params.endDate && new Date(params.endDate) < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
      ttl *= 4; // 4x longer for historical data
    }
    
    return Math.min(ttl, this.config.maxTTL);
  }

  /**
   * Evict least recently used items
   * @private
   */
  _evictLeastUsed() {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    // Remove 10% of items or at least 1
    const removeCount = Math.max(1, Math.floor(entries.length * 0.1));
    
    for (let i = 0; i < removeCount; i++) {
      this.cache.delete(entries[i][0]);
      this.stats.evictions++;
    }
  }

  /**
   * Check if cache item matches invalidation pattern
   * @private
   */
  _matchesPattern(params, pattern) {
    for (const [key, value] of Object.entries(pattern)) {
      if (params[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if parameters are related to a specific date
   * @private
   */
  _isDateRelated(params, dateStr) {
    const dateFields = ['date', 'fromDate', 'toDate', 'startDate', 'endDate'];
    
    for (const field of dateFields) {
      if (params[field]) {
        const paramDate = typeof params[field] === 'string' ? 
          params[field].split('T')[0] : 
          new Date(params[field]).toISOString().split('T')[0];
        
        if (paramDate === dateStr) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Estimate the memory size of cached data
   * @private
   */
  _estimateSize(data) {
    try {
      return JSON.stringify(data).length * 2; // Rough estimate in bytes
    } catch (error) {
      return 1000; // Default estimate
    }
  }

  /**
   * Get average item size
   * @private
   */
  _getAverageItemSize() {
    if (this.cache.size === 0) return 0;
    
    let totalSize = 0;
    for (const item of this.cache.values()) {
      totalSize += item.size || 0;
    }
    
    return Math.round(totalSize / this.cache.size);
  }

  /**
   * Generate health recommendations
   * @private
   */
  _generateHealthRecommendations(stats) {
    const recommendations = [];
    const hitRate = parseFloat(stats.hitRate);
    
    if (hitRate < 30) {
      recommendations.push({
        type: 'low_hit_rate',
        message: 'Cache hit rate is low. Consider adjusting TTL or cache size.',
        action: 'Review query patterns and increase cache size or TTL'
      });
    }
    
    if (parseFloat(stats.utilization) > 90) {
      recommendations.push({
        type: 'high_utilization',
        message: 'Cache utilization is high. Consider increasing cache size.',
        action: 'Increase maxSize configuration or optimize query patterns'
      });
    }
    
    if (this.stats.evictions > this.stats.sets * 0.3) {
      recommendations.push({
        type: 'high_eviction_rate',
        message: 'High eviction rate detected. Items are being removed frequently.',
        action: 'Increase cache size or review TTL settings'
      });
    }
    
    return recommendations;
  }
}

export default new QueryCacheService();